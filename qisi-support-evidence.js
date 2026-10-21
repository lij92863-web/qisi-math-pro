(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.SupportEvidence = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Evidence is a set, not a last-writer register. A rejected empty field is
    // distinct from a field for which no declaration has ever been observed.
    const aggregate = (previous, additions = [], { blocked = false } = {}) => {
        const declarations = new Map();
        for (const item of [...(previous?.declarations || []), ...additions]) {
            const value = String(item.value ?? '').trim();
            if (!value) continue;
            const row = {
                sourceId: String(item.sourceId || ''),
                sourceName: String(item.sourceName || ''),
                evidenceRef: String(item.evidenceRef || ''),
                range: Array.isArray(item.range) ? [...item.range] : null,
                value
            };
            declarations.set(JSON.stringify(row), row);
        }
        const rows = [...declarations.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
            .map(([, row]) => row);
        const values = [...new Set(rows.map(row => row.value))].sort();
        const conflict = blocked || previous?.state === 'conflict' || values.length > 1;
        return {
            state: conflict ? 'conflict' : values.length ? 'unique' : 'missing',
            value: !conflict && values.length ? values[0] : '',
            values,
            declarations: rows
        };
    };
    return Object.freeze({ aggregate });
});
