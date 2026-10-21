const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { analyzeSources, collectSources, writeReport } = require('../tools/inventory.cjs');
const row = (report, file) => report.modules.find(item => item.file === file);
const analyze = (sources, changes = {}) => analyzeSources({ sources, productionEntries: ['main.html'], ...changes });

test('HTML cache parameters and extensionless static dependencies retain the production path', () => {
    const report = analyze({ 'main.html': '<script defer src="./app.js?v=private"></script>',
        'app.js': "require('./qisi-live')", 'qisi-live.js': "require('./app.js')" });
    assert.equal(row(report, 'app.js').classification, 'live');
    assert.equal(row(report, 'qisi-live.js').classification, 'live');
    assert.ok(report.edges.some(edge => edge.from === 'main.html' && edge.to === 'app.js' && edge.kind === 'html-script'));
    assert.ok(report.edges.some(edge => edge.from === 'app.js' && edge.to === 'qisi-live.js' && edge.kind === 'require'));
    assert.equal(report.deletionAuthorized, false);
    assert.doesNotMatch(JSON.stringify(report), /private/);
});

test('diagnostic-only chains remain dormant and an unrooted reference cycle is not production use', () => {
    const report = analyze({ 'main.html': '', 'tests/read.test.js': "require('../qisi-dormant')",
        'qisi-dormant.js': "require('./qisi-helper')", 'qisi-helper.js': "require('./qisi-dormant')",
        'qisi-unused-a.js': "require('./qisi-unused-b')", 'qisi-unused-b.js': "require('./qisi-unused-a')" });
    assert.equal(row(report, 'qisi-dormant.js').classification, 'dormant');
    assert.equal(row(report, 'qisi-helper.js').classification, 'dormant');
    assert.equal(row(report, 'qisi-unused-a.js').classification, 'dead-candidate');
    assert.equal(row(report, 'qisi-unused-b.js').classification, 'dead-candidate');
    assert.equal(row(report, 'qisi-unused-a.js').productionReachable, false);
    assert.ok(row(report, 'qisi-unused-a.js').inbound.length > 0);
});

test('dynamic loads and parsing failures are explicit and cannot certify an unreferenced file as dead', () => {
    const report = analyze({ 'main.html': '<script src="app.js"></script>', 'app.js': 'require(moduleName)',
        'qisi-unreferenced.js': 'module.exports = {};', 'scripts/broken.js': 'function {' });
    assert.equal(row(report, 'qisi-unreferenced.js').classification, 'uncertain');
    assert.ok(report.unresolved.some(item => item.kind === 'dynamic-module-load'));
    assert.ok(report.unresolved.some(item => item.kind === 'parse-error'));
    assert.equal(report.staticAnalysisComplete, false);
});

test('CommonJS script returns are valid while an invalid module return remains a parsing uncertainty', () => {
    const report = analyze({ 'main.html': '', 'scripts/check.js': 'if (process.exitCode) return;',
        'tools/check.cjs': 'return;', 'tools/broken.mjs': 'return;', 'qisi-free.js': '' });
    assert.equal(report.unresolved.some(item => item.kind === 'parse-error' && item.file === 'scripts/check.js'), false);
    assert.equal(report.unresolved.some(item => item.kind === 'parse-error' && item.file === 'tools/check.cjs'), false);
    assert.equal(report.unresolved.some(item => item.kind === 'parse-error' && item.file === 'tools/broken.mjs'), true);
});

test('a declared runtime owner with no static production path stays uncertain', () => {
    const report = analyze({ 'main.html': '', 'tests/owner.test.js': "require('../qisi-owner')", 'qisi-owner.js': '' },
        { declaredRuntime: { 'qisi-owner.js': 'browser' } });
    assert.equal(row(report, 'qisi-owner.js').classification, 'uncertain');
    assert.equal(row(report, 'qisi-owner.js').declaredRuntime, 'browser');
    assert.ok(row(report, 'qisi-owner.js').issues.includes('runtime-declaration-needs-entry-review'));
});

test('source text is parsed without executing it and file-like strings remain conservative references', () => {
    const report = analyze({ 'main.html': '<script src="app.js"></script>',
        'app.js': "throw Error('MUST NOT EXECUTE'); const filename = 'qisi-named.js'; // qisi-comment.js\n",
        'qisi-named.js': '', 'qisi-comment.js': '' });
    assert.equal(row(report, 'qisi-named.js').classification, 'live');
    assert.equal(row(report, 'qisi-comment.js').classification, 'dead-candidate');
    assert.ok(report.edges.some(edge => edge.to === 'qisi-named.js' && edge.kind === 'file-reference'));
    assert.doesNotMatch(JSON.stringify(report), /MUST NOT EXECUTE/);
});

