const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    buildSupportRepairPlan,
    applySupportRepairsFillOnly,
    repairChoiceOptions,
    tryRepairedCandidate
} =
    require(
        '../qisi-support-repair.js'
    );

test(
    'builds an answer-only repair request when solution already exists',
    () => {
        const plan =
            buildSupportRepairPlan({
                blocks: [{
                    questionNumber:
                        '12',

                    rawBlock:
                        '12 answer empty\nsolution max is $2$',

                    hasSolutionLabel:
                        true,

                    sourcePage:
                        5,

                    questionEvidence:
                        'explicit-support-marker'
                }],

                answers: [],

                solutions: [{
                    question:
                        '12',

                    solution:
                        'max is $2$'
                }],

                requireAnswers:
                    true,

                requireSolutions:
                    true
            });

        assert.equal(
            plan.length,
            1
        );

        assert.equal(
            plan[0]
                .questionNumber,
            '12'
        );

        assert.deepEqual(
            plan[0]
                .missingFields,
            ['answer']
        );

        assert.equal(
            plan[0]
                .existingSolution,
            'max is $2$'
        );
    }
);

test(
    'does not build a repair request when all required fields exist',
    () => {
        const plan =
            buildSupportRepairPlan({
                blocks: [{
                    questionNumber:
                        '1',

                    rawBlock:
                        '1 answer A\nsolution detail',

                    hasSolutionLabel:
                        true
                }],

                answers: [{
                    question:
                        '1',

                    answer:
                        'A'
                }],

                solutions: [{
                    question:
                        '1',

                    solution:
                        'detail'
                }],

                requireAnswers:
                    true,

                requireSolutions:
                    true
            });

        assert.deepEqual(
            plan,
            []
        );
    }
);

test(
    'fills a missing answer without replacing an existing solution',
    () => {
        const originalSolution = {
            question:
                '12',

            solution:
                'OCR original complete solution',

            source:
                'ocr'
        };

        const result =
            applySupportRepairsFillOnly({
                answers: [],

                solutions: [
                    originalSolution
                ],

                repairedAnswers: [{
                    question:
                        '12',

                    answer:
                        '$\\frac{1+\\sqrt{2}}{2}$'
                }],

                repairedSolutions: [{
                    question:
                        '12',

                    solution:
                        'AI generated longer solution should not overwrite'
                }],

                allowedQuestionNumbers:
                    ['12']
            });

        assert.equal(
            result.answers.length,
            1
        );

        assert.equal(
            result.answers[0]
                .answer,
            '$\\frac{1+\\sqrt{2}}{2}$'
        );

        assert.equal(
            result.solutions.length,
            1
        );

        assert.strictEqual(
            result.solutions[0],
            originalSolution
        );

        assert.deepEqual(
            result.diagnostics
                .skippedExisting,
            [{
                kind:
                    'solution',

                questionNumber:
                    '12'
            }]
        );
    }
);

test(
    'never overwrites an existing answer',
    () => {
        const existingAnswer = {
            question:
                '1',

            answer:
                'A'
        };

        const result =
            applySupportRepairsFillOnly({
                answers: [
                    existingAnswer
                ],

                solutions: [],

                repairedAnswers: [{
                    question:
                        '1',

                    answer:
                        'B'
                }],

                allowedQuestionNumbers:
                    ['1']
            });

        assert.equal(
            result.answers.length,
            1
        );

        assert.strictEqual(
            result.answers[0],
            existingAnswer
        );

        assert.equal(
            result.answers[0]
                .answer,
            'A'
        );
    }
);

test(
    'rejects a repaired field for an unrequested question number',
    () => {
        const result =
            applySupportRepairsFillOnly({
                answers: [],
                solutions: [],

                repairedAnswers: [{
                    question:
                        '99',

                    answer:
                        'A'
                }],

                allowedQuestionNumbers:
                    ['12']
            });

        assert.deepEqual(
            result.answers,
            []
        );

        assert.deepEqual(
            result.diagnostics
                .skippedUnknown,
            [{
                kind:
                    'answer',

                questionNumber:
                    '99'
            }]
        );
    }
);

