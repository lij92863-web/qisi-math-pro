'use strict';

function createAiRequestLimiter({ maxConcurrent = 4, capacity = 60,
    windowMs = 60000, clock = Date.now } = {}) {
    if (![maxConcurrent, capacity, windowMs].every(value => Number.isSafeInteger(value) && value > 0) ||
        typeof clock !== 'function') throw new TypeError('Invalid AI limiter configuration.');
    let active = 0, tokens = capacity, last = clock();
    if (!Number.isFinite(last)) throw new TypeError('Invalid limiter clock.');
    return Object.freeze({
        acquire() {
            const observed = clock();
            const now = Number.isFinite(observed) ? Math.max(last, observed) : last;
            tokens = Math.min(capacity, tokens + (now - last) * capacity / windowMs);
            last = now;
            if (active >= maxConcurrent) return { ok: false, code: 'AI_PROXY_BUSY', retryAfter: 1 };
            if (tokens < 1) return { ok: false, code: 'AI_PROXY_RATE_LIMIT',
                retryAfter: Math.max(1, Math.ceil((1 - tokens) * windowMs / capacity / 1000)) };
            active++; tokens--;
            let released = false;
            return { ok: true, release() {
                if (!released) { released = true; active--; }
            } };
        }
    });
}

const NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
    'EAI_AGAIN', 'ETIMEDOUT', 'EACCES', 'ENETUNREACH', 'EHOSTUNREACH',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET',
    'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']);
function networkFailureCode(error) {
    const code = error?.cause?.code || error?.code;
    return NETWORK_CODES.has(code) ? code : 'NETWORK_FAILURE';
}
module.exports = { createAiRequestLimiter, networkFailureCode };
