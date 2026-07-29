import {
    CACHE_NAME,
    CACHE_PREFIX,
    RUNTIME_ASSETS,
    RUNTIME_VERSION,
    WORKER_MESSAGE,
    assertSameOriginUrl,
    validateCompileRequest
} from './qisi-handout-compiler-contract.mjs';
import {
    diagnosticFromError,
    normalizeCompilerDiagnostics
} from './qisi-handout-compiler-diagnostics.mjs';

let runtimePromise = null;
let mountedAssetPaths = new Set();

const now = () => performance.now();

const toUint8Array = value => {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(
            value.buffer,
            value.byteOffset,
            value.byteLength
        );
    }
    return null;
};

function installWorkerCompatibility() {
    if ('window' in self) return;
    Object.defineProperty(self, 'window', {
        value: self,
        configurable: false,
        enumerable: false,
        writable: false
    });
}

function reportProgress(requestId, phase, detail) {
    self.postMessage({
        type: WORKER_MESSAGE.progress,
        requestId,
        phase,
        detail,
        runtimeVersion: RUNTIME_VERSION
    });
}

function assetError(descriptor, message) {
    const error = new Error(
        `${descriptor.role} unavailable: ${message}`
    );
    error.code = descriptor.kind === 'font'
        ? 'HANDOUT_COMPILER_FONT_MISSING'
        : 'HANDOUT_COMPILER_ASSET_MISSING';
    error.assetRole = descriptor.role;
    return error;
}

