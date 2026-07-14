const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('route decision implementation has one production owner', () => {
    const policy = read('qisi-production-import-route-policy.js');
    const bridge = read('qisi-production-import-bridge.js');
    const controller = read('qisi-normal-ui-import-controller.js');
    const app = read('app.js');
    assert.match(policy, /function resolveProductionImportRoute\s*\(/);
    assert.match(policy, /explicitProducerIdentity/);
    assert.doesNotMatch(bridge, /function\s+(?:sourceRoute|producerRouteFor)\b/);
    assert.doesNotMatch(controller, /docx-vision|docx-deterministic|producerMode/);
    assert.doesNotMatch(app, /resolveProducerRoute|producerRouteFor/);
});

test('production manifests register route policy as a unique owner', () => {
    const owners = JSON.parse(read('architecture/owners.json'));
    const layers = JSON.parse(read('architecture/layers.json'));
    assert.equal(
        owners.productionImportRoutePolicyOwner,
        'qisi-production-import-route-policy.js'
    );
    const entries = layers.modules.filter(module =>
        module.domainOwner === 'productionImportRoutePolicyOwner'
    );
    assert.equal(entries.length, 1);
    assert.equal(entries[0].status, 'production-wired');
    const bridge = layers.modules.find(module =>
        module.id === 'production-import-bridge'
    );
    assert.equal(
        bridge.allowedDependencies.includes('production-import-route-policy'),
        true
    );
});
