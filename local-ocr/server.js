const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const AdapterContract = require('../qisi-ocr-adapter-contract.js');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost']);
const MIME_EXTENSION = Object.freeze({
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'application/pdf': '.pdf'
});

const detectMimeType = buffer => {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )) return 'image/png';
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
    return '';
};

const serviceError = (code, message, statusCode) => {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

const safeInteger = (value, fallback, { minimum = 1, maximum = Number.MAX_SAFE_INTEGER } = {}) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= minimum && number <= maximum
        ? number
        : fallback;
};

const createUnavailableEngine = () => Object.freeze({
    getMetadata: () => ({ name: 'unavailable', version: 'none', model: 'none' }),
    healthCheck: async () => ({ ok: false, code: 'ocr-engine-unavailable' }),
    recognize: async () => {
        throw serviceError('ocr-engine-unavailable', 'Local OCR engine is unavailable.', 503);
    }
});

const sanitizeMetadata = engine => {
    let value = {};
    try {
        value = engine?.getMetadata?.() || {};
    } catch (_error) {
        value = {};
    }
    return {
        name: String(value.name || 'unknown'),
        version: String(value.version || 'unknown'),
        model: String(value.model || 'unknown')
    };
};

const sendJson = (response, statusCode, body) => {
    const serialized = JSON.stringify(body);
    response.writeHead(statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(serialized),
        'cache-control': 'no-store'
    });
    response.end(serialized);
};

