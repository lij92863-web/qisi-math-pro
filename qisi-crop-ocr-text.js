(function (root, factory) {
    const utils = root.Qisi?.Utils || require('./qisi-utils');
    const api = factory(utils);
    root.Qisi = root.Qisi || {};
    root.Qisi.CropOcrText = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (utils) {
    'use strict';

    const { tokenizeLatexSource } = utils;
    const optionLine = /^\s*([A-FＡ-Ｆ])\s*[.．、:：]\s*(.*)$/;
    const tick = /^[（(][ \t]*\\checkmark[ \t]*[）)]/;
    const comparable = text => text.replace(/\s/g, '');

    function normalizeLayout(source) {
        let text = String(source || '').replace(/\r\n?/g, '\n').trim();
        if (/<(?:ol|ul|li|p|ref|div|br)(?=[\s/>])/i.test(text)) {
            text = text.replace(/^(?:\x60{3})?html\s*(?=<)/i, '')
                .replace(/\x60{3}\s*$/, '')
                .replace(/<\/?(?:ol|ul|li|p|div)\b[^>]*>|<br\s*\/?>/gi, '\n')
                .replace(/<\/?ref\b[^>]*>/gi, '')
                .replace(/&(amp|lt|gt|nbsp|quot|#39);/gi, (_, name) => ({
                    amp:'&', lt:'<', gt:'>', nbsp:' ', quot:'"', '#39':"'"
                })[name.toLowerCase()]);
        }
        text = text.split('\n').map(line => {
            // Some OCR lists place the option letter inside the math delimiters.
            const trimmed = line.trim().replace(/^(\${1,3})\s*([A-FＡ-Ｆ])\s*[.．、:：]\s*([^$]+?)\s*\${1,3}$/, (_, delimiter, letter, expr) => letter + '. $' + expr.trim() + '$');
            const option = trimmed.match(optionLine);
            if (!option) return trimmed.replace(/^\${3}\s*([^$]+?)\s*\${3}$/, (_, body) => '$' + body + '$');
            const [, letter, body] = option;
            let content = body;
            const paired = body.match(/^\${1,3}([^$]+?)\${1,3}$/);
            if (paired) content = '$' + paired[1].trim() + '$';
            else if (/\\[a-z]+/i.test(body) && !/[\p{Script=Han}<>]/u.test(body)) {
                const single = body.match(/^(?:\${1,3}([^$]+)|([^$]+?)\${1,3})$/);
                if (single) content = '$' + (single[1] || single[2]).trim() + '$';
            }
            return letter.normalize('NFKC') + '. ' + content;
        }).join('\n').replace(/\n[ \t]*\n+(?=[A-F]\. )/g, '\n').trim();

        const { segments, issues } = tokenizeLatexSource(text);
        if (issues.length) return text;
        return segments.map(segment => {
            if (segment.type === 'text') {
                const prose = segment.raw.replace(/(?<!\\)\\[ \t]*\n/g, '\n')
                    .replace(/(?<![A-Za-z0-9_\\])(?:\\_|_)+(?![A-Za-z0-9_])/g, '$\\underline{\\hspace{2cm}}$');
                return segment.end === text.length ? prose.replace(/(?<!\\)\\[ \t]*$/, '') : prose;
            }
            const { start, end, expression, openToken, raw } = segment;
            if (openToken !== '$$' || /[\n\r]|\\(?:begin|tag|label)\b/.test(expression)) return raw;
            const before = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
            const after = text.slice(end).split('\n', 1)[0];
            return (before.trim() || after.trim()) ? '$' + expression.trim() + '$' : raw;
        }).join('').replace(
            // Bring a numeric endpoint into the same formula as its interval.
            /^([A-F]\. )(\[|\()[ \t]*(-?\d+(?:\.\d+)?)[ \t]*,[ \t]*\$([^$\n]+[\])])\$[ \t]*$/gm,
            (_, label, bracket, endpoint, rest) => label + '$' + bracket + endpoint + ', ' + rest + '$'
        ).trim();
    }

    function choiceBlocks(text) {
        const { segments, issues } = tokenizeLatexSource(text);
        if (issues.length) return [];
        const formulas = segments.filter(segment => segment.type === 'math');
        const pattern = /^A\. ([^\n]+)\nB\. ([^\n]+)\nC\. ([^\n]+)\nD\. ([^\n]+)$/gm;
        return Array.from(text.matchAll(pattern), match => ({
            start: match.index,
            end: match.index + match[0].length,
            options: match.slice(1).map(value => value.trim())
        })).filter(block => !formulas.some(formula => formula.start < block.start && block.start < formula.end));
    }

    function removeChoiceEcho(text) {
        const blocks = choiceBlocks(text);
        if (blocks.length !== 2) return text;
        const [first, second] = blocks;
        if (!first.options.every((value, index) => value === second.options[index])) return text;

        const between = text.slice(first.end, second.start).trim();
        const betweenTick = between.match(tick)?.[0];
        const tail = comparable(between.replace(tick, '').trim().replace(/^[，,。]/, ''));
        const stem = comparable(text.slice(0, first.start));
        if (tail && (tail.length < 6 || tail === stem || !stem.endsWith(tail))) return text;

        const after = text.slice(second.end).trim();
        if (after && (!betweenTick || comparable(after) !== comparable(betweenTick))) return text;
        if (betweenTick && !after) return text;
        return text.slice(0, first.end).trimEnd();
    }

    function removeRestartedStem(text) {
        const heading = /^\d{1,3}[.．、][ \t]*[【\[][^\n\]】]{2,60}[\]】]/.exec(text)?.[0];
        if (!heading) return text;
        const blocks = choiceBlocks(text);
        if (blocks.length !== 1) return text;
        const stem = text.slice(0, blocks[0].start);
        const headings = [...stem.matchAll(/(?:^|(?<=\s))\d{1,3}[.．、][ \t]*[【\[][^\n\]】]{2,60}[\]】]/g)];
        if (headings.length !== 2 || comparable(headings[1][0]) !== comparable(heading)) return text;
        const restart = headings[1].index;
        const prefix = comparable(stem.slice(0, restart));
        const complete = comparable(stem.slice(restart));
        if (prefix.length < comparable(heading).length + 20 || !complete.startsWith(prefix) || complete.length === prefix.length)
            return text;
        return text.slice(restart);
    }

    const removeEcho = text => removeRestartedStem(removeChoiceEcho(text));
    const normalizeCropOcr = source => removeEcho(normalizeLayout(source));
    function repairCropOcrEcho(source) {
        const normalized = normalizeLayout(source);
        const repaired = removeEcho(normalized);
        return repaired === normalized ? null : repaired;
    }

    return Object.freeze({ optionLine, normalizeCropOcr, repairCropOcrEcho });
});
