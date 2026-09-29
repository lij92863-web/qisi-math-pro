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

    function planFullPdfPageRoles(layouts) {
        if (!Array.isArray(layouts) || layouts.length < 2) return null;
        const pages = [...layouts].sort((a, b) => a.pageNo - b.pageNo);
        const pageNos = pages.map(page => Number(page?.pageNo));
        if (pageNos.some(no => !Number.isInteger(no) || no < 1) ||
            new Set(pageNos).size !== pageNos.length) return null;

        const compact = text => String(text || '').replace(/[\s\u00a0]/g, '');
        const supportHeading = text => {
            const value = compact(text);
            if (value.length > 140) return false;
            const title = '(?:参考答案(?:及解析|与解析)?|答案解析|答案与解析)';
            return new RegExp(`^(?:《[^》]{1,110}》|[^。！？]{1,70}试卷)?${title}[:：]?$`).test(value);
        };
        const blank = page =>
            (page.lines || []).length === 0 &&
            Number.isInteger(page.operatorCount) &&
            page.operatorCount <= 3 &&
            page.annotationCount === 0;
        const headingIndex = pages.findIndex(page =>
            (page.lines || []).some((line, index) =>
                index < 6 && Number(line.ny1) < 240 && supportHeading(line.text)
            )
        );
        if (headingIndex < 1) return null;

        const before = pages.slice(0, headingIndex);
        const hasQuestionEvidence = before.some(page =>
            (page.lines || []).some(line =>
                /^(?:第)?\d{1,3}(?:题)?[.．、:：)）]/.test(compact(line.text))
            )
        );
        if (!hasQuestionEvidence) return null;

        const questionPageNos = before.filter(page => !blank(page)).map(page => page.pageNo);
        const supportPageNos = pages.slice(headingIndex)
            .filter(page => !blank(page)).map(page => page.pageNo);
        if (!questionPageNos.length || !supportPageNos.length) return null;
        return Object.freeze({
            questionPageNos: Object.freeze(questionPageNos),
            supportPageNos: Object.freeze(supportPageNos),
            boundaryPageNo: pages[headingIndex].pageNo
        });
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
                            const pageRolePlans = new Map();
                            const inspectLayout = ports.getEngineHelpers()
                                ?.extractPdfLayoutWithPdfJs;
                            if (typeof inspectLayout === 'function') {
                                for (const source of questionSources.filter(ports.isFullRole)) {
                                    assertActive(pdfSignal);
                                    try {
                                        const layouts = await inspectLayout(source, {
                                            includeOperatorCount: true
                                        });
                                        const plan = planFullPdfPageRoles(layouts);
                                        if (plan) pageRolePlans.set(String(source.id), plan);
                                    } catch (error) {
                                        assertActive(pdfSignal);
                                        warnings.push('PDF 页面角色核查失败，沿用原页范围。');
                                    }
                                }
                            }
                            const sourceForRole = (source, role) => {
                                const plan = pageRolePlans.get(String(source.id));
                                if (!plan) return source;
                                const pageNos = role === 'question'
                                    ? plan.questionPageNos : plan.supportPageNos;
                                return { ...source, pageRange: pageNos.join(',') };
                            };
                            for (const source of questionSources) {
                                if (pdfSignal?.aborted) {
                                    throw createError(
                                        'PDF_COORDINATOR_ABORTED',
                                        'AbortError'
                                    );
                                }
                                const result = await ports.processQuestionSource({
                                    source: sourceForRole(source, 'question'),
                                    batch,
                                    expectedQuestionCount:
                                        batch.expectedQuestionCount || 0,
                                    onPageProgress: async (_ratio, info = {}) =>
                                        reportPage?.({
                                            sourceId: source.id,
                                            pageNo: info.done || info.pageNo || 1,
                                            totalPages: info.total || 1
                                        }),
                                    reportStage: context.reportStage,
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
                                    source: sourceForRole(source, 'support'),
                                    reportStage: context.reportStage,
                                    signal: pdfSignal
                                });
                                const support = await ports.processSupportPages({
                                    source: sourceForRole(source, 'support'),
                                    pages,
                                    strict: true,
                                    expectedQuestionNumbers,
                                    requiredKinds: {
                                        answers: ports.hasAnswerRole(source) ||
                                            ports.isFullRole(source),
                                        solutions: ports.hasSolutionRole(source) ||
                                            ports.isFullRole(source)
                                    },
                                    reportStage: context.reportStage,
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
                                        pageNo: pages[index]?.pageNo || index + 1,
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

    const api = Object.freeze({ processPdfSources, createProductionImportRunner, planFullPdfPageRoles });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionPdfSourcesPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
