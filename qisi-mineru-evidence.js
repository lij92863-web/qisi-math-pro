(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.MineruEvidence = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Same-length mask: every public range is a UTF-16 offset into raw text.
    function maskMath(text) {
        const chars = text.split('');
        let close = null;
        for (let i = 0; i < text.length;) {
            if (close) {
                if (text.startsWith(close, i)) {
                    for (let j = 0; j < close.length; j++) chars[i + j] = ' ';
                    i += close.length; close = null;
                } else {
                    chars[i] = ' ';
                    if (text[i] === '\\' && text[i + 1]) chars[++i] = ' ';
                    i++;
                }
            } else {
                const opening = text.startsWith('$$', i) ? '$$' : text[i] === '$' ? '$' :
                    text.startsWith('\\(', i) ? '\\(' : text.startsWith('\\[', i) ? '\\[' : null;
                if (opening) {
                    close = opening === '\\(' ? '\\)' : opening === '\\[' ? '\\]' : opening;
                    for (let j = 0; j < opening.length; j++) chars[i + j] = ' ';
                    i += opening.length;
                } else if (text[i] === '\\') { i += 2; }
                else i++;
            }
        }
        return chars.join('');
    }

    function fragment(block, start, end) {
        const origin = block.origin || { blockId: block.id, range: [0, block.text.length] };
        const range = [(origin.range?.[0] || 0) + start, (origin.range?.[0] || 0) + end];
        return { ...block, id: `${origin.blockId}@${range[0]}:${range[1]}`,
            text: block.text.slice(start, end), origin: { ...origin, range } };
    }

    function answerKey(value) {
        const raw = String(value == null ? '' : value).trim();
        // 同一个答案在题源里常被印成 "A" / "A." / "（A）" / "A、"。先剥掉首尾
        // 括号与标点再比较；否则会被当成「两个不同的答案」而判定冲突，整卷拒绝绑定。
        const text = raw.replace(/^[\s（(【\[]+/, '').replace(/[\s。．.、，,；;：:）)】\]]+$/, '').trim();
        const choiceLabels = text.replace(/[ \t]+/g, '');
        return /^[A-Ha-h]{1,8}$/.test(choiceLabels) ? [...new Set(choiceLabels.toUpperCase())].sort().join('') : text;
    }

    function aggregateAnswers(declarations) {
        const evidence = declarations.filter(item => item.value != null && String(item.value).trim())
            .map(item => ({ ...item, value: String(item.value).trim(), key: answerKey(item.value) }));
        const keys = new Set(evidence.map(item => item.key));
        return { state: keys.size > 1 ? 'conflicting' : keys.size ? 'agreed' : 'absent',
            value: keys.size === 1 ? evidence[0].value : '', evidence };
    }

    function explicitDeclarations(blocks) {
        const declarations = [];
        for (const block of blocks) {
            const text = String(block.text || '');
            const mask = maskMath(text);
            for (const match of mask.matchAll(/【答案】|故选\s*[:：]\s*([A-Ha-h]{1,8})(?![A-Za-z])/g)) {
                if (match[1]) declarations.push({ value: match[1], blockId: block.id, range: [match.index, match.index + match[0].length], kind: 'conclusion' });
                else {
                    const start = match.index + match[0].length;
                    const tail = text.slice(start).match(/^[^\n【]*/)[0];
                    if (tail.trim()) declarations.push({ value: tail.trim(), blockId: block.id, range: [start, start + tail.length], kind: 'answer-label' });
                }
            }
        }
        return declarations;
    }

    // A complete ordered option alphabet establishes delimiters, not isolated
    // geometry letters. Return the leading text too; never discard it.
    function splitOptions(block) {
        if (block.type !== 'text' || block.parentId) return null;
        const text = String(block.text || '');
        const mask = maskMath(text);
        const marks = [...mask.matchAll(/([A-H])[.．、](?!\d)/g)];
        if (marks.length < 2 || marks[0][1] !== 'A' || marks.some((m, i) => m[1] !== String.fromCharCode(65 + i))) return null;
        // First delimiter must start a line or follow whitespace/punctuation.
        const first = marks[0].index;
        if (first && !/[\s，。；：:）)]/.test(text[first - 1])) return null;
        const options = marks.map((m, i) => ({ label: m[1], block: fragment(block, m.index, marks[i + 1]?.index ?? text.length) }));
        if (options.some(item => !item.block.text.slice(2).trim())) return null;
        return { prefix: first ? fragment(block, 0, first) : null, options };
    }

    return Object.freeze({ maskMath, fragment, answerKey, aggregateAnswers, explicitDeclarations, splitOptions });
});
