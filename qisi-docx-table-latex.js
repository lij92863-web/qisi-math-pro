(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxTableLatex = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULT_PAGE_WIDTH_TWIPS = 11906;
    const DEFAULT_MARGIN_TWIPS = 1800;
    const TABLE_WIDTH_PADDING_FACTOR = 0.94;

    const decodeXmlEntities = (value = '') => String(value || '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

    const stableHash = (value = '') => {
        let hash = 2166136261;
        const source = String(value || '');
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    };

    const readWordVal = (xml = '', tag = '') => String(xml || '').match(
        new RegExp(`<w:${tag}\\b[^>]*w:val=["']([^"']+)["']`, 'i')
    )?.[1] || '';

    const extractTopLevelWordBlocks = (xml = '') => {
        const source = String(xml || '');
        const body = source.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i)?.[1] || source;
        const blocks = [];
        const stack = [];
        const tagPattern = /<(\/?)w:(p|tbl)\b[^>]*>/gi;
        let blockStart = -1;
        let blockKind = '';
        let match;

        while ((match = tagPattern.exec(body)) !== null) {
            const closing = Boolean(match[1]);
            const tag = match[2].toLowerCase();
            const selfClosing = !closing && /\/>$/.test(match[0]);

            if (!closing) {
                if (!stack.length) {
                    blockStart = match.index;
                    blockKind = tag === 'tbl' ? 'table' : 'paragraph';
                }
                if (!selfClosing) {
                    stack.push(tag);
                } else if (!stack.length && blockStart >= 0) {
                    blocks.push({ kind: blockKind, xml: body.slice(blockStart, tagPattern.lastIndex) });
                    blockStart = -1;
                    blockKind = '';
                }
                continue;
            }

            if (stack[stack.length - 1] !== tag) continue;
            stack.pop();
            if (!stack.length && blockStart >= 0) {
                blocks.push({ kind: blockKind, xml: body.slice(blockStart, tagPattern.lastIndex) });
                blockStart = -1;
                blockKind = '';
            }
        }

        return blocks;
    };

    const extractDirectElements = (xml = '', tag = '') => {
        const source = String(xml || '');
        const pattern = new RegExp(`<(\\/?)w:${tag}\\b[^>]*>`, 'gi');
        const elements = [];
        let depth = 0;
        let start = -1;
        let match;

        while ((match = pattern.exec(source)) !== null) {
            const closing = Boolean(match[1]);
            const selfClosing = !closing && /\/>$/.test(match[0]);
            if (!closing) {
                if (depth === 0) start = match.index;
                if (!selfClosing) depth += 1;
                else if (depth === 0 && start >= 0) {
                    elements.push(source.slice(start, pattern.lastIndex));
                    start = -1;
                }
                continue;
            }
            if (depth <= 0) continue;
            depth -= 1;
            if (depth === 0 && start >= 0) {
                elements.push(source.slice(start, pattern.lastIndex));
                start = -1;
            }
        }

        return elements;
    };

    const extractWordText = (xml = '') => {
        const paragraphs = extractDirectElements(xml, 'p');
        const sources = paragraphs.length ? paragraphs : [String(xml || '')];
        return sources.map(paragraph => [...paragraph.matchAll(
            /<(?:w:t|m:t)\b[^>]*>([\s\S]*?)<\/(?:w:t|m:t)>/gi
        )].map(match => decodeXmlEntities(match[1])).join('')).join('\n').trim();
    };

    const resolveUsableWidthTwips = (documentXml = '') => {
        const source = String(documentXml || '');
        const pageWidth = Number(source.match(/<w:pgSz\b[^>]*w:w=["'](\d+)["']/i)?.[1]) || DEFAULT_PAGE_WIDTH_TWIPS;
        const marginTag = source.match(/<w:pgMar\b[^>]*>/i)?.[0] || '';
        const left = Number(marginTag.match(/w:left=["'](\d+)["']/i)?.[1]) || DEFAULT_MARGIN_TWIPS;
        const right = Number(marginTag.match(/w:right=["'](\d+)["']/i)?.[1]) || DEFAULT_MARGIN_TWIPS;
        return Math.max(1, pageWidth - left - right);
    };

    const normalizeWidths = (values = [], columnCount = 1) => {
        const widths = Array.from({ length: Math.max(1, columnCount) }, (_, index) => {
            const value = Number(values[index]);
            return Number.isFinite(value) && value > 0 ? value : 1;
        });
        const total = widths.reduce((sum, value) => sum + value, 0) || widths.length;
        return widths.map(value => value / total);
    };

    const parseAlignment = (cellXml = '') => {
        const values = [...String(cellXml || '').matchAll(/<w:jc\b[^>]*w:val=["']([^"']+)["']/gi)]
            .map(match => String(match[1] || '').toLowerCase());
        const value = values.find(item => ['center', 'right', 'left', 'both', 'distribute'].includes(item)) || 'left';
        if (value === 'center') return 'center';
        if (value === 'right') return 'right';
        return 'left';
    };

    const parseVerticalAlignment = (cellXml = '') => {
        const value = readWordVal(cellXml, 'vAlign').toLowerCase();
        if (value === 'center') return 'middle';
        if (value === 'bottom') return 'bottom';
        return 'top';
    };

    const defaultSerializeCell = (cellXml = '') => ({
        previewContent: extractWordText(cellXml),
        assets: [],
        diagnostics: []
    });

    const parseWordTable = (tableXml = '', options = {}) => {
        const grid = [...String(tableXml || '').matchAll(
            /<w:gridCol\b[^>]*w:w=["'](\d+)["'][^>]*\/?\s*>/gi
        )].map(match => Number(match[1]));
        const serializeCell = typeof options.serializeCell === 'function'
            ? options.serializeCell
            : defaultSerializeCell;
        const rows = extractDirectElements(tableXml, 'tr').map((rowXml, rowIndex) => {
            let column = 0;
            return extractDirectElements(rowXml, 'tc').map((cellXml, cellIndex) => {
                const properties = cellXml.match(/<w:tcPr\b[\s\S]*?<\/w:tcPr>/i)?.[0] || '';
                const colSpan = Math.max(1, Number(readWordVal(properties, 'gridSpan')) || 1);
                const mergeTag = properties.match(/<w:vMerge\b[^>]*\/?\s*>/i)?.[0] || '';
                const mergeValue = mergeTag.match(/w:val=["']([^"']+)["']/i)?.[1] || '';
                const vMerge = !mergeTag ? '' : mergeValue.toLowerCase() === 'restart' ? 'restart' : 'continue';
                const serialized = serializeCell(cellXml, { rowIndex, cellIndex, column, colSpan }) || {};
                const cell = {
                    row: rowIndex,
                    column,
                    colSpan,
                    rowSpan: 1,
                    vMerge,
                    continuation: false,
                    align: parseAlignment(cellXml),
                    verticalAlign: parseVerticalAlignment(cellXml),
                    previewContent: String(serialized.previewContent ?? serialized.content ?? ''),
                    latexContent: String(serialized.latexContent || ''),
                    assets: Array.isArray(serialized.assets) ? serialized.assets : [],
                    diagnostics: Array.isArray(serialized.diagnostics) ? serialized.diagnostics : [],
                    sourceXmlHash: stableHash(cellXml)
                };
                column += colSpan;
                return cell;
            });
        });

        const columnCount = Math.max(
            grid.length,
            ...rows.flatMap(row => row.map(cell => cell.column + cell.colSpan)),
            1
        );
        const columnWidths = normalizeWidths(grid, columnCount);

        rows.forEach((row, rowIndex) => {
            row.forEach(cell => {
                if (cell.vMerge !== 'restart') return;
                for (let nextIndex = rowIndex + 1; nextIndex < rows.length; nextIndex += 1) {
                    const continuation = rows[nextIndex].find(candidate => (
                        candidate.column === cell.column &&
                        candidate.colSpan === cell.colSpan &&
                        candidate.vMerge === 'continue'
                    ));
                    if (!continuation) break;
                    continuation.continuation = true;
                    cell.rowSpan += 1;
                }
            });
        });

        const claimedContinuations = new Set(rows.flatMap(row => row.filter(cell => cell.continuation)));
        rows.flatMap(row => row).forEach(cell => {
            if (cell.vMerge === 'continue' && !claimedContinuations.has(cell)) cell.vMerge = '';
        });

        const gridTotal = grid.reduce((sum, value) => sum + value, 0) || columnCount;
        const usableWidth = Math.max(1, Number(options.usableWidthTwips) || gridTotal);
        const widthRatio = Math.min(1, Math.max(0.2, gridTotal / usableWidth));

        return {
            columnCount,
            columnWidths,
            widthRatio,
            rows,
            assets: rows.flatMap(row => row.flatMap(cell => cell.assets)),
            diagnostics: rows.flatMap(row => row.flatMap(cell => cell.diagnostics)),
            sourceXmlHash: stableHash(tableXml)
        };
    };

    const escapeLatexText = (value = '') => String(value || '')
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/([%&#_{}])/g, '\\$1')
        .replace(/\^/g, '\\textasciicircum{}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\n/g, '\\newline ');

    const toLatexCellContent = (value = '') => {
        const source = String(value || '').trim();
        if (!source) return '';
        if (/% QISI_TABLE_BEGIN [0-9a-f]{8} /i.test(source)) return source;
        const parts = source.split(/(\$[^$]*\$)/g);
        return parts.map((part, index) => index % 2 === 1 ? part : escapeLatexText(part)).join('');
    };

    const encodeBase64Utf8 = (value = '') => {
        const source = String(value || '');
        if (typeof Buffer !== 'undefined') return Buffer.from(source, 'utf8').toString('base64');
        const bytes = new TextEncoder().encode(source);
        let binary = '';
        for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        return globalThis.btoa(binary);
    };

    const decodeBase64Utf8 = (value = '') => {
        if (typeof Buffer !== 'undefined') return Buffer.from(String(value || ''), 'base64').toString('utf8');
        const binary = globalThis.atob(String(value || ''));
        return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    };

    const compactModelForMetadata = model => ({
        columnCount: model.columnCount,
        columnWidths: model.columnWidths,
        widthRatio: model.widthRatio,
        rows: model.rows.map(row => row.map(cell => ({
            column: cell.column,
            colSpan: cell.colSpan,
            rowSpan: cell.rowSpan,
            continuation: cell.continuation,
            align: cell.align,
            verticalAlign: cell.verticalAlign,
            previewContent: cell.previewContent
        })))
    });

    const latexColumnWidth = (model, start, span) => model.columnWidths
        .slice(start, start + span)
        .reduce((sum, value) => sum + value, 0) * TABLE_WIDTH_PADDING_FACTOR;

    const alignedLatexContent = (cell, content) => {
        if (!content) return '';
        if (cell.align === 'center') return `{\\centering ${content}\\par}`;
        if (cell.align === 'right') return `{\\raggedleft ${content}\\par}`;
        return `{\\raggedright ${content}\\par}`;
    };

    const serializeCellLatex = (model, cell) => {
        if (cell.continuation) return '';
        let content = cell.latexContent || toLatexCellContent(cell.previewContent);
        content = alignedLatexContent(cell, content);
        if (cell.rowSpan > 1) content = `\\multirow{${cell.rowSpan}}{*}{${content}}`;
        if (cell.colSpan > 1) {
            const width = latexColumnWidth(model, cell.column, cell.colSpan).toFixed(4);
            content = `\\multicolumn{${cell.colSpan}}{|>{\\raggedright\\arraybackslash}p{${width}\\linewidth}|}{${content}}`;
        }
        return content;
    };

    const rowEntries = (model, row) => {
        const byColumn = new Map(row.map(cell => [cell.column, cell]));
        const entries = [];
        let column = 0;
        while (column < model.columnCount) {
            const cell = byColumn.get(column);
            if (!cell) {
                entries.push('');
                column += 1;
                continue;
            }
            entries.push(serializeCellLatex(model, cell));
            column += cell.colSpan;
        }
        return entries;
    };

    const horizontalRuleAfter = (model, rowIndex) => {
        if (rowIndex >= model.rows.length - 1) return '\\hline';
        const nextRow = model.rows[rowIndex + 1];
        const blocked = new Set();
        nextRow.filter(cell => cell.continuation).forEach(cell => {
            for (let column = cell.column; column < cell.column + cell.colSpan; column += 1) blocked.add(column);
        });
        if (!blocked.size) return '\\hline';
        const ranges = [];
        let start = null;
        for (let column = 0; column < model.columnCount; column += 1) {
            if (!blocked.has(column) && start === null) start = column;
            const ends = start !== null && (blocked.has(column) || column === model.columnCount - 1);
            if (!ends) continue;
            const end = blocked.has(column) ? column - 1 : column;
            ranges.push([start + 1, end + 1]);
            start = null;
        }
        return ranges.map(([from, to]) => `\\cline{${from}-${to}}`).join('');
    };

    const serializeTableModelToLatex = model => {
        const metadata = compactModelForMetadata(model);
        const encoded = encodeBase64Utf8(JSON.stringify(metadata));
        const id = stableHash(encoded);
        const columns = model.columnWidths.map(width => (
            `>{\\raggedright\\arraybackslash}p{${(width * TABLE_WIDTH_PADDING_FACTOR).toFixed(4)}\\linewidth}`
        )).join('|');
        const rows = model.rows.map((row, rowIndex) => (
            `${rowEntries(model, row).join(' & ')} \\\\\n${horizontalRuleAfter(model, rowIndex)}`
        )).join('\n');

        return [
            `% QISI_TABLE_BEGIN ${id} ${encoded}`,
            '\\begin{center}',
            `\\begin{minipage}{${model.widthRatio.toFixed(4)}\\linewidth}`,
            '\\centering',
            `\\begin{tabular}{|${columns}|}`,
            '\\hline',
            rows,
            '\\end{tabular}',
            '\\end{minipage}',
            '\\end{center}',
            `% QISI_TABLE_END ${id}`
        ].join('\n');
    };

    const convertWordTableToLatex = (tableXml = '', options = {}) => {
        const model = parseWordTable(tableXml, options);
        return {
            model,
            latex: serializeTableModelToLatex(model),
            assets: model.assets,
            diagnostics: model.diagnostics
        };
    };

    const tableBlockPattern = () => /% QISI_TABLE_BEGIN ([0-9a-f]{8}) ([A-Za-z0-9+/=$\u200b\u2060]+)\r?\n[\s\S]*?% QISI_TABLE_END \1/g;

    const extractTableModelFromLatex = (latex = '') => {
        const match = String(latex || '').match(/% QISI_TABLE_BEGIN ([0-9a-f]{8}) ([A-Za-z0-9+/=$\u200b\u2060]+)/);
        if (!match) return null;
        try {
            const encoded = match[2].replace(/[$\u200b\u2060]/g, '');
            if (stableHash(encoded) !== match[1]) return null;
            return JSON.parse(decodeBase64Utf8(encoded));
        } catch (error) {
            return null;
        }
    };

    const escapeHtml = (value = '') => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const renderLatexTableHtml = (latex = '', options = {}) => {
        const model = extractTableModelFromLatex(latex);
        if (!model) return `<span class="latex-render-error">${escapeHtml(latex)}</span>`;
        const renderCell = typeof options.renderCell === 'function'
            ? options.renderCell
            : value => escapeHtml(value);
        const columns = model.columnWidths.map(width => (
            `<col style="width:${(Number(width) * 100).toFixed(3)}%">`
        )).join('');
        const rows = model.rows.map(row => {
            const cells = row.filter(cell => !cell.continuation).map(cell => {
                const colspan = Number(cell.colSpan) > 1 ? ` colspan="${Number(cell.colSpan)}"` : '';
                const rowspan = Number(cell.rowSpan) > 1 ? ` rowspan="${Number(cell.rowSpan)}"` : '';
                const style = `text-align:${escapeHtml(cell.align || 'left')};vertical-align:${escapeHtml(cell.verticalAlign || 'top')}`;
                return `<td${colspan}${rowspan} style="${style}">${renderCell(String(cell.previewContent || ''))}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return (
            `<span class="qisi-latex-table-wrap" style="width:${(Number(model.widthRatio || 1) * 100).toFixed(3)}%">` +
            `<table class="qisi-latex-table"><colgroup>${columns}</colgroup><tbody>${rows}</tbody></table>` +
            '</span>'
        );
    };

    const replaceLatexTableBlocks = (value = '', renderer = null) => String(value || '').replace(
        tableBlockPattern(),
        block => typeof renderer === 'function' ? renderer(block) : block
    );

    const splitLatexTableBlocks = (value = '') => {
        const source = String(value || '');
        const parts = [];
        const pattern = tableBlockPattern();
        let cursor = 0;
        let match;

        while ((match = pattern.exec(source)) !== null) {
            if (match.index > cursor) {
                parts.push({ kind: 'text', value: source.slice(cursor, match.index) });
            }
            parts.push({ kind: 'table', value: match[0], id: match[1] });
            cursor = match.index + match[0].length;
        }

        if (cursor < source.length || !parts.length) {
            parts.push({ kind: 'text', value: source.slice(cursor) });
        }
        return parts;
    };

    return {
        convertWordTableToLatex,
        extractDirectElements,
        extractTableModelFromLatex,
        extractTopLevelWordBlocks,
        extractWordText,
        parseWordTable,
        renderLatexTableHtml,
        replaceLatexTableBlocks,
        splitLatexTableBlocks,
        resolveUsableWidthTwips,
        serializeTableModelToLatex,
        toLatexCellContent
    };
});
