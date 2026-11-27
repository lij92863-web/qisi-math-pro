(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.MineruClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // MinerU 精准解析客户端：申请上传地址 → PUT 原始字节 → 轮询 → 取回 ZIP → 组装块。
    // 契约见 ai/MINERU_BLOCK_PROTOCOL.md §1 / §4。ZIP 解压只用 zlib 或 DecompressionStream，
    // ZIP 校验及网络生命周期仅在本地 Node 服务执行。
    const PROTOCOL = 'mineru-blocks-v1';
    let nodeZlib = null;
    try { if (typeof require === 'function') nodeZlib = require('node:zlib'); } catch (_) { nodeZlib = null; }

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
        const directoryEnd = cursor + view.getUint32(eocd + 12, true);
        if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true) ||
            total !== view.getUint16(eocd + 8, true) || total > 5000 || directoryEnd !== eocd ||
            eocd + 22 + view.getUint16(eocd + 20, true) !== view.byteLength) throw fail('MINERU_ZIP_INVALID');
        const entries = new Map();
        let totalBytes = 0;
        for (let i = 0; i < total; i += 1) {
            if (cursor + 46 > view.byteLength || view.getUint32(cursor, true) !== 0x02014b50) {
                throw fail('MINERU_ZIP_INVALID', 'ZIP central directory is truncated.');
            }
            const method = view.getUint16(cursor + 10, true);
            const compressedSize = view.getUint32(cursor + 20, true);
            const uncompressedSize = view.getUint32(cursor + 24, true);
            const crc = view.getUint32(cursor + 16, true);
            const nameLength = view.getUint16(cursor + 28, true);
            const extraLength = view.getUint16(cursor + 30, true);
            const commentLength = view.getUint16(cursor + 32, true);
            const localOffset = view.getUint32(cursor + 42, true);
            const name = utf8Decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
            totalBytes += uncompressedSize;
            if (cursor + 46 + nameLength + extraLength + commentLength > directoryEnd ||
                view.getUint16(cursor + 8, true) & 1 || ![0, 8].includes(method) ||
                !name || entries.has(name) || /[\\\u0000]/.test(name) || name.startsWith('/') || /^[a-z]:/i.test(name) ||
                name.split('/').some(part => part === '.' || part === '..') ||
                uncompressedSize > 64 * 1024 * 1024 || totalBytes > 256 * 1024 * 1024 ||
                uncompressedSize / Math.max(1, compressedSize) > 200 || localOffset >= cursor) throw fail('MINERU_ZIP_INVALID');
            entries.set(name, { name, method, compressedSize, uncompressedSize, crc, localOffset, directoryStart: view.getUint32(eocd + 16, true) });
            cursor += 46 + nameLength + extraLength + commentLength;
        }
        if (cursor !== directoryEnd) throw fail('MINERU_ZIP_INVALID');
        return entries;
    }

    function localDataOffset(bytes, entry) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const at = entry.localOffset;
        if (at + 30 > view.byteLength || view.getUint32(at, true) !== 0x04034b50) {
            throw fail('MINERU_ZIP_INVALID', `ZIP local header is missing for ${entry.name}.`);
        }
        const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
        if (start + entry.compressedSize > entry.directoryStart || view.getUint16(at + 8, true) !== entry.method ||
            utf8Decode(bytes.subarray(at + 30, at + 30 + view.getUint16(at + 26, true))) !== entry.name) throw fail('MINERU_ZIP_INVALID');
        return start;
    }

    async function readZipEntry(bytes, entry) {
        const start = localDataOffset(bytes, entry);
        const payload = bytes.subarray(start, start + entry.compressedSize);
        if (!nodeZlib?.crc32) throw fail('MINERU_ZIP_UNSUPPORTED', 'ZIP verification requires the bundled Node runtime.');
        let result;
        try { result = entry.method === 0 ? payload : new Uint8Array(nodeZlib.inflateRawSync(payload, { maxOutputLength: entry.uncompressedSize + 1 })); }
        catch { throw fail('MINERU_ZIP_INVALID'); }
        if (result.length !== entry.uncompressedSize || nodeZlib.crc32(result) !== entry.crc) throw fail('MINERU_ZIP_INVALID');
        return result;
    }

    function findContentListEntry(entries) {
        const candidates = [...entries.keys()]
            .filter(name => /_content_list\.json$/i.test(name) && !/_content_list_v2\.json$/i.test(name));
        if (candidates.length !== 1) throw fail('MINERU_ZIP_INVALID', 'ZIP 必须只有一份 *_content_list.json。');
        return entries.get(candidates[0]);
    }

    // ---- 块整理（契约 §1） ----

    function pageOf(item) {
        const index = item?.page_idx;
        if (!Number.isSafeInteger(index) || index < 0) throw fail('MINERU_CONTENT_INVALID', 'content_list 的 page_idx 必须是非负整数。');
        return index + 1;
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

    // 只按 type 或 text 判重会误删题图：image/chart 的内容在 img_path 而不在 text。
    // 若将来要加内容去重，键必须含 image（或 bbox），否则 8 张不同题图会被当成同一块；
    // 本卷实测按 type|text 统计出的 15 个"重复"里，有 9 个是 text 为空的假重复。
    function parseContentList(list, { sourceId = null } = {}) {
        if (!Array.isArray(list)) throw fail('MINERU_CONTENT_INVALID', 'content_list.json 不是数组。');
        const pages = [];
        let droppedPageNumbers = 0;
        let retainedUnknown = 0;
        const counts = new Map();
        let previousPage = 0;
        for (const [itemIndex, item] of list.entries()) {
            const page = pageOf(item);
            if (page < previousPage) throw fail('MINERU_CONTENT_INVALID', 'content_list 页码倒序，不能重排原始来源。');
            previousPage = page;
            while (pages.length < page) pages.push({ page: pages.length + 1, blocks: [] });
            if (String(item?.type || '') === 'page_number') { droppedPageNumbers += 1; continue; }
            const bucket = pages[page - 1].blocks;
            const ordinal = counts.get(page) || 0;
            counts.set(page, ordinal + 1);
            const id = `p${page}b${ordinal}`;
            const block = toBlock(item, id) || { id, type: 'unsupported', text: String(item?.text ?? '') };
            block.page = page;
            if (block.type === 'unsupported') retainedUnknown += 1;
            const field = item.type === 'table' && item.table_body != null ? 'table_body' : 'text';
            block.origin = { sourceId, itemIndex, field, blockId: id, ...(block.text != null ? { range: [0, block.text.length] } : {}) };
            bucket.push(block);
            for (const field of ['image_caption', 'image_footnote', 'table_caption', 'table_footnote']) {
                const values = Array.isArray(item[field]) ? item[field] : item[field] == null ? [] : [item[field]];
                values.forEach((value, index) => {
                    const text = String(value);
                    const captionId = `${id}/${field}/${index}`;
                    bucket.push({ id: captionId, page, type: 'text', text, parentId: id,
                        origin: { sourceId, itemIndex, field, index, blockId: captionId, range: [0, text.length] } });
                });
            }
        }
        return { pages, droppedPageNumbers, droppedUnknown: 0, retainedUnknown, evidence: { items: list } };
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

    // Absence and invalid evidence are different states. An invalid printed
    // table cannot contribute answers, even when the archive contains other tables.
    function answerTableFromHtml(html) {
        const rows = tableRows(html);
        const table = {};
        let pending = null;
        let pairs = 0;
        // 中学试卷卷头几乎必有一张「题号｜一｜二｜三｜总分 / 得分｜…」的成绩表，
        // 它不是答案表。只有整张表里真的出现「答案」单元格时，才按答案表严格校验；
        // 否则安静跳过。否则一张成绩表就能把整份 PDF 判死（整卷归零）。
        const isAnswerTable = rows.some(cells => String(cells[0] || '').replace(/\s+/g, '') === '答案');
        if (!isAnswerTable) return null;
        for (const cells of rows) {
            const head = String(cells[0] || '').replace(/\s+/g, '');
            if (head === '题号') {
                if (pending) throw fail('MINERU_ANSWER_TABLE_INVALID', '题号行缺少对应答案行。');
                pending = cells.slice(1); continue;
            }
            if (head === '答案' && pending) {
                if (!pending.length || cells.length !== pending.length + 1) throw fail('MINERU_ANSWER_TABLE_INVALID', '题号与答案列数不一致。');
                for (let i = 0; i < pending.length; i += 1) {
                    const label = String(pending[i] || '').trim().replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10));
                    const answer = String(cells[i + 1] || '').replace(/\s+/g, '');
                    // Rectangular tables may pad their final pair of rows with
                    // empty columns. Only a pair of empty cells is padding.
                    if (!label && !answer) continue;
                    if (!/^[1-9]\d{0,2}$/.test(label)) throw fail('MINERU_ANSWER_TABLE_INVALID', '题号单元格不是明确的正整数。');
                    const number = String(Number(label));
                    if (!answer) throw fail('MINERU_ANSWER_TABLE_INVALID', '答案表存在空答案。');
                    if (Object.prototype.hasOwnProperty.call(table, number)) throw fail('MINERU_ANSWER_TABLE_INVALID', '答案表题号重复。');
                    table[number] = answer;
                    pairs += 1;
                }
                pending = null;
            } else if (pending) throw fail('MINERU_ANSWER_TABLE_INVALID', '题号行后不是答案行。');
        }
        if (pending) throw fail('MINERU_ANSWER_TABLE_INVALID', '题号行缺少对应答案行。');
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
                if (Object.prototype.hasOwnProperty.call(merged, number) && merged[number] !== answer) throw fail('MINERU_ANSWER_TABLE_INVALID', '多个答案表之间存在冲突。');
                merged[number] = answer;
                pairs += 1;
            }
        }
        return pairs ? merged : null;
    }

    function createMineruClient(options = {}) {
        const { createMineruTaskService } = require('./qisi-mineru-task-service');
        const service = createMineruTaskService({ ...options, projectZip: async (zip, { sourceId, filename }) => {
            const entries = readZipDirectory(zip);
            const content = await readZipEntry(zip, findContentListEntry(entries));
            let list;
            try { list = JSON.parse(utf8Decode(content)); }
            catch { throw fail('MINERU_CONTENT_INVALID'); }
            const { pages, droppedPageNumbers, retainedUnknown, evidence } = parseContentList(list, { sourceId });
            const blocks = pages.flatMap(page => page.blocks);
            for (const block of blocks) {
                if (!block.image) continue;
                const entry = entries.get(block.image);
                if (!entry) throw fail('MINERU_IMAGE_NOT_FOUND');
                await readZipEntry(zip, entry);
            }
            let answerTable = null, answerTableIssue;
            try { answerTable = parseAnswerTable(blocks); }
            catch (error) {
                if (error.code !== 'MINERU_ANSWER_TABLE_INVALID') throw error;
                answerTableIssue = error.code;
            }
            return { protocol: PROTOCOL, source: { filename, pages: pages.length, sha256: sourceId },
                pages, evidence, answerTable, answerTableIssue,
                notes: [droppedPageNumbers ? `page_number 块已丢弃（${droppedPageNumbers} 个）` : '',
                    retainedUnknown ? `未支持的块已保留，需核查（${retainedUnknown} 个）` : ''].filter(Boolean) };
        } });
        async function readImage(name, identity) {
            const target = String(name || '');
            if (!target || target.split('/').some(p => p === '..' || p === '.') || /[\\\u0000]/.test(target) || target.startsWith('/')) throw fail('MINERU_IMAGE_NAME_INVALID');
            const { bytes, receipt } = await service.readZip(identity);
            const entry = readZipDirectory(bytes).get(target);
            if (!entry) throw fail('MINERU_IMAGE_NOT_FOUND');
            return { bytes: await readZipEntry(bytes, entry), name: target, filename: receipt.filename };
        }
        return Object.freeze({ parse: service.parse, readImage });
    }

    return {
        PROTOCOL,
        createMineruClient,
        internals: { readZipDirectory, readZipEntry, parseContentList, answerTableFromHtml, parseAnswerTable }
    };
});