test(
    'repairChoiceOptions keeps existing usable options and cleans stem',
    () => {
        const result =
            repairChoiceOptions(
                '  单选题：已知 $x$ ',
                [' A. 1 ', 'B. 2', '', ''],
                '单选题',
                {
                    sanitizeChoiceOptions:
                        options =>
                            options.map(
                                option =>
                                    String(option || '')
                                        .trim()
                            ),

                    normalizeMathTextForLatexSafe:
                        value =>
                            `math:${value}`,

                    stripQuestionSectionNoise:
                        value =>
                            String(value || '')
                                .replace(
                                    '单选题：',
                                    ''
                                )
                                .trim(),

                    splitQuestionForStorage:
                        () => {
                            throw new Error(
                                'should not split when options are present'
                            );
                        }
                }
            );

        assert.deepEqual(
            result,
            {
                stem:
                    'math:已知 $x$',

                options:
                    ['A. 1', 'B. 2', '', '']
            }
        );
    }
);

test(
    'repairChoiceOptions splits stem when options are missing',
    () => {
        const result =
            repairChoiceOptions(
                '题干 A. 甲 B. 乙',
                ['', '', '', ''],
                '',
                {
                    sanitizeChoiceOptions:
                        options =>
                            options.map(
                                option =>
                                    String(option || '')
                                        .trim()
                            ),

                    normalizeMathTextForLatexSafe:
                        value =>
                            String(value || '')
                                .trim(),

                    stripQuestionSectionNoise:
                        value =>
                            String(value || '')
                                .replace(
                                    '噪声',
                                    ''
                                ),

                    splitQuestionForStorage:
                        () => ({
                            stem:
                                '噪声题干',

                            options:
                                ['甲', '乙', '', '']
                        })
                }
            );

        assert.deepEqual(
            result,
            {
                stem:
                    '题干',

                options:
                    ['甲', '乙', '', '']
            }
        );
    }
);

test(
    'repairChoiceOptions falls back safely for malformed inputs',
    () => {
        const result =
            repairChoiceOptions(
                null,
                null,
                null
            );

        assert.deepEqual(
            result,
            {
                stem:
                    '',

                options:
                    []
            }
        );
    }
);

test(
    'repairChoiceOptions never treats set-membership A as an option in an explicit non-choice question',
    () => {
        let splitCalled = false;
        const stem = String.raw`集合$B=\left\{x\left|x\in A\text{且}\frac{1}{x}\in A\right.\right\}$`;
        const result = repairChoiceOptions(stem, [], '解答题', {
            sanitizeChoiceOptions: value => Array.isArray(value) ? value : [],
            normalizeMathTextForLatexSafe: value => value,
            stripQuestionSectionNoise: value => value,
            splitQuestionForStorage: () => {
                splitCalled = true;
                return { stem: 'wrong', options: ['wrong A', 'wrong B'] };
            }
        });

        assert.equal(splitCalled, false);
        assert.equal(result.stem, stem);
        assert.deepEqual(result.options, []);
    }
);

test(
    'tryRepairedCandidate repairs LaTeX JSON and returns parsed questions',
    () => {
        const result =
            tryRepairedCandidate({
                candidate:
                    '{"questions":[{"stem":"\\\\frac{x}{2}"}]}',

                lastParseError:
                    new Error('bad escape'),

                escapeLatexBackslashesInJsonCandidate:
                    () => ({
                        text:
                            '{"questions":[{"stem":"\\\\frac{x}{2}"}]}',

                        changed:
                            true,

                        repairCount:
                            1,

                        commands:
                            ['frac']
                    }),

                extractQuestionArray:
                    parsed =>
                        parsed.questions || []
            });

        assert.equal(
            result.result.ok,
            true
        );

        assert.equal(
            result.result.method,
            'json-latex-backslash-repair'
        );

        assert.deepEqual(
            result.result.questions,
            [{
                stem:
                    '\\frac{x}{2}'
            }]
        );

        assert.equal(
            result.repairDiagnostics
                .originalParseMessage,
            'bad escape'
        );
    }
);

