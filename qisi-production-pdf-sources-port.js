(function initProductionPdfSourcesPort(root) {
    'use strict';

    function createError(code, name = 'Error') {
        const error = new Error(code);
        error.name = name;
        error.code = code;
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('PDF_SOURCES_ABORTED', 'AbortError');
    }

    async function processPdfSources(input = {}, ports = {}) {
        const batch = input.batch;
        const sources = Array.isArray(input.sources) ? input.sources : [];
        const sourceIds = sources.map(source => String(source?.id || '').trim());
        if (
            !batch || !String(batch.id || '').trim() || sources.length === 0 ||
            sourceIds.some(id => !id) || new Set(sourceIds).size !== sources.length ||
            sources.some(source =>
                String(source?.fileType || '').toLowerCase() !== 'pdf' ||
                (source.batchId && String(source.batchId) !== String(batch.id))
            )
        ) throw createError('PDF_SOURCES_INVALID');
        if (
            typeof ports.produceEngineResult !== 'function' &&
            typeof ports.engine?.processBatchV2 !== 'function'
        ) {
            throw createError('PDF_SOURCES_PORT_REQUIRED');
        }
        if (typeof ports.buildProjectionContext !== 'function') {
            throw createError('PDF_SOURCES_PROJECTION_PORT_REQUIRED');
        }

        assertActive(input.signal);
        const result = typeof ports.produceEngineResult === 'function'
            ? await ports.produceEngineResult({
                batch,
                sources,
                helpers: input.helpers || {},
                signal: input.signal,
                onPageProgress: input.onPageProgress
            })
            : await ports.engine.processBatchV2({
                batch,
                files: sources,
                helpers: {
                    ...(input.helpers || {}),
                    deferPdfCandidateProjection: true,
                    pdfSignal: input.signal,
                    onPdfPageProgress: input.onPageProgress
                }
            });
        assertActive(input.signal);
        if (!result || typeof result !== 'object' || !Array.isArray(result.drafts)) {
            return result;
        }
        const projectionContext = ports.buildProjectionContext({
            sources,
            engineResult: result,
            batch
        });
        if (!projectionContext || typeof projectionContext !== 'object') {
            throw createError('PDF_SOURCES_PROJECTION_CONTEXT_INVALID');
        }
        return { ...result, projectionContext };
    }

    function createProductionImportRunner(ports = {}) {
        if (
            typeof ports.coordinator?.runPdfImport !== 'function' ||
            typeof ports.hasQuestionRole !== 'function' ||
            typeof ports.isFullRole !== 'function' ||
            typeof ports.hasAnswerRole !== 'function' ||
            typeof ports.hasSolutionRole !== 'function' ||
            typeof ports.getRoles !== 'function' ||
            typeof ports.normalizeQuestionNumber !== 'function' ||
            typeof ports.getEngineHelpers !== 'function' ||
            typeof ports.processQuestionSource !== 'function' ||
            typeof ports.prepareSupportPages !== 'function' ||
            typeof ports.processSupportPages !== 'function' ||
            typeof ports.buildProjectionContext !== 'function' ||
            typeof ports.safePartialPipeline?.normalizePdfPipelineResult !== 'function'
        ) throw createError('PDF_PRODUCTION_PORT_REQUIRED');

        return function runProductionPdfImport(context = {}, signal) {
            return ports.coordinator.runPdfImport({
                batchId: context.batchId,
                batch: context.batch,
                sources: context.sources
            }, {
                processSources: ({ sources, onPageProgress }) =>
                    processPdfSources({
                        batch: context.batch,
                        sources,
                        helpers: ports.getEngineHelpers(),
                        signal,
                        onPageProgress
                    }, {
                        produceEngineResult: async ({
                            batch,
                            sources: orderedSources,
                            signal: pdfSignal,
                            onPageProgress: reportPage
                        }) => {
                            const questionSources = orderedSources.filter(source =>
                                ports.hasQuestionRole(source) ||
                                ports.isFullRole(source)
                            );
                            const supportSources = orderedSources.filter(source =>
                                ports.hasAnswerRole(source) ||
                                ports.hasSolutionRole(source) ||
                                ports.isFullRole(source)
                            );
                            if (!questionSources.length) {
                                throw createError('PDF_QUESTION_SOURCE_REQUIRED');
                            }
                            const drafts = [];
                            const evidences = [];
                            const warnings = [];
                            for (const source of questionSources) {
                                if (pdfSignal?.aborted) {
                                    throw createError(
                                        'PDF_COORDINATOR_ABORTED',
                                        'AbortError'
                                    );
                                }
                                const result = await ports.processQuestionSource({
                                    source,
                                    batch,
                                    expectedQuestionCount:
                                        batch.expectedQuestionCount || 0,
                                    onPageProgress: async (_ratio, info = {}) =>
                                        reportPage?.({
                                            sourceId: source.id,
                                            pageNo: info.done || info.pageNo || 1,
                                            totalPages: info.total || 1
                                        }),
                                    signal: pdfSignal
                                });
                                if (result?.check?.fatal) {
                                    throw createError('PDF_STRICT_QUESTION_FATAL');
                                }
                                drafts.push(...(result?.questions || []));
                                warnings.push(...(
                                    result?.check?.warningReasons || []
                                ));
                            }
                            const expectedQuestionNumbers = drafts
                                .map(draft => ports.normalizeQuestionNumber(
                                    draft.questionNumber || draft.question
                                ))
                                .filter(Boolean);
                            for (const source of supportSources) {
                                const pages = await ports.prepareSupportPages({
                                    source,
                                    signal: pdfSignal
                                });
                                const support = await ports.processSupportPages({
                                    source,
                                    pages,
                                    strict: true,
                                    expectedQuestionNumbers,
                                    requiredKinds: {
                                        answers: ports.hasAnswerRole(source) ||
                                            ports.isFullRole(source),
                                        solutions: ports.hasSolutionRole(source) ||
                                            ports.isFullRole(source)
                                    },
                                    onPageProgress: async (_ratio, info = {}) =>
                                        reportPage?.({
                                            sourceId: source.id,
                                            pageNo: info.done || info.pageNo || 1,
                                            totalPages:
                                                info.total || pages.length || 1
                                        }),
                                    signal: pdfSignal
                                });
                                (support?.rawTextPages || []).forEach((text, index) => {
                                    evidences.push({
                                        id: `pdf-support:${source.id}:${index + 1}`,
                                        sourceFileId: source.id,
                                        sourceFileName: source.filename || '',
                                        pageNo: index + 1,
                                        roles: ports.getRoles(source),
                                        selectedSourceKind: 'ocrMarkdown',
                                        ocrMarkdown: text
                                    });
                                });
                            }
                            return {
                                drafts,
                                evidences,
                                draftImages: [],
                                unmatched: [],
                                warnings,
                                errors: [],
                                realApiCalled: true
                            };
                        },
                        buildProjectionContext: projectionInput =>
                            ports.buildProjectionContext({
                                ...projectionInput,
                                batchId: context.batchId
                            })
                    }),
                createSafePartial: (draft, evidence) => ({
                    ...ports.safePartialPipeline.normalizePdfPipelineResult({
                        answerQuestionNumbers: [],
                        warnings: evidence.warnings
                    }),
                    draft
                })
            }, signal);
        };
    }

    const api = Object.freeze({ processPdfSources, createProductionImportRunner });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionPdfSourcesPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
