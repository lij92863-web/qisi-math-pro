(function initPdfImportCoordinator(root) {
    'use strict';

    function createError(code, details = {}) {
        const error = new Error(code);
        error.code = code;
        Object.assign(error, details);
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('PDF_COORDINATOR_ABORTED');
    }

    function orderedSources(sources) {
        return sources
            .map((source, inputOrder) => ({ source, inputOrder }))
            .sort((left, right) => {
                const leftOrder = Number.isInteger(left.source.sourceOrder)
                    ? left.source.sourceOrder
                    : left.inputOrder;
                const rightOrder = Number.isInteger(right.source.sourceOrder)
                    ? right.source.sourceOrder
                    : right.inputOrder;
                return leftOrder - rightOrder ||
                    Number(left.source.createdAt || 0) - Number(right.source.createdAt || 0) ||
                    String(left.source.id || '').localeCompare(String(right.source.id || ''));
            })
            .map(entry => entry.source);
    }

    async function runPdfImport(context = {}, adapters = {}, signal) {
        const batchId = String(context.batchId || '').trim();
        const batch = context.batch;
        const sources = Array.isArray(context.sources) ? context.sources : [];
        if (!batchId || !batch || String(batch.id || '') !== batchId || sources.length === 0) {
            throw createError('PDF_COORDINATOR_INVALID_CONTEXT');
        }
        if (sources.some(source => String(source?.fileType || '').toLowerCase() !== 'pdf')) {
            throw createError('PDF_COORDINATOR_NON_PDF_SOURCE');
        }
        if (new Set(sources.map(source => String(source?.id || ''))).size !== sources.length ||
            sources.some(source => !String(source?.id || '').trim())) {
            throw createError('PDF_COORDINATOR_INVALID_CONTEXT');
        }
        if (typeof adapters.processSources !== 'function' ||
            typeof adapters.createSafePartial !== 'function') {
            throw createError('PDF_COORDINATOR_ADAPTER_UNAVAILABLE');
        }

        const ordered = orderedSources(sources);
        const sourceIndex = new Map(ordered.map((source, index) => [String(source.id), index]));
        const reportProgress = typeof adapters.reportProgress === 'function'
            ? adapters.reportProgress
            : async () => {};
        let lastProgress = -1;
        const report = async (progress, sourceId = '') => {
            const next = Math.max(lastProgress, Math.max(0, Math.min(100, Math.round(progress))));
            if (next === lastProgress) return;
            lastProgress = next;
            try {
                await reportProgress(Object.freeze({ batchId, progress: next, sourceId }));
            } catch (error) {
                throw createError('PDF_COORDINATOR_PROGRESS_FAILED', {
                    causeCode: String(error?.code || 'PDF_PROGRESS_COMMAND_FAILED')
                });
            }
        };
        const onPageProgress = async (event = {}) => {
            assertActive(signal);
            const id = String(event.sourceId || '');
            const index = sourceIndex.get(id);
            if (index === undefined) throw createError('PDF_COORDINATOR_UNKNOWN_PAGE_SOURCE');
            const totalPages = Math.max(1, Number(event.totalPages || 1));
            const pageNo = Math.max(0, Math.min(totalPages, Number(event.pageNo || 0)));
            await report(((index + (pageNo / totalPages)) / ordered.length) * 90, id);
        };

        assertActive(signal);
        await report(0);
        let result;
        try {
            result = await adapters.processSources({
                batch,
                sources: ordered,
                signal,
                onPageProgress
            });
        } catch (error) {
            if (signal?.aborted || error?.code === 'PDF_COORDINATOR_ABORTED') {
                throw createError('PDF_COORDINATOR_ABORTED');
            }
            if (String(error?.code || '').startsWith('PDF_COORDINATOR_')) throw error;
            throw createError('PDF_COORDINATOR_SOURCE_FAILED', {
                causeCode: String(error?.code || 'PDF_SOURCE_ADAPTER_FAILED')
            });
        }
        assertActive(signal);
        if (!result || typeof result !== 'object' || !Array.isArray(result.drafts)) {
            throw createError('PDF_COORDINATOR_INVALID_RESULT');
        }

        const safePartialCandidates = result.drafts.map((draft, index) => {
            const candidate = adapters.createSafePartial(draft, {
                batchId,
                candidateOrder: index + 1,
                warnings: Array.isArray(result.warnings) ? result.warnings : [],
                errors: Array.isArray(result.errors) ? result.errors : []
            });
            if (!candidate || candidate.isSafePartial !== true || candidate.isComplete !== false) {
                throw createError('PDF_COORDINATOR_UNSAFE_CANDIDATE');
            }
            return Object.freeze({ ...candidate, draft: candidate.draft || draft });
        });
        await report(100);

        return Object.freeze({
            ...result,
            orderedSourceIds: Object.freeze(ordered.map(source => String(source.id))),
            safePartialCandidates: Object.freeze(safePartialCandidates)
        });
    }

    const api = Object.freeze({ runPdfImport });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.PdfImportCoordinator = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
