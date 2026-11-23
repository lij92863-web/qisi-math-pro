'use strict';

const crypto = require('node:crypto');
const VERSION = 'mineru-extraction-v2';
const UPLOAD_CONFIRMATION_POLLS = 4;
const UPLOAD_RECEIVED_STATES = new Set(['uploading', 'pending', 'running', 'converting', 'done', 'failed']);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = (code, stage, extra = {}) => Object.assign(new Error(code), { code, stage, ...extra });

function memoryStore() {
    const receipts = new Map(), archives = new Map();
    return {
        read: async key => receipts.has(key) ? structuredClone(receipts.get(key)) : null,
        write: async (key, value) => { receipts.set(key, structuredClone(value)); },
        prepare: async (key, value) => { if (!receipts.has(key)) receipts.set(key, structuredClone(value)); return structuredClone(receipts.get(key)); },
        writeZip: async (key, bytes) => { archives.set(key, Buffer.from(bytes)); return hash(bytes); },
        readZip: async (key, digest) => {
            const bytes = archives.get(key);
            if (!bytes || hash(bytes) !== digest) throw fail('MINERU_CACHE_INTEGRITY_FAILED', 'materializing');
            return bytes;
        }
    };
}

function createMineruTaskService({ token = '', fetchImpl = fetch, store = memoryStore(),
    projectZip, baseUrl = 'https://mineru.net', pollIntervalMs = 800, timeoutMs = 300000 } = {}) {
    const active = new Map();
    async function run(bytes, options, sourceId) {
        const startedAt = Date.now(), owner = crypto.randomUUID();
        const controller = new AbortController();
        const abort = () => controller.abort(fail('MINERU_CANCELLED', 'cancelled'));
        if (options.signal?.aborted) abort();
        else options.signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(fail('MINERU_PARSE_TIMEOUT', 'deadline')), timeoutMs);
        const signal = controller.signal;
        const bounded = async operation => {
            if (signal.aborted) throw signal.reason;
            let listener;
            try {
                return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
                    listener = () => reject(signal.reason);
                    signal.addEventListener('abort', listener, { once: true });
                })]);
            } finally { signal.removeEventListener('abort', listener); }
        };
        const request = async (url, init = {}) => bounded(() => fetchImpl(url, { ...init, signal }));
        const api = async (pathname, init = {}) => {
            const response = await request(baseUrl.replace(/\/$/, '') + pathname, {
                ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            let body;
            try { body = await bounded(() => response.json()); }
            catch (error) { if (signal.aborted) throw error; throw fail('MINERU_RESPONSE_INVALID', 'response'); }
            return { status: response.status, body };
        };
        const delay = () => bounded(() => new Promise(resolve => {
            const cancel = () => { clearTimeout(wait); signal.removeEventListener('abort', cancel); };
            const wait = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, pollIntervalMs);
            signal.addEventListener('abort', cancel, { once: true });
        }));
        let receipt, stage = 'prepared';
        const save = async (state, fields = {}) => {
            receipt = { ...receipt, ...fields, state, updatedAt: Date.now() };
            await store.write(sourceId, receipt);
            stage = state;
        };
        try {
            receipt = await bounded(() => store.read(sourceId));
            if (receipt && (receipt.version !== VERSION || receipt.sourceId !== sourceId)) throw fail('MINERU_TASK_VERSION_MISMATCH', stage);
            if (receipt?.state === 'ready') {
                const zip = await bounded(() => store.readZip(sourceId, receipt.zipSha256));
                const projected = await bounded(() => projectZip(zip, { sourceId, filename: receipt.filename }));
                return { ...projected, job: sourceId, receipt: { batchId: receipt.batchId, state: 'ready', version: VERSION }, timings: { totalMs: Date.now() - startedAt } };
            }
            if (receipt?.state === 'failed') throw fail(receipt.errorCode || 'MINERU_PARSE_FAILED', receipt.stage || 'failed', {
                ...(receipt.httpStatus ? { httpStatus: receipt.httpStatus } : {}),
                ...(receipt.mineruCode !== undefined ? { mineruCode: receipt.mineruCode } : {}) });
            if (receipt && !receipt.batchId && receipt.state !== 'prepared') throw fail('MINERU_SUBMISSION_UNKNOWN', receipt.state);
            if (!token) throw fail('MINERU_NOT_CONFIGURED', 'prepared');
            if (!receipt) receipt = await store.prepare(sourceId, { version: VERSION, sourceId, owner,
                state: 'prepared', filename: String(options.filename || 'upload.pdf').replace(/[\\/:*?"<>|]/g, '_').slice(0, 160), createdAt: startedAt });
            // The upload URL is persisted with the batch so a lost PUT can be
            // retried against the SAME accepted batch. Re-uploading bytes is
            // not re-submitting a job: MinerU has one batch row for this file.
            let uploadUrl = String(receipt.uploadUrl || '');
            const uploadNow = async ({ reconcile = false } = {}) => {
                if (!uploadUrl) throw fail('MINERU_UPLOAD_URL_MISSING', 'accepted');
                await save('uploading');
                let uploaded;
                try {
                    uploaded = await request(uploadUrl, { method: 'PUT', body: bytes });
                } catch (error) {
                    if (!reconcile || signal.aborted) throw error;
                    // The request may have reached OSS before the response was lost.
                    return false;
                }
                if (uploaded.status !== 200) {
                    // Definitely not accepted: keep the batch + URL so the next
                    // run can retry the upload instead of polling a dead row.
                    throw fail('MINERU_UPLOAD_UNKNOWN', 'uploading', { httpStatus: uploaded.status });
                }
                await save('processing');
                return true;
            };
            let awaitingUploadConfirmation = false;
            if (!receipt.batchId) {
                if (receipt.owner !== owner) throw fail('MINERU_TASK_BUSY', receipt.state);
                await save('submitting');
                const applied = await api('/api/v4/file-urls/batch', { method: 'POST', body: JSON.stringify({
                    enable_formula: true, enable_table: true, language: 'ch', model_version: 'vlm',
                    files: [{ name: receipt.filename, is_ocr: true, data_id: sourceId }]
                }) });
                if (applied.status !== 200 || applied.body?.code !== 0) {
                    await save('failed', { errorCode: 'MINERU_API_ERROR', httpStatus: applied.status,
                        ...(applied.body?.code !== undefined ? { mineruCode: applied.body.code } : {}) });
                    throw fail('MINERU_API_ERROR', 'submitting', { httpStatus: applied.status,
                        ...(applied.body?.code !== undefined ? { mineruCode: applied.body.code } : {}) });
                }
                const batchId = applied.body?.data?.batch_id, acceptedUrl = applied.body?.data?.file_urls?.[0];
                if (typeof batchId !== 'string' || !batchId || typeof acceptedUrl !== 'string' || !/^https:\/\//.test(acceptedUrl)) throw fail('MINERU_SUBMISSION_UNKNOWN', 'submitting');
                uploadUrl = acceptedUrl;
                await save('accepted', { batchId, uploadUrl });
                awaitingUploadConfirmation = !(await uploadNow({ reconcile: true }));
            } else if (receipt.state === 'accepted') {
                awaitingUploadConfirmation = !(await uploadNow({ reconcile: true }));
            }
            // An interrupted PUT is queried before attempting another upload.
            if (!awaitingUploadConfirmation) stage = 'processing';
            let result;
            let repairedUpload = false;
            let uploadConfirmationPolls = 0;
            for (;;) {
                let polled;
                for (let attempt = 0; ; attempt++) {
                    try {
                        polled = await api('/api/v4/extract-results/batch/' + encodeURIComponent(receipt.batchId));
                        if (polled.status === 429 || polled.status >= 500) throw fail('MINERU_POLL_FAILED', stage);
                        break;
                    } catch (error) {
                        if (signal.aborted || attempt === 3) throw error;
                        await delay();
                    }
                }
                if (polled.status !== 200 || polled.body?.code !== 0) throw fail('MINERU_POLL_FAILED', stage);
                const rows = polled.body?.data?.extract_result;
                if (!Array.isArray(rows) || rows.length !== 1 || rows[0].data_id && rows[0].data_id !== sourceId) throw fail('MINERU_RESPONSE_INVALID', stage);
                const row = rows[0];
                if (awaitingUploadConfirmation) {
                    if (row.state === 'waiting-file' && ++uploadConfirmationPolls < UPLOAD_CONFIRMATION_POLLS) {
                        await delay();
                        continue;
                    }
                    if (!UPLOAD_RECEIVED_STATES.has(row.state)) throw fail('MINERU_UPLOAD_UNKNOWN', 'uploading');
                    await save('processing');
                    awaitingUploadConfirmation = false;
                }
                if (row.state === 'done') { result = row; break; }
                if (row.state === 'failed') {
                    await save('failed', { errorCode: 'MINERU_PARSE_FAILED' });
                    throw fail('MINERU_PARSE_FAILED', stage);
                }
                if (row.state === 'waiting-file') {
                    // MinerU explicitly says the file never arrived. That is
                    // positive proof the upload was not accepted, so sending the
                    // same bytes to the same batch is safe and is the only way
                    // out of a lost PUT (polling this row forever cannot work).
                    if (!repairedUpload && uploadUrl) {
                        repairedUpload = true;
                        awaitingUploadConfirmation = !(await uploadNow({ reconcile: true }));
                        continue;
                    }
                    await save('accepted', { batchId: receipt.batchId, uploadUrl });
                    throw fail('MINERU_UPLOAD_UNKNOWN', 'uploading');
                }
                await delay();
            }
            await save('materializing');
            if (typeof result.full_zip_url !== 'string' || !/^https:\/\//.test(result.full_zip_url)) throw fail('MINERU_RESPONSE_INVALID', stage);
            const response = await request(result.full_zip_url);
            if (response.status !== 200) throw fail('MINERU_ZIP_DOWNLOAD_FAILED', stage);
            const chunks = [];
            let length = 0;
            if (response.body?.getReader) {
                const reader = response.body.getReader();
                try {
                    for (;;) {
                        const item = await bounded(() => reader.read());
                        if (item.done) break;
                        length += item.value.length;
                        if (length > 256 * 1024 * 1024) throw fail('MINERU_ZIP_SIZE_LIMIT', stage);
                        chunks.push(Buffer.from(item.value));
                    }
                } finally { if (signal.aborted || length > 256 * 1024 * 1024) void reader.cancel().catch(() => {}); }
            } else {
                const value = Buffer.from(await bounded(() => response.arrayBuffer()));
                if (value.length > 256 * 1024 * 1024) throw fail('MINERU_ZIP_SIZE_LIMIT', stage);
                chunks.push(value);
            }
            const zip = Buffer.concat(chunks);
            const projected = await bounded(() => projectZip(zip, { sourceId, filename: receipt.filename }));
            const zipSha256 = await store.writeZip(sourceId, zip);
            const output = { ...projected, job: sourceId, receipt: { batchId: receipt.batchId, state: 'ready', version: VERSION },
                timings: { totalMs: Date.now() - startedAt } };
            await save('ready', { zipSha256, errorCode: '', httpStatus: 0 });
            return output;
        } catch (error) {
            let code = error.code || 'MINERU_REQUEST_FAILED';
            // A response with a definite rejection is not an unknown submission; the
            // persisted receipt already says failed, so the thrown code must agree.
            if (stage === 'submitting' && code !== 'MINERU_API_ERROR') code = 'MINERU_SUBMISSION_UNKNOWN';
            if (stage === 'uploading') code = 'MINERU_UPLOAD_UNKNOWN';
            if (receipt && !['ready', 'failed'].includes(receipt.state) && (receipt.owner === owner || receipt.batchId)) {
                const nextState = /UNKNOWN/.test(code) ? 'unknown'
                    : code === 'MINERU_PARSE_TIMEOUT' ? 'interrupted'
                        : signal.aborted ? 'cancelled' : 'interrupted';
                await store.write(sourceId, { ...receipt, state: nextState,
                    stage: error.stage || stage, errorCode: code,
                    ...(error.httpStatus ? { httpStatus: error.httpStatus } : {}),
                    ...(error.mineruCode !== undefined ? { mineruCode: error.mineruCode } : {}),
                    updatedAt: Date.now() });
            }
            throw fail(code, stage, { batchId: receipt?.batchId || '',
                ...(Number.isInteger(error.httpStatus) ? { httpStatus: error.httpStatus } : {}),
                ...(error.mineruCode !== undefined ? { mineruCode: error.mineruCode } : {}) });
        } finally {
            clearTimeout(timer);
            options.signal?.removeEventListener('abort', abort);
        }
    }
    function parse(input, options = {}) {
        const bytes = Buffer.from(input);
        if (bytes.subarray(0, 5).toString() !== '%PDF-') return Promise.reject(fail('MINERU_INPUT_INVALID', 'prepared'));
        const sourceId = hash(bytes);
        if (active.has(sourceId)) return active.get(sourceId);
        const promise = run(bytes, options, sourceId).finally(() => active.delete(sourceId));
        active.set(sourceId, promise);
        return promise;
    }
    async function readZip({ job, sourceId } = {}) {
        if (!/^[a-f0-9]{64}$/.test(job || '') || job !== sourceId) throw fail('MINERU_ASSET_IDENTITY_REQUIRED', 'asset');
        const receipt = await store.read(job);
        if (!receipt || receipt.state !== 'ready' || receipt.sourceId !== sourceId || receipt.version !== VERSION) throw fail('MINERU_JOB_NOT_FOUND', 'asset');
        return { bytes: await store.readZip(job, receipt.zipSha256), receipt };
    }
    return Object.freeze({ parse, readZip });
}

module.exports = { createMineruTaskService, memoryStore, VERSION };
