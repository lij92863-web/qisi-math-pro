(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrReadingOrder = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STRATEGY = Object.freeze([
        'page',
        'column-region',
        'question-anchor',
        'adjacency',
        'source-order'
    ]);
    const EXCLUDED_TYPES = new Set(['header', 'footer']);

    const invalidBlock = (block, field) => {
        const error = new TypeError(`OCR block has invalid ${field}.`);
        error.code = 'invalid-block-contract';
        error.blockId = typeof block?.id === 'string' ? block.id : '';
        error.field = field;
        return error;
    };

    const validateBlock = block => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
            throw invalidBlock(block, '$');
        }
        if (typeof block.id !== 'string' || !block.id.trim()) throw invalidBlock(block, 'id');
        if (!Number.isInteger(block.page) || block.page < 1) throw invalidBlock(block, 'page');
        if (!Array.isArray(block.bbox) || block.bbox.length !== 4 ||
            block.bbox.some(value => !Number.isFinite(value)) ||
            block.bbox[2] < block.bbox[0] || block.bbox[3] < block.bbox[1]) {
            throw invalidBlock(block, 'bbox');
        }
        if (!Number.isInteger(block.column) || block.column < 0) throw invalidBlock(block, 'column');
        if (!Number.isInteger(block.order) || block.order < 0) throw invalidBlock(block, 'order');
        if (typeof block.type !== 'string' || !block.type.trim()) throw invalidBlock(block, 'type');
        if (typeof block.rawText !== 'string') throw invalidBlock(block, 'rawText');
        if (block.confidence !== null && (
            !Number.isFinite(block.confidence) || block.confidence < 0 || block.confidence > 1
        )) {
            throw invalidBlock(block, 'confidence');
        }
        return block;
    };

    const cloneBlock = block => Object.freeze({
        ...block,
        bbox: Object.freeze([...block.bbox])
    });

    const yStart = block => block.bbox[1];
    const xStart = block => block.bbox[0];
    const yCenter = block => (block.bbox[1] + block.bbox[3]) / 2;

    const spatialThenSource = (left, right) =>
        yStart(left) - yStart(right) ||
        xStart(left) - xStart(right) ||
        left.order - right.order ||
        left.id.localeCompare(right.id);

    const assignAnchorGroup = blocks => {
        const anchors = blocks
            .filter(block => block.type === 'question-anchor')
            .sort(spatialThenSource);
        return blocks.map(block => {
            let anchorGroup = -1;
            for (let index = 0; index < anchors.length; index += 1) {
                if (yCenter(anchors[index]) <= yCenter(block)) anchorGroup = index;
                else break;
            }
            return { block, anchorGroup };
        });
    };

    const withinColumn = (left, right) =>
        left.anchorGroup - right.anchorGroup ||
        Number(right.block.type === 'question-anchor') -
            Number(left.block.type === 'question-anchor') ||
        spatialThenSource(left.block, right.block);

    const orderBlocks = input => {
        if (!Array.isArray(input)) throw invalidBlock(null, '$');
        const validated = input.map(validateBlock);
        const seen = new Set();
        for (const block of validated) {
            const identity = `${block.page}::${block.id}`;
            if (seen.has(identity)) throw invalidBlock(block, 'duplicate-id');
            seen.add(identity);
        }

        const excluded = validated
            .filter(block => EXCLUDED_TYPES.has(block.type))
            .sort((left, right) => left.page - right.page || spatialThenSource(left, right));
        const content = validated.filter(block => !EXCLUDED_TYPES.has(block.type));
        const pages = [...new Set(content.map(block => block.page))].sort((a, b) => a - b);
        const ordered = [];
        for (const page of pages) {
            const pageBlocks = content.filter(block => block.page === page);
            const columns = [...new Set(pageBlocks.map(block => block.column))].sort((a, b) => a - b);
            for (const column of columns) {
                const columnBlocks = pageBlocks.filter(block => block.column === column);
                ordered.push(...assignAnchorGroup(columnBlocks).sort(withinColumn).map(row => row.block));
            }
        }

        const orderedBlocks = ordered.map((block, index) => Object.freeze({
            ...cloneBlock(block),
            readingOrder: index + 1
        }));
        const excludedBlocks = excluded.map(block => Object.freeze({
            ...cloneBlock(block),
            exclusionReason: 'non-content-region'
        }));
        const warnings = excludedBlocks.map(block => Object.freeze({
            code: 'non-content-region-excluded',
            blockId: block.id,
            page: block.page
        }));

        return Object.freeze({
            orderedBlocks: Object.freeze(orderedBlocks),
            excludedBlocks: Object.freeze(excludedBlocks),
            warnings: Object.freeze(warnings),
            strategy: STRATEGY
        });
    };

    return Object.freeze({ STRATEGY, validateBlock, orderBlocks });
});
