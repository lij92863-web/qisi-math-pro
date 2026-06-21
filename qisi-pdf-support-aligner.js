(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.PdfSupportAligner = api;

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

        const normalizeSupportQuestionNumber = value => {
            const source =
                String(value ?? '')
                    .replace(/[０-９]/g, ch =>
                        String.fromCharCode(
                            ch.charCodeAt(0) - 0xFEE0
                        )
                    )
                    .replace(/[０-９]/g, ch =>
                        String.fromCharCode(
                            ch.charCodeAt(0) - 0xFEE0
                        )
                    )
                    .trim();

            const match =
                source.match(/\d{1,3}/);

            if (!match) return '';

            const number =
                Number(match[0]);

            return Number.isInteger(number) && number > 0
                ? String(number)
                : '';
        };

        const getItemQuestion = item =>
            item?.question ??
            item?.questionNumber ??
            item?.questionNo ??
            item?.number ??
            item?.no ??
            item?.sourceTrace?.questionNumber ??
            item?.sourceTrace?.questionNo ??
            '';

        const normalizeSupportSequence = (items = []) => {
            const rows =
                (items || []).map((item, index) => {
                    const raw =
                        getItemQuestion(item);
                    const normalized =
                        normalizeSupportQuestionNumber(raw);
                    const value =
                        normalized ? Number(normalized) : 0;

                    return {
                        index,
                        raw,
                        normalized,
                        value,
                        ok:
                            Number.isInteger(value) &&
                            value > 0
                    };
                });

            const values =
                rows.map(row => row.value);
            const duplicates =
                [
                    ...new Set(
                        values.filter((value, index, arr) =>
                            value > 0 &&
                            arr.indexOf(value) !== index
                        )
                    )
                ];
            const strictlyIncreasing =
                values.every((value, index) =>
                    index === 0 ||
                    value > values[index - 1]
                );

            return {
                rows,
                values,
                invalidRows:
                    rows.filter(row => !row.ok),
                duplicates,
                strictlyIncreasing
            };
        };

        const sameNumberSet = (left = [], right = []) => {
            const a =
                [...new Set(left)]
                    .filter(Boolean)
                    .sort((x, y) => x - y);
            const b =
                [...new Set(right)]
                    .filter(Boolean)
                    .sort((x, y) => x - y);

            return (
                a.length === b.length &&
                a.every((value, index) => value === b[index])
            );
        };

        const isContinuous = values => {
            if (!values.length) return false;

            return values.every((value, index) =>
                index === 0 ||
                value === values[index - 1] + 1
            );
        };

        const sameOrderedValues = (left = [], right = []) =>
            left.length === right.length &&
            left.every((value, index) => value === right[index]);

        const normalizeExpected = values =>
            (values || [])
                .map(normalizeSupportQuestionNumber)
                .filter(Boolean)
                .map(Number);

        const buildSupportSequenceReport = ({
            answerItems = [],
            solutionItems = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const answerSequence =
                normalizeSupportSequence(answerItems);
            const solutionSequence =
                normalizeSupportSequence(solutionItems);
            const expectedValues =
                normalizeExpected(expectedQuestionNumbers);
            const reasons = [];

            if (answerSequence.invalidRows.length) {
                reasons.push('answer-question-invalid');
            }

            if (solutionSequence.invalidRows.length) {
                reasons.push('solution-question-invalid');
            }

            if (answerSequence.duplicates.length) {
                reasons.push('answer-question-duplicate');
            }

            if (solutionSequence.duplicates.length) {
                reasons.push('solution-question-duplicate');
            }

            if (!answerSequence.strictlyIncreasing) {
                reasons.push('answer-question-not-increasing');
            }

            if (!solutionSequence.strictlyIncreasing) {
                reasons.push('solution-question-not-increasing');
            }

            if (
                !sameNumberSet(
                    answerSequence.values,
                    solutionSequence.values
                )
            ) {
                reasons.push('answer-solution-question-set-mismatch');
            }

            if (
                expectedValues.length &&
                (
                    !sameNumberSet(
                        answerSequence.values,
                        expectedValues
                    ) ||
                    !sameNumberSet(
                        solutionSequence.values,
                        expectedValues
                    )
                )
            ) {
                reasons.push('support-question-set-not-equal-expected');
            }

            if (expectedValues.length) {
                if (
                    answerSequence.values.length &&
                    !sameOrderedValues(
                        answerSequence.values,
                        expectedValues
                    )
                ) {
                    reasons.push('answer-question-not-continuous');
                }

                if (
                    solutionSequence.values.length &&
                    !sameOrderedValues(
                        solutionSequence.values,
                        expectedValues
                    )
                ) {
                    reasons.push('solution-question-not-continuous');
                }
            } else {
                if (
                    answerSequence.values.length &&
                    !isContinuous(answerSequence.values)
                ) {
                    reasons.push('answer-question-not-continuous');
                }

                if (
                    solutionSequence.values.length &&
                    !isContinuous(solutionSequence.values)
                ) {
                    reasons.push('solution-question-not-continuous');
                }
            }

            return {
                ok:
                    reasons.length === 0,
                reasons,
                answerSequence,
                solutionSequence,
                expectedValues
            };
        };

        const isSupportSequenceReliable = report =>
            Boolean(report?.ok);

        const valuesAfterPrefix = ({
            prefixLength = 0,
            expectedValues = [],
            answerValues = [],
            solutionValues = []
        } = {}) => {
            if (expectedValues.length) {
                return expectedValues
                    .slice(prefixLength)
                    .map(String);
            }

            return [
                ...new Set(
                    [
                        ...answerValues.slice(prefixLength),
                        ...solutionValues.slice(prefixLength)
                    ]
                        .filter(value =>
                            Number.isInteger(value) &&
                            value > 0
                        )
                )
            ].map(String);
        };

        const findReliablePrefix = (
            report,
            expectedValues = []
        ) => {
            const answerRows =
                report?.answerSequence?.rows || [];
            const solutionRows =
                report?.solutionSequence?.rows || [];
            const limit =
                Math.min(answerRows.length, solutionRows.length);
            const result = [];

            for (let index = 0; index < limit; index += 1) {
                const answer =
                    answerRows[index];
                const solution =
                    solutionRows[index];
                const expected =
                    expectedValues.length
                        ? expectedValues[index]
                        : (
                            index === 0
                                ? 1
                                : result[result.length - 1] + 1
                        );

                if (
                    !expected ||
                    !answer.ok ||
                    !solution.ok ||
                    answer.value !== solution.value ||
                    answer.value !== expected ||
                    result.includes(answer.value)
                ) {
                    break;
                }

                result.push(answer.value);
            }

            return result;
        };

        const buildJumpBacks = values =>
            (values || [])
                .map((value, index) => ({
                    value,
                    previous:
                        index > 0
                            ? values[index - 1]
                            : 0
                }))
                .filter(row =>
                    row.previous &&
                    row.value < row.previous
                )
                .map(row => ({
                    question:
                        String(row.value),
                    previousQuestion:
                        String(row.previous)
                }));

        const valuesOutOfExpected = (values = [], expectedValues = []) => {
            if (!expectedValues.length) return [];

            const expectedSet =
                new Set(expectedValues);

            return [
                ...new Set(
                    values.filter(value =>
                        Number.isInteger(value) &&
                        value > 0 &&
                        !expectedSet.has(value)
                    )
                )
            ].map(String);
        };

        const missingExpectedValues = ({
            expectedValues = [],
            answerValues = [],
            solutionValues = []
        } = {}) => {
            if (!expectedValues.length) return [];

            const answerSet =
                new Set(answerValues);
            const solutionSet =
                new Set(solutionValues);

            return expectedValues
                .filter(value =>
                    !answerSet.has(value) ||
                    !solutionSet.has(value)
                )
                .map(String);
        };

        const validatePdfSupportSequence = ({
            answerItems = [],
            solutionItems = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const report =
                buildSupportSequenceReport({
                    answerItems,
                    solutionItems,
                    expectedQuestionNumbers
                });
            const expectedValues =
                normalizeExpected(expectedQuestionNumbers);
            const answerValues =
                report.answerSequence.values;
            const solutionValues =
                report.solutionSequence.values;
            const prefix =
                isSupportSequenceReliable(report)
                    ? answerValues
                    : findReliablePrefix(report, expectedValues);
            const fusedQuestionNumbers =
                isSupportSequenceReliable(report)
                    ? []
                    : valuesAfterPrefix({
                        prefixLength:
                            prefix.length,
                        expectedValues,
                        answerValues,
                        solutionValues
                    });
            const mode =
                isSupportSequenceReliable(report)
                    ? 'full'
                    : (
                        prefix.length
                            ? 'prefix'
                            : 'fail-closed'
                    );

            return {
                reliable:
                    mode === 'full',
                mode,
                empty:
                    !answerValues.length &&
                    !solutionValues.length,
                invalidQuestions:
                    [
                        ...report.answerSequence.invalidRows.map(row => row.raw),
                        ...report.solutionSequence.invalidRows.map(row => row.raw)
                    ].filter(Boolean),
                duplicateQuestions:
                    [
                        ...new Set([
                            ...report.answerSequence.duplicates,
                            ...report.solutionSequence.duplicates
                        ])
                    ].map(String),
                jumpBacks: [
                    ...buildJumpBacks(answerValues),
                    ...buildJumpBacks(solutionValues)
                ],
                gaps:
                    missingExpectedValues({
                        expectedValues,
                        answerValues,
                        solutionValues
                    }),
                outOfRangeNumbers: [
                    ...new Set([
                        ...valuesOutOfExpected(answerValues, expectedValues),
                        ...valuesOutOfExpected(solutionValues, expectedValues)
                    ])
                ],
                answerSolutionSetMismatch:
                    !sameNumberSet(answerValues, solutionValues),
                prefixCutoffIndex:
                    prefix.length,
                safeQuestionNumbers:
                    prefix.map(String),
                fusedQuestionNumbers,
                report
            };
        };

        const alignPdfSupport = ({
            questionItems = [],
            answerItems = [],
            solutionItems = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const validation =
                validatePdfSupportSequence({
                    answerItems,
                    solutionItems,
                    expectedQuestionNumbers
                });
            const report =
                validation.report;

            if (validation.mode === 'full') {
                return {
                    reliable: true,
                    mode: 'full',
                    safeAnswerItems: [...(answerItems || [])],
                    safeSolutionItems: [...(solutionItems || [])],
                    safeQuestionNumbers:
                        report.answerSequence.values.map(String),
                    fusedQuestionNumbers: [],
                    fusedWarnings: [],
                    warnings: [],
                    report
                };
            }

            if (validation.mode === 'prefix') {
                return {
                    reliable: false,
                    mode: 'prefix',
                    safeAnswerItems:
                        (answerItems || []).slice(0, validation.prefixCutoffIndex),
                    safeSolutionItems:
                        (solutionItems || []).slice(0, validation.prefixCutoffIndex),
                    safeQuestionNumbers:
                        validation.safeQuestionNumbers,
                    fusedQuestionNumbers:
                        validation.fusedQuestionNumbers,
                    fusedWarnings:
                        [
                            'pdf-support-sequence-unreliable',
                            'missing_answer',
                            'missing_solution'
                        ],
                    warnings:
                        ['pdf-support-prefix-only'],
                    report
                };
            }

            return {
                reliable: false,
                mode: 'fail-closed',
                safeAnswerItems: [],
                safeSolutionItems: [],
                safeQuestionNumbers: [],
                fusedQuestionNumbers:
                    validation.fusedQuestionNumbers,
                fusedWarnings:
                    [
                        'pdf-support-sequence-unreliable',
                        'missing_answer',
                        'missing_solution'
                    ],
                warnings:
                    ['pdf-support-sequence-unreliable'],
                report
            };
        };

        return {
            normalizeSupportQuestionNumber,
            normalizeSupportSequence,
            buildSupportSequenceReport,
            validatePdfSupportSequence,
            isSupportSequenceReliable,
            findReliablePrefix,
            alignPdfSupport
        };
    }
);
