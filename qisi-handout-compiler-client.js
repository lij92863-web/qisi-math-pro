(function (root, factory) {
    const api = factory(root);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutCompilerClient = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function (root) {
        'use strict';

        const DEFAULT_TIMEOUT_MS = 120_000;
        const MESSAGE = Object.freeze({
            compile: 'compile',
            compiled: 'compiled',
            failed: 'compile-failed',
            progress: 'progress'
        });

        let requestSequence = 0;

        const createError = (code, message, name = 'Error') => {
            const error = new Error(message);
            error.name = name;
            error.code = code;
            return error;
        };

        const createAbortError = message => createError(
            'HANDOUT_COMPILE_CANCELLED',
            message || 'Handout compilation was cancelled.',
            'AbortError'
        );

        const defaultWorkerUrl = () => {
            if (!root.location?.href) {
                throw createError(
                    'HANDOUT_COMPILER_WORKER_URL_REQUIRED',
                    'A Worker URL is required outside the browser.'
                );
            }
            return new URL(
                './workers/qisi-handout-typst-worker.mjs',
                root.location.href
            ).href;
        };

        const defaultWorkerFactory = url => {
            if (typeof root.Worker !== 'function') {
                throw createError(
                    'HANDOUT_COMPILER_WORKER_UNAVAILABLE',
                    'This browser does not support Web Workers.'
                );
            }
            return new root.Worker(url, {
                type: 'module',
                name: 'tex-handout-typst-compiler'
            });
        };

        const nextRequestId = () => {
            requestSequence += 1;
            return `h5-${Date.now().toString(36)}-${requestSequence.toString(36)}`;
        };

        const collectTransfers = assets =>
            (Array.isArray(assets) ? assets : [])
                .map(asset => asset?.bytes)
                .filter(bytes => bytes instanceof ArrayBuffer);

        const createCompilerClient = ({
            workerUrl,
            workerFactory = defaultWorkerFactory,
            timeoutMs = DEFAULT_TIMEOUT_MS,
            onProgress = () => {}
        } = {}) => {
            let worker = null;
            let active = null;
            let disposed = false;

            const terminateWorker = () => {
                worker?.terminate();
                worker = null;
            };

            const rejectActive = error => {
                if (!active) return;
                clearTimeout(active.timer);
                const { reject } = active;
                active = null;
                reject(error);
            };

            const failWorker = error => {
                const failure = createError(
                    'HANDOUT_COMPILER_WORKER_FAILED',
                    String(error?.message || error || 'Typst Worker failed.')
                );
                terminateWorker();
                rejectActive(failure);
            };

            const handleMessage = message => {
                if (
                    message?.type === MESSAGE.progress
                    && message.requestId === active?.requestId
                ) {
                    onProgress(message);
                    return;
                }
                if (
                    !active
                    || message?.requestId !== active.requestId
                ) {
                    return;
                }

                const pending = active;
                clearTimeout(pending.timer);
                active = null;
                if (message.type === MESSAGE.compiled) {
                    pending.resolve(message);
                    return;
                }

                const error = createError(
                    'HANDOUT_COMPILE_FAILED',
                    message?.error || 'Typst compilation failed.'
                );
                error.diagnostics = Array.isArray(message?.diagnostics)
                    ? message.diagnostics
                    : [];
                error.metrics = message?.metrics || null;
                pending.reject(error);
            };

            const ensureWorker = () => {
                if (disposed) {
                    throw createError(
                        'HANDOUT_COMPILER_DISPOSED',
                        'The handout compiler has been disposed.'
                    );
                }
                if (worker) return worker;
                const resolvedWorkerUrl = workerUrl
                    || (
                        workerFactory === defaultWorkerFactory
                            ? defaultWorkerUrl()
                            : 'test://handout-compiler-worker'
                    );
                worker = workerFactory(resolvedWorkerUrl);
                worker.addEventListener(
                    'message',
                    event => handleMessage(event.data)
                );
                worker.addEventListener('error', failWorker);
                return worker;
            };

            const compile = request => {
                if (disposed) {
                    return Promise.reject(createError(
                        'HANDOUT_COMPILER_DISPOSED',
                        'The handout compiler has been disposed.'
                    ));
                }
                if (active) {
                    return Promise.reject(createError(
                        'HANDOUT_COMPILE_BUSY',
                        `Compile request ${active.requestId} is still running.`
                    ));
                }
                const requestId = String(
                    request?.requestId || nextRequestId()
                );
                const message = {
                    type: MESSAGE.compile,
                    requestId,
                    source: request?.source,
                    lineMap: request?.lineMap,
                    assets: request?.assets || []
                };

                return new Promise((resolve, reject) => {
                    let target;
                    try {
                        target = ensureWorker();
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    const timer = setTimeout(() => {
                        if (active?.requestId !== requestId) return;
                        terminateWorker();
                        rejectActive(createError(
                            'HANDOUT_COMPILE_TIMEOUT',
                            `Handout compilation exceeded ${timeoutMs}ms.`
                        ));
                    }, timeoutMs);
                    active = {
                        requestId,
                        resolve,
                        reject,
                        timer
                    };
                    target.postMessage(
                        message,
                        collectTransfers(message.assets)
                    );
                });
            };

            const cancel = (
                requestId = active?.requestId,
                reason = 'Handout compilation was cancelled.'
            ) => {
                if (
                    !active
                    || (
                        requestId
                        && requestId !== active.requestId
                    )
                ) {
                    return false;
                }
                terminateWorker();
                rejectActive(createAbortError(reason));
                return true;
            };

            const dispose = () => {
                if (disposed) return;
                disposed = true;
                terminateWorker();
                rejectActive(createAbortError(
                    'The handout compiler was closed.'
                ));
            };

            return Object.freeze({
                compile,
                cancel,
                dispose,
                hasWorker: () => Boolean(worker),
                activeRequestId: () => active?.requestId || null
            });
        };

        return {
            DEFAULT_TIMEOUT_MS,
            MESSAGE,
            createAbortError,
            createCompilerClient
        };
    }
);
