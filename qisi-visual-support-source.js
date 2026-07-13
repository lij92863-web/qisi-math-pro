(function initVisualSupportSource(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.VisualSupportSource = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createVisualSupportSource(ports = {}) {
        const requiredFunctions = [
          "normalizeQuestionKey",
          "normalizeAnswerForLatex",
          "normalizeRecognizedSupportLatex",
          "extractGraphicRefs",
          "extractAnswerArray",
          "extractSolutionArray",
          "cleanRecognizedText",
          "buildSupportLeadingMissingBlockEvidence",
          "parseAnswerAndSolutionItemsFromText",
          "recognizePageAsDocumentText",
          "attachPdfPageTrace",
          "getBatchFileRoles",
          "logBatchPdfDiag"
];
        for (const name of requiredFunctions) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Visual support source requires ${name}.`
                );
                error.code = 'VISUAL_SUPPORT_SOURCE_PORT_REQUIRED';
                throw error;
            }
        }
        if (typeof ports.qwenTaskClient?.chatJson !== 'function') {
            const error = new TypeError(
                'Visual support source requires qwenTaskClient.chatJson.'
            );
            error.code = 'VISUAL_SUPPORT_SOURCE_PORT_REQUIRED';
            throw error;
        }

        const normalizeQuestionKey = ports.normalizeQuestionKey;
        const normalizeAnswerForLatex = ports.normalizeAnswerForLatex;
        const normalizeRecognizedSupportLatex = ports.normalizeRecognizedSupportLatex;
        const extractGraphicRefs = ports.extractGraphicRefs;
        const extractAnswerArray = ports.extractAnswerArray;
        const extractSolutionArray = ports.extractSolutionArray;
        const cleanRecognizedText = ports.cleanRecognizedText;
        const buildSupportLeadingMissingBlockEvidence = ports.buildSupportLeadingMissingBlockEvidence;
        const parseAnswerAndSolutionItemsFromText = ports.parseAnswerAndSolutionItemsFromText;
        const recognizePageAsDocumentText = ports.recognizePageAsDocumentText;
        const attachPdfPageTrace = ports.attachPdfPageTrace;
        const getBatchFileRoles = ports.getBatchFileRoles;
        const logBatchPdfDiag = ports.logBatchPdfDiag;
        const qwenTaskClient = ports.qwenTaskClient;

        const recognizeAnswerSolutionWithQwen = async (text, sourceFile, options = {}) => {
            const strictProtocol =
                options.strictProtocol === true;

            const allowedQuestionNumbers =
                new Set(
                    (
                        options.allowedQuestionNumbers ||
                        []
                    )
                        .map(
                            normalizeQuestionKey
                        )
                        .filter(Boolean)
                );

            const source = root.Qisi.Utils.cleanRecognizedText(text).slice(0, 24000);
            if (!source || source.length < 8) return { answers: [], solutions: [] };
            const prompt = `你是高中数学答案解析提取助手。请从材料中提取每道题的答案和解析，并输出严格 JSON。

        【输出格式】
        {
          "answers": [
            { "question": "1", "answer": "A" }
          ],
          "solutions": [
            { "question": "1", "solution": "解析内容，保留 LaTeX 公式" }
          ]
        }

        【要求】
        1. 支持“答案集中列出、解析集中列出”的格式。
        2. 支持“1.【答案】A【解析】……”的格式。
        3. 支持“第1题 答案：A 解析：……”的格式。
        4. 解析内容必须完整保留，直到下一题号前。
        5. 数学公式必须使用 LaTeX。
        6. 没有解析则 solution 为空字符串，不要编造。
        7. 输出必须是纯 JSON。
        8. 不要把图片占位符、\\includegraphics 或 OCR 失败提示写入 answer/solution。

        材料：
        ${source}`;
            const taskResult = await qwenTaskClient.chatJson({
                task: 'text-structure',
                prompt,
                timeoutMs: 90000,
                label: 'Qwen 答案解析结构化请求',
                signal: options.signal
            });
            const assistantText = taskResult.text;
            const parsed = taskResult.value;

            if (
                strictProtocol &&
                (
                    !parsed ||
                    typeof parsed !== 'object'
                )
            ) {
                const error = new Error(
                    '答案解析模型返回的内容不符合 JSON 协议。'
                );

                error.code =
                    'SUPPORT_JSON_PROTOCOL_ERROR';

                error.rawPreview =
                    assistantText.slice(
                        0,
                        1200
                    );

                throw error;
            }

            const rawAnswers = extractAnswerArray(parsed);
            const rawSolutions = extractSolutionArray(parsed);
            const answers = Array.isArray(rawAnswers) ? rawAnswers.map(item => ({
                question: root.Qisi.Utils.cleanRecognizedText(item.question),
                answer: normalizeAnswerForLatex(item.answer),
                confidence: Number(item.confidence || 0.82),
                warnings: [],
                sourceFileId: sourceFile.id,
                sourceFileName: sourceFile.filename,
                ...(strictProtocol ? {
                    controlledWriteDecision: {
                        accepted: true,
                        decisionId: `strict-docx-support:${sourceFile.id}:${normalizeQuestionKey(item.question)}:answer:${taskResult.model}`,
                        acceptedFields: ['answer'],
                        method: 'strict-json-contract',
                        sourceId: sourceFile.id,
                        engine: taskResult.model
                    }
                } : {})
            })).filter(item => item.question && item.answer) : [];
            const solutions = Array.isArray(rawSolutions) ? rawSolutions.map(item => ({
                question: root.Qisi.Utils.cleanRecognizedText(item.question),
                solution:
                    normalizeRecognizedSupportLatex(
                        item.solution,
                        'solution'
                    ),
                imageRefs: Array.isArray(item.imageRefs) ? item.imageRefs.map(cleanRecognizedText).filter(Boolean) : extractGraphicRefs(item.solution),
                confidence: Number(item.confidence || 0.82),
                warnings: [],
                sourceFileId: sourceFile.id,
                sourceFileName: sourceFile.filename,
                ...(strictProtocol ? {
                    controlledWriteDecision: {
                        accepted: true,
                        decisionId: `strict-docx-support:${sourceFile.id}:${normalizeQuestionKey(item.question)}:solution:${taskResult.model}`,
                        acceptedFields: ['solution'],
                        method: 'strict-json-contract',
                        sourceId: sourceFile.id,
                        engine: taskResult.model
                    }
                } : {})
            })).filter(item => item.question && item.solution) : [];

            if (
                strictProtocol &&
                allowedQuestionNumbers.size > 0
            ) {
                const unknownQuestions = [
                    ...answers,
                    ...solutions
                ]
                    .map(
                        item =>
                            normalizeQuestionKey(
                                item.question
                            )
                    )
                    .filter(
                        question =>
                            question &&
                            !allowedQuestionNumbers.has(
                                question
                            )
                    );

                if (
                    unknownQuestions.length > 0
                ) {
                    const error = new Error(
                        '答案解析模型返回了未请求的题号：' +
                        [
                            ...new Set(
                                unknownQuestions
                            )
                        ].join(',')
                    );

                    error.code =
                        'SUPPORT_JSON_UNKNOWN_QUESTION';

                    throw error;
                }
            }

            return { answers, solutions };
        };


        const compactDebugText = (
            value = '',
            {
                head = 300,
                tail = 120
            } = {}
        ) => {
            const text =
                String(value || '');

            if (
                text.length <=
                head + tail
            ) {
                return {
                    length:
                        text.length,
                    text
                };
            }

            return {
                length:
                    text.length,
                head:
                    text.slice(0, head),
                tail:
                    text.slice(
                        Math.max(
                            0,
                            text.length - tail
                        )
                    )
            };
        };

        const collectVisualSupportPageEvidence = async ({
            file,
            pages = [],
            onPageProgress = null,
            signal
        }) => {
            const evidence = {
                pages: [],
                answers: [],
                solutions: [],
                pageImages: [],
                failedPages: []
            };

            const normalizedPages = (
                Array.isArray(pages)
                    ? pages
                    : []
            ).map((page, index) => ({
                pageNo: Math.max(
                    1,
                    Number(
                        page?.pageNo ||
                        page?.sourcePage ||
                        index + 1
                    )
                ),

                imageUrl: String(
                    page?.url ||
                    page?.imageUrl ||
                    page?.sourcePageImage ||
                    ''
                ).trim()
            }));

            for (
                let index = 0;
                index < normalizedPages.length;
                index += 1
            ) {
                if (signal?.aborted) {
                    const cancelled = new Error(
                        'Support recognition cancelled.'
                    );
                    cancelled.name = 'AbortError';
                    cancelled.code = 'OCR_REQUEST_CANCELLED';
                    throw cancelled;
                }
                const page =
                    normalizedPages[index];

                const pageNo =
                    page.pageNo;

                try {
                    if (!page.imageUrl) {
                        throw new Error(
                            `第 ${pageNo} 页没有可用页面图`
                        );
                    }

                    evidence.pageImages.push({
                        sourceFileId:
                            file.id,

                        sourceFileName:
                            file.filename,

                        pageNo,

                        imageUrl:
                            page.imageUrl
                    });

                    const rawText =
                        root.Qisi.Utils.cleanRecognizedText(
                            await recognizePageAsDocumentText(
                                page.imageUrl,
                                signal
                            )
                        );

                    if (!rawText) {
                        throw new Error(
                            `第 ${pageNo} 页 OCR 返回为空`
                        );
                    }

                    console.log(
                        '[BATCH_DEBUG][support-evidence-page-raw]',
                        {
                            filename:
                                file.filename,

                            pageNo,

                            rawText:
                                compactDebugText(
                                    rawText
                                )
                        }
                    );

                    evidence.pages.push({
                        pageNo,
                        imageUrl:
                            page.imageUrl,
                        rawText
                    });

                    const localResult =
                        parseAnswerAndSolutionItemsFromText(
                            rawText,
                            file
                        );

                    const pageAnswers =
                        attachPdfPageTrace(
                            localResult?.answers || [],
                            file,
                            pageNo,
                            page.imageUrl,
                            rawText
                        );

                    const pageSolutions =
                        attachPdfPageTrace(
                            localResult?.solutions || [],
                            file,
                            pageNo,
                            page.imageUrl,
                            rawText
                        );

                    evidence.answers.push(
                        ...pageAnswers
                    );

                    evidence.solutions.push(
                        ...pageSolutions
                    );

                    console.log(
                        '[BATCH_DEBUG][support-evidence-page-done]',
                        {
                            filename:
                                file.filename,

                            pageNo,

                            rawTextLength:
                                rawText.length,

                            localAnswerQuestions:
                                pageAnswers.map(
                                    item =>
                                        normalizeQuestionKey(
                                            item.question
                                        ) ||
                                        item.question
                                ),

                            localSolutionQuestions:
                                pageSolutions.map(
                                    item =>
                                        normalizeQuestionKey(
                                            item.question
                                        ) ||
                                        item.question
                                )
                        }
                    );
                } catch (error) {
                    evidence.failedPages.push({
                        pageNo,
                        message:
                            error?.message ||
                            String(error)
                    });

                    console.warn(
                        '[BATCH_DEBUG][support-evidence-page-failed]',
                        {
                            filename:
                                file.filename,

                            pageNo,

                            message:
                                error?.message ||
                                String(error)
                        },
                        error
                    );

                    if (
                        error?.name === 'AbortError' ||
                        root.Qisi.Utils.isFatalQwenServiceError(
                            error
                        )
                    ) {
                        throw error;
                    }
                } finally {
                    if (
                        typeof onPageProgress ===
                        'function'
                    ) {
                        await onPageProgress(
                            (
                                index + 1
                            ) /
                            Math.max(
                                1,
                                normalizedPages.length
                            ),
                            {
                                pageNo,
                                done:
                                    index + 1,
                                total:
                                    normalizedPages.length
                            }
                        );
                    }
                }
            }

            return evidence;
        };

        const repairMissingSupportFieldsWithQwen = async ({
            file,
            requests = [],
            signal
        }) => {
            const answers = [];
            const solutions = [];
            const diagnostics = [];

            for (
                const request of
                requests || []
            ) {
                const questionNumber =
                    normalizeQuestionKey(
                        request
                            ?.questionNumber
                    );

                const missingFields =
                    [
                        ...new Set(
                            (
                                request
                                    ?.missingFields ||
                                []
                            )
                                .filter(
                                    field =>
                                        field ===
                                            'answer' ||
                                        field ===
                                            'solution'
                                )
                        )
                    ];

                if (
                    !questionNumber ||
                    missingFields.length === 0
                ) {
                    continue;
                }

                const rawBlock =
                    root.Qisi.Utils.cleanRecognizedText(
                        request.rawBlock ||
                        ''
                    ).slice(
                        0,
                        12000
                    );

                if (!rawBlock) {
                    diagnostics.push({
                        questionNumber,
                        missingFields,
                        status:
                            'empty-source'
                    });

                    continue;
                }

                const needsAnswer =
                    missingFields.includes(
                        'answer'
                    );

                const needsSolution =
                    missingFields.includes(
                        'solution'
                    );

                const prompt = `你是高中数学答案文档的缺失字段恢复器。

        题号和题目边界已经由程序确定。不要重新切题，不要修改题号。

        【固定题号】
        ${questionNumber}

        【只允许恢复的字段】
        ${missingFields.join(', ')}

        【已有答案】
        ${request.existingAnswer || '空'}

        【已有解析】
        ${request.existingSolution || '空'}

        【原始答案文档 block】
        ${rawBlock}

        【任务规则】
        1. 只能依据当前 block 中已经存在的明确文字、公式或结论恢复缺失字段。
        2. 不得重新解题，不得补充材料中没有的推导，不得猜测。
        3. 如果缺少 answer，可以从解析末尾的明确结论中恢复，例如“故选：C”恢复为 "C"，或“最大值为 ...”恢复为该值。
        4. 没有被列为缺失的字段必须返回空字符串。
        5. 如果无法可靠恢复某个缺失字段，也返回空字符串。
        6. 输出必须是纯 JSON，不要添加解释文字。

        【输出格式】
        {
          "question": "${questionNumber}",
          "answer": "",
          "solution": "",
          "evidence": "用于恢复的原文短摘录"
        }`;

                const taskResult =
                    await qwenTaskClient.chatJson({
                        task: 'text-structure',
                        prompt,
                        timeoutMs: 90000,
                        maxTokens: 2048,
                        label:
                            'Qwen 答案文档缺失字段恢复请求',
                        signal
                    });

                const assistantText =
                    taskResult.text;

                const parsed =
                    taskResult.value;

                if (
                    !parsed ||
                    typeof parsed !==
                        'object' ||
                    Array.isArray(parsed)
                ) {
                    const error =
                        new Error(
                            `第 ${questionNumber} 题缺失字段修复返回内容不是合法 JSON。`
                        );

                    error.code =
                        'SUPPORT_REPAIR_JSON_PROTOCOL_ERROR';

                    error.questionNumber =
                        questionNumber;

                    error.rawPreview =
                        assistantText.slice(
                            0,
                            1200
                        );

                    throw error;
                }

                const returnedQuestion =
                    normalizeQuestionKey(
                        parsed.question
                    );

                if (
                    returnedQuestion !==
                    questionNumber
                ) {
                    const error =
                        new Error(
                            `缺失字段修复题号不一致：请求 ${questionNumber}，返回 ${returnedQuestion || '空'}。`
                        );

                    error.code =
                        'SUPPORT_REPAIR_QUESTION_MISMATCH';

                    error.questionNumber =
                        questionNumber;

                    error.returnedQuestion =
                        returnedQuestion;

                    throw error;
                }

                if (
                    typeof parsed.answer !==
                        'string' ||
                    typeof parsed.solution !==
                        'string'
                ) {
                    const error =
                        new Error(
                            `第 ${questionNumber} 题缺失字段修复返回字段类型不合法。`
                        );

                    error.code =
                        'SUPPORT_REPAIR_FIELD_PROTOCOL_ERROR';

                    error.questionNumber =
                        questionNumber;

                    throw error;
                }

                const answer =
                    needsAnswer
                        ? normalizeAnswerForLatex(
                            parsed.answer
                        )
                        : '';

                const solution =
                    needsSolution
                        ? normalizeRecognizedSupportLatex(
                            parsed.solution,
                            'solution'
                        )
                        : '';

                const repairEvidence =
                    root.Qisi.Utils.cleanRecognizedText(
                        parsed.evidence ||
                        ''
                    ).slice(
                        0,
                        600
                    );

                const baseItem = {
                    question:
                        questionNumber,

                    confidence:
                        0.78,

                    warnings: [
                        '该字段由答案文档单题缺失字段恢复生成，请人工复核。'
                    ],

                    sourceFileId:
                        file.id,

                    sourceFileName:
                        file.filename,

                    sourcePage:
                        request.sourcePage ||
                        0,

                    sourcePageImage:
                        request
                            .sourcePageImage ||
                        '',

                    rawText:
                        request.rawBlock ||
                        '',

                    questionEvidence:
                        request
                            .questionEvidence ||
                        '',

                    repairEvidence,

                    sourceTrace: {
                        source:
                            'support-missing-field-repair',

                        questionEvidence:
                            request
                                .questionEvidence ||
                            '',

                        sourcePage:
                            request.sourcePage ||
                            0,

                        sourcePageImage:
                            request
                                .sourcePageImage ||
                            '',

                        missingFields:
                            [...missingFields]
                    }
                };

                if (answer) {
                    answers.push({
                        ...baseItem,
                        answer
                    });
                }

                if (solution) {
                    solutions.push({
                        ...baseItem,
                        solution,

                        imageRefs:
                            extractGraphicRefs(
                                solution
                            )
                    });
                }

                diagnostics.push({
                    questionNumber,
                    missingFields,
                    answerRecovered:
                        Boolean(answer),
                    solutionRecovered:
                        Boolean(solution),
                    repairEvidence,
                    status:
                        answer || solution
                            ? 'recovered'
                            : 'not-recovered'
                });
            }

            return {
                answers,
                solutions,
                diagnostics
            };
        };

        const recognizeSupportDocumentFromEvidence = async ({
            file,
            evidence,
            strict = false,
            expectedQuestionNumbers = [],
            requiredKinds = {
                answers: true,
                solutions: false
            },
            signal
        }) => {
            const pages = Array.isArray(
                evidence?.pages
            )
                ? [...evidence.pages]
                    .sort(
                        (a, b) =>
                            Number(a.pageNo) -
                            Number(b.pageNo)
                    )
                : [];

            if (!pages.length) {
                return {
                    answers:
                        evidence?.answers || [],

                    solutions:
                        evidence?.solutions || []
                };
            }

            const parser =
                globalThis.Qisi
                    ?.SupportParser;

            if (
                !parser ||
                typeof parser
                    .parseExplicitSupportBlocks !==
                    'function'
            ) {
                if (strict) {
                    const error = new Error(
                        '支持内容解析器未加载，无法执行严格答案/解析 DOCX 覆盖率检查。'
                    );

                    error.code =
                        'SUPPORT_PARSER_MISSING';

                    throw error;
                }
            } else {
                const parsedDocument =
                    parser.parseExplicitSupportBlocks({
                        pages,
                        expectedQuestionNumbers
                    });

                const blocks =
                    parsedDocument.blocks || [];

                const supportDiagnostics =
                    parsedDocument
                        .diagnostics ||
                    {};

                console.log(
                    '[BATCH_DEBUG][support-explicit-blocks]',
                    {
                        filename:
                            file.filename,

                        blockCount:
                            blocks.length,

                        questionNumbers:
                            supportDiagnostics
                                .questionNumbers ||
                            [],

                        duplicateQuestionNumbers:
                            supportDiagnostics
                                .duplicateQuestionNumbers ||
                            [],

                        unresolvedMarkerCount:
                            (
                                supportDiagnostics
                                    .unresolvedMarkers ||
                                []
                            ).length,

                        duplicateMarkerCount:
                            (
                                supportDiagnostics
                                    .duplicateMarkers ||
                                []
                            ).length,

                        unknownMarkerCount:
                            (
                                supportDiagnostics
                                    .unknownMarkers ||
                                []
                            ).length,

                        droppedBlockMarkerCount:
                            (
                                supportDiagnostics
                                    .droppedBlockMarkers ||
                                []
                            ).length,

                        rejectedMarkerCandidateCount:
                            (
                                supportDiagnostics
                                    .rejectedMarkerCandidates ||
                                []
                            ).length,

                        markerKinds:
                            (
                                supportDiagnostics
                                    .markerKinds ||
                                []
                            ).map(marker => ({
                                questionNumber:
                                    marker
                                        .questionNumber,
                                markerKind:
                                    marker.markerKind,
                                lineNo:
                                    marker.lineNo
                            }))
                    }
                );

                console.log(
                    '[BATCH_DEBUG][support-blocks-summary]',
                    {
                        filename:
                            file.filename,
                        blocks:
                            blocks.map(block => ({
                                questionNumber:
                                    block.questionNumber,
                                sourcePage:
                                    block.sourcePage,
                                answerLength:
                                    String(
                                        block.answerRaw ||
                                        ''
                                    ).length,
                                solutionLength:
                                    String(
                                        block.solutionRaw ||
                                        ''
                                    ).length
                            }))
                    }
                );

                if (blocks.length > 0) {
                    const answers = [];
                    const solutions = [];

                    for (
                        const block of blocks
                    ) {
                        const answer =
                            normalizeAnswerForLatex(
                                block.answerRaw || ''
                            );

                        const solution =
                            normalizeRecognizedSupportLatex(
                                block.solutionRaw || '',
                                'solution'
                            );

                        if (answer) {
                            answers.push({
                                question:
                                    block.questionNumber,
                                answer,
                                confidence:
                                    0.92,
                                warnings: [],
                                sourceFileId:
                                    file.id,
                                sourceFileName:
                                    file.filename,
                                sourcePage:
                                    block.sourcePage,
                                sourcePageImage:
                                    block.sourcePageImage,
                                rawText:
                                    block.rawBlock,
                                questionEvidence:
                                    block.questionEvidence,
                                sourceTrace: {
                                    source:
                                        'explicit-support-document-block',
                                    questionEvidence:
                                        block.questionEvidence,
                                    sourcePage:
                                        block.sourcePage,
                                    sourcePageImage:
                                        block.sourcePageImage
                                }
                            });
                        }

                        if (solution) {
                            solutions.push({
                                question:
                                    block.questionNumber,
                                solution,
                                imageRefs:
                                    extractGraphicRefs(
                                        solution
                                    ),
                                confidence:
                                    0.92,
                                warnings: [],
                                sourceFileId:
                                    file.id,
                                sourceFileName:
                                    file.filename,
                                sourcePage:
                                    block.sourcePage,
                                sourcePageImage:
                                    block.sourcePageImage,
                                rawText:
                                    block.rawBlock,
                                questionEvidence:
                                    block.questionEvidence,
                                sourceTrace: {
                                    source:
                                        'explicit-support-document-block',
                                    questionEvidence:
                                        block.questionEvidence,
                                    sourcePage:
                                        block.sourcePage,
                                    sourcePageImage:
                                        block.sourcePageImage
                                }
                            });
                        }

                    }

                    const repairPolicy =
                        globalThis.Qisi
                            ?.SupportRepair;

                    if (
                        !repairPolicy ||
                        typeof repairPolicy
                            .buildSupportRepairPlan !==
                            'function' ||
                        typeof repairPolicy
                            .applySupportRepairsFillOnly !==
                            'function'
                    ) {
                        if (strict) {
                            const error =
                                new Error(
                                    '支持内容缺失字段修复策略未加载。'
                                );

                            error.code =
                                'SUPPORT_REPAIR_POLICY_MISSING';

                            throw error;
                        }
                    }

                    const repairPlan =
                        repairPolicy
                            ? repairPolicy
                                .buildSupportRepairPlan({
                                    blocks,
                                    answers,
                                    solutions,

                                    requireAnswers:
                                        requiredKinds
                                            .answers ===
                                        true,

                                    requireSolutions:
                                        requiredKinds
                                            .solutions ===
                                        true
                                })
                            : [];

                    console.log(
                        '[BATCH_DEBUG][support-repair-plan]',
                        {
                            filename:
                                file.filename,

                            requests:
                                repairPlan.map(
                                    request => ({
                                        questionNumber:
                                            request
                                                .questionNumber,

                                        missingFields:
                                            request
                                                .missingFields,

                                        sourcePage:
                                            request
                                                .sourcePage,

                                        hasExistingAnswer:
                                            Boolean(
                                                request
                                                    .existingAnswer
                                            ),

                                        hasExistingSolution:
                                            Boolean(
                                                request
                                                    .existingSolution
                                            )
                                    })
                                )
                        }
                    );

                    if (
                        repairPlan.length > 0
                    ) {
                        const repaired =
                            await repairMissingSupportFieldsWithQwen({
                                file,
                                requests:
                                    repairPlan,
                                signal
                            });

                        const applied =
                            repairPolicy
                                .applySupportRepairsFillOnly({
                                    answers,
                                    solutions,

                                    repairedAnswers:
                                        repaired.answers ||
                                        [],

                                    repairedSolutions:
                                        repaired.solutions ||
                                        [],

                                    allowedQuestionNumbers:
                                        repairPlan.map(
                                            request =>
                                                request
                                                    .questionNumber
                                        )
                                });

                        answers.splice(
                            0,
                            answers.length,
                            ...(applied.answers || [])
                        );

                        solutions.splice(
                            0,
                            solutions.length,
                            ...(applied.solutions || [])
                        );

                        console.log(
                            '[BATCH_DEBUG][support-repair-result]',
                            {
                                filename:
                                    file.filename,

                                aiDiagnostics:
                                    repaired
                                        .diagnostics ||
                                    [],

                                applyDiagnostics:
                                    applied
                                        .diagnostics ||
                                    {}
                            }
                        );
                    }

                    const coverage =
                        parser.validateSupportCoverage({
                            blocks,
                            answers,
                            solutions,
                            expectedQuestionNumbers,
                            requireAnswers:
                                requiredKinds.answers ===
                                true,
                            requireSolutions:
                                requiredKinds.solutions ===
                                true
                        });

                    console.log(
                        '[BATCH_DEBUG][support-document-coverage]',
                        {
                            filename:
                                file.filename,

                            blockCount:
                                blocks.length,

                            expectedAnswers:
                                coverage.expectedAnswers,

                            expectedSolutions:
                                coverage.expectedSolutions,

                            expectedQuestionNumbers:
                                coverage.expectedQuestionNumbers,

                            missingBlocks:
                                coverage.missingBlocks,

                            missingAnswers:
                                coverage.missingAnswers,

                            missingSolutions:
                                coverage.missingSolutions,

                            unknownBlocks:
                                coverage.unknownBlocks,

                            duplicateQuestionNumbers:
                                coverage.duplicateQuestionNumbers
                        }
                    );

                    const supportCoverageMissingBlocks =
                        (
                            coverage.missingBlocks ||
                            []
                        )
                            .map(value =>
                                String(value ?? '')
                                    .trim()
                            )
                            .filter(Boolean);

                    const supportCoverageExpectedQuestionNumbers =
                        (
                            coverage
                                .expectedQuestionNumbers ||
                            expectedQuestionNumbers ||
                            []
                        )
                            .map(value =>
                                String(value ?? '')
                                    .trim()
                            )
                            .filter(Boolean);

                    const firstExpectedQuestionNumber =
                        supportCoverageExpectedQuestionNumbers[0] ||
                        (
                            expectedQuestionNumbers ||
                            []
                        )
                            .map(value =>
                                String(value ?? '')
                                    .trim()
                            )
                            .filter(Boolean)[0] ||
                        '';

                    const missingFirstExpectedBlock =
                        firstExpectedQuestionNumber &&
                        supportCoverageMissingBlocks
                            .includes(
                                firstExpectedQuestionNumber
                            );

                    if (
                        strict &&
                        !coverage.ok
                    ) {
                        if (missingFirstExpectedBlock) {
                            console.error(
                                '[BATCH_DEBUG][support-leading-missing-block-evidence]',
                                buildSupportLeadingMissingBlockEvidence({
                                    filename:
                                        file.filename,
                                    documentText:
                                        parsedDocument
                                            .documentText ||
                                        '',
                                    missingBlocks:
                                        coverage
                                            .missingBlocks ||
                                        [],
                                    expectedQuestionNumbers:
                                        coverage
                                            .expectedQuestionNumbers ||
                                        expectedQuestionNumbers ||
                                        [],
                                    parsedQuestionNumbers:
                                        supportDiagnostics
                                            .questionNumbers ||
                                        blocks.map(
                                            block =>
                                                block
                                                    .questionNumber
                                        ),
                                    blocks,
                                    diagnostics:
                                        supportDiagnostics
                                })
                            );
                        }

                        console.error(
                            '[BATCH_DEBUG][support-document-coverage-failed-diagnostics]',
                            {
                                filename:
                                    file.filename,

                                coverage,

                                diagnostics:
                                    supportDiagnostics
                            }
                        );

                        const error = new Error(
                            '答案/解析文档结构化不完整：' +
                            `缺少答案 ${coverage.missingAnswers.join(',') || '无'}；` +
                            `缺少解析 ${coverage.missingSolutions.join(',') || '无'}。`
                        );

                        error.code =
                            'SUPPORT_DOCUMENT_COVERAGE_INCOMPLETE';

                        error.coverage =
                            coverage;

                        error.diagnostics =
                            supportDiagnostics;

                        throw error;
                    }

                    console.log(
                        '[BATCH_DEBUG][support-document-structured]',
                        {
                            filename:
                                file.filename,

                            pageCount:
                                pages.length,

                            documentTextLength:
                                parsedDocument
                                    .documentText
                                    .length,

                            answerQuestions:
                                answers.map(
                                    item =>
                                        normalizeQuestionKey(
                                            item.question
                                        ) ||
                                        item.question
                                ),

                            solutionQuestions:
                                solutions.map(
                                    item =>
                                        normalizeQuestionKey(
                                            item.question
                                        ) ||
                                        item.question
                                )
                        }
                    );

                    return {
                        answers,
                        solutions,
                        blocks,
                        coverage
                    };
                }

                const documentResult =
                    await recognizeAnswerSolutionWithQwen(
                        parsedDocument.documentText,
                        file,
                        {
                            strictProtocol:
                                strict,
                            signal
                        }
                    );

                return {
                    ...documentResult,
                    coverage:
                        null,
                    blocks: []
                };
            }

            const documentText =
                pages
                    .map(page => [
                        `===== 第 ${page.pageNo} 页开始 =====`,
                        page.rawText,
                        `===== 第 ${page.pageNo} 页结束 =====`
                    ].join('\n'))
                    .join('\n\n');

            return await recognizeAnswerSolutionWithQwen(
                documentText,
                file,
                {
                    strictProtocol: strict,
                    allowedQuestionNumbers:
                        expectedQuestionNumbers,
                    signal
                }
            );
        };

        const recognizeVisualSupportFromPreparedPages = async ({
            file,
            pages = [],
            onPageProgress = null,
            strict = false,
            expectedQuestionNumbers = [],
            requiredKinds = {
                answers: true,
                solutions: false
            },
            signal
        }) => {
            logBatchPdfDiag('visual-support-start', {
                filename: file?.filename || '',
                fileType: file?.fileType || '',
                roles: getBatchFileRoles(file),
                inputPageCount: pages.length,
                pageNos: pages.map(page => page.pageNo || 1),
                strict,
                expectedQuestionNumbers,
                requiredKinds
            });

            const evidence =
                await collectVisualSupportPageEvidence({
                    file,
                    pages,
                    onPageProgress,
                    signal
                });

            if (
                strict &&
                Array.isArray(evidence.failedPages) &&
                evidence.failedPages.length > 0
            ) {
                const error = new Error(
                    `答案/解析文件共有 ${pages.length} 页，` +
                    `其中 ${evidence.failedPages.length} 页 OCR 失败。` +
                    '已停止生成不完整答案。'
                );

                error.code =
                    'SUPPORT_PAGE_EVIDENCE_INCOMPLETE';

                error.stage =
                    'support-page-evidence';

                error.failedPages =
                    evidence.failedPages;

                throw error;
            }

            let structured = {
                answers:
                    evidence.answers || [],

                solutions:
                    evidence.solutions || []
            };

            try {
                structured =
                    await recognizeSupportDocumentFromEvidence({
                        file,
                        evidence,
                        strict,
                        expectedQuestionNumbers,
                        requiredKinds,
                        signal
                    });
            } catch (error) {
                if (
                    strict ||
                    root.Qisi.Utils.isFatalQwenServiceError(error)
                ) {
                    throw error;
                }

                console.warn(
                    '[BATCH_DEBUG][support-document-structure-failed-keep-local]',
                    {
                        filename:
                            file.filename,

                        message:
                            error?.message ||
                            String(error)
                    },
                    error
                );
            }

            const result = {
                questions: [],
                answers:
                    structured.answers || [],
                solutions:
                    structured.solutions || [],
                rawTextPages:
                    (evidence.pages || [])
                        .map(page => page.rawText || '')
                        .filter(Boolean),
                pageImages:
                    evidence.pageImages || [],
                failedPages:
                    evidence.failedPages || []
            };

            console.log(
                '[BATCH_DEBUG][visual-support-final]',
                {
                    filename:
                        file.filename,

                    pageCount:
                        evidence.pages.length,

                    answerCount:
                        result.answers.length,

                    solutionCount:
                        result.solutions.length,

                    pageImageCount:
                        result.pageImages.length,

                    failedPageCount:
                        result.failedPages.length,

                    answerQuestions:
                        result.answers.map(
                            item =>
                                item.question
                        ),

                    solutionQuestions:
                        result.solutions.map(
                            item =>
                                item.question
                        ),

                    failedPages:
                        result.failedPages.map(
                            item => ({
                                pageNo:
                                    item.pageNo,
                                message:
                                    item.message ||
                                    ''
                            })
                        )
                }
            );

            logBatchPdfDiag('visual-support-result', {
                filename: file?.filename || '',
                fileType: file?.fileType || '',
                roles: getBatchFileRoles(file),
                inputPageCount: pages.length,
                evidencePageCount: evidence.pages.length,
                answerCount: result.answers.length,
                solutionCount: result.solutions.length,
                pageImageCount: result.pageImages.length,
                failedPageCount: result.failedPages.length,
                failedPages: result.failedPages.map(item => ({
                    pageNo: item.pageNo,
                    message: item.message || ''
                }))
            });

            return result;
        };







        return Object.freeze({
            collectVisualSupportPageEvidence,
            recognizeAnswerSolutionWithQwen,
            recognizeVisualSupportFromPreparedPages
        });
    }

    return Object.freeze({ createVisualSupportSource });
});
