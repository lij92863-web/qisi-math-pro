(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.MineruClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // MinerU 精准解析客户端：申请上传地址 → PUT 原始字节 → 轮询 → 取回 ZIP → 组装块。
    // 契约见 ai/MINERU_BLOCK_PROTOCOL.md §1 / §4。ZIP 解压只用 zlib 或 DecompressionStream，
    // 不依赖第三方包，Node 与浏览器同构。
    const PROTOCOL = 'mineru-blocks-v1';
    const DEFAULT_BASE_URL = 'https://mineru.net';
    const DEFAULT_POLL_INTERVAL_MS = 800;
    const DEFAULT_TIMEOUT_MS = 300000;
    // 轮询遇到网络抖动最多重试 3 次；MinerU 明确回 failed 才终止。
    const MAX_POLL_RETRIES = 3;
    const MAX_JOBS = 3;
    const JOB_TTL_MS = 30 * 60 * 1000;
    const BLOCK_TYPES = new Set(['text', 'equation', 'image', 'table', 'chart']);

    let nodeZlib = null;
    let nodeCrypto = null;
    try { if (typeof require === 'function') nodeZlib = require('node:zlib'); } catch (_) { nodeZlib = null; }
    try { if (typeof require === 'function') nodeCrypto = require('node:crypto'); } catch (_) { nodeCrypto = null; }

    const toBytes = value => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        throw fail('MINERU_INPUT_INVALID', 'PDF bytes must be a Buffer, Uint8Array or ArrayBuffer.');
    };

    function fail(code, message, extra) {
        const error = new Error(message || code);
        error.code = code;
        if (extra) Object.assign(error, extra);
        return error;
    }

    function utf8Decode(bytes) {
        if (typeof TextDecoder === 'function') return new TextDecoder('utf-8').decode(bytes);
        let out = '';
        for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
        return decodeURIComponent(escape(out));
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // ---- 最小 ZIP 读取器：只用中央目录 + store/deflate ----

    function findEndOfCentralDirectory(view) {
        const floor = Math.max(0, view.byteLength - 66000);
        for (let at = view.byteLength - 22; at >= floor; at -= 1) {
            if (view.getUint32(at, true) === 0x06054b50) return at;
        }
        return -1;
    }

    function readZipDirectory(bytes) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const eocd = findEndOfCentralDirectory(view);
        if (eocd < 0) throw fail('MINERU_ZIP_INVALID', 'ZIP end-of-central-directory not found.');
        const total = view.getUint16(eocd + 10, true);
        let cursor = view.getUint32(eocd + 16, true);
        const entries = new Map();
        for (let i = 0; i < total; i += 1) {
            if (cursor + 46 > view.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
                throw fail('MINERU_ZIP_INVALID', 'ZIP central directory is truncated.');
            }
            const method = view.getUint16(cursor + 10, true);
            const compressedSize = view.getUint32(cursor + 20, true);
            const nameLength = view.getUint16(cursor + 28, true);
            const extraLength = view.getUint16(cursor + 30, true);
            const commentLength = view.getUint16(cursor + 32, true);
            const localOffset = view.getUint32(cursor + 42, true);
            const name = utf8Decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
            if (!name.endsWith('/')) entries.set(name, { name, method, compressedSize, localOffset });
            cursor += 46 + nameLength + extraLength + commentLength;
        }
        return entries;
    }

    function localDataOffset(bytes, entry) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const at = entry.localOffset;
        if (at + 30 > view.byteLength || view.getUint32(at, true) !== 0x04034b50) {
            throw fail('MINERU_ZIP_INVALID', `ZIP local header is missing for ${entry.name}.`);
        }
        return at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    }

    async function inflateRaw(bytes) {
        if (nodeZlib) return new Uint8Array(nodeZlib.inflateRawSync(bytes));
        if (typeof DecompressionStream === 'function') {
            const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
            return new Uint8Array(await new Response(stream).arrayBuffer());
        }
        throw fail('MINERU_ZIP_UNSUPPORTED', 'No inflate implementation is available in this runtime.');
    }

    async function readZipEntry(bytes, entry) {
        const start = localDataOffset(bytes, entry);
        const payload = bytes.subarray(start, start + entry.compressedSize);
        if (entry.method === 0) return payload;
        if (entry.method === 8) return inflateRaw(payload);
        throw fail('MINERU_ZIP_UNSUPPORTED', `ZIP compression method ${entry.method} is not supported (${entry.name}).`);
    }

    function findContentListEntry(entries) {
        const candidates = [...entries.keys()]
            .filter(name => /_content_list\.json$/i.test(name) && !/_content_list_v2\.json$/i.test(name))
            .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
        if (!candidates.length) throw fail('MINERU_ZIP_INVALID', 'ZIP 内未找到 *_content_list.json。');
        return entries.get(candidates[0]);
    }

    // ---- 块整理（契约 §1） ----

    function pageOf(item) {
        const index = Number(item?.page_idx);
        return Number.isInteger(index) && index >= 0 ? index + 1 : 1;
    }

    function imagePathOf(item) {
        const value = String(item?.img_path || '').trim().replace(/^\.\//, '');
        return value;
    }

    function toBlock(item, id) {
        const type = String(item?.type || '');
        const bbox = Array.isArray(item?.bbox) && item.bbox.length === 4
            ? item.bbox.map(Number) : null;
        if (type === 'text' || type === 'equation') {
            return { id, type, text: String(item?.text ?? ''), ...(bbox ? { bbox } : {}) };
        }
        if (type === 'image' || type === 'chart') {
            return { id, type, image: imagePathOf(item), ...(bbox ? { bbox } : {}) };
        }
        if (type === 'table') {
            return {
                id, type,
                text: String(item?.table_body ?? item?.text ?? ''),
                ...(imagePathOf(item) ? { image: imagePathOf(item) } : {}),
                ...(bbox ? { bbox } : {})
            };
        }
        return null;
    }

    function parseContentList(list) {
        if (!Array.isArray(list)) throw fail('MINERU_CONTENT_INVALID', 'content_list.json 不是数组。');
        const pages = [];
        let droppedPageNumbers = 0;
        let droppedUnknown = 0;
        for (const item of list) {
            if (String(item?.type || '') === 'page_number') { droppedPageNumbers += 1; continue; }
            const page = pageOf(item);
            while (pages.length < page) pages.push({ page: pages.length + 1, blocks: [] });
            const bucket = pages[page - 1].blocks;
            const block = toBlock(item, `p${page}b${bucket.length}`);
            if (!block) { droppedUnknown += 1; continue; }
            if (!BLOCK_TYPES.has(block.type)) { droppedUnknown += 1; continue; }
            bucket.push(block);
        }
        return { pages, droppedPageNumbers, droppedUnknown };
    }

    function stripTags(html) {
        return String(html ?? '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
            .replace(/\s+/g, ' ')
            .trim();
    }

    function tableRows(html) {
        const rows = [];
        for (const row of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
            const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => stripTags(cell[1]));
            if (cells.length) rows.push(cells);
        }
        return rows;
    }

    // 只认「题号」行紧跟「答案」行的确定性结构；任何冲突都整体判为 null，不猜。
    function answerTableFromHtml(html) {
        const rows = tableRows(html);
        const table = {};
        let pending = null;
        let pairs = 0;
        for (const cells of rows) {
            const head = String(cells[0] || '').replace(/\s+/g, '');
            if (head === '题号') { pending = cells.slice(1); continue; }
            if (head === '答案' && pending) {
                for (let i = 0; i < pending.length; i += 1) {
                    const number = String(pending[i] || '').replace(/[^0-9]/g, '');
                    const answer = String(cells[i + 1] || '').replace(/\s+/g, '');
                    if (!number || !answer) continue;
                    if (Object.prototype.hasOwnProperty.call(table, number) && table[number] !== answer) return null;
                    table[number] = answer;
                    pairs += 1;
                }
                pending = null;
            }
        }
        return pairs ? table : null;
    }

    function parseAnswerTable(blocks) {
        const merged = {};
        let pairs = 0;
        for (const block of blocks) {
            if (block.type !== 'table' || !block.text) continue;
            const parsed = answerTableFromHtml(block.text);
            if (!parsed) continue;
            for (const [number, answer] of Object.entries(parsed)) {
                if (Object.prototype.hasOwnProperty.call(merged, number) && merged[number] !== answer) return null;
                merged[number] = answer;
                pairs += 1;
            }
        }
        return pairs ? merged : null;
    }

    async function sha256Hex(bytes) {
        if (nodeCrypto) return nodeCrypto.createHash('sha256').update(bytes).digest('hex');
        if (root?.crypto?.subtle) {
            const digest = await root.crypto.subtle.digest('SHA-256', bytes);
            return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return '';
    }

    function createMineruClient(options) {
        const settings = options || {};
        const token = String(settings.token || '').trim();
        const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch : null);
        const baseUrl = String(settings.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
        const pollIntervalMs = Math.max(250, Number(settings.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS));
        const timeoutMs = Math.max(1000, Number(settings.timeoutMs || DEFAULT_TIMEOUT_MS));
        const jobs = new Map();
        let jobSeq = 0;

        function requireToken() {
            if (!token) throw fail('MINERU_NOT_CONFIGURED', 'MinerU token is not configured on the local server.');
        }

        function remember(jobId, payload) {
            const now = Date.now();
            for (const [id, job] of jobs) {
                if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
            }
            while (jobs.size >= MAX_JOBS) jobs.delete(jobs.keys().next().value);
            jobs.set(jobId, { ...payload, createdAt: now });
        }

        async function apiRequest(pathname, init) {
            const response = await fetchImpl(baseUrl + pathname, {
                ...init,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) }
            });
            const text = await response.text();
            let body;
            try { body = text ? JSON.parse(text) : {}; } catch (_) { body = { raw: text.slice(0, 600) }; }
            return { status: response.status, body };
        }

        function upstreamFailure(stage, response) {
            const code = response.body?.code ?? response.body?.msgCode;
            const message = response.body?.msg || response.body?.message || response.body?.raw || '';
            return fail('MINERU_API_ERROR', `MinerU ${stage} 失败: HTTP ${response.status} code=${code ?? 'unknown'} msg=${String(message).slice(0, 300)}`, {
                stage,
                httpStatus: response.status,
                mineruCode: code ?? null,
                mineruMsg: message ? String(message).slice(0, 600) : ''
            });
        }

        async function parse(pdfBuffer, parseOptions) {
            requireToken();
            if (!fetchImpl) throw fail('MINERU_FETCH_UNAVAILABLE', 'No fetch implementation is available.');
            const bytes = toBytes(pdfBuffer);
            if (bytes.byteLength < 5) throw fail('MINERU_INPUT_INVALID', 'PDF bytes are empty.');
            const filename = String(parseOptions?.filename || 'upload.pdf').replace(/[\\/:*?"<>|]/g, '_').slice(0, 160);
            const signal = parseOptions?.signal;
            const startedAt = Date.now();
            const timings = { submitMs: 0, uploadMs: 0, pollMs: 0, fetchZipMs: 0, totalMs: 0 };

            const submitStartedAt = Date.now();
            const applied = await apiRequest('/api/v4/file-urls/batch', {
                method: 'POST',
                signal,
                body: JSON.stringify({
                    enable_formula: true,
                    enable_table: true,
                    language: 'ch',
                    model_version: 'vlm',
                    files: [{ name: filename, is_ocr: true, data_id: `qisi-${Date.now()}` }]
                })
            });
            timings.submitMs = Date.now() - submitStartedAt;
            if (applied.status !== 200 || applied.body?.code !== 0) throw upstreamFailure('申请上传地址', applied);
            const batchId = applied.body?.data?.batch_id;
            const uploadUrl = applied.body?.data?.file_urls?.[0];
            if (!batchId || !uploadUrl) throw fetchShapeError('申请上传地址', applied.body);

            const uploadStartedAt = Date.now();
            const upload = await fetchImpl(uploadUrl, { method: 'PUT', body: bytes, signal });
            timings.uploadMs = Date.now() - uploadStartedAt;
            if (upload.status !== 200) {
                const detail = await upload.text().catch(() => '');
                throw fail('MINERU_UPLOAD_FAILED', `MinerU 文件上传失败: HTTP ${upload.status} ${String(detail).slice(0, 200)}`, {
                    stage: 'upload', httpStatus: upload.status, mineruCode: null, mineruMsg: String(detail).slice(0, 600)
                });
            }

            const pollStartedAt = Date.now();
            const deadline = pollStartedAt + timeoutMs;
            let result = null;
            let lastState = '';
            while (Date.now() < deadline) {
                await sleep(pollIntervalMs);
                let polled = null;
                for (let attempt = 0; ; attempt += 1) {
                    try {
                        polled = await apiRequest(`/api/v4/extract-results/batch/${encodeURIComponent(batchId)}`, { method: 'GET', signal });
                        // 5xx/429 属于可重试的传输层失败，和网络异常同样处理。
                        if (polled.status === 429 || polled.status >= 500) throw upstreamFailure('查询解析进度', polled);
                        break;
                    } catch (error) {
                        if (error?.name === 'AbortError' || signal?.aborted) throw error;
                        if (attempt >= MAX_POLL_RETRIES || Date.now() >= deadline) {
                            if (error?.code) throw error;
                            throw fail('MINERU_POLL_FAILED', `查询解析进度失败（重试 ${MAX_POLL_RETRIES} 次后放弃）: ${error?.message || error}`, {
                                stage: 'poll', causeCode: error?.cause?.code || null
                            });
                        }
                        await sleep(pollIntervalMs);
                    }
                }
                const pollCode = polled.body?.code;
                if (polled.status !== 200 || (typeof pollCode === 'number' && pollCode !== 0) || polled.body?.success === false) {
                    throw upstreamFailure('查询解析进度', polled);
                }
                const row = polled.body?.data?.extract_result?.[0];
                const state = String(row?.state || 'unknown');
                lastState = state;
                if (state === 'done') { result = row; break; }
                if (state === 'failed') {
                    const message = row?.err_msg || JSON.stringify(polled.body).slice(0, 300);
                    throw fail('MINERU_PARSE_FAILED', `MinerU 解析失败: ${message}`, {
                        stage: 'poll', mineruCode: polled.body?.code ?? null, mineruMsg: String(message).slice(0, 600), state
                    });
                }
            }
            timings.pollMs = Date.now() - pollStartedAt;
            if (!result) {
                throw fail('MINERU_PARSE_TIMEOUT', `MinerU 解析超时（${Math.round(timeoutMs / 1000)}s，最后状态 ${lastState || 'unknown'}）。`, {
                    stage: 'poll', state: lastState
                });
            }
            if (!result.full_zip_url) throw fetchShapeError('解析结果', result);

            const fetchZipStartedAt = Date.now();
            const zipResponse = await fetchImpl(result.full_zip_url, { method: 'GET', signal });
            if (zipResponse.status !== 200) {
                throw fail('MINERU_ZIP_DOWNLOAD_FAILED', `MinerU 结果 ZIP 下载失败: HTTP ${zipResponse.status}`, {
                    stage: 'download', httpStatus: zipResponse.status
                });
            }
            const zipBytes = new Uint8Array(await zipResponse.arrayBuffer());
            const entries = readZipDirectory(zipBytes);
            const contentEntry = findContentListEntry(entries);
            const contentBytes = await readZipEntry(zipBytes, contentEntry);
            let list;
            try {
                list = JSON.parse(utf8Decode(contentBytes));
            } catch (error) {
                throw fail('MINERU_CONTENT_INVALID', `content_list.json 解析失败: ${error.message}`, { stage: 'unzip' });
            }

            const { pages, droppedPageNumbers, droppedUnknown } = parseContentList(list);
            const allBlocks = pages.flatMap(page => page.blocks);
            const answerTable = parseAnswerTable(allBlocks);
            const pageCount = pages.length;
            const notes = [];
            if (droppedPageNumbers) notes.push(`page_number 块已丢弃（${droppedPageNumbers} 个）`);
            if (droppedUnknown) notes.push(`无法识别的块已丢弃（${droppedUnknown} 个）`);
            if (!answerTable) notes.push('表格块中未解析出「题号/答案」结构，answerTable 为 null');
            notes.push(`MinerU batch ${batchId}`);

            jobSeq += 1;
            const jobId = `${Date.now().toString(36)}-${jobSeq.toString(36)}`;
            remember(jobId, { zipBytes, entries, filename });

            const sha256 = await sha256Hex(bytes);
            timings.fetchZipMs = Date.now() - fetchZipStartedAt;
            timings.totalMs = Date.now() - startedAt;

            return {
                protocol: PROTOCOL,
                job: jobId,
                source: { filename, pages: pageCount, sha256 },
                pages,
                answerTable,
                notes,
                timings
            };
        }

        function pickJob(jobId) {
            const id = String(jobId || '').trim();
            if (id) {
                const job = jobs.get(id);
                if (!job) throw fail('MINERU_JOB_NOT_FOUND', `未知的解析任务: ${id}`);
                return job;
            }
            const latest = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt)[0];
            if (!latest) throw fail('MINERU_JOB_NOT_FOUND', '没有可用的解析任务，请先调用 /api/mineru/parse。');
            return latest;
        }

        async function readImage(name, readOptions) {
            const target = String(name || '').replace(/^\.\//, '').trim();
            if (!target || target.includes('..') || target.startsWith('/') || target.includes('\\')) {
                throw fail('MINERU_IMAGE_NAME_INVALID', '图片路径非法。');
            }
            const job = pickJob(readOptions?.job);
            const entry = job.entries.get(target);
            if (!entry) throw fail('MINERU_IMAGE_NOT_FOUND', `ZIP 内不存在图片: ${target}`);
            return { bytes: await readZipEntry(job.zipBytes, entry), name: target, filename: job.filename };
        }

        return { parse, readImage, jobCount: () => jobs.size };
    }

    function fetchShapeError(stage, body) {
        return fail('MINERU_API_ERROR', `MinerU ${stage} 返回结构异常: ${JSON.stringify(body).slice(0, 300)}`, {
            stage, mineruCode: body?.code ?? null, mineruMsg: JSON.stringify(body).slice(0, 600)
        });
    }

    return {
        PROTOCOL,
        createMineruClient,
        internals: { readZipDirectory, readZipEntry, parseContentList, answerTableFromHtml, parseAnswerTable }
    };
});
