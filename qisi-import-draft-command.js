(function initImportDraftCommand(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ImportDraftCommand = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Bridge -> persistence mapping for one import batch. This is the only place
    // that knows how PDF evidence and warnings travel into the stored files.
    const EVIDENCE_FIELD = Object.freeze({
        'pdf-mineru-v1': 'pdfMineruEvidence',
        'pdf-external-v2': 'pdfExternalEvidence'
    });

    const evidenceFieldFor = protocol => EVIDENCE_FIELD[protocol] || 'pdfV1Evidence';

    const filePatchFor = ({ file, command }) => {
        const evidence = command.pdfEvidence;
        const patch = { ...file };
        if (evidence) {
            patch[evidenceFieldFor(evidence.protocol)] = {
                ...evidence,
                tasks: evidence.tasks?.filter(item => item.sourceId === file.id),
                unassigned: evidence.unassigned?.filter(item => item.source_id === file.id)
            };
            patch.parseStatus = evidence.errors.some(item => item.sourceId === file.id) ? 'partial' : 'success';
        } else {
            patch.parseStatus = 'success';
        }
        patch.errorMessage = '';
        patch.updatedAt = command.batchPatch.updatedAt;
        return patch;
    };

    const buildPersistReviewDraftBatchCall = ({ command, persist } = {}) => {
        if (!command || typeof persist !== 'function') {
            const error = new Error('IMPORT_DRAFT_COMMAND_SERVICE_REQUIRED');
            error.code = 'IMPORT_DRAFT_COMMAND_SERVICE_REQUIRED';
            throw error;
        }
        return persist({
            batchId: command.batchId,
            drafts: command.drafts,
            images: command.images,
            files: command.sourceFiles.map(file => filePatchFor({ file, command })),
            batchPatch: {
                ...command.batchPatch,
                importWarnings: command.warnings,
                unmatchedAnswers: command.unmatched
            },
            idempotencyKey: command.idempotencyKey,
            expectedVersion: command.expectedVersion,
            signal: command.signal
        });
    };

    return Object.freeze({ evidenceFieldFor, filePatchFor, buildPersistReviewDraftBatchCall });
});
