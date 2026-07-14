(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ImportDiagnostics = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const LIMITS = Object.freeze({
        maxTokenLength: 80,
        maxEvents: 64,
        maxCount: 1000000,
        maxDuration: 86400000
    });
    const SAFE_TOKEN = /^[a-zA-Z0-9_.:-]{1,80}$/;
    const SAFE_ENGINE = /^(?:browser|docx|local|mock|ocr|paddle|pdf|qwen|tesseract)[a-zA-Z0-9_.:-]{0,71}$/i;
    const ALLOWED_STAGES = new Set([
        'started',
        'context-loaded',
        'candidates-produced',
        'prefix-selected',
        'drafts-validated',
        'review-drafts-built',
        'review-drafts-persisted',
        'batch-loaded',
        'source-classified',
        'producer-selected',
        'source-producer-entered',
        'document-converted',
        'page-rendered',
        'ocr-adapter-called',
        'parser-entered',
        'structure-built',
        'pdf-projection-entered',
        'controlled-write-evaluated',
        'candidate-normalized',
        'validation-complete',
        'review-built',
        'draft-persisted',
        'readback-verified',
        'cancelled',
        'failed',
        'unknown-stage'
    ]);
    const ALLOWED_COUNTS = new Set([
        'files', 'pages', 'candidates', 'selected', 'validated', 'drafts',
        'accepted', 'rejected', 'warnings', 'errors', 'processed', 'total'
    ]);
    const KNOWN_ERROR_CODES = new Set([
        'mock-transport-invalid',
        'import-context-missing',
        'candidate-envelope-malformed',
        'raw-json-candidate-rejected',
        'candidate-prefix-empty',
        'import-validation-malformed',
        'review-draft-build-malformed',
        'import-cancelled',
        'DRAFT_BATCH_ID_REQUIRED',
        'DRAFT_BATCH_NOT_FOUND',
        'DRAFT_PERSISTENCE_ASSOCIATION_INVALID',
        'DRAFT_PERSISTENCE_DELETE_FAILED',
        'DRAFT_PERSISTENCE_DUPLICATE_ID',
        'DRAFT_PERSISTENCE_IDEMPOTENCY_CONFLICT',
        'DRAFT_PERSISTENCE_IDEMPOTENCY_KEY_REQUIRED',
        'DRAFT_PERSISTENCE_INPUT_INVALID',
        'DRAFT_PERSISTENCE_RELOAD_FAILED',
        'DRAFT_PERSISTENCE_REPOSITORY_REQUIRED',
        'DRAFT_PERSISTENCE_VERSION_CONFLICT',
        'DRAFT_PERSISTENCE_VERSION_REQUIRED',
        'DRAFT_PERSISTENCE_WRITE_FAILED'
    ]);

    const cloneValue = value => {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    };
    const freezeValue = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        for (const item of Object.values(value)) freezeValue(item);
        return Object.freeze(value);
    };
    const immutable = value => freezeValue(cloneValue(value));

    const safeToken = (value, fallback) => {
        const text = String(value ?? '').trim();
        return SAFE_TOKEN.test(text) ? text : fallback;
    };
    const safeStage = value => {
        const stage = String(value || '').trim();
        return ALLOWED_STAGES.has(stage) ? stage : 'unknown-stage';
    };
    const safeEngine = value => {
        const engine = String(value || '').trim();
        return SAFE_ENGINE.test(engine) ? engine : '';
    };
    const safeCounts = value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const counts = {};
        for (const key of ALLOWED_COUNTS) {
            const count = Number(value[key]);
            if (!Number.isFinite(count) || count < 0) continue;
            counts[key] = Math.min(LIMITS.maxCount, Math.floor(count));
        }
        return Object.keys(counts).length ? counts : undefined;
    };
    const mapErrorCode = error => {
        const code = String(error?.code || '').trim();
        if (
            error?.name === 'AbortError' ||
            code === 'ABORT_ERR' ||
            code === 'IMPORT_CANCELLED' ||
            code === 'import-cancelled'
        ) return 'import-cancelled';
        return KNOWN_ERROR_CODES.has(code) ? code : 'import-failed';
    };

    const createImportDiagnostics = ({ clock = () => Date.now(), logger } = {}) => {
        if (typeof clock !== 'function') {
            throw new TypeError('Monotonic clock port is required.');
        }
        const log = typeof logger === 'function'
            ? logger
            : typeof logger?.info === 'function'
                ? event => logger.info(event)
                : () => {};
        let started = false;
        let startedAt = 0;
        let lastDuration = 0;
        let requestId = 'import-request';
        let batchId = 'unknown-batch';
        let events = [];

        const readClock = () => {
            try {
                const value = Number(clock());
                return Number.isFinite(value) ? value : 0;
            } catch (_error) {
                return 0;
            }
        };
        const duration = () => {
            const measured = Math.max(0, readClock() - startedAt);
            lastDuration = Math.max(
                lastDuration,
                Math.min(LIMITS.maxDuration, Math.floor(measured))
            );
            return lastDuration;
        };
        const append = input => {
            if (!started) throw new TypeError('Import diagnostics must be started.');
            if (events.length >= LIMITS.maxEvents) return events.at(-1);
            const engine = safeEngine(input?.engine);
            const counts = safeCounts(input?.counts);
            const event = immutable({
                requestId,
                batchId,
                stage: safeStage(input?.stage),
                duration: duration(),
                ...(input?.errorCode ? { errorCode: input.errorCode } : {}),
                ...(engine ? { engine } : {}),
                ...(counts ? { counts } : {})
            });
            events.push(event);
            try {
                log(event);
            } catch (_error) {
                // Diagnostics are observational and cannot change import behavior.
            }
            return event;
        };
        const start = input => {
            requestId = safeToken(input?.requestId, 'import-request');
            batchId = safeToken(input?.batchId, 'unknown-batch');
            startedAt = readClock();
            lastDuration = 0;
            events = [];
            started = true;
            return append({ ...input, stage: safeStage(input?.stage || 'started') });
        };
        const record = input => append(input || {});
        const fail = (error, input = {}) => append({
            ...input,
            stage: input.stage || (mapErrorCode(error) === 'import-cancelled'
                ? 'cancelled' : 'failed'),
            errorCode: mapErrorCode(error)
        });
        const snapshot = () => immutable({
            schemaVersion: 'qisi.import-diagnostics.v1',
            requestId,
            batchId,
            events
        });

        return Object.freeze({ start, record, fail, snapshot });
    };

    return Object.freeze({ LIMITS, createImportDiagnostics });
});