const isInside = (candidate, parent) => {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const removeManagedJob = async (jobDirectory, tempRoot) => {
    if (!jobDirectory || !isInside(jobDirectory, tempRoot)) {
        if (jobDirectory) throw new Error('Refusing to clean an unmanaged OCR temp path.');
        return;
    }
    await fs.promises.rm(jobDirectory, { recursive: true, force: true });
};

const readBody = (request, maxBytes) => new Promise((resolve, reject) => {
    const declared = Number(request.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
        request.resume();
        reject(serviceError('size-rejected', 'OCR input exceeds size limit.', 413));
        return;
    }
    const chunks = [];
    let total = 0;
    let settled = false;
    request.on('data', chunk => {
        if (settled) return;
        total += chunk.length;
        if (total > maxBytes) {
            settled = true;
            request.resume();
            reject(serviceError('size-rejected', 'OCR input exceeds size limit.', 413));
            return;
        }
        chunks.push(chunk);
    });
    request.on('end', () => {
        if (settled) return;
        settled = true;
        if (!total) {
            reject(serviceError('empty-input', 'OCR input body is required.', 400));
            return;
        }
        resolve(Buffer.concat(chunks));
    });
    request.on('error', error => {
        if (settled) return;
        settled = true;
        reject(serviceError('request-read-failed', 'OCR request body could not be read.', 400));
    });
});

const requestIdOf = request => {
    const supplied = String(request.headers['x-qisi-request-id'] || '').trim();
    const requestId = supplied || `local-${crypto.randomUUID()}`;
    if (requestId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(requestId)) {
        throw serviceError('invalid-request-id', 'Invalid OCR requestId.', 400);
    }
    return requestId;
};

const createLocalOcrService = ({
    host = '127.0.0.1',
    port = 8765,
    maxBytes = 20 * 1024 * 1024,
    concurrencyLimit = 2,
    timeoutMs = 30000,
    tempRoot = path.join(__dirname, 'tmp'),
    engine = createUnavailableEngine(),
    logger
} = {}) => {
    if (!LOOPBACK_HOSTS.has(host)) throw new Error('Local OCR service must bind to loopback.');
    if (!engine || typeof engine.getMetadata !== 'function' ||
        typeof engine.healthCheck !== 'function' || typeof engine.recognize !== 'function') {
        throw new TypeError('Local OCR engine must implement metadata, health, and recognize methods.');
    }
    const configuredPort = safeInteger(port, 8765, { minimum: 0, maximum: 65535 });
    const configuredMaxBytes = safeInteger(maxBytes, 20 * 1024 * 1024);
    const configuredConcurrency = safeInteger(concurrencyLimit, 2, { maximum: 64 });
    const configuredTimeout = safeInteger(timeoutMs, 30000, { maximum: 10 * 60 * 1000 });
    const managedTempRoot = path.resolve(tempRoot);
    const activeRequestIds = new Set();
    const activeControllers = new Map();
    let activeCount = 0;
    let server;

    const log = (event, metadata = {}) => {
        if (typeof logger !== 'function') return;
        const safe = {};
        for (const field of ['requestId', 'code', 'statusCode', 'durationMs', 'activeCount']) {
            if (metadata[field] !== undefined) safe[field] = metadata[field];
        }
        logger(Object.freeze({ event, ...safe }));
    };

    const handleHealth = async response => {
        const metadata = sanitizeMetadata(engine);
        let health;
        try {
            health = await engine.healthCheck();
        } catch (_error) {
            health = { ok: false, code: 'ocr-engine-unavailable' };
        }
        sendJson(response, 200, {
            ok: health?.ok === true,
            service: 'qisi-local-ocr',
            serviceVersion: '1.0.0',
            bind: 'loopback-only',
            engine: {
                ...metadata,
                available: health?.ok === true
            },
            limits: {
                maxBytes: configuredMaxBytes,
                concurrency: configuredConcurrency,
                timeoutMs: configuredTimeout
            }
        });
    };

    const handleRecognition = async (request, response) => {
        const started = Date.now();
        let requestId = '';
        let jobDirectory = '';
        let controller;
        let responseStatus = 500;
        let responseBody = { ok: false, code: 'ocr-service-failed', requestId: '' };
        try {
            requestId = requestIdOf(request);
            if (activeRequestIds.has(requestId)) {
                throw serviceError('duplicate-request-id', 'OCR requestId is already active.', 409);
            }
            if (activeCount >= configuredConcurrency) {
                throw serviceError('concurrency-limit', 'Local OCR concurrency limit reached.', 429);
            }
            const mimeType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(MIME_EXTENSION, mimeType)) {
                request.resume();
                throw serviceError('mime-rejected', 'Unsupported OCR MIME.', 415);
            }

            activeRequestIds.add(requestId);
            activeCount += 1;
            const buffer = await readBody(request, configuredMaxBytes);
            if (detectMimeType(buffer) !== mimeType) {
                throw serviceError('mime-spoofed', 'OCR body does not match its MIME type.', 415);
            }
            await fs.promises.mkdir(managedTempRoot, { recursive: true });
            jobDirectory = await fs.promises.mkdtemp(path.join(managedTempRoot, 'job-'));
            const tempFilePath = path.join(jobDirectory, `source${MIME_EXTENSION[mimeType]}`);
            await fs.promises.writeFile(tempFilePath, buffer, { flag: 'wx' });
            controller = new AbortController();
            activeControllers.set(requestId, controller);
            let timeoutHandle;
            const timeout = new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(serviceError('ocr-timeout', 'Local OCR request timed out.', 504));
                    controller.abort();
                }, configuredTimeout);
                timeoutHandle.unref?.();
            });
            let result;
            try {
                result = await Promise.race([
                    Promise.resolve(engine.recognize({
                        requestId,
                        mimeType,
                        buffer,
                        tempFilePath,
                        signal: controller.signal
                    })),
                    timeout
                ]);
            } finally {
                clearTimeout(timeoutHandle);
            }
            AdapterContract.validateResponse(result, requestId);
            const metadata = sanitizeMetadata(engine);
            responseStatus = 200;
            responseBody = {
                engine: metadata.name,
                engineVersion: metadata.version,
                requestId,
                rawText: result.rawText || '',
                blocks: result.blocks || [],
                formulas: result.formulas || [],
                images: result.images || [],
                rawEvidenceRef: result.rawEvidenceRef || `local-ocr://${requestId}`,
                confidence: result.confidence ?? null,
                warnings: result.warnings || [],
                durationMs: Date.now() - started
            };
            log('local-ocr-success', { requestId, durationMs: Date.now() - started });
        } catch (cause) {
            const code = cause?.code || 'ocr-service-failed';
            responseStatus = cause?.statusCode || ({
                'ocr-malformed-response': 502,
                'ocr-engine-unavailable': 503
            }[code] || 500);
            responseBody = { ok: false, code, requestId };
            log('local-ocr-failure', {
                requestId, code, statusCode: responseStatus, durationMs: Date.now() - started
            });
        } finally {
            if (controller && activeControllers.get(requestId) === controller) {
                activeControllers.delete(requestId);
            }
            if (activeRequestIds.delete(requestId)) activeCount -= 1;
            try {
                await removeManagedJob(jobDirectory, managedTempRoot);
            } catch (_error) {
                log('local-ocr-cleanup-failure', { requestId, code: 'temp-cleanup-failed' });
            }
        }
        if (!response.headersSent) sendJson(response, responseStatus, responseBody);
    };

    const requestHandler = async (request, response) => {
        response.setHeader('x-content-type-options', 'nosniff');
        if (request.method === 'GET' && request.url === '/health') {
            await handleHealth(response);
            return;
        }
        if (request.method === 'POST' && request.url === '/v1/recognize') {
            await handleRecognition(request, response);
            return;
        }
        request.resume();
        sendJson(response, 404, { ok: false, code: 'not-found' });
    };

    return Object.freeze({
        async start() {
            if (server) throw new Error('Local OCR service is already started.');
            server = http.createServer((request, response) => {
                requestHandler(request, response).catch(() => {
                    if (!response.headersSent) {
                        sendJson(response, 500, { ok: false, code: 'ocr-service-failed' });
                    } else {
                        response.destroy();
                    }
                });
            });
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(configuredPort, host, resolve);
            });
            return server.address();
        },
        async stop() {
            if (!server) return;
            for (const controller of activeControllers.values()) controller.abort();
            const current = server;
            server = null;
            current.closeAllConnections?.();
            await new Promise(resolve => current.close(resolve));
        },
        getStatus() {
            return {
                started: Boolean(server),
                activeCount,
                engine: sanitizeMetadata(engine),
                host,
                port: server?.address()?.port ?? configuredPort
            };
        }
    });
};

