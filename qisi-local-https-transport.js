'use strict';
const https = require('node:https');
const PATHS = new Set(['/compatible-mode/v1/chat/completions',
    '/api/v1/services/aigc/multimodal-generation/generation']);
function postDashScope({ url, headers, body, signal, maxResponseBytes = 16 * 1024 * 1024 } = {},
    { request = https.request } = {}) {
    return new Promise((resolve, reject) => {
        let parsed;
        try { parsed = new URL(url); } catch { return reject(Error('INVALID_UPSTREAM_URL')); }
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'dashscope.aliyuncs.com' ||
            parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash ||
            !PATHS.has(parsed.pathname) || typeof body !== 'string' ||
            !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
            return reject(Error('INVALID_UPSTREAM_REQUEST'));
        }
        const aborted = () => Object.assign(Error('Upstream request cancelled.'), { name: 'AbortError' });
        if (signal?.aborted) return reject(aborted());
        let settled = false, req;
        const finish = (error, result) => {
            if (settled) return; settled = true;
            signal?.removeEventListener('abort', onAbort);
            if (error) reject(error); else resolve(result);
        };
        const onAbort = () => { const error = aborted(); finish(error); req?.destroy(error); };
        try {
            req = request(parsed, { method: 'POST', headers,
                rejectUnauthorized: true, agent: false }, response => {
                const chunks = []; let bytes = 0;
                response.on('data', chunk => {
                    if (settled) return;
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    bytes += buffer.length;
                    if (bytes > maxResponseBytes) {
                        const error = Object.assign(Error('Upstream response too large.'), { code: 'UPSTREAM_RESPONSE_TOO_LARGE' });
                        finish(error); req.destroy(error); response.destroy(error); return;
                    }
                    chunks.push(buffer);
                });
                response.once('error', error => finish(error));
                response.once('aborted', () => finish(Object.assign(Error('Upstream response interrupted.'), { code: 'ECONNRESET' })));
                response.once('end', () => { if (settled) return; finish(null, {
                    status: response.statusCode,
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    contentType: response.headers['content-type'] || 'application/json; charset=utf-8',
                    buffer: Buffer.concat(chunks, bytes)
                }); });
            });
            req.once('error', error => finish(error));
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted) return onAbort();
            req.end(body);
        } catch (error) { finish(error); req?.destroy(error); }
    });
}
module.exports = { postDashScope };
