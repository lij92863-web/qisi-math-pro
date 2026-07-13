(function initBrowserPdfRenderer(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.BrowserPdfRenderer = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createBrowserPdfRenderer(ports = {}) {
        for (const name of [
            'dataUrlToBlob',
            'getBatchFileRoles',
            'logBatchPdfDiag',
            'batchHasQuestionRole',
            'estimateVisionCalls',
            'recordRenderedPages',
            'showBatchToast',
            'getRecognitionMode'
        ]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Browser PDF renderer requires ${name}.`
                );
                error.code = 'BROWSER_PDF_RENDERER_PORT_REQUIRED';
                throw error;
            }
        }

        const dataUrlToBlob = ports.dataUrlToBlob;
        const getBatchFileRoles = ports.getBatchFileRoles;
        const logBatchPdfDiag = ports.logBatchPdfDiag;
        const batchHasQuestionRole = ports.batchHasQuestionRole;
        const estimateVisionCalls = ports.estimateVisionCalls;
        const recordRenderedPages = ports.recordRenderedPages;
        const showBatchToast = ports.showBatchToast;
        const getRecognitionMode = ports.getRecognitionMode;
        const PDF_PROCESS_CONFIG = ports.pdfProcessConfig || {};

        const renderPdfFilePages = async (file, options = {}) => {
            const filename = file?.filename || 'unknown.pdf';
            const renderScale = options.scale || PDF_PROCESS_CONFIG.renderScale;
            const jpegQuality = options.jpegQuality || PDF_PROCESS_CONFIG.jpegQuality;
            const pageRenderTimeoutMs = options.pageRenderTimeoutMs || PDF_PROCESS_CONFIG.pageRenderTimeoutMs;
            const renderRetryScales = [
                renderScale,
                1.6,
                1.2,
                1.0
            ].filter((scale, index, arr) =>
                Number.isFinite(Number(scale)) &&
                Number(scale) > 0 &&
                arr.findIndex(item => Number(item).toFixed(3) === Number(scale).toFixed(3)) === index
            );
            const isConvertedDocxQuestionPdf =
                Boolean(file?.convertedFromDocx) &&
                batchHasQuestionRole(file);

            if (!root.pdfjsLib) {
                console.error('[BATCH_DEBUG][pdf-render-failed] pdfjsLib 未加载', { filename });
                throw new Error('PDF.js 未加载，无法渲染 PDF 页面图。');
            }

            root.pdfjsLib.GlobalWorkerOptions.workerSrc =
                root.pdfjsLib.GlobalWorkerOptions.workerSrc ||
                'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

            let buffer;
            try {
                buffer = await (await dataUrlToBlob(file.uploadPath)).arrayBuffer();
            } catch (error) {
                console.error('[BATCH_DEBUG][pdf-render-failed] PDF 文件读取失败', {
                    filename,
                    hasUploadPath: Boolean(file?.uploadPath),
                    uploadPathHead: String(file?.uploadPath || '').slice(0, 80)
                }, error);
                throw new Error(`PDF 文件读取失败：${filename}`);
            }

            let pdf;
            try {
                pdf = await root.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
            } catch (error) {
                console.warn('[BATCH_DEBUG][pdf-render] worker 模式失败，尝试 disableWorker', {
                    filename,
                    message: error?.message || String(error)
                });

                try {
                    pdf = await root.pdfjsLib.getDocument({
                        data: new Uint8Array(buffer.slice(0)),
                        disableWorker: true
                    }).promise;
                } catch (fallbackError) {
                    console.error('[BATCH_DEBUG][pdf-render-failed] PDF.js 无法打开文件', {
                        filename,
                        message: fallbackError?.message || String(fallbackError)
                    }, fallbackError);
                    throw new Error(`PDF.js 无法打开文件：${filename}`);
                }
            }

            const pages = root.Qisi.Utils.expandPageRange(file.pageRange, pdf.numPages);
            recordRenderedPages(pages.length);

            if (pages.length > 20) {
                const estimated = estimateVisionCalls(
                    pages.length,
                    getRecognitionMode()
                );
                const message = `当前 PDF 页数较多，预计会产生约 ${estimated} 次 Qwen 视觉识别调用。建议先用 1-2 页测试，或使用省钱模式。`;
                console.warn('[BATCH_COST][estimate]', {
                    filename,
                    pageCount: pages.length,
                    mode: getRecognitionMode(),
                    estimatedVisionCalls: estimated,
                    message
                });
                showBatchToast(message);
            }

            if (!pages.length) {
                console.error('[BATCH_DEBUG][pdf-render-failed] 页码范围为空', {
                    filename,
                    pageRange: file.pageRange,
                    numPages: pdf.numPages
                });
                throw new Error(`PDF 页码范围为空：${filename}`);
            }

            const rendered = [];
            const renderFailures = [];
            const renderAttemptDiagnostics = [];

            const waitForPdfRenderTask = async (renderTask, ms, label) => {
                let timer = null;
                let timedOut = false;

                try {
                    await Promise.race([
                        renderTask.promise,
                        new Promise((_, reject) => {
                            timer = setTimeout(() => {
                                timedOut = true;
                                try {
                                    renderTask.cancel();
                                } catch (cancelError) {
                                    console.warn('[BATCH_DEBUG][pdf-render-cancel-failed]', {
                                        filename,
                                        label,
                                        message: cancelError?.message || String(cancelError)
                                    });
                                }
                                const error = new Error(`${label} 超时：超过 ${Math.round(ms / 1000)} 秒未返回`);
                                error.code = 'PDF_RENDER_PAGE_TIMEOUT';
                                error.timedOut = true;
                                reject(error);
                            }, ms);
                        })
                    ]);
                } catch (error) {
                    if (timedOut) {
                        try {
                            await renderTask.promise;
                        } catch (cancelledError) {
                            const cancelledName = String(cancelledError?.name || '');
                            if (
                                cancelledName !== 'RenderingCancelledException' &&
                                !/cancel/i.test(cancelledError?.message || '')
                            ) {
                                console.warn('[BATCH_DEBUG][pdf-render-cancel-settle]', {
                                    filename,
                                    label,
                                    message: cancelledError?.message || String(cancelledError)
                                });
                            }
                        }
                    }
                    throw error;
                } finally {
                    if (timer) clearTimeout(timer);
                }
            };

            const renderPdfPageWithRetries = async (page, pageNo) => {
                const attempts = [];
                let lastError = null;

                for (let attemptIndex = 0; attemptIndex < renderRetryScales.length; attemptIndex += 1) {
                    const scale = renderRetryScales[attemptIndex];
                    let stage = 'render-page';
                    let canvasWidth = 0;
                    let canvasHeight = 0;
                    let renderTask = null;

                    try {
                        const viewport = page.getViewport({ scale });
                        const canvas = root.document.createElement('canvas');
                        canvas.width = Math.ceil(viewport.width);
                        canvas.height = Math.ceil(viewport.height);
                        canvasWidth = canvas.width;
                        canvasHeight = canvas.height;

                        const ctx = canvas.getContext('2d', { alpha: false });
                        if (!ctx) throw new Error('Canvas 2D 上下文创建失败');

                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);

                        console.log('[BATCH_DEBUG][pdf-render-page-start]', {
                            filename,
                            pageNo,
                            attempt: attemptIndex + 1,
                            scale,
                            timeoutMs: pageRenderTimeoutMs,
                            canvasWidth: canvas.width,
                            canvasHeight: canvas.height
                        });

                        renderTask = page.render({ canvasContext: ctx, viewport });
                        await waitForPdfRenderTask(
                            renderTask,
                            pageRenderTimeoutMs,
                            `${filename} 第 ${pageNo} 页 PDF 渲染 scale=${scale}`
                        );

                        let url = '';
                        stage = 'export-image';
                        try {
                            url = canvas.toDataURL('image/jpeg', jpegQuality);
                        } catch (error) {
                            console.warn('[BATCH_DEBUG][pdf-render] JPEG 导出失败，降级 PNG', {
                                filename,
                                pageNo,
                                attempt: attemptIndex + 1,
                                scale,
                                message: error?.message || String(error)
                            });
                            url = canvas.toDataURL('image/png');
                        }

                        if (!url || url.length < 1000) {
                            stage = 'empty-image';
                            throw new Error(`第 ${pageNo} 页导出的图片为空`);
                        }

                        attempts.push({
                            pageNo,
                            attempt: attemptIndex + 1,
                            scale,
                            timeoutMs: pageRenderTimeoutMs,
                            stage,
                            ok: true,
                            canvasWidth,
                            canvasHeight,
                            urlLength: url.length
                        });

                        return {
                            pageNo,
                            url,
                            scale,
                            canvasWidth,
                            canvasHeight,
                            attempts
                        };
                    } catch (error) {
                        lastError = error;
                        attempts.push({
                            pageNo,
                            attempt: attemptIndex + 1,
                            scale,
                            timeoutMs: pageRenderTimeoutMs,
                            stage,
                            ok: false,
                            timedOut: Boolean(error?.timedOut || error?.code === 'PDF_RENDER_PAGE_TIMEOUT'),
                            message: error?.message || String(error),
                            canvasWidth,
                            canvasHeight
                        });

                        console.warn('[BATCH_DEBUG][pdf-render-page-attempt-failed]', {
                            filename,
                            pageNo,
                            attempt: attemptIndex + 1,
                            scale,
                            timeoutMs: pageRenderTimeoutMs,
                            stage,
                            timedOut: Boolean(error?.timedOut || error?.code === 'PDF_RENDER_PAGE_TIMEOUT'),
                            message: error?.message || String(error)
                        });
                    } finally {
                        try {
                            page.cleanup?.();
                        } catch (cleanupError) {
                            console.warn('[BATCH_DEBUG][pdf-render-page-cleanup-failed]', {
                                filename,
                                pageNo,
                                message: cleanupError?.message || String(cleanupError)
                            });
                        }
                    }
                }

                const error = lastError || new Error(`第 ${pageNo} 页 PDF 渲染失败`);
                error.renderAttempts = attempts;
                throw error;
            };

            console.groupCollapsed(`[BATCH_DEBUG][pdf-render-start] ${filename}`);
            console.table(pages.map(pageNo => ({
                pageNo,
                numPages: pdf.numPages,
                pageRange: file.pageRange || '全部'
            })));
            console.groupEnd();

            for (const pageNo of pages) {
                let stage = 'get-page';
                let canvasWidth = 0;
                let canvasHeight = 0;

                try {
                    const page = await pdf.getPage(pageNo);

                    const pageResult = await renderPdfPageWithRetries(page, pageNo);
                    canvasWidth = pageResult.canvasWidth;
                    canvasHeight = pageResult.canvasHeight;
                    stage = 'render-page';
                    renderAttemptDiagnostics.push(...pageResult.attempts);
                    rendered.push({ pageNo, url: pageResult.url });

                    console.log('[BATCH_DEBUG][pdf-render-page-ok]', {
                        filename,
                        pageNo,
                        scale: pageResult.scale,
                        width: pageResult.canvasWidth,
                        height: pageResult.canvasHeight,
                        urlLength: pageResult.url.length,
                        attempts: pageResult.attempts
                    });
                } catch (error) {
                    if (Array.isArray(error?.renderAttempts)) {
                        renderAttemptDiagnostics.push(...error.renderAttempts);
                        const lastAttempt = error.renderAttempts[error.renderAttempts.length - 1];
                        if (lastAttempt) {
                            stage = lastAttempt.stage || stage;
                            canvasWidth = lastAttempt.canvasWidth || canvasWidth;
                            canvasHeight = lastAttempt.canvasHeight || canvasHeight;
                        }
                    }
                    console.error('[BATCH_DEBUG][pdf-render-page-failed]', {
                        filename,
                        pageNo,
                        message: error?.message || String(error)
                    }, error);
                    renderFailures.push({
                        filename,
                        pageNo,
                        message: error?.message || String(error),
                        stackHead: String(error?.stack || '').split('\n').slice(0, 5).join('\n'),
                        canvasWidth,
                        canvasHeight,
                        renderScale,
                        stage,
                        attempts: Array.isArray(error?.renderAttempts) ? error.renderAttempts : []
                    });
                }
            }

            console.groupCollapsed(`[BATCH_DEBUG][pdf-render-final] ${filename}`);
            console.table(rendered.map(page => ({
                pageNo: page.pageNo,
                hasUrl: Boolean(page.url),
                urlLength: String(page.url || '').length
            })));
            console.groupEnd();

            const pdfRenderSummaryPayload = {
                filename,
                convertedFromDocx: Boolean(file?.convertedFromDocx),
                sourceDocxFileName: file?.sourceDocxFileName || '',
                pageRange: file?.pageRange || '',
                numPages: pdf?.numPages || 0,
                requestedPages: pages,
                renderedPageNos: rendered.map(page => page.pageNo),
                failedPageNos: renderFailures.map(item => item.pageNo),
                renderFailureCount: renderFailures.length,
                renderAttempts: renderAttemptDiagnostics.map(item => ({
                    pageNo: item.pageNo,
                    attempt: item.attempt,
                    scale: item.scale,
                    timeoutMs: item.timeoutMs,
                    stage: item.stage,
                    ok: item.ok,
                    timedOut: item.timedOut,
                    message: item.message || '',
                    canvasWidth: item.canvasWidth,
                    canvasHeight: item.canvasHeight,
                    urlLength: item.urlLength || 0
                })),
                renderFailures: renderFailures.map(item => ({
                    pageNo: item.pageNo,
                    stage: item.stage,
                    message: item.message,
                    canvasWidth: item.canvasWidth,
                    canvasHeight: item.canvasHeight,
                    attempts: (item.attempts || []).map(attempt => ({
                        attempt: attempt.attempt,
                        scale: attempt.scale,
                        timeoutMs: attempt.timeoutMs,
                        stage: attempt.stage,
                        ok: attempt.ok,
                        timedOut: attempt.timedOut,
                        message: attempt.message || ''
                    }))
                }))
            };

            console.log('[BATCH_DEBUG][pdf-render-pages-summary]', pdfRenderSummaryPayload);
            logBatchPdfDiag('render-pages-summary', {
                filename,
                fileType: file?.fileType || '',
                roles: getBatchFileRoles(file),
                pageCount: pdfRenderSummaryPayload.numPages,
                requestedPageCount: pages.length,
                successPageCount: rendered.length,
                failedPageCount: renderFailures.length,
                failedPageNos: renderFailures.map(item => item.pageNo),
                renderedPageNos: rendered.map(page => page.pageNo),
                renderAttempts: pdfRenderSummaryPayload.renderAttempts
            });

            if (!rendered.length) {
                const error = new Error(
                    isConvertedDocxQuestionPdf
                        ? `DOCX 题目文件已转 PDF，但所有请求页面都渲染失败：${filename}。已停止严格视觉识别，避免生成草稿。`
                        : `PDF 页面图渲染失败：${filename}。禁止继续用文本层生成草稿。`
                );
                error.code = isConvertedDocxQuestionPdf
                    ? 'DOCX_QUESTION_PDF_RENDER_INCOMPLETE'
                    : 'PDF_RENDER_ALL_PAGES_FAILED';
                error.stage = 'pdf-render';
                error.renderDiagnostics = {
                    filename,
                    fileId: file?.id || '',
                    fileType: file?.fileType || '',
                    convertedFromDocx: Boolean(file?.convertedFromDocx),
                    sourceDocxFileName: file?.sourceDocxFileName || '',
                    uploadPathLength: String(file?.uploadPath || '').length,
                    uploadPathHead: String(file?.uploadPath || '').slice(0, 80),
                    numPages: pdf?.numPages || 0,
                    requestedPages: pages,
                    renderedPageNos: [],
                    failedPageNos: renderFailures.map(item => item.pageNo),
                    renderScale,
                    renderRetryScales,
                    jpegQuality,
                    pageRenderTimeoutMs,
                    renderFailures,
                    renderAttempts: renderAttemptDiagnostics
                };
                throw error;
            }

            if (isConvertedDocxQuestionPdf && renderFailures.length) {
                const error = new Error(
                    `DOCX 题目文件已转 PDF，但页面图渲染不完整：` +
                    `请求页 ${pages.join(',')}，成功页 ${rendered.map(page => page.pageNo).join(',') || '无'}，` +
                    `失败页 ${renderFailures.map(item => item.pageNo).join(',')}。` +
                    `已停止严格视觉识别，避免只用部分页面生成草稿。`
                );
                error.code = 'DOCX_QUESTION_PDF_RENDER_INCOMPLETE';
                error.stage = 'pdf-render';
                error.renderDiagnostics = {
                    filename,
                    fileId: file?.id || '',
                    fileType: file?.fileType || '',
                    convertedFromDocx: Boolean(file?.convertedFromDocx),
                    sourceDocxFileName: file?.sourceDocxFileName || '',
                    uploadPathLength: String(file?.uploadPath || '').length,
                    uploadPathHead: String(file?.uploadPath || '').slice(0, 80),
                    numPages: pdf?.numPages || 0,
                    requestedPages: pages,
                    renderedPageNos: rendered.map(page => page.pageNo),
                    failedPageNos: renderFailures.map(item => item.pageNo),
                    renderScale,
                    renderRetryScales,
                    jpegQuality,
                    pageRenderTimeoutMs,
                    renderFailures,
                    renderAttempts: renderAttemptDiagnostics
                };
                console.error('[BATCH_DEBUG][pdf-render-failed]', {
                    code: error.code,
                    filename,
                    requestedPages: pages,
                    renderedPageNos: error.renderDiagnostics.renderedPageNos,
                    failedPageNos: error.renderDiagnostics.failedPageNos,
                    renderAttempts: renderAttemptDiagnostics
                });
                throw error;
            }

            return rendered;
        };


        return Object.freeze({ renderPdfFilePages });
    }

    return Object.freeze({ createBrowserPdfRenderer });
});
