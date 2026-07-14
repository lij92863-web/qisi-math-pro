'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE_COMMIT = '79fea1e1cad0c682c42539dd575370f3919f1d05';
const SNAPSHOT_FILES = Object.freeze([
    'qisi-batch-formal-submit.js',
    'qisi-docx-producer-identity-contract.js',
    'qisi-draft-persistence-service.js',
    'qisi-formal-admission-policy.js',
    'qisi-import-state-machine.js',
    'qisi-pdf-safe-partial-pipeline.js',
    'qisi-production-import-output-port.js',
    'qisi-recognition-contracts.js',
    'qisi-review-controller.js',
    'qisi-review-draft-builder.js',
    'qisi-storage-repository.js',
    'qisi-utils.js',
    'tests/fixtures/formal-admission-transaction.js',
    'tests/storage-test-harness.js'
]);

function integerArg(name, fallback, minimum, maximum) {
    const prefix = `--${name}=`;
    const raw = process.argv.find(value => value.startsWith(prefix));
    const parsed = Number(raw ? raw.slice(prefix.length) : fallback);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`${name}-must-be-${minimum}-to-${maximum}`);
    }
    return parsed;
}

function stringArg(name, fallback = '') {
    const prefix = `--${name}=`;
    const raw = process.argv.find(value => value.startsWith(prefix));
    return raw ? raw.slice(prefix.length) : fallback;
}

function percentile(samples, ratio) {
    const ordered = [...samples].sort((left, right) => left - right);
    const index = Math.max(
        0,
        Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)
    );
    return ordered[index];
}

function clone(value) {
    return structuredClone(value);
}

function source() {
    return {
        sourceId: 'benchmark-docx',
        format: 'docx',
        filename: 'benchmark.docx',
        mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sourceOrder: 1
    };
}

function candidate(overrides = {}) {
    return {
        id: 'benchmark-draft',
        version: 1,
        questionNumber: '1',
        type: 'solution',
        stem: 'Benchmark producer question.',
        options: [],
        answer: '',
        solution: '',
        images: [],
        ...overrides
    };
}

