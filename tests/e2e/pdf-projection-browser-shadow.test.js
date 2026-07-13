const test = require('node:test');
const assert = require('node:assert/strict');

const {
    startBrowserApp,
    assertNoRuntimeErrors
} = require('./browser-harness.js');

test('true browser shadow keeps legacy and Bridge PDF projections canonically equal', {
    timeout: 120000
}, async () => {
    const harness = await startBrowserApp(32117);
    try {
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
            const docxFiles = () => [{
                id: 'docx-question',
                batchId: 'browser-shadow-batch',
                filename: 'question.docx',
                fileType: 'docx',
                roles: ['full'],
                sourceOrder: 1
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

            const makeBridge = ({ route = 'pdf', context, docxDraft } = {}) => {
                const files = route === 'pdf' ? pdfFiles() : docxFiles();
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
                    runDocxImport: async () => ({
                        drafts: [clone(docxDraft)],
                        draftImages: [],
                        warnings: [],
                        errors: []
                    }),
                    runPdfImport: async () => ({
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
                    }),
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
                                if (route !== 'pdf') return valid(true);
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
                            validateSafePartial: draft => route !== 'pdf'
                                ? valid(true)
                                : valid(
                                    draft.supportLevel === 'full' || (
                                        draft.manualReviewRequired === true &&
                                        ['prefix', 'safe-partial'].includes(
                                            draft.supportLevel
                                        )
                                    )
                                ),
                            validateControlledWriteEvidence: draft => {
                                if (route !== 'pdf') return valid(true);
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

            const docxDraft = {
                id: 'docx-draft-1',
                questionNumber: '1',
                type: 'solution',
                stem: 'deterministic DOCX browser fixture',
                options: [],
                answer: '',
                solution: '',
                images: [],
                warnings: [],
                source: {
                    mode: 'docx-deterministic',
                    sourceId: 'docx-question'
                }
            };
            const docxHarness = makeBridge({ route: 'docx', docxDraft });
            const docxResult = await docxHarness.bridge.run({
                batchId: 'browser-shadow-batch'
            });

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
                })]
            ];
            const caseResults = [];
            for (const [name, context] of acceptedCases) {
                const legacy = Projection.projectPdfCandidates(context)[0];
                const shadow = makeBridge({ route: 'pdf', context });
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
                route: 'pdf',
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

            const allAcceptedContent = caseResults
                .map(result => result.content)
                .join('\n');
            return {
                docxUnchanged: docxResult.drafts[0].stem === docxDraft.stem,
                docxProjectionCalls: docxHarness.projectionCalls(),
                browserCases: [
                    'docx-deterministic',
                    ...caseResults.map(result => result.name),
                    'pdf-known-bad-ownership'
                ],
                canonicalDifferences: caseResults.reduce(
                    (total, result) => total + result.differences.length,
                    0
                ),
                caseResults,
                wrongAttachments: caseResults.filter(result =>
                    result.ownershipValid !== true
                ).length + badShadow.persisted.length,
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
                knownBad: {
                    legacySupportLevel: badLegacy.supportLevel,
                    legacyOwnershipValid:
                        badLegacy.validation?.ownershipValid,
                    bridgeError: badError,
                    persisted: badShadow.persisted.length
                }
            };
        });

        assert.equal(metrics.docxUnchanged, true);
        assert.equal(metrics.docxProjectionCalls, 0);
        assert.deepEqual(metrics.browserCases, [
            'docx-deterministic',
            'pdf-full',
            'pdf-safe-partial',
            'pdf-missing-answer',
            'pdf-known-bad-ownership'
        ]);
        assert.equal(metrics.canonicalDifferences, 0);
        assert.equal(metrics.wrongAttachments, 0);
        assert.equal(metrics.rawJsonLeakage, 0);
        assert.equal(metrics.placeholderLeakage, 0);
        assert.equal(metrics.controlledWriteBypass, 0);
        assert.deepEqual(
            metrics.caseResults.map(result => result.supportLevel),
            ['full', 'prefix', 'safe-partial']
        );
        assert.deepEqual(metrics.knownBad, {
            legacySupportLevel: 'rejected',
            legacyOwnershipValid: false,
            bridgeError: 'IMPORT_VALIDATION_FAILED',
            persisted: 0
        });
        assert.equal(harness.forbiddenRequests.length, 0);
        assertNoRuntimeErrors(harness);
    } finally {
        await harness.close();
    }
});
