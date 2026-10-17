'use strict';
const https = require('node:https');
const { performance } = require('node:perf_hooks');
const PATHS = new Set(['/compatible-mode/v1/chat/completions',
    '/api/v1/services/aigc/multimodal-generation/generation']);
// One process-local pool, matching the proxy's concurrency limit. No automatic POST retry.
let sharedAgent;
function getSharedAgent() {
    if (!sharedAgent) sharedAgent = new https.Agent({ keepAlive: true, maxSockets: 4,
        maxTotalSockets: 4, maxFreeSockets: 2, scheduling: 'lifo',
        agentKeepAliveTimeoutBuffer: 1000 });
    return sharedAgent;
}
function closeDashScopeConnections() {
    const retired = sharedAgent; sharedAgent = undefined; retired?.destroy();
}
function postDashScope({ url, headers, body, signal, onPhase, maxResponseBytes = 16 * 1024 * 1024 } = {},
    { request = https.request, agent = getSharedAgent() } = {}) {
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
        let settled = false, req, socket;
        const startedAt = performance.now(), listeners = [], events = [];
        let phase = 'request_created', reusedSocket = false, tlsAuthorized = null;
        let requestFinished = false, responseStarted = false, responseComplete = false;
        const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt));
        const record = (stage, terminal = false) => {
            if (!terminal) phase = stage;
            const event = { stage, elapsedMs: elapsed() };
            if (events.length < 12) events.push(event);
            // Diagnostics must never affect billing, transport or cancellation behavior.
            try { if (typeof onPhase === 'function') onPhase({ ...event, reusedSocket }); } catch { /* observation only */ }
        };
        const listen = (target, event, handler) => {
            target.once(event, handler); listeners.push(() => target.removeListener(event, handler));
        };
        const finish = (error, result) => {
            if (settled) return; settled = true;
            signal?.removeEventListener('abort', onAbort);
            listeners.forEach(remove => remove());
            const outcome = error ? error.name === 'AbortError' ? 'cancelled' : 'failed' : 'complete';
            record(outcome, true);
            // Local writes and TLS events are not proof of provider acceptance or billing.
            const transportDiagnostic = { version: 1, phase, outcome, elapsedMs: elapsed(),
                reusedSocket, tlsAuthorized, requestFinished, responseStarted, responseComplete,
                events: events.map(event => ({ ...event })) };
            if (error) { error.transportDiagnostic = transportDiagnostic; reject(error); }
            else resolve({ ...result, transportDiagnostic });
        };
        const onAbort = () => { const error = aborted(); finish(error); req?.destroy(error); };
        const interrupted = () => Object.assign(Error('Upstream response interrupted.'), { code: 'ECONNRESET' });
        const onSocket = assigned => {
            if (settled) return;
            socket = assigned; reusedSocket = req.reusedSocket === true;
            tlsAuthorized = reusedSocket ? socket.authorized === true : null;
            record(reusedSocket ? 'socket_reused' : 'socket_assigned');
            if (reusedSocket) return;
            listen(socket, 'lookup', () => record('dns_lookup'));
            listen(socket, 'connect', () => record('tcp_connected'));
            listen(socket, 'secureConnect', () => {
                tlsAuthorized = socket.authorized === true; record('tls_connected');
            });
        };
        try {
            record('request_created');
            req = request(parsed, { method: 'POST', headers,
                rejectUnauthorized: true, agent }, response => {
                if (settled) { response.destroy(); return; }
                responseStarted = true; record('response_started');
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
                response.once('aborted', () => finish(interrupted()));
                response.once('close', () => { if (!settled) finish(interrupted()); });
                response.once('end', () => {
                    if (settled) return;
                    if (response.complete === false) return finish(interrupted());
                    responseComplete = true; record('response_complete');
                    finish(null, {
                        status: response.statusCode,
                        ok: response.statusCode >= 200 && response.statusCode < 300,
                        contentType: response.headers['content-type'] || 'application/json; charset=utf-8',
                        buffer: Buffer.concat(chunks, bytes)
                    });
                });
            });
            req.once('error', error => finish(error));
            listen(req, 'socket', onSocket);
            listen(req, 'finish', () => { requestFinished = true; record('request_finished'); });
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted) return onAbort();
            req.end(body);
        } catch (error) { finish(error); req?.destroy(error); }
    });
}
module.exports = { postDashScope, closeDashScopeConnections };
