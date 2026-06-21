const test =
    require('node:test');

const assert =
    require('node:assert/strict');

// --- P10E Design: safe wrapper unwrap candidate classifier ---
// These are DESIGN CANDIDATE rules, NOT business code.
// They define boundaries for what COULD be safely unwrapped
// without weakening controlled-write.

const SAFE_LATEX_COMMAND_ALLOWLIST = new Set([
    'text', 'mathrm', 'mathbf', 'mathit', 'mathsf', 'texttt',
    'textrm', 'textsf', 'textup', 'textnormal',
    'textbf', 'textit', 'emph',
    'A', 'B', 'C', 'D'
]);

const DIRTY_COMMAND_PATTERNS = [
    'frac', 'sqrt', 'sin', 'cos', 'tan', 'log', 'ln',
    'sum', 'int', 'lim', 'overline', 'underline',
    'vec', 'bar', 'hat', 'dot', 'angle', 'triangle',
    'cdot', 'times', 'boxed'
];

const isSafeLatexWrapper = value => {
    const text =
        String(value ?? '').trim();

    if (!text.startsWith('\\')) return false;

    const commandMatch =
        text.match(/^\\([A-Za-z]+)\s*\{([^}]*)\}\s*$/);

    if (!commandMatch) return false;

    const command =
        commandMatch[1];
    const inner =
        commandMatch[2].trim();

    if (!SAFE_LATEX_COMMAND_ALLOWLIST.has(command)) return false;

    if (!/^[A-Fa-f]$/.test(inner)) return false;

    if (DIRTY_COMMAND_PATTERNS.some(pattern =>
        pattern.toLowerCase() === command.toLowerCase()
    )) return false;

    return true;
};

const unwrapSafeLatexWrapper = value => {
    if (!isSafeLatexWrapper(value)) return null;

    const inner =
        value.match(/\{([^}]*)\}/)[1].trim();

    return inner.toUpperCase();
};

// --- Dirty structural shell classifier ---

const DIRTY_SHELL_PATTERNS = [
    // Underscore with letter/number suffix
    /^[A-Za-z]_\s*[A-Za-z0-9]/,
    // Structural shell with LaTeX payload
    /^[\}_]\s*[A-Za-z]?\s*_\s*\\/,
    // Fraction, sqrt, boxed
    /\\frac/,
    /\\sqrt/,
    /\\boxed/,
    // Math operator with letter
    /\\angle\s*[A-Za-z]/,
    // Trig functions with args
    /\\(?:sin|cos|tan)\s*[A-Za-z{]/,
    // Mix of letters and operators
    /[A-Za-z]\s*[+\-=]\s*[A-Za-z0-9]/,
    // Multiple letter groups without clear labels
    /^[A-Za-z]{2,}$/
];

const isDirtyStructuralShell = value => {
    const text =
        String(value ?? '').trim();

    if (!text) return { dirty: true, reason: 'empty' };

    if (text.length > 40) {
        return { dirty: true, reason: 'too-long-likely-mixed-content' };
    }

    for (const pattern of DIRTY_SHELL_PATTERNS) {
        if (pattern.test(text)) {
            return { dirty: true, reason: `matches-dirty-pattern:${pattern}` };
        }
    }

    return { dirty: false, reason: '' };
};

// --- Clean label candidate classifier ---

const CLEAN_LABEL_PATTERNS = [
    // Plain single letter A-F
    /^[A-Fa-f]$/,
    // Parenthesized (A) or （A）
    /^[（(]\s*[A-Fa-f]\s*[)）]$/,
    // Braced {A}
    /^\{\s*[A-Fa-f]\s*\}$/,
    // Answer-prefixed: 答案：A, 选A, 答 A
    /^(?:答案|答|选)\s*[:：]?\s*[A-Fa-f]$/,
    // Label with dot: A.
    /^[A-Fa-f][.。]$/
];

const isCleanLabelCandidate = value => {
    const text =
        String(value ?? '').trim();

    if (!text) return { clean: false, reason: 'empty' };

    for (const pattern of CLEAN_LABEL_PATTERNS) {
        if (pattern.test(text)) {
            return { clean: true, reason: `matches-clean-pattern:${pattern}` };
        }
    }

    return { clean: false, reason: 'no-clean-pattern-match' };
};

// --- Safe wrapper unwrap candidate ---

const classifyAnswerExtractionQuality = value => {
    const text =
        String(value ?? '').trim();

    if (!text) {
        return {
            eligible: false,
            category: 'empty',
            unwrapped: '',
            reason: 'empty answer text'
        };
    }

    const cleanCheck =
        isCleanLabelCandidate(text);

    if (cleanCheck.clean) {
        return {
            eligible: true,
            category: 'clean-label',
            unwrapped: text.replace(/[^A-Fa-f]/g, '').toUpperCase().slice(0, 1),
            reason: cleanCheck.reason
        };
    }

    if (isSafeLatexWrapper(text)) {
        const unwrapped =
            unwrapSafeLatexWrapper(text);

        return {
            eligible: true,
            category: 'safe-latex-wrapper',
            unwrapped,
            reason: 'safe LaTeX command wrapper with single A-F label inside'
        };
    }

    const dirtyCheck =
        isDirtyStructuralShell(text);

    if (dirtyCheck.dirty) {
        return {
            eligible: false,
            category: 'dirty-structural-shell',
            unwrapped: '',
            reason: dirtyCheck.reason
        };
    }

    return {
        eligible: false,
        category: 'unknown-format',
        unwrapped: '',
        reason: 'does not match any known clean or dirty pattern'
    };
};

