(function initQuestionImagePolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.QuestionImagePolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const extractGraphicRefs = (text) => [...new Set((String(text || '').match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g) || [])
        .map(token => token.match(/\{([^}]+)\}/)?.[1])
        .filter(Boolean))];

    const normalizeInlineImageList = (images = []) => {
        const rows = Array.isArray(images) ? images : [];
        const seen = new Set();

        return rows
            .filter(img => img && img.id && img.url && img.displayable !== false)
            .filter(img => {
                const key = String(img.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map(img => ({
                id: img.id,
                filename: img.filename || img.name || `${img.id}.png`,
                name: img.name || img.filename || `${img.id}.png`,
                url: img.url,
                align: img.align || 'center',
                source: img.source || '',
                displayable: img.displayable !== false,
                ext: img.ext || '',
                mime: img.mime || '',
                rid: img.rid || '',
                target: img.target || ''
            }));
    };

    const mergeImageListsById = (...lists) => {
        const map = new Map();

        for (const list of lists) {
            for (const img of normalizeInlineImageList(list || [])) {
                if (!map.has(img.id)) map.set(img.id, img);
            }
        }

        return [...map.values()];
    };


    return Object.freeze({
        extractGraphicRefs,
        normalizeInlineImageList,
        mergeImageListsById
    });
});
