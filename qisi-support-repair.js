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

            const normalizedType = String(type || '').trim();
            const explicitlyNonChoice = Boolean(normalizedType) && !/(?:单选|多选|选择题)/.test(normalizedType);

            if (explicitlyNonChoice) {
                return {
                    stem: normalizeMath(stripNoise(stem)),
                    options: cleanOptions
                };
            }

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
            normalizeQuestionNumber,
            buildSupportRepairPlan,
            applySupportRepairsFillOnly,
            repairChoiceOptions,
            tryRepairedCandidate
        };
    }
);
