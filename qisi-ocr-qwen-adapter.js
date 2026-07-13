(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrQwenAdapter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const contracts = () => root.Qisi?.RecognitionContracts ||
        (typeof require === 'function' ? require('./qisi-recognition-contracts.js') : null);
    const adapterContract = () => root.Qisi?.OcrAdapterContract ||
        (typeof require === 'function' ? require('./qisi-ocr-adapter-contract.js') : null);

    const createQwenProxyTransport = ({
        fetchImpl,
        onAiRequest,
        chatUrl = ['', 'api', 'ai', 'chat'].join('/'),
        ocrUrl = ['', 'api', 'ai', 'ocr'].join('/'),
        healthUrl = ['', 'api', 'ai', 'health'].join('/')
    } = {}) => {
        const proxyFetch = typeof fetchImpl === 'function'
            ? fetchImpl
            : typeof root.fetch === 'function'
                ? root.fetch.bind(root)
                : null;
        if (typeof proxyFetch !== 'function') {
            throw new TypeError('Qwen proxy fetch transport is required.');
        }
        const assertProxyUrl = value => {
            const url = String(value || '');
            if (!/^\/api\/ai\/[a-z0-9-]+$/i.test(url)) {
                throw new TypeError('Qwen transport requires a same-origin AI proxy endpoint.');
            }
            return url;
        };
        const endpoints = Object.freeze({
            chat: assertProxyUrl(chatUrl),
            ocr: assertProxyUrl(ocrUrl),
            health: assertProxyUrl(healthUrl)
        });
        const getEndpoint = kind => {
            if (kind === 'chat' || kind === 'ocr' || kind === 'health') {
                return endpoints[kind];
            }
            const error = new TypeError(`Unknown Qwen proxy route kind: ${kind}`);
            error.code = 'QWEN_PROXY_KIND_INVALID';
            throw error;
        };
        const request = async (
            kind,
            options = {},
            ms = 90000,
            label = '网络请求'
        ) => {
            const url = getEndpoint(kind);
            if (kind === 'health') {
                const error = new TypeError('Health checks must use checkHealth().');
                error.code = 'QWEN_PROXY_KIND_INVALID';
                throw error;
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), ms);
            try {
                if (typeof onAiRequest === 'function') onAiRequest(label);
                return await proxyFetch(url, {
                    ...options,
                    signal: controller.signal
                });
            } catch (error) {
                if (error?.name === 'AbortError') {
                    throw new Error(
                        `${label} 超时：超过 ${Math.round(ms / 1000)} 秒未返回`
                    );
                }
                throw error;
            } finally {
                clearTimeout(timer);
            }
        };
        const checkHealth = async () => {
            const response = await proxyFetch(endpoints.health, {
                cache: 'no-store'
            });
            const data = await response.json();
            return {
                ok: response.ok && Boolean(data?.ok),
                status: response.status,
                configured: Boolean(data?.configured),
                chatUrl: endpoints.chat,
                ocrUrl: endpoints.ocr
            };
        };
        return Object.freeze({ request, checkHealth, getEndpoint });
    };

    const createQwenAdapter = ({
        request,
        engineVersion = 'unknown',
        maxBytes = 20 * 1024 * 1024,
        maxResponseChars = 5 * 1024 * 1024,
        logger,
        checkHealth
    } = {}) => {
        if (typeof request !== 'function') throw new TypeError('Qwen request transport is required.');
        const controllers = new Map();
        const recognize = async (input, options = {}) => {
            const boundary = adapterContract();
            const requestId = boundary.requireRequestId(options.requestId || `qwen_${Date.now()}`);
            if (controllers.has(requestId)) {
                const error = boundary.createError(
                    'duplicate-request-id',
                    requestId,
                    'OCR requestId is already active.'
                );
                boundary.emitSafeLog(logger, 'ocr-adapter-failure', {
                    engine: 'qwen-vl-plus', engineVersion, requestId, code: error.code
                });
                throw error;
            }
            boundary.validateInput(input, { requestId, maxBytes });
            const controller = new AbortController();
            controllers.set(requestId, controller);
            const started = Date.now();
            try {
                const response = boundary.validateResponse(
                    await request(input, { ...options, requestId, signal: controller.signal }),
                    requestId,
                    { maxResponseChars }
                );
                const candidate = contracts().createRecognitionCandidate({
                    engine: 'qwen-vl-plus', engineVersion, requestId,
                    sourceId: options.sourceId || input?.sourceId || '',
                    page: options.page ?? input?.page ?? null,
                    rawText: response?.rawText || '',
                    blocks: response?.blocks || [], formulas: response?.formulas || [],
                    images: response?.images || [],
                    rawEvidenceRef: boundary.rawEvidenceRef('qwen-vl-plus', requestId, response),
                    rawEvidence: response?.rawResult ?? response,
                    engineConfidence: response?.confidence ?? null,
                    warnings: response?.warnings || [], durationMs: Date.now() - started
                });
                if (!contracts().validateRecognitionCandidate(candidate).valid) {
                    throw boundary.createError(
                        'ocr-malformed-response',
                        requestId,
                        'OCR engine returned a malformed response.'
                    );
                }
                boundary.emitSafeLog(logger, 'ocr-adapter-success', {
                    engine: 'qwen-vl-plus', engineVersion, requestId,
                    durationMs: candidate.durationMs
                });
                return candidate;
            } catch (cause) {
                const error = boundary.mapTransportError(cause, requestId);
                boundary.emitSafeLog(logger, 'ocr-adapter-failure', {
                    engine: 'qwen-vl-plus', engineVersion, requestId, code: error.code,
                    durationMs: Date.now() - started
                });
                throw error;
            } finally {
                if (controllers.get(requestId) === controller) controllers.delete(requestId);
            }
        };
        return Object.freeze({
            healthCheck: async () => {
                if (typeof checkHealth !== 'function') {
                    return { ok: true, transportConfigured: true, engineVersion };
                }
                try {
                    const result = await checkHealth();
                    return { ok: result?.ok === true, transportConfigured: true, engineVersion };
                } catch (cause) {
                    return {
                        ok: false,
                        code: adapterContract().mapTransportError(cause, 'health-check').code,
                        engineVersion
                    };
                }
            },
            getCapabilities: () => ({
                pages: true,
                documents: true,
                formulas: true,
                images: true,
                mimeTypes: [...adapterContract().ALLOWED_MIME],
                maxBytes,
                maxResponseChars
            }),
            recognizePage: recognize,
            recognizeDocument: recognize,
            cancel(requestId) {
                const controller = controllers.get(requestId);
                if (!controller) return false;
                controller.abort();
                return true;
            }
        });
    };
    return Object.freeze({ createQwenProxyTransport, createQwenAdapter });
});