async function fetchStaticAsset(descriptor, cacheStats) {
    const url = assertSameOriginUrl(descriptor.url, self.location.origin);
    const canCache = typeof caches !== 'undefined';
    const cache = canCache ? await caches.open(CACHE_NAME) : null;
    const cached = cache ? await cache.match(url) : null;

    if (cached) {
        const bytes = new Uint8Array(await cached.arrayBuffer());
        if (bytes.byteLength === descriptor.bytes) {
            cacheStats.hits += 1;
            return bytes;
        }
        await cache.delete(url);
    }

    cacheStats.misses += 1;
    let response;
    try {
        response = await fetch(url, { cache: 'no-store' });
    } catch (error) {
        throw assetError(descriptor, error?.message || error);
    }
    if (!response.ok) {
        throw assetError(descriptor, `HTTP ${response.status}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== descriptor.bytes) {
        throw assetError(
            descriptor,
            `expected ${descriptor.bytes} bytes, received ${bytes.byteLength}`
        );
    }
    if (cache) {
        await cache.put(url, new Response(bytes.slice(), {
            status: 200,
            headers: {
                'Content-Type': response.headers.get('Content-Type')
                    || 'application/octet-stream',
                'X-TEX-Runtime-Version': RUNTIME_VERSION
            }
        }));
    }
    return bytes;
}

async function removeStaleRuntimeCaches() {
    if (typeof caches === 'undefined') return;
    const names = await caches.keys();
    await Promise.all(names
        .filter(name =>
            name.startsWith(CACHE_PREFIX)
            && name !== CACHE_NAME
        )
        .map(name => caches.delete(name)));
}

async function initializeRuntime(requestId) {
    installWorkerCompatibility();
    reportProgress(
        requestId,
        'runtime',
        'Loading local Typst, MiTeX, and fixed fonts.'
    );

    const moduleUrl = assertSameOriginUrl(
        RUNTIME_ASSETS.compilerModule.url,
        self.location.origin
    );
    const typst = await import(moduleUrl);
    const cacheStats = { hits: 0, misses: 0 };
    const [
        wasmBytes,
        fontBytes,
        virtualFiles
    ] = await Promise.all([
        fetchStaticAsset(RUNTIME_ASSETS.compilerWasm, cacheStats),
        Promise.all(RUNTIME_ASSETS.fonts.map(
            descriptor => fetchStaticAsset(descriptor, cacheStats)
        )),
        Promise.all(RUNTIME_ASSETS.virtualFiles.map(async descriptor => ({
            ...descriptor,
            content: await fetchStaticAsset(descriptor, cacheStats)
        })))
    ]);

    reportProgress(
        requestId,
        'virtual-files',
        'Mounting local MiTeX packages and the document file system.'
    );
    const compiler = typst.createTypstCompiler();
    await compiler.init({
        getModule: () => wasmBytes,
        beforeBuild: [
            typst.loadFonts(fontBytes, { assets: false })
        ]
    });

    const decoder = new TextDecoder();
    for (const file of virtualFiles) {
        if (file.kind === 'source') {
            compiler.addSource(
                file.target,
                decoder.decode(file.content)
            );
        } else {
            compiler.mapShadow(file.target, file.content);
        }
    }
    await removeStaleRuntimeCaches();

    return Object.freeze({
        compiler,
        cacheMetrics: Object.freeze({
            cacheName: CACHE_NAME,
            cacheHits: cacheStats.hits,
            cacheMisses: cacheStats.misses
        })
    });
}

function getRuntime(requestId) {
    if (!runtimePromise) {
        runtimePromise = initializeRuntime(requestId).catch(error => {
            runtimePromise = null;
            throw error;
        });
    }
    return runtimePromise;
}

function mountDocumentAssets(compiler, assets) {
    for (const path of mountedAssetPaths) {
        compiler.unmapShadow(path);
    }
    mountedAssetPaths = new Set();
    for (const asset of assets) {
        compiler.mapShadow(asset.path, new Uint8Array(asset.bytes));
        mountedAssetPaths.add(asset.path);
    }
}

function extractPdfBytes(result) {
    const raw = result instanceof Uint8Array
        ? result
        : result?.result
            ?? result?.artifact
            ?? result?.output;
    return toUint8Array(raw);
}

async function compileDocument(message) {
    const request = validateCompileRequest(message);
    const initStartedAt = now();
    const runtime = await getRuntime(request.requestId);
    const initializedAt = now();

    reportProgress(
        request.requestId,
        'compile',
        'Compiling the trusted document in the Typst Worker.'
    );
    mountDocumentAssets(runtime.compiler, request.assets);
    runtime.compiler.addSource('/main.typ', request.source);

    const preflight = await runtime.compiler.runWithWorld({
        mainFilePath: '/main.typ',
        inputs: {}
    }, world => world.compile({ diagnostics: 'full' }));
    const result = preflight.hasError
        ? preflight
        : await runtime.compiler.compile({
            mainFilePath: '/main.typ',
            format: 1,
            diagnostics: 'none',
            inputs: {}
        });
    const finishedAt = now();
    const rawDiagnostics = preflight?.diagnostics
        ?? result?.diagnostics
        ?? result?.messages
        ?? result?.errors;
    const diagnostics = Array.isArray(rawDiagnostics)
        && rawDiagnostics.length
        ? normalizeCompilerDiagnostics(
            rawDiagnostics,
            request.lineMap
        )
        : [];
    const pdfBytes = extractPdfBytes(result);
    const hasErrors = diagnostics.some(
        item => item.severity === 'error'
    );

    if (hasErrors || !pdfBytes?.byteLength) {
        const failureDiagnostics = diagnostics.length
            ? diagnostics
            : normalizeCompilerDiagnostics(null, request.lineMap);
        self.postMessage({
            type: WORKER_MESSAGE.failed,
            requestId: request.requestId,
            error: failureDiagnostics[0].display,
            diagnostics: failureDiagnostics,
            metrics: {
                runtimeVersion: RUNTIME_VERSION,
                ...runtime.cacheMetrics,
                initMs: Math.round(initializedAt - initStartedAt),
                compileMs: Math.round(finishedAt - initializedAt),
                pdfBytes: 0
            }
        });
        return;
    }

    const transferable = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
    );
    self.postMessage({
        type: WORKER_MESSAGE.compiled,
        requestId: request.requestId,
        pdfBytes: transferable,
        diagnostics,
        metrics: {
            runtimeVersion: RUNTIME_VERSION,
            ...runtime.cacheMetrics,
            initMs: Math.round(initializedAt - initStartedAt),
            compileMs: Math.round(finishedAt - initializedAt),
            pdfBytes: transferable.byteLength
        }
    }, [transferable]);
}

self.addEventListener('message', event => {
    compileDocument(event.data).catch(error => {
        const requestId = String(
            event.data?.requestId || 'h5-unknown'
        );
        const lineMap = Array.isArray(event.data?.lineMap)
            ? event.data.lineMap
            : [];
        const diagnostics = diagnosticFromError(error, lineMap);
        self.postMessage({
            type: WORKER_MESSAGE.failed,
            requestId,
            error: diagnostics[0].display,
            diagnostics,
            metrics: {
                runtimeVersion: RUNTIME_VERSION,
                cacheName: CACHE_NAME,
                initMs: 0,
                compileMs: 0,
                pdfBytes: 0
            }
        });
    });
});
