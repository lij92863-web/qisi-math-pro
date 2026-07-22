const fs = require('node:fs');

const SECTION_HEADING_RE = /^(?:第[一二三四五六七八九十ⅠⅡⅢIVX]+卷|[一二三四五六七八九十]+[、.．]\s*)?(?:单项选择题|多项选择题|选择题|填空题|解答题|计算题|证明题|综合题)(?::|：|$)|^(?:本题|本大题)共\s*\d+\s*(?:小题|题)/u;
const KEYBOARD_MATH_RE = /(?:\d+)?(?:sin|cos|tan)[A-Z]|sqrt\d|triangle[A-Z]{3}|[A-Z](?:[A-Z0-9()+\-*/^]*[=+\-*/^])[A-Z0-9()+\-*/^=]{2,}/g;
const UNWRAPPED_LATEX_RE = /\\(?:frac|sqrt|sin|cos|tan|angle|triangle|vec|overrightarrow|overline|cdot|times|in|pi)\b/g;
const RAW_JSON_RE = /\[object Object\]|```json|"(?:question|stem|answer|solution)"\s*:/i;
const PLACEHOLDER_RE = /公式需要人工复核|图片暂不可预览|MATHPROTECT|@@QISI_MATH_|\b(?:undefined|null)\b/i;
const PUNCTUATION_ONLY_RE = /^[∵∴，,。；;：:\s]+$/u;

const textFields = question => [
    question?.stem,
    ...(Array.isArray(question?.options) ? question.options : []),
    question?.answer,
    question?.solution
].map(value => String(value || ''));

const duplicateValues = values => {
    const seen = new Set();
    const duplicate = new Set();
    for (const value of values) {
        if (seen.has(value)) duplicate.add(value);
        seen.add(value);
    }
    return [...duplicate];
};

const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const solutionReferencesImage = (solution = '', imageId = '') => {
    const source = String(solution || '');
    const id = String(imageId || '');
    if (!id) return false;
    if (source.includes(`[[IMAGE:${id}]]`)) return true;
    return new RegExp(`\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapeRegExp(id)}\\}`).test(source);
};

const mathFreeText = value => String(value || '')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, ' ');

const auditDocxImportContent = (questions = [], options = {}) => {
    const rows = Array.isArray(questions) ? questions : [];
    const expectedQuestionNumbers = (options.expectedQuestionNumbers || []).map(String);
    const expectedAnalysisImageNumbers = new Set((options.expectedAnalysisImageNumbers || []).map(String));
    const visualByNumber = new Map((options.visualChecks || []).map(row => [String(row.questionNumber), row]));
    const numbers = rows.map(row => String(row.questionNumber || ''));
    const imageOwners = new Map();
    const wrongAttachmentCandidates = [];
    const missingAnalysisImages = [];

    for (const question of rows) {
        const number = String(question.questionNumber || '');
        const solution = String(question.solution || '');
        const renderedImageIds = new Set(visualByNumber.get(number)?.renderedImageIds || []);
        const solutionImages = Array.isArray(question.recognizedSolutionImages)
            ? question.recognizedSolutionImages
            : [];
        if (expectedAnalysisImageNumbers.has(number) && !solutionImages.length) {
            missingAnalysisImages.push(number);
        }
        for (const image of solutionImages) {
            const id = String(image?.id || '');
            if (!id) continue;
            const owner = imageOwners.get(id);
            if (owner && owner !== number) wrongAttachmentCandidates.push({ imageId: id, owners: [owner, number] });
            imageOwners.set(id, number);
            if (!solutionReferencesImage(solution, id) || !renderedImageIds.has(id)) {
                missingAnalysisImages.push(number);
            }
        }
    }

    const keyboardMathFragments = [];
    const unwrappedLatexFragments = [];
    const rawJsonLeakage = [];
    const placeholderLeakage = [];
    const sectionHeadingInOptions = [];
    for (const question of rows) {
        const number = String(question.questionNumber || '');
        for (const [index, option] of (question.options || []).entries()) {
            if (SECTION_HEADING_RE.test(String(option || '').trim())) {
                sectionHeadingInOptions.push({ questionNumber: number, option: String.fromCharCode(65 + index) });
            }
        }
        for (const [fieldIndex, value] of textFields(question).entries()) {
            const field = fieldIndex === 0 ? 'stem' : fieldIndex <= (question.options || []).length
                ? `option-${String.fromCharCode(64 + fieldIndex)}`
                : fieldIndex === (question.options || []).length + 1 ? 'answer' : 'solution';
            const keyboardMatches = mathFreeText(value).match(KEYBOARD_MATH_RE) || [];
            keyboardMatches.forEach(fragment => keyboardMathFragments.push({ questionNumber: number, field, fragment }));
            const unwrappedLatexMatches = mathFreeText(value).match(UNWRAPPED_LATEX_RE) || [];
            unwrappedLatexMatches.forEach(fragment => unwrappedLatexFragments.push({ questionNumber: number, field, fragment }));
            if (RAW_JSON_RE.test(value)) rawJsonLeakage.push({ questionNumber: number, field });
            if (PLACEHOLDER_RE.test(value)) placeholderLeakage.push({ questionNumber: number, field });
        }
    }

    const visualChecks = options.visualChecks || [];
    return {
        questionCount: rows.length,
        missingQuestionNumbers: expectedQuestionNumbers.filter(number => !numbers.includes(number)),
        duplicateQuestionNumbers: duplicateValues(numbers.filter(Boolean)),
        sectionHeadingInOptions,
        missingAnswers: rows.filter(row => !String(row.answer || '').trim()).map(row => String(row.questionNumber || '')),
        missingAnalyses: rows.filter(row => !String(row.solution || '').trim()).map(row => String(row.questionNumber || '')),
        missingAnalysisImages: [...new Set(missingAnalysisImages)],
        latexSyntaxErrors: visualChecks.flatMap(row => (row.renderErrorDetails || []).map(error => ({
            questionNumber: String(row.questionNumber),
            ...error
        }))),
        unrenderableLatex: visualChecks.filter(row => Number(row.renderErrorCount || 0) > 0).map(row => String(row.questionNumber)),
        unrenderedLatexFragments: visualChecks.flatMap(row => (row.unrenderedLatexFragments || []).map(fragment => ({
            questionNumber: String(row.questionNumber),
            fragment
        }))),
        keyboardMathFragments,
        unwrappedLatexFragments,
        rawJsonLeakage,
        placeholderLeakage,
        punctuationOnlyAnalyses: rows.filter(row => PUNCTUATION_ONLY_RE.test(String(row.solution || '').trim())).map(row => String(row.questionNumber || '')),
        wrongAttachmentCandidates
    };
};

const auditIssueCount = result => Object.entries(result || {})
    .filter(([key, value]) => key !== 'questionCount' && Array.isArray(value))
    .reduce((sum, [, value]) => sum + value.length, 0);

if (require.main === module) {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage: node scripts/audit-docx-import-content.js <import-result.json>');
        process.exitCode = 2;
    } else {
        const payload = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const result = auditDocxImportContent(payload.questions, payload.options);
        console.log(JSON.stringify(result, null, 2));
        if (auditIssueCount(result) > 0) process.exitCode = 1;
    }
}

module.exports = { auditDocxImportContent, auditIssueCount };
