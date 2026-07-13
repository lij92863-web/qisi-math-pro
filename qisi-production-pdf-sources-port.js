(function initProductionPdfSourcesPort(root) {
    'use strict';

    function createError(code, name = 'Error') {
        const error = new Error(code);
        error.name = name;
        error.code = code;
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('PDF_SOURCES_ABORTED', 'AbortError');
    }

    async function processPdfSources(input = {}, ports = {}) {
        const batch = input.batch;
        const sources = Array.isArray(input.sources) ? input.sources : [];
        const sourceIds = sources.map(source => String(source?.id || '').trim());
        if (
            !batch || !String(batch.id || '').trim() || sources.length === 0 ||
            sourceIds.some(id => !id) || new Set(sourceIds).size !== sources.length ||
            sources.some(source =>
                String(source?.fileType || '').toLowerCase() !== 'pdf' ||
                (source.batchId && String(source.batchId) !== String(batch.id))
            )
        ) throw createError('PDF_SOURCES_INVALID');
        if (typeof ports.engine?.processBatchV2 !== 'function') {
            throw createError('PDF_SOURCES_PORT_REQUIRED');
        }
        if (typeof ports.buildProjectionContext !== 'function') {
            throw createError('PDF_SOURCES_PROJECTION_PORT_REQUIRED');
        }

        assertActive(input.signal);
        const result = await ports.engine.processBatchV2({
            batch,
            files: sources,
            helpers: {
                ...(input.helpers || {}),
                deferPdfCandidateProjection: true,
                pdfSignal: input.signal,
                onPdfPageProgress: input.onPageProgress
            }
        });
        assertActive(input.signal);
        if (!result || typeof result !== 'object' || !Array.isArray(result.drafts)) {
            return result;
        }
        const projectionContext = ports.buildProjectionContext({
            sources,
            engineResult: result,
            batch
        });
        if (!projectionContext || typeof projectionContext !== 'object') {
            throw createError('PDF_SOURCES_PROJECTION_CONTEXT_INVALID');
        }
        return { ...result, projectionContext };
    }

    const api = Object.freeze({ processPdfSources });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionPdfSourcesPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
