const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Bridge = require('../qisi-production-import-bridge.js');
const ROOT = path.resolve(__dirname, '..');

const forbiddenInputs = [
    'producerRoute',
    'testFixture',
    'fixtureTransport',
    'prebuiltCandidates'
];

function inertBridge() {
    const ports = Object.fromEntries(
        Bridge.REQUIRED_PORTS.map(name => [name, async () => undefined])
    );
    return Bridge.createProductionImportBridge(ports);
}

test('production Bridge exports no final-candidate fixture runner', () => {
    assert.equal(Bridge.createFixtureImportRunner, undefined);
    assert.equal(Bridge.REQUIRED_PORTS.includes('runFixtureImport'), false);
});

test('every former fixture-selection input fails closed', async () => {
    const bridge = inertBridge();
    for (const field of forbiddenInputs) {
        await assert.rejects(
            bridge.run({ [field]: field === 'testFixture' ? true : 'fixture' }),
            error => error.code === 'PRODUCTION_IMPORT_INPUT_FORBIDDEN' &&
                error.causeCode === field
        );
    }
});

test('production app and page load no fixture selection or test harness', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    assert.doesNotMatch(
        app,
        /createFixtureImportRunner|ImportAdapterRegistry|runFixtureImport|testFixture/
    );
    assert.doesNotMatch(html, /tests[\\/]harness|mock-ocr-engine-adapter/);
});
