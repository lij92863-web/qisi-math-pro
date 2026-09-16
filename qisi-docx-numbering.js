(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxNumbering = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const val = (xml, tag) => String(xml).match(new RegExp(`<w:${tag}\\b[^>]*w:val=["']([^"']+)["']`))?.[1];
    // Support only proved, single-level decimal labels. Unsupported styles are evidence gaps,
    // never a reason to invent a question number from the paragraph's position.
    const expand = (documentXml, numberingXml = '') => {
        const abstracts = new Map();
        const numbers = new Map();
        const counts = new Map();
        const evidence = [];
        for (const match of numberingXml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
            const levels = [...match[2].matchAll(/<w:lvl\b[^>]*w:ilvl=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:lvl>/g)];
            if (levels.length !== 1 || levels[0][1] !== '0') continue;
            const body = levels[0][2];
            if (val(body, 'numFmt') !== 'decimal' || !/^%1[.．、]$/.test(val(body, 'lvlText') || '')) continue;
            abstracts.set(match[1], { start: Number(val(body, 'start') || 1), label: val(body, 'lvlText') });
        }
        for (const match of numberingXml.matchAll(/<w:num\b[^>]*w:numId=["'](\d+)["'][^>]*>([\s\S]*?)<\/w:num>/g)) {
            const definition = abstracts.get(val(match[2], 'abstractNumId'));
            if (!definition || /<w:lvl\b/.test(match[2])) continue;
            numbers.set(match[1], { ...definition, start: Number(val(match[2], 'startOverride') || definition.start) });
        }
        let paragraph = 0;
        const xml = String(documentXml).replace(/<w:p(?=[\s>])[\s\S]*?<\/w:p>/g, p => {
            const index = paragraph++;
            const properties = p.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/)?.[0] || '';
            const numPr = properties.match(/<w:numPr\b[\s\S]*?<\/w:numPr>/)?.[0];
            if (!numPr) return p;
            const id = val(numPr, 'numId');
            const definition = numbers.get(id);
            if (!definition || (val(numPr, 'ilvl') || '0') !== '0') {
                evidence.push({ paragraph: index, numId: id, status: 'unresolved' });
                return p;
            }
            const value = counts.has(id) ? counts.get(id) + 1 : definition.start;
            counts.set(id, value);
            evidence.push({ paragraph: index, numId: id, value, status: 'extracted' });
            const label = definition.label.replace('%1', String(value));
            return p.replace(properties, `${properties}<w:r><w:t xml:space="preserve">${label} </w:t></w:r>`);
        });
        return { xml, evidence };
    };
    return { expand };
});
