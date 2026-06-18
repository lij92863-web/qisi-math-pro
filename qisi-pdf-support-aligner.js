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

        const alignPdfSupport = ({
            questionItems = [],
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

            if (isSupportSequenceReliable(report)) {
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

            const expected =
                normalizeExpected(expectedQuestionNumbers);
            const prefix =
                findReliablePrefix(report, expected);
            const fusedQuestionNumbers =
                valuesAfterPrefix({
                    prefixLength:
                        prefix.length,
                    expectedValues:
                        expected,
                    answerValues:
                        report.answerSequence.values,
                    solutionValues:
                        report.solutionSequence.values
                });

            if (prefix.length) {
                return {
                    reliable: false,
                    mode: 'prefix',
                    safeAnswerItems:
                        (answerItems || []).slice(0, prefix.length),
                    safeSolutionItems:
                        (solutionItems || []).slice(0, prefix.length),
                    safeQuestionNumbers:
                        prefix.map(String),
                    fusedQuestionNumbers,
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
                    valuesAfterPrefix({
                        prefixLength: 0,
                        expectedValues:
                            expected,
                        answerValues:
                            report.answerSequence.values,
                        solutionValues:
                            report.solutionSequence.values
                    }),
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
            isSupportSequenceReliable,
            findReliablePrefix,
            alignPdfSupport
        };
    }
);
