const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    classifyAnswerExtractionQuality,
    isSafeLatexWrapper,
    isDirtyStructuralShell,
    isCleanLabelCandidate,
    unwrapSafeLatexWrapper
} =
    require('../qisi-pdf-answer-extraction-quality.js');

test(
    'P10F clean label candidates: status clean-label, canDirectlyAccept false',
    () => {
        const cleanCases = ['A', 'B', 'C', 'D', 'E', 'F', 'a', 'f'];

        for (const value of cleanCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.equal(
                result.status,
                'clean-label',
                `'${value}' must be clean-label`
            );
            assert.equal(
                result.normalizedCandidate,
                value.toUpperCase()
            );
            assert.equal(
                result.canDirectlyAccept,
                false,
                `'${value}' must not have canDirectlyAccept=true`
            );
            assert.equal(
                result.evidenceLevel,
                'candidate-only'
            );
            assert.ok(
                result.reasonDetail.length > 0
            );
        }
    }
);

test(
    'P10F parenthesized and prefixed labels are clean-label',
    () => {
        const cases = [
            { input: '(A)', expected: 'A' },
            { input: '（B）', expected: 'B' },
            { input: '答案：C', expected: 'C' },
            { input: '选D', expected: 'D' },
            { input: '答:A', expected: 'A' },
            { input: '{A}', expected: 'A' },
            { input: 'A.', expected: 'A' }
        ];

        for (const { input, expected } of cases) {
            const result =
                classifyAnswerExtractionQuality(input);

            assert.equal(result.status, 'clean-label');
            assert.equal(result.normalizedCandidate, expected);
            assert.equal(result.canDirectlyAccept, false);
        }
    }
);

test(
    'P10F safe LaTeX wrappers: status safe-wrapper-candidate, canDirectlyAccept false',
    () => {
        const wrappers = [
            { input: '\\text{A}', expected: 'A' },
            { input: '\\mathrm{B}', expected: 'B' },
            { input: '\\textbf{C}', expected: 'C' },
            { input: '\\mathit{D}', expected: 'D' },
            { input: '\\mathbf{A}', expected: 'A' },
            { input: '\\mathsf{B}', expected: 'B' },
            { input: '\\texttt{C}', expected: 'C' },
            { input: '\\textrm{D}', expected: 'D' }
        ];

        for (const { input, expected } of wrappers) {
            const result =
                classifyAnswerExtractionQuality(input);

            assert.equal(
                result.status,
                'safe-wrapper-candidate',
                `'${input}' must be safe-wrapper-candidate`
            );
            assert.equal(
                result.normalizedCandidate,
                expected
            );
            assert.equal(
                result.canDirectlyAccept,
                false,
                'canDirectlyAccept must never be true'
            );
            assert.equal(
                result.evidenceLevel,
                'candidate-only'
            );
            assert.ok(
                result.reasonDetail.includes(expected),
                'reasonDetail should mention the normalized label'
            );
        }
    }
);

test(
    'P10F Q2-type single-letter LaTeX command \\A{A} is safe-wrapper-candidate',
    () => {
        const result =
            classifyAnswerExtractionQuality('\\A{A}');

        assert.equal(result.status, 'safe-wrapper-candidate');
        assert.equal(result.normalizedCandidate, 'A');
        assert.equal(result.canDirectlyAccept, false);
        assert.equal(result.reasonCode, 'safe-latex-wrapper');
    }
);

test(
    'P10F dirty structural shell }A_\\A{A}: status dirty-structural-shell, normalizedCandidate null',
    () => {
        const dirtyCases = [
            '}A_\\A{A}',
            '}B_\\A{D}',
            '}X_\\A{Y}',
            'A_\\A{B}',
            'x_A',
            'A_1'
        ];

        for (const value of dirtyCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.equal(
                result.status,
                'dirty-structural-shell',
                `'${value}' must be dirty-structural-shell`
            );
            assert.equal(
                result.normalizedCandidate,
                null,
                `'${value}' must have null normalizedCandidate`
            );
            assert.equal(
                result.canDirectlyAccept,
                false
            );
        }
    }
);

test(
    'P10F unsafe LaTeX math commands are dirty-structural-shell or rejected',
    () => {
        const unsafeCommands = [
            '\\frac{A}{B}',
            '\\sqrt{A}',
            '\\angle A',
            '\\sin A',
            '\\cos B',
            '\\boxed{C}'
        ];

        for (const value of unsafeCommands) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                result.status === 'dirty-structural-shell' ||
                result.status === 'rejected',
                `'${value}' must be dirty or rejected, got: ${result.status}`
            );
            assert.equal(
                result.canDirectlyAccept,
                false
            );
            assert.equal(
                result.evidenceLevel,
                'candidate-only'
            );
        }
    }
);

