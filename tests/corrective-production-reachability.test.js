const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RoutePolicy = require('../qisi-production-import-route-policy.js');
const Roles = require('../qisi-source-role-classifier.js');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const scripts = [...read('main.html').matchAll(
    /<script\s+src=["']\.\/([^?"']+)/g
)].map(match => match[1]);

test('production page reaches each corrective owner before app.js', () => {
    const required = [
        'qisi-question-duplicate-policy.js',
        'qisi-production-import-route-policy.js',
        'qisi-production-import-bridge.js',
        'qisi-normal-ui-import-controller.js',
        'qisi-draft-maintenance-service.js',
        'qisi-review-workflow-service.js'
    ];
    assert.equal(scripts.at(-1), 'app.js');
    for (const file of required) {
        assert.ok(scripts.includes(file), `${file} is unreachable`);
        assert.ok(scripts.indexOf(file) < scripts.indexOf('app.js'));
    }
});

test('deprecated and test-only import owners are unreachable from production', () => {
    const forbidden = [
        'qisi-injected-import-path.js',
        'qisi-legacy-batch-run-coordinator.js',
        'qisi-import-orchestrator.js',
        'tests/harness/browser-engine-injection.js',
        'tests/harness/import-stage-trace.js',
        'tests/e2e/production-cutover-fixtures.js',
        'tests/e2e/true-import-fixtures.js'
    ];
    forbidden.forEach(file => assert.equal(scripts.includes(file), false, file));
    const productionEntrySources = [
        'main.html',
        'app.js',
        'qisi-runtime.js',
        'qisi-normal-ui-import-controller.js',
        'qisi-production-import-bridge.js'
    ].map(read).join('\n');
    assert.doesNotMatch(productionEntrySources, /tests[\\/]harness/);
    assert.doesNotMatch(
        productionEntrySources,
        /Qisi\s*\[\s*[^\]]*(?:Fixture|LegacyBatch|InjectedImport)/
    );
});

test('the reachable route owner fails closed without fallback or caller injection', () => {
    const manifest = [{
        id: 'source-1',
        fileType: 'docx',
        roles: ['full'],
        sourceOrder: 1
    }];
    const classification = Roles.classifySourceRoles(manifest);
    const base = {
        batch: { id: 'batch-1', producerMode: 'docx-deterministic' },
        batchContext: {
            batchMetadata: { producerMode: 'docx-deterministic' }
        },
        sourceManifest: manifest,
        classification,
        availableCapabilities: {
            docxDeterministic: true,
            docxVision: true,
            pdf: true
        }
    };
    assert.equal(RoutePolicy.resolveProductionImportRoute(base).producerIdentity,
        'docx-deterministic');
    assert.equal(RoutePolicy.resolveProductionImportRoute({
        ...base,
        requestedRoute: 'fixture',
        callerSelectedProducer: 'pdf'
    }).producerIdentity, 'docx-deterministic');
    assert.throws(
        () => RoutePolicy.resolveProductionImportRoute({
            ...base,
            batch: { ...base.batch, producerMode: 'fixture' },
            requestedRoute: 'docx'
        }),
        error => error.code === 'PRODUCTION_IMPORT_PRODUCER_IDENTITY_UNSUPPORTED'
    );
});