test(
    'tryRepairedCandidate reports parsed JSON without questions',
    () => {
        const result =
            tryRepairedCandidate({
                candidate:
                    '{"items":[]}',

                escapeLatexBackslashesInJsonCandidate:
                    () => ({
                        text:
                            '{"items":[]}',

                        changed:
                            true,

                        repairCount:
                            1,

                        commands:
                            ['sqrt']
                    }),

                extractQuestionArray:
                    () => []
            });

        assert.equal(
            result.result,
            false
        );

        assert.deepEqual(
            result.parsedWithoutQuestions,
            {
                items:
                    []
            }
        );
    }
);

test(
    'tryRepairedCandidate is inert when repair does not change text',
    () => {
        const result =
            tryRepairedCandidate({
                candidate:
                    '{"questions":[]}',

                escapeLatexBackslashesInJsonCandidate:
                    () => ({
                        text:
                            '{"questions":[]}',

                        changed:
                            false,

                        repairCount:
                            0,

                        commands:
                            []
                    }),

                extractQuestionArray:
                    () => {
                        throw new Error(
                            'should not parse unchanged candidate'
                        );
                    }
            });

        assert.deepEqual(
            result,
            {
                result:
                    false,

                parsedWithoutQuestions:
                    null,

                repairDiagnostics:
                    null
            }
        );
    }
);

// --- Vision JSON LaTeX backslash escape repair ---

// Known LaTeX commands for the detection/repair logic.
const LATEX_JSON_BACKSLASH_REPAIR_COMMANDS = new Set([
    'triangle', 'frac', 'sqrt', 'sin', 'cos', 'tan',
    'overline', 'begin', 'end', 'left', 'right', 'angle',
    'Delta', 'theta', 'alpha', 'beta', 'gamma', 'pi',
    'circ', 'cdot', 'times', 'le', 'ge', 'neq',
    'parallel', 'perp', 'vec', 'overrightarrow', 'ln', 'log',
    'lim', 'text', 'mathrm', 'mathbf', 'mathbb', 'cases'
]);

function readLatexJsonCommandAt(source, slashIndex) {
    const next = source[slashIndex + 1] || '';
    if (!/[A-Za-z]/.test(next)) return null;
    let end = slashIndex + 1;
    while (end < source.length && /[A-Za-z]/.test(source[end])) end += 1;
    const command = source.slice(slashIndex + 1, end);
    return { command, end, known: LATEX_JSON_BACKSLASH_REPAIR_COMMANDS.has(command) };
}

function escapeLatexBackslashesInJsonCandidate(text) {
    const source = String(text || '');
    let result = '';
    let inString = false;
    let repairCount = 0;
    const commands = new Set();

    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (!inString) {
            result += ch;
            if (ch === '"') inString = true;
            continue;
        }
        if (ch === '"') { inString = false; result += ch; continue; }
        if (ch !== '\\') { result += ch; continue; }

        const nxt = source[i + 1] || '';
        if (!nxt) { result += ch; continue; }

        // \uXXXX valid JSON unicode escape — check before command reading.
        if (nxt === 'u') {
            const hex = source.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                result += ch + nxt + hex;
                i += 5;
                continue;
            }
        }

        const cmd = readLatexJsonCommandAt(source, i);
        if (cmd) {
            // Single-letter valid JSON escapes (b,f,n,r,t) → pass through.
            if (!cmd.known && cmd.command.length === 1 && /[bfnrt]/.test(cmd.command)) {
                result += '\\' + cmd.command;
                i = cmd.end - 1;
                continue;
            }
            // Known LaTeX, multi-letter unknown, or single non-escape letter → repair.
            result += '\\\\' + cmd.command;
            repairCount += 1;
            if (cmd.known) commands.add(cmd.command);
            i = cmd.end - 1;
            continue;
        }

        if (nxt === '\\' || nxt === '"' || nxt === '/' ||
            nxt === 'b' || nxt === 'f' || nxt === 'n' ||
            nxt === 'r' || nxt === 't') {
            result += ch + nxt;
            i += 1;
            continue;
        }

        if (nxt === 'u') {
            const hex = source.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                result += ch + nxt + hex;
                i += 5;
                continue;
            }
        }

        // GENERALIZED FIX: any other backslash → double-escape it.
        result += '\\\\';
        repairCount += 1;
    }

    return { text: result, changed: result !== source, repairCount, commands: [...commands] };
}

