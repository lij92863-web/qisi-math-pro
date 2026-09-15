// Measures PDF answer/solution attachment against the confirmed key, using the recorded replay
// so no paid recognition call is needed. The question side of a PDF import needs the vision
// stage; the support side — where a wrong attachment would happen — is measured here.
//
// Usage: node scripts/measure-pdf-support-accuracy.js [--json <path>]
const fs = require('node:fs');
const path = require('node:path');

const aligner = require('../qisi-pdf-support-aligner.js');
const controlledWrite = require('../qisi-pdf-support-controlled-write.js');
const replay = require('../tests/fixtures/pdf-replay/brief-engine-replay.json');
const truth = require('../tests/fixtures/pdf-golden/brief-pdf-truth.json');

const ROOT = path.resolve(__dirname, '..');
const readArg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const jsonPath = readArg('--json', path.join(ROOT, 'artifacts', 'audit-baseline', 'pdf-support-accuracy.json'));

const questionNumber = value => String(value ?? '').trim();

const questionItems = (replay.questionResponse?.questions || []).map(question => ({
    questionNumber: questionNumber(question.questionNumber),
    type: question.type || '',
    options: Object.values(question.options || {}),
    answer: '',
    solution: ''
}));
const answerItems = (replay.supportStructuredResponse?.answers || []).map(row => ({
    question: questionNumber(row.question),
    answer: String(row.answer || '')
}));
const solutionItems = (replay.supportStructuredResponse?.solutions || []).map(row => ({
    question: questionNumber(row.question),
    solution: String(row.solution || '')
}));
const expectedQuestionNumbers = (truth.questionNumbers || []).map(questionNumber);

const aligned = aligner.alignPdfSupport({
    questionItems,
    answerItems,
    solutionItems,
    expectedQuestionNumbers
});

const controlled = controlledWrite.buildPdfSupportFieldLevelControlledWrite({
    drafts: questionItems,
    legacySafeAnswerItems: [],
    legacySafeSolutionItems: [],
    parserSafeAnswerItems: aligned.safeAnswerItems || [],
    parserSafeSolutionItems: aligned.safeSolutionItems || [],
    parserFusedQuestionNumbers: aligned.fusedQuestionNumbers || []
});

const attachedAnswer = new Map(
    (controlled.effectiveAnswerItems || []).map(row => [questionNumber(row.question), String(row.answer || '')])
);
const attachedSolution = new Map(
    (controlled.effectiveSolutionItems || []).map(row => [questionNumber(row.question), String(row.solution || '')])
);

const normalizeAnswer = value => String(value ?? '').replace(/\s+/g, '').toUpperCase();

const results = Object.entries(truth.answers || {}).map(([number, expected]) => {
    const key = questionNumber(number);
    const actual = attachedAnswer.get(key) || '';
    const solution = attachedSolution.get(key) || '';
    const correct = Boolean(actual) && normalizeAnswer(actual) === normalizeAnswer(expected);
    const verdict = !actual
        ? (solution ? 'SAFE PARTIAL' : 'FAILED')
        : (correct ? 'COMPLETE' : 'WRONG MATCH');

    return {
        questionNumber: key,
        expectedAnswer: String(expected),
        actualAnswer: actual,
        solutionPresent: Boolean(solution),
        verdict
    };
});

const counts = results.reduce((sum, row) => {
    sum[row.verdict] = (sum[row.verdict] || 0) + 1;
    return sum;
}, {});

const report = {
    generatedAt: new Date().toISOString(),
    source: 'tests/fixtures/pdf-replay/brief-engine-replay.json',
    key: 'tests/fixtures/pdf-golden/brief-pdf-truth.json',
    replayAnswers: Object.fromEntries(answerItems.map(row => [row.question, row.answer])),
    alignMode: aligned.mode,
    alignReliable: aligned.reliable,
    safeAnswerNumbers: (aligned.safeAnswerItems || []).map(row => questionNumber(row.question)),
    safeSolutionNumbers: (aligned.safeSolutionItems || []).map(row => questionNumber(row.question)),
    fusedQuestionNumbers: aligned.fusedQuestionNumbers || [],
    alignWarnings: aligned.warnings || [],
    alignReasons: aligned.report?.reasons || [],
    controlledWarnings: controlled.warnings || [],
    fieldDecisions: controlled.fieldDecisions || [],
    counts,
    wrongMatches: results.filter(row => row.verdict === 'WRONG MATCH'),
    results
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

console.log('[measure-pdf-support] aligner mode: ' + report.alignMode
    + ' reliable: ' + report.alignReliable);
console.log('[measure-pdf-support] safe answers: ' + report.safeAnswerNumbers.join(',')
    + ' | safe solutions: ' + report.safeSolutionNumbers.join(','));
console.log('[measure-pdf-support] classification: ' + JSON.stringify(counts));
console.log('[measure-pdf-support] WRONG MATCH: ' + report.wrongMatches.length
    + (report.wrongMatches.length ? ' ' + JSON.stringify(report.wrongMatches) : ''));
for (const row of results) {
    console.log(`  q${row.questionNumber}: ${row.verdict} key=${row.expectedAnswer} attached=${row.actualAnswer || '-'}`
        + ` solution=${row.solutionPresent ? 'yes' : 'no'}`);
}
console.log('[measure-pdf-support] warnings: ' + report.controlledWarnings.length
    + (report.controlledWarnings.length ? ' ' + JSON.stringify(report.controlledWarnings.slice(0, 4)) : ''));
console.log('[measure-pdf-support] report written to ' + jsonPath);
