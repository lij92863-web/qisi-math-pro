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

        return {
            normalizeQuestionNumber,
            buildSupportRepairPlan,
            applySupportRepairsFillOnly
        };
    }
);
