(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrAdapterContract = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ALLOWED_MIME = Object.freeze([
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/pdf'
    ]);
    const ALLOWED_MIME_SET = new Set(ALLOWED_MIME);
    const UNAVAILABLE_CODES = new Set([
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'EHOSTUNREACH',
        'ETIMEDOUT',
        'ocr-engine-unavailable'
    ]);
    const PASSTHROUGH_CODES = new Set([
        'local-path-forbidden',
        'mime-rejected',
        'size-rejected',
        'duplicate-request-id',
        'ocr-malformed-response',
        'ocr-response-too-large',
        'ocr-cancelled'
    ]);

    const createError = (code, requestId, message) => {
        const error = new Error(message);
        error.code = code;
        error.requestId = requestId;
        return error;
    };

    const requireRequestId = value => {
        const requestId = String(value || '').trim();
        if (!requestId) throw createError('invalid-request-id', '', 'OCR requestId is required.');
        return requestId;
    };

    const validateInput = (input, {
        requestId,
        maxBytes,
        requireMime = false,
        requireBytes = false
    } = {}) => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw createError('ocr-invalid-input', requestId, 'OCR input must be an object.');
        }
        if (input.path) {
            throw createError(
                'local-path-forbidden',
                requestId,
                'Arbitrary local paths are forbidden.'
            );
        }
        const hasMime = input.mimeType != null && input.mimeType !== '';
        if ((requireMime && !hasMime) || (hasMime && !ALLOWED_MIME_SET.has(input.mimeType))) {
            throw createError('mime-rejected', requestId, 'Unsupported OCR MIME.');
        }
        const hasBytes = input.bytes != null;
        if (requireBytes && !hasBytes) {
            throw createError('size-rejected', requestId, 'OCR byte size is required.');
        }
        if (hasBytes && (!Number.isFinite(input.bytes) || input.bytes < 0 || input.bytes > maxBytes)) {
            throw createError('size-rejected', requestId, 'OCR input exceeds size limit.');
        }
    };

    const validateResponse = (response, requestId, { maxResponseChars = 5 * 1024 * 1024 } = {}) => {
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
            throw createError(
                'ocr-malformed-response',
                requestId,
                'OCR engine returned a malformed response.'
            );
        }
        const stringFields = ['rawText', 'engineVersion', 'rawEvidenceRef'];
        const arrayFields = ['blocks', 'formulas', 'images', 'warnings'];
        const malformed = stringFields.some(field =>
            response[field] != null && typeof response[field] !== 'string'
        ) || arrayFields.some(field =>
            response[field] != null && !Array.isArray(response[field])
        ) || (response.confidence != null && (
            !Number.isFinite(response.confidence) ||
            response.confidence < 0 ||
            response.confidence > 1
        ));
        if (malformed) {
            throw createError(
                'ocr-malformed-response',
                requestId,
                'OCR engine returned a malformed response.'
            );
        }
        let responseChars;
        try {
            responseChars = JSON.stringify({
                rawText: response.rawText || '',
                blocks: response.blocks || [],
                formulas: response.formulas || [],
                images: response.images || [],
                warnings: response.warnings || []
            }).length;
        } catch (_error) {
            throw createError(
                'ocr-malformed-response',
                requestId,
                'OCR engine returned a malformed response.'
            );
        }
        if (!Number.isInteger(maxResponseChars) || maxResponseChars < 1 || responseChars > maxResponseChars) {
            throw createError(
                'ocr-response-too-large',
                requestId,
                'OCR engine response exceeds the configured limit.'
            );
        }
        return response;
    };

    const mapTransportError = (cause, requestId) => {
        if (cause?.name === 'AbortError' || cause?.code === 'ocr-cancelled') {
            return createError('ocr-cancelled', requestId, 'OCR request was cancelled.');
        }
        if (UNAVAILABLE_CODES.has(cause?.code)) {
            return createError('ocr-engine-unavailable', requestId, 'OCR engine is unavailable.');
        }
        if (PASSTHROUGH_CODES.has(cause?.code)) {
            return createError(cause.code, requestId, cause.message);
        }
        return createError('ocr-request-failed', requestId, 'OCR request failed.');
    };

    const rawEvidenceRef = (engine, requestId, response) => {
        const provided = String(response?.rawEvidenceRef || '').trim();
        return provided || `${engine}://${requestId}`;
    };

    const emitSafeLog = (logger, event, metadata = {}) => {
        if (typeof logger !== 'function') return;
        const allowed = {};
        for (const field of ['engine', 'engineVersion', 'requestId', 'code', 'durationMs']) {
            if (metadata[field] !== undefined) allowed[field] = metadata[field];
        }
        logger(Object.freeze({ event, ...allowed }));
    };

    return Object.freeze({
        ALLOWED_MIME,
        createError,
        requireRequestId,
        validateInput,
        validateResponse,
        mapTransportError,
        rawEvidenceRef,
        emitSafeLog
    });
});
