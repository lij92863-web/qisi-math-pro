const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Coordinator = require('../qisi-pdf-import-coordinator.js');
const ROOT = path.resolve(__dirname, '..');

const context = () => ({
    batchId: 'batch-1',
    batch: { id: 'batch-1' },
    sources: [
        { id: 'support', fileType: 'pdf', sourceOrder: 2 },
        { id: 'question', fileType: 'pdf', sourceOrder: 1 }
    ]
});

const safePartial = draft => ({
    draft,
    mode: 'safe-partial',
    isSafePartial: true,
    isComplete: false,
    requiresManualReview: true
});

test('orders PDF intake, forwards page progress, and returns safe-partial candidates', async () => {
    const progress = [];
    let orderedIds = [];
    const result = await Coordinator.runPdfImport(context(), {
        processSources: async ({ sources, onPageProgress }) => {
            orderedIds = sources.map(source => source.id);
            await onPageProgress({ sourceId: 'question', pageNo: 1, totalPages: 2 });
            await onPageProgress({ sourceId: 'question', pageNo: 2, totalPages: 2 });
            await onPageProgress({ sourceId: 'support', pageNo: 1, totalPages: 1 });
            return {
                evidences: [{ id: 'e1' }],
                drafts: [{ id: 'd1' }],
                draftImages: [], unmatched: [], warnings: [], errors: []
            };
        },
        createSafePartial: safePartial,
        reportProgress: snapshot => { progress.push(snapshot.progress); }
    });

    assert.deepEqual(orderedIds, ['question', 'support']);
    assert.deepEqual(result.orderedSourceIds, orderedIds);
    assert.equal(result.safePartialCandidates.length, 1);
    assert.equal(result.safePartialCandidates[0].isComplete, false);
    assert.equal(result.safePartialCandidates[0].requiresManualReview, true);
    assert.equal(progress[0], 0);
    assert.equal(progress.at(-1), 100);
    assert.deepEqual(progress, [...progress].sort((a, b) => a - b));
});

test('missing adapter and non-PDF input fail closed', async () => {
    await assert.rejects(
        Coordinator.runPdfImport(context(), {}),
        error => error.code === 'PDF_COORDINATOR_ADAPTER_UNAVAILABLE'
    );
    const invalid = context();
    invalid.sources[0].fileType = 'docx';
    await assert.rejects(
        Coordinator.runPdfImport(invalid, { processSources: async () => ({}), createSafePartial: safePartial }),
        error => error.code === 'PDF_COORDINATOR_NON_PDF_SOURCE'
    );
});

test('cancellation ignores adapter output and returns the stable abort code', async () => {
    const controller = new AbortController();
    await assert.rejects(
        Coordinator.runPdfImport(context(), {
            processSources: async ({ onPageProgress }) => {
                controller.abort();
                await onPageProgress({ sourceId: 'question', pageNo: 1, totalPages: 1 });
                return { drafts: [{ id: 'late' }] };
            },
            createSafePartial: safePartial
        }, controller.signal),
        error => error.code === 'PDF_COORDINATOR_ABORTED'
    );
});

test('adapter errors are sanitized and unsafe candidates are rejected', async () => {
    await assert.rejects(
        Coordinator.runPdfImport(context(), {
            processSources: async () => {
                const error = new Error('private PDF text');
                error.code = 'ADAPTER_DOWN';
                throw error;
            },
            createSafePartial: safePartial
        }),
        error => {
            assert.equal(error.code, 'PDF_COORDINATOR_SOURCE_FAILED');
            assert.equal(error.causeCode, 'ADAPTER_DOWN');
            assert.doesNotMatch(error.message, /private PDF text/);
            return true;
        }
    );

    await assert.rejects(
        Coordinator.runPdfImport(context(), {
            processSources: async () => ({ drafts: [{ id: 'd1' }] }),
            createSafePartial: draft => ({ draft, isSafePartial: false, isComplete: true })
        }),
        error => error.code === 'PDF_COORDINATOR_UNSAFE_CANDIDATE'
    );
});

test('production PDF-only V2 route uses the coordinator without moving frozen owners', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const html = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const engine = fs.readFileSync(path.join(ROOT, 'qisi-batch-engine-v2.js'), 'utf8');
    const implementation = fs.readFileSync(path.join(ROOT, 'qisi-pdf-import-coordinator.js'), 'utf8');
    assert.match(app, /Qisi\.PdfImportCoordinator\.runPdfImport\s*\(/);
    assert.match(app, /pdfOnlyEngineFiles/);
    assert.ok(html.indexOf('qisi-pdf-import-coordinator.js') < html.indexOf('app.js'));
    assert.match(engine, /onPdfPageProgress/);
    assert.match(engine, /pdfSignal/);
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|\.put\s*\(|\.add\s*\(|\.delete\s*\(|\.transaction\s*\(/);
    assert.doesNotMatch(implementation, /parser|align|controlledWrite|FormalAdmission|saveQuestion|answerOwnership/i);
});

test('real V2 engine emits page progress and propagates coordinator cancellation', async () => {
    const previousWindow = global.window;
    const enginePath = require.resolve('../qisi-batch-engine-v2.js');
    delete require.cache[enginePath];
    global.window = {};
    require(enginePath);
    const engine = global.window.QisiBatchEngineV2;
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;

    let sequence = 0;
    const pageEvents = [];
    const helpers = {
        makeBatchId: prefix => `${prefix}-${++sequence}`,
        getBatchFileRoles: file => file.roles,
        batchHasQuestionRole: file => file.roles.includes('question'),
        batchHasAnswerRole: file => file.roles.includes('answer'),
        batchHasSolutionRole: file => file.roles.includes('solution'),
        renderPdfFilePages: async () => [{ pageNo: 1, url: 'data:image/png;base64,page' }],
        extractPdfTextWithPdfJs: async () => '1. Question\nA. alpha B. beta C. gamma D. delta',
        extractPdfLayoutWithPdfJs: async () => [],
        recognizePageMarkdownWithQwen: async () => '1. Question',
        forceVisionOcr: true,
        onPdfPageProgress: event => { pageEvents.push(event); },
        isFatalQwenServiceError: () => false
    };
    const batch = { id: 'batch-1', defaultMeta: {} };
    const files = [{ id: 'pdf-1', batchId: 'batch-1', filename: 'q.pdf', fileType: 'pdf', roles: ['question'] }];
    await engine.processBatchV2({ batch, files, helpers });
    assert.deepEqual(pageEvents.map(event => [event.sourceId, event.pageNo, event.totalPages]), [
        ['pdf-1', 1, 1]
    ]);

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        engine.processBatchV2({ batch, files, helpers: { ...helpers, pdfSignal: controller.signal } }),
        error => error.code === 'PDF_COORDINATOR_ABORTED'
    );
});
