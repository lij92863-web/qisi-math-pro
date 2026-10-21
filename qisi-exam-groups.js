(function initExamGroups(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ExamGroups = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Paper groups and type-local reordering. The page owns cart/questions refs;
    // these functions only read them and return the next order.

    const groupQuestions = ({ questions, groupConfig = {}, questionMeta = {}, typeOrder = [], defaultGroupConfig = {}, typeLabels = {} } = {}) => {
        const grouped = {};
        (Array.isArray(questions) ? questions : []).forEach(question => {
            const type = question.type || '其他题型';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(question);
        });
        return Object.entries(grouped).sort(([a], [b]) => {
            const ia = typeOrder.includes(a) ? typeOrder.indexOf(a) : 999;
            const ib = typeOrder.includes(b) ? typeOrder.indexOf(b) : 999;
            return ia - ib || a.localeCompare(b, 'zh-Hans-CN');
        }).map(([type, items]) => {
            const config = groupConfig[type] || defaultGroupConfig[type] ||
                { title: typeLabels[type] || type, points: 0 };
            const points = Number(config.points || 0);
            const total = items.reduce((sum, question) => sum + Number(questionMeta[question.id]?.points || points), 0);
            const generatedText = `${config.title || type}：本大题共 ${items.length} 小题，每小题 ${points} 分，共计 ${total} 分。`;
            return {
                type,
                items,
                count: items.length,
                points,
                total,
                title: config.title || type,
                text: config.text || generatedText
            };
        });
    };

    const reorderWithinType = ({ sourceId, targetIndex, cart = [], questions = [] } = {}) => {
        const findQuestion = id => questions.find(question => question?.id === id);
        const source = findQuestion(sourceId);
        if (!source) return { cart, changed: false };
        const type = source.type || '其他题型';
        const typeIds = cart.filter(id => {
            const question = findQuestion(id);
            return question && (question.type || '其他题型') === type;
        });
        const currentIndex = typeIds.indexOf(sourceId);
        const withoutSource = typeIds.filter(id => id !== sourceId);
        const nextIndex = Math.max(0, Math.min(targetIndex, withoutSource.length));
        if (currentIndex === nextIndex) return { cart, changed: false };
        withoutSource.splice(nextIndex, 0, sourceId);
        const queue = [...withoutSource];
        return {
            cart: cart.map(id => {
                const question = findQuestion(id);
                return question && (question.type || '其他题型') === type ? queue.shift() : id;
            }),
            changed: true
        };
    };

    return Object.freeze({ groupQuestions, reorderWithinType });
});
