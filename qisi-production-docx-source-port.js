(function initProductionDocxSourcePort(root) {
    'use strict';

    function createError(code, name = 'Error') {
        const error = new Error(code);
        error.name = name;
        error.code = code;
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('DOCX_SOURCE_ABORTED', 'AbortError');
    }

    async function parseDocxSource(input = {}, ports = {}) {
        const source = input.source;
        if (
            !source || String(source.id || '').trim().length === 0 ||
            String(source.fileType || '').toLowerCase() !== 'docx'
        ) throw createError('DOCX_SOURCE_INVALID');
        if (
            typeof ports.importer?.parseDocxFile !== 'function' ||
            typeof ports.convertDraft !== 'function' ||
            typeof ports.acceptDraft !== 'function'
        ) throw createError('DOCX_SOURCE_PORT_REQUIRED');

        assertActive(input.signal);
        const result = await ports.importer.parseDocxFile(source, {
            batch: input.batch,
            defaultMeta: input.defaultMeta || {},
            helpers: input.importerHelpers || {}
        });
        assertActive(input.signal);
        if (!result || typeof result !== 'object' || !Array.isArray(result.drafts)) {
            throw createError('DOCX_SOURCE_RESULT_MALFORMED');
        }

        const convertedDrafts = result.drafts.map(ports.convertDraft);
        const drafts = convertedDrafts.filter((draft, index, allDrafts) =>
            draft && typeof draft === 'object' &&
            ports.acceptDraft(draft, index, allDrafts) === true
        );
        assertActive(input.signal);
        return {
            drafts,
            draftImages: Array.isArray(result.draftImages) ? result.draftImages : [],
            unmatchedAnswers: Array.isArray(result.unmatchedAnswers)
                ? result.unmatchedAnswers
                : [],
            warnings: Array.isArray(result.warnings) ? result.warnings : []
        };
    }

    const api = Object.freeze({ parseDocxSource });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionDocxSourcePort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
