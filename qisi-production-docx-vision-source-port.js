(function initProductionDocxVisionSourcePort(root, factory) {
    const contract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(contract);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionDocxVisionSourcePort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
    'use strict';

    const fail = code => {
        const error = new Error(code);
        error.code = code;
        error.stage = 'production-docx-vision-shadow';
        return error;
    };
    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const error = fail('DOCX_VISION_SHADOW_CANCELLED');
        error.name = 'AbortError';
        throw error;
    };

    async function runDocxVisionShadow(input = {}, ports = {}) {
        if (input.shadow !== true) throw fail('DOCX_VISION_SHADOW_REQUIRED');
        if (
            !isRecord(input.source) ||
            String(input.source.fileType || input.source.format || '').toLowerCase() !== 'docx'
        ) throw fail('DOCX_VISION_SHADOW_SOURCE_INVALID');
        if (
            typeof ports.runVisionProducer !== 'function' ||
            typeof contract?.projectDocxVisionCandidate !== 'function'
        ) throw fail('DOCX_VISION_SHADOW_PORT_REQUIRED');
        assertActive(input.signal);
        const result = await ports.runVisionProducer({
            source: input.source,
            engineContext: input.engineContext || {},
            shadow: true,
            signal: input.signal
        });
        assertActive(input.signal);
        if (
            !isRecord(result) || !Array.isArray(result.candidates) ||
            !Array.isArray(result.controlledWriteDecisions) ||
            result.candidates.length !== result.controlledWriteDecisions.length
        ) throw fail('DOCX_VISION_SHADOW_RESULT_MALFORMED');
        const drafts = result.candidates.map((candidate, index) =>
            contract.projectDocxVisionCandidate({
                candidate,
                source: {
                    sourceId: input.source.sourceId || input.source.id,
                    format: 'docx',
                    filename: input.source.filename || '',
                    mimeType: input.source.mimeType || '',
                    sourceOrder: Number.isInteger(input.source.sourceOrder)
                        ? input.source.sourceOrder : 0
                },
                engine: result.engine,
                page: candidate.sourcePage || candidate.pageIndex || 0,
                blockIds: candidate.blockIds || candidate.sourceTrace?.blockIds || [],
                controlledWriteDecision: result.controlledWriteDecisions[index]
            })
        );
        if (drafts.some(draft => draft.canonicalReviewHandoff !== true)) {
            throw fail('DOCX_VISION_SHADOW_HANDOFF_REJECTED');
        }
        return Object.freeze({
            schemaVersion: 'qisi.docx-vision-shadow.r1',
            shadow: true,
            drafts: Object.freeze(drafts),
            formalWrites: 0,
            reviewDraftWrites: 0,
            realApiCalled: false,
            diagnostics: Object.freeze({
                producer: 'shared-docx-producer-identity-contract',
                candidateCount: drafts.length
            })
        });
    }

    return Object.freeze({ runDocxVisionShadow });
});
