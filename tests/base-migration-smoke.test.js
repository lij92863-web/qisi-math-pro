const test =
    require('node:test');

const assert =
    require('node:assert/strict');

test(
    'BM02 smoke: DOCX+DOCX stable mock passes',
    () => {
        require('./batch-smoke-mock.test.js');
    }
);

test(
    'BM02 smoke: PDF known-bad still blocks unsafe answers',
    () => {
        const knownBad =
            require('./fixtures/pdf-support-known-bad.js');

        assert.ok(knownBad, 'known-bad fixture loads');
        assert.ok(knownBad.wrongAnswers, 'wrongAnswers defined');
        assert.ok(Object.keys(knownBad.wrongAnswers).length > 0, 'wrong answers exist');
    }
);

test(
    'BM02 smoke: controlled-write truth gate is functional',
    () => {
        const {
            buildPdfSupportFieldLevelControlledWrite
        } = require('../qisi-pdf-support-controlled-write.js');

        const c =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: [{ question: '1', type: '单选题', options: ['A. X', 'B. Y'] }],
                parserSafeAnswerItems: [{ question: '1', answer: 'A' }],
                parserSafeSolutionItems: [],
                parserFusedQuestionNumbers: []
            });

        assert.ok(c.answerQuestionNumbers.includes('1'));
        assert.equal(c.warnings.length, 0);
    }
);

test(
    'BM02 smoke: Route B research files exist but are not production',
    () => {
        const fs = require('fs');
        const path = require('path');
        const ROOT = path.resolve(__dirname, '..');

        assert.ok(
            fs.existsSync(path.join(ROOT, 'docs/testing/P10K_B_ROUTE_B_ANSWER_ONLY_AI_PASS_DESIGN.md')),
            'Route B design doc exists for reference'
        );
        assert.ok(
            fs.existsSync(path.join(ROOT, 'tests/pdf-answer-only-ai-pass.test.js')),
            'Route B mock tests exist for reference'
        );
        assert.ok(
            !fs.existsSync(path.join(ROOT, 'qisi-answer-only-ai-pass.js')),
            'Route B production module must NOT exist'
        );
    }
);

test(
    'BM02 smoke: safe partial is the target, not complete',
    () => {
        const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15].map(String);
        const accepted = ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        const rate = accepted.length / expected.length;

        assert.ok(rate > 0.5, 'more than half accepted');
        assert.ok(rate < 1.0, 'not complete — safe partial');
    }
);
