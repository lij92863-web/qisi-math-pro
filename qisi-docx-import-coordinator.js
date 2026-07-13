(function initDocxImportCoordinator(root) {
    'use strict';

    function createError(code, details = {}) {
        const error = new Error(code);
        error.code = code;
        Object.assign(error, details);
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('DOCX_COORDINATOR_ABORTED');
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

    async function runDocxImport(context = {}, commands = {}, signal) {
        const batchId = String(context.batchId || '').trim();
        const sources = Array.isArray(context.sources) ? context.sources : [];
        if (!batchId || sources.length === 0) {
            throw createError('DOCX_COORDINATOR_INVALID_CONTEXT');
        }
        if (sources.some(source => String(source?.fileType || '').toLowerCase() !== 'docx')) {
            throw createError('DOCX_COORDINATOR_NON_DOCX_SOURCE');
        }
        if (new Set(sources.map(source => String(source?.id || ''))).size !== sources.length ||
            sources.some(source => !String(source?.id || '').trim())) {
            throw createError('DOCX_COORDINATOR_INVALID_CONTEXT');
        }
        if (typeof commands.parseSource !== 'function') {
            throw createError('DOCX_COORDINATOR_COMMAND_MISSING');
        }

        const ordered = orderedSources(sources);
        const drafts = [];
        const draftImages = [];
        const warnings = [];
        const candidates = [];
        const reportProgress = typeof commands.reportProgress === 'function'
            ? commands.reportProgress
            : async () => {};
        const report = async (completed, sourceId = '') => {
            const progress = Math.round((completed / ordered.length) * 100);
            try {
                await reportProgress(Object.freeze({
                    batchId,
                    completed,
                    total: ordered.length,
                    progress,
                    sourceId
                }));
            } catch (error) {
                throw createError('DOCX_COORDINATOR_PROGRESS_FAILED', {
                    causeCode: String(error?.code || 'DOCX_PROGRESS_COMMAND_FAILED')
                });
            }
        };

        assertActive(signal);
        await report(0);
        for (let index = 0; index < ordered.length; index += 1) {
            assertActive(signal);
            const source = ordered[index];
            let result;
            try {
                result = await commands.parseSource({
                    batchId,
                    source,
                    sourceIndex: index,
                    candidateOffset: drafts.length,
                    signal
                });
            } catch (error) {
                if (signal?.aborted || error?.code === 'DOCX_COORDINATOR_ABORTED') {
                    throw createError('DOCX_COORDINATOR_ABORTED');
                }
                throw createError('DOCX_COORDINATOR_SOURCE_FAILED', {
                    causeCode: String(error?.code || 'DOCX_SOURCE_COMMAND_FAILED'),
                    sourceId: String(source.id)
                });
            }
            assertActive(signal);

            const sourceDrafts = Array.isArray(result?.drafts) ? result.drafts : [];
            const firstCandidateOrder = drafts.length + 1;
            sourceDrafts.forEach((draft, draftIndex) => {
                candidates.push(Object.freeze({
                    sourceId: String(source.id),
                    sourceOrder: Number.isInteger(source.sourceOrder) ? source.sourceOrder : index,
                    candidateOrder: firstCandidateOrder + draftIndex,
                    draft
                }));
            });
            drafts.push(...sourceDrafts);
            if (Array.isArray(result?.draftImages)) draftImages.push(...result.draftImages);
            if (Array.isArray(result?.warnings)) warnings.push(...result.warnings.map(String));
            await report(index + 1, String(source.id));
        }

        return Object.freeze({
            schemaVersion: 'qisi.docx-import-coordinator.r3',
            batchId,
            orderedSourceIds: Object.freeze(ordered.map(source => String(source.id))),
            candidates: Object.freeze(candidates),
            drafts: Object.freeze(drafts),
            draftImages: Object.freeze(draftImages),
            warnings: Object.freeze(warnings),
            errors: Object.freeze([])
        });
    }

    const api = Object.freeze({ runDocxImport });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.DocxImportCoordinator = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
