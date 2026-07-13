const { performance } = require('node:perf_hooks');

const DocxIdentity = require('../../qisi-docx-producer-identity-contract.js');
const ReviewBuilder = require('../../qisi-review-draft-builder.js');
const Persistence = require('../../qisi-draft-persistence-service.js');
const Storage = require('../../qisi-storage-repository.js');
const PdfSources = require('../../qisi-production-pdf-sources-port.js');
const {
    docxVisionCandidate,
    pdfCandidate
} = require('../../tests/e2e/production-cutover-fixtures.js');
const { FakeDatabase } = require('../../tests/storage-test-harness.js');

const readIntegerArg = (name, fallback, minimum, maximum) => {
    const prefix = `--${name}=`;
    const raw = process.argv.slice(2).find(value => value.startsWith(prefix));
    const value = Number(raw ? raw.slice(prefix.length) : fallback);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${name}-must-be-${minimum}-to-${maximum}`);
    }
    return value;
};

const sampleRuns = readIntegerArg('runs', 10, 1, 50);
const warmupRuns = readIntegerArg('warmup', 3, 0, 20);
const percentile = (samples, ratio) => {
    const values = [...samples].sort((left, right) => left - right);
    return values[Math.max(
        0,
        Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)
    )];
};

const source = () => ({
    sourceId: 'benchmark-docx',
    format: 'docx',
    filename: 'benchmark.docx',
    mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceOrder: 1
});

const deterministicDocx = () =>
    DocxIdentity.projectDeterministicDocxCandidate({
        candidate: {
            id: 'benchmark-docx-draft',
            questionNumber: '1',
            type: 'solution',
            stem: 'Benchmark deterministic DOCX question.',
            options: [],
            answer: '',
            solution: 'Benchmark deterministic proof.',
            images: []
        },
        source: source(),
        engine: 'docx-xml-importer',
        page: 1
    });

const buildRows = count => Array.from({ length: count }, (_, index) => ({
    id: `benchmark-review-${index + 1}`,
    questionNumber: String(index + 1),
    type: 'solution',
    stem: `Benchmark ReviewDraft ${index + 1}.`,
    options: [],
    answer: '',
    solution: 'Benchmark solution.',
    images: [],
    warnings: [],
    source: {
        mode: 'docx-deterministic',
        sourceId: 'benchmark-docx'
    }
}));

const persistenceCommand = (batchId, idempotencyKey) => ({
    idempotencyKey,
    expectedVersion: 0,
    batch: {
        id: batchId,
        status: 'review',
        progress: 100,
        createdAt: 1,
        updatedAt: 2
    },
    files: [{
        id: `${batchId}-file`,
        batchId,
        fileType: 'docx',
        parseStatus: 'success'
    }],
    drafts: [{
        id: `${batchId}-draft`,
        batchId,
        version: 1,
        order: 1,
        status: 'pending',
        stem: 'Benchmark persisted draft.'
    }],
    images: []
});

const createPersistenceFixture = batchId => {
    const database = new FakeDatabase({
        draftImportBatches: [{
            id: batchId,
            status: 'processing',
            createdAt: 1,
            updatedAt: 1
        }]
    });
    return Storage.createRepository(database, { clock: () => 100 });
};

const measure = async (name, work, verify = () => true) => {
    for (let index = 0; index < warmupRuns; index += 1) {
        const value = await work(`warmup-${index}`);
        if (!verify(value)) throw new Error(`${name}-warmup-invalid`);
    }
    const samplesMs = [];
    for (let index = 0; index < sampleRuns; index += 1) {
        const started = performance.now();
        const value = await work(`sample-${index}`);
        samplesMs.push(performance.now() - started);
        if (!verify(value)) throw new Error(`${name}-sample-invalid`);
    }
    return {
        name,
        samplesMs,
        p50Ms: percentile(samplesMs, 0.5),
        p95Ms: percentile(samplesMs, 0.95),
        timeoutCount: 0,
        failureCount: 0
    };
};

async function run() {
    let persistedReloadFixture = null;
    const scenarios = [];

    scenarios.push(await measure(
        'docx-stable-import-owner-chain',
        () => ReviewBuilder.buildReviewDrafts(
            [deterministicDocx()],
            { batchId: 'benchmark-docx-stable', now: 100 }
        ),
        value => value.length === 1 &&
            value[0].producer.mode === 'deterministic-docx'
    ));
    scenarios.push(await measure(
        'docx-vision-fixture-owner-chain',
        () => ReviewBuilder.buildReviewDrafts(
            [docxVisionCandidate()],
            { batchId: 'benchmark-docx-vision', now: 100 }
        ),
        value => value.length === 1 &&
            value[0].producer.routeId === 'docx-rendered-to-pdf-vision'
    ));
    scenarios.push(await measure(
        'pdf-full-owner-chain',
        () => pdfCandidate(),
        value => value.supportLevel === 'full' &&
            value.validation.ownershipValid === true
    ));
    scenarios.push(await measure(
        'pdf-safe-partial-owner-chain',
        () => pdfCandidate({ includeAnswer: false }),
        value => value.supportLevel === 'safe-partial' &&
            value.manualReviewRequired === true
    ));
    scenarios.push(await measure(
        'pdf-known-bad-reject-owner-chain',
        () => pdfCandidate({ ownershipValid: false }),
        value => value.supportLevel === 'rejected' &&
            value.validation.ownershipValid === false
    ));

    for (const count of [50, 100, 300]) {
        scenarios.push(await measure(
            `review-draft-build-${count}`,
            () => ReviewBuilder.buildReviewDrafts(
                buildRows(count),
                { batchId: `benchmark-review-${count}`, now: 100 }
            ),
            value => value.length === count && Object.isFrozen(value)
        ));
    }

    scenarios.push(await measure(
        'persistence-commit-readback',
        async key => {
            const batchId = `benchmark-persist-${key}`;
            const repository = createPersistenceFixture(batchId);
            const result = await Persistence.persistDraftBatch(
                persistenceCommand(batchId, `persist:${key}`),
                repository
            );
            const loaded = await Persistence.reloadDraftBatch(
                batchId,
                repository
            );
            return { result, loaded };
        },
        value => value.result.version === 1 &&
            value.loaded.questions.length === 1
    ));

    {
        const batchId = 'benchmark-reload';
        const repository = createPersistenceFixture(batchId);
        await Persistence.persistDraftBatch(
            persistenceCommand(batchId, 'reload:seed'),
            repository
        );
        persistedReloadFixture = { batchId, repository };
    }
    scenarios.push(await measure(
        'review-draft-reload',
        () => Persistence.reloadDraftBatch(
            persistedReloadFixture.batchId,
            persistedReloadFixture.repository
        ),
        value => value.questions.length === 1
    ));

    scenarios.push(await measure(
        'cancellation-pre-transport',
        async () => {
            const controller = new AbortController();
            controller.abort();
            try {
                await PdfSources.processPdfSources({
                    batch: { id: 'benchmark-cancel' },
                    sources: [{
                        id: 'benchmark-pdf',
                        batchId: 'benchmark-cancel',
                        fileType: 'pdf'
                    }],
                    signal: controller.signal
                }, {
                    produceEngineResult: async () => {
                        throw new Error('transport-must-not-run');
                    },
                    buildProjectionContext: () => ({})
                });
                return { cancelled: false };
            } catch (error) {
                return {
                    cancelled: error?.name === 'AbortError',
                    code: error?.code
                };
            }
        },
        value => value.cancelled && value.code === 'PDF_SOURCES_ABORTED'
    ));

    scenarios.push(await measure(
        'duplicate-idempotent-retry',
        async key => {
            const batchId = `benchmark-duplicate-${key}`;
            const repository = createPersistenceFixture(batchId);
            const command = persistenceCommand(batchId, `duplicate:${key}`);
            await Persistence.persistDraftBatch(command, repository);
            return Persistence.persistDraftBatch(command, repository);
        },
        value => value.idempotent === true && value.version === 1
    ));

    return {
        schemaVersion: 'qisi.program-c-closure-benchmark.r3',
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        sampleRuns,
        warmupRuns,
        realApiCalled: false,
        scenarios
    };
}

run()
    .then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch(error => {
        process.stderr.write(
            `[measure-program-c-closure] ${error?.stack || error}\n`
        );
        process.exitCode = 1;
    });
