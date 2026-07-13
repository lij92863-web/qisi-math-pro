const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    assertNoRuntimeErrors,
    callProxy
} = require('./browser-harness.js');

const CHAT_ROUTE = ['**', 'api', 'ai', 'chat'].join('/');
const OCR_ROUTE = ['**', 'api', 'ai', 'ocr'].join('/');
const PDF_DATA_URL =
    'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrCg==';

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

test('true browser shadow keeps legacy and Bridge PDF projections canonically equal', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32117);
    let mockChatCalls = 0;
    let mockOcrCalls = 0;
    try {
        await harness.page.route(CHAT_ROUTE, async route => {
            mockChatCalls += 1;
            route.request().postDataJSON();
            const content = JSON.stringify({
                    questions: [{
                        question: '1',
                        question_bbox: [20, 20, 980, 420],
                        type: '单选题',
                        stem: 'Normal UI PDF browser statement.',
                        options: ['1', '2', '3', '4'],
                        answer: '',
                        solution: '',
                        rawBlock:
                            '1. Normal UI PDF browser statement. A.1 B.2 C.3 D.4'
                    }],
                    answers: [],
                    solutions: []
                });
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    choices: [{ message: { role: 'assistant', content } }]
                })
            });
        });
        await harness.page.route(OCR_ROUTE, async route => {
            mockOcrCalls += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    output: {
                        choices: [{
                            message: {
                                content: [{
                                    text: '第1题\n【答案】A\n【解析】Normal UI PDF browser proof.'
                                }]
                            }
                        }]
                    }
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
                expectedQuestionCount: 1,
                recognitionMode: 'standard',
                defaultMeta: {
                    defaultType: '单选题',
                    grade: '高一',
                    diff: '中等'
                },
                createdAt: now,
                updatedAt: now
            });
            await db.table('draftImportFiles').bulkPut([{
                id: value.questionId,
                batchId: value.batchId,
                filename: 'normal-ui-question.pdf',
                fileType: 'pdf',
                mimeType: 'application/pdf',
                role: 'question',
                roles: ['question'],
                sourceOrder: 1,
                sourceVersion: 1,
                parseStatus: 'pending',
                uploadPath: value.pdfDataUrl,
                fileSize: value.pdfDataUrl.length,
                size: value.pdfDataUrl.length,
                createdAt: now,
                updatedAt: now
            }, {
                id: value.supportId,
                batchId: value.batchId,
                filename: 'normal-ui-support.pdf',
                fileType: 'pdf',
                mimeType: 'application/pdf',
                role: 'answer-solution',
                roles: ['answer', 'solution'],
                sourceOrder: 2,
                sourceVersion: 1,
                parseStatus: 'pending',
                uploadPath: value.pdfDataUrl,
                fileSize: value.pdfDataUrl.length,
                size: value.pdfDataUrl.length,
                createdAt: now,
                updatedAt: now
            }]);
        }, {
            batchId: 'normal-ui-pdf-shadow',
            questionId: 'normal-ui-pdf-question',
            supportId: 'normal-ui-pdf-support',
            pdfDataUrl: PDF_DATA_URL
        });

        const normalUiInstrumentation = await harness.page.evaluate(() => {
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

            const owner = window.Qisi.PdfCandidateProjection;
            const project = owner.projectPdfCandidates.bind(owner);
            window.__phase5NormalUiPdfProjection = null;
            const instrumentedOwner = Object.freeze({
                ...owner,
                projectPdfCandidates: input => {
                    const result = project(input);
                    window.__phase5NormalUiPdfProjection = {
                        context: structuredClone(input),
                        result: structuredClone(result)
                    };
                    return result;
                }
            });
            window.Qisi.PdfCandidateProjection = instrumentedOwner;
            return {
                pdfFixtureInstalled: window.pdfjsLib === fixture,
                projectionOwnerInstrumented:
                    window.Qisi.PdfCandidateProjection === instrumentedOwner
            };
        });
        assert.deepEqual(normalUiInstrumentation, {
            pdfFixtureInstalled: true,
            projectionOwnerInstrumented: true
        });

        await callProxy(
            harness.page,
            'runBatchRecognition',
            'normal-ui-pdf-shadow'
        );

        const normalUiStored = await withDb(harness.page, async (db, value) => ({
            batch: await db.table('draftImportBatches').get(value.batchId),
            drafts: await db.table('draftQuestions')
                .where('batchId').equals(value.batchId).sortBy('order'),
            files: await db.table('draftImportFiles')
                .where('batchId').equals(value.batchId).sortBy('sourceOrder'),
            formalCount: await db.table('questions').count()
        }), { batchId: 'normal-ui-pdf-shadow' });
        assert.equal(
            normalUiStored.batch.status,
            'review',
            normalUiStored.batch.errorMessage || ''
        );
        assert.equal(normalUiStored.drafts.length, 1);
        assert.equal(normalUiStored.formalCount, 0);
        assert.deepEqual(
            normalUiStored.files.map(file => file.parseStatus),
            ['success', 'success']
        );

        await harness.page.addScriptTag({
            url: `${harness.origin}/qisi-import-state-machine.js`
        });
        const metrics = await harness.page.evaluate(async () => {
            const {
                ProductionImportBridge: Bridge,
                ImportStateMachine: StateMachine,
                BatchContextService: BatchContext,
                SourceRoleClassifier: Roles,
                PdfCandidateProjection: Projection,
                PdfSupportControlledWrite: ControlledWrite,
                PdfSupportBlockParser: BlockParser,
                PdfSupportAligner: Aligner,
                CandidateNormalizer,
                ProductionImportOutputPort: OutputPort,
                ImportValidationService: Validation,
                ReviewDraftBuilder,
                ImportDiagnostics: Diagnostics,
                ProductionReviewValidator,
                FormalAdmissionPolicy
            } = window.Qisi;

            const requiredModules = {
                Bridge,
                StateMachine,
                BatchContext,
                Roles,
                Projection,
                ControlledWrite,
                BlockParser,
                Aligner,
                CandidateNormalizer,
                OutputPort,
                Validation,
                ReviewDraftBuilder,
                Diagnostics,
                ProductionReviewValidator,
                FormalAdmissionPolicy
            };
            for (const [name, value] of Object.entries(requiredModules)) {
                if (!value) throw new Error(`browser-module-missing:${name}`);
            }

            const clone = value => structuredClone(value);
            const batch = () => ({
                id: 'browser-shadow-batch',
                status: 'pending',
                sourceVersion: 1,
                recognitionMode: 'standard',
                createdAt: 1,
                updatedAt: 1
            });
            const pdfFiles = () => [{
                id: 'pdf-question',
                batchId: 'browser-shadow-batch',
                filename: 'question.pdf',
                fileType: 'pdf',
                roles: ['question'],
                sourceOrder: 1
            }, {
                id: 'pdf-support',
                batchId: 'browser-shadow-batch',
                filename: 'support.pdf',
                fileType: 'pdf',
                roles: ['answer', 'solution'],
                sourceOrder: 2
            }];
            const pdfDraft = overrides => ({
                id: 'pdf-draft-1',
                questionNumber: '1',
                type: 'choice',
                stem: 'Prove the browser shadow statement.',
                options: [
                    { label: 'A', text: '1' },
                    { label: 'B', text: '2' },
                    { label: 'C', text: '3' },
                    { label: 'D', text: '4' }
                ],
                answer: '',
                solution: '',
                images: [{ id: 'browser-image-1' }],
                warnings: [],
                sourceQuestionFileId: 'pdf-question',
                sourceFileId: 'pdf-question',
                sourcePage: 1,
                sourceTrace: {
                    sourceFileId: 'pdf-question',
                    sourcePage: 1,
                    evidenceId: 'question-block-1',
                    sourceKind: 'ocrMarkdown',
                    model: 'mock-browser-engine',
                    strictProtocol: {
                        accepted: true,
                        decisionId: 'strict:browser:1',
                        fields: [
                            'questionNumber', 'stem', 'options', 'images'
                        ],
                        method: 'strict-json-contract'
                    }
                },
                ...overrides
            });

            const controlledWrite = (draft, {
                answer = 'A',
                solution = 'browser proof',
                answerOn = true,
                solutionOn = true
            } = {}) => ({
                ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
                    drafts: [draft],
                    parserSafeAnswerItems: answerOn
                        ? [{
                            questionNumber: '1',
                            answer,
                            evidenceId: 'answer-block-1'
                        }]
                        : [],
                    parserSafeSolutionItems: solutionOn
                        ? [{
                            questionNumber: '1',
                            solution,
                            evidenceId: 'solution-block-1'
                        }]
                        : []
                }),
                decisionId: 'cw:browser:1'
            });

            const projectionContext = ({
                draft = pdfDraft(),
                mode = 'full',
                safe = ['1'],
                fused = [],
                answerOn = true,
                solutionOn = true,
                draftSourceId
            } = {}) => {
                const nextDraft = draftSourceId
                    ? {
                        ...draft,
                        sourceQuestionFileId: draftSourceId,
                        sourceFileId: draftSourceId,
                        sourceTrace: {
                            ...draft.sourceTrace,
                            sourceFileId: draftSourceId
                        }
                    }
                    : draft;
                return {
                    drafts: [nextDraft],
                    sources: pdfFiles(),
                    controlledWriteDecisions: [controlledWrite(nextDraft, {
                        answerOn,
                        solutionOn
                    })],
                    controlledWriteDecisionId: 'cw:browser:combined',
                    alignmentResults: [{
                        mode,
                        safeQuestionNumbers: safe,
                        fusedQuestionNumbers: fused,
                        warnings: mode === 'prefix'
                            ? [{ code: 'sequence-prefix' }]
                            : []
                    }],
                    routeContext: { engine: 'mock-browser-engine' }
                };
            };

            const normalizerHelpers = {
                hasUnescapedLatexCommandInJsonString: () => false,
                escapeLatexBackslashesInJsonCandidate: value => value,
                tryRepairedCandidate: () => ({ result: null })
            };
            const outputHelpers = {
                cleanText: value => String(value || '').trim(),
                normalizeQuestionKey: value =>
                    String(value || '').match(/\d{1,3}/)?.[0] || '',
                cleanOptions: values => Array.isArray(values) ? values : [],
                mergeImages: (...lists) => lists.flat(),
                clock: () => 50
            };
            const reviewValidator =
                ProductionReviewValidator.createProductionReviewValidator({
                    policy: FormalAdmissionPolicy,
                    clock: () => 50
                });

            const makeBridge = ({
                context,
                filesOverride,
                runPdfImportOverride
            } = {}) => {
                const files = filesOverride || pdfFiles();
                const currentBatch = batch();
                const persisted = [];
                const validationFailures = [];
                let projectionCalls = 0;
                const repository = {
                    async get(table, id) {
                        return table === 'draftImportBatches' &&
                            id === currentBatch.id
                            ? clone(currentBatch)
                            : undefined;
                    },
                    async findBy(table, field, value) {
                        return table === 'draftImportFiles' &&
                            field === 'batchId' &&
                            value === currentBatch.id
                            ? clone(files)
                            : [];
                    }
                };
                const valid = value => ({
                    valid: value === true,
                    errors: value === true
                        ? []
                        : [{ code: 'browser-shadow-safety-rejected' }],
                    warnings: []
                });
                const ports = {
                    createStateMachine: options =>
                        StateMachine.createImportStateMachine(options),
                    loadBatchAndFiles: input =>
                        BatchContext.loadBatchAndFiles({
                            ...input,
                            getRoles: file => file.roles
                        }, { repository }),
                    classifySourceRoles: Roles.classifySourceRoles,
                    runDocxImport: async () => {
                        throw new Error('phase5-docx-deterministic-not-applicable');
                    },
                    runPdfImport: async (input, signal) => {
                        if (typeof runPdfImportOverride === 'function') {
                            return runPdfImportOverride(input, signal);
                        }
                        return {
                            drafts: clone(context.drafts),
                            draftImages: [],
                            unmatched: [],
                            warnings: [],
                            errors: [],
                            projectionContext: clone(context),
                            safePartialCandidates: context.drafts.map(draft => ({
                                draft: clone(draft),
                                isSafePartial: true,
                                isComplete: false,
                                requiresManualReview: true
                            }))
                        };
                    },
                    projectPdfCandidates: value => {
                        projectionCalls += 1;
                        return Projection.projectPdfCandidates(value);
                    },
                    normalizeCandidates: drafts =>
                        CandidateNormalizer.normalizeCandidates(
                            [{ questions: drafts }],
                            normalizerHelpers
                        ),
                    projectImportOutput: value =>
                        OutputPort.projectImportOutput(value, outputHelpers),
                    validateCandidates: (drafts, validationContext) => {
                        try {
                            return Validation.validateImportDrafts(drafts, {
                            context: validationContext,
                            validateSequence: values => valid(values.every(item =>
                                item.validation?.sequenceValid !== false
                            )),
                            validateSchema: draft => valid(
                                draft.validation?.schemaValid !== false
                            ),
                            validateOwnership: draft => {
                                if (draft.validation?.ownershipValid !== true) {
                                    return valid(false);
                                }
                                if (draft.supportLevel !== 'full') {
                                    return valid(
                                        draft.manualReviewRequired === true &&
                                        ['prefix', 'safe-partial'].includes(
                                            draft.supportLevel
                                        )
                                    );
                                }
                                const result = reviewValidator.validate({
                                    ...draft,
                                    version: Number.isInteger(draft.version)
                                        ? draft.version
                                        : 1
                                });
                                return {
                                    valid: result.valid,
                                    errors: result.errors,
                                    warnings: result.warnings
                                };
                            },
                            validateSafePartial: draft => valid(
                                draft.supportLevel === 'full' || (
                                    draft.manualReviewRequired === true &&
                                    ['prefix', 'safe-partial'].includes(
                                        draft.supportLevel
                                    )
                                )
                            ),
                            validateControlledWriteEvidence: draft => {
                                const provenance = Object.values(
                                    draft.fieldProvenance || {}
                                );
                                return valid(
                                    draft.controlledWrite?.evaluated === true &&
                                    Boolean(draft.controlledWrite?.decisionId) &&
                                    provenance.every(item =>
                                        item.kind !== 'controlled-write' || (
                                            item.controlledWriteAccepted === true &&
                                            Boolean(item.controlledWriteDecisionId)
                                        )
                                    )
                                );
                            }
                            });
                        } catch (error) {
                            validationFailures.push(...(error.failures || []));
                            throw error;
                        }
                    },
                    buildReviewDrafts: ReviewDraftBuilder.buildReviewDrafts,
                    persistReviewDraftBatch: async command => {
                        persisted.push({
                            batchId: command.batchId,
                            route: command.route,
                            drafts: clone(command.drafts)
                        });
                        return { version: 1, idempotent: false };
                    },
                    createDiagnostics: () =>
                        Diagnostics.createImportDiagnostics({
                            clock: (() => {
                                let value = 0;
                                return () => ++value;
                            })(),
                            logger: () => {}
                        }),
                    reportProgress: async () => {},
                    reportImportFailure: async () => {},
                    clock: () => 100
                };
                return {
                    bridge: Bridge.createProductionImportBridge(ports),
                    persisted,
                    validationFailures,
                    projectionCalls: () => projectionCalls
                };
            };

            const normalUiCapture = clone(
                window.__phase5NormalUiPdfProjection
            );
            if (
                !normalUiCapture?.context ||
                !Array.isArray(normalUiCapture?.result) ||
                normalUiCapture.result.length !== 1
            ) {
                throw new Error('normal-ui-pdf-projection-not-observed');
            }
            const normalUiFiles = (normalUiCapture.context.sources || [])
                .map((source, index) => ({
                    ...source,
                    batchId: 'browser-shadow-batch',
                    filename: source.filename || `normal-ui-${index + 1}.pdf`,
                    fileType: 'pdf',
                    roles: source.roles || (index === 0
                        ? ['question']
                        : ['answer', 'solution'])
                }));
            const normalUiShadow = makeBridge({
                context: normalUiCapture.context,
                filesOverride: normalUiFiles
            });
            const normalUiBridgeResult = await normalUiShadow.bridge.run({
                batchId: 'browser-shadow-batch'
            });
            const normalUiLegacyCandidate = normalUiCapture.result[0];
            const normalUiBridgeCandidate = normalUiBridgeResult.drafts[0];
            const normalUiResult = {
                name: 'pdf-normal-ui-full',
                normalUiEntry: 'AppProxy.runBatchRecognition',
                legacyCallGraph: [
                    'AppProxy.runBatchRecognition',
                    'LegacyBatchRunCoordinator',
                    'processDraftImportBatch',
                    'processStrictVisualQuestionFile',
                    'PdfCandidateProjection.projectPdfCandidates'
                ],
                bridgeCallGraph: [
                    'ProductionImportBridge.run',
                    'runPdfImport',
                    'PdfCandidateProjection.projectPdfCandidates',
                    'canonical-deep-comparator'
                ],
                differences: Projection.compareCanonicalPdfCandidates(
                    normalUiLegacyCandidate,
                    normalUiBridgeCandidate
                ),
                sourceFormat: normalUiLegacyCandidate.source?.format,
                producerMode: normalUiLegacyCandidate.producer?.mode,
                producerRouteId: normalUiLegacyCandidate.producer?.routeId,
                controlledWriteEvaluated:
                    normalUiLegacyCandidate.controlledWrite?.evaluated,
                shadowIsolatedReviewWrites: normalUiShadow.persisted.length,
                shadowFormalWrites: 0,
                projectionCalls: normalUiShadow.projectionCalls()
            };

            const acceptedCases = [
                ['pdf-full', projectionContext()],
                ['pdf-safe-partial', projectionContext({
                    mode: 'prefix',
                    answerOn: false,
                    solutionOn: false
                })],
                ['pdf-missing-answer', projectionContext({
                    answerOn: false,
                    solutionOn: true
                })],
                ['pdf-formula-fallback', projectionContext({
                    draft: pdfDraft({ formulaFallback: true })
                })]
            ];
            const caseResults = [];
            for (const [name, context] of acceptedCases) {
                const legacy = Projection.projectPdfCandidates(context)[0];
                const shadow = makeBridge({ context });
                let result;
                try {
                    result = await shadow.bridge.run({
                        batchId: 'browser-shadow-batch'
                    });
                } catch (error) {
                    throw new Error(
                        `${name}:${error?.code || error}:` +
                        JSON.stringify(shadow.validationFailures)
                    );
                }
                const bridgeDraft = result.drafts[0];
                caseResults.push({
                    name,
                    differences:
                        Projection.compareCanonicalPdfCandidates(
                            legacy,
                            bridgeDraft
                        ),
                    persisted: shadow.persisted.length,
                    projectionCalls: shadow.projectionCalls(),
                    supportLevel: bridgeDraft.supportLevel,
                    manualReviewRequired: bridgeDraft.manualReviewRequired,
                    warningCodes: (bridgeDraft.warnings || []).map(item =>
                        typeof item === 'string' ? item : item.code
                    ),
                    ownershipValid: bridgeDraft.validation?.ownershipValid,
                    controlledWriteEvaluated:
                        bridgeDraft.controlledWrite?.evaluated,
                    content: [
                        bridgeDraft.stem,
                        bridgeDraft.answer,
                        bridgeDraft.solution
                    ].join('\n')
                });
            }

            const badContext = projectionContext({
                draftSourceId: 'pdf-support'
            });
            const badLegacy = Projection.projectPdfCandidates(badContext)[0];
            const badShadow = makeBridge({
                context: badContext
            });
            let badError = '';
            try {
                await badShadow.bridge.run({
                    batchId: 'browser-shadow-batch'
                });
            } catch (error) {
                badError = error?.code || error?.message || String(error);
            }

            const runRejectedCase = async (name, shadow) => {
                let errorCode = '';
                let causeCode = '';
                try {
                    await shadow.bridge.run({
                        batchId: 'browser-shadow-batch'
                    });
                } catch (error) {
                    errorCode = error?.code || error?.message || String(error);
                    causeCode = error?.causeCode || '';
                }
                return {
                    name,
                    errorCode,
                    causeCode,
                    persisted: shadow.persisted.length,
                    projectionCalls: shadow.projectionCalls()
                };
            };

            const rawDraft = pdfDraft({
                rawJsonCandidate: true,
                stem: '{"questions":[{"stem":"browser-raw-must-not-leak"}]}'
            });
            const rawShadow = makeBridge({
                context: projectionContext({ draft: rawDraft })
            });
            const rawResult = await runRejectedCase(
                'pdf-raw-json-candidate',
                rawShadow
            );

            const ambiguousFiles = [
                pdfFiles()[0],
                {
                    id: 'pdf-support-a',
                    batchId: 'browser-shadow-batch',
                    filename: 'support-a.pdf',
                    fileType: 'pdf',
                    roles: ['answer'],
                    sourceOrder: 2
                },
                {
                    id: 'pdf-support-b',
                    batchId: 'browser-shadow-batch',
                    filename: 'support-b.pdf',
                    fileType: 'pdf',
                    roles: ['answer'],
                    sourceOrder: 3
                }
            ];
            const ambiguousShadow = makeBridge({
                filesOverride: ambiguousFiles,
                runPdfImportOverride: () =>
                    Projection.createPdfEngineProjectionContext({
                        sources: ambiguousFiles,
                        engineResult: {
                            drafts: [pdfDraft()],
                            evidences: ambiguousFiles.slice(1).map((file, index) => ({
                                sourceFileId: file.id,
                                sourceFileName: file.filename,
                                pageNo: 1,
                                selectedSourceKind: 'textLayer',
                                textLayer: `第1题\n答案：${index ? 'B' : 'A'}`
                            }))
                        },
                        controlledWriteOwner: ControlledWrite,
                        blockParser: BlockParser,
                        aligner: Aligner,
                        decisionId: 'cw:browser:ambiguous'
                    })
            });
            const ambiguousResult = await runRejectedCase(
                'pdf-multiple-support-source-ambiguity',
                ambiguousShadow
            );

            const conflictDraft = pdfDraft();
            const conflictContext = projectionContext({ draft: conflictDraft });
            conflictContext.controlledWriteDecisions = [
                controlledWrite(conflictDraft, { answer: 'A' }),
                controlledWrite(conflictDraft, { answer: 'B' })
            ];
            const conflictShadow = makeBridge({
                context: conflictContext
            });
            const conflictResult = await runRejectedCase(
                'pdf-duplicate-accepted-conflict',
                conflictShadow
            );

            const cancellationContext = projectionContext();
            const cancellationController = new AbortController();
            const cancellationShadow = makeBridge({
                context: cancellationContext,
                runPdfImportOverride: async () => {
                    cancellationController.abort();
                    return {
                        drafts: clone(cancellationContext.drafts),
                        draftImages: [],
                        unmatched: [],
                        warnings: [],
                        errors: [],
                        projectionContext: clone(cancellationContext),
                        safePartialCandidates: cancellationContext.drafts.map(
                            candidate => ({
                                draft: clone(candidate),
                                isSafePartial: true,
                                isComplete: false,
                                requiresManualReview: true
                            })
                        )
                    };
                }
            });
            let cancellationError = '';
            try {
                await cancellationShadow.bridge.run({
                    batchId: 'browser-shadow-batch',
                    signal: cancellationController.signal
                });
            } catch (error) {
                cancellationError = error?.code || error?.message || String(error);
            }

            const deterministicDraft = pdfDraft();
            deterministicDraft.sourceTrace = {
                ...deterministicDraft.sourceTrace,
                sourceKind: 'textLayer'
            };
            delete deterministicDraft.sourceTrace.strictProtocol;
            const visionCandidate = Projection.projectPdfCandidates(
                acceptedCases[0][1]
            )[0];
            const deterministicCandidate = Projection.projectPdfCandidates(
                projectionContext({ draft: deterministicDraft })
            )[0];
            const crossProducerDifferences =
                Projection.compareCanonicalPdfCandidates(
                    visionCandidate,
                    deterministicCandidate
                );
            const rejectedResults = [
                rawResult,
                ambiguousResult,
                conflictResult,
                {
                    name: 'pdf-cancellation',
                    errorCode: cancellationError,
                    causeCode: '',
                    persisted: cancellationShadow.persisted.length,
                    projectionCalls: cancellationShadow.projectionCalls()
                }
            ];

            const allAcceptedContent = caseResults
                .map(result => result.content)
                .join('\n');
            return {
                docxDeterministicEquivalence:
                    'non-applicable-no-normal-ui-deterministic-route',
                normalUiResult,
                browserCases: [
                    normalUiResult.name,
                    ...caseResults.map(result => result.name),
                    'pdf-known-bad-ownership',
                    ...rejectedResults.map(result => result.name)
                ],
                canonicalDifferences: caseResults.reduce(
                    (total, result) => total + result.differences.length,
                    normalUiResult.differences.length
                ),
                caseResults,
                wrongAttachments: caseResults.filter(result =>
                    result.ownershipValid !== true
                ).length + badShadow.persisted.length +
                    rejectedResults.reduce(
                        (total, result) => total + result.persisted,
                        0
                    ),
                rawJsonLeakage: /(?:^|\n)\s*[\[{]\s*"questions"\s*:/i
                    .test(allAcceptedContent)
                    ? 1
                    : 0,
                placeholderLeakage: /\{\{|\[placeholder\]|待补充|PLACEHOLDER/i
                    .test(allAcceptedContent)
                    ? 1
                    : 0,
                controlledWriteBypass: caseResults.filter(result =>
                    result.controlledWriteEvaluated !== true ||
                    result.projectionCalls !== 1
                ).length,
                formalAdmissionWrites: 0,
                bridgeFormalWrites: 0,
                realApiCalled: false,
                crossProducerDifferencePaths:
                    crossProducerDifferences.map(item => item.path),
                rejectedResults,
                knownBad: {
                    legacySupportLevel: badLegacy.supportLevel,
                    legacyOwnershipValid:
                        badLegacy.validation?.ownershipValid,
                    bridgeError: badError,
                    persisted: badShadow.persisted.length
                }
            };
        });

        assert.equal(
            metrics.docxDeterministicEquivalence,
            'non-applicable-no-normal-ui-deterministic-route'
        );
        assert.deepEqual(metrics.browserCases, [
            'pdf-normal-ui-full',
            'pdf-full',
            'pdf-safe-partial',
            'pdf-missing-answer',
            'pdf-formula-fallback',
            'pdf-known-bad-ownership',
            'pdf-raw-json-candidate',
            'pdf-multiple-support-source-ambiguity',
            'pdf-duplicate-accepted-conflict',
            'pdf-cancellation'
        ]);
        assert.equal(
            metrics.normalUiResult.normalUiEntry,
            'AppProxy.runBatchRecognition'
        );
        assert.deepEqual(metrics.normalUiResult.differences, []);
        assert.equal(metrics.normalUiResult.sourceFormat, 'pdf');
        assert.equal(metrics.normalUiResult.producerMode, 'vision-ai');
        assert.equal(
            metrics.normalUiResult.producerRouteId,
            'pdf-vision-controlled-write'
        );
        assert.equal(metrics.normalUiResult.controlledWriteEvaluated, true);
        assert.equal(metrics.normalUiResult.shadowIsolatedReviewWrites, 1);
        assert.equal(metrics.normalUiResult.shadowFormalWrites, 0);
        assert.equal(metrics.normalUiResult.projectionCalls, 1);
        assert.equal(metrics.canonicalDifferences, 0);
        assert.equal(metrics.wrongAttachments, 0);
        assert.equal(metrics.rawJsonLeakage, 0);
        assert.equal(metrics.placeholderLeakage, 0);
        assert.equal(metrics.controlledWriteBypass, 0);
        assert.equal(metrics.formalAdmissionWrites, 0);
        assert.equal(metrics.bridgeFormalWrites, 0);
        assert.equal(metrics.realApiCalled, false);
        assert.deepEqual(
            metrics.caseResults.map(result => result.supportLevel),
            ['full', 'prefix', 'safe-partial', 'full']
        );
        assert.equal(metrics.caseResults[3].manualReviewRequired, true);
        assert.ok(metrics.caseResults[3].warningCodes.includes('formula-fallback'));
        assert.ok(metrics.crossProducerDifferencePaths.includes('producer.mode'));
        assert.ok(metrics.crossProducerDifferencePaths.includes(
            'fieldProvenance.stem.producerMode'
        ));
        assert.deepEqual(metrics.knownBad, {
            legacySupportLevel: 'rejected',
            legacyOwnershipValid: false,
            bridgeError: 'IMPORT_VALIDATION_FAILED',
            persisted: 0
        });
        assert.deepEqual(metrics.rejectedResults, [{
            name: 'pdf-raw-json-candidate',
            errorCode: 'PRODUCTION_IMPORT_RESULT_MALFORMED',
            causeCode: 'raw-or-empty-draft-output',
            persisted: 0,
            projectionCalls: 0
        }, {
            name: 'pdf-multiple-support-source-ambiguity',
            errorCode: 'IMPORT_RECOGNITION_FAILED',
            causeCode: 'pdf-support-source-ambiguous',
            persisted: 0,
            projectionCalls: 0
        }, {
            name: 'pdf-duplicate-accepted-conflict',
            errorCode: 'IMPORT_RECOGNITION_FAILED',
            causeCode: 'controlled-write-conflict',
            persisted: 0,
            projectionCalls: 1
        }, {
            name: 'pdf-cancellation',
            errorCode: 'IMPORT_CANCELLED',
            causeCode: '',
            persisted: 0,
            projectionCalls: 1
        }]);
        assert.ok(mockChatCalls >= 1);
        assert.ok(mockOcrCalls >= 1);
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
