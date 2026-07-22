(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryViewState = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function () {
        'use strict';

        const buildQuestionFingerprintMaps = (items, dependencies = {}) => {
            const { coreFingerprint, stemFingerprint } = dependencies;
            if (typeof coreFingerprint !== 'function' || typeof stemFingerprint !== 'function') {
                throw new TypeError('buildQuestionFingerprintMaps requires coreFingerprint and stemFingerprint');
            }

            const coreMap = new Map();
            const stemMap = new Map();
            (items || []).forEach(question => {
                if (!question) return;
                const core = coreFingerprint(question);
                const stem = stemFingerprint(question);
                if (core && !coreMap.has(core)) coreMap.set(core, question);
                if (stem && !stemMap.has(stem)) stemMap.set(stem, question);
            });
            return { coreMap, stemMap };
        };

        const collectKnowledgeNames = (node) => {
            if (!node) return [];
            let names = [node.name];
            if (Array.isArray(node.children)) {
                node.children.forEach(child => {
                    names = names.concat(collectKnowledgeNames(child));
                });
            }
            return names;
        };

        const flattenKnowledgeTree = (tree, prefix = []) => {
            const rows = [];
            for (const node of tree || []) {
                const currentPath = [...prefix, node.name];
                rows.push({
                    id: node.id,
                    name: node.name,
                    path: currentPath.join(' / ')
                });
                if (node.children?.length) {
                    rows.push(...flattenKnowledgeTree(node.children, currentPath));
                }
            }
            return rows;
        };

        const filterLibraryQuestions = (questions, options = {}) => {
            const {
                activeKnowledge,
                knowledgeType = 'system',
                knowledgeTree = [],
                keyword = '',
                filters = {},
                findNode,
                getQuestionKnowledge,
                questionMatchesLibraryFilters,
                hasText
            } = options;

            if (typeof questionMatchesLibraryFilters !== 'function') {
                throw new TypeError('filterLibraryQuestions requires questionMatchesLibraryFilters');
            }

            let result = questions || [];
            if (activeKnowledge) {
                if (typeof findNode !== 'function' || typeof getQuestionKnowledge !== 'function') {
                    throw new TypeError('active knowledge filtering requires findNode and getQuestionKnowledge');
                }

                const targetNode = findNode(knowledgeTree, activeKnowledge);

                if (targetNode) {
                    const allowedNames = new Set(collectKnowledgeNames(targetNode));
                    result = result.filter(question => {
                        const knowledge = getQuestionKnowledge(question, knowledgeType);
                        return question && allowedNames.has(knowledge);
                    });
                } else {
                    result = result.filter(question => {
                        const knowledge = getQuestionKnowledge(question, knowledgeType);
                        return question && knowledge === activeKnowledge;
                    });
                }
            }

            return result.filter(question => questionMatchesLibraryFilters(question, {
                keyword,
                filters,
                hasText
            }));
        };

        return {
            buildQuestionFingerprintMaps,
            collectKnowledgeNames,
            flattenKnowledgeTree,
            filterLibraryQuestions
        };
    }
);
