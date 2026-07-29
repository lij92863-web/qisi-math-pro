const normalizePath = value => {
    const path = String(value || '/main.typ').replaceAll('\\', '/');
    return path.startsWith('/') ? path : `/${path}`;
};

const parseLineNumber = range => {
    if (typeof range === 'string') {
        const match = range.match(/^(\d+):/);
        return match ? Number(match[1]) : null;
    }
    if (range && Number.isInteger(range.start?.line)) {
        return range.start.line + 1;
    }
    return null;
};

const safeMessage = value => String(
    value || 'Typst did not return a PDF or detailed diagnostics.'
)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);

const findContext = (diagnostic, lineMap) => {
    const path = normalizePath(diagnostic?.path);
    const line = parseLineNumber(diagnostic?.range);
    if (!line) return null;
    const matches = lineMap.filter(entry =>
        normalizePath(entry.path) === path
        && entry.startLine <= line
        && line <= entry.endLine
    );
    return matches.find(entry => entry.formulaId)
        || matches[0]
        || null;
};

export function normalizeCompilerDiagnostics(
    diagnostics,
    lineMap,
    {
        fallbackCode = 'HANDOUT_TYPST_COMPILE_FAILED'
    } = {}
) {
    const entries = Array.isArray(diagnostics) && diagnostics.length
        ? diagnostics
        : [{
            path: '/main.typ',
            severity: 'error',
            range: '',
            code: fallbackCode,
            message: 'Typst did not return a PDF.'
        }];

    return entries.map((entry, index) => {
        const context = findContext(entry, lineMap);
        const path = normalizePath(entry?.path);
        const line = parseLineNumber(entry?.range);
        const blockId = context?.blockId || 'document';
        const formulaId = context?.formulaId || null;
        const message = safeMessage(entry?.message);
        const location = line ? `${path}:${line}` : path;
        const subject = formulaId
            ? `Formula ${formulaId} in block ${blockId}`
            : `Block ${blockId}`;

        return Object.freeze({
            id: `diagnostic-${index + 1}`,
            code: String(entry?.code || fallbackCode),
            severity: String(entry?.severity || 'error').toLowerCase(),
            path,
            line,
            blockId,
            formulaId,
            message,
            display: `${subject}: ${message} [${location}]`
        });
    });
}

export function diagnosticFromError(error, lineMap) {
    return normalizeCompilerDiagnostics([{
        path: '/main.typ',
        severity: 'error',
        range: '',
        code: error?.code || 'HANDOUT_COMPILER_RUNTIME_FAILED',
        message: error?.message || error
    }], lineMap, {
        fallbackCode: error?.code || 'HANDOUT_COMPILER_RUNTIME_FAILED'
    });
}
