const REQUEST_ID_PATTERN = /^h5-[a-z0-9-]{1,96}$/i;
const ASSET_PATH_PATTERN = /^\/assets\/[a-z0-9][a-z0-9._/-]*$/i;
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const MAX_ASSET_COUNT = 512;
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 200 * 1024 * 1024;

const fromHere = relativePath => new URL(relativePath, import.meta.url).href;

const freezeAsset = value => Object.freeze({
    ...value,
    url: fromHere(value.source)
});

export const RUNTIME_VERSION =
    'h5-typst-0.7.0_mitex-0.2.7_fonts-20260729-v1';
export const CACHE_PREFIX = 'tex-handout-compiler-';
export const CACHE_NAME = `${CACHE_PREFIX}${RUNTIME_VERSION}`;

export const WORKER_MESSAGE = Object.freeze({
    compile: 'compile',
    compiled: 'compiled',
    failed: 'compile-failed',
    progress: 'progress'
});

export const RUNTIME_ASSETS = Object.freeze({
    compilerModule: freezeAsset({
        source: '../vendor/typst/0.7.0/typst-all-in-one-lite.mjs',
        role: 'compiler-module',
        kind: 'module',
        bytes: 211268
    }),
    compilerWasm: freezeAsset({
        source: '../vendor/typst/0.7.0/typst_ts_web_compiler_bg.wasm',
        role: 'compiler-wasm',
        kind: 'binary',
        bytes: 28325178
    }),
    fonts: Object.freeze([
        freezeAsset({
            source: '../vendor/typst/fonts/typst-assets-v0.13.1/NewCM10-Regular.otf',
            role: 'latin-text-font',
            kind: 'font',
            bytes: 586328
        }),
        freezeAsset({
            source: '../vendor/typst/fonts/typst-assets-v0.13.1/NewCMMath-Regular.otf',
            role: 'math-font',
            kind: 'font',
            bytes: 1150844
        }),
        freezeAsset({
            source: '../vendor/typst/fonts/noto-serif-cjk-sc-2.003/NotoSerifCJKsc-Regular.otf',
            role: 'simplified-chinese-font',
            kind: 'font',
            bytes: 24543080
        })
    ]),
    virtualFiles: Object.freeze([
        freezeAsset({
            source: '../vendor/mitex/0.2.7/lib.typ',
            target: '/mitex/lib.typ',
            role: 'mitex-entry',
            kind: 'source',
            bytes: 86
        }),
        freezeAsset({
            source: '../vendor/mitex/0.2.7/mitex.typ',
            target: '/mitex/mitex.typ',
            role: 'mitex-adapter',
            kind: 'source',
            bytes: 1016
        }),
        freezeAsset({
            source: '../vendor/mitex/0.2.7/specs/mod.typ',
            target: '/mitex/specs/mod.typ',
            role: 'mitex-spec',
            kind: 'source',
            bytes: 461
        }),
        freezeAsset({
            source: '../vendor/mitex/0.2.7/specs/prelude.typ',
            target: '/mitex/specs/prelude.typ',
            role: 'mitex-spec',
            kind: 'source',
            bytes: 7636
        }),
        freezeAsset({
            source: '../vendor/mitex/0.2.7/specs/latex/standard.typ',
            target: '/mitex/specs/latex/standard.typ',
            role: 'mitex-spec',
            kind: 'source',
            bytes: 42200
        }),
        freezeAsset({
            source: '../vendor/mitex/0.2.7/mitex.wasm',
            target: '/mitex/mitex.wasm',
            role: 'mitex-plugin',
            kind: 'binary',
            bytes: 280797
        })
    ])
});

const isPlainObject = value =>
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value);

export function assertSameOriginUrl(value, origin) {
    const parsed = new URL(value);
    if (parsed.origin !== origin) {
        const error = new Error(
            `compiler asset must be same-origin: ${parsed.pathname}`
        );
        error.code = 'HANDOUT_EXTERNAL_COMPILER_ASSET';
        throw error;
    }
    return parsed.href;
}

