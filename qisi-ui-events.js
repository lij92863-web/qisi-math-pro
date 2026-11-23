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

    const createKnowledgeCounter = (tree, type, getQuestionKnowledge, { byId = false, counts = Object.create(null) } = {}) => {
        const addCount = (name, weight) => {
            const count = (Object.hasOwn(counts, name) ? counts[name] : 0) + weight;
            if (count) counts[name] = count;
            else delete counts[name];
        };
        const parentMap = new Map();
        const pathsById = new Map();
        const visit = (nodes, parents = []) => {
            for (const node of nodes || []) {
                const path = [byId ? node.id : node.name, ...parents];
                if (!parentMap.has(node.name)) parentMap.set(node.name, path);
                if (node.id) pathsById.set(node.id, path);
                visit(node.children, path);
            }
        };
        visit(tree);

        const adjust = (q, count = 1) => {
            const references = q?.personalKnowledgeIds ?? q?.meta?.personalKnowledgeIds;
            if (type === 'personal' && Array.isArray(references)) {
                new Set(references.flatMap(id => pathsById.get(id) || [])).forEach(name => addCount(name, count));
                return;
            }
            const name = getQuestionKnowledge?.(q, type);
            if (name) new Set(parentMap.get(name) || (byId ? [] : [name])).forEach(key => addCount(key, count));
        };
        return { counts, adjust };
    };
    const buildKnowledgeCounts = (tree, type, questions = [], getQuestionKnowledge, options) => {
        if (typeof getQuestionKnowledge !== 'function') return {};
        const counter = createKnowledgeCounter(tree, type, getQuestionKnowledge, options);
        for (const question of questions || []) counter.adjust(question);
        return { ...counter.counts };
    };

    return {
        bindClick,
        buildQuestionNumberGapWarning,
        buildKnowledgeCounts, createKnowledgeCounter
    };
});
