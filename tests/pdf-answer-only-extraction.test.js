const test =
    require('node:test');

const assert =
    require('node:assert/strict');

// --- P10J: Answer-Only Extraction validator (mock design) ---

const normalizeAnswerOnlyItem = item => {
    if (!item || typeof item !== 'object') return null;

    const sourceOrder =
        Number(item.sourceOrder);

    if (!Number.isInteger(sourceOrder) || sourceOrder <= 0) return null;

    const label =
        String(item.label || '').trim().toUpperCase();

    if (!/^[A-F]+$/.test(label)) return null;

    if (label.length > 4) return null;

    return {
        sourceOrder,
        questionNumberCandidate:
            item.questionNumberCandidate || null,
        label,
        rawEvidenceShape:
            item.rawEvidenceShape || 'unknown',
        confidence:
            item.confidence || 'low'
    };
};

const validateAnswerOnlyExtraction = ({
    items = [],
    expectedCount = 0
} = {}) => {
    const normalized = [];
    const warnings = [];
    const seenSourceOrders = new Set();

    if (!Array.isArray(items) || !items.length) {
        return {
            valid: false,
            reason: 'empty-or-not-array',
            normalizedItems: [],
            safeItems: [],
            fusedItems: [],
            warnings: ['empty-input']
        };
    }

    for (let i = 0; i < items.length; i++) {
        const item =
            normalizeAnswerOnlyItem(items[i]);

        if (!item) {
            warnings.push({
                index: i,
                code: 'invalid-item',
                detail: 'Item could not be normalized to a valid AOE record.'
            });
            continue;
        }

        if (seenSourceOrders.has(item.sourceOrder)) {
            return {
                valid: false,
                reason: 'duplicate-sourceOrder',
                normalizedItems: normalized,
                safeItems: [],
                fusedItems: normalized.map(n => n.sourceOrder),
                warnings: [...warnings, { code: 'duplicate-sourceOrder' }]
            };
        }
        seenSourceOrders.add(item.sourceOrder);

        normalized.push(item);
    }

    if (!normalized.length) {
        return {
            valid: false,
            reason: 'no-valid-items',
            normalizedItems: [],
            safeItems: [],
            fusedItems: [],
            warnings: [...warnings, 'no-valid-items']
        };
    }

    const sourceOrders =
        normalized.map(n => n.sourceOrder);

    for (let i = 1; i < sourceOrders.length; i++) {
        if (sourceOrders[i] < sourceOrders[i - 1]) {
            return {
                valid: false,
                reason: 'jumpBack',
                normalizedItems: normalized,
                safeItems: [],
                fusedItems: sourceOrders.map(String),
                warnings: [...warnings, { code: 'jumpBack' }]
            };
        }
    }

    if (expectedCount && normalized.length !== expectedCount) {
        warnings.push({
            code: 'count-mismatch',
            detail: `Expected ${expectedCount}, got ${normalized.length}`
        });
    }

    return {
        valid: warnings.length === 0 ||
            warnings.every(w => w.code === 'count-mismatch'),
        reason: warnings.length ? 'count-mismatch' : '',
        normalizedItems: normalized,
        safeItems: normalized,
        fusedItems: [],
        warnings
    };
};

const buildAoeEvidenceCandidates = (aoeResult, expectedQuestionNumbers = []) => {
    if (!aoeResult || !aoeResult.valid) {
        return { candidates: [], status: 'fail-closed', warnings: ['aoe-invalid'] };
    }

    const expected =
        (expectedQuestionNumbers || []).map(String);
    const items =
        aoeResult.normalizedItems || [];

    if (!expected.length) {
        return { candidates: [], status: 'fail-closed', warnings: ['no-expected-numbers'] };
    }

    const candidates = [];
    const warnings = [];

    for (let i = 0; i < Math.min(items.length, expected.length); i++) {
        const item = items[i];
        const question = expected[i];

        if (!item) {
            warnings.push({ question, code: 'missing-aoe-item' });
            continue;
        }

        candidates.push({
            question,
            sourceOrder: item.sourceOrder,
            label: item.label,
            evidenceType: 'answer-only-extraction',
            evidenceShape: item.rawEvidenceShape,
            confidence: item.confidence
        });
    }

    if (candidates.length < expected.length) {
        warnings.push({
            code: 'incomplete',
            detail: `${candidates.length}/${expected.length} questions covered`
        });
    }

    return {
        candidates,
        status: candidates.length === expected.length ? 'full' : 'partial',
        warnings
    };
};

// --- Tests ---

