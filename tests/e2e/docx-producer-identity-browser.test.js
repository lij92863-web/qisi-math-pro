const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    startBrowserApp,
    assertNoRuntimeErrors,
    callProxy
} = require('./browser-harness.js');

const ROOT = path.resolve(__dirname, '..', '..');
const MOCK_CHAT_ROUTE = ['**', 'api', 'ai', 'chat'].join('/');
const dataUrl = (file, mime) =>
    `data:${mime};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const withDb = (page, callback, payload) => page.evaluate(
    async ({ source, value }) => {
        const db = new window.Dexie('QisiMathVueDB');
        await db.open();
        try {
            return await (0, eval)(`(${source})`)(db, value);
        } finally {
            db.close();
        }
    },
    { source: callback.toString(), value: payload }
);

test('normal UI DOCX vision and Bridge shadow share producer identity contract', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32119);
    let mockAiCalls = 0;
    let mockModel = '';
    const docxDataUrl = dataUrl(
        '1.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    const questions = Array.from({ length: 6 }, (_, index) => ({
        questionNumber: String(index + 1),
        type: '\u89e3\u7b54\u9898',
        stem: `Normal UI deterministic mock vision stem ${index + 1}`,
        options: { A: '', B: '', C: '', D: '' },
        answer: '',
        solution: '',
        isFragment: false,
        question_bbox: [20, 20 + index * 100, 980, 100 + index * 100],
        images: []
    }));

    try {
        await harness.page.route(MOCK_CHAT_ROUTE, async route => {
            mockAiCalls += 1;
            const body = route.request().postDataJSON();
            mockModel = String(body?.model || 'mock-browser-engine');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: JSON.stringify({ questions })
                        }
                    }]
                })
            });
        });

        await withDb(harness.page, async (db, value) => {
            for (const table of [
                'draftQuestions', 'draftImages', 'draftImportFiles',
                'draftImportBatches', 'questions'
            ]) {
                await db.table(table).clear();
            }
            const now = Date.now();
            await db.table('draftImportBatches').put({
                id: value.batchId,
                status: 'pending',
                progress: 0,
                sourceVersion: 1,
                expectedQuestionCount: 6,
                recognitionMode: 'standard',
                defaultMeta: {
                    defaultType: '\u89e3\u7b54\u9898',
                    grade: '\u9ad8\u4e00',
                    diff: '\u4e2d\u7b49'
                },
                createdAt: now,
                updatedAt: now
            });
            await db.table('draftImportFiles').put({
                id: value.fileId,
                batchId: value.batchId,
                filename: 'normal-ui-questions.docx',
                fileType: 'docx',
                mimeType: value.mimeType,
                role: 'question',
                roles: ['question'],
                sourceOrder: 1,
                sourceVersion: 1,
                parseStatus: 'pending',
                uploadPath: value.docxDataUrl,
                fileSize: value.docxDataUrl.length,
                size: value.docxDataUrl.length,
                createdAt: now,
                updatedAt: now
            });
        }, {
            batchId: 'normal-ui-docx-identity',
            fileId: 'normal-ui-docx-file',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            docxDataUrl
        });

        // Keep the normal render entry while replacing PDF transport with a
        // deterministic one-page browser fixture. No final draft is seeded.
        const pdfFixtureInstalled = await harness.page.evaluate(() => {
            const fixture = Object.create(window.pdfjsLib);
            Object.defineProperty(fixture, 'getDocument', { value: () => ({
                promise: Promise.resolve({
                    numPages: 1,
                    getPage: async () => ({
                        getViewport: ({ scale }) => ({
                            width: 595 * Number(scale || 1),
                            height: 842 * Number(scale || 1)
                        }),
                        render: () => ({ promise: Promise.resolve() }),
                        cleanup: () => {}
                    })
                })
            }), configurable: true });
            Object.defineProperty(window, 'pdfjsLib', {
                value: fixture,
                configurable: true,
                writable: true
            });
            return window.pdfjsLib === fixture;
        });
        assert.equal(pdfFixtureInstalled, true);

        await callProxy(
            harness.page,
            'runBatchRecognition',
            'normal-ui-docx-identity'
        );

        const stored = await withDb(harness.page, async (db, value) => ({
            batch: await db.table('draftImportBatches').get(value.batchId),
            files: await db.table('draftImportFiles')
                .where('batchId').equals(value.batchId).toArray(),
            drafts: await db.table('draftQuestions')
                .where('batchId').equals(value.batchId).sortBy('order'),
            formalCount: await db.table('questions').count()
        }), { batchId: 'normal-ui-docx-identity' });

        assert.equal(stored.batch.status, 'review', stored.batch.errorMessage || '');
        assert.equal(stored.drafts.length, 6);
        assert.equal(stored.files[0].parseStatus, 'success');
        assert.equal(mockAiCalls, 1);

        const browserMetrics = await harness.page.evaluate(async ({ model }) => {
            const {
                DocxProducerIdentityContract: Contract,
                ProductionDocxVisionSourcePort: VisionPort,
                ProductionImportBridge: Bridge
            } = window.Qisi;
            const legacy = await new window.Dexie('QisiMathVueDB').open()
                .then(async db => {
                    try {
                        return await db.table('draftQuestions')
                            .where('batchId').equals('normal-ui-docx-identity')
                            .first();
                    } finally {
                        db.close();
                    }
                });
            const canonical = draft => ({
                questionNumber: draft.questionNumber,
                type: draft.type,
                stem: draft.stem,
                options: draft.options,
                answer: draft.answer,
                solution: draft.solution,
                images: draft.images,
                source: draft.source,
                producer: draft.producer,
                route: draft.route,
                fieldProvenance: draft.fieldProvenance,
                controlledWrite: draft.controlledWrite,
                supportLevel: draft.supportLevel,
                manualReviewRequired: draft.manualReviewRequired,
                canonicalReviewHandoff: draft.canonicalReviewHandoff,
                producerIdentityContractVersion:
                    draft.producerIdentityContractVersion
            });

            const unused = async () => { throw new Error('unused-main-bridge-port'); };
            const required = Object.fromEntries(
                Bridge.REQUIRED_PORTS.map(name => [name, unused])
            );
            const bridge = Bridge.createProductionImportBridge({
                ...required,
                runDocxVisionShadow: input => VisionPort.runDocxVisionShadow(input, {
                    runVisionProducer: async () => ({
                        engine: model,
                        candidates: [{
                            questionNumber: '1',
                            type: '\u89e3\u7b54\u9898',
                            stem: 'Normal UI deterministic mock vision stem 1',
                            options: ['', '', '', ''],
                            answer: '',
                            solution: '',
                            images: [],
                            sourcePage: 1,
                            blockIds: ['page:1:candidate:1']
                        }],
                        controlledWriteDecisions: [{
                            accepted: true,
                            decisionId: `strict-docx:normal-ui-docx-file:1:${model}`,
                            sourceId: 'normal-ui-docx-file',
                            fields: ['questionNumber', 'stem', 'options'],
                            method: 'JSON.parse',
                            engine: model
                        }]
                    })
                })
            });
            const shadow = await bridge.runDocxVisionShadow({
                source: {
                    id: 'normal-ui-docx-file',
                    sourceId: 'normal-ui-docx-file',
                    fileType: 'docx',
                    filename: 'normal-ui-questions.docx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    sourceOrder: 1
                }
            });

            const text = [legacy.stem, ...(legacy.options || []),
                legacy.answer, legacy.solution].join('\n');
            return {
                normalUiEntry: 'AppProxy.runBatchRecognition',
                legacyRouteSource: legacy.sourceTrace?.source,
                legacySourceFormat: legacy.source?.format,
                legacyProducerMode: legacy.producer?.mode,
                transitionCodes: legacy.route?.transitions?.map(item => item.code),
                provenanceKinds: Object.fromEntries(Object.entries(
                    legacy.fieldProvenance || {}
                ).map(([field, item]) => [field, item.kind])),
                controlledWriteEvaluated: legacy.controlledWrite?.evaluated,
                canonicalDifferences: Contract.compareCanonicalDocxCandidates(
                    canonical(legacy), canonical(shadow.drafts[0])
                ),
                bridgeFormalWrites: shadow.formalWrites,
                bridgeReviewWrites: shadow.reviewDraftWrites,
                bridgeRealApiCalled: shadow.realApiCalled,
                wrongAttachment: legacy.source?.sourceId === 'normal-ui-docx-file' &&
                    legacy.source?.format === 'docx' ? 0 : 1,
                rawJsonLeakage: /(?:^|\n)\s*[\[{]\s*"questions"\s*:/i.test(text) ? 1 : 0,
                placeholderLeakage: /\[placeholder\]|\{\{|待补充|PLACEHOLDER/i.test(text) ? 1 : 0
            };
        }, { model: mockModel });

        // Supply the real DOCX to the independent deterministic production entry.
        await harness.page.evaluate(value => {
            document.querySelector('html').dataset.docxFixture = value;
        }, docxDataUrl);
        // Re-run only the deterministic source-port portion now that its source is attached.
        const deterministicMetrics = await harness.page.evaluate(async () => {
            const result = await window.Qisi.ProductionDocxSourcePort.parseDocxSource({
                source: {
                    id: 'deterministic-docx-file',
                    batchId: 'deterministic-docx-batch',
                    fileType: 'docx',
                    filename: 'deterministic-questions.docx',
                    sourceOrder: 1,
                    uploadPath: document.querySelector('html').dataset.docxFixture
                },
                batch: { id: 'deterministic-docx-batch' },
                defaultMeta: { defaultType: '\u89e3\u7b54\u9898' }
            }, {
                importer: window.QisiBatchImporter,
                convertDraft: raw => ({ ...raw, version: 1 }),
                acceptDraft: draft => Boolean(String(draft.stem || '').trim())
            });
            return {
                count: result.drafts.length,
                mode: result.drafts[0]?.producer?.mode,
                format: result.drafts[0]?.source?.format,
                aiProvenance: Object.values(
                    result.drafts[0]?.fieldProvenance || {}
                ).some(item => item.kind === 'controlled-write')
            };
        });

        assert.equal(browserMetrics.normalUiEntry, 'AppProxy.runBatchRecognition');
        assert.equal(browserMetrics.legacyRouteSource,
            'docx-local-convert-pdf-strict-vision');
        assert.equal(browserMetrics.legacySourceFormat, 'docx');
        assert.equal(browserMetrics.legacyProducerMode, 'vision-ai');
        assert.deepEqual(browserMetrics.transitionCodes, [
            'docx-selected',
            'docx-rendered',
            'vision-route-selected',
            'vision-engine-result-produced',
            'controlled-write-evaluated',
            'provenance-projected',
            'review-candidate-built'
        ]);
        assert.equal(browserMetrics.provenanceKinds.questionNumber, 'controlled-write');
        assert.equal(browserMetrics.provenanceKinds.stem, 'controlled-write');
        assert.equal(browserMetrics.provenanceKinds.answer, 'missing');
        assert.equal(browserMetrics.controlledWriteEvaluated, true);
        assert.deepEqual(browserMetrics.canonicalDifferences, []);
        assert.equal(browserMetrics.bridgeFormalWrites, 0);
        assert.equal(browserMetrics.bridgeReviewWrites, 0);
        assert.equal(browserMetrics.bridgeRealApiCalled, false);
        assert.equal(browserMetrics.wrongAttachment, 0);
        assert.equal(browserMetrics.rawJsonLeakage, 0);
        assert.equal(browserMetrics.placeholderLeakage, 0);
        assert.equal(stored.formalCount, 0);
        assert.equal(deterministicMetrics.count, 6);
        assert.equal(deterministicMetrics.mode, 'deterministic-docx');
        assert.equal(deterministicMetrics.format, 'docx');
        assert.equal(deterministicMetrics.aiProvenance, false);
        assert.equal(mockAiCalls, 1, 'deterministic source must not call vision');
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
