const crypto = require('node:crypto');
const fs = require('node:fs');
const C = require('../../qisi-mineru-client').internals;

// Exact source bytes are checked at the HTTP boundary; no draft/producer injection.
async function installMineruReplay(page, sources) {
    const byHash = new Map(sources.map(source => [crypto.createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'), source]));
    const calls = [];
    await page.route('**/api/mineru/**', async route => {
        const request = route.request(), url = new URL(request.url()); calls.push(url.pathname);
        if (url.pathname === '/api/mineru/status') return route.fulfill({ json: { configured: true } });
        if (url.pathname === '/api/mineru/parse') {
            const bytes = request.postDataBuffer();
            const boundary = request.headers()['content-type'].match(/boundary=(.+)$/)[1];
            const start = bytes.indexOf(Buffer.from('\r\n\r\n')) + 4;
            const end = bytes.indexOf(Buffer.from('\r\n--' + boundary), start);
            const sha256 = crypto.createHash('sha256').update(bytes.subarray(start, end)).digest('hex');
            const source = byHash.get(sha256);
            if (!source) throw new Error('Offline MinerU replay source SHA mismatch');
            const parsed = C.parseContentList(source.items, { sourceId: sha256 });
            return route.fulfill({ json: { protocol: 'mineru-blocks-v1', job: sha256, source: { sha256, pages: parsed.pages.length },
                ...parsed, answerTable: C.parseAnswerTable(parsed.pages.flatMap(p => p.blocks)), receipt: { state: 'ready', version: 'mineru-extraction-v2' } } });
        }
        if (url.pathname === '/api/mineru/image') {
            const source = byHash.get(url.searchParams.get('sourceId'));
            if (!source || url.searchParams.get('job') !== url.searchParams.get('sourceId')) throw new Error('Offline asset identity mismatch');
            const image = source.images?.[url.searchParams.get('name')];
            if (!image) return route.fulfill({ status: 404, json: { code: 'MINERU_IMAGE_NOT_FOUND' } });
            return route.fulfill({ contentType: image.type || 'image/png', body: image.bytes });
        }
        throw new Error('Unexpected MinerU endpoint ' + url.pathname);
    });
    return { calls };
}
module.exports = { installMineruReplay };