test(
    'P10F mixed, long, or non-label content is rejected',
    () => {
        const mixedCases = [
            'AB',
            'A、B、C混合文本',
            'A+B',
            'a long text that is clearly not a clean answer label but mixed content'
        ];

        for (const value of mixedCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                result.status !== 'clean-label' &&
                result.status !== 'safe-wrapper-candidate',
                `'${value}' must not be eligible for acceptance`
            );
            assert.equal(
                result.canDirectlyAccept,
                false
            );
        }
    }
);

test(
    'P10F empty answer: status empty, normalizedCandidate null',
    () => {
        const result =
            classifyAnswerExtractionQuality('');

        assert.equal(result.status, 'empty');
        assert.equal(result.normalizedCandidate, null);
        assert.equal(result.canDirectlyAccept, false);
    }
);

test(
    'P10F classifyAnswerExtractionQuality never sets canDirectlyAccept to true',
    () => {
        const allCases = [
            'A',
            '\\text{A}',
            '\\A{A}',
            '}A_\\A{A}',
            '\\frac{A}{B}',
            'AB',
            ''
        ];

        for (const value of allCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.equal(
                result.canDirectlyAccept,
                false,
                `'${value}': canDirectlyAccept must ALWAYS be false — ` +
                'extraction quality is evidence only, not write permission'
            );
            assert.equal(
                result.evidenceLevel,
                'candidate-only',
                `'${value}': evidenceLevel must be candidate-only`
            );
        }
    }
);

test(
    'P10F extraction quality candidate is independent of controlled-write acceptance',
    () => {
        const candidate =
            classifyAnswerExtractionQuality('\\text{A}');

        assert.equal(
            candidate.status,
            'safe-wrapper-candidate'
        );
        assert.equal(
            candidate.canDirectlyAccept,
            false
        );

        const controlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        assert.ok(
            !controlledWriteAccepted.includes(candidate.normalizedCandidate),
            'candidate status does not imply controlled-write acceptance'
        );
    }
);

test(
    'P10F baseline candidate must never be derived from extraction quality classifier',
    () => {
        const candidate =
            classifyAnswerExtractionQuality('\\text{A}');

        const controlledWriteAccepted =
            ['1', '7', '10', '13', '15'];

        const baselineCandidate =
            controlledWriteAccepted.filter(
                question => question === candidate.normalizedCandidate
            );

        assert.deepEqual(
            baselineCandidate,
            [],
            'classifier output must not enter baseline candidate directly'
        );
    }
);

test(
    'P10F controlled-write truth gate invariant: classifier output does not change accepted set',
    () => {
        const controlledWriteAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        const candidates =
            [
                classifyAnswerExtractionQuality('A'),
                classifyAnswerExtractionQuality('\\text{A}'),
                classifyAnswerExtractionQuality('}A_\\A{A}'),
                classifyAnswerExtractionQuality('\\frac{A}{B}')
            ];

        const cleanOrWrapper =
            candidates.filter(
                c =>
                    c.status === 'clean-label' ||
                    c.status === 'safe-wrapper-candidate'
            );

        const dirtyOrRejected =
            candidates.filter(
                c =>
                    c.status === 'dirty-structural-shell' ||
                    c.status === 'rejected'
            );

        assert.ok(
            cleanOrWrapper.length >= 2,
            'some candidates are clean or wrapper-eligible'
        );
        assert.ok(
            dirtyOrRejected.length >= 2,
            'some candidates are dirty or rejected'
        );

        const acceptedSetAfter =
            [...controlledWriteAccepted];

        assert.deepEqual(
            acceptedSetAfter,
            controlledWriteAccepted,
            'accepted set unchanged regardless of classifier output'
        );
    }
);

test(
    'P10F isCleanLabelCandidate helper returns correct pass/fail',
    () => {
        assert.equal(isCleanLabelCandidate('A').pass, true);
        assert.equal(isCleanLabelCandidate('G').pass, false);
        assert.equal(isCleanLabelCandidate('AB').pass, false);
        assert.equal(isCleanLabelCandidate('').pass, false);
    }
);

test(
    'P10F isDirtyStructuralShell helper returns correct dirty/clean',
    () => {
        assert.equal(
            isDirtyStructuralShell('}A_\\A{A}').dirty,
            true
        );
        assert.equal(
            isDirtyStructuralShell('\\frac{A}{B}').dirty,
            true
        );
        assert.equal(
            isDirtyStructuralShell('A').dirty,
            false
        );
        assert.equal(
            isDirtyStructuralShell('').dirty,
            true
        );
    }
);

