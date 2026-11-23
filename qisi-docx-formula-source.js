(function (root, factory) {
    const api = factory(root,
        typeof module !== 'undefined' && module.exports ? require('./qisi-docx-ole-reader.js') : root.Qisi.DocxOleReader,
        typeof module !== 'undefined' && module.exports ? require('./qisi-docx-mtef-reader.js') : root.Qisi.DocxMtefReader);
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxFormulaSource = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, ole, reader) {
    'use strict';
    const attr = (xml, name) => xml.match(new RegExp('\\b' + name + '=["\']([^"\']+)["\']'))?.[1] || '';
    const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const base64 = bytes => {
        if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return root.btoa(binary);
    };
    function extractMtefFromWmf(bytes) {
        const signature = [65, 112, 112, 115, 77, 70, 67]; // AppsMFC MathType comment.
        const offset = bytes.findIndex((_, i) => signature.every((b, j) => bytes[i + j] === b));
        if (offset < 0 || offset + 18 >= bytes.length) return new Uint8Array();
        const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset + 14, true);
        let start = offset + 18;
        while (start < bytes.length && bytes[start]) start++;
        start++;
        if (!size || start + size > bytes.length || bytes[start] !== 5) return new Uint8Array();
        return bytes.slice(start, start + size);
    }
    function normalizeLatex(value) {
        let latex = String(value || '').trim();
        if (/^\$\$[\s\S]*\$\$$/.test(latex)) latex = latex.slice(2, -2).trim();
        else if (/^\$[\s\S]*\$$/.test(latex)) latex = latex.slice(1, -1).trim();
        else if (/^\\\[[\s\S]*\\\]$|^\\\([\s\S]*\\\)$/.test(latex)) latex = latex.slice(2, -2).trim();
        if (!latex || /[\u0000-\u0008\u000b-\u001f]/.test(latex)) return '';
        try { if (root.katex) root.katex.renderToString(latex, { throwOnError: true, strict: 'ignore' }); }
        catch { return ''; }
        return latex;
    }
    async function expand(documentXml, relationships, zip, options = {}) {
        const objects = [...documentXml.matchAll(/<w:object\b[\s\S]*?<\/w:object>/g)];
        const equations = new Map(), links = [];
        for (const match of objects) {
            const object = match[0], tag = object.match(/<o:OLEObject\b[^>]*>/)?.[0] || '';
            const rid = attr(tag, 'r:id'), preview = attr(object.match(/<v:imagedata\b[^>]*>/)?.[0] || '', 'r:id');
            if (!/^Equation(?:\.|$)/i.test(attr(tag, 'ProgID'))) continue;
            const id = rid || preview;
            if (!id) continue;
            links.push({ xml: object, id });
            if (equations.has(id)) continue;
            let mtef = new Uint8Array(), source = 'ole-equation-native';
            const entry = zip.file(relationships.get(rid)?.target || '');
            try { if (entry) mtef = ole.extractMtefFromOle(await entry.async('uint8array')); }
            catch { /* An unreadable container may still carry a valid WMF equation preview. */ }
            if (!mtef.length) {
                const image = zip.file(relationships.get(preview)?.target || '');
                if (image) mtef = extractMtefFromWmf(await image.async('uint8array'));
                source = 'wmf-mtef';
            }
            equations.set(id, { id, mtef, source });
        }
        const payload = [...equations.values()].filter(row => row.mtef.length)
            .map(row => ({ id: row.id, mtefBase64: base64(row.mtef) }));
        // Identical MTEF bytes with this fixed translator have the same native result.
        const unique = new Map(), aliases = new Map();
        for (const row of payload) {
            const first = unique.get(row.mtefBase64);
            if (first) aliases.set(row.id, first.id);
            else unique.set(row.mtefBase64, row);
        }
        const nativePayload = [...unique.values()];
        let nativeRows = [];
        const nativeFailures = new Map();
        if (nativePayload.length) {
                const translate = options.translateNative || (async rows => {
                    const response = await root.fetch('/api/convert/mathtype-mtef', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ equations: rows }), signal: options.signal });
                    if (!response.ok) throw new Error('MATHTYPE_LOCAL_SERVICE_UNAVAILABLE');
                    return response.json();
                });
                // Each bounded batch retains relationship IDs; results are never zipped by position.
                for (let i = 0; i < nativePayload.length; i += 512) {
                    const batch = nativePayload.slice(i, i + 512);
                    try {
                        const response = await translate(batch);
                        const ids = new Set(batch.map(row => row.id)), seen = new Set();
                        if (!Array.isArray(response?.equations)) throw new Error('MATHTYPE_RESPONSE_ID_MISMATCH');
                        for (const row of response.equations) {
                            if (!ids.has(row.id) || seen.has(row.id)) throw new Error('MATHTYPE_RESPONSE_ID_MISMATCH');
                            seen.add(row.id);
                        }
                        nativeRows.push(...response.equations);
                        for (const row of batch) if (!seen.has(row.id)) nativeFailures.set(row.id, 'MATHTYPE_RESPONSE_ITEM_MISSING');
                    } catch (error) {
                        if (options.signal?.aborted) throw error;
                        const code = /^MATHTYPE_[A-Z0-9_]{1,64}$/.test(error?.code || error?.message || '')
                            ? error.code || error.message : 'MATHTYPE_NATIVE_BATCH_FAILED';
                        for (let j = i; j < nativePayload.length; j++) nativeFailures.set(nativePayload[j].id,
                            j >= i + batch.length ? 'MATHTYPE_NATIVE_NOT_ATTEMPTED' : code);
                        break;
                    }
                }
        }
        const native = new Map(nativeRows.map(row => [row.id, row])), formulas = [];
        for (const [id, original] of aliases) {
            if (native.has(original)) native.set(id, {...native.get(original), id});
            if (nativeFailures.has(original)) nativeFailures.set(id, nativeFailures.get(original));
        }
        for (const equation of equations.values()) {
            const local = reader.classifyMtef(equation.mtef), row = native.get(equation.id);
            const knownConflict = local.code === 'MTEF_PREVIEW_CONFLICT';
            const nativeLatex = !knownConflict && row?.ok === true ? normalizeLatex(row.latex) : '';
            const fallback = !knownConflict && local.status === 'extracted' ? normalizeLatex(local.latex) : '';
            const latex = nativeLatex || fallback;
            const nativeCode = nativeLatex ? 'MATHTYPE_LATEX_OK' : (nativeFailures.get(equation.id) ||
                (!equation.mtef.length ? 'MATHTYPE_SOURCE_BYTES_MISSING' : knownConflict ? 'MTEF_PREVIEW_CONFLICT' :
                    row ? (String(row.code || '').trim() || 'MATHTYPE_NATIVE_ITEM_REJECTED') : 'MATHTYPE_RESPONSE_ITEM_MISSING'));
            formulas.push({ rid: equation.id, source: equation.source, status: latex ? 'extracted' : 'unresolved',
                engine: nativeLatex ? 'mathtype-native' : 'javascript-mtef', latex,
                code: latex ? (nativeLatex ? 'MATHTYPE_LATEX_OK' : local.code) : local.code,
                // A formula the native service refused keeps that refusal next to the
                // local reader's own code; neither reason is overwritten by the other.
                nativeCode,
                nativeEvidence: { status: nativeLatex ? 'extracted' : 'unresolved', code: nativeCode },
                mtefBase64: base64(equation.mtef) });
        }
        const byId = new Map(formulas.map(row => [row.rid, row]));
        const byObject = new Map(links.map(link => [link.xml, link.id]));
        const xml = documentXml.replace(/<w:object\b[\s\S]*?<\/w:object>/g, object => {
            if (!byObject.has(object)) return object;
            const id = byObject.get(object), formula = byId.get(id);
            const text = formula.latex ? ` $${formula.latex}$ ` : ` [DOCX不可显示图片:公式:${id}] `;
            return `<w:t xml:space="preserve">${escapeXml(text)}</w:t>`;
        });
        return { xml, formulas };
    }
    return Object.freeze({ expand, extractMtefFromWmf, normalizeLatex });
});
