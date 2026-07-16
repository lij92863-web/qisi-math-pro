(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxLayout = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const VERSION = 'docx-layout-r1';
    const TWIP_TO_EMU = 635;

    const stableHash = (value = '') => {
        let hash = 2166136261;
        const source = String(value || '');
        for (let index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
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
        const encoded = String(value || '');
        if (typeof Buffer !== 'undefined') return Buffer.from(encoded, 'base64').toString('utf8');
        const binary = globalThis.atob(encoded);
        return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
    };

    const escapeHtml = (value = '') => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    const runDimensions = (run, assetsById) => {
        const asset = assetsById.get(String(run?.assetId || '')) || {};
        return run?.layout?.dimensions || asset.dimensions || {};
    };

    const sourceWidthRatio = (run, assetsById, usableWidthTwips) => {
        const cx = Number(runDimensions(run, assetsById)?.cx);
        const usableEmu = Math.max(1, Number(usableWidthTwips) || 8300) * TWIP_TO_EMU;
        if (!Number.isFinite(cx) || cx <= 0) return 0.46;
        return clamp(cx / usableEmu, 0.16, 0.72);
    };

    const imageId = run => String(run?.assetId || run?.id || '').trim();
    const isWhitespaceRun = run => (
        run?.kind === 'tab' ||
        run?.kind === 'break' ||
        (run?.kind === 'text' && !String(run.text || '').trim())
    );

    const plainRunContent = (runs, serializeRuns) => String(serializeRuns(runs || []) || '').trim();
    const beginsQuestionOrOption = value => /^\s*(?:\d{1,3}|[A-D])\s*[.．、:：]/.test(String(value || ''));

    const normalizeImageRowWidths = items => {
        const total = items.reduce((sum, item) => sum + Number(item.widthRatio || 0), 0) || 1;
        const maximumTotal = 0.98;
        const scale = total > maximumTotal ? maximumTotal / total : 1;
        return items.map(item => ({
            ...item,
            widthRatio: Number(clamp(Number(item.widthRatio || 0.46) * scale, 0.16, 0.49).toFixed(4))
        }));
    };

    const layoutLatex = model => {
        if (model.type === 'image-row') {
            const cells = model.items.map(item => [
                `\\begin{minipage}[c]{${Number(item.widthRatio).toFixed(4)}\\linewidth}`,
                '\\centering',
                `\\includegraphics[width=\\linewidth,height=48mm,keepaspectratio]{${item.id}}`,
                '\\end{minipage}'
            ].join('\n')).join('\\hfill\n');
            return ['\\begin{center}', cells, '\\end{center}'].join('\n');
        }

        const imageWidth = Number(model.image.widthRatio || 0.42);
        const copyWidth = clamp(0.96 - imageWidth, 0.28, 0.68);
        return [
            model.beforeContent || '',
            '\\begin{center}',
            `\\begin{minipage}[c]{${imageWidth.toFixed(4)}\\linewidth}`,
            '\\centering',
            `\\includegraphics[width=\\linewidth,height=48mm,keepaspectratio]{${model.image.id}}`,
            '\\end{minipage}\\hfill',
            `\\begin{minipage}[c]{${copyWidth.toFixed(4)}\\linewidth}`,
            model.afterContent || '',
            '\\end{minipage}',
            '\\end{center}'
        ].filter(Boolean).join('\n');
    };

    const serializeLayoutModel = model => {
        const normalized = { version: VERSION, ...model };
        const encoded = encodeBase64Utf8(JSON.stringify(normalized));
        const id = stableHash(encoded);
        return [
            `% QISI_LAYOUT_BEGIN ${id} ${encoded}`,
            layoutLatex(normalized),
            `% QISI_LAYOUT_END ${id}`
        ].join('\n');
    };

    const serializeParagraphLayout = ({
        runs = [],
        assets = [],
        usableWidthTwips = 8300,
        serializeRuns = sourceRuns => (sourceRuns || []).map(run => run?.token || run?.text || '').join('')
    } = {}) => {
        const sourceRuns = Array.isArray(runs) ? runs : [];
        const images = sourceRuns.filter(run => run?.kind === 'image' && imageId(run));
        const fallback = plainRunContent(sourceRuns, serializeRuns);
        if (!images.length || beginsQuestionOrOption(fallback)) return fallback;

        const assetsById = new Map((assets || []).map(asset => [String(asset?.assetId || ''), asset]));
        const substantiveNonImages = sourceRuns.filter(run => run?.kind !== 'image' && !isWhitespaceRun(run));

        if (images.length >= 2 && !substantiveNonImages.length) {
            const items = normalizeImageRowWidths(images.map(run => ({
                id: imageId(run),
                widthRatio: sourceWidthRatio(run, assetsById, usableWidthTwips),
                dimensions: runDimensions(run, assetsById)
            })));
            return serializeLayoutModel({ type: 'image-row', items });
        }

        if (images.length !== 1) return fallback;
        const imageIndex = sourceRuns.indexOf(images[0]);
        const beforeRuns = sourceRuns.slice(0, imageIndex);
        const afterRuns = sourceRuns.slice(imageIndex + 1);
        const beforeContent = plainRunContent(beforeRuns, serializeRuns);
        const afterContent = plainRunContent(afterRuns, serializeRuns);
        if (!afterContent) return fallback;

        const widthRatio = sourceWidthRatio(images[0], assetsById, usableWidthTwips);
        return serializeLayoutModel({
            type: 'media-text',
            beforeContent,
            image: {
                id: imageId(images[0]),
                widthRatio: Number(clamp(widthRatio, 0.26, 0.58).toFixed(4)),
                dimensions: runDimensions(images[0], assetsById)
            },
            afterContent
        });
    };

    const layoutBlockPattern = () => /% QISI_LAYOUT_BEGIN ([0-9a-f]{8}) ([A-Za-z0-9+/=$\u200b\u2060]+)\r?\n[\s\S]*?% QISI_LAYOUT_END \1/g;

    const extractLayoutModel = (source = '') => {
        const match = String(source || '').match(/% QISI_LAYOUT_BEGIN ([0-9a-f]{8}) ([A-Za-z0-9+/=$\u200b\u2060]+)/);
        if (!match) return null;
        try {
            const encoded = match[2].replace(/[$\u200b\u2060]/g, '');
            if (stableHash(encoded) !== match[1]) return null;
            const model = JSON.parse(decodeBase64Utf8(encoded));
            if (model?.version !== VERSION || !['image-row', 'media-text'].includes(model?.type)) return null;
            return model;
        } catch (error) {
            return null;
        }
    };

    const renderLayoutHtml = (source = '', options = {}) => {
        const model = extractLayoutModel(source);
        if (!model) return `<span class="latex-render-error">${escapeHtml(source)}</span>`;
        const renderImage = typeof options.renderImage === 'function'
            ? options.renderImage
            : item => `<span class="latex-image-placeholder">[图片:${escapeHtml(item.id)}]</span>`;
        const renderContent = typeof options.renderContent === 'function'
            ? options.renderContent
            : value => escapeHtml(value);

        if (model.type === 'image-row') {
            const items = model.items.map(item => (
                `<span class="qisi-image-row-item" style="--qisi-source-width:${Number(item.widthRatio || 0.46)}">` +
                renderImage(item) +
                '</span>'
            )).join('');
            return `<span class="qisi-image-row" style="--qisi-image-count:${model.items.length}">${items}</span>`;
        }

        const before = model.beforeContent
            ? `<span class="qisi-media-before">${renderContent(model.beforeContent)}</span>`
            : '';
        return before + (
            `<span class="qisi-media-text" style="--qisi-media-width:${Number(model.image.widthRatio || 0.42)}">` +
                `<span class="qisi-media-figure">${renderImage(model.image)}</span>` +
                `<span class="qisi-media-copy">${renderContent(model.afterContent || '')}</span>` +
            '</span>'
        );
    };

    const replaceLayoutBlocks = (value = '', renderer = null) => String(value || '').replace(
        layoutBlockPattern(),
        block => typeof renderer === 'function' ? renderer(block) : block
    );

    const splitLayoutBlocks = (value = '') => {
        const source = String(value || '');
        const parts = [];
        const pattern = layoutBlockPattern();
        let cursor = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            if (match.index > cursor) parts.push({ kind: 'text', value: source.slice(cursor, match.index) });
            parts.push({ kind: 'layout', value: match[0], id: match[1] });
            cursor = match.index + match[0].length;
        }
        if (cursor < source.length || !parts.length) parts.push({ kind: 'text', value: source.slice(cursor) });
        return parts;
    };

    const optionLabelsInBlock = (value = '') => {
        const source = String(value || '');
        const labels = [];
        const marker = /(?:^|[\t\n\s])([A-D])\s*(?:[.．、:：]|锛(?:庡嶽)?)/g;
        let match;
        while ((match = marker.exec(source)) !== null) labels.push(match[1]);
        if (labels.length) return [...new Set(labels)];
        const imageMarker = /(?:^|[\t\n\s])([A-D])[\s\S]{0,8}?\[\[IMAGE:/g;
        while ((match = imageMarker.exec(source)) !== null) labels.push(match[1]);
        return [...new Set(labels)];
    };

    const extractOptionRows = (richBlocks = []) => (richBlocks || [])
        .map(block => optionLabelsInBlock(block?.serialized || ''))
        .filter(labels => labels.length > 1);

    const visualUnits = (value = '') => {
        const source = String(value || '');
        if (/\[\[(?:IMAGE|FORMULA_IMAGE):/.test(source) || /\\includegraphics/.test(source)) return 28;
        const withoutCommands = source
            .replace(/\\(?:frac|sqrt|overline|overrightarrow|vec|text|mathrm|mathbf)\b/g, 'MM')
            .replace(/[${}\\_^]/g, '');
        let units = 0;
        for (const character of withoutCommands) {
            units += /[\u3400-\u9fff]/.test(character) ? 1 : /\s/.test(character) ? 0.25 : 0.56;
        }
        return units;
    };

    const resolveOptionColumns = ({ options = [], sourceRows = [] } = {}) => {
        const values = (options || []).map(value => String(value || '').trim()).filter(Boolean);
        if (!values.length) return 1;
        const sourceMaximum = Math.max(0, ...(sourceRows || []).map(row => (row || []).length));
        const hasImage = values.some(value => /\[\[(?:IMAGE|FORMULA_IMAGE):|\\includegraphics/.test(value));
        let maximum = sourceMaximum || 4;
        if (hasImage) maximum = Math.min(maximum, 2);
        const longest = Math.max(...values.map(visualUnits));
        if (maximum >= 4 && longest <= 13) return 4;
        if (maximum >= 2 && longest <= 29) return 2;
        return 1;
    };

    const buildQuestionLayout = ({ options = [], richBlocks = [] } = {}) => {
        const sourceOptionRows = extractOptionRows(richBlocks);
        return {
            version: VERSION,
            sourceOptionRows,
            optionColumns: resolveOptionColumns({ options, sourceRows: sourceOptionRows })
        };
    };

    const resolveMathScale = ({ textHeight = 0, mathHeight = 0 } = {}) => {
        const text = Number(textHeight);
        const math = Number(mathHeight);
        if (!(text > 0) || !(math > 0)) return 1.06;
        return Number(clamp(text / math, 1.02, 1.16).toFixed(3));
    };

    const measureMathScale = (documentRef = globalThis.document) => {
        try {
            const canvas = documentRef.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return 1.06;
            context.font = '100px "SimSun", "Times New Roman", serif';
            const body = context.measureText('数学AB').actualBoundingBoxAscent || 72;
            context.font = '100px "KaTeX_Main", "Times New Roman", serif';
            const math = context.measureText('ABxy').actualBoundingBoxAscent || 68;
            return resolveMathScale({ textHeight: body, mathHeight: math });
        } catch (error) {
            return 1.06;
        }
    };

    return {
        VERSION,
        buildQuestionLayout,
        extractLayoutModel,
        extractOptionRows,
        measureMathScale,
        renderLayoutHtml,
        replaceLayoutBlocks,
        resolveMathScale,
        resolveOptionColumns,
        serializeLayoutModel,
        serializeParagraphLayout,
        splitLayoutBlocks
    };
});
