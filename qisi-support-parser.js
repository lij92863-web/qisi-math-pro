(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.SupportParser = api;

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

        const ANSWER_LABEL_SOURCE =
            '(?:' +
                '[【\\[]\\s*(?:答案|参考答案)\\s*[】\\]]' +
                '|' +
                '(?:参考答案|答案)\\s*[:：]' +
            ')';

        const SOLUTION_LABEL_SOURCE =
            '(?:' +
                '[【\\[]\\s*(?:解析|详解|解答|分析)\\s*[】\\]]' +
                '|' +
                '(?:解析|详解|解答过程|解答|分析)\\s*[:：]' +
            ')';

        const EMBEDDED_SOLUTION_LABEL_SOURCE =
            '(?:' +
                '[\\u3010\\[]\\s*(?:\\u8be6\\s*\\u89e3|\\u89e3\\s*\\u6790|\\u89e3\\s*\\u7b54|\\u5206\\s*\\u6790)\\s*[\\u3011\\]]' +
                '|' +
                '(?:\\u8be6\\s*\\u89e3|\\u89e3\\s*\\u6790|\\u89e3\\s*\\u7b54\\s*\\u8fc7\\s*\\u7a0b|\\u89e3\\s*\\u7b54|\\u5206\\s*\\u6790)\\s*[:\\uff1a]' +
            ')';

        const normalizeDigits = value =>
            String(value || '')
                .replace(
                    /[０-９]/g,
                    char =>
                        String.fromCharCode(
                            char.charCodeAt(0) -
                            65248
                        )
                );

        const normalizeQuestionNumber = value => {
            const text =
                normalizeDigits(value);

            const match =
                text.match(/\d{1,3}/);

            if (!match) return '';

            const number =
                Number(match[0]);

            return (
                Number.isInteger(number) &&
                number > 0
            )
                ? String(number)
                : '';
        };

        const normalizeExpectedQuestionNumbers = (
            values = []
        ) => {
            const result = [];
            const seen = new Set();

            for (const value of values || []) {
                const questionNumber =
                    normalizeQuestionNumber(value);

                if (
                    !questionNumber ||
                    seen.has(questionNumber)
                ) {
                    continue;
                }

                seen.add(questionNumber);
                result.push(questionNumber);
            }

            return result;
        };

        const normalizeSource = value =>
            String(value || '')
                .replace(/\r\n?/g, '\n')
                .replace(/\u3000/g, ' ')
                .replace(/[ \t]+\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

        const unwrapSupportCodeFence = (
            value = ''
        ) => {
            let source =
                String(value || '')
                    .replace(/\r\n?/g, '\n')
                    .trim();

            const opening =
                source.match(
                    /^\s*```([a-zA-Z0-9_-]*)[ \t]*\n?/
                );

            const language =
                String(
                    opening?.[1] || ''
                ).toLowerCase();

            if (opening) {
                source =
                    source.slice(
                        opening[0].length
                    );
            }

            source =
                source.replace(
                    /\n?[ \t]*```[ \t]*$/,
                    ''
                );

            return {
                language,
                body:
                    source.trim()
            };
        };

        const decodeSupportOcrPayload = ({
            body = '',
            language = ''
        } = {}) => {
            const source =
                String(body || '').trim();

            if (!source) {
                return '';
            }

            const mayBeJson =
                language === 'json' ||
                source.startsWith('[');

            if (!mayBeJson) {
                return source;
            }

            let payload;

            try {
                payload =
                    JSON.parse(source);
            } catch (_) {
                return source;
            }

            if (!Array.isArray(payload)) {
                return source;
            }

            const rows = [];

            for (const item of payload) {
                if (
                    !item ||
                    typeof item !== 'object' ||
                    Array.isArray(item) ||
                    typeof item.text !== 'string'
                ) {
                    return source;
                }

                const text =
                    item.text.trim();

                if (text) {
                    rows.push(text);
                }
            }

            return rows.length
                ? rows.join('\n')
                : source;
        };

        const canonicalizeSupportOcrText = (
            value = ''
        ) => {
            const unwrapped =
                unwrapSupportCodeFence(
                    value
                );

            const decoded =
                decodeSupportOcrPayload(
                    unwrapped
                );

            return normalizeSource(
                decoded
            );
        };

        const buildSupportDocument = (
            pages = []
        ) => {
            let documentText = '';
            const pageRanges = [];

            [...(pages || [])]
                .sort(
                    (a, b) =>
                        Number(a.pageNo || 0) -
                        Number(b.pageNo || 0)
                )
                .forEach(page => {
                    const pageNo =
                        Number(page.pageNo || 0);

                    const rawText =
                        canonicalizeSupportOcrText(
                            page.rawText || ''
                        );

                    if (!rawText) return;

                    if (documentText) {
                        documentText += '\n\n';
                    }

                    const start =
                        documentText.length;

                    documentText += rawText;

                    const end =
                        documentText.length;

                    pageRanges.push({
                        pageNo,
                        start,
                        end,
                        imageUrl:
                            page.imageUrl || ''
                    });
                });

            return {
                documentText,
                pageRanges
            };
        };

        const pageForOffset = (
            pageRanges = [],
            offset = 0
        ) => {
            return (
                (pageRanges || []).find(
                    range =>
                        offset >= range.start &&
                        offset < range.end
                ) ||
                pageRanges[
                    pageRanges.length - 1
                ] ||
                null
            );
        };

        const findLabel = (
            source,
            labelSource
        ) => {
            const regex =
                new RegExp(
                    labelSource,
                    'i'
                );

            const match =
                regex.exec(source);

            return match
                ? {
                    index:
                        match.index,
                    end:
                        match.index +
                        match[0].length,
                    raw:
                        match[0]
                }
                : null;
        };

        const SUPPORT_LABEL_WRAPPER_PREFIX_SOURCE =
            String.raw`(?:\s*(?:\{\s*)?(?:\\(?:textbf|mathbf)\s*\{\s*|\\bfseries\b\s*))?`;

        const SUPPORT_LABEL_WRAPPER_SUFFIX_SOURCE =
            String.raw`(?:\s*\}\s*){0,2}`;

        const buildSupportLabelRegex = (
            labelSource,
            {
                atStart = false
            } = {}
        ) => {
            return new RegExp(
                `${atStart ? '^' : ''}` +
                SUPPORT_LABEL_WRAPPER_PREFIX_SOURCE +
                `(?:${labelSource})` +
                SUPPORT_LABEL_WRAPPER_SUFFIX_SOURCE,
                'i'
            );
        };

        const findSupportLabel = (
            source,
            labelSource,
            {
                atStart = false
            } = {}
        ) => {
            const text =
                String(source || '');

            const regex =
                buildSupportLabelRegex(
                    labelSource,
                    { atStart }
                );

            const match =
                regex.exec(text);

            if (!match) {
                return null;
            }

            return {
                index:
                    match.index,

                end:
                    match.index +
                    match[0].length,

                raw:
                    match[0]
            };
        };

        const findEmbeddedSolutionLabelInAnswerRaw = (
            source = ''
        ) => {
            const text =
                String(source || '');

            const regex =
                new RegExp(
                    String.raw`(^|\n)[ \t]*(?:\\item(?![A-Za-z@])(?:\s*\[[^\]]*\])?[ \t]*)?(?:\\(?:noindent|par)\b\s*)?` +
                    SUPPORT_LABEL_WRAPPER_PREFIX_SOURCE +
                    `(?:${SOLUTION_LABEL_SOURCE}|${EMBEDDED_SOLUTION_LABEL_SOURCE})` +
                    SUPPORT_LABEL_WRAPPER_SUFFIX_SOURCE,
                    'i'
                );

            const match =
                regex.exec(text);

            if (!match) {
                return null;
            }

            const lineBreakPrefix =
                match[1] || '';

            return {
                index:
                    match.index +
                    lineBreakPrefix.length,

                end:
                    match.index +
                    match[0].length,

                raw:
                    match[0].slice(
                        lineBreakPrefix.length
                    )
            };
        };

        const cleanSupportFieldText = (
            value = '',
            {
                stripUnsupportedGraphics = false
            } = {}
        ) => {
            let text =
                String(value || '')
                    .replace(/\r\n?/g, '\n');

            if (stripUnsupportedGraphics) {
                text = text.replace(
                    /\\begin\{center\}[\s\S]*?\\end\{center\}/gi,
                    block =>
                        /\\begin\{tikzpicture\}/i.test(block)
                            ? ''
                            : block
                );

                text = text.replace(
                    /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/gi,
                    ''
                );
            }

            text = text
                .split('\n')
                .map(line => {
                    const trimmed =
                        line.trim();

                    if (
                        /^\\(?:begin|end)\{(?:description|itemize|enumerate)\}$/i.test(
                            trimmed
                        ) ||
                        /^\\item(?:\s*\[[^\]]*\])?\s*$/i.test(trimmed)
                    ) {
                        return null;
                    }

                    return line.replace(
                        /^\s*\\item(?![A-Za-z@])(?:\s*\[[^\]]*\])?[ \t]*/i,
                        ''
                    );
                })
                .filter(line => line !== null)
                .join('\n');

            return text
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };

        const consumeSupportLayoutPrefix = (
            value = ''
        ) => {
            const source =
                String(value || '');

            let rest = source;
            let consumed = 0;

            const consume = regex => {
                const match =
                    regex.exec(rest);

                if (!match) {
                    return null;
                }

                consumed +=
                    match[0].length;

                rest =
                    rest.slice(
                        match[0].length
                    );

                return match;
            };

            consume(/^\s*/);

            while (
                consume(
                    /^(?:\\noindent\b|\\par\b)\s*/
                )
            ) {
                // Continue consuming consecutive layout prefixes.
            }

            return {
                source,
                rest,
                consumed
            };
        };

        const matchAnswerLabelAtLineStart = (
            value = ''
        ) => {
            const state =
                consumeSupportLayoutPrefix(
                    value
                );

            const match =
                findSupportLabel(
                    state.rest,
                    ANSWER_LABEL_SOURCE,
                    {
                        atStart: true
                    }
                );

            if (!match) {
                return null;
            }

            return {
                offset:
                    state.consumed +
                    match.index,

                length:
                    match.raw.length,

                raw:
                    match.raw
            };
        };

        const parseSupportMarkerPrefix = (
            value = ''
        ) => {
            const source =
                String(value || '');

            const initialState =
                consumeSupportLayoutPrefix(
                    source
                );

            let rest =
                initialState.rest;

            let consumed =
                initialState.consumed;

            const consume = regex => {
                const match =
                    regex.exec(rest);

                if (!match) {
                    return null;
                }

                consumed +=
                    match[0].length;

                rest =
                    rest.slice(
                        match[0].length
                    );

                return match;
            };

            let explicitQuestionNumber = '';
            let markerKind = '';
            let match = null;

            match = consume(
                /^\\textbf\s*\{\s*([0-9０-９]{1,3})\s*(?:[.．。、:：)）])?\s*\}\s*/
            );

            if (match) {
                explicitQuestionNumber =
                    normalizeQuestionNumber(
                        match[1]
                    );

                markerKind =
                    'explicit-latex-bold';
            }

            if (!markerKind) {
                match = consume(
                    /^\*\*\s*([0-9０-９]{1,3})\s*(?:[.．。、:：)）])?\s*\*\*\s*/
                );

                if (match) {
                    explicitQuestionNumber =
                        normalizeQuestionNumber(
                            match[1]
                        );

                    markerKind =
                        'explicit-markdown-bold';
                }
            }

            if (!markerKind) {
                match = consume(
                    /^\\item(?:\s*\[\s*([0-9０-９]{1,3})\s*(?:[.．。、:：)）])?\s*\])?\s*/
                );

                if (match) {
                    explicitQuestionNumber =
                        normalizeQuestionNumber(
                            match[1] || ''
                        );

                    markerKind =
                        explicitQuestionNumber
                            ? 'explicit-enumerate-item'
                            : 'implicit-enumerate-item';
                }
            }

            if (!markerKind) {
                match = consume(
                    /^(?:第\s*)?([0-9０-９]{1,3})(?:\s*题)?\s*(?:[.．。、:：)）]\s*)?/
                );

                if (match) {
                    explicitQuestionNumber =
                        normalizeQuestionNumber(
                            match[1]
                        );

                    markerKind =
                        'explicit-plain-number';
                }
            }

            if (!markerKind) {
                return null;
            }

            const answerLabel =
                matchAnswerLabelAtLineStart(
                    rest
                );

            if (answerLabel) {
                return {
                    explicitQuestionNumber,
                    markerKind,

                    answerOffset:
                        consumed +
                        answerLabel.offset,

                    answerLabelLength:
                        answerLabel.length,

                    pendingAnswerLabel:
                        false,

                    rawMarker:
                        source.slice(
                            0,
                            consumed +
                            answerLabel.offset
                        )
                };
            }

            if (!rest.trim()) {
                return {
                    explicitQuestionNumber,
                    markerKind,

                    answerOffset:
                        -1,

                    answerLabelLength:
                        0,

                    pendingAnswerLabel:
                        true,

                    rawMarker:
                        source.slice(
                            0,
                            consumed
                        )
                };
            }

            return null;
        };

        const splitSupportLinesWithOffsets = (
            value = ''
        ) => {
            const source =
                String(value || '');

            const rawLines =
                source.split('\n');

            let offset = 0;

            return rawLines.map(
                (line, index) => {
                    const item = {
                        line,
                        index,
                        lineNo:
                            index + 1,
                        start:
                            offset
                    };

                    offset +=
                        line.length;

                    if (
                        index <
                        rawLines.length - 1
                    ) {
                        offset += 1;
                    }

                    return item;
                }
            );
        };

        const hasSupportAnswerLabel = (
            value = ''
        ) => {
            const regex =
                new RegExp(
                    ANSWER_LABEL_SOURCE,
                    'i'
                );

            return regex.test(
                String(value || '')
            );
        };

        const looksLikeSupportMarkerLead = (
            value = ''
        ) => {
            const source =
                String(value || '');

            return (
                /^\s*(?:\\noindent\b|\\par\b|\{)*\s*/.test(
                    source
                ) &&
                (
                    /\\textbf\b/i.test(source) ||
                    /^\s*\*\*/.test(source) ||
                    /^\s*\\item\b/.test(source) ||
                    /^\s*(?:第\s*)?[0-9０-９]{1,3}/.test(
                        source
                    )
                )
            );
        };

        const buildRejectedMarkerDiagnostic = ({
            row,
            reason,
            nextNonEmptyLine = ''
        }) => ({
            lineNo:
                row.lineNo,

            start:
                row.start,

            reason,

            rawLine:
                row.line,

            escapedLine:
                JSON.stringify(
                    row.line
                ),

            nextNonEmptyLine:
                String(
                    nextNonEmptyLine || ''
                ),

            escapedNextNonEmptyLine:
                JSON.stringify(
                    String(
                        nextNonEmptyLine || ''
                    )
                )
        });

        const scanSupportMarkers = ({
            documentText = '',
            expectedQuestionNumbers = []
        } = {}) => {
            const expected =
                normalizeExpectedQuestionNumbers(
                    expectedQuestionNumbers
                );

            const expectedIndexMap =
                new Map(
                    expected.map(
                        (
                            questionNumber,
                            index
                        ) => [
                            questionNumber,
                            index
                        ]
                    )
                );

            const usedQuestionNumbers =
                new Set();

            const markers = [];
            const boundaries = [];
            const unresolvedMarkers = [];
            const duplicateMarkers = [];
            const unknownMarkers = [];
            const rejectedMarkerCandidates = [];

            let expectedCursor = 0;
            let lastNumericQuestion = 0;

            const takeNextExpectedQuestion =
                () => {
                    while (
                        expectedCursor <
                            expected.length &&
                        usedQuestionNumbers.has(
                            expected[
                                expectedCursor
                            ]
                        )
                    ) {
                        expectedCursor += 1;
                    }

                    if (
                        expectedCursor <
                        expected.length
                    ) {
                        const result =
                            expected[
                                expectedCursor
                            ];

                        expectedCursor += 1;
                        return result;
                    }

                    if (expected.length > 0) {
                        return '';
                    }

                    if (
                        lastNumericQuestion > 0
                    ) {
                        return String(
                            lastNumericQuestion + 1
                        );
                    }

                    return '';
                };

            const lines =
                splitSupportLinesWithOffsets(
                    documentText
                );

            for (
                let index = 0;
                index < lines.length;
                index += 1
            ) {
                const row =
                    lines[index];

                const parsed =
                    parseSupportMarkerPrefix(
                        row.line
                    );

                if (!parsed) {
                    if (
                        looksLikeSupportMarkerLead(
                            row.line
                        )
                    ) {
                        rejectedMarkerCandidates.push(
                            buildRejectedMarkerDiagnostic({
                                row,
                                reason:
                                    'marker-prefix-not-recognized'
                            })
                        );
                    }

                    continue;
                }

                let contentStart = -1;
                let answerLabelLength = 0;
                let nextNonEmptyLine = '';

                if (
                    !parsed.pendingAnswerLabel
                ) {
                    contentStart =
                        row.start +
                        parsed.answerOffset;

                    answerLabelLength =
                        Number(
                            parsed.answerLabelLength || 0
                        );
                } else {
                    let nextIndex =
                        index + 1;

                    let checkedLines = 0;

                    while (
                        nextIndex <
                            lines.length &&
                        checkedLines < 3
                    ) {
                        const nextRow =
                            lines[nextIndex];

                        checkedLines += 1;

                        if (
                            !nextRow.line.trim()
                        ) {
                            nextIndex += 1;
                            continue;
                        }

                        nextNonEmptyLine =
                            nextRow.line;

                        const answerLabel =
                            matchAnswerLabelAtLineStart(
                                nextRow.line
                            );

                        if (answerLabel) {
                            contentStart =
                                nextRow.start +
                                answerLabel.offset;

                            answerLabelLength =
                                answerLabel.length;
                        }

                        break;
                    }
                }

                if (contentStart < 0) {
                    rejectedMarkerCandidates.push(
                        buildRejectedMarkerDiagnostic({
                            row,
                            reason:
                                'answer-label-not-found-after-marker',

                            nextNonEmptyLine
                        })
                    );

                    continue;
                }

                const boundary = {
                    markerKind:
                        parsed.markerKind,

                    lineNo:
                        row.lineNo,

                    start:
                        row.start,

                    contentStart,
                    answerLabelLength,

                    rawMarker:
                        parsed.rawMarker
                };

                const boundaryIndex =
                    boundaries.push(
                        boundary
                    ) - 1;

                const questionNumber =
                    parsed
                        .explicitQuestionNumber ||
                    takeNextExpectedQuestion();

                if (!questionNumber) {
                    unresolvedMarkers.push({
                        ...boundary,

                        reason:
                            'marker-without-question-number'
                    });

                    continue;
                }

                if (
                    expected.length > 0 &&
                    !expectedIndexMap.has(
                        questionNumber
                    )
                ) {
                    unknownMarkers.push({
                        questionNumber,

                        lineNo:
                            row.lineNo,

                        start:
                            row.start,

                        rawMarker:
                            parsed.rawMarker,

                        markerKind:
                            parsed.markerKind
                    });
                }

                if (
                    usedQuestionNumbers.has(
                        questionNumber
                    )
                ) {
                    duplicateMarkers.push({
                        questionNumber,

                        lineNo:
                            row.lineNo,

                        start:
                            row.start,

                        rawMarker:
                            parsed.rawMarker,

                        markerKind:
                            parsed.markerKind
                    });
                }

                usedQuestionNumbers.add(
                    questionNumber
                );

                const numericQuestion =
                    Number(questionNumber);

                if (
                    Number.isInteger(
                        numericQuestion
                    )
                ) {
                    lastNumericQuestion =
                        numericQuestion;
                }

                const expectedIndex =
                    expectedIndexMap.get(
                        questionNumber
                    );

                if (
                    Number.isInteger(
                        expectedIndex
                    ) &&
                    expectedIndex >=
                        expectedCursor
                ) {
                    expectedCursor =
                        expectedIndex + 1;
                }

                markers.push({
                    ...boundary,
                    boundaryIndex,
                    questionNumber
                });
            }

            return {
                markers,
                boundaries,
                unresolvedMarkers,
                duplicateMarkers,
                unknownMarkers,
                rejectedMarkerCandidates
            };
        };

        const parseExplicitSupportBlocks = ({
            pages = [],
            expectedQuestionNumbers = []
        } = {}) => {
            const {
                documentText,
                pageRanges
            } =
                buildSupportDocument(
                    pages
                );

            const {
                markers,
                boundaries,
                unresolvedMarkers,
                duplicateMarkers,
                unknownMarkers,
                rejectedMarkerCandidates
            } =
                scanSupportMarkers({
                    documentText,
                    expectedQuestionNumbers
                });

            const blocks = [];
            const droppedBlockMarkers = [];
            const answerRawSolutionSplits = [];

            markers.forEach(
                marker => {
                    const end =
                        boundaries[
                            marker.boundaryIndex + 1
                        ]
                            ?.start ??
                        documentText.length;

                    const rawBlock =
                        documentText
                            .slice(
                                marker.contentStart,
                                end
                            )
                            .trim();

                    if (!rawBlock) {
                        droppedBlockMarkers.push({
                            questionNumber:
                                marker.questionNumber,

                            markerKind:
                                marker.markerKind,

                            lineNo:
                                marker.lineNo,

                            reason:
                                'empty-raw-block'
                        });

                        return;
                    }

                    const answerLabelLength =
                        Math.max(
                            0,
                            Number(
                                marker.answerLabelLength || 0
                            )
                        );

                    const markerAnswerLabel =
                        answerLabelLength > 0
                            ? {
                                index:
                                    0,

                                end:
                                    answerLabelLength,

                                raw:
                                    rawBlock.slice(
                                        0,
                                        answerLabelLength
                                    )
                            }
                            : null;

                    const answerLabel =
                        markerAnswerLabel ||
                        findSupportLabel(
                            rawBlock,
                            ANSWER_LABEL_SOURCE,
                            {
                                atStart:
                                    true
                            }
                        );

                    if (!answerLabel) {
                        droppedBlockMarkers.push({
                            questionNumber:
                                marker.questionNumber,

                            markerKind:
                                marker.markerKind,

                            lineNo:
                                marker.lineNo,

                            reason:
                                'accepted-marker-answer-label-missing-in-block',

                            rawBlockHead:
                                rawBlock.slice(
                                    0,
                                    200
                                )
                        });

                        return;
                    }

                    const solutionLabel =
                        findSupportLabel(
                            rawBlock,
                            SOLUTION_LABEL_SOURCE
                        );

                    const answerEnd =
                        solutionLabel
                            ? solutionLabel.index
                            : rawBlock.length;

                    let answerRaw =
                        cleanSupportFieldText(
                            rawBlock
                                .slice(
                                    answerLabel.end,
                                    answerEnd
                                )
                                .trim()
                        );

                    let solutionRaw =
                        solutionLabel
                            ? cleanSupportFieldText(
                                rawBlock
                                    .slice(
                                        solutionLabel.end
                                    )
                                    .trim(),
                                {
                                    stripUnsupportedGraphics:
                                        true
                                }
                            )
                            : '';

                    let hasSolutionLabel =
                        Boolean(
                            solutionLabel
                        );

                    let correctedByAnswerRawSolutionSplit =
                        false;

                    if (
                        !solutionLabel &&
                        answerRaw
                    ) {
                        const embeddedSolutionLabel =
                            findEmbeddedSolutionLabelInAnswerRaw(
                                answerRaw
                            );

                        if (embeddedSolutionLabel) {
                            const nextAnswerRaw =
                                cleanSupportFieldText(
                                    answerRaw
                                        .slice(
                                            0,
                                            embeddedSolutionLabel.index
                                        )
                                        .trim()
                                );

                            const nextSolutionRaw =
                                cleanSupportFieldText(
                                    answerRaw
                                        .slice(
                                            embeddedSolutionLabel.end
                                        )
                                        .trim(),
                                    {
                                        stripUnsupportedGraphics:
                                            true
                                    }
                                );

                            if (nextSolutionRaw) {
                                answerRaw =
                                    nextAnswerRaw;

                                solutionRaw =
                                    nextSolutionRaw;

                                hasSolutionLabel =
                                    true;

                                correctedByAnswerRawSolutionSplit =
                                    true;

                                answerRawSolutionSplits.push({
                                    questionNumber:
                                        marker.questionNumber,

                                    labelRaw:
                                        embeddedSolutionLabel.raw,

                                    labelIndex:
                                        embeddedSolutionLabel.index,

                                    answerLength:
                                        answerRaw.length,

                                    solutionLength:
                                        solutionRaw.length
                                });
                            }
                        }
                    }

                    const page =
                        pageForOffset(
                            pageRanges,
                            marker.start
                        );

                    blocks.push({
                        questionNumber:
                            marker.questionNumber,

                        markerKind:
                            marker.markerKind,

                        markerLineNo:
                            marker.lineNo,

                        answerRaw,

                        solutionRaw,

                        hasAnswerLabel:
                            true,

                        hasSolutionLabel:
                            hasSolutionLabel,

                        correctedByAnswerRawSolutionSplit,

                        rawBlock,

                        sourcePage:
                            page?.pageNo || 0,

                        sourcePageImage:
                            page?.imageUrl || '',

                        questionEvidence:
                            'explicit-support-marker'
                    });
                }
            );

            const questionNumbers =
                blocks.map(
                    block =>
                        block.questionNumber
                );

            const duplicates =
                questionNumbers.filter(
                    (
                        number,
                        index,
                        array
                    ) =>
                        array.indexOf(number) !==
                        index
                );

            return {
                blocks,
                documentText,
                pageRanges,
                diagnostics: {
                    blockCount:
                        blocks.length,
                    questionNumbers,
                    duplicateQuestionNumbers:
                        [...new Set(
                            duplicates
                        )],
                    unresolvedMarkers,
                    duplicateMarkers,
                    unknownMarkers,
                    droppedBlockMarkers,
                    answerRawSolutionSplits,
                    rejectedMarkerCandidates,
                    markerKinds:
                        markers.map(
                            marker => ({
                                questionNumber:
                                    marker.questionNumber,
                                markerKind:
                                    marker.markerKind,
                                lineNo:
                                    marker.lineNo
                            })
                        )
                }
            };
        };

        const validateSupportCoverage = ({
            blocks = [],
            answers = [],
            solutions = [],
            expectedQuestionNumbers = [],
            requireAnswers = true,
            requireSolutions = false
        } = {}) => {
            const expected =
                normalizeExpectedQuestionNumbers(
                    expectedQuestionNumbers
                );

            const blockNumbers =
                blocks
                    .map(
                        block =>
                            normalizeQuestionNumber(
                                block.questionNumber
                            )
                    )
                    .filter(Boolean);

            const blockSet =
                new Set(blockNumbers);

            const answerSet =
                new Set(
                    (answers || [])
                        .filter(
                            item =>
                                String(
                                    item.answer || ''
                                ).trim()
                        )
                        .map(
                            item =>
                                normalizeQuestionNumber(
                                    item.question
                                )
                        )
                        .filter(Boolean)
                );

            const solutionSet =
                new Set(
                    (solutions || [])
                        .filter(
                            item =>
                                String(
                                    item.solution || ''
                                ).trim()
                        )
                        .map(
                            item =>
                                normalizeQuestionNumber(
                                    item.question
                                )
                        )
                        .filter(Boolean)
                );

            const missingBlocks =
                expected.filter(
                    questionNumber =>
                        !blockSet.has(
                            questionNumber
                        )
                );

            const unknownBlocks =
                blockNumbers.filter(
                    questionNumber =>
                        expected.length > 0 &&
                        !expected.includes(
                            questionNumber
                        )
                );

            const duplicateQuestionNumbers =
                blockNumbers.filter(
                    (
                        questionNumber,
                        index,
                        array
                    ) =>
                        array.indexOf(
                            questionNumber
                        ) !== index
                );

            const solutionLabelNumbers =
                blocks
                    .filter(
                        block =>
                            block.hasSolutionLabel
                    )
                    .map(
                        block =>
                            block.questionNumber
                    );

            const inferredSolutionDocument =
                requireSolutions ||
                (
                    expected.length > 0 &&
                    solutionLabelNumbers.length >=
                        Math.ceil(
                            expected.length * 0.6
                        )
                );

            const expectedAnswers =
                requireAnswers
                    ? expected
                    : blocks
                        .filter(
                            block =>
                                block.hasAnswerLabel
                        )
                        .map(
                            block =>
                                block.questionNumber
                        );

            const expectedSolutions =
                inferredSolutionDocument
                    ? expected
                    : solutionLabelNumbers;

            const missingAnswers =
                expectedAnswers.filter(
                    questionNumber =>
                        !answerSet.has(
                            questionNumber
                        )
                );

            const missingSolutions =
                expectedSolutions.filter(
                    questionNumber =>
                        !solutionSet.has(
                            questionNumber
                        )
                );

            return {
                ok:
                    missingBlocks.length === 0 &&
                    missingAnswers.length === 0 &&
                    missingSolutions.length === 0 &&
                    unknownBlocks.length === 0 &&
                    duplicateQuestionNumbers.length === 0,

                expectedQuestionNumbers:
                    expected,

                expectedAnswers,
                expectedSolutions,

                missingBlocks,
                missingAnswers,
                missingSolutions,

                unknownBlocks:
                    [...new Set(
                        unknownBlocks
                    )],

                duplicateQuestionNumbers:
                    [...new Set(
                        duplicateQuestionNumbers
                    )],

                inferredSolutionDocument
            };
        };

        return {
            normalizeQuestionNumber,
            normalizeExpectedQuestionNumbers,
            canonicalizeSupportOcrText,
            buildSupportDocument,
            parseSupportMarkerPrefix,
            scanSupportMarkers,
            parseExplicitSupportBlocks,
            validateSupportCoverage
        };
    }
);
