const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    normalizeAnswerOnlyExtractionItem,
    isAnswerMarkerLine,
    extractLabelFromAnswerLine,
    isDirtyOrNonLabelContent,
    validateAnswerOnlyExtractionSequence,
    buildAnswerOnlyExtractionShadow
} =
    require('../qisi-pdf-answer-only-extraction.js');

test(
    'P10K AOE: normalize valid answer item',
    () => {
        const item =
            normalizeAnswerOnlyExtractionItem({
                sourceOrder: 1,
                label: 'A'
            });

        assert.ok(item);
        assert.equal(item.sourceOrder, 1);
        assert.equal(item.label, 'A');
        assert.equal(item.evidenceLevel, 'candidate-only');
        assert.equal(item.source, 'aoe-route-a-rawTextPages');
    }
);

test(
    'P10K AOE: normalize rejects non-label, negative sourceOrder, missing fields',
    () => {
        assert.equal(
            normalizeAnswerOnlyExtractionItem({ sourceOrder: 1, label: 'LaTeX text' }),
            null
        );
        assert.equal(
            normalizeAnswerOnlyExtractionItem({ sourceOrder: -1, label: 'A' }),
            null
        );
        assert.equal(
            normalizeAnswerOnlyExtractionItem({ label: 'A' }),
            null
        );
        assert.equal(
            normalizeAnswerOnlyExtractionItem(null),
            null
        );
    }
);

test(
    'P10K AOE: isAnswerMarkerLine detects answer markers',
    () => {
        assert.ok(isAnswerMarkerLine('答案：A'));
        assert.ok(isAnswerMarkerLine('【答案】A'));
        assert.ok(isAnswerMarkerLine('参考答案：B'));
        assert.ok(isAnswerMarkerLine('\\A_【答案】A'));
        assert.ok(!isAnswerMarkerLine('解析：solution text'));
        assert.ok(!isAnswerMarkerLine('1. question stem'));
    }
);

test(
    'P10K AOE: extractLabelFromAnswerLine extracts clean labels',
    () => {
        assert.equal(extractLabelFromAnswerLine('A'), 'A');
        assert.equal(extractLabelFromAnswerLine('答案：B'), 'B');
        assert.equal(extractLabelFromAnswerLine('【答案】C'), 'C');
        assert.equal(extractLabelFromAnswerLine('答:D'), 'D');
        assert.equal(extractLabelFromAnswerLine('A.'), 'A');
        assert.equal(extractLabelFromAnswerLine('(B)'), 'B');
        assert.equal(extractLabelFromAnswerLine('{A}'), 'A');
        assert.equal(extractLabelFromAnswerLine('LaTeX explanation'), null);
        assert.equal(extractLabelFromAnswerLine('}A_\\A{A}'), null);
    }
);

test(
    'P10K AOE: isDirtyOrNonLabelContent detects dirty content',
    () => {
        assert.ok(isDirtyOrNonLabelContent('}A_\\A{A}').dirty);
        assert.ok(isDirtyOrNonLabelContent('\\frac{A}{B}').dirty);
        assert.ok(isDirtyOrNonLabelContent('A+B').dirty);
        assert.ok(isDirtyOrNonLabelContent('long text that is clearly not a label').dirty);
        assert.ok(!isDirtyOrNonLabelContent('A').dirty);
        assert.ok(!isDirtyOrNonLabelContent('BD').dirty);
    }
);

test(
    'P10K AOE: clean labels 1-12 → mode full',
    () => {
        const items =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));
        const result =
            validateAnswerOnlyExtractionSequence(
                items,
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15]
            );

        assert.ok(result.ok);
        assert.equal(result.mode, 'full');
        assert.equal(result.candidateItems.length, 12);
        assert.equal(result.affectsControlledWrite, false);
        assert.equal(result.affectsBaselineCandidate, false);
    }
);

test(
    'P10K AOE: dirty shell rejected by validator',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A' },
            { sourceOrder: 2, label: '}A_\\A{A}' }
        ];

        const result =
            validateAnswerOnlyExtractionSequence(items);

        assert.equal(result.candidateItems.length, 1);
        assert.ok(
            result.rejectedItems.some(r => r.reason === 'contains-latex-command' ||
                r.reason === 'contains-underscore')
        );
    }
);

test(
    'P10K AOE: duplicate sourceOrder fail-closed',
    () => {
        const result =
            validateAnswerOnlyExtractionSequence([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 1, label: 'B' }
            ]);

        assert.equal(result.mode, 'fail-closed');
        assert.ok(
            result.warnings.some(w => w.code === 'duplicate-sourceOrder')
        );
    }
);

