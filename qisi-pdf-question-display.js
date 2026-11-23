(function(root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {}; root.Qisi.PdfQuestionDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    'use strict';
    // Pure display projection. Raw evidence, source identity and admission are owned elsewhere.
    const SECTION_TYPES = { 单项选择题: 'single_choice', 单选题: 'single_choice',
        多项选择题: 'multiple_choice', 多选题: 'multiple_choice', 填空题: 'fill_blank', 解答题: 'free_response' };
    const SECTION_HEADING = /^(?:[一二三四五六七八九十]+[、．.]\s*)?(单项选择题|单选题|多项选择题|多选题|填空题|解答题|选择题)(?=[：:（(\s]|$)/;
    const SCORE_SUMMARY = /^本(?:题|大题)共\d+小题[，,](?:每小题\d+分[，,])?共\d+分[.。]?/;
    function sectionHeading(block) {
        if (block.type !== 'text' || block.parentId) return null;
        const text = String(block.text || '').trim();
        const match = text.match(SECTION_HEADING);
        if (!match) return null;
        const instructions = text.slice(match[0].length).replace(/^\s*[：:]?\s*/, '').replace(/[ \t]/g, '');
        const directions = instructions.replace(SCORE_SUMMARY, '');
        const single = /^在每小题给出的(?:四个|4个)选项中[，,]只有一个选项是正确的[.。]请把正确的选项填涂在答题卡相应的位置上[.。]?$/.test(directions);
        const multiple = /^在每小题给出的选项中[，,]有多项符合题目要求[.。]全部选对得\d+分[，,]选对但不全的得部分分[，,]有选错的得0分[.。]?$/.test(directions);
        const type = SECTION_TYPES[match[1]] || (single ? 'single_choice' : multiple ? 'multiple_choice' : 'unknown');
        const standalone = !instructions || (SCORE_SUMMARY.test(instructions) &&
            (!directions || single || multiple || /^解答应写出文字说明、证明过程或演算步骤[.。]?$/.test(directions)));
        return { type, standalone };
    }
    function projectQuestionText(text, type, utils) {
        if (type === 'free_response' || type === 'fill_blank') return { stem: text, options: [], optionLabels: [] };
        const original = utils.splitOptionLabels(text);
        if (!['single_choice', 'multiple_choice'].includes(type)) return original;
        // Only repair explicit, unique A-D dot labels. Do not infer labels from
        // named points, mathematical spans, image IDs or incomplete sequences.
        const masked = text.split(''), parsed = utils.tokenizeLatexSource(text);
        for (const part of parsed.segments.filter(part => part.type === 'math')) {
            for (let i = part.start; i < part.end; i++) masked[i] = ' ';
        }
        for (const issue of parsed.issues) for (let i = issue.index; i < masked.length; i++) masked[i] = ' ';
        const search = masked.join('').replace(/\[\[[^\]\n]*\]\]/g, token => ' '.repeat(token.length));
        const markers = [...search.matchAll(/[A-DＡ-Ｄ][.．]/g)].filter(match =>
            match.index === 0 || /[\s\u3000\u4e00-\u9fff）)】\]]/.test(search[match.index - 1]));
        const labels = markers.map(match => match[0][0].normalize('NFKC'));
        if (labels.join('') !== 'ABCD') return original;
        let separated = text;
        for (const match of [...markers].reverse()) separated = separated.slice(0, match.index) + '\n' + separated.slice(match.index);
        const result = utils.splitOptionLabels(separated);
        return result.stem.trim() && result.optionLabels.join('') === 'ABCD' && result.options.every(option => option.trim()) ? result : original;
    }
    function tableDisplayText(value) {
        const source = String(value);
        // A simple rectangular HTML table can be shown as explicit cell rows.
        // Unsupported spans, nested markup or malformed structure stay literal.
        if (!/^\s*<table\b[^>]*>[\s\S]*<\/table>\s*$/i.test(source) ||
            (source.match(/<table\b/gi) || []).length !== 1 || /\b(?:colspan|rowspan)\s*=/i.test(source) ||
            /<\/?(?!(?:table|thead|tbody|tfoot|tr|td|th|br)\b)[a-z][^>]*>/i.test(source)) return source;
        const rows = [...source.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
        if (!rows.length || source.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, '')
            .replace(/<\/?(?:table|thead|tbody|tfoot)\b[^>]*>/gi, '').trim()) return source;
        const entities = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ' };
        const decode = text => text.replace(/&(?:lt|gt|amp|quot|apos|nbsp|#39|#\d+|#x[0-9a-f]+);/gi, token => {
            if (Object.hasOwn(entities, token.toLowerCase())) return entities[token.toLowerCase()];
            const code = /^&#x/i.test(token) ? parseInt(token.slice(3, -1), 16) : Number(token.slice(2, -1));
            return Number.isInteger(code) && code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : token;
        });
        const output = [];
        for (const row of rows) {
            const cells = [...row[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
            if (!cells.length || row[1].replace(/<(td|th)\b[^>]*>[\s\S]*?<\/\1>/gi, '').trim() ||
                cells.some(cell => /<[^>]*>/.test(cell[2].replace(/<br\s*\/?>/gi, '\n')))) return source;
            output.push(cells.map(cell => decode(cell[2].replace(/<br\s*\/?>/gi, '\n')).trim()).join(' | '));
        }
        if (rows.some(row => [...row[1].matchAll(/<t[dh]\b/gi)].length !== [...rows[0][1].matchAll(/<t[dh]\b/gi)].length)) return source;
        return output.join('\n');
    }
    function questionDisplayBlocks(blocks, type, utils, numberStart) {
        const kept = blocks.filter(block => !sectionHeading(block)?.standalone);
        if (!['single_choice', 'multiple_choice'].includes(type)) return kept;
        const parents = new Map(kept.map(block => [block.id, block])), captions = new Map();
        for (const block of kept) {
            if (block.origin?.field !== 'image_caption' || !parents.get(block.parentId)?.image ||
                !/^[A-DＡ-Ｄ][.．]$/.test(String(block.text || '').trim())) continue;
            if (!captions.has(block.parentId)) captions.set(block.parentId, []);
            captions.get(block.parentId).push(block);
        }
        const moves = new Map([...captions].filter(([, children]) => children.length === 1).map(([id, children]) => [id, children[0]]));
        const moved = new Set(moves.values());
        const ordered = kept.filter(block => !moved.has(block)).flatMap(block => moves.has(block.id) ? [moves.get(block.id), block] : [block]);
        // Only a complete unambiguous lexical row permits this display reorder.
        // Raw source ordering and exact parent/child evidence are never changed.
        const preview = ordered.map(block => block.image ? '[[SOURCE_FIGURE]]' : block.text || '').join('\n').replace(numberStart, '');
        const split = projectQuestionText(preview, type, utils);
        return split.optionLabels.join('') === 'ABCD' && split.options.every(text => text.trim()) ? ordered : kept;
    }
    return Object.freeze({ projectQuestionText, tableDisplayText, questionDisplayBlocks, sectionHeading });
});
