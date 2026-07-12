(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrQwenAdapter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const contracts = () => root.Qisi?.RecognitionContracts ||
        (typeof require === 'function' ? require('./qisi-recognition-contracts.js') : null);

    const createQwenAdapter = ({ request, engineVersion = 'unknown' } = {}) => {
        if (typeof request !== 'function') throw new TypeError('Qwen request transport is required.');
        const controllers = new Map();
        const recognize = async (input, options = {}) => {
            const requestId = options.requestId || `qwen_${Date.now()}`;
            const controller = new AbortController();
            controllers.set(requestId, controller);
            const started = Date.now();
            try {
                const response = await request(input, { ...options, requestId, signal: controller.signal });
                return contracts().createRecognitionCandidate({
                    engine: 'qwen-vl-plus', engineVersion, requestId,
                    sourceId: options.sourceId || input?.sourceId || '',
                    page: options.page ?? input?.page ?? null,
                    rawText: response?.rawText || '',
                    blocks: response?.blocks || [], formulas: response?.formulas || [],
                    images: response?.images || [], rawEvidence: response?.rawResult ?? response,
                    engineConfidence: response?.confidence ?? null,
                    warnings: response?.warnings || [], durationMs: Date.now() - started
                });
            } catch (cause) {
                const error = new Error(cause?.message || 'Qwen OCR failed.');
                error.code = cause?.name === 'AbortError' ? 'ocr-cancelled' : 'ocr-request-failed';
                error.requestId = requestId;
                throw error;
            } finally {
                controllers.delete(requestId);
            }
        };
        return Object.freeze({
            healthCheck: async () => ({ ok: true, transportConfigured: true }),
            getCapabilities: () => ({ pages: true, documents: true, formulas: true, images: true }),
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
