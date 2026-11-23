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

    const safeCode = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,100}$/.test(value) ? value : '';
    function failureDetails(error = {}) {
        const code = safeCode(error.code) || safeCode(error.message) || 'IMPORT_FAILED';
        const causeCode = safeCode(error.causeCode);
        const retryability = /UNKNOWN|SUBMITTING|UPLOADING/.test(causeCode) ? 'query-only'
            : /NOT_CONFIGURED|INVALID|CANCELLED|AMBIGUOUS/.test(causeCode || code) ? 'never' : 'manual';
        return { code, causeCode, stage: safeCode(error.stage),
            requestId: safeCode(error.requestId), retryability };
    }

    function failureMessage(details) {
        const messages = {
            PDF_EXTERNAL_NOT_CONFIGURED: 'PDF 识别服务未启用，当前入口尚未配置可用的识别链路。',
            MINERU_NOT_CONFIGURED: '本地服务未配置 MinerU，配置完成后再识别。',
            MINERU_PAGE_RANGE_INVALID: '所选页码无效或无法提取。请检查页码是否超出原卷，页码可写成 1-3,5,7-9。',
            MINERU_PAGE_SELECTION_UNAVAILABLE: '本地服务尚未支持只上传所选页面。请重启本地服务后再试，本次没有上传。',
            MINERU_PAGE_LIMIT: '一次最多识别 200 页。请缩小所选范围后再试。',
            MINERU_SUBMISSION_UNKNOWN: '上游任务是否受理尚不明确，请查询回执，勿重复提交。',
            MINERU_UPLOAD_UNKNOWN: '文件上传结果尚不明确，请查询已有任务，勿重复上传。'
        };
        if (messages[details.code]) return messages[details.code] + `（${details.code}）`;
        const reason = messages[details.causeCode] || details.causeCode;
        return reason && reason !== details.code ? `${details.code}：${reason}${messages[details.causeCode] ? `（${details.causeCode}）` : ''}` : details.code;
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
        const message = input.error?.message || String(input.error);
        // The bridge deliberately exposes stable codes, not raw provider payloads.
        // Keep its cause when persisting the failure so reloads do not erase it.
        const details = failureDetails(input.error);
        const errorMessage = safeCode(input.error?.code) || safeCode(message)
            ? failureMessage(details) : message;
        const errorPatch = safeCode(input.error?.code) ? { importError: details } : {};
        const updatedAt = now(ports);
        const batchPatch = {
            status: 'failed', progress: 100, updatedAt, errorMessage, ...errorPatch
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
                { parseStatus: 'failed', errorMessage, updatedAt, ...errorPatch }
            )));
        }
        return { batchPatch, fileIds: files.map(file => String(file.id)) };
    }

    const api = Object.freeze({ reportProgress, reportImportFailure, failureDetails, failureMessage });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionImportStatusPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