if (require.main === module) {
    const service = createLocalOcrService({
        host: '127.0.0.1',
        port: safeInteger(process.env.QISI_LOCAL_OCR_PORT, 8765, { minimum: 1, maximum: 65535 }),
        maxBytes: safeInteger(process.env.QISI_LOCAL_OCR_MAX_BYTES, 20 * 1024 * 1024),
        concurrencyLimit: safeInteger(process.env.QISI_LOCAL_OCR_CONCURRENCY, 2, { maximum: 64 }),
        timeoutMs: safeInteger(process.env.QISI_LOCAL_OCR_TIMEOUT_MS, 30000, { maximum: 10 * 60 * 1000 }),
        logger: event => process.stdout.write(`${JSON.stringify(event)}\n`)
    });
    service.start().then(address => {
        process.stdout.write(`${JSON.stringify({
            event: 'local-ocr-started',
            host: '127.0.0.1',
            port: address.port,
            engine: 'unavailable',
            modelDownloadAttempted: false
        })}\n`);
    }).catch(error => {
        process.stderr.write(`[local-ocr] ${error.message}\n`);
        process.exitCode = 1;
    });
    const stop = () => service.stop().finally(() => process.exit());
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

module.exports = {
    LOOPBACK_HOSTS,
    MIME_EXTENSION,
    detectMimeType,
    createUnavailableEngine,
    createLocalOcrService
};
