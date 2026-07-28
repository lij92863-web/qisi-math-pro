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

const normalizePath = value => {
    const path = String(value || '/main.typ').replaceAll('\\', '/');
    return path.startsWith('/') ? path : `/${path}`;
};

const findContext = (diagnostic, lineMap) => {
    const path = normalizePath(diagnostic?.path);
    const line = parseLineNumber(diagnostic?.range);
    if (!line) return null;

    return lineMap.find(entry =>
        normalizePath(entry.path) === path
        && entry.startLine <= line
        && line <= entry.endLine
    ) || null;
};

const safeMessage = value => {
    const text = String(value || 'Typst 编译失败').replace(/\s+/g, ' ').trim();
    return text.slice(0, 600);
};

export function normalizeCompilerDiagnostics(diagnostics, lineMap) {
    const entries = Array.isArray(diagnostics) && diagnostics.length
        ? diagnostics
        : [{
            path: '/main.typ',
            severity: 'error',
            range: '',
            message: 'Typst 未生成 PDF，也未返回详细诊断。'
        }];

    return entries.map((entry, index) => {
        const context = findContext(entry, lineMap);
        const path = normalizePath(entry?.path);
        const line = parseLineNumber(entry?.range);
        const blockId = context?.blockId || 'document';
        const formulaId = context?.formulaId || null;
        const location = line ? `${path}:${line}` : path;
        const prefix = formulaId
            ? `公式 ${formulaId}（内容块 ${blockId}）`
            : `内容块 ${blockId}`;
        const message = safeMessage(entry?.message);

        return Object.freeze({
            id: `diagnostic-${index + 1}`,
            severity: String(entry?.severity || 'error').toLowerCase(),
            path,
            line,
            blockId,
            formulaId,
            message,
            display: `${prefix}：${message} [${location}]`
        });
    });
}
