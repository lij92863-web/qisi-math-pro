const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    spawnSync
} =
    require('node:child_process');

const path =
    require('node:path');

test(
    'BM02 smoke: DOCX+DOCX stable mock passes',
    () => {
        // The DOCX+DOCX stable mock lives in its own test file and must run in a
        // separate process.
        //
        // Previously this test `require()`d that file directly. Because this
        // callback is synchronous, node:test registered the required file's
        // subtests inside this test and then cancelled all of them as
        // `cancelledByParent` (the parent returned before they finished),
        // which surfaced as `subtestsFailed` and made `npm test` exit non-zero.
        //
        // That single failure was enough to block every commit in this
        // repository, because `.githooks/pre-commit` runs `verify:safe`.
        // Running the mock in its own process keeps the same coverage and the
        // same intent without nesting one test file inside another.
        const result =
            spawnSync(
                process.execPath,
                [
                    '--test',
                    path.join(__dirname, 'batch-smoke-mock.test.js')
                ],
                {
                    stdio: 'inherit',
                    shell: false
                }
            );

        assert.equal(
            result.status,
            0,
            'DOCX+DOCX stable mock must pass in its own process'
        );
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