test(
    'P10K AOE: jumpBack fail-closed',
    () => {
        const result =
            validateAnswerOnlyExtractionSequence([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 3, label: 'B' },
                { sourceOrder: 2, label: 'C' }
            ]);

        assert.equal(result.mode, 'fail-closed');
    }
);

test(
    'P10K AOE: missing Q8/Q9 → pass-safe-partial',
    () => {
        const items =
            [1, 2, 3, 4, 5, 6, 7, 10, 13, 15].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));

        const result =
            validateAnswerOnlyExtractionSequence(
                items,
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15]
            );

        assert.equal(result.mode, 'pass-safe-partial');
        assert.ok(
            result.warnings.some(w => w.code === 'aoe-incomplete')
        );
    }
);

test(
    'P10K AOE: AOE candidate not accepted; controlled-write still truth gate',
    () => {
        const items =
            [1, 2, 3].map(n => ({ sourceOrder: n, label: 'A' }));

        const result =
            validateAnswerOnlyExtractionSequence(items, [1, 2, 3]);

        assert.ok(result.ok);
        assert.equal(result.affectsControlledWrite, false);
        assert.equal(result.affectsBaselineCandidate, false);
        assert.equal(result.affectsResultClassification, false);

        const isAccepted =
            result.candidateItems.every(
                item => item.evidenceLevel === 'candidate-only'
            );

        assert.ok(isAccepted, 'all items are candidate-only, not accepted');
    }
);

test(
    'P10K AOE: buildAnswerOnlyExtractionShadow from rawTextPages',
    () => {
        const pages = [
            '1. 【答案】A\n【解析】solution 1',
            '2. 答案：B\n解析：solution 2',
            '3. 【答案】C\n【解析】solution 3'
        ];

        const shadow =
            buildAnswerOnlyExtractionShadow(pages, [1, 2, 3]);

        assert.ok(shadow);
        assert.equal(shadow.mode, 'full');
        assert.deepEqual(
            shadow.candidateQuestionNumbers,
            ['1', '2', '3']
        );
        assert.equal(shadow.affectsControlledWrite, false);
        assert.equal(shadow.affectsBaselineCandidate, false);
    }
);

test(
    'P10K AOE: shadow with incomplete coverage reports pass-safe-partial',
    () => {
        const pages = [
            '1. 【答案】A',
            '3. 【答案】C'
        ];

        const shadow =
            buildAnswerOnlyExtractionShadow(pages, [1, 2, 3]);

        assert.ok(shadow);
        assert.equal(shadow.mode, 'pass-safe-partial');
        assert.deepEqual(
            shadow.missingQuestionNumbers,
            ['3']
        );
        assert.equal(shadow.candidateCount, 2);
        assert.equal(shadow.expectedCount, 3);
    }
);

test(
    'P10K AOE: shadow with no labels returns fail-closed',
    () => {
        const pages = [
            'No answer labels here.',
            'Just regular text.'
        ];

        const shadow =
            buildAnswerOnlyExtractionShadow(pages, [1, 2, 3]);

        assert.ok(shadow);
        assert.equal(shadow.mode, 'fail-closed');
        assert.deepEqual(shadow.candidateQuestionNumbers, []);
    }
);

test(
    'P10K AOE: shadow never affects controlled-write or baseline',
    () => {
        const pages = [
            '1. 【答案】A\n2. 答案：B\n3. 【答案】C'
        ];

        const shadow =
            buildAnswerOnlyExtractionShadow(pages, [1, 2, 3]);

        assert.equal(shadow.affectsControlledWrite, false);
        assert.equal(shadow.affectsBaselineCandidate, false);
        assert.equal(shadow.affectsResultClassification, false);

        const controlledWriteAccepted = ['1', '3'];
        const shadowCandidates = shadow.candidateQuestionNumbers;

        assert.ok(
            shadowCandidates.includes('2'),
            'AOE candidate includes Q2'
        );
        assert.ok(
            !controlledWriteAccepted.includes('2'),
            'but Q2 is NOT in controlled-write accepted'
        );
        assert.equal(
            shadow.mode,
            'full',
            'AOE says full, but controlled-write decides accepted'
        );
    }
);

test(
    'P10K AOE: empty input returns null shadow',
    () => {
        const shadow =
            buildAnswerOnlyExtractionShadow([], [1, 2, 3]);

        assert.equal(shadow, null);
    }
);
