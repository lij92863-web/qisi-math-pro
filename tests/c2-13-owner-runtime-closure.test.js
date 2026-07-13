const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));

const REQUIRED_FIELDS = [
    'ownerId', 'module', 'layer', 'responsibilities', 'allowedCallers',
    'allowedDependencies', 'forbiddenDependencies', 'productionEntry',
    'writeAuthority', 'status'
];
const REQUIRED_OWNERS = [
    'ui-shell', 'normal-ui-controller', 'production-import-bridge',
    'import-state-machine', 'docx-import-coordinator',
    'production-docx-source-port', 'production-docx-vision-source-port',
    'pdf-import-coordinator', 'production-pdf-source-port',
    'source-role-classifier', 'candidate-normalizer',
    'import-validation', 'pdf-candidate-projection', 'controlled-write',
    'review-draft-builder', 'draft-persistence', 'review-controller',
    'formal-admission', 'question-repository', 'export-service',
    'ocr-registry', 'ocr-qwen-adapter', 'qwen-vision-source-port'
];

test('C2-13 owner manifest is complete, layered, and responsibility-unique', () => {
    const manifest = json('docs/architecture/owners.json');
    const layerManifest = json('docs/architecture/layers.json');
    const owners = manifest.owners;
    const byId = new Map(owners.map(owner => [owner.ownerId, owner]));
    const layerIds = new Set(layerManifest.layers.map(layer => layer.id));

    assert.equal(manifest.schemaVersion, 'qisi.program-c-owners.r3');
    assert.equal(layerManifest.schemaVersion, 'qisi.program-c-layers.r3');
    assert.equal(byId.size, owners.length, 'ownerId must be unique');
    REQUIRED_OWNERS.forEach(ownerId => assert.ok(byId.has(ownerId), ownerId));

    const productionResponsibilities = new Map();
    for (const owner of owners) {
        for (const field of REQUIRED_FIELDS) {
            assert.ok(Object.hasOwn(owner, field), `${owner.ownerId}:${field}`);
        }
        assert.ok(layerIds.has(owner.layer), `${owner.ownerId}:layer`);
        assert.ok(Array.isArray(owner.responsibilities) && owner.responsibilities.length);
        assert.ok(Array.isArray(owner.allowedCallers));
        assert.ok(Array.isArray(owner.allowedDependencies));
        assert.ok(Array.isArray(owner.forbiddenDependencies));
        assert.ok([
            'production', 'shadow', 'research-only', 'deprecated', 'removed'
        ].includes(owner.status), `${owner.ownerId}:status`);
        assert.equal(
            owner.productionEntry,
            owner.status === 'production',
            `${owner.ownerId}:productionEntry`
        );
        for (const dependency of owner.allowedDependencies) {
            assert.ok(byId.has(dependency), `${owner.ownerId} -> ${dependency}`);
            assert.ok(
                byId.get(dependency).layer <= owner.layer,
                `upward dependency ${owner.ownerId} -> ${dependency}`
            );
            assert.ok(
                !owner.forbiddenDependencies.includes(dependency),
                `${owner.ownerId}: allowed/forbidden overlap ${dependency}`
            );
        }
        for (const caller of owner.allowedCallers) {
            assert.ok(byId.has(caller), `${owner.ownerId} <- ${caller}`);
        }
        if (owner.status === 'production') {
            for (const responsibility of owner.responsibilities) {
                assert.ok(
                    !productionResponsibilities.has(responsibility),
                    `${responsibility}: ${productionResponsibilities.get(responsibility)} and ${owner.ownerId}`
                );
                productionResponsibilities.set(responsibility, owner.ownerId);
            }
        }
    }

    const layeredOwnerIds = layerManifest.layers.flatMap(layer => layer.ownerIds);
    assert.equal(new Set(layeredOwnerIds).size, layeredOwnerIds.length);
    assert.deepEqual(new Set(layeredOwnerIds), new Set(owners.map(owner => owner.ownerId)));
});

