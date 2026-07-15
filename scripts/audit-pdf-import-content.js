const fs = require('node:fs');
const path = require('node:path');

const integrity = require('../qisi-pdf-content-integrity.js');

const asText = value => String(value ?? '');
const questionNumberOf = (question, index) => integrity.normalizeQuestionNumber(
    question?.questionNumber || question?.question || question?.order || index + 1
);

const allFieldRows = question => [
    ['stem', question?.stem],
    ...((question?.options || []).map((option, index) => [`option${index}`, option])),
    ['answer', question?.answer],
    ['solution', question?.solution]
];

const auditPdfImportContent = (questions = [], options = {}) => {
    const rows = Array.isArray(questions) ? questions : [];
    const expectedQuestionNumbers = (options.expectedQuestionNumbers || [])
        .map(integrity.normalizeQuestionNumber)
        .filter(Boolean);
    const numberRows = rows.map((question, index) => ({
        question,
        number: questionNumberOf(question, index)
    }));
    const presentNumbers = numberRows.map(row => row.number).filter(Boolean);
    const duplicateQuestionNumbers = [...new Set(
        presentNumbers.filter((number, index, values) => values.indexOf(number) !== index)
    )];

    const audit = {
        missingQuestionNumbers: expectedQuestionNumbers.filter(number => !presentNumbers.includes(number)),
        duplicateQuestionNumbers,
        sectionHeadingInOptions: [],
        duplicateOptionLabels: [],
        foreignTextInOptions: [],
        missingAnswers: [],
        missingAnalyses: [],
        missingStemFigures: [],
        missingAnalysisFigures: [],
        wrongFigureOwners: [],
        contaminatedFigureCrops: [],
        latexSyntaxErrors: [],
        unrenderableLatex: [],
        rawLatexOutsideMathBlocks: [],
        keyboardMathFragments: [],
        rawJsonLeakage: [],
        placeholderLeakage: [],
        ambiguousAlignments: [...(options.ambiguousAlignments || [])],
        controlledWriteRejections: [...(options.controlledWriteRejections || [])]
    };

    const requiredAnswers = new Set(options.expectedAnswerNumbers || expectedQuestionNumbers);
    const requiredAnalyses = new Set(options.expectedAnalysisNumbers || expectedQuestionNumbers);
    const requiredStemFigures = new Set(options.expectedStemFigureNumbers || []);
    const requiredAnalysisFigures = new Set(options.expectedAnalysisFigureNumbers || []);

    numberRows.forEach(({ question, number }) => {
        (question?.options || []).forEach((option, optionIndex) => {
            const text = asText(option).trim();
            if (/^[一二三四五六七八九十]+[、.．]\s*(?:单选|多项选择|填空|解答)题/.test(text)) {
                audit.sectionHeadingInOptions.push({ question: number, optionIndex, text });
            }
            const expectedLabel = String.fromCharCode(65 + optionIndex);
            if (new RegExp(`^${expectedLabel}[.．、:：)）\\s]`, 'i').test(text)) {
                audit.duplicateOptionLabels.push({ question: number, optionIndex, text });
            }
            if (/^\s*\d{1,3}\s*[.．、]/.test(text)) {
                audit.foreignTextInOptions.push({ question: number, optionIndex, text });
            }
        });

        if (requiredAnswers.has(number) && !asText(question?.answer).trim()) {
            audit.missingAnswers.push(number);
        }
        if (requiredAnalyses.has(number) && !asText(question?.solution).trim()) {
            audit.missingAnalyses.push(number);
        }
        if (requiredStemFigures.has(number) && !(question?.images || []).length) {
            audit.missingStemFigures.push(number);
        }
        if (
            requiredAnalysisFigures.has(number) &&
            !(question?.recognizedSolutionImages || question?.solutionImages || []).length
        ) {
            audit.missingAnalysisFigures.push(number);
        }
        if ((question?.warnings || []).some(warning => /归属无法唯一|其他题目区域重叠/.test(warning))) {
            audit.wrongFigureOwners.push(number);
        }
        if ((question?.warnings || []).some(warning => /裁剪.*重叠|污染/.test(warning))) {
            audit.contaminatedFigureCrops.push(number);
        }

        allFieldRows(question).forEach(([field, value]) => {
            const source = asText(value);
            if (!source) return;
            const normalized = integrity.normalizeMathContent(source);
            normalized.issues.forEach(issue => {
                audit.latexSyntaxErrors.push({ question: number, field, ...issue });
            });
            if (normalized.rawLatexOutsideMathBlocks) {
                audit.rawLatexOutsideMathBlocks.push({ question: number, field, source });
            }
            if (/(?:^|[^\\])\b(?:sin|cos|tan)\s+[A-Za-z]|sqrt\s*\(|[∥∠△·°]/.test(source)) {
                audit.keyboardMathFragments.push({ question: number, field, source });
            }
            if (/^\s*[\[{]\s*"(?:questions?|answer|solution|stem)"\s*:/i.test(source)) {
                audit.rawJsonLeakage.push({ question: number, field, source });
            }
            if (/\[object Object\]|\b(?:undefined|null)\b|公式图片待识别|待转换/i.test(source)) {
                audit.placeholderLeakage.push({ question: number, field, source });
            }
        });
    });

    if (typeof options.renderLatex === 'function') {
        numberRows.forEach(({ question, number }) => {
            allFieldRows(question).forEach(([field, value]) => {
                const normalized = integrity.normalizeMathContent(value);
                normalized.richRuns.filter(run => run.kind === 'math').forEach(run => {
                    try {
                        options.renderLatex(run.latex);
                    } catch (error) {
                        audit.unrenderableLatex.push({
                            question: number,
                            field,
                            latex: run.latex,
                            message: error?.message || String(error)
                        });
                    }
                });
            });
        });
    }

    return audit;
};

const auditIssueCount = audit => Object.values(audit || {}).reduce(
    (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
    0
);

if (require.main === module) {
    const inputPath = process.argv[2];
    if (!inputPath) {
        process.stderr.write('Usage: node scripts/audit-pdf-import-content.js <questions.json>\n');
        process.exitCode = 2;
    } else {
        const absolute = path.resolve(inputPath);
        const payload = JSON.parse(fs.readFileSync(absolute, 'utf8'));
        const questions = Array.isArray(payload) ? payload : payload.questions || [];
        const audit = auditPdfImportContent(questions, payload.options || {});
        process.stdout.write(`${JSON.stringify({ audit, issueCount: auditIssueCount(audit) }, null, 2)}\n`);
        if (auditIssueCount(audit)) process.exitCode = 1;
    }
}

module.exports = {
    auditIssueCount,
    auditPdfImportContent
};

