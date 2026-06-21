const test =
    require('node:test');

const assert =
    require('node:assert/strict');

// --- P10K-B: Route B answer-only AI pass schema validator (mock design) ---

const ROUTE_B_SCHEMA = {
    mode: 'answer-only',
    items: [],
    warnings: []
};

const isValidRouteBLabel = label => {
    const clean =
        String(label || '').trim().toUpperCase();

    if (!clean) return { valid: false, reason: 'empty' };

    if (/\\[a-zA-Z]/.test(clean)) {
        return { valid: false, reason: 'contains-latex' };
    }

    if (/[一-鿿]/.test(clean)) {
        return { valid: false, reason: 'contains-explanation-text' };
    }

    if (!/^[A-F]{1,4}$/.test(clean)) {
        return { valid: false, reason: 'invalid-label-format' };
    }

    return { valid: true, reason: '' };
};

const validateRouteBOutput = (output, expectedQuestionNumbers = []) => {
    if (!output || typeof output !== 'object') {
        return { valid: false, reason: 'not-object' };
    }

    if (!Array.isArray(output.items)) {
        return { valid: false, reason: 'items-not-array' };
    }

    if (!output.items.length) {
        return {
            valid: false,
            mode: 'fail-closed',
            reason: 'empty-items',
            candidates: [],
            warnings: ['no-items-in-ai-output']
        };
    }

    const candidates = [];
    const warnings = [];
    const seenSourceOrders = new Set();

    for (let i = 0; i < output.items.length; i++) {
        const item = output.items[i];

        if (!item || typeof item !== 'object') {
            warnings.push({ index: i, code: 'invalid-item-object' });
            continue;
        }

        const sourceOrder =
            Number(item.sourceOrder);

        if (!Number.isInteger(sourceOrder) || sourceOrder <= 0) {
            warnings.push({ index: i, code: 'invalid-sourceOrder' });
            continue;
        }

        if (seenSourceOrders.has(sourceOrder)) {
            return {
                valid: false,
                mode: 'fail-closed',
                reason: 'duplicate-sourceOrder',
                candidates,
                warnings: [...warnings, { index: i, code: 'duplicate-sourceOrder' }]
            };
        }
        seenSourceOrders.add(sourceOrder);

        const labelCheck =
            isValidRouteBLabel(item.label);

        if (!labelCheck.valid) {
            candidates.push({
                sourceOrder,
                questionNumberCandidate: item.questionNumberCandidate || null,
                label: null,
                rawEvidenceShape: 'missing-or-invalid',
                reason: labelCheck.reason
            });
            warnings.push({
                index: i,
                code: 'label-invalid',
                detail: labelCheck.reason,
                originalLabel: String(item.label || '').slice(0, 80)
            });
            continue;
        }

        candidates.push({
            sourceOrder,
            questionNumberCandidate: item.questionNumberCandidate || null,
            label: String(item.label || '').trim().toUpperCase(),
            rawEvidenceShape: 'label-only',
            confidence: item.confidence || 'high'
        });
    }

    for (let i = 1; i < candidates.length; i++) {
        if (candidates[i].sourceOrder < candidates[i - 1].sourceOrder) {
            return {
                valid: false,
                mode: 'fail-closed',
                reason: 'jumpBack',
                candidates,
                candidateQuestionNumbers: [],
                missingCount: 0,
                warnings: [...warnings, { code: 'jumpBack' }]
            };
        }
    }

    const expected =
        (expectedQuestionNumbers || []).map(String);

    const candidateQuestionNumbers =
        expected.slice(0, candidates.length);

    const missingCount =
        Math.max(0, expected.length - candidates.length);

    const mode =
        candidates.length === expected.length && warnings.length === 0
            ? 'full'
            : candidates.length > 0
                ? 'pass-safe-partial'
                : 'fail-closed';

    return {
        valid: warnings.length === 0,
        mode,
        reason: warnings.length ? 'validation-warnings' : '',
        candidates,
        candidateQuestionNumbers,
        missingCount,
        warnings
    };
};

const ROUTE_B_PROMPT_DRAFT = `
You are extracting ONLY answer labels from a math exam answer page.
Rules:
1. Output ONLY the answer label (A/B/C/D/E/F or combinations like ACD, BD).
2. Do NOT output explanations, solutions, formulas, or question text.
3. Do NOT output LaTeX or math expressions.
4. Output one item per answer, in the order they appear on the page.
5. If you cannot determine the label, output null for that item.
6. If the content is ambiguous, output null rather than guessing.
7. Output strict JSON matching the specified schema.
`.trim();

// --- Tests ---

test(
    'P10K-B Route B: clean labels-only AI output passes validator',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A', confidence: 'high' },
                { sourceOrder: 2, label: 'B', confidence: 'high' },
                { sourceOrder: 3, label: 'C', confidence: 'high' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2, 3]);

        assert.ok(result.valid);
        assert.equal(result.mode, 'full');
        assert.equal(result.candidates.length, 3);
    }
);