test('escapeLatexBackslashes repairs known LaTeX command', () => {
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"角 \\alpha 的值"}'
    );
    assert.equal(r.changed, true);
    assert.ok(r.commands.includes('alpha'));
    // The result should parse as valid JSON.
    JSON.parse(r.text);
});

test('escapeLatexBackslashes repairs UNKNOWN LaTeX command — generalized fix', () => {
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"\\therefore x=1"}'
    );
    assert.equal(r.changed, true);
    assert.ok(r.repairCount >= 1, 'should repair unknown command');
    // Must parse as valid JSON.
    JSON.parse(r.text);
    const parsed = JSON.parse(r.text);
    // The stem value should contain \therefore (single backslash in value).
    assert.ok(parsed.stem.includes('\\therefore'));
});

test('escapeLatexBackslashes repairs multiple unknown commands', () => {
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"\\because \\therefore x=1, \\pm 2"}'
    );
    assert.equal(r.changed, true);
    assert.ok(r.repairCount >= 3, 'should repair 3 unknown commands');
    JSON.parse(r.text);
});

test('escapeLatexBackslashes preserves valid JSON escapes', () => {
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"第一行\\n第二行","quote":"他说\\"好\\"","uni":"\\u4e2d"}'
    );
    assert.equal(r.changed, false, 'valid JSON escapes should not be changed');
    const parsed = JSON.parse(r.text);
    assert.equal(parsed.stem, '第一行\n第二行');
    assert.equal(parsed.quote, '他说"好"');
    assert.equal(parsed.uni, '中');
});

test('escapeLatexBackslashes preserves already-escaped LaTeX', () => {
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"\\\\frac{1}{2}"}'
    );
    // Already-escaped \\frac should NOT be touched.
    assert.equal(r.changed, false);
    const parsed = JSON.parse(r.text);
    assert.equal(parsed.stem, '\\frac{1}{2}');
});

test('escapeLatexBackslashes handles structure error — still repairs escapes', () => {
    // JSON with a trailing comma (structural error) BUT also LaTeX escapes.
    const r = escapeLatexBackslashesInJsonCandidate(
        '{"stem":"\\alpha",}'
    );
    // Should have repaired \alpha but the trailing comma remains.
    assert.equal(r.changed, true);
    // JSON.parse will still fail due to trailing comma — this is fail-closed.
    assert.throws(() => JSON.parse(r.text));
});

test('escapeLatexBackslashes empty and null are safe', () => {
    assert.equal(escapeLatexBackslashesInJsonCandidate('').text, '');
    assert.equal(escapeLatexBackslashesInJsonCandidate(null).text, '');
});

test('tryRepairedCandidate with generalized repair handles unknown LaTeX', () => {
    const result = tryRepairedCandidate({
        candidate: '{"questions":[{"stem":"\\therefore x=1"}]}',
        lastParseError: new Error('Bad escaped character'),
        escapeLatexBackslashesInJsonCandidate,
        extractQuestionArray: (parsed) => parsed.questions || []
    });

    assert.equal(result.result.ok, true);
    assert.equal(result.result.method, 'json-latex-backslash-repair');
    assert.equal(result.result.questions[0].stem, '\\therefore x=1');
});
