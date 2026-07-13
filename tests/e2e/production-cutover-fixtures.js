const DocxIdentity = require('../../qisi-docx-producer-identity-contract.js');
const PdfProjection = require('../../qisi-pdf-candidate-projection.js');
const ControlledWrite = require('../../qisi-pdf-support-controlled-write.js');

const fields = [
    'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
];

function docxVisionCandidate(overrides = {}) {
    const sourceId = overrides.sourceId || 'docx-question';
    const candidate = {
        id: overrides.id || 'docx-vision-draft-1',
        questionNumber: overrides.questionNumber || '1',
        type: 'choice',
        stem: overrides.stem || 'Which DOCX producer statement is correct?',
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        answer: 'A',
        solution: 'The producer-time evidence selects Alpha.',
        images: [],
        warnings: [],
        ...overrides
    };
    delete candidate.sourceId;
    return DocxIdentity.projectDocxVisionCandidate({
        candidate,
        source: {
            sourceId, format: 'docx', filename: `${sourceId}.docx`,
            mimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceOrder: 1
        },
        engine: 'c2-11-browser-mock',
        page: 1,
        blockIds: [`${sourceId}:page:1:candidate:1`],
        controlledWriteDecision: {
            accepted: true,
            decisionId: `strict-docx:${sourceId}:1`,
            fields,
            sourceId,
            engine: 'c2-11-browser-mock',
            method: 'strict-json-contract'
        }
    });
}

function docxVisionWithSupportCandidate() {
    const base = DocxIdentity.projectDocxVisionCandidate({
        candidate: {
            id: 'docx-vision-support-draft-1', questionNumber: '1',
            type: 'choice', stem: 'Which supported DOCX statement is correct?',
            options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
            answer: '', solution: 'The question producer supplied this proof.',
            images: []
        },
        source: {
            sourceId: 'docx-question', format: 'docx',
            filename: 'question.docx',
            mimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceOrder: 1
        },
        engine: 'c2-11-browser-mock', page: 1,
        blockIds: ['docx-question:page:1:candidate:1'],
        controlledWriteDecision: {
            accepted: true, decisionId: 'strict-docx:question:1',
            fields: ['questionNumber', 'stem', 'options', 'solution', 'images'],
            sourceId: 'docx-question', engine: 'c2-11-browser-mock',
            method: 'strict-json-contract'
        }
    });
    return DocxIdentity.applyDocxVisionSupportField({
        candidate: base,
        field: 'answer',
        support: {
            answer: 'A', sourcePage: 1,
            sourceTrace: { blockIds: ['docx-answer:page:1:answer:1'] }
        },
        source: {
            sourceId: 'docx-answer', format: 'docx',
            filename: 'answer.docx',
            mimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sourceOrder: 2
        },
        controlledWriteDecision: {
            accepted: true, acceptedFields: ['answer'],
            decisionId: 'strict-docx-support:answer:1',
            sourceId: 'docx-answer', engine: 'c2-11-browser-mock',
            method: 'strict-json-contract'
        }
    });
}

function pdfCandidate({
    id = 'pdf-draft-1', questionNumber = '1', includeAnswer = true,
    includeSolution = true, ownershipValid = true, formulaFallback = false,
    alignmentMode = 'full'
} = {}) {
    const parsedQuestion = {
        id,
        questionNumber,
        type: 'choice',
        stem: `Prove the PDF production statement ${questionNumber}.`,
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        answer: '', solution: '',
        images: [{ id: `pdf-question-image-${questionNumber}` }],
        sourceQuestionFileId: 'pdf-question',
        sourceTrace: {
            sourceFileId: 'pdf-question', sourcePage: 1,
            sourceKind: 'ocrMarkdown',
            strictProtocol: {
                accepted: true,
                decisionId: `strict-pdf:pdf-question:${questionNumber}`,
                fields: ['questionNumber', 'stem', 'options', 'images'],
                method: 'strict-json-contract'
            }
        }
    };
    const controlledWriteDecision = {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [parsedQuestion],
            parserSafeAnswerItems: includeAnswer ? [{
                questionNumber, answer: 'A',
                evidenceId: `answer-evidence-${questionNumber}`,
                sourceTrace: {
                    page: 2, blockIds: [`answer-block-${questionNumber}`]
                }
            }] : [],
            parserSafeSolutionItems: includeSolution ? [{
                questionNumber,
                solution: `Controlled solution ${questionNumber}.`,
                evidenceId: `solution-evidence-${questionNumber}`,
                sourceTrace: {
                    page: 2, blockIds: [`solution-block-${questionNumber}`]
                }
            }] : []
        }),
        decisionId: `pdf-controlled-write:${questionNumber}`
    };
    return PdfProjection.projectPdfCandidate({
        source: {
            sourceId: 'pdf-question', sourceType: 'pdf', sourceOrder: 1,
            filename: 'question.pdf', mimeType: 'application/pdf'
        },
        engineResult: {
            sourceKind: 'ocrMarkdown', engine: 'c2-11-browser-mock',
            strictProtocol: parsedQuestion.sourceTrace.strictProtocol
        },
        parsedQuestion,
        alignmentResult: {
            mode: alignmentMode,
            safeQuestionNumbers: ownershipValid ? [questionNumber] : [],
            fusedQuestionNumbers: ownershipValid ? [] : [questionNumber],
            warnings: ownershipValid ? [] : [{ code: 'wrong-ownership' }]
        },
        controlledWriteDecision,
        evidence: {
            fields: Object.fromEntries(fields.map(field => [field, {
                page: field === 'answer' || field === 'solution' ? 2 : 1,
                blockIds: [`${field}-block-${questionNumber}`]
            }])),
            formulaFallback,
            rawEvidenceRefs: [{ evidenceId: `pdf-question-${questionNumber}` }]
        },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true,
            sequenceValid: true,
            ownershipValid
        }
    });
}

module.exports = {
    docxVisionCandidate,
    docxVisionWithSupportCandidate,
    pdfCandidate
};