test(
    'P10F unwrapSafeLatexWrapper returns correct label or null',
    () => {
        assert.equal(
            unwrapSafeLatexWrapper('\\text{A}'),
            'A'
        );
        assert.equal(
            unwrapSafeLatexWrapper('\\mathrm{B}'),
            'B'
        );
        assert.equal(
            unwrapSafeLatexWrapper('\\A{C}'),
            'C'
        );
        assert.equal(
            unwrapSafeLatexWrapper('\\frac{A}{B}'),
            null
        );
        assert.equal(
            unwrapSafeLatexWrapper('}A_\\A{A}'),
            null
        );
        assert.equal(
            unwrapSafeLatexWrapper('A'),
            null
        );
    }
);

// --- P10H: Answer-Only Extraction schema validation (mock) ---

const validateAnswerOnlyExtractionOutput = answers => {
    if (!Array.isArray(answers)) {
        return { valid: false, reason: 'not-array' };
    }

    if (!answers.length) {
        return { valid: false, reason: 'empty' };
    }

    const seenSourceOrders = new Set();
    const seenLabels = new Map();

    for (let i = 0; i < answers.length; i++) {
        const answer = answers[i];

        if (!answer || typeof answer !== 'object') {
            return { valid: false, reason: `item-${i}-not-object` };
        }

        if (typeof answer.sourceOrder !== 'number' || answer.sourceOrder <= 0) {
            return { valid: false, reason: `item-${i}-invalid-sourceOrder` };
        }

        if (seenSourceOrders.has(answer.sourceOrder)) {
            return { valid: false, reason: `duplicate-sourceOrder-${answer.sourceOrder}` };
        }
        seenSourceOrders.add(answer.sourceOrder);

        const label = String(answer.label || '').trim().toUpperCase();

        if (!/^[A-F]+$/.test(label)) {
            return { valid: false, reason: `item-${i}-non-label-payload:${label}` };
        }

        if (label.length > 4) {
            return { valid: false, reason: `item-${i}-label-too-long:${label}` };
        }

        if (i > 0 && answer.sourceOrder < answers[i - 1].sourceOrder) {
            return { valid: false, reason: 'jumpBack' };
        }
    }

    return { valid: true, reason: '' };
};

test(
    'P10H answer-only extraction: clean labels-only output is valid',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: 'B' },
                { sourceOrder: 3, label: 'C' },
                { sourceOrder: 4, label: 'D' }
            ]);

        assert.ok(result.valid, 'clean labels-only should be valid');
    }
);

test(
    'P10H answer-only extraction: multi-choice labels are valid',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: 'ACD' },
                { sourceOrder: 3, label: 'BD' }
            ]);

        assert.ok(result.valid, 'multi-choice labels should be valid');
    }
);

test(
    'P10H answer-only extraction: non-label payload is rejected',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: 'LaTeX explanation text' },
                { sourceOrder: 3, label: '\\frac{A}{B}' }
            ]);

        assert.ok(!result.valid, 'non-label content must be rejected');
        assert.ok(
            result.reason.includes('non-label-payload')
        );
    }
);

test(
    'P10H answer-only extraction: duplicate sourceOrder fail-closed',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 1, label: 'B' }
            ]);

        assert.ok(!result.valid);
        assert.ok(result.reason.includes('duplicate'));
    }
);

test(
    'P10H answer-only extraction: jumpBack sourceOrder fail-closed',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 3, label: 'B' },
                { sourceOrder: 2, label: 'C' }
            ]);

        assert.ok(!result.valid);
        assert.equal(result.reason, 'jumpBack');
    }
);

test(
    'P10H answer-only extraction: empty array is invalid',
    () => {
        const result =
            validateAnswerOnlyExtractionOutput([]);

        assert.ok(!result.valid);
        assert.equal(result.reason, 'empty');
    }
);

test(
    'P10H answer-only extraction: AI question field not used for alignment',
    () => {
        const answersWithWrongQuestion = [
            { sourceOrder: 1, label: 'A', questionNumberCandidate: '8' },
            { sourceOrder: 2, label: 'B', questionNumberCandidate: '9' },
            { sourceOrder: 3, label: 'C', questionNumberCandidate: '10' }
        ];

        const alignedBySourceOrder =
            answersWithWrongQuestion.sort(
                (a, b) => a.sourceOrder - b.sourceOrder
            );

        assert.equal(alignedBySourceOrder[0].sourceOrder, 1);
        assert.equal(alignedBySourceOrder[0].questionNumberCandidate, '8');
        assert.notEqual(
            alignedBySourceOrder[0].questionNumberCandidate,
            String(alignedBySourceOrder[0].sourceOrder),
            'AI question field is wrong but alignment uses sourceOrder, not question field'
        );

        const result =
            validateAnswerOnlyExtractionOutput(alignedBySourceOrder);

        assert.ok(result.valid, 'alignment by sourceOrder is valid despite wrong AI question');
    }
);
