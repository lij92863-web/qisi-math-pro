(function initProductionImportBridge(root) {
    'use strict';

    const REQUIRED_PORTS = Object.freeze([
        'createStateMachine',
        'loadBatchAndFiles',
        'classifySourceRoles',
        'runDocxImport',
        'runPdfImport',
        'projectPdfCandidates',
        'normalizeCandidates',
        'projectImportOutput',
        'validateCandidates',
        'buildReviewDrafts',
        'persistReviewDraftBatch',
        'createDiagnostics',
        'reportProgress',
        'reportImportFailure'
    ]);

    class ProductionImportBridgeError extends Error {
        constructor(code, details = {}) {
            super(code);
            this.name = 'ProductionImportBridgeError';
            this.code = code;
            this.stage = 'production-import-bridge';
            if (details.causeCode) this.causeCode = details.causeCode;
            if (details.port) this.port = details.port;
        }
    }

    function safeCode(value, fallback = 'PRODUCTION_IMPORT_FAILED') {
        const code = String(value || '').trim();
        return /^[a-zA-Z0-9_.:-]{1,80}$/.test(code) ? code : fallback;
    }

    function createError(code, details = {}) {
        return new ProductionImportBridgeError(code, {
            causeCode: details.causeCode
                ? safeCode(details.causeCode)
                : '',
            port: details.port ? safeCode(details.port, 'unknown-port') : ''
        });
    }

    function assertPorts(ports) {
        for (const name of REQUIRED_PORTS) {
            if (typeof ports?.[name] !== 'function') {
                throw createError('PRODUCTION_IMPORT_PORT_REQUIRED', {
                    port: name
                });
            }
        }
    }

    function assertDiagnostics(diagnostics) {
        if (
            !diagnostics ||
            ['start', 'record', 'fail', 'snapshot'].some(
                name => typeof diagnostics[name] !== 'function'
            )
        ) {
            throw createError('PRODUCTION_IMPORT_PORT_REQUIRED', {
                port: 'createDiagnostics'
            });
        }
    }

    function assertActive(signal) {
        if (!signal?.aborted) return;
        const error = createError('IMPORT_CANCELLED');
        error.name = 'AbortError';
        throw error;
    }

    function isRecord(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }

    function sourceRoute(loaded, classification) {
        if (
            !isRecord(classification) ||
            !Array.isArray(classification.sources) ||
            !Array.isArray(loaded.files)
        ) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'source-classification-malformed'
            });
        }
        const fileById = new Map(
            loaded.files.map(file => [String(file?.id || ''), file])
        );
        const active = classification.sources.filter(
            source => source?.isSupplementalImage !== true
        );
        if (!active.length || !active.some(source => source?.isQuestion === true)) {
            throw createError('PRODUCTION_IMPORT_SOURCE_UNSUPPORTED', {
                causeCode: 'question-source-required'
            });
        }
        const types = new Set(active.map(source => String(source?.fileType || '')));
        if (
            types.size !== 1 ||
            !['docx', 'pdf'].includes([...types][0])
        ) {
            throw createError('PRODUCTION_IMPORT_SOURCE_UNSUPPORTED', {
                causeCode: 'mixed-or-unsupported-source'
            });
        }
        const sources = active.map(source => {
            const file = fileById.get(String(source.id));
            if (!file) {
                throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                    causeCode: 'classified-source-missing'
                });
            }
            return {
                ...file,
                fileType: source.fileType,
                roles: [...source.roles],
                sourceOrder: source.sourceOrder
            };
        });
        const supplementalSources = classification.sources
            .filter(source => source?.isSupplementalImage === true)
            .map(source => fileById.get(String(source.id)))
            .filter(Boolean);
        return {
            route: [...types][0],
            sources,
            supplementalSources
        };
    }

    function sourceDrafts(route, result) {
        if (!isRecord(result) || !Array.isArray(result.drafts)) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'source-result-malformed'
            });
        }
        let drafts = result.drafts;
        if (route === 'pdf') {
            const safe = result.safePartialCandidates;
            if (
                !Array.isArray(safe) ||
                safe.length !== result.drafts.length ||
                safe.some(candidate =>
                    !isRecord(candidate) ||
                    candidate.isSafePartial !== true ||
                    candidate.isComplete !== false ||
                    !isRecord(candidate.draft)
                )
            ) {
                throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                    causeCode: 'pdf-safe-partial-malformed'
                });
            }
            drafts = safe.map(candidate => candidate.draft);
        }
        if (
            !drafts.length ||
            drafts.some(draft => !isRecord(draft) || draft.rawJsonCandidate === true)
        ) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'raw-or-empty-draft-output'
            });
        }
        return drafts;
    }

    function normalizedDrafts(value, expectedCount) {
        const drafts = Array.isArray(value)
            ? value
            : value?.ok === true && Array.isArray(value.questions)
                ? value.questions
                : null;
        if (
            !drafts || drafts.length !== expectedCount ||
            drafts.some(draft => !isRecord(draft))
        ) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'normalized-result-malformed'
            });
        }
        return drafts;
    }

    function projectedOutput(value) {
        if (
            !isRecord(value) ||
            !Array.isArray(value.drafts) ||
            !value.drafts.length ||
            !Array.isArray(value.draftImages)
        ) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'output-projection-malformed'
            });
        }
        return value;
    }

    function sameLengthDrafts(value, expected, causeCode) {
        if (
            !Array.isArray(value) ||
            value.length !== expected.length ||
            value.some(draft => !isRecord(draft))
        ) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode
            });
        }
        return value;
    }

    function normalizedFailure(error, activeCause, machine, externalSignal) {
        if (
            externalSignal?.aborted ||
            machine?.snapshot?.().state === 'CANCELLED' ||
            error?.code === 'IMPORT_CANCELLED' ||
            activeCause?.name === 'AbortError' ||
            /ABORTED|CANCELLED/.test(String(activeCause?.code || ''))
        ) {
            return createError('IMPORT_CANCELLED');
        }
        if (
            activeCause instanceof ProductionImportBridgeError &&
            activeCause.code.startsWith('PRODUCTION_IMPORT_')
        ) {
            return createError(activeCause.code, {
                causeCode: activeCause.causeCode
            });
        }
        const code = String(error?.code || '').startsWith('IMPORT_')
            ? safeCode(error.code)
            : 'PRODUCTION_IMPORT_FAILED';
        return createError(code, {
            causeCode: activeCause?.code || error?.code || error?.name
        });
    }

    function createProductionImportBridge(ports = {}) {
        assertPorts(ports);
        const clock = typeof ports.clock === 'function' ? ports.clock : Date.now;

        async function run(input = {}) {
            const batchId = String(input.batchId || '').trim();
            if (!batchId) throw createError('PRODUCTION_IMPORT_INPUT_INVALID');
            const externalSignal = input.signal;
            const diagnostics = ports.createDiagnostics();
            assertDiagnostics(diagnostics);
            diagnostics.start({
                requestId: `production-import:${batchId}:${clock()}`,
                batchId,
                stage: 'started'
            });

            const data = {
                loaded: null,
                classification: null,
                route: '',
                sources: [],
                supplementalSources: [],
                sourceResult: null,
                normalized: null,
                projected: null,
                validated: null,
                reviewDrafts: null,
                persistence: null
            };
            let activeCause = null;
            let machine = null;
            let abortListener = null;

            const command = work => async context => {
                try {
                    return await work(context);
                } catch (error) {
                    activeCause = error;
                    throw error;
                }
            };

            const commands = {
                start: command(async ({ signal }) => {
                    assertActive(externalSignal);
                    data.loaded = await ports.loadBatchAndFiles({
                        batchId,
                        signal,
                        expectedSourceVersion: input.expectedSourceVersion
                    });
                    if (
                        !isRecord(data.loaded) ||
                        !isRecord(data.loaded.batch) ||
                        !Array.isArray(data.loaded.files) ||
                        !isRecord(data.loaded.batchContext)
                    ) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'batch-context-malformed'
                        });
                    }
                }),
                prepared: command(async () => {
                    data.classification = await ports.classifySourceRoles(
                        data.loaded.batchContext.sourceManifest
                    );
                    const selected = sourceRoute(data.loaded, data.classification);
                    data.route = selected.route;
                    data.sources = selected.sources;
                    data.supplementalSources = selected.supplementalSources;
                    diagnostics.record({
                        stage: 'context-loaded',
                        counts: { files: data.loaded.files.length }
                    });
                }),
                'deterministic-source-loaded': command(async ({ signal }) => {
                    data.sourceResult = await ports.runDocxImport({
                        batchId,
                        batch: data.loaded.batch,
                        batchContext: data.loaded.batchContext,
                        sources: data.sources,
                        supplementalSources: data.supplementalSources
                    }, signal);
                    const drafts = sourceDrafts('docx', data.sourceResult);
                    diagnostics.record({
                        stage: 'candidates-produced',
                        engine: 'docx',
                        counts: { candidates: drafts.length }
                    });
                }),
                'recognition-source-loaded': command(async ({ signal }) => {
                    data.sourceResult = await ports.runPdfImport({
                        batchId,
                        batch: data.loaded.batch,
                        batchContext: data.loaded.batchContext,
                        sources: data.sources,
                        supplementalSources: data.supplementalSources
                    }, signal);
                    sourceDrafts('pdf', data.sourceResult);
                    const projectionContext = data.sourceResult?.projectionContext;
                    if (!isRecord(projectionContext)) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'pdf-projection-input-missing'
                        });
                    }
                    const projectedDrafts = sameLengthDrafts(
                        await ports.projectPdfCandidates(projectionContext, {
                            batchId,
                            batch: data.loaded.batch,
                            batchContext: data.loaded.batchContext,
                            sources: data.sources,
                            signal
                        }),
                        data.sourceResult.drafts,
                        'pdf-projection-result-malformed'
                    );
                    data.sourceResult = {
                        ...data.sourceResult,
                        drafts: projectedDrafts,
                        safePartialCandidates: data.sourceResult.safePartialCandidates
                            .map((candidate, index) => ({
                                ...candidate,
                                draft: projectedDrafts[index]
                            }))
                    };
                    const drafts = sourceDrafts('pdf', data.sourceResult);
                    diagnostics.record({
                        stage: 'candidates-produced',
                        engine: 'pdf',
                        counts: { candidates: data.sourceResult.drafts.length }
                    });
                    diagnostics.record({
                        stage: 'prefix-selected',
                        counts: { selected: drafts.length }
                    });
                }),
                normalized: command(async ({ signal }) => {
                    assertActive(signal);
                    const rawDrafts = sourceDrafts(data.route, data.sourceResult);
                    const value = await ports.normalizeCandidates(rawDrafts, {
                        batchId,
                        route: data.route,
                        batchContext: data.loaded.batchContext,
                        signal
                    });
                    data.normalized = normalizedDrafts(value, rawDrafts.length);
                }),
                structured: command(async ({ signal }) => {
                    assertActive(signal);
                    const draftImages = Array.isArray(data.sourceResult?.draftImages)
                        ? data.sourceResult.draftImages
                        : [];
                    data.projected = projectedOutput(
                        await ports.projectImportOutput({
                            drafts: data.normalized.map(draft => ({ ...draft })),
                            draftImages,
                            stage: 'production-bridge-final'
                        }, {
                            batchId,
                            route: data.route,
                            signal
                        })
                    );
                }),
                'validation-complete': command(async ({ signal }) => {
                    assertActive(signal);
                    const value = await ports.validateCandidates(
                        data.projected.drafts,
                        {
                            batchId,
                            batch: data.loaded.batch,
                            files: data.loaded.files,
                            batchContext: data.loaded.batchContext,
                            classification: data.classification,
                            route: data.route,
                            expectedQuestionNumbers:
                                data.sourceResult.expectedQuestionNumbers || [],
                            prefixTruncated:
                                data.sourceResult.prefixTruncated === true,
                            signal
                        }
                    );
                    data.validated = sameLengthDrafts(
                        value,
                        data.projected.drafts,
                        'validation-result-malformed'
                    );
                    diagnostics.record({
                        stage: 'drafts-validated',
                        counts: { validated: data.validated.length }
                    });
                }),
                'review-built': command(async ({ signal }) => {
                    assertActive(signal);
                    const value = await ports.buildReviewDrafts(
                        data.validated,
                        { batchId, now: clock(), route: data.route, signal }
                    );
                    data.reviewDrafts = sameLengthDrafts(
                        value,
                        data.validated,
                        'review-draft-result-malformed'
                    );
                    diagnostics.record({
                        stage: 'review-drafts-built',
                        counts: { drafts: data.reviewDrafts.length }
                    });
                }),
                'draft-transaction-committed': command(async ({ signal }) => {
                    assertActive(signal);
                    data.persistence = await ports.persistReviewDraftBatch({
                        batchId,
                        batch: data.loaded.batch,
                        sourceFiles: data.loaded.files,
                        drafts: data.reviewDrafts,
                        images: data.projected.draftImages,
                        route: data.route,
                        unmatched: Array.isArray(data.sourceResult?.unmatched)
                            ? data.sourceResult.unmatched
                            : [],
                        warnings: Array.isArray(data.sourceResult?.warnings)
                            ? data.sourceResult.warnings
                            : [],
                        batchPatch: {
                            status: 'review',
                            progress: 100,
                            totalCount: data.reviewDrafts.length,
                            reviewedCount: 0,
                            submittedCount: 0,
                            ...(typeof data.sourceResult?.prefixTruncated === 'boolean'
                                ? { prefixTruncated: data.sourceResult.prefixTruncated }
                                : {}),
                            updatedAt: clock(),
                            errorMessage: ''
                        },
                        signal
                    });
                    if (!isRecord(data.persistence)) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'persistence-result-malformed'
                        });
                    }
                    diagnostics.record({
                        stage: 'review-drafts-persisted',
                        counts: { drafts: data.reviewDrafts.length }
                    });
                })
            };

            try {
                assertActive(externalSignal);
                machine = ports.createStateMachine({ commands, clock });
                if (
                    !machine ||
                    typeof machine.transition !== 'function' ||
                    typeof machine.snapshot !== 'function' ||
                    typeof machine.cancel !== 'function'
                ) {
                    throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                        causeCode: 'state-machine-malformed'
                    });
                }
                abortListener = () => {
                    try {
                        machine.cancel();
                    } catch (_error) {
                        // A state without a cancel edge has no cancellable work.
                    }
                };
                externalSignal?.addEventListener('abort', abortListener, { once: true });

                const step = async trigger => {
                    assertActive(externalSignal);
                    const snapshot = await machine.transition(trigger);
                    if (snapshot.state === 'CANCELLED') {
                        throw createError('IMPORT_CANCELLED');
                    }
                    if (snapshot.state !== 'WAITING_CONFIRMATION') {
                        await ports.reportProgress({
                            batchId,
                            progress: snapshot.progress,
                            status: 'processing',
                            signal: externalSignal
                        });
                    }
                    return snapshot;
                };

                await step('start');
                await step('prepared');
                if (data.route === 'docx') {
                    await step('deterministic-source-loaded');
                } else {
                    await step('recognition-source-loaded');
                    await step('recognition-complete');
                }
                await step('normalized');
                await step('structured');
                await step('validation-complete');
                await step('review-built');
                const state = await step('draft-transaction-committed');

                return Object.freeze({
                    schemaVersion: 'qisi.production-import-bridge.r3',
                    batchId,
                    route: data.route,
                    state,
                    drafts: Object.freeze([...data.reviewDrafts]),
                    draftImages: Object.freeze([...data.projected.draftImages]),
                    warnings: Object.freeze([
                        ...(Array.isArray(data.sourceResult?.warnings)
                            ? data.sourceResult.warnings.map(String)
                            : [])
                    ]),
                    persistence: data.persistence,
                    diagnostics: diagnostics.snapshot()
                });
            } catch (error) {
                const failure = normalizedFailure(
                    error,
                    activeCause,
                    machine,
                    externalSignal
                );
                try {
                    diagnostics.fail(failure, {
                        stage: failure.code === 'IMPORT_CANCELLED'
                            ? 'cancelled'
                            : 'failed'
                    });
                } catch (_error) {
                    // The primary import result cannot be changed by diagnostics.
                }
                if (failure.code !== 'IMPORT_CANCELLED') {
                    try {
                        await ports.reportImportFailure({
                            batchId,
                            error: failure,
                            failFiles: true,
                            route: data.route || 'unknown'
                        });
                    } catch (_error) {
                        // Preserve the primary stable import failure.
                    }
                }
                throw failure;
            } finally {
                if (abortListener) {
                    externalSignal?.removeEventListener('abort', abortListener);
                }
            }
        }

        return Object.freeze({ run });
    }

    const api = Object.freeze({
        REQUIRED_PORTS,
        ProductionImportBridgeError,
        createProductionImportBridge
    });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionImportBridge = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
