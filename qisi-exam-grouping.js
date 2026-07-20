(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ExamGrouping = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const DEFAULT_FALLBACK_TYPE = '其他题型';
        const DEFAULT_LOCALE = 'zh-Hans-CN';

        const buildExamGroups = (sourceQuestions, policy = {}) => {
            const {
                typeOrder = [],
                groupConfig = {},
                defaultGroupConfig = {},
                typeLabels = {},
                questionMeta = {},
                fallbackType = DEFAULT_FALLBACK_TYPE,
                locale = DEFAULT_LOCALE
            } = policy;
            const grouped = {};

            sourceQuestions.forEach(question => {
                const type = question.type || fallbackType;
                if (!grouped[type]) grouped[type] = [];
                grouped[type].push(question);
            });

            return Object.entries(grouped).sort(([leftType], [rightType]) => {
                const leftIndex = typeOrder.includes(leftType)
                    ? typeOrder.indexOf(leftType)
                    : 999;
                const rightIndex = typeOrder.includes(rightType)
                    ? typeOrder.indexOf(rightType)
                    : 999;
                return leftIndex - rightIndex || leftType.localeCompare(rightType, locale);
            }).map(([type, items]) => {
                const config = groupConfig[type] || defaultGroupConfig[type] || {
                    title: typeLabels[type] || type,
                    points: 0
                };
                const points = Number(config.points || 0);
                const total = items.reduce(
                    (sum, question) => sum + Number(questionMeta[question.id]?.points || points),
                    0
                );
                const title = config.title || type;
                const generatedText = `${title}：本大题共 ${items.length} 小题，每小题 ${points} 分，共计 ${total} 分。`;

                return {
                    type,
                    items,
                    count: items.length,
                    points,
                    total,
                    title,
                    text: config.text || generatedText
                };
            });
        };

        const formatExamGroupSummary = group => (
            group.text || `${group.title}：本大题共 ${group.count} 小题，每小题 ${Number(group.points || 0)} 分，共计 ${group.total} 分。`
        );

        return {
            buildExamGroups,
            formatExamGroupSummary
        };
    }
);