test('module imports and root launchers contribute auditable relative edges', () => {
    const report = analyzeSources({ sources: { 'main.html': '<script src="entry.mjs"></script>',
        'entry.mjs': "import './qisi-esm.mjs'", 'qisi-esm.mjs': 'export const ready = true;',
        'open-app.cmd': 'node qisi-local-server.js', 'qisi-local-server.js': '' } });
    assert.equal(row(report, 'qisi-esm.mjs').classification, 'live');
    assert.equal(row(report, 'qisi-local-server.js').classification, 'live');
    assert.ok(report.edges.some(edge => edge.kind === 'import' && edge.to === 'qisi-esm.mjs'));
    assert.ok(report.edges.some(edge => edge.kind === 'launcher-reference' && edge.from === 'open-app.cmd'));
});

test('analysis is deterministic and never mutates or exposes input source contents', () => {
    const sources = { 'qisi-free.js': "const secret = 'DO_NOT_PUBLISH';", 'main.html': '' }, before = JSON.stringify(sources);
    const first = analyze(sources), second = analyze(Object.fromEntries(Object.entries(sources).reverse()));
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(sources), before);
    assert.doesNotMatch(JSON.stringify(first), /DO_NOT_PUBLISH/);
    assert.match(row(first, 'qisi-free.js').sha256, /^[a-f0-9]{64}$/);
    assert.throws(() => analyze({ '../outside.js': '' }), /SOURCE_PATH_INVALID/);
});

function temporary(work) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-inventory-'));
    try { return work(root); }
    finally {
        assert.equal(fs.realpathSync(path.dirname(root)), fs.realpathSync(os.tmpdir()));
        assert.match(path.basename(root), /^qisi-inventory-/);
        fs.rmSync(root, { recursive: true, force: true });
    }
}

test('source collection excludes secrets, dependencies, generated data and material files', () => temporary(root => {
    const files = { 'app.js': 'throw Error("do not run")', 'main.html': '', 'tests/safe.test.js': '',
        'node_modules/private.js': 'SECRET', 'vendor/private.js': 'SECRET', 'tmp/private.js': 'SECRET',
        'deliverables/private.js': 'SECRET', 'local-run-artifacts/private.js': 'SECRET', '.codex/private.js': 'SECRET',
        '.env': 'SECRET', 'paper.docx': 'SECRET' };
    for (const [file, value] of Object.entries(files)) {
        const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value);
    }
    assert.deepEqual(Object.keys(collectSources(root)).sort(), ['app.js', 'main.html', 'tests/safe.test.js']);
}));

test('reports use new ignored paths and never overwrite a report or source file', () => temporary(root => {
    const report = analyze({ 'main.html': '', 'qisi-free.js': '' });
    const output = path.join(root, 'local-run-artifacts/inventory/first/report.json');
    writeReport(report, output, { root });
    assert.equal(JSON.parse(fs.readFileSync(output)).deletionAuthorized, false);
    assert.ok(fs.readFileSync(output.replace(/\.json$/, '.md'), 'utf8').includes('dead-candidate'));
    const original = fs.readFileSync(output);
    assert.throws(() => writeReport(report, output, { root }), /REPORT_ALREADY_EXISTS/);
    assert.deepEqual(fs.readFileSync(output), original);
    assert.throws(() => writeReport(report, path.join(root, 'source.json'), { root }), /OUTPUT_SCOPE_INVALID/);
    assert.equal(fs.existsSync(path.join(root, 'source.json')), false);
}));

test('symlinked output ancestors cannot redirect report writes outside the artifact directory', () => temporary(root => {
    const outside = path.join(root, 'outside'), artifact = path.join(root, 'local-run-artifacts');
    fs.mkdirSync(outside); fs.mkdirSync(artifact);
    fs.symlinkSync(outside, path.join(artifact, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => writeReport(analyze({ 'main.html': '' }), path.join(artifact, 'linked/report.json'), { root }), /OUTPUT_LINK_FORBIDDEN/);
    assert.equal(fs.existsSync(path.join(outside, 'report.json')), false);
    assert.equal(Object.keys(collectSources(root)).some(file => file.includes('linked')), false);
}));