test(
    'P10K-B Route B: Q8/Q9 clean labels from AI output are candidate evidence only',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' }, { sourceOrder: 2, label: 'B' },
                { sourceOrder: 3, label: 'C' }, { sourceOrder: 4, label: 'D' },
                { sourceOrder: 5, label: 'A' }, { sourceOrder: 6, label: 'B' },
                { sourceOrder: 7, label: 'C' }, { sourceOrder: 8, label: 'D' },
                { sourceOrder: 9, label: 'A' }, { sourceOrder: 10, label: 'B' },
                { sourceOrder: 13, label: 'C' }, { sourceOrder: 15, label: 'D' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15]);

        assert.ok(result.valid);
        assert.equal(result.mode, 'full');

        const q8 =
            result.candidates.find(
                (c, i) => result.candidateQuestionNumbers[i] === '8'
            );

        assert.ok(q8, 'Q8 must have a candidate');
        assert.equal(q8.label, 'D');
        assert.equal(q8.rawEvidenceShape, 'label-only');

        const q9 =
            result.candidates.find(
                (c, i) => result.candidateQuestionNumbers[i] === '9'
            );

        assert.ok(q9);
        assert.equal(q9.label, 'A');

        assert.ok(
            result.candidates.every(c => c.rawEvidenceShape === 'label-only'),
            'all candidates are evidence, not accepted'
        );
    }
);

test(
    'P10K-B Route B: label=null forms missing, not guessing',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: null },
                { sourceOrder: 3, label: 'C' }
            ],
            warnings: ['Q2 label unclear']
        };

        const result =
            validateRouteBOutput(output, [1, 2, 3]);

        assert.ok(!result.valid);
        assert.equal(result.mode, 'pass-safe-partial');
        assert.equal(result.candidates.length, 3);

        const q2Candidate =
            result.candidates[1];

        assert.equal(q2Candidate.label, null);
        assert.equal(q2Candidate.reason, 'empty');
    }
);

test(
    'P10K-B Route B: label with LaTeX rejected',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: '\\\\frac{A}{B}' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2]);

        assert.ok(!result.valid);
        assert.ok(
            result.warnings.some(w => w.code === 'label-invalid' &&
                w.detail === 'contains-latex')
        );
    }
);

test(
    'P10K-B Route B: label with explanation text rejected',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: '答案是B' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2]);

        assert.ok(!result.valid);
        assert.ok(
            result.warnings.some(w => w.code === 'label-invalid' &&
                w.detail === 'contains-explanation-text')
        );
    }
);

test(
    'P10K-B Route B: duplicate sourceOrder fail-closed',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 1, label: 'B' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2]);

        assert.equal(result.mode, 'fail-closed');
        assert.equal(result.reason, 'duplicate-sourceOrder');
    }
);

test(
    'P10K-B Route B: jumpBack fail-closed',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 3, label: 'C' },
                { sourceOrder: 2, label: 'B' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2, 3]);

        assert.equal(result.mode, 'fail-closed');
    }
);

test(
    'P10K-B Route B: AI questionNumberCandidate not trusted for alignment',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A', questionNumberCandidate: '8' },
                { sourceOrder: 2, label: 'B', questionNumberCandidate: '9' },
                { sourceOrder: 3, label: 'C', questionNumberCandidate: '10' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2, 3]);

        assert.ok(result.valid);

        assert.equal(
            result.candidateQuestionNumbers[0],
            '1'
        );
        assert.notEqual(
            result.candidateQuestionNumbers[0],
            output.items[0].questionNumberCandidate,
            'alignment uses expected sequence order, not AI questionNumberCandidate'
        );
    }
);

test(
    'P10K-B Route B: Route B candidate not accepted; controlled-write still truth gate',
    () => {
        const output = {
            mode: 'answer-only',
            items: [
                { sourceOrder: 1, label: 'A' },
                { sourceOrder: 2, label: 'B' }
            ],
            warnings: []
        };

        const result =
            validateRouteBOutput(output, [1, 2]);

        assert.ok(result.valid);

        const controlledWriteAccepted = ['1'];

        assert.ok(
            result.candidates[0].rawEvidenceShape === 'label-only',
            'Route B evidence is label-only, not accepted'
        );
        assert.ok(
            !controlledWriteAccepted.includes(
                result.candidateQuestionNumbers[1]
            ),
            'Route B candidate present but controlled-write still decides'
        );
    }
);

test(
    'P10K-B Route B: prompt draft exists and includes key rules',
    () => {
        assert.ok(ROUTE_B_PROMPT_DRAFT.length > 50);
        assert.ok(
            ROUTE_B_PROMPT_DRAFT.includes('answer label'),
            'prompt must mention answer label'
        );
        assert.ok(
            ROUTE_B_PROMPT_DRAFT.includes('null'),
            'prompt must mention null for unclear answers'
        );
        assert.ok(
            ROUTE_B_PROMPT_DRAFT.includes('JSON'),
            'prompt must require JSON'
        );
        assert.ok(
            ROUTE_B_PROMPT_DRAFT.includes('NOT'),
            'prompt must include negative constraints (NOT)'
        );
    }
);
