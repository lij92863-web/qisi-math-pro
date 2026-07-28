import {
    H1_ASSETS,
    WORKER_MESSAGE,
    assertSameOriginAsset,
    validateCompileRequest
} from './runtime-contract.mjs';
import { normalizeCompilerDiagnostics } from './diagnostics.mjs';

let runtimePromise = null;

const now = () => performance.now();

const toUint8Array = value => {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
};

function installTypstWorkerCompatibility() {
    if ('window' in self) return;
    Object.defineProperty(self, 'window', {
        value: self,
        configurable: false,
        enumerable: false,
        writable: false
    });
}

const reportProgress = (requestId, phase, detail) => {
    self.postMessage({
        type: WORKER_MESSAGE.progress,
        requestId,
        phase,
        detail
    });
};

async function fetchAsset(url, responseType) {
    const safeUrl = assertSameOriginAsset(url, self.location.origin);
    const response = await fetch(safeUrl, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`本地资源加载失败：${new URL(safeUrl).pathname} (${response.status})`);
    }
    return responseType === 'text'
        ? response.text()
        : new Uint8Array(await response.arrayBuffer());
}

async function initializeRuntime(requestId) {
    reportProgress(requestId, 'runtime', '正在加载本地 Typst WASM 与固定字体');
    installTypstWorkerCompatibility();
    const typst = await import(assertSameOriginAsset(
        H1_ASSETS.compilerModule,
        self.location.origin
    ));
    const compiler = typst.createTypstCompiler();

    await compiler.init({
        getModule: () => assertSameOriginAsset(
            H1_ASSETS.compilerWasm,
            self.location.origin
        ),
        beforeBuild: [
            typst.loadFonts(
                H1_ASSETS.fonts.map(url => assertSameOriginAsset(url, self.location.origin)),
                { assets: false }
            )
        ]
    });

    reportProgress(requestId, 'virtual-files', '正在挂载本地 MiTeX 与图片夹具');
    const files = await Promise.all(H1_ASSETS.virtualFiles.map(async file => ({
        ...file,
        content: await fetchAsset(file.source, file.kind === 'source' ? 'text' : 'binary')
    })));

    for (const file of files) {
        if (file.kind === 'source') {
            compiler.addSource(file.target, file.content);
        } else {
            compiler.mapShadow(file.target, file.content);
        }
    }

    return Object.freeze({ compiler });
}

const getRuntime = requestId => {
    if (!runtimePromise) {
        runtimePromise = initializeRuntime(requestId).catch(error => {
            runtimePromise = null;
            throw error;
        });
    }
    return runtimePromise;
};

async function compileDocument(message) {
    const request = validateCompileRequest(message);
    const initStartedAt = now();
    const runtime = await getRuntime(request.requestId);
    const initializedAt = now();

    reportProgress(request.requestId, 'compile', '正在 Worker 中编译 PDF');
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
    const compilerDiagnostics = preflight?.diagnostics
        ?? result?.diagnostics
        ?? result?.messages
        ?? result?.errors;
    const diagnostics = Array.isArray(compilerDiagnostics) && compilerDiagnostics.length
        ? normalizeCompilerDiagnostics(compilerDiagnostics, request.lineMap)
        : [];
    const hasErrors = diagnostics.some(item => item.severity === 'error');
    const rawPdf = result instanceof Uint8Array
        ? result
        : result?.result ?? result?.artifact ?? result?.output;
    const pdfBytes = toUint8Array(rawPdf);

    if (hasErrors || !pdfBytes || pdfBytes.byteLength === 0) {
        const resultKeys = result && typeof result === 'object'
            ? Object.keys(result).join(', ') || 'none'
            : typeof result;
        const resultType = rawPdf?.constructor?.name || typeof rawPdf;
        const failureDiagnostics = diagnostics.length
            ? diagnostics
            : normalizeCompilerDiagnostics(null, request.lineMap);
        self.postMessage({
            type: WORKER_MESSAGE.failed,
            requestId: request.requestId,
            error: compilerDiagnostics?.length
                ? diagnostics[0]?.display
                : `Typst 未生成 PDF（编译器返回字段：${resultKeys}；结果类型：${resultType}；字节：${pdfBytes?.byteLength || 0}）。`,
            diagnostics: failureDiagnostics,
            metrics: {
                initMs: Math.round(initializedAt - initStartedAt),
                compileMs: Math.round(finishedAt - initializedAt)
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
            initMs: Math.round(initializedAt - initStartedAt),
            compileMs: Math.round(finishedAt - initializedAt),
            pdfBytes: transferable.byteLength
        }
    }, [transferable]);
}

self.addEventListener('message', event => {
    compileDocument(event.data).catch(error => {
        const requestId = String(event.data?.requestId || 'h1-unknown');
        const diagnostics = normalizeCompilerDiagnostics(
            error?.diagnostics,
            Array.isArray(event.data?.lineMap) ? event.data.lineMap : []
        );
        self.postMessage({
            type: WORKER_MESSAGE.failed,
            requestId,
            error: String(error?.message || error),
            diagnostics
        });
    });
});
