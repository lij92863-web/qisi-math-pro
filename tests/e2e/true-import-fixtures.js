const fields = ['questionNumber', 'stem', 'options', 'answer', 'solution'];

const deterministicProvenance = sourceId => ({
    ...Object.fromEntries(fields.map(field => [field, {
        status: 'deterministic-source',
        sourceId,
        evidenceRef: `docx:${sourceId}:${field}`
    }])),
    images: { status: 'missing' }
});

const controlledProvenance = sourceId => ({
    ...Object.fromEntries(fields.map(field => [field, {
        status: 'controlled-write',
        sourceId,
        controlledWriteAccepted: true,
        controlledWriteDecisionId: `cw:${sourceId}:${field}`
    }])),
    images: { status: 'missing' }
});

const docxCandidate = (overrides = {}) => ({
    id: 'true_docx_draft_1',
    questionNumber: '1',
    type: '单选题',
    stem: 'True DOCX deterministic stem',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    answer: 'A',
    solution: 'True deterministic solution',
    images: [],
    warnings: [],
    rawText: 'PRIVATE_RAW_EVIDENCE_MUST_NOT_EXPORT',
    source: {
        mode: 'docx-deterministic', sourceId: 'true-docx-1', fileIds: ['ui-docx']
    },
    fieldProvenance: deterministicProvenance('true-docx-1'),
    recognition: null,
    ...overrides
});

const pdfCandidate = (overrides = {}) => ({
    id: 'true_pdf_draft_1',
    questionNumber: '1',
    type: '单选题',
    stem: 'True PDF controlled stem',
    options: ['One', 'Two', 'Three', 'Four'],
    answer: 'A',
    solution: 'True controlled solution',
    images: [],
    warnings: [],
    supportLevel: 'prefix',
    manualReviewRequired: true,
    source: { mode: 'pdf-ai', sourceId: 'true-pdf-1', fileIds: ['ui-pdf'] },
    fieldProvenance: controlledProvenance('true-pdf-1'),
    recognition: null,
    ...overrides
});

module.exports = {
    deterministicProvenance,
    controlledProvenance,
    docxCandidate,
    pdfCandidate
};