test('C2-13 detailed owners agree with compatibility manifest and runtime loading', () => {
    const detailed = json('docs/architecture/owners.json').owners;
    const compatibility = json('architecture/layers.json').modules;
    const compatibilityByFile = new Map(compatibility.map(item => [item.file, item]));
    const detailedByFile = new Map(detailed.map(item => [item.module, item]));
    const main = read('main.html');
    const appIndex = main.indexOf('./app.js');

    for (const owner of detailed) {
        if (owner.status === 'removed') continue;
        assert.ok(fs.existsSync(path.join(ROOT, owner.module)), owner.module);
        if (['production', 'shadow', 'research-only'].includes(owner.status)) {
            assert.ok(compatibilityByFile.has(owner.module), `compatibility:${owner.module}`);
        }
        const scriptIndex = main.indexOf(`./${owner.module}`);
        if (owner.status === 'production' || owner.status === 'shadow') {
            const isShellEntry = owner.ownerId === 'ui-shell';
            assert.ok(
                scriptIndex >= 0 && (isShellEntry
                    ? scriptIndex === appIndex
                    : scriptIndex < appIndex),
                `runtime:${owner.module}`
            );
        } else {
            assert.equal(scriptIndex, -1, `non-production runtime:${owner.module}`);
        }
    }

    for (const item of compatibility) {
        if (item.status === 'production-wired') {
            assert.equal(detailedByFile.get(item.file)?.status, 'production', item.file);
            assert.match(main, new RegExp(`(?:\\./)?${item.file.replace('.', '\\.')}(?:[?"'])`));
        }
        if (item.status === 'deprecated') {
            assert.equal(detailedByFile.get(item.file)?.status, 'deprecated', item.file);
            assert.doesNotMatch(main, new RegExp(`(?:\\./)?${item.file.replace('.', '\\.')}(?:[?"'])`));
        }
    }
    assert.doesNotMatch(main, /<script[^>]+src=["'][^"']*tests\//);

    const ordered = [
        'qisi-pdf-support-block-parser.js',
        'qisi-pdf-support-controlled-write.js',
        'qisi-pdf-candidate-projection.js',
        'qisi-import-validation-service.js',
        'qisi-review-draft-builder.js',
        'qisi-draft-persistence-service.js',
        'qisi-import-state-machine.js',
        'qisi-production-import-bridge.js',
        'qisi-normal-ui-import-controller.js',
        'app.js'
    ];
    let previous = -1;
    for (const file of ordered) {
        const index = main.indexOf(`./${file}`);
        assert.ok(index > previous, `${file} runtime order`);
        previous = index;
    }
});

test('C2-13 production graph has no forbidden cross-layer implementation edge', () => {
    const app = read('app.js');
    const bridge = read('qisi-production-import-bridge.js');
    const repository = read('qisi-storage-repository.js');
    const validator = read('qisi-import-validation-service.js');
    const main = read('main.html');

    assert.doesNotMatch(app, /PdfSupport(?:BlockParser|Aligner|ControlledWrite)/);
    assert.doesNotMatch(app, /Qisi\.OcrQwenAdapter/);
    assert.doesNotMatch(app, /qwenTaskClient\.(?:ocrText|chatText|chatJson)\s*\(/);
    assert.doesNotMatch(app, /fetch\s*\(\s*['"]\/api\/ai\//);
    assert.doesNotMatch(app, /\bdb\.questions\.(?:put|add|bulkPut|delete|bulkDelete)/);
    assert.doesNotMatch(bridge, /FormalAdmission|confirmDraftToQuestion|db\.questions/);
    assert.doesNotMatch(bridge, /fallbackToLegacy|runLegacyImport|valid\s*:\s*true/);
    assert.doesNotMatch(repository, /querySelector|createElement|AppProxy|\bVue\b/);
    assert.doesNotMatch(validator, /DraftPersistence|StorageRepository|db\.transaction/);

    for (const file of [
        'qisi-docx-import-coordinator.js',
        'qisi-production-docx-source-port.js',
        'qisi-production-docx-vision-source-port.js',
        'qisi-pdf-import-coordinator.js',
        'qisi-production-pdf-sources-port.js'
    ]) {
        assert.doesNotMatch(
            read(file),
            /querySelector|createElement|AppProxy|\bref\s*\(|\breactive\s*\(/,
            file
        );
    }

    assert.doesNotMatch(main, /qisi-answer-only-ai-pass\.js/);
    assert.doesNotMatch(main, /qisi-legacy-batch-run-coordinator\.js/);
    assert.doesNotMatch(main, /qisi-injected-import-path\.js/);
    assert.doesNotMatch(main, /qisi-import-orchestrator\.js/);
});

test('C2-13 retired owners and fallback selectors stay absent from production shell', () => {
    const app = read('app.js');
    assert.doesNotMatch(app, /processDraftImportBatch(?:V2)?/);
    assert.doesNotMatch(app, /fallbackToLegacy|runLegacyImport|legacyFallbackCalls/);
    assert.doesNotMatch(app, /AnswerOnlyAiPass|runAnswerOnlyAiPass/);
    assert.doesNotMatch(app, /ImportEquivalenceNormalizer|compareImportSnapshots/);

    const owners = json('docs/architecture/owners.json').owners;
    const status = ownerId => owners.find(owner => owner.ownerId === ownerId)?.status;
    assert.equal(status('legacy-batch-run'), 'deprecated');
    assert.equal(status('injected-import-path'), 'deprecated');
    assert.equal(status('import-orchestrator-scaffold'), 'deprecated');
    assert.equal(status('legacy-process-draft-import-batch'), 'removed');
    assert.equal(status('legacy-process-draft-import-batch-v2'), 'removed');
    assert.equal(status('route-b'), 'research-only');
});

test('C2-13 critical runtime factories fail closed without required dependencies', async () => {
    const Bridge = require('../qisi-production-import-bridge.js');
    const Validation = require('../qisi-import-validation-service.js');
    const FormalSubmit = require('../qisi-batch-formal-submit.js');
    const DraftPersistence = require('../qisi-draft-persistence-service.js');
    const DocxVision = require('../qisi-production-docx-vision-source-port.js');
    const PdfSources = require('../qisi-production-pdf-sources-port.js');
    const Projection = require('../qisi-pdf-candidate-projection.js');
    const Repository = require('../qisi-storage-repository.js');
    const Classifier = require('../qisi-source-role-classifier.js');

    assert.throws(
        () => Bridge.createProductionImportBridge({}),
        error => error?.code === 'PRODUCTION_IMPORT_PORT_REQUIRED'
    );
    assert.throws(
        () => Validation.createProductionValidationPorts({}),
        error => error?.code === 'IMPORT_PRODUCTION_VALIDATION_DEPENDENCY_REQUIRED'
    );
    assert.throws(
        () => FormalSubmit.createBatchFormalSubmit({}),
        error => error?.code === 'BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED'
    );
    assert.throws(
        () => FormalSubmit.createBatchFormalSubmit({
            policy: {
                createAdmissionContext() {},
                evaluateDraftAdmission() {}
            },
            repository: { confirmDraftToQuestion() {} }
        }),
        error => error?.code === 'BATCH_FORMAL_SUBMIT_DEPENDENCY_REQUIRED'
    );
    assert.throws(
        () => DocxVision.createProductionImportRunner({}),
        error => error?.code === 'DOCX_VISION_PRODUCTION_PORT_REQUIRED'
    );
    await assert.rejects(
        DraftPersistence.reloadDraftBatch('missing', {}),
        error => error?.code === 'DRAFT_PERSISTENCE_REPOSITORY_REQUIRED'
    );
    assert.throws(
        () => PdfSources.createProductionImportRunner({}),
        error => error?.code === 'PDF_PRODUCTION_PORT_REQUIRED'
    );
    assert.throws(
        () => Projection.createPdfEngineProjectionContext({
            sources: [{ id: 'q', roles: ['question'] }],
            engineResult: { drafts: [{ questionNumber: '1', stem: 'x' }] }
        }),
        error => error?.code === 'pdf-projection-context-invalid'
    );
    assert.throws(
        () => Repository.createRepository(),
        error => error?.code === 'database-unavailable'
    );
    assert.throws(
        () => Classifier.classifySourceRoles([]),
        error => error?.code === 'SOURCE_ROLE_MISSING_SOURCE'
    );

    const projectionSandbox = {};
    vm.runInNewContext(read('qisi-pdf-candidate-projection.js'), projectionSandbox);
    assert.throws(
        () => projectionSandbox.Qisi.PdfCandidateProjection
            .createProductionProjectionContextBuilder(),
        error => error?.code === 'pdf-production-projection-dependency-missing'
    );
});