export function assertSafeAssetPath(value) {
    const path = String(value || '').trim().replaceAll('\\', '/');
    if (
        !ASSET_PATH_PATTERN.test(path)
        || path.includes('..')
        || path.includes('//')
    ) {
        const error = new TypeError(`invalid handout asset path: ${path}`);
        error.code = 'HANDOUT_ASSET_PATH_INVALID';
        throw error;
    }
    return path;
}

function validateLineMap(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError('compile request requires a non-empty line map');
    }

    return Object.freeze(value.map((entry, index) => {
        if (!isPlainObject(entry)) {
            throw new TypeError(`lineMap[${index}] must be an object`);
        }
        const blockId = String(entry.blockId || '').trim();
        const formulaId = entry.formulaId == null
            ? null
            : String(entry.formulaId).trim();
        const startLine = Number(entry.startLine);
        const endLine = Number(entry.endLine);
        if (
            !blockId
            || !Number.isInteger(startLine)
            || !Number.isInteger(endLine)
            || startLine < 1
            || endLine < startLine
        ) {
            throw new RangeError(`lineMap[${index}] has an invalid range`);
        }
        return Object.freeze({
            path: String(entry.path || '/main.typ'),
            blockId,
            formulaId: formulaId || null,
            startLine,
            endLine
        });
    }));
}

function toArrayBuffer(value, label) {
    if (value instanceof ArrayBuffer) return value;
    if (ArrayBuffer.isView(value)) {
        return value.buffer.slice(
            value.byteOffset,
            value.byteOffset + value.byteLength
        );
    }
    throw new TypeError(`${label} must contain binary bytes`);
}

function validateAssets(value) {
    const assets = value == null ? [] : value;
    if (!Array.isArray(assets)) {
        throw new TypeError('compile assets must be an array');
    }
    if (assets.length > MAX_ASSET_COUNT) {
        throw new RangeError(
            `compile assets exceed ${MAX_ASSET_COUNT} entries`
        );
    }

    const paths = new Set();
    let totalBytes = 0;
    const normalized = assets.map((asset, index) => {
        if (!isPlainObject(asset)) {
            throw new TypeError(`assets[${index}] must be an object`);
        }
        const path = assertSafeAssetPath(asset.path);
        if (paths.has(path)) {
            throw new Error(`duplicate compile asset path: ${path}`);
        }
        paths.add(path);
        const bytes = toArrayBuffer(asset.bytes, `assets[${index}]`);
        if (!bytes.byteLength || bytes.byteLength > MAX_ASSET_BYTES) {
            throw new RangeError(
                `asset ${path} must contain 1-${MAX_ASSET_BYTES} bytes`
            );
        }
        totalBytes += bytes.byteLength;
        return Object.freeze({
            path,
            mimeType: String(
                asset.mimeType || 'application/octet-stream'
            ),
            bytes
        });
    });

    if (totalBytes > MAX_TOTAL_ASSET_BYTES) {
        throw new RangeError(
            `compile assets exceed ${MAX_TOTAL_ASSET_BYTES} total bytes`
        );
    }
    return Object.freeze(normalized);
}

export function validateCompileRequest(value) {
    if (!isPlainObject(value) || value.type !== WORKER_MESSAGE.compile) {
        throw new TypeError('worker accepts compile messages only');
    }
    const requestId = String(value.requestId || '').trim();
    const source = String(value.source || '');
    const sourceBytes = new TextEncoder().encode(source).byteLength;
    if (!REQUEST_ID_PATTERN.test(requestId)) {
        throw new TypeError('compile request id is invalid');
    }
    if (!source.trim()) {
        throw new TypeError('compile source must not be empty');
    }
    if (sourceBytes > MAX_SOURCE_BYTES) {
        throw new RangeError(
            `compile source exceeds ${MAX_SOURCE_BYTES} bytes`
        );
    }
    return Object.freeze({
        type: WORKER_MESSAGE.compile,
        requestId,
        source,
        lineMap: validateLineMap(value.lineMap),
        assets: validateAssets(value.assets)
    });
}

export const H5_LIMITS = Object.freeze({
    maxSourceBytes: MAX_SOURCE_BYTES,
    maxAssetCount: MAX_ASSET_COUNT,
    maxAssetBytes: MAX_ASSET_BYTES,
    maxTotalAssetBytes: MAX_TOTAL_ASSET_BYTES
});