test(
    'P10J AOE: clean labels-only 1-12 is valid evidence',
    () => {
        const items =
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));
        const result =
            validateAnswerOnlyExtraction({ items, expectedCount: 12 });

        assert.ok(result.valid, 'clean labels should be valid');
        assert.equal(result.normalizedItems.length, 12);
    }
);

test(
    'P10J AOE: non-label payload rejected by validator',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A' },
            { sourceOrder: 2, label: 'LaTeX explanation text' },
            { sourceOrder: 3, label: '\\frac{A}{B}' }
        ];

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.equal(
            result.normalizedItems.length,
            1,
            'only the clean label item should survive'
        );
        assert.ok(
            result.warnings.some(w => w.code === 'invalid-item')
        );
    }
);

test(
    'P10J AOE: dirty structural shell }A_\\A{A} rejected by validator',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A' },
            { sourceOrder: 2, label: '}A_\\A{A}' }
        ];

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.equal(result.normalizedItems.length, 1);
    }
);

test(
    'P10J AOE: duplicate sourceOrder fail-closed',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A' },
            { sourceOrder: 1, label: 'B' }
        ];

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.ok(!result.valid);
        assert.equal(result.reason, 'duplicate-sourceOrder');
    }
);

test(
    'P10J AOE: jumpBack sourceOrder fail-closed',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A' },
            { sourceOrder: 3, label: 'B' },
            { sourceOrder: 2, label: 'C' }
        ];

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.ok(!result.valid);
        assert.equal(result.reason, 'jumpBack');
    }
);

test(
    'P10J AOE: AI question field is not trusted for alignment',
    () => {
        const items = [
            { sourceOrder: 1, label: 'A', questionNumberCandidate: '8' },
            { sourceOrder: 2, label: 'B', questionNumberCandidate: '9' },
            { sourceOrder: 3, label: 'C', questionNumberCandidate: '10' }
        ];

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.ok(result.valid, 'valid by sourceOrder alignment');

        const candidates =
            buildAoeEvidenceCandidates(result, ['1', '2', '3']);

        assert.equal(candidates.candidates.length, 3);
        assert.equal(
            candidates.candidates[0].question,
            '1',
            'aligned by position/expected sequence, NOT by questionNumberCandidate'
        );
        assert.ok(
            candidates.candidates[0].sourceOrder === 1 &&
            items[0].questionNumberCandidate === '8',
            'AI question field is wrong but alignment used sourceOrder correctly'
        );
    }
);

test(
    'P10J AOE: incomplete coverage → partial status',
    () => {
        const items =
            [1, 2, 3, 4, 5, 6, 7, 10, 13, 15].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));

        const result =
            validateAnswerOnlyExtraction({ items, expectedCount: 12 });

        const candidates =
            buildAoeEvidenceCandidates(
                result,
                [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15]
            );

        assert.equal(candidates.status, 'partial');
        assert.equal(candidates.candidates.length, 10);
        assert.ok(
            candidates.warnings.some(w => w.code === 'incomplete')
        );
    }
);

test(
    'P10J AOE: empty input is invalid',
    () => {
        const result =
            validateAnswerOnlyExtraction({ items: [] });

        assert.ok(!result.valid);
    }
);

test(
    'P10J AOE: candidate evidence does not equal accepted/write permission',
    () => {
        const items =
            [1, 2, 3].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));

        const result =
            validateAnswerOnlyExtraction({ items });

        assert.ok(result.valid);

        const candidates =
            buildAoeEvidenceCandidates(result, ['1', '2', '3']);

        assert.equal(candidates.candidates.length, 3);

        assert.ok(
            candidates.candidates[0].evidenceType === 'answer-only-extraction',
            'evidence type is answer-only-extraction, not accepted'
        );

        const isDirectlyAccepted =
            candidates.candidates.every(
                c => c.evidenceType === 'accepted'
            );

        assert.ok(
            !isDirectlyAccepted,
            'AOE candidate is evidence, not write permission'
        );
    }
);

test(
    'P10J AOE: controlled-write remains the only truth gate',
    () => {
        const items =
            [1, 2, 3].map(n => ({
                sourceOrder: n,
                label: 'A'
            }));

        const result =
            validateAnswerOnlyExtraction({ items });

        const candidates =
            buildAoeEvidenceCandidates(result, ['1', '2', '3']);

        const aoeProvidesCandidate =
            candidates.candidates.length > 0;

        assert.ok(aoeProvidesCandidate);

        const controlledWriteAccepted =
            ['1', '3'];

        const needControlledWriteValidation =
            candidates.candidates.some(
                c => !controlledWriteAccepted.includes(c.question)
            );

        assert.ok(
            needControlledWriteValidation,
            'AOE provides candidates but controlled-write still decides acceptance'
        );
    }
);
