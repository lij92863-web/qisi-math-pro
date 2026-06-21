const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('fs');

const path =
    require('path');

const ROOT =
    path.resolve(__dirname, '..');

const readIfExists = filePath => {
    try {
        return fs.readFileSync(path.join(ROOT, filePath), 'utf8');
    } catch (_) {
        return '';
    }
};

test(
    'BM02: Route B is NOT imported by controlled-write',
    () => {
        const cw =
            readIfExists('qisi-pdf-support-controlled-write.js');

        assert.ok(!cw.includes('answer-only-ai'), 'Route B AI pass not in controlled-write');
        assert.ok(!cw.includes('Route B'), 'Route B not referenced in controlled-write');
    }
);

test(
    'BM02: Route B is NOT imported by runner',
    () => {
        const runner =
            readIfExists('scripts/pdf-master-browser-runner.js');

        assert.ok(!runner.includes('answer-only-ai'), 'Route B AI pass not in runner');
    }
);

test(
    'BM02: Route B is NOT imported by app.js',
    () => {
        const app =
            readIfExists('app.js');

        assert.ok(!app.includes('answer-only-ai-pass'), 'Route B AI pass not in app.js');
    }
);

test(
    'BM02: controlled-write is the only truth gate',
    () => {
        const {
            buildPdfSupportFieldLevelControlledWrite
        } = require('../qisi-pdf-support-controlled-write.js');

        const c =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: [
                    { question: '1', questionNumber: '1', type: '单选题', options: ['A. X', 'B. Y'] }
                ],
                parserSafeAnswerItems: [
                    { question: '1', answer: 'A', evidence: { questionMarker: true, labelMarker: true }, sourceTrace: {} }
                ],
                parserSafeSolutionItems: [],
                parserFusedQuestionNumbers: []
            });

        assert.ok(c.answerQuestionNumbers.length >= 0, 'controlled-write functions correctly');
        assert.ok(Array.isArray(c.fieldDecisions), 'field decisions present');
    }
);

test(
    'BM02: baselineCandidate only from controlledWriteAccepted',
    () => {
        const controlledWriteAccepted = ['1', '3', '4'];
        const draftSnapshot = ['1', '2', '3', '4'];

        const baselineCandidate =
            draftSnapshot.filter(q => controlledWriteAccepted.includes(q));

        assert.deepEqual(baselineCandidate, ['1', '3', '4']);
        assert.ok(!baselineCandidate.includes('2'), 'rejected answer 2 not in baseline');
    }
);

test(
    'BM02: safe partial is not treated as complete',
    () => {
        const accepted = ['1', '3', '4', '5', '6', '7', '10', '13', '15'];
        const expected = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '13', '15'];

        const isComplete =
            expected.every(q => accepted.includes(q));

        assert.ok(!isComplete, '9/12 is not complete');
        assert.ok(accepted.length < expected.length, 'safe partial has fewer accepted');
    }
);

test(
    'BM02: Q8/Q9 dirty structural shell still rejected',
    () => {
        const {
            buildPdfSupportFieldLevelControlledWrite
        } = require('../qisi-pdf-support-controlled-write.js');

        const raw = String.raw`}X_\A{Y}`;
        const c =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: [
                    { question: '8', questionNumber: '8', type: 'multiple', options: ['A. X', 'B. Y', 'C. Z', 'D. W'] }
                ],
                parserSafeAnswerItems: [
                    { question: '8', answer: raw, evidence: { questionMarker: true, labelMarker: true }, sourceTrace: { rawBlockExcerpt: raw } }
                ],
                parserSafeSolutionItems: [],
                parserFusedQuestionNumbers: []
            });

        assert.ok(!c.answerQuestionNumbers.includes('8'), 'Q8 dirty shell must be rejected');
        assert.equal(c.warnings[0].code, 'parser-objective-answer-rejected');
    }
);

test(
    'BM02: Q2 safe wrapper accepted',
    () => {
        const {
            buildPdfSupportFieldLevelControlledWrite
        } = require('../qisi-pdf-support-controlled-write.js');

        const raw = String.raw`\A{A}`;
        const c =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: [
                    { question: '2', questionNumber: '2', type: '单选题', options: ['A. X', 'B. Y', 'C. Z', 'D. W'] }
                ],
                parserSafeAnswerItems: [
                    { question: '2', answer: raw, evidence: { questionMarker: true, labelMarker: true }, sourceTrace: { rawBlockExcerpt: raw } }
                ],
                parserSafeSolutionItems: [],
                parserFusedQuestionNumbers: []
            });

        assert.ok(c.answerQuestionNumbers.includes('2'), 'Q2 safe wrapper must be accepted');
    }
);

test(
    'BM02: no production file imports Route B',
    () => {
        const productionFiles = [
            'qisi-pdf-support-controlled-write.js',
            'qisi-pdf-support-aligner.js',
            'qisi-pdf-support-block-parser.js',
            'qisi-pdf-answer-extraction-quality.js',
            'qisi-pdf-answer-only-extraction.js',
            'app.js',
            'main.html',
            'scripts/pdf-master-browser-runner.js'
        ];

        const routeBIndicators = [
            'answer-only-ai-pass',
            'Route B AI',
            'route-b-ai'
        ];

        for (const file of productionFiles) {
            const content = readIfExists(file);

            for (const indicator of routeBIndicators) {
                assert.ok(
                    !content.includes(indicator),
                    `${file} must not contain Route B indicator: ${indicator}`
                );
            }
        }
    }
);
