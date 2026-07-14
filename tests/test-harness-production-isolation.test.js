const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Bridge = require('../qisi-production-import-bridge.js');
const {
    installBrowserEngineInjection
} = require('./harness/browser-engine-injection.js');
const StageTrace = require('./harness/import-stage-trace.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const productionFiles = fs.readdirSync(ROOT)
    .filter(file => /^(?:app|qisi-[\w-]+)\.js$/.test(file));

function inertBridge() {
    const ports = Object.fromEntries(
        Bridge.REQUIRED_PORTS.map(name => [name, async () => undefined])
    );
    return Bridge.createProductionImportBridge(ports);
}

test('production sources cannot import or dynamically resolve test harness code', () => {
    for (const file of productionFiles) {
        const source = read(file);
        assert.doesNotMatch(source, /require\s*\([^)]*tests[\\/]harness/, file);
        assert.doesNotMatch(source, /import\s*\([^)]*tests[\\/]harness/, file);
        assert.doesNotMatch(source, /__qisiImportStageTrace|BrowserEngineInjection/, file);
    }
    assert.doesNotMatch(read('main.html'), /tests[\\/]harness/);
});

test('test harness exposes only outer-engine injection and observation', () => {
    assert.equal(typeof installBrowserEngineInjection, 'function');
    assert.deepEqual(Object.keys(StageTrace).sort(), [
        'activateImportStageTrace',
        'installImportStageTrace',
        'readImportStageTrace'
    ]);
    const harnessSource = [
        read('tests/harness/browser-engine-injection.js'),
        read('tests/harness/import-stage-trace.js')
    ].join('\n');
    assert.doesNotMatch(
        harnessSource,
        /finalCandidates|prebuiltCandidates|persistReviewDraftBatch|QuestionV2/
    );
});

test('production Bridge rejects every attempted harness transport', async () => {
    const bridge = inertBridge();
    for (const [name, value] of Object.entries({
        testFixture: true,
        producerRoute: 'fixture',
        fixtureTransport: () => [],
        prebuiltCandidates: []
    })) {
        await assert.rejects(
            bridge.run({ mode: 'production', batchId: 'batch-1', [name]: value }),
            error => error.code === 'PRODUCTION_IMPORT_INPUT_FORBIDDEN' &&
                error.causeCode === name
        );
    }
});
