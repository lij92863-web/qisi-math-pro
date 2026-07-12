(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrLocalAdapter = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
    const contracts = () => root.Qisi?.RecognitionContracts ||
        (typeof require === 'function' ? require('./qisi-recognition-contracts.js') : null);

    const createLocalAdapter = ({ transport, endpoint = 'http://127.0.0.1:8765', maxBytes = 20 * 1024 * 1024 } = {}) => {
        if (typeof transport !== 'function') throw new TypeError('Local OCR transport is required.');
        const url = new URL(endpoint);
        if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
            throw new Error('Local OCR endpoint must be loopback.');
        }
        const controllers = new Map();
        const recognize = async (input, options = {}) => {
            if (input?.path) throw Object.assign(new Error('Arbitrary local paths are forbidden.'), { code: 'local-path-forbidden' });
            if (!ALLOWED_MIME.has(input?.mimeType)) throw Object.assign(new Error('Unsupported OCR MIME.'), { code: 'mime-rejected' });
            if (!Number.isFinite(input?.bytes) || input.bytes < 0 || input.bytes > maxBytes) {
                throw Object.assign(new Error('OCR input exceeds size limit.'), { code: 'size-rejected' });
            }
            const requestId = options.requestId || `local_${Date.now()}`;
            const controller = new AbortController();
            controllers.set(requestId, controller);
            const started = Date.now();
            try {
                const response = await transport(endpoint, input, { ...options, requestId, signal: controller.signal });
                return contracts().createRecognitionCandidate({
                    engine: 'local-ocr', engineVersion: response?.engineVersion || 'unknown',
                    requestId, sourceId: options.sourceId || input.sourceId || '',
                    page: options.page ?? input.page ?? null, rawText: response?.rawText || '',
                    blocks: response?.blocks || [], formulas: response?.formulas || [],
                    images: response?.images || [], rawEvidence: response?.rawEvidence ?? response,
                    engineConfidence: response?.confidence ?? null,
                    warnings: response?.warnings || [], durationMs: Date.now() - started
                });
            } finally { controllers.delete(requestId); }
        };
        return Object.freeze({
            healthCheck: () => transport(endpoint, null, { healthCheck: true }),
            getCapabilities: () => ({ pages: true, documents: true, loopbackOnly: true, mimeTypes: [...ALLOWED_MIME], maxBytes }),
            recognizePage: recognize, recognizeDocument: recognize,
            cancel(requestId) { const c = controllers.get(requestId); if (!c) return false; c.abort(); return true; }
        });
    };
    return Object.freeze({ ALLOWED_MIME, createLocalAdapter });
});
