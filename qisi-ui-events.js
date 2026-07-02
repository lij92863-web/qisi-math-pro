(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.UiEvents = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const bindClick = (el, handler) => {
        if (el && typeof handler === 'function') {
            el.addEventListener('click', handler);
            return true;
        }
        return false;
    };

    const buildQuestionNumberGapWarning = (items = []) => {
        const numbers = [
            ...new Set(
                (items || [])
                    .map(item => Number(String(item.questionNumber || '').match(/\d+/)?.[0]))
                    .filter(Number.isFinite)
            )
        ].sort((a, b) => a - b);

        if (numbers.length < 2) return '';

        const gaps = [];

        for (let index = 1; index < numbers.length; index += 1) {
            const previous = numbers[index - 1];
            const current = numbers[index];

            for (let value = previous + 1; value < current; value += 1) {
                gaps.push(value);
            }
        }

        return gaps.length
            ? `原文件题号不连续，未识别到题号：${gaps.join('、')}。系统未自动补题，请核对原文件。`
            : '';
    };

    const buildKnowledgeCounts = (tree, type, questions = [], getQuestionKnowledge) => {
        const counts = {};
        const addCount = (name) => { counts[name] = (counts[name] || 0) + 1; };

        const parentMap = {};
        (tree || []).forEach(l1 => {
            if (l1.children) l1.children.forEach(l2 => {
                parentMap[l2.name] = [l1.name];
                if (l2.children) l2.children.forEach(l3 => {
                    parentMap[l3.name] = [l2.name, l1.name];
                });
            });
        });

        if (typeof getQuestionKnowledge !== 'function') return counts;

        (questions || []).forEach(q => {
            const kn = getQuestionKnowledge(q, type);
            if (q && kn) {
                addCount(kn);
                if (parentMap[kn]) {
                    parentMap[kn].forEach(p => addCount(p));
                }
            }
        });

        return counts;
    };

    return {
        bindClick,
        buildQuestionNumberGapWarning,
        buildKnowledgeCounts
    };
});
