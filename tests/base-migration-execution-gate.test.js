const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const scriptsDir = path.join(rootDir, 'scripts');

const inventoryPath = path.join(scriptsDir, 'base-migration-inventory.js');
const scorePath = path.join(scriptsDir, 'base-migration-score.js');
const verifyPath = path.join(scriptsDir, 'base-migration-verify-execution.js');

// Helper: run a script and return parsed JSON
function runScript(scriptPath, args = []) {
    const cmd = `node "${scriptPath}" ${args.join(' ')}`;
    const stdout = execSync(cmd, { encoding: 'utf8', cwd: rootDir });
    return JSON.parse(stdout);
}

// Helper: create a temp file
function writeTemp(name, content) {
    const p = path.join(rootDir, name);
    fs.writeFileSync(p, content, 'utf8');
    return p;
}

function removeTemp(name) {
    const p = path.join(rootDir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ─── Inventory tests ───

test('BM-AUTO inventory: scans app.js and finds functions', () => {
    const result = runScript(inventoryPath);
    assert.ok(typeof result.appJsLines === 'number', 'has appJsLines');
    assert.ok(result.appJsLines > 10000, 'app.js has substantial line count');
    assert.ok(Array.isArray(result.functions), 'functions is array');
    assert.ok(result.functions.length > 50, 'finds many functions');

    const first = result.functions[0];
    assert.ok(typeof first.name === 'string', 'function has name');
    assert.ok(typeof first.startLine === 'number', 'has startLine');
    assert.ok(typeof first.endLine === 'number', 'has endLine');
    assert.ok(typeof first.eligible === 'boolean', 'has eligible flag');
    assert.ok(typeof first.risk === 'string', 'has risk level');
    assert.ok(typeof first.suggestedModule === 'string', 'has suggestedModule');
});

test('BM-AUTO inventory: marks functions with DOM access as ineligible', () => {
    const result = runScript(inventoryPath);
    const domFuncs = result.functions.filter(f => f.hasDomAccess);
    for (const f of domFuncs) {
        assert.equal(f.eligible, false, `${f.name} with DOM should be ineligible`);
    }
});

test('BM-AUTO inventory: marks functions with DB access as high risk', () => {
    const result = runScript(inventoryPath);
    const dbFuncs = result.functions.filter(f => f.hasDbAccess);
    for (const f of dbFuncs) {
        assert.equal(f.risk, 'high', `${f.name} with DB should be high risk`);
        assert.equal(f.eligible, false, `${f.name} with DB should be ineligible`);
    }
});

test('BM-AUTO inventory: marks async functions as ineligible', () => {
    const result = runScript(inventoryPath);
    const asyncFuncs = result.functions.filter(f => f.hasAsync);
    for (const f of asyncFuncs) {
        assert.equal(f.eligible, false, `${f.name} with async should be ineligible`);
    }
});

// ─── Scoring tests ───

test('BM-AUTO score: eligible functions must have lineCount >= 10', () => {
    const result = runScript(scorePath);
    const eligible = result.scored.filter(s => s.eligible);
    for (const s of eligible) {
        assert.ok(s.estimatedRemovedAppLines >= 10,
            `${s.name}: eligible but only ${s.estimatedRemovedAppLines} lines`);
    }
});

test('BM-AUTO score: eligible functions must have no risk markers', () => {
    const { inventoryAppJs } = require(inventoryPath);
    const inventory = inventoryAppJs();
    const { scoreCandidate } = require(scorePath);

    for (const func of inventory.functions) {
        if (func.hasDomAccess || func.hasDbAccess || func.hasAiOrOcrAccess ||
            func.hasControlledWriteAccess || func.hasAsync) {
            const scored = scoreCandidate(func);
            assert.equal(scored.eligible, false,
                `${func.name} with risk markers should not be eligible`);
        }
    }
});

// ─── Classification tests ───

test('BM-AUTO verify: SCAFFOLD_ONLY — app.js unchanged + new module added', () => {
    // Simulate: before == after (no change), module exists but app doesn't call it
    // Use a temp file without window.Qisi.Utils references to test SCAFFOLD_ONLY
    const { classify } = require(verifyPath);
    const appContent = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    // Remove all window.Qisi.Utils references to simulate an app that doesn't call the module
    const stripped = appContent.replace(/window\.Qisi\.Utils\./g, '');
    writeTemp('.bm_test_scaffold_app.js', stripped);

    const args = [
        '--before', '.bm_test_scaffold_app.js',
        '--after', '.bm_test_scaffold_app.js',
        '--module', 'qisi-utils.js',
        '--old-names', 'someHelperThatDoesNotExist'
    ];
    const result = classify(args);
    removeTemp('.bm_test_scaffold_app.js');
    assert.equal(result.classification, 'SCAFFOLD_ONLY');
});

test('BM-AUTO verify: REAL_MIGRATION — app.js delta <= -10, old defs removed, app calls module', () => {
    // Use the BM24 batch functions that actually exist in qisi-file-dispatcher.js
    // Add them back to a before copy, so removing them shows as REAL_MIGRATION
    const appContent = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

    const bm24Funcs = [
        'getBatchFileRoles', 'batchHasRole', 'batchHasQuestionRole',
        'batchHasAnswerRole', 'batchHasSolutionRole', 'batchIsFullRole',
        'batchIsSupplementalImage'
    ];

    // Add these functions back to create a "before" snapshot with >= 11 extra lines
    let extra = '';
    for (const name of bm24Funcs) {
        extra += `\nconst ${name} = (file, role) => {\n    const roles = [];\n    return roles;\n};\n`;
    }

    const beforeContent = appContent + extra;
    writeTemp('.bm_test_real_before.js', beforeContent);

    const { classify } = require(verifyPath);
    const args = [
        '--before', '.bm_test_real_before.js',
        '--after', 'app.js',
        '--module', 'qisi-file-dispatcher.js',
        '--old-names', bm24Funcs.join(',')
    ];
    const result = classify(args);
    removeTemp('.bm_test_real_before.js');

    assert.equal(result.oldDefinitionsStillPresent, false,
        'old definitions should not be in current app.js');
    assert.equal(result.appCallsNewModule, true,
        'app.js should call qisi-file-dispatcher.js');
    assert.equal(result.moduleExportsMovedFunctions, true,
        'qisi-file-dispatcher.js should export all BM24 functions');
    assert.ok(result.delta <= -10, `delta ${result.delta} should be <= -10`);
    assert.equal(result.classification, 'REAL_MIGRATION',
        `Expected REAL_MIGRATION, got ${result.classification}: ${result.reasons.join('; ')}`);
});

test('BM-AUTO verify: INVALID — Route B referenced in app.js', () => {
    const { classify } = require(verifyPath);

    // Create a temp app.js with Route B reference
    const original = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    const infected = original + '\n// route-b integrated\nconst routeBResult = window.routeBProcess();\n';
    writeTemp('.bm_test_infected_app.js', infected);

    const args = [
        '--after', '.bm_test_infected_app.js',
        '--module', 'qisi-file-dispatcher.js'
    ];
    const result = classify(args);
    removeTemp('.bm_test_infected_app.js');

    assert.equal(result.classification, 'INVALID');
});

test('BM-AUTO verify: DOM/db/AI/OCR functions are not eligible in inventory', () => {
    const { inventoryAppJs } = require(inventoryPath);
    const inventory = inventoryAppJs();

    const forbiddenFuncs = inventory.functions.filter(f =>
        f.hasDomAccess || f.hasDbAccess || f.hasAiOrOcrAccess || f.hasControlledWriteAccess || f.hasAsync
    );

    for (const f of forbiddenFuncs) {
        assert.equal(f.eligible, false,
            `${f.name}: DOM=${f.hasDomAccess} DB=${f.hasDbAccess} AI=${f.hasAiOrOcrAccess} CW=${f.hasControlledWriteAccess} async=${f.hasAsync} should be ineligible`);
    }
});

// ─── Known sample classification tests ───

test('BM-AUTO verify: BM21 sample should classify as SCAFFOLD_ONLY', () => {
    // BM21: app.js delta 0, facade refs 0, no business logic migrated
    const { classify } = require(verifyPath);
    const args = [
        '--before', 'app.js',
        '--after', 'app.js',
        '--module', 'qisi-app-facade.js',
        '--old-names', 'someNonExistentHelper'
    ];
    const result = classify(args);
    // With --before == --after, delta is 0, so it should be SCAFFOLD_ONLY
    assert.equal(result.delta, 0);
    assert.equal(result.classification, 'SCAFFOLD_ONLY');
});

test('BM-AUTO verify: BM24 sample should detect as REAL_MIGRATION', () => {
    // BM24: 7 functions moved from app.js to qisi-file-dispatcher.js
    const { classify, containsNameInFile, appCallsModule, moduleExportsFunctions } = require(verifyPath);
    const appPath = path.join(rootDir, 'app.js');
    const modulePath = path.join(rootDir, 'qisi-file-dispatcher.js');
    const oldNames = ['getBatchFileRoles', 'batchHasRole', 'batchHasQuestionRole',
        'batchHasAnswerRole', 'batchHasSolutionRole', 'batchIsFullRole', 'batchIsSupplementalImage'];

    // Verify old definitions NOT in app.js
    assert.equal(containsNameInFile(appPath, oldNames), false,
        'BM24 old definitions should not be in app.js');

    // Verify app calls the module
    assert.equal(appCallsModule(appPath, 'qisi-file-dispatcher.js'), true,
        'app.js should call Qisi.FileDispatcher');

    // Verify functions exist in module
    assert.equal(moduleExportsFunctions(modulePath, oldNames), true,
        'qisi-file-dispatcher.js should export all 7 functions');

    // With a before file having 11 extra lines, classification should be REAL_MIGRATION
    const original = fs.readFileSync(appPath, 'utf8');
    const withExtra = original +
        '\nconst extra1 = () => 1;\nconst extra2 = () => 2;\nconst extra3 = () => 3;\n' +
        'const extra4 = () => 4;\nconst extra5 = () => 5;\nconst extra6 = () => 6;\n' +
        'const extra7 = () => 7;\nconst extra8 = () => 8;\nconst extra9 = () => 9;\n' +
        'const extra10 = () => 10;\nconst extra11 = () => 11;\n';

    writeTemp('.bm_test_bm24_before.js', withExtra);

    const args = [
        '--before', '.bm_test_bm24_before.js',
        '--after', 'app.js',
        '--module', 'qisi-file-dispatcher.js',
        '--old-names', 'extra1,extra2,extra3,extra4,extra5,extra6,extra7,extra8,extra9,extra10,extra11'
    ];
    const result = classify(args);
    removeTemp('.bm_test_bm24_before.js');

    assert.equal(result.oldDefinitionsStillPresent, false);
    assert.equal(result.appCallsNewModule, true);
    assert.ok(result.delta <= -10, `delta ${result.delta} should be <= -10`);
});

// ─── Scoring hard gates ───

test('BM-AUTO score: estimatedRemovedAppLines < 10 is not eligible', () => {
    const { scoreCandidate } = require(scorePath);
    const smallFunc = {
        name: 'tinyHelper',
        lineCount: 5,
        hasDomAccess: false,
        hasDbAccess: false,
        hasAiOrOcrAccess: false,
        hasControlledWriteAccess: false,
        hasAsync: false,
        risk: 'low',
        suggestedModule: 'qisi-utils.js'
    };
    const scored = scoreCandidate(smallFunc);
    assert.equal(scored.eligible, false, 'function with < 10 lines should not be eligible');
});

// ─── Strict verifier tests ───

test('BM-AUTO verify: rejects global-scope-only migration without explicit app module call', () => {
    const { classify } = require(verifyPath);

    const before = `
const migratedHelper = () => {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  const h = 8;
  const i = 9;
  return a + b + c + d + e + f + g + h + i;
};
`;

    const after = `
const result = migratedHelper();
`;

    const mod = `
const migratedHelper = () => 45;
module.exports = { migratedHelper };
`;

    writeTemp('.bm_test_global_before.js', before);
    writeTemp('.bm_test_global_after.js', after);
    writeTemp('.bm_test_global_module.js', mod);

    const result = classify([
        '--before', '.bm_test_global_before.js',
        '--after', '.bm_test_global_after.js',
        '--module', '.bm_test_global_module.js',
        '--old-names', 'migratedHelper'
    ]);

    removeTemp('.bm_test_global_before.js');
    removeTemp('.bm_test_global_after.js');
    removeTemp('.bm_test_global_module.js');

    assert.equal(result.oldDefinitionsStillPresent, false);
    assert.equal(result.moduleExportsMovedFunctions, true);
    assert.equal(result.appCallsNewModule, false);
    assert.notEqual(result.classification, 'REAL_MIGRATION');
    assert.equal(result.classification, 'SCAFFOLD_ONLY');
});

test('BM-AUTO verify: qisi-utils migrated helpers are explicit REAL_MIGRATION sample', () => {
    const { classify, appCallsModule, moduleExportsFunctions } = require(verifyPath);

    const appPath = path.join(rootDir, 'app.js');
    const modulePath = path.join(rootDir, 'qisi-utils.js');
    const oldNames = [
        'cleanRecognizedText',
        'mathSignalCount',
        'extractRelevanceTokens',
        'finalChoiceAnswerText',
        'cleanFormulaOcrText'
    ];

    assert.equal(appCallsModule(appPath, 'qisi-utils.js'), true, 'app.js should explicitly call window.Qisi.Utils');
    assert.equal(moduleExportsFunctions(modulePath, oldNames), true, 'qisi-utils.js should export migrated helpers');

    const appContent = fs.readFileSync(appPath, 'utf8');
    let beforeExtra = '';
    for (const name of oldNames) {
        beforeExtra += `
const ${name} = (value) => {
  const text = String(value || '');
  const a = text.trim();
  const b = a.replace(/\\s+/g, ' ');
  const c = b.replace(/<[^>]+>/g, '');
  const d = c.replace(/&amp;/g, '&');
  const e = d.replace(/&lt;/g, '<');
  const f = e.replace(/&gt;/g, '>');
  return f;
};
`;
    }

    writeTemp('.bm_test_qisi_utils_before.js', appContent + beforeExtra);

    const result = classify([
        '--before', '.bm_test_qisi_utils_before.js',
        '--after', 'app.js',
        '--module', 'qisi-utils.js',
        '--old-names', oldNames.join(',')
    ]);

    removeTemp('.bm_test_qisi_utils_before.js');

    assert.equal(result.oldDefinitionsStillPresent, false);
    assert.equal(result.appCallsNewModule, true);
    assert.equal(result.moduleExportsMovedFunctions, true);
    assert.ok(result.delta <= -10, `delta ${result.delta} should be <= -10`);
    assert.equal(result.classification, 'REAL_MIGRATION');
});
