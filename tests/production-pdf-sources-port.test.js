const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Port = require('../qisi-production-pdf-sources-port.js');
const ROOT = path.resolve(__dirname, '..');

const input = () => ({
    batch: { id: 'batch-1' },
    sources: [
        { id: 'question', batchId: 'batch-1', fileType: 'pdf' },
        { id: 'support', batchId: 'batch-1', fileType: 'pdf' }
    ],
    helpers: { marker: true }
});

test('processPdfSources invokes the existing engine once with coordinator controls', async () => {
    const controller = new AbortController();
    const pageEvents = [];
    const calls = [];
    const engineResult = {
        evidences: [{ id: 'e1' }], drafts: [{ id: 'd1' }],
        draftImages: [], unmatched: [], warnings: [], errors: []
    };
    const onPageProgress = event => { pageEvents.push(event); };
    const request = { ...input(), signal: controller.signal, onPageProgress };

    const result = await Port.processPdfSources(request, {
        engine: {
            processBatchV2: async payload => {
                calls.push(payload);
                await payload.helpers.onPdfPageProgress({ sourceId: 'question' });
                return engineResult;
            }
        },
        buildProjectionContext: value => ({ marker: value.engineResult.drafts[0].id })
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].batch, request.batch);
    assert.equal(calls[0].files, request.sources);
    assert.notEqual(calls[0].helpers, request.helpers);
    assert.equal(calls[0].helpers.marker, true);
    assert.equal(calls[0].helpers.deferPdfCandidateProjection, true);
    assert.equal(calls[0].helpers.pdfSignal, controller.signal);
    assert.equal(calls[0].helpers.onPdfPageProgress, onPageProgress);
    assert.deepEqual(pageEvents, [{ sourceId: 'question' }]);
    assert.notEqual(result, engineResult);
    assert.deepEqual(result.projectionContext, { marker: 'd1' });
    assert.deepEqual(request.helpers, { marker: true });
});

test('invalid context and missing engine fail closed', async () => {
    const engine = { processBatchV2: async () => ({ drafts: [] }) };
    await assert.rejects(
        Port.processPdfSources({ ...input(), sources: [] }, {
            engine, buildProjectionContext: () => ({})
        }),
        error => error.code === 'PDF_SOURCES_INVALID'
    );
    await assert.rejects(
        Port.processPdfSources({ ...input(), sources: [{ id: 'x', fileType: 'docx' }] }, {
            engine, buildProjectionContext: () => ({})
        }),
        error => error.code === 'PDF_SOURCES_INVALID'
    );
    await assert.rejects(
        Port.processPdfSources(input(), {}),
        error => error.code === 'PDF_SOURCES_PORT_REQUIRED'
    );
    await assert.rejects(
        Port.processPdfSources(input(), { engine }),
        error => error.code === 'PDF_SOURCES_PROJECTION_PORT_REQUIRED'
    );
});

test('engine output is returned untouched for the coordinator-owned result gate', async () => {
    const malformed = { engineContract: 'malformed' };
    const result = await Port.processPdfSources(input(), {
        engine: { processBatchV2: async () => malformed },
        buildProjectionContext: () => assert.fail('malformed output is coordinator-owned')
    });
    assert.equal(result, malformed);
});

test('engine errors retain identity for coordinator sanitization', async () => {
    const stable = Object.assign(new Error('private PDF content'), { code: 'ENGINE_DOWN' });
    await assert.rejects(
        Port.processPdfSources(input(), {
            engine: { processBatchV2: async () => { throw stable; } },
            buildProjectionContext: () => ({})
        }),
        error => error === stable
    );
});

test('cancellation stops before the engine and discards a late result', async () => {
    const before = new AbortController();
    before.abort();
    let called = false;
    await assert.rejects(
        Port.processPdfSources({ ...input(), signal: before.signal }, {
            engine: { processBatchV2: async () => { called = true; return { drafts: [] }; } },
            buildProjectionContext: () => ({})
        }),
        error => error.name === 'AbortError' && error.code === 'PDF_SOURCES_ABORTED'
    );
    assert.equal(called, false);

    const after = new AbortController();
    await assert.rejects(
        Port.processPdfSources({ ...input(), signal: after.signal }, {
            engine: {
                processBatchV2: async () => {
                    after.abort();
                    return { drafts: [{ id: 'late' }] };
                }
            },
            buildProjectionContext: () => ({})
        }),
        error => error.name === 'AbortError' && error.code === 'PDF_SOURCES_ABORTED'
    );
});

test('port owns no parser, aligner, controlled-write, DB, UI, or FormalAdmission logic', () => {
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-production-pdf-sources-port.js'), 'utf8'
    );
    assert.doesNotMatch(implementation, /indexedDB|Dexie|\.transaction\s*\(|\.update\s*\(/);
    assert.doesNotMatch(implementation, /document\.|AppProxy|FormalAdmission|\bfetch\s*\(/);
    assert.doesNotMatch(implementation, /SupportParser|SupportAligner|controlledWrite|RouteB/i);
});

test('PDF-only production coordinator adapter uses the shared source port', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(
        app,
        /ProductionPdfSourcesPort\s*\.createProductionImportRunner\s*\(/
    );
    assert.doesNotMatch(app, /ProductionPdfSourcesPort\.processPdfSources\s*\(/);
    assert.doesNotMatch(app, /Qisi\.PdfImportCoordinator\.runPdfImport\s*\(/);
    assert.doesNotMatch(app, /createPdfEngineProjectionContext\s*\(/);
    assert.match(app, /PdfCandidateProjection\s*\.projectPdfCandidates\s*\(/);
});

test('production runner owns PDF source roles, evidence, projection context, and safe partial', async () => {
    const runner = Port.createProductionImportRunner({
        coordinator: {
            runPdfImport: async (context, runnerPorts, signal) => {
                const result = await runnerPorts.processSources({
                    sources: context.sources,
                    onPageProgress: () => {}
                });
                return {
                    ...result,
                    safePartialCandidates: result.drafts.map(draft =>
                        runnerPorts.createSafePartial(draft, { warnings: [] })
                    ),
                    signal
                };
            }
        },
        hasQuestionRole: source => source.roles.includes('question'),
        isFullRole: source => source.roles.includes('full'),
        hasAnswerRole: source => source.roles.includes('answer'),
        hasSolutionRole: source => source.roles.includes('solution'),
        getRoles: source => source.roles,
        normalizeQuestionNumber: value => String(value || '').trim(),
        getEngineHelpers: () => ({ marker: true }),
        processQuestionSource: async () => ({
            questions: [{ id: 'draft-1', questionNumber: '1' }],
            check: { fatal: false, warningReasons: [] }
        }),
        prepareSupportPages: async () => [{ pageNo: 1 }],
        processSupportPages: async () => ({ rawTextPages: ['1. A'] }),
        buildProjectionContext: input => ({
            marker: input.batchId,
            drafts: input.engineResult.drafts
        }),
        safePartialPipeline: {
            normalizePdfPipelineResult: () => ({
                isSafePartial: true, isComplete: false
            })
        }
    });
    const result = await runner({
        batchId: 'batch-1',
        batch: { id: 'batch-1', expectedQuestionCount: 1 },
        sources: [
            { ...input().sources[0], roles: ['question'] },
            { ...input().sources[1], roles: ['answer', 'solution'] }
        ]
    });
    assert.equal(result.drafts.length, 1);
    assert.equal(result.evidences[0].sourceFileId, 'support');
    assert.equal(result.projectionContext.marker, 'batch-1');
    assert.equal(result.safePartialCandidates[0].isSafePartial, true);
});
