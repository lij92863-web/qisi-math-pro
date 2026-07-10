const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TEST_ROOT = __dirname;

const productionOwnerNames = [
    'readLatexJsonCommandAt',
    'hasUnescapedLatexCommandInJsonString',
    'escapeLatexBackslashesInJsonCandidate',
    'parsePdfSupportBlocks',
    'alignPdfSupport',
    'buildPdfSupportFieldLevelControlledWrite'
];

const testFiles = fs.readdirSync(TEST_ROOT)
    .filter(name => name.endsWith('.test.js'))
    .map(name => path.join(TEST_ROOT, name));

const localDefinitionPattern = name => new RegExp(
    `(?:function\\s+${name}\\s*\\(|(?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s*)?(?:function\\b|(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>))`
);

test('high-risk production owner names are not reimplemented in tests', () => {
    const violations = [];

    for (const file of testFiles) {
        const source = fs.readFileSync(file, 'utf8');

        for (const name of productionOwnerNames) {
            if (localDefinitionPattern(name).test(source)) {
                violations.push(`${path.basename(file)}:${name}`);
            }
        }
    }

    assert.deepEqual(violations, []);
});

test('support repair regression tests import the production JSON/LaTeX repair', () => {
    const source = fs.readFileSync(
        path.join(TEST_ROOT, 'support-repair.test.js'),
        'utf8'
    );

    assert.match(source, /require\(\s*['"]\.\.\/qisi-support-repair\.js['"]\s*\)/);
    assert.doesNotMatch(source, /LATEX_JSON_BACKSLASH_REPAIR_COMMANDS\s*=\s*new Set/);

    const production = require('../qisi-support-repair.js');
    assert.equal(typeof production.escapeLatexBackslashesInJsonCandidate, 'function');
    assert.equal(typeof production.hasUnescapedLatexCommandInJsonString, 'function');
});

test('batch smoke exercises production parser, aligner, and controlled-write owners', () => {
    const source = fs.readFileSync(
        path.join(TEST_ROOT, 'batch-smoke-mock.test.js'),
        'utf8'
    );

    assert.match(source, /require\(['"]\.\.\/qisi-pdf-support-block-parser\.js['"]\)/);
    assert.match(source, /require\(['"]\.\.\/qisi-pdf-support-aligner\.js['"]\)/);
    assert.match(source, /require\(['"]\.\.\/qisi-pdf-support-controlled-write\.js['"]\)/);
    assert.doesNotMatch(source, /node scripts\/pdf-master-browser-runner\.js real-run/);
});

test('app.js delegates JSON/LaTeX repair to the production SupportRepair owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

    assert.doesNotMatch(app, /LATEX_JSON_BACKSLASH_REPAIR_COMMANDS\s*=\s*new Set/);
    assert.match(
        app,
        /window\.Qisi\.SupportRepair\s*\n\s*\.escapeLatexBackslashesInJsonCandidate/
    );
});
