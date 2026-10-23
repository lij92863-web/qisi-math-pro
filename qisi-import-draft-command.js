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

    // Bind current PDF source reads/evidence to the same repository boundary as
    // import draft commands. The producer and its protocol/transport stay intact.
    const createPdfProducer = ({ producer, storage, renderPages, getRoles, clock = Date.now } = {}) => {
        for (const port of [producer?.createProducer, storage?.findBy, storage?.put, renderPages, getRoles, clock]) {
            if (typeof port !== 'function') {
                const error = new Error('IMPORT_DRAFT_COMMAND_SOURCE_PORT_REQUIRED');
                error.code = 'IMPORT_DRAFT_COMMAND_SOURCE_PORT_REQUIRED'; throw error;
            }
        }
        return producer.createProducer({
            renderPages, getRoles,
            getExistingDrafts: batchId => storage.findBy('draftQuestions', 'batchId', batchId),
            persistSourceEvidence: (file, evidence) => storage.put('draftImportFiles', {
                ...file, pdfMineruEvidence: evidence, updatedAt: clock()
            })
        });
    };

    return Object.freeze({ evidenceFieldFor, filePatchFor, buildPersistReviewDraftBatchCall, createPdfProducer });
});