// --- Tests ---

test(
    'P10E clean label candidates are eligible for direct acceptance',
    () => {
        const cleanCases = ['A', 'B', 'C', 'D', 'E', 'F', 'a', 'f'];

        for (const value of cleanCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                result.eligible,
                `'${value}' should be eligible as clean label`
            );
            assert.equal(
                result.category,
                'clean-label'
            );
            assert.equal(
                result.unwrapped,
                value.toUpperCase()
            );
        }
    }
);

test(
    'P10E parenthesized and prefixed labels are clean candidates',
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

            assert.ok(
                result.eligible,
                `'${input}' should be eligible as clean label`
            );
            assert.equal(
                result.unwrapped,
                expected
            );
        }
    }
);

test(
    'P10E safe LaTeX wrappers are eligible for unwrap',
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

            assert.ok(
                result.eligible,
                `'${input}' should be eligible as safe LaTeX wrapper`
            );
            assert.equal(
                result.category,
                'safe-latex-wrapper'
            );
            assert.equal(
                result.unwrapped,
                expected
            );
        }
    }
);

test(
    'P10E dirty structural shell }A_\\A{A} must NOT be eligible for simple unwrap',
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

            assert.ok(
                !result.eligible,
                `'${value}' must not be eligible for simple unwrap`
            );
            assert.ok(
                result.category === 'dirty-structural-shell' ||
                result.category === 'unknown-format',
                `'${value}' category should be dirty or unknown, got: ${result.category}`
            );
        }
    }
);

test(
    'P10E unsafe LaTeX commands must NOT be eligible for unwrap',
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
            const dirty =
                isDirtyStructuralShell(value);

            assert.ok(
                dirty.dirty,
                `'${value}' must be classified as dirty`
            );

            const result =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                !result.eligible,
                `'${value}' must not be eligible`
            );
        }
    }
);

test(
    'P10E mixed or long content is not eligible',
    () => {
        const mixedCases = [
            'AB',
            'A、B、C',
            'A+B',
            'a long text that is clearly not a clean answer label',
            '解析内容：这是解析而不是答案'
        ];

        for (const value of mixedCases) {
            const result =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                !result.eligible,
                `'${value}' must not be eligible for simple unwrap`
            );
        }
    }
);

test(
    'P10E empty answer is not eligible',
    () => {
        const result =
            classifyAnswerExtractionQuality('');

        assert.ok(!result.eligible);
        assert.equal(result.category, 'empty');
    }
);

test(
    'P10E extraction quality candidate does NOT equal controlled-write accepted',
    () => {
        const candidate =
            classifyAnswerExtractionQuality('\\text{A}');

        assert.ok(
            candidate.eligible,
            'LaTeX wrapper is a design candidate'
        );
        assert.equal(
            candidate.unwrapped,
            'A'
        );

        const actualAccepted =
            ['1', '3', '4', '5', '6', '7', '10', '13', '15'];

        assert.ok(
            candidate.eligible !==
                actualAccepted.includes(candidate.unwrapped),
            'candidate eligibility is independent of actual acceptance; ' +
            'being a candidate does not mean it IS accepted'
        );
    }
);

test(
    'P10E Q2-type LaTeX wrapper is a candidate but Q8/Q9-type dirty shell is not',
    () => {
        const q2Type =
            classifyAnswerExtractionQuality('\\A{A}');

        assert.ok(
            q2Type.eligible,
            'Q2-type \\A{A} should be eligible as safe LaTeX wrapper candidate'
        );
        assert.equal(
            q2Type.category,
            'safe-latex-wrapper'
        );

        const q8Type =
            classifyAnswerExtractionQuality('}A_\\A{A}');

        assert.ok(
            !q8Type.eligible,
            'Q8-type }A_\\A{A} must NOT be eligible'
        );
        assert.equal(
            q8Type.category,
            'dirty-structural-shell'
        );
    }
);

test(
    'P10E sequence safety: duplicate labels are not clean',
    () => {
        const duplicate =
            classifyAnswerExtractionQuality('AA');

        assert.ok(
            !duplicate.eligible,
            'AA should not be eligible as clean label'
        );
    }
);

test(
    'P10E truth gate: dirty shell must never enter baseline candidate',
    () => {
        const dirtyValues =
            ['}A_\\A{A}', 'x_A', '\\frac{A}{B}', 'AB', 'A+B'];

        const controlledWriteAccepted =
            ['1', '7', '10', '13', '15'];

        for (const value of dirtyValues) {
            const classification =
                classifyAnswerExtractionQuality(value);

            assert.ok(
                !classification.eligible,
                `dirty value '${value}' must not be eligible`
            );

            assert.ok(
                !controlledWriteAccepted.includes(
                    classification.unwrapped
                ),
                `unwrapped result of '${value}' must not be in accepted set`
            );
        }
    }
);
