(function () {
    'use strict';

    const uniq = (items = []) => [...new Set((items || []).filter(Boolean))];

    const getRoles = (file, helpers) => {
        if (helpers.getBatchFileRoles) return helpers.getBatchFileRoles(file);
        const roles = Array.isArray(file?.roles) ? file.roles.filter(Boolean) : [];
        return roles.length ? uniq(roles) : (file?.role ? [file.role] : []);
    };

    const rejectNativePdf = file => {
        if (file?.fileType !== 'pdf' || file.convertedFromDocx === true) return;
        const error = new Error('原生 PDF 只接受 PDF 多模态 V1 识别。');
        error.code = 'PDF_V1_PRODUCER_REQUIRED';
        throw error;
    };

    const createStrictVisualPreparedPagesRecognizer = (ports = {}) => {
        const requiredPorts = [
            'mapWithConcurrency',
            'recognizePage',
            'collectValidFigures',
            'hasFigureCue',
            'locateQuestionFigures',
            'normalizeFigure',
            'isLikelyRealFigure',
            'mergeQuestionItems',
            'validateQuestionItems',
            'isStrictChoiceType',
            'repairChoiceAndSolutionDetails',
            'buildQuestionNumberGapWarning',
            'normalizeFourOptions',
            'isBadChoiceOption',
            'cleanRecognizedText',
            'isFatalServiceError'
        ];
        if (requiredPorts.some(name => typeof ports[name] !== 'function')) {
            const error = new Error('STRICT_VISUAL_RECOGNIZER_PORT_REQUIRED');
            error.code = 'STRICT_VISUAL_RECOGNIZER_PORT_REQUIRED';
            throw error;
        }
        const now = typeof ports.now === 'function'
            ? ports.now
            : () => (
                typeof performance !== 'undefined' &&
                typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now()
            );
        const throwIfCancelled = signal => {
            if (!signal?.aborted) return;
            const cancelled = new Error('Strict visual recognition cancelled.');
            cancelled.name = 'AbortError';
            cancelled.code = 'OCR_REQUEST_CANCELLED';
            throw cancelled;
        };

        return async function recognizeStrictVisualPreparedPages({
            file,
            batch,
            pages,
            expectedQuestionCount = 0,
            onPageProgress = null,
            renderDurationMs = 0,
            signal
        }) {
            void batch;
            throwIfCancelled(signal);
            rejectNativePdf(file);
            if (!pages.length) {
                throw new Error(`${file.filename} 没有生成任何页面图`);
            }

            const expected = Math.max(
                0,
                Number(expectedQuestionCount || 0)
            ) || 0;
            console.log('[BATCH_TIME][strict-render]', {
                filename: file.filename,
                pageCount: pages.length,
                durationMs: Math.round(renderDurationMs)
            });

            const pageImages = pages.map(page => ({
                sourceFileId: file.id,
                sourceFileName: file.filename,
                pageNo: page.pageNo || 1,
                imageUrl: page.url
            }));
            console.groupCollapsed('[BATCH_DEBUG][strict-rendered-pages]');
            console.log('filename =', file.filename);
            console.log('fileType =', file.fileType);
            console.log({
                filename: file.filename,
                fileType: file.fileType,
                pageCount: pages.length,
                expectedQuestionCount: expected
            });
            console.table(pageImages.map(page => ({
                pageNo: page.pageNo,
                hasUrl: Boolean(page.imageUrl),
                urlLength: String(page.imageUrl || '').length
            })));
            console.groupEnd();

            const recognitionStart = now();
            const pageRecognitionSummary = [];
            const summarizeStrictPageItems = (items = []) =>
                (items || []).map(item => ({
                    questionNumber:
                        item?.questionNumber || item?.question || item?.no || '',
                    type: item?.type || '',
                    stemHead: String(
                        item?.stem || item?.questionText || item?.rawBlock || ''
                    ).slice(0, 120),
                    optionCount: Array.isArray(item?.options)
                        ? item.options.filter(Boolean).length
                        : 0
                }));

            const pageResults = await ports.mapWithConcurrency(
                pages,
                2,
                async (page, index) => {
                    throwIfCancelled(signal);
                    const pageNo = page.pageNo || index + 1;
                    const pageStartedAt = now();
                    if (!page.url) {
                        pageRecognitionSummary.push({
                            pageNo,
                            hasPageUrl: false,
                            pageUrlLength: 0,
                            itemCount: 0,
                            questionNumbers: [],
                            itemHeads: [],
                            protocolRejectedCount: 0,
                            errorMessage:
                                `${file.filename} 第 ${pageNo} 页没有页面图`,
                            durationMs: Math.round(now() - pageStartedAt)
                        });
                        throw new Error(
                            `${file.filename} 第 ${pageNo} 页没有页面图`
                        );
                    }

                    if (onPageProgress) {
                        await onPageProgress(
                            index / Math.max(1, pages.length),
                            { stage: 'initial-page-recognition', pageNo }
                        );
                    }
                    throwIfCancelled(signal);
                    const result = await ports.recognizePage({
                        file,
                        imageUrl: page.url,
                        pageNo,
                        expectedQuestionCount: 0,
                        repairInfo: '',
                        signal
                    });
                    throwIfCancelled(signal);
                    const strictPageDiagnostics =
                        result?.__strictPageDiagnostics || {};
                    let pageItems = (result || []).map(item => ({
                        ...item,
                        sourcePage: item.sourcePage || item.pageIndex || pageNo,
                        pageIndex: item.pageIndex || item.sourcePage || pageNo,
                        sourcePageImage: item.sourcePageImage || page.url,
                        sourcePages: [...new Set([
                            ...(item.sourcePages || []),
                            pageNo
                        ])]
                    }));

                    for (const item of pageItems) {
                        item.recognizedImages = ports.collectValidFigures(item);
                    }
                    const figureLocatorTargets = pageItems.filter(item =>
                        item.recognitionRaw?.isFragment !== true &&
                        ports.hasFigureCue(item) &&
                        ports.collectValidFigures(item).length === 0
                    );
                    if (figureLocatorTargets.length) {
                        try {
                            const locatedFigures =
                                await ports.locateQuestionFigures({
                                    pageImage: page.url,
                                    pageNo,
                                    sourceFileName: file.filename,
                                    questions: figureLocatorTargets,
                                    signal
                                });
                            throwIfCancelled(signal);
                            const figuresByQuestion = new Map();
                            for (const rawFigure of locatedFigures || []) {
                                const questionNumber = ports.cleanRecognizedText(
                                    rawFigure.question ||
                                    rawFigure.questionNumber ||
                                    rawFigure.no || ''
                                );
                                if (!questionNumber) continue;
                                const normalized = ports.normalizeFigure(rawFigure);
                                if (!normalized) continue;
                                if (!figuresByQuestion.has(questionNumber)) {
                                    figuresByQuestion.set(questionNumber, []);
                                }
                                figuresByQuestion
                                    .get(questionNumber)
                                    .push(normalized);
                            }
                            for (const item of pageItems) {
                                const questionNumber = ports.cleanRecognizedText(
                                    item.questionNumber ||
                                    item.question ||
                                    item.no || ''
                                );
                                const validLocated = (
                                    figuresByQuestion.get(questionNumber) || []
                                ).filter(figure => ports.isLikelyRealFigure(
                                    figure,
                                    item.question_bbox || item.sourceBbox || []
                                ));
                                if (!validLocated.length) continue;
                                item.recognizedImages = [
                                    ...ports.collectValidFigures(item),
                                    ...validLocated
                                ];
                            }
                        } catch (error) {
                            if (
                                error?.name === 'AbortError' ||
                                error?.code === 'OCR_REQUEST_CANCELLED'
                            ) {
                                throw error;
                            }
                            if (ports.isFatalServiceError(error)) throw error;
                            console.warn(
                                '[BATCH_IMAGE][figure-locator-failed]',
                                {
                                    filename: file.filename,
                                    pageNo,
                                    message: error?.message || String(error)
                                }
                            );
                        }
                    }

                    console.log('[BATCH_DEBUG][strict-page-result]', {
                        filename: file.filename,
                        pageNo,
                        count: pageItems.length,
                        questionNumbers: pageItems.map(item =>
                            item.questionNumber || item.question || ''
                        ),
                        figureCounts: pageItems.map(item => ({
                            questionNumber:
                                item.questionNumber || item.question || '',
                            count: ports.collectValidFigures(item).length
                        }))
                    });
                    pageRecognitionSummary.push({
                        pageNo,
                        hasPageUrl: Boolean(page.url),
                        pageUrlLength: String(page.url || '').length,
                        itemCount: pageItems.length,
                        questionNumbers: pageItems.map(item =>
                            item.questionNumber || item.question || item.no || ''
                        ),
                        itemHeads: summarizeStrictPageItems(pageItems),
                        protocolRejectedCount:
                            Number(
                                strictPageDiagnostics.protocolRejectedCount || 0
                            ) || 0,
                        errorMessage: pageItems.length
                            ? ''
                            : '页面识别完成但没有产出题目',
                        durationMs: Math.round(now() - pageStartedAt)
                    });
                    return pageItems;
                }
            );
            throwIfCancelled(signal);

            let items = ports.mergeQuestionItems(
                pageResults.flat().filter(Boolean)
            );
            console.log('[BATCH_TIME][strict-initial-recognition]', {
                filename: file.filename,
                pageCount: pages.length,
                rawItemCount: pageResults.flat().length,
                mergedItemCount: items.length,
                durationMs: Math.round(now() - recognitionStart)
            });

            let check = ports.validateQuestionItems(items, expected);
            console.groupCollapsed('[BATCH_DEBUG][strict-initial-check]');
            console.log({
                expected,
                actual: items.length,
                fatalReasons: check.fatalReasons,
                warningReasons: check.warningReasons
            });
            console.table(check.rows);
            console.groupEnd();
            if (check.fatal) {
                throw new Error(
                    `整页视觉识别发生致命错误：${check.fatalReasons.join('；')}`
                );
            }

            const repairTargets = check.failedQuestions.filter(row =>
                ports.isStrictChoiceType(row.type) &&
                (row.warnings || []).some(message =>
                    /选项无效|有效选项不足/.test(message)
                )
            );
            let targetedRepairCallCount = 0;
            console.log(
                '[BATCH_DEBUG][strict-targeted-repair-start]',
                repairTargets
            );
            if (repairTargets.length) {
                const targetNumbers = new Set(
                    repairTargets.map(row => String(row.questionNumber))
                );
                const targetPages = pages.filter(page => {
                    const pageNo = page.pageNo || 1;
                    return items.some(item =>
                        targetNumbers.has(String(item.questionNumber || '')) &&
                        (
                            Number(item.sourcePage || 0) === pageNo ||
                            (item.sourcePages || []).includes(pageNo)
                        )
                    );
                });
                for (const page of targetPages) {
                    throwIfCancelled(signal);
                    const pageNo = page.pageNo || 1;
                    const pageQuestions = items.filter(item =>
                        targetNumbers.has(String(item.questionNumber || '')) &&
                        (
                            Number(item.sourcePage || 0) === pageNo ||
                            (item.sourcePages || []).includes(pageNo)
                        )
                    );
                    if (!pageQuestions.length) continue;
                    targetedRepairCallCount += 1;
                    const repaired =
                        await ports.repairChoiceAndSolutionDetails(
                            {
                                ...file,
                                pageIndex: pageNo,
                                sourcePage: pageNo
                            },
                            page.url,
                            pageNo,
                            pageQuestions,
                            '',
                            signal
                        );
                    throwIfCancelled(signal);
                    items = ports.mergeQuestionItems([
                        ...items,
                        ...(repaired || []).map(item => ({
                            ...item,
                            sourcePage: item.sourcePage || pageNo,
                            pageIndex: item.pageIndex || pageNo,
                            sourcePageImage:
                                item.sourcePageImage || page.url,
                            sourcePages: [...new Set([
                                ...(item.sourcePages || []),
                                pageNo
                            ])]
                        }))
                    ]);
                }
                check = ports.validateQuestionItems(items, expected);
            }
            console.groupCollapsed(
                '[BATCH_DEBUG][strict-after-targeted-repair]'
            );
            console.log({
                targetedRepairCallCount,
                fatalReasons: check.fatalReasons,
                warningReasons: check.warningReasons
            });
            console.table(check.rows);
            console.groupEnd();
            if (check.fatal) {
                throw new Error(
                    `整页视觉识别发生致命错误：${check.fatalReasons.join('；')}`
                );
            }

            const gapWarning = ports.buildQuestionNumberGapWarning(items);
            if (gapWarning) {
                check.warningReasons = [
                    ...new Set([...(check.warningReasons || []), gapWarning])
                ];
                check.reasons = [
                    ...new Set([...(check.reasons || []), gapWarning])
                ];
            }
            items = items.map(item => {
                const row = check.failedQuestions.find(failed =>
                    String(failed.questionNumber) ===
                    String(item.questionNumber)
                );
                const warnings = [
                    ...(item.warnings || []),
                    ...(row?.warnings || []),
                    ...(row?.failures || []),
                    gapWarning
                ].filter(Boolean);
                if (!warnings.length) return item;
                return {
                    ...item,
                    warnings: [...new Set(warnings)],
                    confidence: Math.min(
                        Number(item.confidence || 0.78),
                        0.65
                    )
                };
            });

            console.log('[BATCH_DEBUG][strict-summary]', {
                filename: file.filename,
                pageCount: pages.length,
                initialVisionCallCount: pages.length,
                targetedRepairCallCount,
                finalItemCount: items.length,
                types: items.map(item => ({
                    questionNumber: item.questionNumber,
                    type: item.type,
                    validOptionCount: ports
                        .normalizeFourOptions(item.options || [])
                        .filter(option =>
                            !ports.isBadChoiceOption(option)
                        ).length
                }))
            });
            throwIfCancelled(signal);
            if (onPageProgress) {
                await onPageProgress(1, { stage: 'done', done: true });
            }
            return {
                questions: items,
                pageImages,
                check,
                pageRecognitionSummary: [...pageRecognitionSummary].sort(
                    (left, right) =>
                        Number(left.pageNo || 0) - Number(right.pageNo || 0)
                )
            };
        };
    };

    const createStrictVisualQuestionProducer = (ports = {}) => {
        if (
            typeof ports.renderPdfFilePages !== 'function' ||
            typeof ports.recognizePreparedPages !== 'function' ||
            typeof ports.getRoles !== 'function' ||
            typeof ports.logDiagnostic !== 'function'
        ) {
            const error = new Error('STRICT_VISUAL_PRODUCER_PORT_REQUIRED');
            error.code = 'STRICT_VISUAL_PRODUCER_PORT_REQUIRED';
            throw error;
        }

        const now = typeof ports.now === 'function'
            ? ports.now
            : () => (
                typeof performance !== 'undefined' &&
                typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now()
            );

        const throwIfCancelled = signal => {
            if (!signal?.aborted) return;
            const cancelled = new Error('Strict visual recognition cancelled.');
            cancelled.name = 'AbortError';
            cancelled.code = 'OCR_REQUEST_CANCELLED';
            throw cancelled;
        };

        const preparePages = async (file, signal) => {
            throwIfCancelled(signal);
            rejectNativePdf(file);
            if (file.fileType === 'pdf') {
                const pages = await ports.renderPdfFilePages(file, {
                    scale: 2.2,
                    jpegQuality: 0.9,
                    sequential: true,
                    ...(signal ? { signal } : {})
                });
                throwIfCancelled(signal);
                return pages;
            }

            if (file.fileType === 'image') {
                return [{
                    pageNo: 1,
                    url: file.uploadPath,
                    width: 0,
                    height: 0
                }];
            }

            throw new Error(`整页视觉识别不支持文件类型：${file.fileType}`);
        };

        const processQuestionFile = async ({
            file,
            batch,
            expectedQuestionCount = 0,
            onPageProgress = null,
            reportStage = null,
            signal
        }) => {
            const renderStart = now();
            let pages = [];

            ports.logDiagnostic('strict-visual-file-start', {
                batchId: batch?.id || '',
                filename: file?.filename || '',
                fileType: file?.fileType || '',
                roles: ports.getRoles(file),
                expectedQuestionCount
            });

            try {
                throwIfCancelled(signal);
                pages = await preparePages(file, signal);
                throwIfCancelled(signal);
                reportStage?.({ stage: 'page-rendered', engine: 'browser-pdf' });
                const renderDurationMs = now() - renderStart;

                console.log('[BATCH_DEBUG][strict-visual-prepared-pages]', {
                    filename: file?.filename || '',
                    fileType: file?.fileType || '',
                    convertedFromDocx: Boolean(file?.convertedFromDocx),
                    sourceDocxFileName: file?.sourceDocxFileName || '',
                    pageRange: file?.pageRange || '',
                    pageCount: pages.length,
                    pageNos: pages.map(page => page.pageNo || 1),
                    pageUrlLengths: pages.map(page =>
                        String(page?.url || '').length
                    )
                });

                reportStage?.({ stage: 'ocr-adapter-called', engine: 'qwen' });
                const result = await ports.recognizePreparedPages({
                    file,
                    batch,
                    pages,
                    expectedQuestionCount,
                    onPageProgress,
                    renderDurationMs,
                    reportStage,
                    ...(signal ? { signal } : {})
                });

                ports.logDiagnostic('strict-visual-file-result', {
                    batchId: batch?.id || '',
                    filename: file?.filename || '',
                    fileType: file?.fileType || '',
                    roles: ports.getRoles(file),
                    pageCount: pages.length,
                    pageNos: pages.map(page => page.pageNo || 1),
                    questionCount: result?.questions?.length || 0,
                    pageImageCount: result?.pageImages?.length || 0,
                    fatal: Boolean(result?.check?.fatal),
                    reasons:
                        result?.check?.reasons ||
                        result?.check?.fatalReasons || []
                });

                return result;
            } catch (error) {
                ports.logDiagnostic('strict-visual-file-result', {
                    batchId: batch?.id || '',
                    filename: file?.filename || '',
                    fileType: file?.fileType || '',
                    roles: ports.getRoles(file),
                    pageCount: pages.length,
                    pageNos: pages.map(page => page.pageNo || 1),
                    ok: false,
                    message: error?.message || String(error),
                    code: error?.code || '',
                    stage: error?.stage || ''
                }, 'error');
                throw error;
            }
        };

        return Object.freeze({ preparePages, processQuestionFile });
    };

    window.QisiBatchEngineV2 = {
        createStrictVisualPreparedPagesRecognizer,
        createStrictVisualQuestionProducer
    };
})();
