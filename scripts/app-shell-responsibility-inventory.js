const fs = require('node:fs');
const path = require('node:path');
const { inventoryAppJs } = require('./base-migration-inventory.js');

const ROOT = path.resolve(__dirname, '..');
const APP_PATH = path.join(ROOT, 'app.js');
const TEST_DIR = path.join(ROOT, 'tests');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferDomain(name) {
    const value = name.toLowerCase();
    const rules = [
        [/docx|omml/, 'docx-import'],
        [/pdf|support|align/, 'pdf-safe-partial'],
        [/ocr|recogn|vision|image/, 'recognition-and-images'],
        [/batch|import|source|file/, 'batch-import'],
        [/review|draft/, 'review-draft'],
        [/question|answer|solution|option|stem/, 'question-domain'],
        [/export|backup|download/, 'export-backup'],
        [/storage|persist|save|delete|database|library/, 'storage-library'],
        [/render|html|latex|template|view|display/, 'ui-rendering'],
        [/tree|knowledge|node/, 'knowledge-tree']
    ];
    return rules.find(([pattern]) => pattern.test(value))?.[1] || 'app-shell-support';
}

function inferTarget(name, domain) {
    const value = name.toLowerCase();
    if (/state.*transition|transition.*state/.test(value)) return ['qisi-import-state-machine.js', 'C2-1'];
    if (/batch.*context|source.*manifest|engine.*config/.test(value)) return ['qisi-batch-context-service.js', 'C2-2'];
    if (/source.*role|file.*role|classif/.test(value)) return ['qisi-source-role-classifier.js', 'C2-3'];
    if (domain === 'docx-import') return ['qisi-docx-import-coordinator.js', 'C2-4'];
    if (domain === 'pdf-safe-partial' || domain === 'recognition-and-images') return ['qisi-pdf-import-coordinator.js', 'C2-5'];
    if (/normaliz|wrapper|convert.*candidate/.test(value)) return ['qisi-candidate-normalizer.js', 'C2-6'];
    if (/validat|sequence|ownership|admission/.test(value)) return ['qisi-import-validation-service.js', 'C2-7'];
    if (/review|draft.*build|build.*draft/.test(value)) return ['qisi-review-draft-builder.js', 'C2-8'];
    if (/persist|save.*draft|delete.*draft|reload.*draft/.test(value)) return ['qisi-draft-persistence-service.js', 'C2-9'];
    if (/diagnostic|report|warning|error|duration|progress/.test(value)) return ['qisi-import-diagnostics.js', 'C2-10'];
    if (name === 'processDraftImportBatch') return ['qisi-import-state-machine.js + bounded coordinators', 'C2-11'];
    if (domain === 'ui-rendering' || domain === 'knowledge-tree') return ['app.js UI shell or existing UI owner', 'C2-12'];
    if (/performance|timing|cache|prefetch|thumbnail/.test(value)) return ['measured existing owner', 'C2-14'];
    return ['existing owner; reassess after characterization', 'hold'];
}

function findCallLines(lines, name, startLine, endLine) {
    const call = new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`);
    const result = [];
    lines.forEach((line, index) => {
        const lineNo = index + 1;
        if (lineNo >= startLine && lineNo <= endLine) return;
        if (call.test(line)) result.push(lineNo);
    });
    return result;
}

function detectSideEffects(body) {
    const rules = [
        [/document\.|window\.|querySelector|innerHTML|alert\(|prompt\(/, 'DOM/UI'],
        [/\bdb\.|indexedDB|storageRepository|safeStorage/, 'storage'],
        [/fetch\(|callAiProxy|recognize|OCR|Vision/, 'external/recognition'],
        [/\.value\s*=|\.push\(|\.splice\(|Object\.assign/, 'state mutation'],
        [/console\.|logger\./, 'diagnostics'],
        [/downloadBlob|createObjectURL|revokeObjectURL/, 'browser resource'],
        [/setTimeout|setInterval|addEventListener/, 'lifecycle/timer']
    ];
    const found = rules.filter(([pattern]) => pattern.test(body)).map(([, label]) => label);
    return found.length ? found : ['pure/none detected'];
}

function buildResponsibilityInventory() {
    const source = fs.readFileSync(APP_PATH, 'utf8');
    const lines = source.split(/\r?\n/);
    const base = inventoryAppJs();
    const names = base.functions.map(item => item.name);
    const reactiveNames = [...source.matchAll(
        /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:ref|reactive|computed|shallowRef)\s*\(/g
    )].map(match => match[1]);
    const testFiles = fs.readdirSync(TEST_DIR).filter(file => file.endsWith('.test.js'));
    const testSources = new Map(testFiles.map(file => [
        file,
        fs.readFileSync(path.join(TEST_DIR, file), 'utf8')
    ]));

    const functions = base.functions.map(item => {
        const body = lines.slice(item.startLine - 1, item.endLine).join('\n');
        const domain = inferDomain(item.name);
        const [targetModule, migrationWave] = inferTarget(item.name, domain);
        const dependencies = names.filter(name => name !== item.name &&
            new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`).test(body));
        const globalDependencies = [...body.matchAll(/\b(?:window\.)?Qisi(?:\.[A-Za-z_$][\w$]*){1,3}/g)]
            .map(match => match[0].replace(/^window\./, ''));
        const reactiveState = reactiveNames.filter(name =>
            new RegExp(`\\b${escapeRegExp(name)}\\b`).test(body)
        );
        const tests = testFiles.filter(file =>
            new RegExp(`\\b${escapeRegExp(item.name)}\\b`).test(testSources.get(file))
        );
        const callers = findCallLines(lines, item.name, item.startLine, item.endLine);

        return {
            name: item.name,
            startLine: item.startLine,
            endLine: item.endLine,
            lineCount: item.lineCount,
            domain,
            callers,
            dependencies: [...new Set([...dependencies, ...globalDependencies])].sort(),
            reactiveState: [...new Set(reactiveState)].sort(),
            sideEffects: detectSideEffects(body),
            tests,
            targetModule,
            extractionRisk: item.risk,
            migrationWave
        };
    });

    return {
        schemaVersion: 'qisi.app-shell-responsibility-inventory.r3',
        appJsLines: base.appJsLines,
        functionCount: functions.length,
        functions
    };
}

if (require.main === module) {
    process.stdout.write(`${JSON.stringify(buildResponsibilityInventory(), null, 2)}\n`);
}

module.exports = { buildResponsibilityInventory };
