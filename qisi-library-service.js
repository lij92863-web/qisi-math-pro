(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryService = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const stableSort = (items, sortBy = 'createdAt', direction = 'desc') =>
        (items || []).map((item, index) => ({ item, index }))
            .sort((left, right) => {
                const a = left.item?.[sortBy];
                const b = right.item?.[sortBy];
                const compared = a < b ? -1 : a > b ? 1 : 0;
                return (direction === 'asc' ? compared : -compared) ||
                    left.index - right.index;
            })
            .map(entry => entry.item);

    const collectKnowledgeNames = node => {
        if (!node) return [];
        return [
            node.name,
            ...(node.children || []).flatMap(collectKnowledgeNames)
        ];
    };

    const paginate = (items, page = 1, pageSize = 10) => {
        const size = Math.max(1, Math.floor(pageSize) || 10);
        const total = (items || []).length;
        const totalPages = Math.max(1, Math.ceil(total / size));
        const currentPage = Math.min(
            totalPages,
            Math.max(1, Math.floor(page) || 1)
        );
        const start = (currentPage - 1) * size;
        return {
            items: (items || []).slice(start, start + size),
            total,
            page: currentPage,
            pageSize: size,
            totalPages
        };
    };

    const selectBatch = (availableIds, selectedIds, mode = 'all') => {
        const available = new Set((availableIds || []).map(String));
        const selected = new Set(
            (selectedIds || []).map(String).filter(id => available.has(id))
        );
        if (mode === 'none') return [];
        if (mode === 'all') return [...available];
        if (typeof mode === 'object' && mode?.toggle != null) {
            const id = String(mode.toggle);
            if (!available.has(id)) return [...selected];
            if (selected.has(id)) selected.delete(id);
            else selected.add(id);
        }
        return [...selected];
    };

    const defaultFingerprint = question => {
        const normalize = value => String(value || '')
            .replace(/\s+/g, '')
            .toLowerCase();
        return `${normalize(question?.stem)}__${(question?.options || [])
            .map(normalize).join('|')}`;
    };

    const detectDuplicate = (
        candidate,
        items,
        fingerprint = defaultFingerprint
    ) => {
        const candidateKey = fingerprint(candidate);
        if (!candidateKey || candidateKey === '__') return null;
        return (items || []).find(item =>
            item?.id !== candidate?.id && fingerprint(item) === candidateKey
        ) || null;
    };

    const metadataQuery = items => {
        const rows = items || [];
        const types = new Map();
        const grades = new Map();
        const difficulties = new Map();
        let withAnswer = 0;
        let withImages = 0;
        const increment = (map, value) => {
            const key = String(value || '');
            if (key) map.set(key, (map.get(key) || 0) + 1);
        };
        for (const item of rows) {
            increment(types, item?.type || item?.meta?.type);
            increment(grades, item?.grade || item?.meta?.grade);
            increment(difficulties, item?.diff || item?.meta?.diff);
            if (String(item?.answer || '').trim()) withAnswer += 1;
            if (Array.isArray(item?.images) && item.images.length) withImages += 1;
        }
        return {
            total: rows.length,
            types: Object.fromEntries(types),
            grades: Object.fromEntries(grades),
            difficulties: Object.fromEntries(difficulties),
            withAnswer,
            withImages
        };
    };

    const createLibraryService = ({
        repository,
        matchesFilters,
        getKnowledge,
        findKnowledgeNode,
        fingerprint = defaultFingerprint
    } = {}) => {
        if (typeof matchesFilters !== 'function') {
            throw new TypeError('matchesFilters dependency is required.');
        }

        const filterAndSort = (
            items,
            {
                keyword = '',
                filters = {},
                knowledge = '',
                knowledgeType = 'system',
                knowledgeTree = [],
                sortBy = 'createdAt',
                direction = 'desc'
            } = {}
        ) => {
            let result = (items || []).filter(Boolean);
            if (knowledge) {
                const node = typeof findKnowledgeNode === 'function'
                    ? findKnowledgeNode(knowledgeTree, knowledge)
                    : null;
                const allowed = new Set(
                    node ? collectKnowledgeNames(node) : [knowledge]
                );
                result = result.filter(item => allowed.has(
                    typeof getKnowledge === 'function'
                        ? getKnowledge(item, knowledgeType)
                        : item?.knowledge
                ));
            }
            result = result.filter(item => matchesFilters(item, {
                keyword,
                filters
            }));
            return stableSort(result, sortBy, direction);
        };

        const query = (items, criteria = {}) => {
            const filtered = filterAndSort(items, criteria);
            return paginate(filtered, criteria.page, criteria.pageSize);
        };

        const softDelete = id => {
            if (!repository?.softDeleteQuestion) {
                throw new TypeError('repository soft delete is unavailable.');
            }
            return repository.softDeleteQuestion(id);
        };
        const restore = id => {
            if (!repository?.restoreQuestion) {
                throw new TypeError('repository restore is unavailable.');
            }
            return repository.restoreQuestion(id);
        };

        return Object.freeze({
            filterAndSort,
            query,
            paginate,
            selectBatch,
            detectDuplicate: (candidate, items) =>
                detectDuplicate(candidate, items, fingerprint),
            metadataQuery,
            softDelete,
            restore
        });
    };

    return Object.freeze({
        stableSort,
        collectKnowledgeNames,
        paginate,
        selectBatch,
        detectDuplicate,
        metadataQuery,
        createLibraryService
    });
});
