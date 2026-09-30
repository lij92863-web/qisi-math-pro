(function initQuestionImagePolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.QuestionImagePolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // Display-only: do not overwrite raw URLs stored in draft/source evidence.
    const displayImageUrl = value => {
        if (typeof value !== 'string' || /[\x00-\x1f\x7f\\]/.test(value)) return '';
        const url = value.trim();
        if (!url) return '';
        if (/^data:/i.test(url)) {
            return /^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml|tiff?|x-icon|avif);base64,[A-Za-z0-9+/]*={0,2}$/i.test(url) ? url : '';
        }
        if (/^blob:/i.test(url)) {
            const inner = url.slice(5);
            if (/^null\/[a-z0-9-]+$/i.test(inner)) return url;
            try { const parsed = new URL(inner); return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password ? url : ''; }
            catch { return ''; }
        }
        try {
            const parsed = new URL(url, 'http://qisi.local/');
            return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password ? url : '';
        } catch { return ''; }
    };

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
        displayImageUrl,
        extractGraphicRefs,
        normalizeInlineImageList,
        mergeImageListsById
    });
});
