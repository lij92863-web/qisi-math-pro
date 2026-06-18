(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.PdfSupportBlockParser = api;

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

        const normalizeQuestionNumber = value => {
            const source =
                String(value ?? '')
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

        const normalizeSupportRawTextPages = rawTextPages =>
            (Array.isArray(rawTextPages) ? rawTextPages : [])
                .map((page, index) => {
                    if (
                        page &&
                        typeof page === 'object' &&
                        !Array.isArray(page)
                    ) {
                        return {
                            pageIndex:
                                Number.isInteger(page.pageIndex)
                                    ? page.pageIndex
                                    : index,
                            sourceOrder:
                                Number.isInteger(page.sourceOrder)
                                    ? page.sourceOrder
                                    : index,
                            text:
                                String(
                                    page.text ??
                                    page.rawText ??
                                    page.content ??
                                    ''
                                )
                        };
                    }

                    return {
                        pageIndex: index,
                        sourceOrder: index,
                        text:
                            String(page ?? '')
                    };
                });

        const parseQuestionMarker = line => {
            const source =
                String(line ?? '');
            const match =
                source.match(
                    /^\s*(?:【\s*第?\s*([0-9０-９]{1,3})\s*题\s*】|第\s*([0-9０-９]{1,3})\s*题|([0-9０-９]{1,3})[.、])\s*(.*)$/
                );

            if (!match) return null;

            const question =
                normalizeQuestionNumber(
                    match[1] || match[2] || match[3]
                );

            if (!question) return null;

            return {
                type: 'question',
                question,
                rest:
                    String(match[4] || '').trim()
            };
        };

        const parseLabelMarker = line => {
            const source =
                String(line ?? '');
            const match =
                source.match(
                    /^\s*(?:(?:【\s*(答案|解析)\s*】)|(参考答案|答案|解析|详解)\s*[:：]?)\s*(.*)$/
                );

            if (!match) return null;

            const rawLabel =
                match[1] || match[2] || '';
            const section =
                /解析|详解/.test(rawLabel)
                    ? 'solution'
                    : 'answer';

            return {
                type: section,
                label: rawLabel,
                rest:
                    String(match[3] || '').trim()
            };
        };

        const parseSupportBlockMarkers = line =>
            parseQuestionMarker(line) ||
            parseLabelMarker(line) ||
            null;

        const makeBlock = ({
            question,
            pageIndex,
            sourceOrder,
            sourceFileId,
            mode
        }) => ({
            question,
            answer: '',
            solution: '',
            body: '',
            pageStart: pageIndex,
            pageEnd: pageIndex,
            sourceOrderStart: sourceOrder,
            sourceOrderEnd: sourceOrder,
            sourceFileId:
                sourceFileId || '',
            mode:
                mode || 'support',
            warnings: [],
            sourceTrace: {
                questionNumber: question,
                pageIndex,
                sourceOrder,
                sourceFileId:
                    sourceFileId || ''
            }
        });

        const appendText = (block, section, text) => {
            if (!block || !text) return;

            const key =
                section === 'answer' ||
                section === 'solution'
                    ? section
                    : 'body';

            block[key] =
                [block[key], text]
                    .filter(Boolean)
                    .join('\n')
                    .trim();
        };

        const appendQuestionRest = (block, rest, fallbackSection) => {
            if (!block || !rest) return fallbackSection;

            const labelMarker =
                parseLabelMarker(rest);

            if (labelMarker) {
                appendText(
                    block,
                    labelMarker.type,
                    labelMarker.rest
                );

                return labelMarker.type;
            }

            appendText(
                block,
                fallbackSection,
                rest
            );

            return fallbackSection;
        };

        const splitPdfSupportBlocks = ({
            rawTextPages = [],
            expectedQuestionNumbers = [],
            sourceFileId = '',
            mode = 'support'
        } = {}) => {
            const pages =
                normalizeSupportRawTextPages(rawTextPages);
            const expectedSet =
                new Set(
                    (expectedQuestionNumbers || [])
                        .map(normalizeQuestionNumber)
                        .filter(Boolean)
                );
            const blocks = [];
            const warnings = [];
            const seen =
                new Set();
            let current =
                null;
            let currentSection =
                mode === 'answer' || mode === 'solution'
                    ? mode
                    : 'body';
            let previousNumber =
                0;

            const warn = (code, detail = {}) => {
                warnings.push({
                    code,
                    ...detail
                });
            };

            const finishCurrent = () => {
                if (current) {
                    blocks.push(current);
                    current = null;
                }
            };

            for (const page of pages) {
                const lines =
                    String(page.text || '')
                        .replace(/\r/g, '\n')
                        .split('\n');

                for (const rawLine of lines) {
                    const line =
                        String(rawLine || '').trim();

                    if (!line) continue;

                    const questionMarker =
                        parseQuestionMarker(line);

                    if (questionMarker) {
                        finishCurrent();

                        const value =
                            Number(questionMarker.question);

                        current =
                            makeBlock({
                                question:
                                    questionMarker.question,
                                pageIndex:
                                    page.pageIndex,
                                sourceOrder:
                                    page.sourceOrder,
                                sourceFileId,
                                mode
                            });
                        currentSection =
                            mode === 'answer' || mode === 'solution'
                                ? mode
                                : 'body';

                        if (
                            expectedSet.size &&
                            !expectedSet.has(questionMarker.question)
                        ) {
                            current.warnings.push('unknown-question-marker');
                            warn(
                                'unknown-question-marker',
                                {
                                    question:
                                        questionMarker.question
                                }
                            );
                        }

                        if (seen.has(questionMarker.question)) {
                            current.warnings.push('duplicate-question-marker');
                            warn(
                                'duplicate-question-marker',
                                {
                                    question:
                                        questionMarker.question
                                }
                            );
                        } else {
                            seen.add(questionMarker.question);
                        }

                        if (
                            previousNumber &&
                            value < previousNumber
                        ) {
                            current.warnings.push('jump-back-question-marker');
                            warn(
                                'jump-back-question-marker',
                                {
                                    question:
                                        questionMarker.question,
                                    previousQuestion:
                                        String(previousNumber)
                                }
                            );
                        }

                        previousNumber =
                            value;

                        currentSection =
                            appendQuestionRest(
                                current,
                                questionMarker.rest,
                                currentSection
                            );

                        continue;
                    }

                    const labelMarker =
                        parseLabelMarker(line);

                    if (labelMarker && current) {
                        currentSection =
                            labelMarker.type;
                        appendText(
                            current,
                            currentSection,
                            labelMarker.rest
                        );
                        current.pageEnd =
                            page.pageIndex;
                        current.sourceOrderEnd =
                            page.sourceOrder;
                        continue;
                    }

                    if (current) {
                        appendText(
                            current,
                            currentSection,
                            line
                        );
                        current.pageEnd =
                            page.pageIndex;
                        current.sourceOrderEnd =
                            page.sourceOrder;
                    }
                }
            }

            finishCurrent();

            return {
                blocks,
                warnings
            };
        };

        const itemFromBlock = (block, field) => ({
            question:
                block.question,
            [field]:
                block[field],
            sourceTrace: {
                questionNumber:
                    block.question,
                pageStart:
                    block.pageStart,
                pageEnd:
                    block.pageEnd,
                sourceOrderStart:
                    block.sourceOrderStart,
                sourceOrderEnd:
                    block.sourceOrderEnd,
                sourceFileId:
                    block.sourceFileId
            },
            warnings:
                [...(block.warnings || [])]
        });

        const buildCoverageReport = ({
            blocks = [],
            answerItems = [],
            solutionItems = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const expected =
                (expectedQuestionNumbers || [])
                    .map(normalizeQuestionNumber)
                    .filter(Boolean);
            const blockQuestions =
                new Set(blocks.map(block => block.question));
            const answerQuestions =
                new Set(answerItems.map(item => item.question));
            const solutionQuestions =
                new Set(solutionItems.map(item => item.question));

            return {
                expectedQuestionNumbers:
                    expected,
                blockQuestionNumbers:
                    [...blockQuestions],
                answerQuestionNumbers:
                    [...answerQuestions],
                solutionQuestionNumbers:
                    [...solutionQuestions],
                missingBlocks:
                    expected.filter(question =>
                        !blockQuestions.has(question)
                    ),
                missingAnswers:
                    expected.filter(question =>
                        !answerQuestions.has(question)
                    ),
                missingSolutions:
                    expected.filter(question =>
                        !solutionQuestions.has(question)
                    )
            };
        };

        const buildSequenceReport = (blocks = []) => {
            const values =
                blocks.map(block => Number(block.question || 0));
            const duplicates =
                [
                    ...new Set(
                        values.filter((value, index, arr) =>
                            value > 0 &&
                            arr.indexOf(value) !== index
                        )
                    )
                ].map(String);
            const jumpBacks =
                values
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

            return {
                questionNumbers:
                    values
                        .filter(Boolean)
                        .map(String),
                duplicates,
                jumpBacks,
                strictlyIncreasing:
                    jumpBacks.length === 0 &&
                    duplicates.length === 0
            };
        };

        const buildPdfSupportItemsFromBlocks = ({
            blocks = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const expectedSet =
                new Set(
                    (expectedQuestionNumbers || [])
                        .map(normalizeQuestionNumber)
                        .filter(Boolean)
                );
            const isExpected = block =>
                !expectedSet.size ||
                expectedSet.has(block.question);
            const isSafe = block =>
                isExpected(block) &&
                !(block.warnings || []).length;
            const safeBlocks =
                (blocks || []).filter(isSafe);

            return {
                answerItems:
                    safeBlocks
                        .filter(block => block.answer)
                        .map(block =>
                            itemFromBlock(block, 'answer')
                        ),
                solutionItems:
                    safeBlocks
                        .filter(block => block.solution)
                        .map(block =>
                            itemFromBlock(block, 'solution')
                        )
            };
        };

        const parsePdfSupportBlocks = ({
            rawTextPages = [],
            expectedQuestionNumbers = [],
            sourceFileId = '',
            mode = 'support'
        } = {}) => {
            const split =
                splitPdfSupportBlocks({
                    rawTextPages,
                    expectedQuestionNumbers,
                    sourceFileId,
                    mode
                });
            const items =
                buildPdfSupportItemsFromBlocks({
                    blocks:
                        split.blocks,
                    expectedQuestionNumbers
                });

            return {
                blocks:
                    split.blocks,
                answerItems:
                    items.answerItems,
                solutionItems:
                    items.solutionItems,
                warnings:
                    split.warnings,
                coverageReport:
                    buildCoverageReport({
                        blocks:
                            split.blocks,
                        answerItems:
                            items.answerItems,
                        solutionItems:
                            items.solutionItems,
                        expectedQuestionNumbers
                    }),
                sequenceReport:
                    buildSequenceReport(split.blocks)
            };
        };

        return {
            normalizeSupportRawTextPages,
            parseSupportBlockMarkers,
            splitPdfSupportBlocks,
            buildPdfSupportItemsFromBlocks,
            parsePdfSupportBlocks
        };
    }
);
