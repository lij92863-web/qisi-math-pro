(function initProductionImportBridge(root) {
    'use strict';

    const REQUIRED_PORTS = Object.freeze([
        'createStateMachine',
        'loadBatchAndFiles',
        'classifySourceRoles',
        'resolveProductionRoute',
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

    function executionMode(input) {
        const mode = String(input?.mode || '').trim();
        if (!['shadow', 'production'].includes(mode)) {
            throw createError('PRODUCTION_IMPORT_MODE_REQUIRED');
        }
        return mode;
    }

    function requestIdentity(input, mode) {
        const requestId = String(input?.requestId || '').trim();
        if (mode === 'production' && !/^[a-zA-Z0-9_.:-]{1,160}$/.test(requestId)) {
            throw createError('PRODUCTION_IMPORT_REQUEST_ID_REQUIRED');
        }
        return requestId || `shadow:${String(input?.batchId || '')}`;
    }

    function isRecord(value) {
        return Boolean(value && typeof value === 'object' && !Array.isArray(value));
    }

    const FORBIDDEN_INPUTS = Object.freeze([
        'producerRoute',
        'testFixture',
        'fixtureTransport',
        'prebuiltCandidates'
    ]);

    function assertAllowedInput(input) {
        const forbidden = FORBIDDEN_INPUTS.find(name =>
            Object.prototype.hasOwnProperty.call(input || {}, name)
        );
        if (forbidden) {
            throw createError('PRODUCTION_IMPORT_INPUT_FORBIDDEN', {
                causeCode: forbidden
            });
        }
    }

    function selectedSources(loaded, classification, selection) {
        if (!Array.isArray(loaded?.files)) {
            throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                causeCode: 'source-files-malformed'
            });
        }
        const fileById = new Map(loaded.files.map(file => [
            String(file?.id || ''), file
        ]));
        const classifiedById = new Map(classification.sources.map(source => [
            String(source?.id || ''), source
        ]));
        const hydrate = id => {
            const file = fileById.get(String(id));
            const source = classifiedById.get(String(id));
            if (!file || !source) {
                throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                    causeCode: 'selected-source-missing'
                });
            }
            return {
                ...file,
                fileType: source.fileType,
                roles: [...source.roles],
                sourceOrder: source.sourceOrder
            };
        };
        return {
            sources: selection.sourceIds.map(hydrate),
            supplementalSources: selection.supplementalSourceIds.map(hydrate)
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

    function verifiedReadback(value, expectedDrafts, batchId) {
        if (
            !isRecord(value) || !isRecord(value.batch) ||
            String(value.batch.id || '') !== batchId ||
            value.batch.status !== 'review' ||
            !Array.isArray(value.questions) ||
            !Array.isArray(value.files) ||
            !Array.isArray(value.images)
        ) {
            throw createError('PRODUCTION_IMPORT_READBACK_MISMATCH');
        }
        const expectedIds = expectedDrafts.map(draft => String(draft?.id || ''));
        const actualIds = value.questions.map(draft => String(draft?.id || ''));
        if (
            expectedIds.some(id => !id) ||
            actualIds.length !== expectedIds.length ||
            actualIds.some((id, index) => id !== expectedIds[index]) ||
            value.questions.some(draft => String(draft?.batchId || '') !== batchId)
        ) {
            throw createError('PRODUCTION_IMPORT_READBACK_MISMATCH');
        }
        return value;
    }

    function verifiedCommittedReadback(value, loadedBatch, batchId, requestId) {
        if (
            !isRecord(loadedBatch) || loadedBatch.status !== 'review' ||
            loadedBatch.draftPersistence?.idempotencyKey !== requestId ||
            !isRecord(value) || !isRecord(value.batch) ||
            String(value.batch.id || '') !== batchId ||
            value.batch.status !== 'review' ||
            value.batch.draftPersistence?.idempotencyKey !== requestId ||
            !Array.isArray(value.questions) || value.questions.length === 0 ||
            !Array.isArray(value.files) || !Array.isArray(value.images) ||
            value.questions.some(question =>
                String(question?.id || '') === '' ||
                String(question?.batchId || '') !== batchId
            )
        ) throw createError('PRODUCTION_IMPORT_READBACK_MISMATCH');
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
        const primaryCause = activeCause || error;
        if (String(primaryCause?.code || '').startsWith('PRODUCTION_IMPORT_')) {
            return createError(primaryCause.code, {
                causeCode: primaryCause.causeCode
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

        async function runDocxVisionShadow(input = {}) {
            if (typeof ports.runDocxVisionShadow !== 'function') {
                throw createError('PRODUCTION_IMPORT_PORT_REQUIRED', {
                    port: 'runDocxVisionShadow'
                });
            }
            const value = await ports.runDocxVisionShadow({
                ...input,
                shadow: true
            });
            if (
                !isRecord(value) || value.shadow !== true ||
                !Array.isArray(value.drafts) || value.drafts.length === 0 ||
                value.formalWrites !== 0 || value.reviewDraftWrites !== 0 ||
                value.realApiCalled !== false
            ) {
                throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                    causeCode: 'docx-vision-shadow-result-malformed'
                });
            }
            return value;
        }

        async function run(input = {}) {
            assertAllowedInput(input);
            const mode = executionMode(input);
            const batchId = String(input.batchId || '').trim();
            if (!batchId) throw createError('PRODUCTION_IMPORT_INPUT_INVALID');
            const requestId = requestIdentity(input, mode);
            if (mode === 'production' && typeof ports.reloadDraftBatch !== 'function') {
                throw createError('PRODUCTION_IMPORT_PORT_REQUIRED', {
                    port: 'reloadDraftBatch'
                });
            }
            const externalSignal = input.signal;
            const diagnostics = ports.createDiagnostics();
            assertDiagnostics(diagnostics);
            diagnostics.start({
                requestId,
                batchId,
                stage: 'started'
            });

            const data = {
                loaded: null,
                classification: null,
                route: '',
                producerIdentity: '',
                sources: [],
                supplementalSources: [],
                sourceResult: null,
                normalized: null,
                projected: null,
                validated: null,
                reviewDrafts: null,
                persistence: null,
                readback: null,
                persistenceActive: false
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
                    diagnostics.record({
                        stage: 'batch-loaded',
                        counts: { files: data.loaded.files.length }
                    });
                }),
                prepared: command(async () => {
                    data.classification = await ports.classifySourceRoles(
                        data.loaded.batchContext.sourceManifest
                    );
                    diagnostics.record({
                        stage: 'source-classified',
                        counts: { sources: data.classification.sources.length }
                    });
                    const selected = await ports.resolveProductionRoute({
                        batch: data.loaded.batch,
                        batchContext: data.loaded.batchContext,
                        sourceManifest: data.loaded.batchContext.sourceManifest,
                        classification: data.classification,
                        availableCapabilities: {
                            docxDeterministic:
                                typeof ports.runDocxImport === 'function',
                            docxVision:
                                typeof ports.runDocxVisionImport === 'function',
                            pdf: typeof ports.runPdfImport === 'function'
                        }
                    });
                    if (
                        !isRecord(selected) ||
                        !['docx', 'pdf'].includes(selected.route) ||
                        !Array.isArray(selected.sourceIds) ||
                        !Array.isArray(selected.supplementalSourceIds)
                    ) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'route-policy-result-malformed'
                        });
                    }
                    const hydrated = selectedSources(
                        data.loaded,
                        data.classification,
                        selected
                    );
                    data.route = selected.route;
                    data.producerIdentity = selected.producerIdentity;
                    data.sources = hydrated.sources;
                    data.supplementalSources = hydrated.supplementalSources;
                    diagnostics.record({
                        stage: 'producer-selected',
                        engine: data.producerIdentity
                    });
                    diagnostics.record({
                        stage: 'context-loaded',
                        counts: { files: data.loaded.files.length }
                    });
                }),
                'deterministic-source-loaded': command(async ({ signal }) => {
                    diagnostics.record({
                        stage: 'source-producer-entered',
                        engine: data.producerIdentity
                    });
                    diagnostics.record({
                        stage: 'parser-entered',
                        engine: data.producerIdentity
                    });
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
                    diagnostics.record({
                        stage: 'source-producer-entered',
                        engine: data.producerIdentity
                    });
                    if (data.producerIdentity === 'docx-vision') {
                        if (typeof ports.runDocxVisionImport !== 'function') {
                            throw createError('PRODUCTION_IMPORT_PORT_REQUIRED', {
                                port: 'runDocxVisionImport'
                            });
                        }
                        data.sourceResult = await ports.runDocxVisionImport({
                            batchId,
                            batch: data.loaded.batch,
                            batchContext: data.loaded.batchContext,
                            sources: data.sources,
                            supplementalSources: data.supplementalSources,
                            mode,
                            signal
                        }, signal);
                        const drafts = sourceDrafts('docx', data.sourceResult);
                        diagnostics.record({
                            stage: 'parser-entered',
                            engine: data.producerIdentity
                        });
                        diagnostics.record({
                            stage: 'candidates-produced',
                            engine: 'docx-vision',
                            counts: { candidates: drafts.length }
                        });
                        return;
                    }
                    data.sourceResult = await ports.runPdfImport({
                        batchId,
                        batch: data.loaded.batch,
                        batchContext: data.loaded.batchContext,
                        sources: data.sources,
                        supplementalSources: data.supplementalSources
                    }, signal);
                    sourceDrafts('pdf', data.sourceResult);
                    diagnostics.record({
                        stage: 'parser-entered',
                        engine: data.producerIdentity
                    });
                    const projectionContext = data.sourceResult?.projectionContext;
                    if (!isRecord(projectionContext)) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'pdf-projection-input-missing'
                        });
                    }
                    diagnostics.record({
                        stage: 'pdf-projection-entered',
                        engine: data.producerIdentity
                    });
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
                    diagnostics.record({
                        stage: 'controlled-write-evaluated',
                        counts: { candidates: projectedDrafts.length }
                    });
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
                    diagnostics.record({
                        stage: 'candidate-normalized',
                        counts: { candidates: data.normalized.length }
                    });
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
                    diagnostics.record({
                        stage: 'structure-built',
                        counts: { drafts: data.projected.drafts.length }
                    });
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
                    diagnostics.record({
                        stage: 'validation-complete',
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
                    diagnostics.record({
                        stage: 'review-built',
                        counts: { drafts: data.reviewDrafts.length }
                    });
                }),
                'draft-transaction-committed': command(async ({ signal }) => {
                    assertActive(signal);
                    if (mode === 'shadow') return;
                    data.persistenceActive = true;
                    try {
                        data.persistence = await ports.persistReviewDraftBatch({
                            batchId,
                            requestId,
                            idempotencyKey: requestId,
                            expectedVersion: Number.isInteger(
                                data.loaded.batch?.draftPersistence?.version
                            ) ? data.loaded.batch.draftPersistence.version : 0,
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
                    } finally {
                        data.persistenceActive = false;
                    }
                    if (!isRecord(data.persistence)) {
                        throw createError('PRODUCTION_IMPORT_RESULT_MALFORMED', {
                            causeCode: 'persistence-result-malformed'
                        });
                    }
                    diagnostics.record({
                        stage: 'review-drafts-persisted',
                        counts: { drafts: data.reviewDrafts.length }
                    });
                    diagnostics.record({
                        stage: 'draft-persisted',
                        counts: { drafts: data.reviewDrafts.length }
                    });
                    data.readback = verifiedReadback(
                        await ports.reloadDraftBatch(batchId),
                        data.reviewDrafts,
                        batchId
                    );
                    diagnostics.record({
                        stage: 'review-drafts-readback-verified',
                        counts: { drafts: data.readback.questions.length }
                    });
                    diagnostics.record({
                        stage: 'readback-verified',
                        counts: { drafts: data.readback.questions.length }
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
                    if (data.persistenceActive) return;
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
                        if (mode === 'production') await ports.reportProgress({
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
                if (
                    mode === 'production' &&
                    data.loaded.batch.status === 'review' &&
                    data.loaded.batch.draftPersistence?.idempotencyKey ===
                        requestId
                ) {
                    data.readback = verifiedCommittedReadback(
                        await ports.reloadDraftBatch(batchId),
                        data.loaded.batch,
                        batchId,
                        requestId
                    );
                    data.reviewDrafts = data.readback.questions;
                    data.projected = { draftImages: data.readback.images };
                    data.persistence = Object.freeze({
                        idempotent: true,
                        version: data.loaded.batch.draftPersistence.version
                    });
                    diagnostics.record({
                        stage: 'review-drafts-readback-verified',
                        counts: { drafts: data.readback.questions.length }
                    });
                    const state = await step('draft-already-committed');
                    return Object.freeze({
                        schemaVersion: 'qisi.production-import-bridge.r3',
                        mode,
                        requestId,
                        batchId,
                        route: data.route,
                        producerIdentity: data.producerIdentity,
                        state,
                        drafts: Object.freeze([...data.reviewDrafts]),
                        draftImages: Object.freeze([...data.readback.images]),
                        warnings: Object.freeze([]),
                        persistence: data.persistence,
                        readback: data.readback,
                        diagnostics: diagnostics.snapshot()
                    });
                }
                if (data.producerIdentity === 'docx-deterministic') {
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
                    mode,
                    requestId,
                    batchId,
                    route: data.route,
                    producerIdentity: data.producerIdentity,
                    state,
                    drafts: Object.freeze([...data.reviewDrafts]),
                    draftImages: Object.freeze([...data.projected.draftImages]),
                    warnings: Object.freeze([
                        ...(Array.isArray(data.sourceResult?.warnings)
                            ? data.sourceResult.warnings.map(String)
                            : [])
                    ]),
                    persistence: data.persistence,
                    readback: data.readback,
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
                if (mode === 'production') {
                    try {
                        await ports.reportImportFailure({
                            batchId,
                            error: failure,
                            failFiles: failure.code !== 'IMPORT_CANCELLED',
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

        return Object.freeze({ run, runDocxVisionShadow });
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
