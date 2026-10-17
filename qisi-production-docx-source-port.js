(function initProductionDocxSourcePort(root, factory) {
    'use strict';

    const contract = root?.Qisi?.DocxProducerIdentityContract || (
        typeof module !== 'undefined' && module.exports
            ? require('./qisi-docx-producer-identity-contract.js')
            : null
    );
    const api = factory(contract);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionDocxSourcePort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
    'use strict';

    function createError(code, name = 'Error') {
        const error = new Error(code);
        error.name = name;
        error.code = code;
        return error;
    }

    function assertActive(signal) {
        if (signal?.aborted) throw createError('DOCX_SOURCE_ABORTED', 'AbortError');
    }

    async function parseDocxSource(input = {}, ports = {}) {
        const source = input.source;
        if (
            !source || String(source.id || '').trim().length === 0 ||
            String(source.fileType || '').toLowerCase() !== 'docx'
        ) throw createError('DOCX_SOURCE_INVALID');
        if (
            typeof ports.importer?.parseDocxFile !== 'function' ||
            typeof ports.convertDraft !== 'function' ||
            typeof ports.acceptDraft !== 'function'
        ) throw createError('DOCX_SOURCE_PORT_REQUIRED');

        assertActive(input.signal);
        const result = await ports.importer.parseDocxFile(source, {
            batch: input.batch,
            defaultMeta: input.defaultMeta || {},
            helpers: input.importerHelpers || {}
        });
        assertActive(input.signal);
        if (!result || typeof result !== 'object' || !Array.isArray(result.drafts)) {
            throw createError('DOCX_SOURCE_RESULT_MALFORMED');
        }

        const convertedDrafts = result.drafts.map(ports.convertDraft);
        const projectedDrafts = convertedDrafts.map((draft, index) =>
            contract.projectDeterministicDocxCandidate({
                candidate: draft,
                source: {
                    sourceId: source.id,
                    format: 'docx',
                    filename: source.filename || '',
                    mimeType: source.mimeType || source.type || '',
                    sourceOrder: Number.isInteger(source.sourceOrder)
                        ? source.sourceOrder : 0
                },
                engine: 'docx-xml-importer',
                page: 1,
                blockIds: draft?.sourceTrace?.blockIds || [],
                index
            })
        );
        const drafts = projectedDrafts.filter((draft, index, allDrafts) =>
            draft && typeof draft === 'object' &&
            ports.acceptDraft(draft, index, allDrafts) === true
        );
        assertActive(input.signal);
        return {
            drafts,
            draftImages: Array.isArray(result.draftImages) ? result.draftImages : [],
            unmatchedAnswers: Array.isArray(result.unmatchedAnswers)
                ? result.unmatchedAnswers
                : [],
            warnings: Array.isArray(result.warnings) ? result.warnings : []
        };
    }

    function createProductionImportRunner(ports = {}) {
        if (
            typeof ports.coordinator?.runDocxImport !== 'function' ||
            typeof ports.importer?.parseDocxFile !== 'function'
        ) throw createError('DOCX_PRODUCTION_PORT_REQUIRED');
        const cleanText = typeof ports.cleanText === 'function'
            ? ports.cleanText : value => String(value || '').trim();
        const cleanOptions = typeof ports.cleanOptions === 'function'
            ? ports.cleanOptions : values => (Array.isArray(values) ? values : []);
        const makeId = typeof ports.makeId === 'function'
            ? ports.makeId : prefix => `${prefix}_${Date.now()}`;
        const defaultMeta = typeof ports.getDefaultMeta === 'function'
            ? ports.getDefaultMeta : () => ({});
        const getRoles = typeof ports.getRoles === 'function'
            ? ports.getRoles
            : source => Array.isArray(source?.roles)
                ? source.roles
                : [source?.role].filter(Boolean);
        const normalizeQuestionNumber =
            typeof ports.normalizeQuestionNumber === 'function'
                ? ports.normalizeQuestionNumber
                : value => String(value || '').trim();

        const roleSet = source => new Set(
            getRoles(source).map(role => String(role || '').trim())
        );
        const isQuestionSource = source => {
            const roles = roleSet(source);
            return roles.has('question') || roles.has('full');
        };
        const supportRoles = source => {
            const roles = roleSet(source);
            return roles.has('full') ? ['answer', 'solution']
                : ['answer', 'solution'].filter(role => roles.has(role));
        };

        const parseSupportSource = async (source, batch, signal, importer) => {
            if (typeof ports.parseSupportText !== 'function') {
                throw createError('DOCX_SUPPORT_PARSER_REQUIRED');
            }
            assertActive(signal);
            const parsed = await importer.parseDocxFile(source, {
                batch,
                defaultMeta: batch.defaultMeta || defaultMeta(),
                helpers: {
                    cleanDisplayTextForBatchSave: cleanText,
                    makeBatchId: makeId
                }
            });
            assertActive(signal);
            if (!parsed || !Array.isArray(parsed.drafts)) {
                throw createError('DOCX_SUPPORT_RESULT_MALFORMED');
            }
            const text = parsed.supportText || parsed.drafts.map(draft =>
                draft.renderableText || draft.rawBlock || draft.stem || ''
            ).filter(Boolean).join('\n');
            // Word support often has a bare number followed immediately by an explicit label.
            // Anchor it before any leading image token; formula digits are never scanned as identity.
            const labeledText = parsed.supportSectionDeclared ? text.replace(
                /(^|\n)([0-9０-９]+)\.\s*((?:\$[^$]+\$\s*)+)(?=\n【(?:分析|解析|详解|解答)】)/g,
                '$1$2. 【答案】$3') : text;
            const anchored = labeledText.replace(/(^|\n)(\s*(?:\[\[IMAGE:[^\]]+\]\]\s*)*)([0-9０-９]+)\s*(?=【(?:答案|参考答案|解析|详解|解答)】)/g,
                '$1$3. $2');
            const result = ports.parseSupportText(anchored, source);
            const answerSlots = [...anchored.matchAll(/(?:^|\n)\s*([0-9０-９]+)\.\s*(?:\[\[IMAGE:[^\]]+\]\]\s*)*【(?:答案|参考答案)】([^\n]*)/g)];
            if (answerSlots.length) {
                // An empty explicit answer stays empty; digits in a solution cannot fill it.
                const explicitQuestions = new Set(answerSlots.map(slot => normalizeQuestionNumber(slot[1])));
                const unlabelledAnswers = result.answers.filter(item =>
                    !explicitQuestions.has(normalizeQuestionNumber(item.questionNumber || item.question)));
                result.answers = [...unlabelledAnswers, ...answerSlots.flatMap(slot => slot[2].trim()
                    ? ports.parseSupportText(slot[1] + '. 【答案】' + slot[2], source).answers
                        .filter(item => normalizeQuestionNumber(item.questionNumber || item.question) === normalizeQuestionNumber(slot[1]))
                    : [])];
            }
            for (const slot of answerSlots.filter(row => !row[2].trim())) {
                const question = normalizeQuestionNumber(slot[1]);
                const matches = result.solutions.filter(item =>
                    normalizeQuestionNumber(item.questionNumber || item.question) === question);
                if (matches.length !== 1) continue;
                const conclusion = String(matches[0].solution || '').trim()
                    .match(/(?:故选|应选)\s*[:：]\s*([A-D]{1,4})[。．.]?\s*$/);
                if (!conclusion) continue;
                const explicit = ports.parseSupportText(question + '. 【答案】' + conclusion[1], source).answers;
                result.answers.push(...explicit.filter(item =>
                    normalizeQuestionNumber(item.questionNumber || item.question) === question)
                    .map(item => ({ ...item, answerEvidence: {
                        kind: 'explicit-final-choice', sourceFileId: source.id,
                        questionNumber: question, rawStatement: conclusion[0],
                        rawSupportText: anchored
                    } })));
            }
            if (!result || !Array.isArray(result.answers) ||
                !Array.isArray(result.solutions)) {
                throw createError('DOCX_SUPPORT_RESULT_MALFORMED');
            }
            return { ...result, images: parsed.supportImages || [] };
        };

        return async function runProductionDocxImport(context = {}, signal) {
            const batch = context.batch || {};
            const parsedSources = new Map();
            const importer = { parseDocxFile(source, options) {
                if (!parsedSources.has(source.id)) parsedSources.set(source.id,
                    ports.importer.parseDocxFile(source, { ...options, signal }));
                return parsedSources.get(source.id);
            } };
            const sources = Array.isArray(context.sources)
                ? context.sources
                : [];
            const questionSources = sources.filter(isQuestionSource);
            const supportSources = sources.filter(source => supportRoles(source).length);
            if (!questionSources.length) {
                throw createError('DOCX_QUESTION_SOURCE_REQUIRED');
            }
            const base = await ports.coordinator.runDocxImport({
                batchId: context.batchId,
                sources: questionSources
            }, {
                parseSource: ({ source, candidateOffset }) => parseDocxSource({
                    source,
                    batch,
                    defaultMeta: batch.defaultMeta || defaultMeta(),
                    signal,
                    importerHelpers: {
                        cleanDisplayTextForBatchSave: cleanText,
                        makeBatchId: makeId
                    }
                }, {
                    importer,
                    convertDraft: (draft, index) => ({
                        ...draft,
                        id: draft.id || makeId('dq'),
                        batchId: batch.id || context.batchId,
                        order: candidateOffset + index + 1,
                        stem: cleanText(draft.stem),
                        options: cleanOptions(draft.options),
                        answer: cleanText(draft.answer),
                        solution: cleanText(draft.solution),
                        updatedAt: ports.clock ? ports.clock() : Date.now()
                    }),
                    acceptDraft: draft => Boolean(
                        cleanText(draft.stem) ||
                        cleanOptions(draft.options).some(value =>
                            cleanText(value) || /\[\[(?:IMAGE|FORMULA_IMAGE):/.test(
                                String(value || '')
                            )
                        )
                    )
                })
            }, signal);
            if (!supportSources.length) return base;

            const byQuestion = new Map();
            base.drafts.forEach((draft, index) => {
                const question = normalizeQuestionNumber(
                    draft.questionNumber || draft.question
                );
                if (!question || byQuestion.has(question)) {
                    throw createError('DOCX_SUPPORT_QUESTION_AMBIGUOUS');
                }
                byQuestion.set(question, index);
            });
            const drafts = [...base.drafts];
            const applied = new Set();
            const unmatchedAnswers = [];
            for (const source of supportSources) {
                const roles = supportRoles(source);
                const parsed = await parseSupportSource(source, batch, signal, importer);
                const groups = [
                    ['answer', parsed.answers],
                    ['solution', parsed.solutions]
                ];
                for (const [field, items] of groups) {
                    if (!roles.includes(field)) continue;
                    for (const item of items) {
                        const question = normalizeQuestionNumber(
                            item.questionNumber || item.question
                        );
                        const index = byQuestion.get(question);
                        if (index === undefined) {
                            unmatchedAnswers.push({
                                ...item,
                                field,
                                sourceFileId: source.id,
                                sourceFileName: source.filename || ''
                            });
                            continue;
                        }
                        const key = `${question}:${field}`;
                        if (applied.has(key)) {
                            throw createError('DOCX_SUPPORT_DUPLICATE');
                        }
                        applied.add(key);
                        drafts[index] =
                            contract.applyDeterministicDocxSupportField({
                                candidate: drafts[index],
                                field,
                                support: {
                                    ...item,
                                    questionNumber: question,
                                    images: parsed.images.filter(image =>
                                        String(item[field] || '').includes('[[IMAGE:' + image.id + ']]'))
                                },
                                source: {
                                    sourceId: source.id,
                                    format: 'docx',
                                    filename: source.filename || '',
                                    mimeType:
                                        source.mimeType || source.type || '',
                                    sourceOrder:
                                        Number.isInteger(source.sourceOrder)
                                            ? source.sourceOrder
                                            : 0
                                },
                                roles
                            });

                    }
                }
            }
            assertActive(signal);
            return Object.freeze({
                ...base,
                orderedSourceIds: Object.freeze(sources.map(source =>
                    String(source.id)
                )),
                drafts: Object.freeze(drafts),
                unmatchedAnswers: Object.freeze(unmatchedAnswers)
            });
        };
    }

    return Object.freeze({ parseDocxSource, createProductionImportRunner });
});