function reviewRows(count) {
    return Array.from({ length: count }, (_, index) => ({
        id: `review-${index + 1}`,
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
}

function persistenceCommand(batchId, idempotencyKey) {
    return {
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
    };
}

async function repeated(count, operation) {
    let value;
    for (let index = 0; index < count; index += 1) {
        value = await operation(index);
    }
    return value;
}

async function measure(name, runs, warmups, operation, verify) {
    for (let index = 0; index < warmups; index += 1) {
        const value = await operation(`warmup-${index}`);
        if (!verify(value)) {
            throw new Error(
                `${name}-warmup-invalid:${JSON.stringify(value).slice(0, 1000)}`
            );
        }
    }
    const samplesMs = [];
    for (let index = 0; index < runs; index += 1) {
        const started = performance.now();
        const value = await operation(`sample-${index}`);
        samplesMs.push(performance.now() - started);
        if (!verify(value)) {
            throw new Error(
                `${name}-sample-invalid:${JSON.stringify(value).slice(0, 1000)}`
            );
        }
    }
    return {
        name,
        samplesMs,
        p50Ms: percentile(samplesMs, 0.5),
        p95Ms: percentile(samplesMs, 0.95),
        failureCount: 0,
        timeoutCount: 0
    };
}

async function runWorker(repoRoot, profile, runs, warmups) {
    const load = file => require(path.join(repoRoot, file));
    const DocxIdentity = load('qisi-docx-producer-identity-contract.js');
    const ReviewBuilder = load('qisi-review-draft-builder.js');
    const PdfSafePartial = load('qisi-pdf-safe-partial-pipeline.js');
    const ReviewController = load('qisi-review-controller.js');
    const OutputPort = load('qisi-production-import-output-port.js');
    const Utils = load('qisi-utils.js');
    const Persistence = load('qisi-draft-persistence-service.js');
    const Submit = load('qisi-batch-formal-submit.js');
    const Machine = load('qisi-import-state-machine.js');
    const FormalFixture = load(
        'tests/fixtures/formal-admission-transaction.js'
    );
    const { FakeDatabase } = load('tests/storage-test-harness.js');

    const deterministic = () =>
        DocxIdentity.projectDeterministicDocxCandidate({
            candidate: candidate({ solution: 'Deterministic proof.' }),
            source: source(),
            engine: 'docx-xml-importer',
            page: 1
        });
    const vision = () => DocxIdentity.projectDocxVisionCandidate({
        candidate: candidate(),
        source: source(),
        engine: 'benchmark-outer-engine',
        page: 1,
        blockIds: ['page:1:candidate:1'],
        controlledWriteDecision: {
            accepted: true,
            decisionId: 'benchmark-docx-vision',
            fields: ['questionNumber', 'stem', 'options'],
            method: 'strict-json-contract',
            sourceId: 'benchmark-docx',
            engine: 'benchmark-outer-engine'
        }
    });
    const createFormalService = drafts => {
        let sequence = 0;
        const database = new FakeDatabase({ draftQuestions: drafts });
        const repository = FormalFixture.createRepository(database);
        const service = Submit.createBatchFormalSubmit({
            policy: load('qisi-formal-admission-policy.js'),
            repository,
            createStateMachine: options =>
                Machine.createImportStateMachine(options),
            clock: () => FormalFixture.now,
            random: () => {
                sequence += 1;
                return sequence / 1000;
            }
        });
        return { repository, service };
    };
    const submitDraft = (service, draft, suffix) => service.submit({
        draft,
        draftId: draft.id,
        batchId: draft.batchId,
        expectedDraftVersion: draft.version,
        actorId: 'benchmark-teacher',
        requestId: `benchmark-request-${suffix}`,
        idempotencyKey: `benchmark-request-${suffix}`,
        questionId: `benchmark-question-${suffix}`
    });
    const reviewController = ReviewController.createReviewController({
        validateDraft: () => ({ valid: true, errors: [], warnings: [] }),
        formalFields: ['stem', 'answer', 'solution'],
        clock: () => FormalFixture.now
    });
    const outputPorts = {
        cleanText: Utils.cleanDisplayTextForBatchSave,
        normalizeQuestionKey: value => String(value || '').trim(),
        cleanOptions: Utils.cleanDisplayOptionsForBatchSave,
        mergeImages: (left, right) => [...(left || []), ...(right || [])]
    };
    const reloadBatchId = `benchmark-reload-${profile}`;
    const reloadDatabase = new FakeDatabase({
        draftImportBatches: [{
            id: reloadBatchId,
            status: 'processing',
            createdAt: 1,
            updatedAt: 1
        }]
    });
    const Storage = load('qisi-storage-repository.js');
    const reloadRepository = Storage.createRepository(reloadDatabase, {
        clock: () => FormalFixture.now
    });
    await Persistence.persistDraftBatch(
        persistenceCommand(reloadBatchId, `reload-seed-${profile}`),
        reloadRepository
    );

    const scenarios = [];
    scenarios.push(await measure(
        'docx-deterministic', runs, warmups,
        () => repeated(300, () => ReviewBuilder.buildReviewDrafts(
            [deterministic()],
            { batchId: 'benchmark-docx', now: FormalFixture.now }
        )),
        value => value.length === 1 &&
            value[0].producer.mode === 'deterministic-docx'
    ));
    scenarios.push(await measure(
        'docx-vision', runs, warmups,
        () => repeated(300, () => ReviewBuilder.buildReviewDrafts(
            [vision()],
            { batchId: 'benchmark-vision', now: FormalFixture.now }
        )),
        value => value.length === 1 &&
            value[0].producer.routeId === 'docx-rendered-to-pdf-vision'
    ));
    scenarios.push(await measure(
        'pdf-safe-partial', runs, warmups,
        () => repeated(1000, () => {
            const value = PdfSafePartial.normalizePdfPipelineResult({
                answerQuestionNumbers: ['1'],
                solutionQuestionNumbers: [],
                warnings: [{ questionNumber: '2' }]
            });
            PdfSafePartial.assertSafePartialInvariants(value);
            return value;
        }),
        value => value.isSafePartial === true && value.isComplete === false
    ));
    for (const count of [100, 300]) {
        scenarios.push(await measure(
            `review-draft-build-${count}`, runs, warmups,
            () => ReviewBuilder.buildReviewDrafts(
                reviewRows(count),
                { batchId: `benchmark-review-${count}`, now: FormalFixture.now }
            ),
            value => value.length === count && Object.isFrozen(value)
        ));
    }
    scenarios.push(await measure(
        'confirm', runs, warmups,
        () => repeated(300, index => reviewController.confirm({
            id: `confirm-${index}`,
            version: 1,
            status: 'pending',
            stem: 'Confirm benchmark.'
        })),
        value => value.accepted === true && value.draft.status === 'reviewed'
    ));
    scenarios.push(await measure(
        'single-formal-submit', runs, warmups,
        async sample => {
            const draft = FormalFixture.makeDraft({
                id: `single-${sample}`,
                batchId: `single-batch-${sample}`
            });
            const fixture = createFormalService([draft]);
            return submitDraft(fixture.service, draft, `single-${sample}`);
        },
        value => value.accepted === true
    ));
    scenarios.push(await measure(
        'batch-submit', runs, warmups,
        async sample => {
            const drafts = Array.from({ length: 5 }, (_, index) =>
                FormalFixture.makeDraft({
                    id: `batch-${sample}-${index}`,
                    batchId: `batch-${sample}`,
                    questionNumber: String(index + 1),
                    stem: `Unique batch benchmark stem ${sample} ${index}`
                })
            );
            const fixture = createFormalService(drafts);
            const results = [];
            for (const [index, draft] of drafts.entries()) {
                results.push(await submitDraft(
                    fixture.service,
                    draft,
                    `batch-${sample}-${index}`
                ));
            }
            return results;
        },
        value => value.length === 5 && value.every(item => item.accepted)
    ));
    scenarios.push(await measure(
        'dedupe', runs, warmups,
        () => repeated(10, () => OutputPort.projectImportOutput({
            drafts: reviewRows(300).map((draft, index) => ({
                ...draft,
                id: `dedupe-${index}`,
                questionNumber: String((index % 150) + 1),
                stem: `Dedupe stem ${index % 150}`
            })),
            draftImages: [],
            stage: 'benchmark-dedupe'
        }, outputPorts)),
        value => value.drafts.length === 150
    ));
    scenarios.push(await measure(
        'cleanup', runs, warmups,
        () => repeated(10, () => reviewRows(300).map(row => {
            const draft = {
                ...clone(row),
                stem: `\`\`\`json\n${row.stem}\n\`\`\``,
                rawEvidence: { original: row.stem },
                fieldProvenance: { stem: { status: 'manual' } }
            };
            Utils.preserveRawEvidence(draft);
            Utils.cleanDisplayFieldsOnly(draft);
            return draft;
        })),
        value => value.length === 300 &&
            value.every(item => item.rawEvidence?.original)
    ));
    scenarios.push(await measure(
        'reload', runs, warmups,
        () => repeated(100, () => Persistence.reloadDraftBatch(
            reloadBatchId,
            reloadRepository
        )),
        value => value.questions.length === 1
    ));

    return {
        schemaVersion: 'qisi.program-c-corrective-benchmark-worker.r1',
        profile,
        repoRoot,
        node: process.version,
        platform: `${process.platform}-${process.arch}`,
        sampleRuns: runs,
        warmupRuns: warmups,
        realApiCalled: false,
        scenarios
    };
}

function materializeBaseline() {
    const tempRoot = path.resolve(os.tmpdir());
    const snapshotRoot = path.join(
        tempRoot,
        `qisi-program-c-baseline-${process.pid}-${Date.now()}`
    );
    if (
        path.dirname(path.resolve(snapshotRoot)) !== tempRoot ||
        !path.basename(snapshotRoot).startsWith('qisi-program-c-baseline-')
    ) throw new Error('unsafe-baseline-snapshot-path');
    fs.mkdirSync(snapshotRoot, { recursive: false });
    for (const file of SNAPSHOT_FILES) {
        const result = spawnSync(
            'git',
            ['show', `${BASELINE_COMMIT}:${file}`],
            { cwd: ROOT, encoding: null, maxBuffer: 20 * 1024 * 1024 }
        );
        if (result.status !== 0) {
            throw new Error(
                `baseline-materialize-failed:${file}:${String(result.stderr)}`
            );
        }
        const target = path.join(snapshotRoot, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, result.stdout);
    }
    return snapshotRoot;
}

function runWorkerProcess(repoRoot, profile, runs, warmups) {
    const result = spawnSync(process.execPath, [
        __filename,
        `--worker-root=${repoRoot}`,
        `--profile=${profile}`,
        `--runs=${runs}`,
        `--warmup=${warmups}`
    ], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 5 * 60 * 1000
    });
    if (result.status !== 0) {
        throw new Error(
            `benchmark-worker-failed:${profile}:${result.stderr || result.stdout}`
        );
    }
    return JSON.parse(result.stdout);
}

async function browserEnvironment() {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
        return {
            engine: 'Playwright Chromium',
            version: browser.version()
        };
    } finally {
        await browser.close();
    }
}

function percent(candidateValue, baselineValue) {
    if (!Number.isFinite(baselineValue) || baselineValue <= 0) return null;
    return ((candidateValue - baselineValue) / baselineValue) * 100;
}

async function runComparison() {
    const smoke = process.argv.includes('--smoke');
    const runs = integerArg('runs', smoke ? 1 : 10, 1, 50);
    const warmups = integerArg('warmup', smoke ? 0 : 3, 0, 20);
    const snapshotRoot = materializeBaseline();
    try {
        const browser = await browserEnvironment();
        const baseline = runWorkerProcess(
            snapshotRoot,
            'rc2-baseline',
            runs,
            warmups
        );
        const candidateResult = runWorkerProcess(
            ROOT,
            'corrective-candidate',
            runs,
            warmups
        );
        const candidateByName = new Map(
            candidateResult.scenarios.map(item => [item.name, item])
        );
        const thresholdEnforced = runs >= 10;
        const comparisons = baseline.scenarios.map(base => {
            const current = candidateByName.get(base.name);
            if (!current) throw new Error(`candidate-scenario-missing:${base.name}`);
            const p50RegressionPercent = percent(current.p50Ms, base.p50Ms);
            const p95RegressionPercent = percent(current.p95Ms, base.p95Ms);
            const blocker = thresholdEnforced &&
                [p50RegressionPercent, p95RegressionPercent]
                .some(value => Number.isFinite(value) && value > 25);
            const targetExceeded =
                p50RegressionPercent > 10 || p95RegressionPercent > 15;
            return {
                name: base.name,
                baseline: {
                    p50Ms: base.p50Ms,
                    p95Ms: base.p95Ms
                },
                candidate: {
                    p50Ms: current.p50Ms,
                    p95Ms: current.p95Ms
                },
                p50RegressionPercent,
                p95RegressionPercent,
                targetExceeded,
                blocker,
                failureCount: base.failureCount + current.failureCount,
                timeoutCount: base.timeoutCount + current.timeoutCount
            };
        });
        const blocked = comparisons.some(item =>
            item.blocker || item.failureCount || item.timeoutCount
        );
        return {
            schemaVersion: 'qisi.program-c-corrective-benchmark.r1',
            decision: blocked
                ? 'PROGRAM_C_CORRECTIVE_BENCHMARK_BLOCKED'
                : 'PROGRAM_C_CORRECTIVE_BENCHMARK_ACCEPTED',
            baselineCommit: BASELINE_COMMIT,
            candidateCommit: stringArg('candidate-commit', 'working-tree'),
            sameMachine: true,
            sameNode: baseline.node === candidateResult.node,
            sameBrowser: true,
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            browser,
            sampleRuns: runs,
            warmupRuns: warmups,
            thresholdEnforced,
            threshold: {
                p50TargetPercent: 10,
                p95TargetPercent: 15,
                defaultBlockerPercent: 25
            },
            realApiCalled: false,
            fixtureCandidateTransport: false,
            comparisons
        };
    } finally {
        const tempRoot = path.resolve(os.tmpdir());
        if (
            path.dirname(path.resolve(snapshotRoot)) !== tempRoot ||
            !path.basename(snapshotRoot).startsWith('qisi-program-c-baseline-')
        ) throw new Error('unsafe-baseline-cleanup-path');
        fs.rmSync(snapshotRoot, { recursive: true, force: true });
    }
}

async function main() {
    const workerRoot = stringArg('worker-root');
    if (workerRoot) {
        const result = await runWorker(
            path.resolve(workerRoot),
            stringArg('profile', 'worker'),
            integerArg('runs', 10, 1, 50),
            integerArg('warmup', 3, 0, 20)
        );
        process.stdout.write(`${JSON.stringify(result)}\n`);
        return;
    }
    const result = await runComparison();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.decision.endsWith('_BLOCKED')) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(error => {
        process.stderr.write(
            `[measure-program-c-closure] ${error?.stack || error}\n`
        );
        process.exitCode = 1;
    });
}

module.exports = {
    BASELINE_COMMIT,
    percentile,
    runWorker
};
