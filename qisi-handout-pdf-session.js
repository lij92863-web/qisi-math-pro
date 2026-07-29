(function (root, factory) {
    const documentModule = root.Qisi?.HandoutDocument
        || (
            typeof require === 'function'
                ? require('./qisi-handout-document.js')
                : null
        );
    const compilerClientModule = root.Qisi?.HandoutCompilerClient
        || (
            typeof require === 'function'
                ? require('./qisi-handout-compiler-client.js')
                : null
        );
    const api = factory(root, documentModule, compilerClientModule);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutPdfSession = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function (root, documentModule, compilerClientModule) {
        'use strict';

        if (!documentModule || !compilerClientModule) {
            throw new Error(
                'HandoutPdfSession requires HandoutDocument and HandoutCompilerClient.'
            );
        }

        const PDFJS_SCRIPT_PATH =
            './vendor/pdfjs-dist/3.11.174/pdf.min.js';
        const PDFJS_WORKER_PATH =
            './vendor/pdfjs-dist/3.11.174/pdf.worker.min.js';
        const ASSET_MIME_EXTENSIONS = Object.freeze({
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg'
        });
        const PDF_SIGNATURE = '%PDF-';
        let sharedPdfJsPromise = null;

        const createError = (code, message, diagnostics = []) => {
            const error = new Error(message);
            error.code = code;
            error.diagnostics = diagnostics;
            return error;
        };

        const assertSameOrigin = value => {
            const parsed = new URL(value, root.location?.href);
            if (
                root.location?.origin
                && parsed.origin !== root.location.origin
            ) {
                throw createError(
                    'HANDOUT_EXTERNAL_PREVIEW_ASSET',
                    `PDF preview asset must be local: ${parsed.href}`
                );
            }
            return parsed.href;
        };

        const isBlob = value =>
            typeof Blob !== 'undefined'
            && value instanceof Blob;

        const safeAssetSlug = value => {
            const slug = String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9._-]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 48);
            return slug || 'asset';
        };

        const normalizeAssetRecord = (
            record,
            index,
            handoutId
        ) => {
            const id = String(record?.id || '').trim();
            const mimeType = String(
                record?.mimeType || record?.blob?.type || ''
            ).toLowerCase();
            if (!id) {
                throw createError(
                    'HANDOUT_ASSET_ID_MISSING',
                    `Asset record ${index + 1} has no id.`
                );
            }
            if (
                handoutId
                && String(record?.handoutId || '') !== handoutId
            ) {
                throw createError(
                    'HANDOUT_ASSET_OWNERSHIP_MISMATCH',
                    `Asset ${id} does not belong to handout ${handoutId}.`
                );
            }
            if (!isBlob(record?.blob) || record.blob.size < 1) {
                throw createError(
                    'HANDOUT_ASSET_BYTES_MISSING',
                    `Asset ${id} has no local bytes.`
                );
            }
            const extension = ASSET_MIME_EXTENSIONS[mimeType];
            if (!extension) {
                throw createError(
                    'HANDOUT_ASSET_TYPE_UNSUPPORTED',
                    `Asset ${id} has unsupported MIME type ${mimeType || 'unknown'}.`
                );
            }
            return {
                id,
                mimeType,
                blob: record.blob,
                path: `/assets/${String(index + 1).padStart(3, '0')}-${safeAssetSlug(id)}.${extension}`
            };
        };

        const normalizeAssetRecords = (
            records,
            handoutId = ''
        ) => {
            const sorted = [...(Array.isArray(records) ? records : [])]
                .sort((left, right) =>
                    String(left?.id || '').localeCompare(
                        String(right?.id || '')
                    )
                );
            const normalized = sorted.map((record, index) =>
                normalizeAssetRecord(record, index, handoutId)
            );
            if (
                new Set(normalized.map(record => record.id)).size
                !== normalized.length
            ) {
                throw createError(
                    'HANDOUT_ASSET_DUPLICATE',
                    'Handout asset ids must be unique.'
                );
            }
            return normalized;
        };

        const createAssetPathById = (
            records,
            handoutId = ''
        ) => Object.freeze(Object.fromEntries(
            normalizeAssetRecords(records, handoutId)
                .map(record => [record.id, record.path])
        ));

        const assertSafeSvg = async record => {
            if (record.mimeType !== 'image/svg+xml') return;
            const source = await record.blob.text();
            if (
                /(?:href|src)\s*=\s*["']\s*(?:https?:|file:|\/\/)/i
                    .test(source)
            ) {
                throw createError(
                    'HANDOUT_SVG_EXTERNAL_REFERENCE',
                    `SVG asset ${record.id} contains an external reference.`
                );
            }
        };

        const assertDocumentReady = generated => {
            const diagnostics = Array.isArray(generated?.diagnostics)
                ? generated.diagnostics
                : [];
            if (!generated?.readyForCompile || diagnostics.length) {
                throw createError(
                    'HANDOUT_EXPORT_BLOCKED',
                    diagnostics[0]?.message
                        || 'The handout document is not ready for export.',
                    diagnostics
                );
            }
            if (
                typeof generated.source !== 'string'
                || !generated.source.trim()
                || !Array.isArray(generated.lineMap)
                || !generated.lineMap.length
            ) {
                throw createError(
                    'HANDOUT_DOCUMENT_INVALID',
                    'The handout document has no trusted source or line map.'
                );
            }
        };

        const prepareCompilePayload = async (
            generated,
            records
        ) => {
            assertDocumentReady(generated);
            const normalized = normalizeAssetRecords(records);
            const byId = new Map(
                normalized.map(record => [record.id, record])
            );
            const assets = [];
            const paths = new Set();

            for (const request of generated.assetRequests || []) {
                if (paths.has(request.path)) continue;
                const record = byId.get(String(request.assetId || ''));
                if (!record) {
                    throw createError(
                        'HANDOUT_ASSET_MISSING',
                        `Required asset ${request.assetId} is unavailable.`,
                        [{
                            code: 'HANDOUT_ASSET_MISSING',
                            severity: 'error',
                            blockId: request.blockId || 'document',
                            formulaId: null,
                            message: `Missing asset ${request.assetId}.`
                        }]
                    );
                }
                if (record.path !== request.path) {
                    throw createError(
                        'HANDOUT_ASSET_PATH_MISMATCH',
                        `Asset ${record.id} does not match its generated path.`
                    );
                }
                await assertSafeSvg(record);
                assets.push({
                    path: record.path,
                    mimeType: record.mimeType,
                    bytes: await record.blob.arrayBuffer()
                });
                paths.add(record.path);
            }

            return {
                source: generated.source,
                lineMap: generated.lineMap,
                assets
            };
        };

        const loadLocalPdfJs = ({
            documentObject = root.document,
            scriptUrl = PDFJS_SCRIPT_PATH,
            workerUrl = PDFJS_WORKER_PATH
        } = {}) => {
            if (root.pdfjsLib) {
                root.pdfjsLib.GlobalWorkerOptions.workerSrc =
                    assertSameOrigin(workerUrl);
                return Promise.resolve(root.pdfjsLib);
            }
            if (sharedPdfJsPromise) return sharedPdfJsPromise;
            if (!documentObject?.createElement) {
                return Promise.reject(createError(
                    'HANDOUT_PDFJS_UNAVAILABLE',
                    'PDF.js requires a browser document.'
                ));
            }

            const safeScriptUrl = assertSameOrigin(scriptUrl);
            const safeWorkerUrl = assertSameOrigin(workerUrl);
            sharedPdfJsPromise = new Promise((resolve, reject) => {
                const existing = documentObject.querySelector(
                    'script[data-tex-handout-pdfjs]'
                );
                const script = existing
                    || documentObject.createElement('script');
                const onLoad = () => {
                    if (!root.pdfjsLib) {
                        sharedPdfJsPromise = null;
                        reject(createError(
                            'HANDOUT_PDFJS_UNAVAILABLE',
                            'The local PDF.js runtime did not initialize.'
                        ));
                        return;
                    }
                    root.pdfjsLib.GlobalWorkerOptions.workerSrc =
                        safeWorkerUrl;
                    resolve(root.pdfjsLib);
                };
                const onError = () => {
                    sharedPdfJsPromise = null;
                    reject(createError(
                        'HANDOUT_PDFJS_LOAD_FAILED',
                        'The local PDF.js runtime could not be loaded.'
                    ));
                };
                script.addEventListener('load', onLoad, { once: true });
                script.addEventListener('error', onError, { once: true });
                if (!existing) {
                    script.src = safeScriptUrl;
                    script.async = true;
                    script.dataset.texHandoutPdfjs = 'true';
                    documentObject.head.appendChild(script);
                }
            });
            return sharedPdfJsPromise;
        };

        const safeDownloadName = value => {
            const name = String(value || 'TEX-handout.pdf')
                .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
                .trim()
                .slice(0, 160);
            return /\.pdf$/i.test(name)
                ? name
                : `${name || 'TEX-handout'}.pdf`;
        };

        const createPdfSession = ({
            compilerClient = compilerClientModule.createCompilerClient(),
            lifecycleTarget = root,
            documentObject = root.document,
            urlApi = root.URL,
            blobConstructor = root.Blob,
            onStateChange = () => {},
            pdfJsLoader = loadLocalPdfJs
        } = {}) => {
            let artifact = null;
            let disposed = false;
            let renderTask = null;
            let pdfDocument = null;
            let state = Object.freeze({
                phase: 'idle',
                requestId: null,
                edition: null,
                diagnostics: Object.freeze([]),
                metrics: null,
                byteLength: 0,
                pageCount: 0
            });

            const emitState = patch => {
                state = Object.freeze({
                    ...state,
                    ...patch
                });
                onStateChange(state);
            };

            const releasePdfDocument = () => {
                renderTask?.cancel?.();
                renderTask = null;
                pdfDocument?.destroy?.();
                pdfDocument = null;
            };

            const clearArtifact = () => {
                releasePdfDocument();
                if (artifact?.url) {
                    urlApi.revokeObjectURL(artifact.url);
                }
                artifact = null;
                emitState({
                    byteLength: 0,
                    pageCount: 0
                });
            };

            const assertOpen = () => {
                if (disposed) {
                    throw createError(
                        'HANDOUT_PDF_SESSION_DISPOSED',
                        'The formal PDF session has been closed.'
                    );
                }
            };

            const installArtifact = (
                response,
                generated
            ) => {
                const bytes = new Uint8Array(response.pdfBytes);
                const signature = String.fromCharCode(
                    ...bytes.slice(0, PDF_SIGNATURE.length)
                );
                if (
                    signature !== PDF_SIGNATURE
                    || bytes.byteLength < 100
                ) {
                    throw createError(
                        'HANDOUT_PDF_INVALID',
                        'The compiler returned invalid PDF bytes.'
                    );
                }
                const stableBytes = bytes.slice();
                const blob = new blobConstructor([stableBytes], {
                    type: 'application/pdf'
                });
                const url = urlApi.createObjectURL(blob);
                artifact = Object.freeze({
                    url,
                    blob,
                    bytes: stableBytes,
                    generated,
                    diagnostics: Object.freeze(
                        response.diagnostics || []
                    ),
                    metrics: response.metrics || null
                });
                emitState({
                    phase: 'ready',
                    requestId: response.requestId,
                    edition: generated.edition || null,
                    diagnostics: artifact.diagnostics,
                    metrics: artifact.metrics,
                    byteLength: stableBytes.byteLength,
                    pageCount: 0
                });
                return artifact;
            };

            const compileGenerated = async (
                generated,
                assetRecords = []
            ) => {
                assertOpen();
                clearArtifact();
                emitState({
                    phase: 'preparing',
                    edition: generated?.edition || null,
                    diagnostics: Object.freeze([]),
                    metrics: null
                });

                try {
                    const payload = await prepareCompilePayload(
                        generated,
                        assetRecords
                    );
                    emitState({ phase: 'compiling' });
                    const response = await compilerClient.compile(payload);
                    return installArtifact(response, generated);
                } catch (error) {
                    clearArtifact();
                    emitState({
                        phase: error?.name === 'AbortError'
                            ? 'cancelled'
                            : 'failed',
                        requestId: null,
                        diagnostics: Object.freeze(
                            error?.diagnostics || []
                        ),
                        metrics: error?.metrics || null
                    });
                    throw error;
                }
            };

            const compileHandout = async (
                handout,
                edition,
                {
                    assetRecords = []
                } = {}
            ) => {
                assertOpen();
                const handoutId = String(handout?.id || '');
                const assetPathById = createAssetPathById(
                    assetRecords,
                    handoutId
                );
                const generated = documentModule.buildTypstDocument(
                    handout,
                    edition,
                    { assetPathById }
                );
                return compileGenerated(generated, assetRecords);
            };

            const renderPreview = async (
                canvas,
                {
                    pageNumber = 1,
                    scale = 1.35
                } = {}
            ) => {
                assertOpen();
                if (!artifact) {
                    throw createError(
                        'HANDOUT_PDF_NOT_READY',
                        'Compile the handout before opening formal preview.'
                    );
                }
                if (!canvas?.getContext) {
                    throw new TypeError(
                        'PDF preview requires a canvas element.'
                    );
                }
                releasePdfDocument();
                const pdfjs = await pdfJsLoader({
                    documentObject
                });
                const loadingTask = pdfjs.getDocument({
                    url: artifact.url
                });
                pdfDocument = await loadingTask.promise;
                if (
                    !Number.isInteger(pageNumber)
                    || pageNumber < 1
                    || pageNumber > pdfDocument.numPages
                ) {
                    throw createError(
                        'HANDOUT_PDF_PAGE_INVALID',
                        `PDF page ${pageNumber} is unavailable.`
                    );
                }
                const page = await pdfDocument.getPage(pageNumber);
                const viewport = page.getViewport({ scale });
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const context = canvas.getContext('2d', {
                    alpha: false
                });
                renderTask = page.render({
                    canvasContext: context,
                    viewport
                });
                await renderTask.promise;
                renderTask = null;
                emitState({ pageCount: pdfDocument.numPages });
                return Object.freeze({
                    pageNumber,
                    pageCount: pdfDocument.numPages,
                    width: canvas.width,
                    height: canvas.height,
                    previewUrl: artifact.url
                });
            };

            const getDownloadDescriptor = filename => {
                assertOpen();
                if (!artifact) {
                    throw createError(
                        'HANDOUT_PDF_NOT_READY',
                        'Compile the handout before downloading it.'
                    );
                }
                return Object.freeze({
                    href: artifact.url,
                    filename: safeDownloadName(filename),
                    byteLength: artifact.bytes.byteLength,
                    mimeType: 'application/pdf'
                });
            };

            const download = filename => {
                const descriptor = getDownloadDescriptor(filename);
                if (!documentObject?.createElement) return descriptor;
                const link = documentObject.createElement('a');
                link.href = descriptor.href;
                link.download = descriptor.filename;
                link.rel = 'noopener';
                link.hidden = true;
                documentObject.body.appendChild(link);
                link.click();
                link.remove();
                return descriptor;
            };

            const cancel = reason => compilerClient.cancel(
                undefined,
                reason
            );

            const closePreview = () => {
                clearArtifact();
                emitState({
                    phase: 'idle',
                    requestId: null,
                    edition: null,
                    diagnostics: Object.freeze([]),
                    metrics: null
                });
            };

            const dispose = () => {
                if (disposed) return;
                disposed = true;
                lifecycleTarget?.removeEventListener?.(
                    'beforeunload',
                    dispose
                );
                lifecycleTarget?.removeEventListener?.(
                    'pagehide',
                    dispose
                );
                clearArtifact();
                compilerClient.dispose();
            };

            lifecycleTarget?.addEventListener?.(
                'beforeunload',
                dispose,
                { once: true }
            );
            lifecycleTarget?.addEventListener?.(
                'pagehide',
                dispose,
                { once: true }
            );

            return Object.freeze({
                compileHandout,
                compileGenerated,
                renderPreview,
                getDownloadDescriptor,
                download,
                cancel,
                closePreview,
                dispose,
                getState: () => state,
                hasArtifact: () => Boolean(artifact),
                getPreviewUrl: () => artifact?.url || '',
                copyPdfBytes: () =>
                    artifact?.bytes.slice() || new Uint8Array()
            });
        };

        return {
            PDFJS_SCRIPT_PATH,
            PDFJS_WORKER_PATH,
            ASSET_MIME_EXTENSIONS,
            createAssetPathById,
            prepareCompilePayload,
            loadLocalPdfJs,
            safeDownloadName,
            createPdfSession
        };
    }
);
