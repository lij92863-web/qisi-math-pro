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
    'P10L-HOLD: Route B is research-only — controlled-write does not import Route B AI pass',
    () => {
        const controlledWrite =
            readIfExists('qisi-pdf-support-controlled-write.js');

        assert.ok(
            !controlledWrite.includes('answer-only-ai'),
            'controlled-write must not import/reference Route B AI pass'
        );
        assert.ok(
            !controlledWrite.includes('Route B'),
            'controlled-write must not reference Route B'
        );
        assert.ok(
            !controlledWrite.includes('route-b'),
            'controlled-write must not reference route-b'
        );
    }
);

test(
    'P10L-HOLD: Route B is research-only — runner does not call Route B AI pass',
    () => {
        const runner =
            readIfExists('scripts/pdf-master-browser-runner.js');

        assert.ok(
            !runner.includes('answer-only-ai'),
            'runner must not call Route B AI pass'
        );
        assert.ok(
            !runner.includes('Route B AI'),
            'runner must not reference Route B AI'
        );
    }
);

test(
    'P10L-HOLD: Route B is research-only — app.js does not reference Route B',
    () => {
        const app =
            readIfExists('app.js');

        assert.ok(
            !app.includes('answer-only-ai-pass'),
            'app.js must not reference Route B AI pass'
        );
        assert.ok(
            !app.includes('Route B'),
            'app.js must not reference Route B'
        );
    }
);

test(
    'P10L-HOLD: Route B files exist only as research artifacts in docs/tests',
    () => {
        const researchFiles = [
            'docs/testing/P10K_B_ROUTE_B_ANSWER_ONLY_AI_PASS_DESIGN.md',
            'tests/pdf-answer-only-ai-pass.test.js'
        ];

        const productionFiles = [
            'qisi-pdf-answer-only-ai-pass.js',
            'scripts/route-b-ai-pass.js'
        ];

        for (const file of researchFiles) {
            const fullPath =
                path.join(ROOT, file);

            assert.ok(
                fs.existsSync(fullPath),
                `research file ${file} should exist for documentation`
            );
        }

        for (const file of productionFiles) {
            const fullPath =
                path.join(ROOT, file);

            assert.ok(
                !fs.existsSync(fullPath),
                `production file ${file} must NOT exist — Route B is research-only`
            );
        }
    }
);

test(
    'P10L-HOLD: Route B does not affect controlled-write accepted/rejected',
    () => {
        const {
            buildPdfSupportFieldLevelControlledWrite
        } = require('../qisi-pdf-support-controlled-write.js');

        const draft = {
            question: '8',
            questionNumber: '8',
            type: 'multiple',
            options: ['A. X', 'B. Y', 'C. Z', 'D. W']
        };
        const rawAnswer = String.raw`}X_\A{Y}`;

        const controlled =
            buildPdfSupportFieldLevelControlledWrite({
                drafts: [draft],
                parserSafeAnswerItems: [{
                    question: '8',
                    answer: rawAnswer,
                    evidence: { questionMarker: true, labelMarker: true },
                    sourceTrace: { rawBlockExcerpt: rawAnswer }
                }],
                parserSafeSolutionItems: [],
                parserFusedQuestionNumbers: []
            });

        assert.ok(
            !controlled.answerQuestionNumbers.includes('8'),
            'Q8 dirty structural shell must still be rejected'
        );
        assert.equal(
            controlled.warnings.length,
            1,
            'must have rejection warning'
        );
        assert.equal(
            controlled.warnings[0].code,
            'parser-objective-answer-rejected'
        );

        assert.ok(
            !controlled.warnings[0].rejectionCode.includes('route-b'),
            'rejection must not reference Route B'
        );
        assert.ok(
            !controlled.warnings[0].rejectionCode.includes('route-a'),
            'rejection must not reference Route A'
        );
    }
);

test(
    'P10L-HOLD: Q8/Q9 continue as safe partial by design',
    () => {
        const expectedQuestionNumbers =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15];

        const controlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        const missing =
            expectedQuestionNumbers
                .map(String)
                .filter(q => !controlledWriteAccepted.includes(q));

        assert.ok(
            missing.includes('8'),
            'Q8 must be in missing set'
        );
        assert.ok(
            missing.includes('9'),
            'Q9 must be in missing set'
        );

        const isComplete =
            missing.length === 0;

        assert.ok(
            !isComplete,
            'not complete — Q8/Q9 missing by design'
        );

        assert.equal(
            controlledWriteAccepted.length,
            9,
            '9/12 answers accepted — safe partial'
        );
    }
);
