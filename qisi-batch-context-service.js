(function initBatchContextService(root) {
    'use strict';

    const DEFAULT_TYPES = Object.freeze(['docx', 'pdf', 'image']);
    const FORBIDDEN_KEY = /(?:raw|text|content|base64|dataurl|password|secret|token|key)/i;

    function fail(code) {
        const error = new Error(code);
        error.code = code;
        throw error;
    }

    function failCancelled() {
        const error = new Error('IMPORT_CANCELLED_LOADING');
        error.name = 'AbortError';
        error.code = 'IMPORT_CANCELLED_LOADING';
        throw error;
    }

    function clone(value) {
        if (value === undefined) return undefined;
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function freeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(freeze);
        return Object.freeze(value);
    }

    function safeSnapshot(value) {
        const output = {};
        for (const [key, item] of Object.entries(value || {})) {
            if (FORBIDDEN_KEY.test(key)) continue;
            if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) {
                output[key] = item;
            }
        }
        return output;
    }

    function normalizeType(file) {
        const explicit = String(file?.fileType || '').trim().toLowerCase();
        if (explicit) return explicit;
        const match = String(file?.filename || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        const extension = match?.[1] || '';
        if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'image';
        return extension;
    }

    function createBatchContext(input = {}) {
        const batchId = String(input.batchId || '').trim();
        const batch = input.batch;
        if (!batch || typeof batch !== 'object' || !batchId || String(batch.id || '') !== batchId) {
            fail('BATCH_CONTEXT_MISSING_BATCH');
        }
        const files = Array.isArray(input.files) ? input.files : [];
        if (files.length === 0) fail('BATCH_CONTEXT_MISSING_FILE');
        if (input.expectedSourceVersion !== undefined &&
            Number(input.expectedSourceVersion) !== Number(batch.sourceVersion)) {
            fail('BATCH_CONTEXT_STALE_SOURCE');
        }

        const allowedTypes = new Set((input.supportedTypes || DEFAULT_TYPES)
            .map(value => String(value).toLowerCase()));
        const readRoles = typeof input.getRoles === 'function'
            ? input.getRoles
            : file => file.roles;
        const ids = [];
        const sourceManifest = files.map((file, sourceOrder) => {
            const id = String(file?.id || '').trim();
            if (!id || ids.includes(id)) fail('BATCH_CONTEXT_DUPLICATE_FILE');
            ids.push(id);
            if (file.batchId && String(file.batchId) !== batchId) fail('BATCH_CONTEXT_STALE_SOURCE');
            const fileType = normalizeType(file);
            if (!allowedTypes.has(fileType)) fail('BATCH_CONTEXT_UNSUPPORTED_TYPE');
            const roles = readRoles(file);
            return freeze({
                id,
                filename: String(file.filename || ''),
                fileType,
                roles: freeze(Array.isArray(roles)
                    ? roles.map(role => String(role)).filter(Boolean)
                    : []),
                sourceOrder: Number.isInteger(file.sourceOrder) ? file.sourceOrder : sourceOrder,
                createdAt: Number(file.createdAt || 0),
                pageRange: String(file.pageRange || ''),
                size: Number(file.size || 0),
                sourceVersion: Number(file.sourceVersion || batch.sourceVersion || 0)
            });
        });

        const expectedQuestionCount = Math.max(0, Number(batch.expectedQuestionCount || 0)) || 0;
        const recognitionMode = String(batch.recognitionMode || 'standard');
        return freeze({
            schemaVersion: 'qisi.batch-context.r3',
            batchId,
            batchMetadata: {
                id: batchId,
                status: String(batch.status || ''),
                sourceVersion: Number(batch.sourceVersion || 0),
                expectedQuestionCount,
                recognitionMode,
                createdAt: Number(batch.createdAt || 0),
                updatedAt: Number(batch.updatedAt || 0)
            },
            sourceManifest,
            userSettings: {
                ...safeSnapshot(input.userSettings),
                expectedQuestionCount
            },
            engineConfig: {
                ...safeSnapshot(input.engineConfig),
                recognitionMode
            }
        });
    }

    async function loadBatchAndFiles(input = {}, ports = {}) {
        const repository = ports.repository;
        if (
            typeof repository?.get !== 'function' ||
            typeof repository?.findBy !== 'function'
        ) fail('BATCH_CONTEXT_REPOSITORY_REQUIRED');
        const signal = input.signal;
        if (signal?.aborted) failCancelled();
        const batchId = String(input.batchId || '').trim();
        const loadedBatch = await repository.get('draftImportBatches', batchId);
        if (signal?.aborted) failCancelled();
        if (!loadedBatch) return null;
        const loadedFiles = await repository.findBy(
            'draftImportFiles', 'batchId', batchId
        );
        if (signal?.aborted) failCancelled();
        const batch = clone(loadedBatch);
        const files = clone(Array.isArray(loadedFiles) ? loadedFiles : []);
        const batchContext = createBatchContext({
            batchId,
            batch,
            files,
            getRoles: input.getRoles,
            expectedSourceVersion: input.expectedSourceVersion,
            supportedTypes: input.supportedTypes,
            userSettings: input.userSettings,
            engineConfig: input.engineConfig
        });
        return Object.freeze({ batch, files, batchContext });
    }

    const api = Object.freeze({ createBatchContext, loadBatchAndFiles });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.BatchContextService = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
