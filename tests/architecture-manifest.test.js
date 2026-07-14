const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));

const required = [
    'recognition-contracts', 'ocr-adapter-contract', 'ocr-reading-order',
    'ocr-structure-extractor', 'ocr-candidate-selection',
    'formal-admission', 'storage-repository',
    'library-service', 'review-controller', 'export-service',
    'import-coordinator', 'ocr-registry', 'ocr-qwen-adapter',
    'ocr-local-adapter', 'local-ocr-service', 'ocr-shadow-mode', 'performance-monitor',
    'controlled-write', 'support-aligner', 'support-parser', 'app-shell'
];

test('architecture manifest covers required modules with complete metadata', () => {
    const layers = json('architecture/layers.json');
    const owners = json('architecture/owners.json');
    const ids = new Set(layers.modules.map(item => item.id));
    required.forEach(id => assert.ok(ids.has(id), id));
    for (const item of layers.modules) {
        assert.equal(typeof item.layer, 'number', item.id);
        assert.ok(item.domainOwner, item.id);
        assert.ok(Array.isArray(item.publicApi) && item.publicApi.length, item.id);
        assert.ok(Array.isArray(item.allowedDependencies), item.id);
        assert.ok(Array.isArray(item.forbiddenDependencies), item.id);
        assert.deepEqual(
            item.allowedDependencies.filter(dependency =>
                item.forbiddenDependencies.includes(dependency)
            ),
            [],
            `${item.id} allowed/forbidden dependency overlap`
        );
        assert.ok(
            ['scaffold', 'production-wired', 'research-only', 'deprecated'].includes(item.status),
            item.id
        );
        assert.equal(owners[item.domainOwner], item.file, item.domainOwner);
    }
    assert.equal(new Set(Object.keys(owners)).size, Object.keys(owners).length);
});

test('manifest dependencies are present, acyclic, and never point upward', () => {
    const modules = json('architecture/layers.json').modules;
    const byId = new Map(modules.map(item => [item.id, item]));
    for (const item of modules) {
        for (const dependency of item.allowedDependencies) {
            assert.ok(byId.has(dependency), `${item.id} -> ${dependency}`);
            assert.ok(
                byId.get(dependency).layer <= item.layer,
                `reverse dependency ${item.id} -> ${dependency}`
            );
        }
    }
    const visiting = new Set();
    const visited = new Set();
    const visit = id => {
        if (visiting.has(id)) assert.fail(`dependency cycle at ${id}`);
        if (visited.has(id)) return;
        visiting.add(id);
        byId.get(id).allowedDependencies.forEach(visit);
        visiting.delete(id);
        visited.add(id);
    };
    modules.forEach(item => visit(item.id));
});

test('automated ownership guards match production source', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /const\s+(?:createRepository|createReviewController|buildPdfSupportFieldLevelControlledWrite)\s*=/);

    for (const file of [
        'qisi-ocr-qwen-adapter.js', 'qisi-ocr-local-adapter.js',
        'qisi-ocr-engine-registry.js', 'qisi-ocr-shadow-mode.js'
    ]) {
        const source = read(file);
        assert.doesNotMatch(source, /answerOwnership|controlledWriteAccepted\s*:\s*true/i, file);
        assert.doesNotMatch(source, /saveQuestion|confirmDraftToQuestion|db\.questions/, file);
    }

    const importController = read('qisi-import-orchestrator.js');
    const reviewController = read('qisi-review-controller.js');
    assert.doesNotMatch(importController, /validate\s*=\s*[^,]+valid\s*:\s*true/s);
    assert.doesNotMatch(reviewController, /validateDraft\s*=\s*[^,]+valid\s*:\s*true/s);

    const appSubmit = app.slice(
        app.indexOf('const submitDraftQuestion = async'),
        app.indexOf('const openBatchSubmitSummary', app.indexOf('const submitDraftQuestion = async'))
    );
    assert.doesNotMatch(appSubmit, /db\.questions\.(?:put|add|bulkPut)/);
    assert.match(appSubmit, /reviewWorkflowService\.submitDraft/);
    assert.doesNotMatch(appSubmit, /batchFormalSubmit\.submit|persistReviewDraftBatch/);
    const reviewWorkflow = read('qisi-review-workflow-service.js');
    assert.match(reviewWorkflow, /formalSubmit\.submit/);
    const formalSubmit = read('qisi-batch-formal-submit.js');
    assert.match(formalSubmit, /policy\.evaluateDraftAdmission/);
    assert.match(formalSubmit, /repository\.confirmDraftToQuestion/);
});

test('research-only modules are not loaded by the production page', () => {
    const manifest = json('architecture/layers.json').modules;
    const main = read('main.html');
    for (const item of manifest.filter(entry => entry.status === 'research-only')) {
        assert.doesNotMatch(main, new RegExp(`(?:\\./)?${item.file.replace('.', '\\.')}[?"']`));
    }
});
