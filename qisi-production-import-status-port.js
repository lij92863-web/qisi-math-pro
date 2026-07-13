(function initProductionImportStatusPort(root) {
    'use strict';

    function createError(code, name = 'Error') {
        const error = new Error(code);
        error.name = name;
        error.code = code;
        return error;
    }

    function requireInput(input, ports) {
        if (!String(input.batchId || '').trim()) throw createError('IMPORT_STATUS_INVALID');
        if (typeof ports.repository?.update !== 'function') {
            throw createError('IMPORT_STATUS_PORT_REQUIRED');
        }
    }

    function now(ports) {
        return typeof ports.clock === 'function' ? ports.clock() : Date.now();
    }

    async function reportProgress(input = {}, ports = {}) {
        requireInput(input, ports);
        if (input.signal?.aborted) throw createError('IMPORT_STATUS_ABORTED', 'AbortError');
        const patch = {
            progress: Math.max(0, Math.min(100, Math.round(input.progress || 0))),
            status: input.status || 'processing',
            updatedAt: now(ports)
        };
        await ports.repository.update('draftImportBatches', input.batchId, patch);
        return { patch };
    }

    async function reportImportFailure(input = {}, ports = {}) {
        requireInput(input, ports);
        const errorMessage = input.error?.message || String(input.error);
        const updatedAt = now(ports);
        const batchPatch = {
            status: 'failed', progress: 100, updatedAt, errorMessage
        };
        await ports.repository.update('draftImportBatches', input.batchId, batchPatch);

        let files = [];
        if (input.failFiles) {
            if (typeof ports.repository.findBy !== 'function') {
                throw createError('IMPORT_STATUS_PORT_REQUIRED');
            }
            files = await ports.repository.findBy(
                'draftImportFiles', 'batchId', input.batchId
            ).catch(() => []);
            await Promise.all(files.map(file => ports.repository.update(
                'draftImportFiles', file.id,
                { parseStatus: 'failed', errorMessage, updatedAt }
            )));
        }
        return { batchPatch, fileIds: files.map(file => String(file.id)) };
    }

    const api = Object.freeze({ reportProgress, reportImportFailure });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionImportStatusPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
