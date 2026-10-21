#!/usr/bin/env node
'use strict';

// Explicitly selected historical extraction-to-assembly diagnostics. No source
// PDF upload, producer invocation, automatic admission or real recognition.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../../qisi-mineru-client').internals;
const S = require('../../qisi-paper-segmenter');
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function audit(items, reference) {
    if (!Array.isArray(items) || !Array.isArray(reference.questions) || !reference.questions.length) throw new Error('CACHE_REFERENCE_INVALID');
    const numbers = reference.questions.map(question => String(question.no));
    if (numbers.some(no => !/^[1-9]\d{0,2}$/.test(no)) || new Set(numbers).size !== numbers.length) throw new Error('CACHE_REFERENCE_NUMBERS_INVALID');
    const parsed = C.parseContentList(items, { sourceId: 'unverified-historical-extraction' });
    const blocks = parsed.pages.flatMap(page => page.blocks);
    const paper = S.segmentPaper(blocks);
    const built = S.assemblePartial({ ...paper, answerTable: C.parseAnswerTable(blocks) });
    const rows = reference.questions.map(expected => {
        const no = String(expected.no), candidates = built.questions.filter(question => question.questionNo === no);
        const actual = candidates.length === 1 ? candidates[0] : null;
        const run = paper.solutionSegment?.runs.find(run => run.no === no);
        const rawAnswers = run ? S.answerEvidence(run) : { state: 'absent', evidence: [] };
        const issues = built.issues.filter(issue => String(issue.no) === no);
        const referenceAnswer = typeof expected.answer === 'string' && normalize(expected.answer) ? expected.answer : null;
        const diagnosis = actual?.answer ? 'candidate-answer-present' :
            rawAnswers.state === 'conflicting' ? 'conflicting-answer-declarations' :
            rawAnswers.evidence.length ? 'explicit-answer-withheld' : 'no-standalone-answer-declaration';
        return {
            number: no, numberLocated: Boolean(actual), referenceAnswer,
            candidateAnswer: actual?.answer || '',
            exactReferenceAgreement: referenceAnswer !== null && actual?.answer ? normalize(actual.answer) === normalize(referenceAnswer) : null,
            rawDeclarationState: rawAnswers.state, rawDeclarationCount: rawAnswers.evidence.length,
            solutionLocated: Boolean(run), solutionRetained: Boolean(actual?.solutionBlocks.length),
            diagnosis, issues,
            evidence: { questionBlocks: actual?.stemBlocks || [], solutionBlocks: actual?.solutionBlocks || [],
                locatedSolutionBlocks: run?.blocks.map(block => block.id) || [], declarations: rawAnswers.evidence }
        };
    });
    return {
        schema: 'qisi.cache-audit.v1', layer: 'historical-extraction-to-assembly',
        annotationStatus: 'historical-reference-unverified', sourcePdfIdentityVerified: false,
        wrongAttachmentCount: null, humanReviewMinutes: null,
        limits: 'Number coverage is not identity recall. Reference exact agreement is not mathematical accuracy. Source hash, reviewer, full stem/solution and image annotations remain unverified. This does not test UI, persistence or admission.',
        counts: {
            referenceQuestions: rows.length, observedQuestionRuns: built.questions.length,
            referenceNumbersLocated: rows.filter(row => row.numberLocated).length,
            candidateAnswersPresent: rows.filter(row => row.candidateAnswer).length,
            standaloneDeclarationsNotDetected: rows.filter(row => row.diagnosis === 'no-standalone-answer-declaration').length,
            explicitAnswersWithheld: rows.filter(row => row.diagnosis === 'explicit-answer-withheld').length,
            solutionRunsLocated: rows.filter(row => row.solutionLocated).length,
            solutionsRetained: rows.filter(row => row.solutionRetained).length,
            referenceExactAgreements: rows.filter(row => row.exactReferenceAgreement === true).length,
            referenceExactDisagreements: rows.filter(row => row.exactReferenceAgreement === false).length,
            comparableReferenceAnswers: rows.filter(row => row.exactReferenceAgreement !== null).length
        },
        questionSequence: { valid: paper.questionSegment.valid, numbers: paper.questionSegment.order, issues: paper.questionSegment.issues },
        issues: built.issues, rows
    };
}

function main(args) {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        if (!['--content-list', '--reference', '--out'].includes(args[i]) || !args[i + 1]) throw new Error('Required: --content-list FILE --reference FILE --out NEW_DIRECTORY');
        options[args[i]] = path.resolve(args[i + 1]);
    }
    if (!options['--content-list'] || !options['--reference'] || !options['--out']) throw new Error('CACHE_INPUT_REQUIRED');
    if (![options['--content-list'], options['--reference']].every(file => file.endsWith('.json'))) throw new Error('CACHE_JSON_REQUIRED');
    const raw = fs.readFileSync(options['--content-list']), reference = fs.readFileSync(options['--reference']);
    const report = audit(JSON.parse(raw), JSON.parse(reference));
    report.generatedAt = new Date().toISOString();
    report.inputs = { contentList: { path: options['--content-list'], sha256: sha(raw) },
        reference: { path: options['--reference'], sha256: sha(reference) } };
    report.software = ['qisi-paper-segmenter.js', 'qisi-mineru-client.js', 'qisi-mineru-evidence.js'].map(file => ({
        file, sha256: sha(fs.readFileSync(path.resolve(__dirname, '../..', file)))
    }));
    const out = options['--out'];
    fs.mkdirSync(out, { recursive: true });
    if (fs.existsSync(path.join(out, 'cache-report.json'))) throw new Error('CACHE_REPORT_ALREADY_EXISTS');
    fs.writeFileSync(path.join(out, 'cache-report.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify({ ...report.counts, annotationStatus: report.annotationStatus, wrongAttachmentCount: null, out }) + '\n');
    return report;
}
if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { process.stderr.write(String(error.stack || error) + '\n'); process.exitCode = 1; }
}
module.exports = { audit };
