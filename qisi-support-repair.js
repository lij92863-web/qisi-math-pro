(function (root, factory) {
    const api = factory();

    root.Qisi =
        root.Qisi || {};

    root.Qisi.SupportRepair =
        api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,

    function () {
        'use strict';

        const LATEX_JSON_BACKSLASH_REPAIR_COMMANDS =
            new Set([
                'triangle', 'frac', 'sqrt', 'sin', 'cos', 'tan',
                'overline', 'begin', 'end', 'left', 'right', 'angle',
                'Delta', 'theta', 'alpha', 'beta', 'gamma', 'pi',
                'circ', 'cdot', 'times', 'le', 'ge', 'neq',
                'parallel', 'perp', 'vec', 'overrightarrow', 'ln',
                'log', 'lim', 'text', 'mathrm', 'mathbf', 'mathbb',
                'cases'
            ]);

        const readLatexJsonCommandAt = (
            source = '',
            slashIndex = 0
        ) => {
            const next =
                source[slashIndex + 1] || '';

            if (!/[A-Za-z]/.test(next)) {
                return null;
            }

            let end =
                slashIndex + 1;

            while (
                end < source.length &&
                /[A-Za-z]/.test(source[end])
            ) {
                end += 1;
            }

            const command =
                source.slice(slashIndex + 1, end);

            return {
                command,
                end,
                known:
                    LATEX_JSON_BACKSLASH_REPAIR_COMMANDS
                        .has(command)
            };
        };

        const hasUnescapedLatexCommandInJsonString = (
            text = ''
        ) => {
            const source =
                String(text || '');
            let inString = false;

            for (
                let index = 0;
                index < source.length;
                index += 1
            ) {
                const char =
                    source[index];

                if (!inString) {
                    if (char === '"') {
                        inString = true;
                    }
                    continue;
                }

                if (char === '"') {
                    inString = false;
                    continue;
                }

                if (char !== '\\') {
                    continue;
                }

                const next =
                    source[index + 1] || '';

                if (next === '\\') {
                    index += 1;
                    continue;
                }

                const command =
                    readLatexJsonCommandAt(
                        source,
                        index
                    );

                if (command) {
                    if (command.known) {
                        return true;
                    }
                    if (command.command.length > 1) {
                        return true;
                    }
                    if (!/[bfnrt]/.test(command.command)) {
                        return true;
                    }
                    index =
                        command.end - 1;
                    continue;
                }

                if (next === 'u') {
                    const hex =
                        source.slice(
                            index + 2,
                            index + 6
                        );
                    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                        index += 5;
                        continue;
                    }
                }

                if (
                    next === '"' ||
                    next === '/' ||
                    /[bfnrt]/.test(next)
                ) {
                    index += 1;
                    continue;
                }

                return true;
            }

            return false;
        };

        const escapeLatexBackslashesInJsonCandidate = (
            text = ''
        ) => {
            const source =
                String(text || '');
            let result = '';
            let inString = false;
            let repairCount = 0;
            const commands =
                new Set();

            for (
                let index = 0;
                index < source.length;
                index += 1
            ) {
                const char =
                    source[index];

                if (!inString) {
                    result += char;
                    if (char === '"') {
                        inString = true;
                    }
                    continue;
                }

                if (char === '"') {
                    inString = false;
                    result += char;
                    continue;
                }

                if (char !== '\\') {
                    result += char;
                    continue;
                }

                const next =
                    source[index + 1] || '';

                if (!next) {
                    result += char;
                    continue;
                }

                if (next === 'u') {
                    const hex =
                        source.slice(
                            index + 2,
                            index + 6
                        );
                    if (/^[0-9a-fA-F]{4}$/.test(hex)) {
                        result +=
                            char + next + hex;
                        index += 5;
                        continue;
                    }
                }

                const command =
                    readLatexJsonCommandAt(
                        source,
                        index
                    );

                if (command) {
                    if (
                        !command.known &&
                        command.command.length === 1 &&
                        /[bfnrt]/.test(command.command)
                    ) {
                        result +=
                            '\\' + command.command;
                        index =
                            command.end - 1;
                        continue;
                    }

                    result +=
                        '\\\\' + command.command;
                    repairCount += 1;
                    if (command.known) {
                        commands.add(command.command);
                    }
                    index =
                        command.end - 1;
                    continue;
                }

                if (
                    next === '\\' ||
                    next === '"' ||
                    next === '/' ||
                    /[bfnrt]/.test(next)
                ) {
                    result +=
                        char + next;
                    index += 1;
                    continue;
                }

                result += '\\\\';
                repairCount += 1;
            }

            return {
                text: result,
                changed:
                    result !== source,
                repairCount,
                commands:
                    [...commands]
            };
        };

        const normalizeQuestionNumber = (
            value
        ) => {
            const text =
                String(value || '')
                    .replace(
                        /[０-９]/g,
                        char =>
                            String.fromCharCode(
                                char.charCodeAt(0) -
                                65248
                            )
                    );

            const match =
                text.match(
                    /\d{1,3}/
                );

            if (!match) {
                return '';
            }

            const number =
                Number(match[0]);

            return (
                Number.isInteger(number) &&
                number > 0
            )
                ? String(number)
                : '';
        };

        const hasFieldValue = (
            value
        ) =>
            Boolean(
                String(value || '')
                    .trim()
            );

        const buildValueMap = (
            items = [],
            valueKey = ''
        ) => {
            const map =
                new Map();

            for (
                const item of
                items || []
            ) {
                const questionNumber =
                    normalizeQuestionNumber(
                        item?.question
                    );

                const value =
                    String(
                        item?.[valueKey] ||
                        ''
                    ).trim();

                if (
                    !questionNumber ||
                    !value ||
                    map.has(
                        questionNumber
                    )
                ) {
                    continue;
                }

                map.set(
                    questionNumber,
                    value
                );
            }

            return map;
        };

        const buildSupportRepairPlan = ({
            blocks = [],
            answers = [],
            solutions = [],
            requireAnswers = true,
            requireSolutions = false
        } = {}) => {
            const answerMap =
                buildValueMap(
                    answers,
                    'answer'
                );

            const solutionMap =
                buildValueMap(
                    solutions,
                    'solution'
                );

            const requests = [];
            const seenQuestionNumbers =
                new Set();

            for (
                const block of
                blocks || []
            ) {
                const questionNumber =
                    normalizeQuestionNumber(
                        block?.questionNumber
                    );

                if (
                    !questionNumber ||
                    seenQuestionNumbers.has(
                        questionNumber
                    )
                ) {
                    continue;
                }

                seenQuestionNumbers.add(
                    questionNumber
                );

                const missingFields = [];

                if (
                    requireAnswers &&
                    !answerMap.has(
                        questionNumber
                    )
                ) {
                    missingFields.push(
                        'answer'
                    );
                }

                const solutionExpected =
                    requireSolutions ||
                    block?.hasSolutionLabel ===
                        true;

                if (
                    solutionExpected &&
                    !solutionMap.has(
                        questionNumber
                    )
                ) {
                    missingFields.push(
                        'solution'
                    );
                }

                if (
                    missingFields.length === 0
                ) {
                    continue;
                }

                requests.push({
                    questionNumber,
                    missingFields,

                    existingAnswer:
                        answerMap.get(
                            questionNumber
                        ) || '',

                    existingSolution:
                        solutionMap.get(
                            questionNumber
                        ) || '',

                    rawBlock:
                        String(
                            block?.rawBlock ||
                            ''
                        ),

                    sourcePage:
                        Number(
                            block?.sourcePage ||
                            0
                        ),

                    sourcePageImage:
                        block
                            ?.sourcePageImage ||
                        '',

                    questionEvidence:
                        block
                            ?.questionEvidence ||
                        ''
                });
            }

            return requests;
        };

        const applySupportRepairsFillOnly = ({
            answers = [],
            solutions = [],
            repairedAnswers = [],
            repairedSolutions = [],
            allowedQuestionNumbers = []
        } = {}) => {
            const resultAnswers =
                [...(answers || [])];

            const resultSolutions =
                [...(solutions || [])];

            const allowed =
                new Set(
                    (
                        allowedQuestionNumbers ||
                        []
                    )
                        .map(
                            normalizeQuestionNumber
                        )
                        .filter(Boolean)
                );

            const answerQuestions =
                new Set(
                    resultAnswers
                        .filter(
                            item =>
                                hasFieldValue(
                                    item?.answer
                                )
                        )
                        .map(
                            item =>
                                normalizeQuestionNumber(
                                    item?.question
                                )
                        )
                        .filter(Boolean)
                );

            const solutionQuestions =
                new Set(
                    resultSolutions
                        .filter(
                            item =>
                                hasFieldValue(
                                    item?.solution
                                )
                        )
                        .map(
                            item =>
                                normalizeQuestionNumber(
                                    item?.question
                                )
                        )
                        .filter(Boolean)
                );

            const diagnostics = {
                addedAnswers: [],
                addedSolutions: [],
                skippedUnknown: [],
                skippedExisting: [],
                skippedEmpty: []
            };

            const applyItems = ({
                items,
                result,
                existingQuestions,
                valueKey,
                kind
            }) => {
                for (
                    const item of
                    items || []
                ) {
                    const questionNumber =
                        normalizeQuestionNumber(
                            item?.question
                        );

                    const value =
                        String(
                            item?.[valueKey] ||
                            ''
                        ).trim();

                    if (
                        !questionNumber ||
                        !value
                    ) {
                        diagnostics
                            .skippedEmpty
                            .push({
                                kind,
                                questionNumber
                            });

                        continue;
                    }

                    if (
                        allowed.size > 0 &&
                        !allowed.has(
                            questionNumber
                        )
                    ) {
                        diagnostics
                            .skippedUnknown
                            .push({
                                kind,
                                questionNumber
                            });

                        continue;
                    }

                    if (
                        existingQuestions.has(
                            questionNumber
                        )
                    ) {
                        diagnostics
                            .skippedExisting
                            .push({
                                kind,
                                questionNumber
                            });

                        continue;
                    }

                    result.push({
                        ...item,
                        question:
                            questionNumber,
                        [valueKey]:
                            value
                    });

                    existingQuestions.add(
                        questionNumber
                    );

                    diagnostics[
                        kind === 'answer'
                            ? 'addedAnswers'
                            : 'addedSolutions'
                    ].push(
                        questionNumber
                    );
                }
            };

            applyItems({
                items:
                    repairedAnswers,

                result:
                    resultAnswers,

                existingQuestions:
                    answerQuestions,

                valueKey:
                    'answer',

                kind:
                    'answer'
            });

            applyItems({
                items:
                    repairedSolutions,

                result:
                    resultSolutions,

                existingQuestions:
                    solutionQuestions,

                valueKey:
                    'solution',

                kind:
                    'solution'
            });

            return {
                answers:
                    resultAnswers,

                solutions:
                    resultSolutions,

                diagnostics
            };
        };

        const repairChoiceOptions = (
            stem,
            options,
            type,
            deps = {}
        ) => {
            const {
                sanitizeChoiceOptions,
                normalizeMathTextForLatexSafe,
                stripQuestionSectionNoise,
                splitQuestionForStorage
            } = deps;

            const sanitize =
                typeof sanitizeChoiceOptions ===
                    'function'
                    ? sanitizeChoiceOptions
                    : value =>
                        Array.isArray(value)
                            ? value
                            : [];

            const normalizeMath =
                typeof normalizeMathTextForLatexSafe ===
                    'function'
                    ? normalizeMathTextForLatexSafe
                    : value =>
                        String(value || '');

            const stripNoise =
                typeof stripQuestionSectionNoise ===
                    'function'
                    ? stripQuestionSectionNoise
                    : value =>
                        String(value || '');

            const splitForStorage =
                typeof splitQuestionForStorage ===
                    'function'
                    ? splitQuestionForStorage
                    : null;

            const cleanOptions =
                sanitize(options);

            const hasOptions =
                cleanOptions
                    .filter(Boolean)
                    .length >= 2;

            if (hasOptions) {
                return {
                    stem:
                        normalizeMath(
                            stripNoise(stem)
                        ),

                    options:
                        cleanOptions
                };
            }

            if (splitForStorage) {
                const split =
                    splitForStorage(
                        stem,
                        type || '单选题',
                        cleanOptions
                    );

                const splitOptions =
                    sanitize(
                        split?.options
                    );

                if (
                    splitOptions
                        .filter(Boolean)
                        .length >= 2
                ) {
                    return {
                        stem:
                            normalizeMath(
                                stripNoise(
                                    split?.stem
                                )
                            ),

                        options:
                            splitOptions
                    };
                }
            }

            return {
                stem:
                    normalizeMath(
                        stripNoise(stem)
                    ),

                options:
                    cleanOptions
            };
        };

        const tryRepairedCandidate = ({
            candidate = '',
            lastParseError = null,
            escapeLatexBackslashesInJsonCandidate,
            extractQuestionArray
        } = {}) => {
            const escapeLatex =
                typeof escapeLatexBackslashesInJsonCandidate ===
                    'function'
                    ? escapeLatexBackslashesInJsonCandidate
                    : () => ({
                        text:
                            String(candidate || ''),

                        changed:
                            false,

                        repairCount:
                            0,

                        commands:
                            []
                    });

            const extractQuestions =
                typeof extractQuestionArray ===
                    'function'
                    ? extractQuestionArray
                    : () => [];

            const repairedCandidate =
                escapeLatex(
                    candidate
                );

            if (!repairedCandidate.changed) {
                return {
                    result:
                        false,

                    parsedWithoutQuestions:
                        null,

                    repairDiagnostics:
                        null
                };
            }

            let repairDiagnostics = {
                candidateLength:
                    String(candidate || '')
                        .length,

                repairCount:
                    repairedCandidate
                        .repairCount,

                commands:
                    repairedCandidate
                        .commands,

                originalParseMessage:
                    lastParseError?.message ||
                    ''
            };

            try {
                const rawParsed =
                    JSON.parse(
                        repairedCandidate.text
                    );

                const parsed =
                    Array.isArray(rawParsed)
                        ? {
                            questions:
                                rawParsed
                        }
                        : rawParsed;

                const questions =
                    extractQuestions(
                        parsed
                    );

                if (questions.length) {
                    return {
                        result: {
                            ok:
                                true,

                            parsed,

                            questions,

                            method:
                                'json-latex-backslash-repair',

                            reason:
                                '',

                            message:
                                '',

                            diagnostics:
                                repairDiagnostics
                        },

                        parsedWithoutQuestions:
                            null,

                        repairDiagnostics
                    };
                }

                return {
                    result:
                        false,

                    parsedWithoutQuestions:
                        parsed,

                    repairDiagnostics
                };
            } catch (repairError) {
                repairDiagnostics = {
                    ...repairDiagnostics,

                    repairParseMessage:
                        repairError?.message ||
                        ''
                };
            }

            return {
                result:
                    false,

                parsedWithoutQuestions:
                    null,

                repairDiagnostics
            };
        };

        return {
            readLatexJsonCommandAt,
            hasUnescapedLatexCommandInJsonString,
            escapeLatexBackslashesInJsonCandidate,
            normalizeQuestionNumber,
            buildSupportRepairPlan,
            applySupportRepairsFillOnly,
            repairChoiceOptions,
            tryRepairedCandidate
        };
    }
);
