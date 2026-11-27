(function initDocxNumbering(root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxNumbering = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Word 自动编号的展开。
    //
    // 背景：题号有两种来源。
    //   1) 老师手打的文本 "1."、"2."     —— 只能靠正则从文字里认，天生会和
    //      解析正文里的 "1. 当 x>0 时" 混在一起，这就是「解析串题」的根子。
    //   2) Word 自动编号 <w:numPr>       —— 编号根本不在文字里，是文档结构上的
    //      属性，读它就能拿到真题号，而且正文里手打的分步编号不会带 numPr。
    //
    // 所以正确顺序是：优先从文档结构拿题号，文本标记只作兜底。
    // 本模块只负责第 2 条，并且刻意**按区域**展开（见 expand 的 beforeIndex）：
    // 只有题目区展开，答案/解析区保持原样，否则解析里的分步列表会变成假题号。

    const NUMERAL_FORMATS = Object.freeze({
        decimal: value => String(value),
        decimalZero: value => String(value).padStart(2, '0'),
        upperLetter: value => String.fromCharCode(64 + value),
        lowerLetter: value => String.fromCharCode(96 + value),
        upperRoman: value => toRoman(value).toUpperCase(),
        lowerRoman: value => toRoman(value).toLowerCase(),
        decimalEnclosedParen: value => `(${value})`,
        decimalEnclosedCircle: value => `(${value})`,
        decimalFullWidth: value => String(value).replace(/[0-9]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 65248)),
        chineseCounting: value => chineseNumber(value),
        chineseCountingThousand: value => chineseNumber(value)
    });

    function toRoman(value) {
        if (!Number.isInteger(value) || value < 1 || value > 3999) return String(value);
        const table = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
            [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
        let rest = value, out = '';
        for (const [unit, symbol] of table) {
            while (rest >= unit) { out += symbol; rest -= unit; }
        }
        return out;
    }

    function chineseNumber(value) {
        if (!Number.isInteger(value) || value < 1 || value > 99) return String(value);
        const digits = '零一二三四五六七八九';
        if (value < 10) return digits[value];
        const tens = Math.floor(value / 10), ones = value % 10;
        return (tens === 1 ? '' : digits[tens]) + '十' + (ones ? digits[ones] : '');
    }

    /**
     * 按 Word 声明的格式与模板生成标签。
     * lvlText 里的 %1 是当前级别的编号占位符，其它字符原样保留
     * （所以 "1."、"1、"、"（1）" 都靠模板本身表达，不需要为每种后缀写分支）。
     */
    function renderLabel(format, lvlText, value) {
        const formatter = NUMERAL_FORMATS[format];
        if (!formatter) return '';
        const rendered = formatter(value);
        if (!rendered) return '';
        const template = typeof lvlText === 'string' && lvlText ? lvlText : '%1.';
        return template.replace(/%1/g, rendered);
    }

    const attribute = (fragment, name) =>
        fragment.match(new RegExp('\\b' + name + '=\\s*["\']([^"\']*)["\']'))?.[1] || '';
    const property = (fragment, name) =>
        attribute(fragment.match(new RegExp('<w:' + name + '\\b[^>]*>'))?.[0] || '', 'w:val');
    const numberingProperties = fragment => fragment.match(/<w:numPr\b[^>]*>([\s\S]*?)<\/w:numPr>/)?.[1] || '';

    function paragraphStyles(stylesXml) {
        const styles = new Map();
        for (const [, tag, body] of String(stylesXml || '').matchAll(/(<w:style\b[^>]*>)([\s\S]*?)<\/w:style>/g)) {
            const id = attribute(tag, 'w:styleId');
            if (id && attribute(tag, 'w:type') === 'paragraph') {
                styles.set(id, { parent: property(body, 'basedOn'), numId: property(numberingProperties(body), 'numId') });
            }
        }
        return styles;
    }

    /**
     * 从 numbering.xml 建出「列表定义表」。
     * 每项记录该列表的格式、模板、起始值。
     *
     * 这里用正则而不是 DOMParser：numbering.xml 的结构非常固定，
     * 而 DOMParser 在 Node 测试环境里不存在，会让这段逻辑无法被测到。
     */
    function buildListDefinitions(numberingXml) {
        const definitions = new Map();
        const xml = String(numberingXml || '');
        if (!xml) return definitions;

        const abstracts = new Map();
        for (const block of xml.matchAll(/<w:abstractNum\b[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
            const id = attribute(block[0].match(/<w:abstractNum\b[^>]*>/)?.[0] || '', 'w:abstractNumId');
            if (!id) continue;
            const level = block[1].match(/<w:lvl\b[^>]*w:ilvl=["']0["'][^>]*>([\s\S]*?)<\/w:lvl>/);
            if (!level) continue;
            const levels = [...block[1].matchAll(/(<w:lvl\b[^>]*>)([\s\S]*?)<\/w:lvl>/g)];
            const styleLevels = new Map(levels.map(([, tag, body]) => [property(body, 'pStyle'), attribute(tag, 'w:ilvl')])
                .filter(([style]) => style));
            abstracts.set(id, {
                styleLevels, singleLevel: levels.length === 1,
                format: attribute(level[1].match(/<w:numFmt\b[^>]*\/?>/)?.[0] || '', 'w:val'),
                lvlText: attribute(level[1].match(/<w:lvlText\b[^>]*\/?>/)?.[0] || '', 'w:val'),
                start: Number(attribute(level[1].match(/<w:start\b[^>]*\/?>/)?.[0] || '', 'w:val') || 1)
            });
        }

        for (const block of xml.matchAll(/<w:num\b[^>]*>([\s\S]*?)<\/w:num>/g)) {
            const numId = attribute(block[0].match(/<w:num\b[^>]*>/)?.[0] || '', 'w:numId');
            const abstractId = attribute(block[1].match(/<w:abstractNumId\b[^>]*\/?>/)?.[0] || '', 'w:val');
            const level = abstracts.get(abstractId);
            if (!numId || !level) continue;
            // 只处理能生成稳定编号的格式；项目符号（bullet）和图片编号不出编号。
            if (!NUMERAL_FORMATS[level.format]) continue;
            const override = Number(attribute(block[1].match(/<w:startOverride\b[^>]*\/?>/)?.[0] || '', 'w:val'));
            const start = Number.isSafeInteger(override) && override > 0
                ? override
                : (Number.isSafeInteger(level.start) && level.start > 0 ? level.start : 1);
            definitions.set(numId, { ...level, next: start });
        }
        return definitions;
    }

    /**
     * 给「一级自动编号」的段落补上编号文本。
     *
     * beforeIndex：只处理第 beforeIndex 个段落之前的段落（0 起）。
     *   传 -1 或不传表示全部处理。
     *   题目区之外的自动编号（解析里的分步列表）必须保持原样，
     *   否则它们会变成「疑似题号」，把解析切走。
     *
     * 返回 { xml, expanded, skipped }，expanded 是补了编号的段落数。
     */
    function expand(xml, numberingXml, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const beforeIndex = Number.isInteger(settings.beforeIndex) ? settings.beforeIndex : -1;
        const definitions = buildListDefinitions(numberingXml);
        if (!definitions.size) return { xml, expanded: 0, skipped: 0 };
        const styles = paragraphStyles(settings.stylesXml);

        let paragraphIndex = -1;
        let expanded = 0;
        let skipped = 0;

        const next = String(xml || '').replace(/<w:p\b[\s\S]*?<\/w:p>/g, paragraph => {
            paragraphIndex += 1;
            const formatting = paragraph.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/)?.[1]
                .split(/<w:pPrChange\b/, 1)[0] || '';
            const properties = numberingProperties(formatting);
            let numId = property(properties, 'numId');
            let level = property(properties, 'ilvl');
            if (!numId && styles.size) {
                const visited = new Set();
                for (let id = property(formatting, 'pStyle'); styles.has(id) && !visited.has(id); id = styles.get(id).parent) {
                    visited.add(id);
                    numId ||= styles.get(id).numId;
                }
                const inherited = definitions.get(numId);
                if (inherited && !level) {
                    level = [...visited].map(id => inherited.styleLevels.get(id)).find(value => value !== undefined) ??
                        (inherited.singleLevel && !inherited.styleLevels.size ? '0' : '');
                }
            }
            if (numId === '0' || level !== '0') return paragraph;
            const definition = numId ? definitions.get(numId) : null;
            if (!definition) return paragraph;

            // 超出题目区的自动编号不展开，原样留给解析正文。
            if (beforeIndex >= 0 && paragraphIndex >= beforeIndex) {
                skipped += 1;
                return paragraph;
            }

            const label = renderLabel(definition.format, definition.lvlText, definition.next);
            if (!label) return paragraph;
            definition.next += 1;
            expanded += 1;

            const text = extractText(paragraph);
            // 段落里已经手打了同样的编号，不再重复加。
            if (text.trim().startsWith(label)) return paragraph;
            const prefix = '<w:r><w:t xml:space="preserve">' + escapeXml(label) + ' </w:t></w:r>';
            return paragraph.includes('</w:pPr>')
                ? paragraph.replace('</w:pPr>', () => '</w:pPr>' + prefix)
                : paragraph.replace(/<w:p\b[^>]*>/, tag => tag + prefix);
        });

        return { xml: next, expanded, skipped };
    }

    function extractText(fragment) {
        return [...String(fragment || '').matchAll(/<(?:w|m):t\b[^>]*>([\s\S]*?)<\/(?:w|m):t>/g)]
            .map(match => match[1]).join('');
    }

    function escapeXml(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return Object.freeze({
        NUMERAL_FORMATS,
        buildListDefinitions,
        renderLabel,
        expand
    });
});
