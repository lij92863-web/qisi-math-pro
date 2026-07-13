const { pdfCandidate: productionPdfCandidate } =
    require('./production-cutover-fixtures.js');

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
    type: 'single',
    stem: 'True DOCX deterministic stem',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    answer: 'A',
    solution: 'True deterministic solution',
    images: [],
    warnings: [],
    rawText: 'PRIVATE_RAW_EVIDENCE_MUST_NOT_EXPORT',
    source: {
        mode: 'docx-deterministic', sourceId: 'true-docx-1',
        fileIds: ['ui-docx']
    },
    fieldProvenance: deterministicProvenance('true-docx-1'),
    recognition: null,
    ...overrides
});

const pdfCandidate = (overrides = {}) => ({
    ...productionPdfCandidate({
        id: overrides.id || 'true_pdf_draft_1',
        questionNumber: overrides.questionNumber || '1',
        includeAnswer: false,
        includeSolution: true,
        alignmentMode: 'prefix'
    }),
    recognition: null,
    ...overrides
});

module.exports = {
    deterministicProvenance,
    controlledProvenance,
    docxCandidate,
    pdfCandidate
};
