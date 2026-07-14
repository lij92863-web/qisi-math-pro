const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Bridge = require('../qisi-production-import-bridge.js');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('production Bridge public API and required ports contain no fixture runner', () => {
    assert.equal(Bridge.createFixtureImportRunner, undefined);
    assert.equal(Bridge.REQUIRED_PORTS.includes('runFixtureImport'), false);
    const source = read('qisi-production-import-bridge.js');
    assert.doesNotMatch(source, /createFixtureImportRunner|runFixtureImport/);
    assert.doesNotMatch(source, /producerRoute\s*===\s*['"]fixture['"]/);
    assert.doesNotMatch(source, /input\??\.testFixture/);
});

test('normal UI and app shell cannot select fixture or caller producer routes', () => {
    const app = read('app.js');
    const controller = read('qisi-normal-ui-import-controller.js');
    const main = read('main.html');
    assert.doesNotMatch(app, /ImportAdapterRegistry|createFixtureImportRunner/);
    assert.doesNotMatch(app, /testFixture|resolveProducerRoute/);
    assert.doesNotMatch(controller, /testFixture|producerRoute|resolveProducerRoute/);
    assert.doesNotMatch(main, /tests\/harness|mock-ocr-engine-adapter|fixture.*adapter/i);
});

test('production Bridge source rejects every forbidden fixture input', () => {
    const source = read('qisi-production-import-bridge.js');
    for (const name of [
        'producerRoute', 'testFixture', 'fixtureTransport', 'prebuiltCandidates'
    ]) {
        assert.match(source, new RegExp(`forbidden.*${name}|${name}.*forbidden`, 'is'));
    }
    assert.match(source, /PRODUCTION_IMPORT_INPUT_FORBIDDEN/);
});
