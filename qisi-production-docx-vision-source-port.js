(function initProductionDocxVisionSourcePort(root, factory) {
    const contract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(contract);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionDocxVisionSourcePort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
    'use strict';

    const fail = code => {
        const error = new Error(code);
        error.code = code;
        error.stage = 'production-docx-vision-shadow';
        return error;
    };
    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = fail('DOCX_VISION_SHADOW_CANCELLED');
        error.name = 'AbortError';
        throw error;
    };

    const sourcesOf = input => {
        const sources = Array.isArray(input.sources)
            ? input.sources
            : input.source ? [input.source] : [];
        if (
            sources.length === 0 ||
            sources.some(source =>
                !isRecord(source) ||
                String(source.fileType || source.format || '').toLowerCase() !== 'docx' ||
                !String(source.sourceId || source.id || '').trim()
            )
        ) throw fail('DOCX_VISION_SOURCE_INVALID');
        return sources;
    };

    async function runDocxVision(input = {}, ports = {}) {
        const mode = String(input.mode || '').trim();
        if (!['shadow', 'production'].includes(mode)) {
            throw fail('DOCX_VISION_MODE_REQUIRED');
        }
        const sources = sourcesOf(input);
        if (
            typeof ports.runVisionProducer !== 'function' ||
            typeof contract?.projectDocxVisionCandidate !== 'function'
        ) throw fail('DOCX_VISION_PORT_REQUIRED');
        assertActive(input.signal);
        const result = await ports.runVisionProducer({
            sources,
            source: sources[0],
            engineContext: input.engineContext || {},
            mode,
            shadow: mode === 'shadow',
            signal: input.signal
        });
        assertActive(input.signal);
        if (
            !isRecord(result) || !Array.isArray(result.candidates) ||
            !Array.isArray(result.controlledWriteDecisions) ||
            result.candidates.length !== result.controlledWriteDecisions.length
        ) throw fail('DOCX_VISION_RESULT_MALFORMED');
        const sourceById = new Map(sources.map(source => [
            String(source.sourceId || source.id), source
        ]));
        const drafts = result.candidates.map((candidate, index) => {
            const decision = result.controlledWriteDecisions[index];
            const sourceId = String(
                decision?.sourceId || candidate?.source?.sourceId ||
                candidate?.sourceDocxFileId || candidate?.sourceFileId ||
                sources[0].sourceId || sources[0].id
            );
            const source = sourceById.get(sourceId);
            if (!source) throw fail('DOCX_VISION_SOURCE_MISMATCH');
            return contract.projectDocxVisionCandidate({
                candidate,
                source: {
                    sourceId,
                    format: 'docx',
                    filename: source.filename || '',
                    mimeType: source.mimeType || source.type || '',
                    sourceOrder: Number.isInteger(source.sourceOrder)
                        ? source.sourceOrder : 0
                },
                engine: result.engine,
                page: candidate.sourcePage || candidate.pageIndex || 0,
                blockIds: candidate.blockIds ||
                    candidate.sourceTrace?.blockIds ||
                    [...new Set(Object.values(candidate.fieldProvenance || {})
                        .flatMap(entry => Array.isArray(entry?.blockIds)
                            ? entry.blockIds : []))],
                controlledWriteDecision: decision
            });
        });
        if (drafts.some(draft => draft.canonicalReviewHandoff !== true)) {
            throw fail('DOCX_VISION_HANDOFF_REJECTED');
        }
        return Object.freeze({
            schemaVersion: 'qisi.docx-vision-source.r1',
            mode,
            shadow: mode === 'shadow',
            drafts: Object.freeze(drafts),
            draftImages: Object.freeze(Array.isArray(result.draftImages)
                ? result.draftImages : []),
            warnings: Object.freeze(Array.isArray(result.warnings)
                ? result.warnings.map(String) : []),
            formalWrites: 0,
            reviewDraftWrites: 0,
            realApiCalled: result.realApiCalled === true,
            diagnostics: Object.freeze({
                producer: 'shared-docx-producer-identity-contract',
                candidateCount: drafts.length
            })
        });
    }

    async function runDocxVisionShadow(input = {}, ports = {}) {
        if (input.shadow !== true) throw fail('DOCX_VISION_SHADOW_REQUIRED');
        const result = await runDocxVision({
            ...input,
            mode: 'shadow'
        }, ports);
        if (result.realApiCalled !== false) {
            throw fail('DOCX_VISION_SHADOW_REAL_API_FORBIDDEN');
        }
        return Object.freeze({
            ...result,
            schemaVersion: 'qisi.docx-vision-shadow.r1',
            shadow: true
        });
    }

    const runDocxVisionProduction = (input = {}, ports = {}) =>
        runDocxVision({ ...input, mode: 'production' }, ports);

    const buildQuestionFailureSnapshot = ({
        file,
        questionSkeleton,
        strictResult,
        reconciliation
    } = {}) => {
        const rawQuestions = Array.isArray(strictResult?.questions)
            ? strictResult.questions
            : [];
        const reconciledQuestions = Array.isArray(reconciliation?.questions)
            ? reconciliation.questions
            : [];
        const questionNumbersFrom = items => (items || []).map(item =>
            item?.questionNumber || item?.question || item?.no || ''
        );
        return {
            filename: file?.filename || '',
            sourceDocxFileName: file?.filename || '',
            questionSkeleton: {
                authoritative: Boolean(questionSkeleton?.authoritative)
            },
            skeletonQuestionNumbers:
                Array.isArray(questionSkeleton?.questionNumbers)
                    ? [...questionSkeleton.questionNumbers]
                    : [],
            rawVisualQuestionNumbers: questionNumbersFrom(rawQuestions),
            resultQuestionNumbers: questionNumbersFrom(reconciledQuestions),
            missingQuestionNumbers:
                Array.isArray(reconciliation?.missingQuestionNumbers)
                    ? [...reconciliation.missingQuestionNumbers]
                    : [],
            rejectedCandidates:
                Array.isArray(reconciliation?.rejectedCandidates)
                    ? [...reconciliation.rejectedCandidates]
                    : [],
            strictResult: {
                pageRecognitionSummary:
                    Array.isArray(strictResult?.pageRecognitionSummary)
                        ? [...strictResult.pageRecognitionSummary]
                        : [],
                questions: rawQuestions.map(item => ({
                    questionNumber: item?.questionNumber || '',
                    question: item?.question || '',
                    no: item?.no || '',
                    type: item?.type || '',
                    sourcePage: item?.sourcePage || 0,
                    pageIndex: item?.pageIndex || 0,
                    stemHead: String(
                        item?.stem ||
                        item?.questionText ||
                        item?.rawBlock || ''
                    ).slice(0, 160),
                    optionCount: Array.isArray(item?.options)
                        ? item.options.length
                        : 0
                })),
                check: {
                    rows: Array.isArray(strictResult?.check?.rows)
                        ? [...strictResult.check.rows]
                        : [],
                    fatalReasons:
                        Array.isArray(strictResult?.check?.fatalReasons)
                            ? [...strictResult.check.fatalReasons]
                            : [],
                    warningReasons:
                        Array.isArray(strictResult?.check?.warningReasons)
                            ? [...strictResult.check.warningReasons]
                            : []
                }
            }
        };
    };

    function createQuestionSourceProducer(ports = {}) {
        if (
            typeof ports.getImporter !== 'function' ||
            typeof ports.convertDocxToPdf !== 'function' ||
            typeof ports.processStrictQuestionFile !== 'function' ||
            typeof ports.reconcileQuestions !== 'function' ||
            typeof ports.validateQuestionItems !== 'function'
        ) throw fail('DOCX_QUESTION_PRODUCER_PORT_REQUIRED');
        const now = typeof ports.now === 'function'
            ? ports.now
            : () => (
                typeof performance !== 'undefined' &&
                typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now()
            );

        return async function processDocxQuestionSource({
            file,
            batch,
            processFiles = [],
            expectedQuestionCount = 0,
            onPageProgress = null
        }) {
            void processFiles;
            const expected = Math.max(
                0,
                Number(expectedQuestionCount || 0)
            ) || 0;
            const importer = ports.getImporter();
            if (typeof importer?.extractDocxQuestionSkeleton !== 'function') {
                const error = new Error(
                    'DOCX importer 未提供 extractDocxQuestionSkeleton，' +
                    '已停止识别，避免无题号依据的视觉候选进入草稿。'
                );
                error.code = 'DOCX_SKELETON_API_MISSING';
                error.stage = 'docx-question-skeleton';
                throw error;
            }

            let questionSkeleton;
            try {
                questionSkeleton =
                    await importer.extractDocxQuestionSkeleton(file);
            } catch (error) {
                const wrapped = new Error(
                    `读取 DOCX 显式题号骨架失败：${error?.message || String(error)}`
                );
                wrapped.code = 'DOCX_SKELETON_EXTRACT_FAILED';
                wrapped.stage = 'docx-question-skeleton';
                wrapped.cause = error;
                throw wrapped;
            }
            if (
                !questionSkeleton ||
                !Array.isArray(questionSkeleton.questionNumbers) ||
                !Array.isArray(questionSkeleton.entries)
            ) {
                const error = new Error(
                    'DOCX importer 返回了非法的题号骨架结构。'
                );
                error.code = 'DOCX_SKELETON_INVALID_RESULT';
                error.stage = 'docx-question-skeleton';
                throw error;
            }

            console.log('[BATCH_DEBUG][docx-question-skeleton-loaded]', {
                filename: file.filename || '',
                authoritative: questionSkeleton.authoritative,
                questionNumbers: questionSkeleton.questionNumbers,
                diagnostics: questionSkeleton.diagnostics
            });
            const skeletonReason = String(
                questionSkeleton?.diagnostics?.reason || ''
            );
            const skeletonEntryCount = Number(
                questionSkeleton?.diagnostics?.entryCount || 0
            );
            if (
                !questionSkeleton.authoritative &&
                skeletonEntryCount >= 2 &&
                skeletonReason !== 'no-explicit-question-markers'
            ) {
                const error = new Error(
                    `DOCX 已提取到 ${skeletonEntryCount} 个显式题号，` +
                    `但题号骨架不可靠：${skeletonReason}。` +
                    '已停止视觉识别结果入库，避免生成伪题。'
                );
                error.code = 'DOCX_QUESTION_SKELETON_INCOMPLETE';
                error.stage = 'docx-question-skeleton';
                error.questionSkeleton = questionSkeleton;
                throw error;
            }
            const effectiveExpected = questionSkeleton.authoritative
                ? questionSkeleton.questionNumbers.length
                : expected;

            let pdfRecord;
            try {
                const convertStartedAt = now();
                pdfRecord = await ports.convertDocxToPdf(file);
                console.log('[BATCH_TIME][docx-convert]', {
                    filename: file.filename,
                    durationMs: Math.round(now() - convertStartedAt),
                    pdfFilename: pdfRecord.filename
                });
            } catch (error) {
                const wrapped = new Error(
                    `DOCX 转 PDF 失败：${error?.message || String(error)}`
                );
                wrapped.stage = 'docx-convert';
                wrapped.cause = error;
                throw wrapped;
            }

            console.groupCollapsed(
                '[BATCH_DEBUG][docx-local-pdf-then-strict-vision]'
            );
            console.log({
                docx: file.filename,
                virtualPdf: pdfRecord.filename,
                expected,
                effectiveExpected,
                questionSkeleton: questionSkeleton.authoritative
                    ? questionSkeleton.questionNumbers
                    : []
            });
            console.groupEnd();

            let strictResult;
            try {
                strictResult = await ports.processStrictQuestionFile({
                    file: pdfRecord,
                    batch,
                    expectedQuestionCount: effectiveExpected,
                    onPageProgress
                });
            } catch (error) {
                const wrapped = new Error(
                    'DOCX 已成功转为 PDF，但页面视觉识别未完成：' +
                    `${error?.message || String(error)}`
                );
                wrapped.stage = 'visual-recognition';
                wrapped.cause = error;
                wrapped.pdfRecord = pdfRecord;
                if (error?.renderDiagnostics) {
                    wrapped.renderDiagnostics = error.renderDiagnostics;
                }
                throw wrapped;
            }

            const reconciliation = ports.reconcileQuestions(
                strictResult.questions || [],
                questionSkeleton
            );
            if (questionSkeleton.authoritative && !reconciliation.applied) {
                const error = new Error(
                    'DOCX 题号骨架已标记为 authoritative，' +
                    '但协调器没有应用该骨架。'
                );
                error.code = 'DOCX_SKELETON_RECONCILE_INVARIANT';
                error.stage = 'docx-question-reconcile';
                error.questionSkeleton = questionSkeleton;
                throw error;
            }
            console.groupCollapsed('[BATCH_DEBUG][docx-skeleton-reconcile]');
            console.log({
                filename: file.filename,
                applied: reconciliation.applied,
                skeletonQuestionNumbers: reconciliation.questionNumbers,
                rawVisualQuestionNumbers: (strictResult.questions || []).map(
                    item => item.questionNumber || item.question || ''
                ),
                resultQuestionNumbers: reconciliation.questions.map(
                    item => item.questionNumber || item.question || ''
                ),
                missingQuestionNumbers: reconciliation.missingQuestionNumbers,
                rejectedCount: reconciliation.rejectedCandidates.length
            });
            console.table(reconciliation.rejectedCandidates);
            console.groupEnd();

            const failureSnapshot = buildQuestionFailureSnapshot({
                file,
                questionSkeleton,
                strictResult,
                reconciliation
            });
            if (reconciliation.applied && !reconciliation.questions.length) {
                const error = new Error(
                    'DOCX 显式题号骨架存在，但所有视觉候选均无法与骨架对齐。' +
                    '已停止生成草稿。'
                );
                error.code = 'DOCX_QUESTION_SKELETON_MISMATCH';
                error.questionSkeleton = questionSkeleton;
                error.rejectedCandidates = reconciliation.rejectedCandidates;
                error.failureSnapshot = failureSnapshot;
                throw error;
            }
            if (
                reconciliation.applied &&
                Array.isArray(reconciliation.missingQuestionNumbers) &&
                reconciliation.missingQuestionNumbers.length > 0
            ) {
                const error = new Error(
                    'DOCX 显式题号骨架为完整题号集合，' +
                    '但本次视觉识别缺少题目：' +
                    reconciliation.missingQuestionNumbers.join('、') +
                    '。已停止后续答案识别，避免使用残缺题目集合建立错误契约。'
                );
                error.code = 'DOCX_QUESTION_VISUAL_COVERAGE_INCOMPLETE';
                error.stage = 'docx-question-reconcile';
                error.questionSkeleton = questionSkeleton;
                error.missingQuestionNumbers =
                    reconciliation.missingQuestionNumbers;
                error.rejectedCandidates = reconciliation.rejectedCandidates;
                error.failureSnapshot = failureSnapshot;
                throw error;
            }
            if (reconciliation.applied) {
                strictResult = {
                    ...strictResult,
                    questions: reconciliation.questions,
                    questionSkeleton,
                    rejectedCandidates: reconciliation.rejectedCandidates,
                    missingQuestionNumbers:
                        reconciliation.missingQuestionNumbers,
                    check: ports.validateQuestionItems(
                        reconciliation.questions,
                        questionSkeleton.questionNumbers.length
                    )
                };
            }
            const check = strictResult.check || ports.validateQuestionItems(
                strictResult.questions,
                effectiveExpected
            );
            if (check.fatal) {
                throw new Error(
                    'DOCX 已转 PDF，但识别发生致命错误：' +
                    `${(check.fatalReasons || []).join('；') || '未知原因'}`
                );
            }

            const questions = (strictResult.questions || []).map(question => ({
                ...question,
                sourceFileId: file.id,
                sourceFileName: file.filename || '',
                sourceDocxFileId: file.id,
                sourceDocxFileName: file.filename || '',
                convertedPdfFileName: pdfRecord.filename || '',
                sourceTrace: {
                    ...(question.sourceTrace || {}),
                    source: 'docx-local-convert-pdf-strict-vision',
                    sourceFileId: file.id,
                    sourceFileName: file.filename || '',
                    convertedPdfFileName: pdfRecord.filename || '',
                    sourcePageImage:
                        question.sourcePageImage ||
                        question.sourceTrace?.sourcePageImage || ''
                }
            }));
            const pageImages = (strictResult.pageImages || []).map(image => ({
                ...image,
                sourceFileId: file.id,
                sourceFileName: file.filename || '',
                convertedPdfFileName: pdfRecord.filename || ''
            }));
            return {
                ...strictResult,
                questions,
                pageImages,
                pdfRecord,
                check,
                questionSkeleton:
                    strictResult.questionSkeleton || questionSkeleton,
                rejectedCandidates:
                    strictResult.rejectedCandidates || [],
                missingQuestionNumbers:
                    strictResult.missingQuestionNumbers || []
            };
        };
    }

    function createSupportSourceProducer(ports = {}) {
        if (
            typeof ports.convertDocxToPdf !== 'function' ||
            typeof ports.renderPdfPages !== 'function' ||
            !isRecord(ports.renderOptions) ||
            typeof ports.recognizePreparedSupport !== 'function' ||
            typeof ports.mathSignalCount !== 'function'
        ) throw fail('DOCX_SUPPORT_PRODUCER_PORT_REQUIRED');
        const now = typeof ports.now === 'function'
            ? ports.now
            : () => (
                typeof performance !== 'undefined' &&
                typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now()
            );

        return async function processDocxSupportSource({
            file,
            expectedQuestionNumbers = [],
            requiredKinds = { answers: true, solutions: false },
            onPageProgress = null,
            signal = null
        }) {
            if (!file || file.fileType !== 'docx') {
                const error = new Error(
                    'processStandaloneDocxSupportByVision 只接受 DOCX 文件。'
                );
                error.code = 'INVALID_DOCX_SUPPORT_INPUT';
                throw error;
            }

            let pdfRecord;
            assertActive(signal);
            try {
                const startedAt = now();
                pdfRecord = await ports.convertDocxToPdf(file);
                console.log('[BATCH_TIME][docx-support-convert]', {
                    filename: file.filename,
                    pdfFilename: pdfRecord.filename,
                    durationMs: Math.round(now() - startedAt)
                });
            } catch (error) {
                assertActive(signal);
                const wrapped = new Error(
                    '答案/解析 DOCX 转 PDF 失败：' +
                    `${error?.message || String(error)}`
                );
                wrapped.code = 'DOCX_SUPPORT_CONVERT_FAILED';
                wrapped.stage = 'docx-support-convert';
                wrapped.cause = error;
                throw wrapped;
            }
            assertActive(signal);

            let pages;
            assertActive(signal);
            try {
                const startedAt = now();
                pages = await ports.renderPdfPages(
                    pdfRecord,
                    ports.renderOptions
                );
                if (!Array.isArray(pages) || pages.length === 0) {
                    throw new Error('转换后的 PDF 没有渲染出页面图。');
                }
                console.log('[BATCH_TIME][docx-support-render]', {
                    filename: file.filename,
                    pdfFilename: pdfRecord.filename,
                    pageCount: pages.length,
                    durationMs: Math.round(now() - startedAt)
                });
            } catch (error) {
                assertActive(signal);
                const wrapped = new Error(
                    '答案/解析 DOCX 已转为 PDF，' +
                    `但页面渲染失败：${error?.message || String(error)}`
                );
                wrapped.code = 'DOCX_SUPPORT_RENDER_FAILED';
                wrapped.stage = 'docx-support-render';
                wrapped.cause = error;
                wrapped.pdfRecord = pdfRecord;
                if (error?.renderDiagnostics) {
                    wrapped.renderDiagnostics = error.renderDiagnostics;
                }
                throw wrapped;
            }
            assertActive(signal);

            let supportResult;
            assertActive(signal);
            try {
                supportResult = await ports.recognizePreparedSupport({
                    file,
                    pages,
                    onPageProgress,
                    strict: true,
                    expectedQuestionNumbers,
                    requiredKinds,
                    signal
                });
            } catch (error) {
                assertActive(signal);
                const wrapped = new Error(
                    '答案/解析 DOCX 页面视觉识别失败：' +
                    `${error?.message || String(error)}`
                );
                wrapped.code = error?.code || 'DOCX_SUPPORT_VISION_FAILED';
                wrapped.stage = error?.stage || 'docx-support-vision';
                wrapped.cause = error;
                wrapped.pdfRecord = pdfRecord;
                throw wrapped;
            }
            assertActive(signal);

            if (
                !isRecord(supportResult) ||
                !Array.isArray(supportResult.answers) ||
                !Array.isArray(supportResult.solutions)
            ) {
                const error = fail('DOCX_SUPPORT_RESULT_MALFORMED');
                error.stage = 'docx-support-vision';
                throw error;
            }
            const answers = supportResult.answers;
            const solutions = supportResult.solutions;
            if (answers.length === 0 && solutions.length === 0) {
                const error = new Error(
                    '答案/解析 DOCX 已成功转为 PDF 并完成页面视觉识别，' +
                    '但没有识别到任何答案或解析。' +
                    '已禁止回退到公式缺失的 Word 文本层。'
                );
                error.code = 'DOCX_SUPPORT_VISUAL_EMPTY';
                error.stage = 'docx-support-vision';
                error.pdfRecord = pdfRecord;
                throw error;
            }
            if (supportResult.coverage && !supportResult.coverage.ok) {
                const error = new Error('答案/解析 DOCX 覆盖率检查失败。');
                error.code = 'DOCX_SUPPORT_COVERAGE_FAILED';
                error.coverage = supportResult.coverage;
                throw error;
            }

            const attachOriginalDocxTrace = item => ({
                ...item,
                sourceFileId: file.id,
                sourceFileName: file.filename || '',
                sourceTrace: {
                    ...(item.sourceTrace || {}),
                    source: 'docx-converted-pdf-visual-support',
                    sourceFileId: file.id,
                    sourceFileName: file.filename || '',
                    convertedPdfFileName: pdfRecord.filename || ''
                }
            });
            const normalizedResult = {
                ...supportResult,
                answers: answers.map(attachOriginalDocxTrace),
                solutions: solutions.map(attachOriginalDocxTrace),
                pdfRecord,
                renderedPageCount: pages.length
            };

            console.groupCollapsed(
                '[BATCH_DEBUG][docx-support-visual-result]'
            );
            console.log({
                filename: file.filename,
                convertedPdf: pdfRecord.filename,
                renderedPageCount: pages.length,
                answerCount: normalizedResult.answers.length,
                solutionCount: normalizedResult.solutions.length,
                failedPageCount: normalizedResult.failedPages?.length || 0
            });
            console.table(normalizedResult.answers.map(item => ({
                question: item.question,
                answer: item.answer,
                mathSignal: ports.mathSignalCount(item.answer || ''),
                sourcePage: item.sourcePage || 0
            })));
            console.table(normalizedResult.solutions.map(item => ({
                question: item.question,
                solutionLength: String(item.solution || '').length,
                mathSignal: ports.mathSignalCount(item.solution || ''),
                sourcePage: item.sourcePage || 0
            })));
            console.groupEnd();
            return normalizedResult;
        };
    }

    function createProductionImportRunner(ports = {}) {
        if (
            typeof ports.hasQuestionRole !== 'function' ||
            typeof ports.isFullRole !== 'function' ||
            typeof ports.hasAnswerRole !== 'function' ||
            typeof ports.hasSolutionRole !== 'function' ||
            typeof ports.normalizeQuestionNumber !== 'function' ||
            typeof ports.processQuestionSource !== 'function' ||
            typeof ports.processSupportSource !== 'function' ||
            typeof contract?.buildDocxVisionControlledWriteDecision !== 'function' ||
            typeof contract?.applyDocxVisionSupportField !== 'function'
        ) throw fail('DOCX_VISION_PRODUCTION_PORT_REQUIRED');

        return async function runProductionDocxVisionImport(context = {}, signal) {
            const sources = Array.isArray(context.sources) ? context.sources : [];
            const questionSources = sources.filter(source =>
                ports.hasQuestionRole(source) || ports.isFullRole(source)
            );
            const supportSources = sources.filter(source =>
                !ports.hasQuestionRole(source) &&
                !ports.isFullRole(source) &&
                (ports.hasAnswerRole(source) || ports.hasSolutionRole(source))
            );
            if (!questionSources.length) {
                const error = fail('PRODUCTION_IMPORT_SOURCE_UNSUPPORTED');
                error.message = 'docx-question-source-required';
                throw error;
            }
            const base = await runDocxVisionProduction({
                ...context,
                sources,
                signal
            }, {
                runVisionProducer: async () => {
                    const candidates = [];
                    const warnings = [];
                    for (const source of questionSources) {
                        const result = await ports.processQuestionSource({
                            source,
                            batch: context.batch,
                            sources,
                            expectedQuestionCount:
                                context.batch?.expectedQuestionCount || 0,
                            signal
                        });
                        candidates.push(...(result?.questions || []));
                        warnings.push(...(result?.check?.warningReasons || []));
                    }
                    return {
                        engine: candidates[0]?.producer?.engine || '',
                        candidates,
                        controlledWriteDecisions: candidates.map(candidate =>
                            contract.buildDocxVisionControlledWriteDecision(candidate)
                        ),
                        draftImages: [],
                        warnings,
                        realApiCalled: true
                    };
                }
            });
            let drafts = [...base.drafts];
            const warnings = [...base.warnings];
            for (const source of supportSources) {
                assertActive(signal);
                const expectedQuestionNumbers = drafts
                    .map(draft =>
                        ports.normalizeQuestionNumber(draft.questionNumber)
                    )
                    .filter(Boolean);
                const support = await ports.processSupportSource({
                    source,
                    expectedQuestionNumbers,
                    requiredKinds: {
                        answers: ports.hasAnswerRole(source),
                        solutions: ports.hasSolutionRole(source)
                    },
                    signal
                });
                assertActive(signal);
                for (const [field, items] of [
                    ['answer', support?.answers || []],
                    ['solution', support?.solutions || []]
                ]) {
                    for (const item of items) {
                        const questionNumber =
                            ports.normalizeQuestionNumber(item.question);
                        const matches = drafts.map((draft, index) => ({
                            draft,
                            index
                        })).filter(entry =>
                            ports.normalizeQuestionNumber(
                                entry.draft.questionNumber
                            ) === questionNumber
                        );
                        if (matches.length !== 1) {
                            throw fail('DOCX_SUPPORT_OWNERSHIP_INVALID');
                        }
                        const index = matches[0].index;
                        drafts[index] = contract.applyDocxVisionSupportField({
                            candidate: drafts[index],
                            field,
                            support: item,
                            source: {
                                sourceId: source.id,
                                format: 'docx',
                                filename: source.filename || '',
                                mimeType: source.mimeType || source.type || '',
                                sourceOrder: Number.isInteger(source.sourceOrder)
                                    ? source.sourceOrder : 0
                            },
                            controlledWriteDecision: item.controlledWriteDecision
                        });
                    }
                }
            }
            assertActive(signal);
            return Object.freeze({
                ...base,
                drafts: Object.freeze(drafts),
                warnings: Object.freeze(warnings)
            });
        };
    }

    return Object.freeze({
        runDocxVision,
        runDocxVisionShadow,
        runDocxVisionProduction,
        createQuestionSourceProducer,
        createSupportSourceProducer,
        createProductionImportRunner
    });
});
