const REQUEST_ID_PATTERN = /^h1-[a-z0-9-]{1,64}$/i;
const MAX_SOURCE_BYTES = 512 * 1024;

const fromHere = relativePath => new URL(relativePath, import.meta.url).href;

export const H1_ASSETS = Object.freeze({
    compilerModule: fromHere('../../vendor/typst/0.7.0/typst-all-in-one-lite.mjs'),
    compilerWasm: fromHere('../../vendor/typst/0.7.0/typst_ts_web_compiler_bg.wasm'),
    fonts: Object.freeze([
        fromHere('../../vendor/typst/fonts/typst-assets-v0.13.1/NewCM10-Regular.otf'),
        fromHere('../../vendor/typst/fonts/typst-assets-v0.13.1/NewCMMath-Regular.otf'),
        fromHere('../../vendor/typst/fonts/noto-serif-cjk-sc-2.003/NotoSerifCJKsc-Regular.otf')
    ]),
    virtualFiles: Object.freeze([
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/lib.typ'),
            target: '/mitex/lib.typ',
            kind: 'source'
        }),
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/mitex.typ'),
            target: '/mitex/mitex.typ',
            kind: 'source'
        }),
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/specs/mod.typ'),
            target: '/mitex/specs/mod.typ',
            kind: 'source'
        }),
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/specs/prelude.typ'),
            target: '/mitex/specs/prelude.typ',
            kind: 'source'
        }),
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/specs/latex/standard.typ'),
            target: '/mitex/specs/latex/standard.typ',
            kind: 'source'
        }),
        Object.freeze({
            source: fromHere('../../vendor/mitex/0.2.7/mitex.wasm'),
            target: '/mitex/mitex.wasm',
            kind: 'binary'
        }),
        Object.freeze({
            source: fromHere('./fixtures/coordinate-system.svg'),
            target: '/assets/coordinate-system.svg',
            kind: 'binary'
        })
    ])
});

export const WORKER_MESSAGE = Object.freeze({
    compile: 'compile',
    compiled: 'compiled',
    failed: 'compile-failed',
    progress: 'progress'
});

const isPlainObject = value =>
    Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value);

function validateLineMap(lineMap) {
    if (!Array.isArray(lineMap) || lineMap.length === 0) {
        throw new TypeError('compile request must include a non-empty lineMap');
    }

    return lineMap.map((entry, index) => {
        if (!isPlainObject(entry)) {
            throw new TypeError(`lineMap[${index}] must be an object`);
        }

        const blockId = String(entry.blockId || '').trim();
        const formulaId = entry.formulaId == null
            ? null
            : String(entry.formulaId).trim();
        const startLine = Number(entry.startLine);
        const endLine = Number(entry.endLine);

        if (!blockId || !Number.isInteger(startLine) || !Number.isInteger(endLine)) {
            throw new TypeError(`lineMap[${index}] is missing a block id or integer range`);
        }
        if (startLine < 1 || endLine < startLine) {
            throw new RangeError(`lineMap[${index}] has an invalid line range`);
        }

        return Object.freeze({
            path: String(entry.path || '/main.typ'),
            blockId,
            formulaId: formulaId || null,
            startLine,
            endLine
        });
    });
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
        throw new RangeError(`compile source exceeds ${MAX_SOURCE_BYTES} bytes`);
    }

    return Object.freeze({
        type: WORKER_MESSAGE.compile,
        requestId,
        source,
        lineMap: Object.freeze(validateLineMap(value.lineMap))
    });
}

export function assertSameOriginAsset(assetUrl, origin) {
    const parsed = new URL(assetUrl);
    if (parsed.origin !== origin) {
        throw new Error(`H1 asset must be same-origin: ${parsed.pathname}`);
    }
    return parsed.href;
}

export const H1_LIMITS = Object.freeze({
    maxSourceBytes: MAX_SOURCE_BYTES
});
