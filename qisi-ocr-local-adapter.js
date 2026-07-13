(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrLocalAdapter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const contracts = () => root.Qisi?.RecognitionContracts ||
        (typeof require === 'function' ? require('./qisi-recognition-contracts.js') : null);
    const adapterContract = () => root.Qisi?.OcrAdapterContract ||
        (typeof require === 'function' ? require('./qisi-ocr-adapter-contract.js') : null);

    const createLocalAdapter = ({
        transport,
        endpoint = 'http://127.0.0.1:8765',
        maxBytes = 20 * 1024 * 1024,
        logger
    } = {}) => {
        if (typeof transport !== 'function') throw new TypeError('Local OCR transport is required.');
        const url = new URL(endpoint);
        if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
            throw new Error('Local OCR endpoint must be loopback.');
        }
        const controllers = new Map();
        const recognize = async (input, options = {}) => {
            const boundary = adapterContract();
            const requestId = boundary.requireRequestId(options.requestId || `local_${Date.now()}`);
            if (controllers.has(requestId)) {
                throw boundary.createError(
                    'duplicate-request-id',
                    requestId,
                    'OCR requestId is already active.'
                );
            }
            boundary.validateInput(input, {
                requestId,
                maxBytes,
                requireMime: true,
                requireBytes: true
            });
            const controller = new AbortController();
            controllers.set(requestId, controller);
            const started = Date.now();
            try {
                const response = boundary.validateResponse(
                    await transport(endpoint, input, { ...options, requestId, signal: controller.signal }),
                    requestId
                );
                const responseVersion = response?.engineVersion || 'unknown';
                const candidate = contracts().createRecognitionCandidate({
                    engine: 'local-ocr', engineVersion: response?.engineVersion || 'unknown',
                    requestId, sourceId: options.sourceId || input.sourceId || '',
                    page: options.page ?? input.page ?? null, rawText: response?.rawText || '',
                    blocks: response?.blocks || [], formulas: response?.formulas || [],
                    images: response?.images || [],
                    rawEvidenceRef: boundary.rawEvidenceRef('local-ocr', requestId, response),
                    rawEvidence: response?.rawEvidence ?? response,
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
                    engine: 'local-ocr', engineVersion: responseVersion, requestId,
                    durationMs: candidate.durationMs
                });
                return candidate;
            } catch (cause) {
                const error = boundary.mapTransportError(cause, requestId);
                boundary.emitSafeLog(logger, 'ocr-adapter-failure', {
                    engine: 'local-ocr', requestId, code: error.code,
                    durationMs: Date.now() - started
                });
                throw error;
            } finally {
                if (controllers.get(requestId) === controller) controllers.delete(requestId);
            }
        };
        return Object.freeze({
            healthCheck: async () => {
                try {
                    const result = await transport(endpoint, null, { healthCheck: true });
                    return {
                        ok: result?.ok === true,
                        engineVersion: String(result?.engineVersion || 'unknown')
                    };
                } catch (cause) {
                    return {
                        ok: false,
                        code: adapterContract().mapTransportError(cause, 'health-check').code
                    };
                }
            },
            getCapabilities: () => ({
                pages: true,
                documents: true,
                loopbackOnly: true,
                mimeTypes: [...adapterContract().ALLOWED_MIME],
                maxBytes
            }),
            recognizePage: recognize, recognizeDocument: recognize,
            cancel(requestId) { const c = controllers.get(requestId); if (!c) return false; c.abort(); return true; }
        });
    };
    return Object.freeze({
        ALLOWED_MIME: new Set(adapterContract().ALLOWED_MIME),
        createLocalAdapter
    });
});
