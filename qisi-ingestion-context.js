(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.IngestionContext = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const contexts = new WeakMap();
    const now = () => root.performance?.now?.() ?? Date.now();

    const withTimeout = async (work, timeoutMs, code, cancel = () => {}) => {
        let timer;
        try {
            return await Promise.race([
                Promise.resolve().then(work),
                new Promise((_, reject) => {
                    timer = setTimeout(() => {
                        const error = new Error(code);
                        error.code = code;
                        reject(error);
                        try { Promise.resolve(cancel()).catch(() => {}); } catch (_) { /* best effort */ }
                    }, timeoutMs);
                })
            ]);
        } finally { clearTimeout(timer); }
    };

    const createTrace = (sourceId = '') => {
        const stages = [];
        const measure = async (stage, work, inputCount = 1) => {
            const start = now();
            const record = { stage, start, end: null, durationMs: null, inputCount, outputCount: 0, errorCode: '' };
            stages.push(record);
            try {
                const result = await work();
                record.outputCount = Array.isArray(result) ? result.length : result == null ? 0 : 1;
                return result;
            } catch (error) {
                record.errorCode = error.code || error.name || 'INTERNAL_ERROR';
                throw error;
            } finally {
                record.end = now();
                record.durationMs = Math.round((record.end - start) * 100) / 100;
            }
        };
        return { sourceId, stages, measure };
    };

    // The file object is scoped to one import, so a later import cannot inherit stale evidence.
    // Pending promises are cached too: concurrent consumers cannot unzip the same file twice.
    const getDocx = (file, deps = {}) => {
        const cached = contexts.get(file);
        if (cached?.uploadPath === file.uploadPath) return cached.promise;
        const trace = createTrace(file.id || '');
        const promise = (async () => {
            const buffer = await trace.measure('read', () => withTimeout(async () => {
                if (deps.read) return deps.read(file);
                return (await root.fetch(file.uploadPath)).arrayBuffer();
            }, 15000, 'DOCX_READ_TIMEOUT'));
            const zip = await trace.measure('unzip', () => (deps.load || ((value) =>
                root.Qisi.ArchiveSecurity.load(root.JSZip, value, 'office-document', {
                    name: file.filename || file.name || 'document.docx', type: file.mime || ''
                })))(buffer));
            const rawDocumentXml = await trace.measure('document-xml', () => zip.file('word/document.xml')?.async('string'));
            if (!rawDocumentXml) throw Object.assign(new Error('DOCX missing word/document.xml'), { code: 'DOCX_XML_MISSING' });
            const numberingXml = await zip.file('word/numbering.xml')?.async('string') || '';
            const numbering = root.Qisi.DocxNumbering?.expand(rawDocumentXml, numberingXml);
            const documentXml = numbering?.xml || rawDocumentXml;
            const relsXml = await trace.measure('relationships', async () =>
                await zip.file('word/_rels/document.xml.rels')?.async('string') || '');
            let olePromise;
            const getOleBytes = () => olePromise ||= trace.measure('ole', async () => {
                const result = new Map();
                const relationships = root.Qisi.DocxPipeline.parseDocxRelationshipMap(relsXml);
                for (const [rid, rel] of relationships) {
                    if (!/embeddings\//i.test(rel.target || '')) continue;
                    const entry = zip.file(rel.target.replace(/^\/+/, ''));
                    if (entry) result.set(rid, new Uint8Array(await entry.async('arraybuffer')));
                }
                return result;
            });
            return { zip, documentXml, rawDocumentXml, numberingEvidence: numbering?.evidence || [], relsXml, trace, getOleBytes };
        })();
        contexts.set(file, { uploadPath: file.uploadPath, promise });
        promise.catch(() => { if (contexts.get(file)?.promise === promise) contexts.delete(file); });
        return promise;
    };
    return { withTimeout, createTrace, getDocx };
});
