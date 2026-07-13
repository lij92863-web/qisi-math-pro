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

    const createQwenAdapter = ({
        request,
        engineVersion = 'unknown',
        maxBytes = 20 * 1024 * 1024,
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
                    requestId
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
                maxBytes
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
    return Object.freeze({ createQwenAdapter });
});
