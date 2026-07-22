(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewDraftState = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined' ? globalThis : this,
    function (root) {
        'use strict';

        const utils = () => root.Qisi?.Utils || {};

        const cleanRecognizedText = (value) => {
            const fn = utils().cleanRecognizedText;
            if (typeof fn === 'function') return fn(value);
            if (value === false || value === true || value === null || value === undefined) return '';
            if (Array.isArray(value)) return value.map(cleanRecognizedText).filter(Boolean).join('\n');
            if (typeof value === 'object') return '';
            return String(value)
                .replace(/\r\n?/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/[ \t]+\n/g, '\n')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        };

        const cleanDisplayOptionsForBatchSave = (options) => {
            const fn = utils().cleanDisplayOptionsForBatchSave;
            if (typeof fn === 'function') return fn(options);
            const arr = Array.isArray(options) ? options : ['', '', '', ''];
            return [0, 1, 2, 3].map(idx => cleanRecognizedText(arr[idx] || ''));
        };

        const summarizeDraftStatus = drafts => {
            const items = (drafts || []).map((d, i) => ({
                question: d.question || String(i + 1),
                hasAnswer: Boolean(d.answer),
                hasSolution: Boolean(d.solution),
                warnings: d.warnings || []
            }));
            return {
                total: items.length,
                complete: items.filter(d => d.hasAnswer && d.hasSolution).length,
                missingAnswer: items.filter(d => !d.hasAnswer).length,
                missingSolution: items.filter(d => !d.hasSolution).length,
                safePartial: items.some(d => !d.hasAnswer)
            };
        };

        const normalizeDraftPreviewOptions = (question) => {
            const options = Array.isArray(question?.options)
                ? question.options.slice(0, 4).map(option => String(option || ''))
                : [];

            const normalized = [0, 1, 2, 3].map(index => options[index] || '');
            return normalized.some(option => option.trim())
                ? normalized
                : ['', '', '', ''];
        };

        const normalizeDraftEditorNewlines = (value) =>
            String(value ?? '').replace(/\r\n?/g, '\n');

        const normalizeEditorChoiceLabel = value =>
            String(value || '')
                .replace(/[Ａ-Ｄａ-ｄ]/g, character =>
                    String.fromCharCode(character.charCodeAt(0) - 65248)
                )
                .toUpperCase();

        const splitChoiceSourceForEditor = source => {
            const text = normalizeDraftEditorNewlines(source);
            if (!text.trim()) return null;

            const labelRegex = /(^|\n)[ \t　]*([A-DＡ-Ｄa-dａ-ｄ])\s*[.．。、:：)）]/g;
            const hits = [];
            let match;

            while ((match = labelRegex.exec(text)) !== null) {
                hits.push({
                    label: normalizeEditorChoiceLabel(match[2]),
                    start: match.index + String(match[1] || '').length,
                    contentStart: labelRegex.lastIndex
                });
            }

            let bestSequence = null;

            for (let startIndex = 0; startIndex < hits.length; startIndex += 1) {
                if (hits[startIndex].label !== 'A') continue;

                const sequence = [hits[startIndex]];
                let expectedCode = 'B'.charCodeAt(0);

                for (let index = startIndex + 1; index < hits.length; index += 1) {
                    const expectedLabel = String.fromCharCode(expectedCode);

                    if (hits[index].label === expectedLabel) {
                        sequence.push(hits[index]);
                        expectedCode += 1;
                        if (expectedCode > 'D'.charCodeAt(0)) break;
                    }
                }

                if (
                    sequence.length >= 2 &&
                    (!bestSequence || sequence.length > bestSequence.length)
                ) {
                    bestSequence = sequence;
                }
            }

            if (!bestSequence) return null;

            const options = ['', '', '', ''];

            bestSequence.forEach((hit, index) => {
                const next = bestSequence[index + 1];
                const end = next ? next.start : text.length;
                const optionIndex = hit.label.charCodeAt(0) - 65;
                options[optionIndex] = text.slice(hit.contentStart, end).trim();
            });

            const stem = text.slice(0, bestSequence[0].start).trimEnd();
            if (!stem.trim()) return null;

            return { stem, options };
        };

        const buildDraftEditorProjection = (source, question) => {
            const text = normalizeDraftEditorNewlines(source);
            const type = String(question?.type || '解答题').trim();
            const isChoice = type === '单选题' || type === '多选题';

            if (!isChoice) {
                return {
                    stem: text,
                    options: ['', '', '', ''],
                    type,
                    parsedOptions: false
                };
            }

            const split = splitChoiceSourceForEditor(text);

            if (split) {
                return {
                    stem: split.stem,
                    options: [0, 1, 2, 3].map(index =>
                        String(split.options?.[index] || '')
                    ),
                    type,
                    parsedOptions: true
                };
            }

            return {
                stem: text,
                options: normalizeDraftPreviewOptions(question),
                type,
                parsedOptions: false
            };
        };

        const syncActiveDraftEditorFromQuestion = ({
            activeDraftQuestion,
            activeDraftEditorBuffer,
            activeDraftEditorOriginal,
            activeDraftEditorQuestionId,
            buildDraftEditorSource
        } = {}) => {
            const q = activeDraftQuestion?.value;

            if (!q) {
                if (activeDraftEditorBuffer) activeDraftEditorBuffer.value = '';
                if (activeDraftEditorOriginal) activeDraftEditorOriginal.value = '';
                if (activeDraftEditorQuestionId) activeDraftEditorQuestionId.value = '';
                return;
            }

            const source = typeof buildDraftEditorSource === 'function'
                ? buildDraftEditorSource(q)
                : '';
            activeDraftEditorBuffer.value = source;
            activeDraftEditorOriginal.value = source;
            activeDraftEditorQuestionId.value = q.id || '';
        };

        const draftSummaryQuestionNo = (q, index) =>
            String(q?.questionNumber || q?.question || q?.order || index + 1);

        const draftHasImageToken = question => {
            const options = Array.isArray(question?.options) ? question.options : [];
            const text = [
                question?.stem,
                ...options,
                question?.answer,
                question?.solution
            ].map(value => String(value || '')).join('\n');
            return /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/.test(text);
        };

        const buildBatchRecognitionSummary = (drafts, dependencies = {}) => {
            const items = drafts || [];
            const { countValidOptions } = dependencies;
            const missingAnswers = [];
            const missingSolutions = [];
            const missingOptions = [];
            let withOptions = 0;
            let withAnswers = 0;
            let withSolutions = 0;
            let withImageTokens = 0;

            items.forEach((question, index) => {
                const questionNumber = draftSummaryQuestionNo(question, index);
                const optionCount = countValidOptions(question?.options);
                if (optionCount > 0) withOptions += 1;
                if (cleanRecognizedText(question?.answer)) {
                    withAnswers += 1;
                } else {
                    missingAnswers.push(questionNumber);
                }
                if (cleanRecognizedText(question?.solution)) {
                    withSolutions += 1;
                } else {
                    missingSolutions.push(questionNumber);
                }
                if (draftHasImageToken(question)) withImageTokens += 1;
                if (
                    (question?.type === '单选题' || question?.type === '多选题') &&
                    optionCount < 4
                ) {
                    missingOptions.push(questionNumber);
                }
            });

            return {
                total: items.length,
                withOptions,
                withAnswers,
                withSolutions,
                withImageTokens,
                missingAnswers,
                missingSolutions,
                missingOptions
            };
        };

        const buildDraftQuestionProblems = (question, dependencies = {}) => {
            if (!question) return [];

            const {
                hasUnconvertedImagePlaceholder,
                choiceOptionIssue,
                solutionQualityIssue
            } = dependencies;
            const problems = [];

            if ((question.warnings || []).length) {
                problems.push(...question.warnings);
            }
            if (!cleanRecognizedText(question.stem)) {
                problems.push('题干为空，请先补充题干。');
            }
            if ([
                question.stem,
                ...(Array.isArray(question.options) ? question.options : []),
                question.answer,
                question.solution
            ].some(hasUnconvertedImagePlaceholder)) {
                problems.push('存在未转换的 DOCX 公式图片占位，不能作为最终识别结果。');
            }

            const optionIssue = choiceOptionIssue(
                question.type,
                question.options,
                question.answer
            );
            if (optionIssue) problems.push(optionIssue);

            if (
                ['单选题', '多选题', '填空题'].includes(question.type) &&
                !cleanRecognizedText(question.answer)
            ) {
                problems.push('答案为空，请先补充答案。');
            }

            const solutionIssue = solutionQualityIssue(
                question.stem,
                question.options,
                question.solution
            );
            if (solutionIssue) problems.push(solutionIssue);

            if (
                question.duplicateStatus &&
                question.duplicateStatus !== 'none'
            ) {
                problems.push('重复或答案冲突需要确认。');
            }
            if (
                question.imageReviewStatus === 'need_confirm' ||
                question.imageReviewStatus === 'low_confidence'
            ) {
                problems.push('该题图片尚未确认，请先确认图片是否正确。');
            }

            return [...new Set(problems)];
        };

        const filterDraftQuestions = (drafts, filter, getProblems) => {
            const items = drafts || [];
            if (filter === 'pending') {
                return items.filter(question => question.status === 'pending');
            }
            if (filter === 'reviewed') {
                return items.filter(question => question.status === 'reviewed');
            }
            if (filter === 'problems') {
                return items.filter(question => getProblems(question).length > 0);
            }
            if (filter === 'images') {
                return items.filter(question => question.hasImage);
            }
            if (filter === 'submitted') {
                return items.filter(question => question.status === 'submitted');
            }
            return items;
        };

        const draftRawOptionSourceCandidates = (q, deps = {}) => {
            const cleanText = deps.cleanRecognizedText || cleanRecognizedText;
            const normalizeQuestionKey = deps.normalizeQuestionKey || (() => '');
            const splitQuestionBlocksByNumber = deps.splitQuestionBlocksByNumber || (() => []);
            const candidates = [
                q?.rawText,
                q?.rawBlock,
                q?.sourceTrace?.rawBlock,
                q?.stem
            ].map(cleanText).filter(Boolean);
            const pageSources = [q?.sourceText, q?.pageText, q?.sourceTrace?.pageText]
                .map(cleanText)
                .filter(Boolean);
            const qKey = normalizeQuestionKey(q?.questionNumber || q?.question || q?.order);
            pageSources.forEach(source => {
                const block = splitQuestionBlocksByNumber(source).find(item =>
                    normalizeQuestionKey(item.question) === qKey
                );
                if (block?.block) candidates.push(block.block);
            });
            candidates.push(...pageSources);
            return [...new Set(candidates)];
        };

        const repairDraftChoiceOptionsFromCachedFileText = (q, deps = {}) => {
            const choiceQuestionMissingOptions = deps.choiceQuestionMissingOptions || (() => false);
            if (!q || !choiceQuestionMissingOptions(q)) return false;

            const draftFileTextCache = deps.draftFileTextCache;
            const normalizeQuestionKey = deps.normalizeQuestionKey || (() => '');
            const splitQuestionBlocksByNumber = deps.splitQuestionBlocksByNumber || (() => []);
            const forceExtractOptionsFromText = deps.forceExtractOptionsFromText || (() => null);
            const sanitizeChoiceOptions = deps.sanitizeChoiceOptions || (options => Array.isArray(options) ? options : []);

            const sourceFileId = q.sourceFileId || q.sourceQuestionFileId || q.sourceTrace?.sourceFileId || '';
            const source = draftFileTextCache?.get(sourceFileId) || '';
            if (!source) return false;

            const qKey = normalizeQuestionKey(q.questionNumber || q.question || q.order);
            const blocks = splitQuestionBlocksByNumber(source);
            const block = blocks.find(item => normalizeQuestionKey(item.question) === qKey);
            const candidates = [block?.block, source].filter(Boolean);
            const extracted = candidates
                .map(forceExtractOptionsFromText)
                .filter(Boolean)
                .sort((a, b) => b.options.filter(Boolean).length - a.options.filter(Boolean).length)[0];
            if (!extracted ||
                extracted.options.filter(Boolean).length <= sanitizeChoiceOptions(q.options).filter(Boolean).length) {
                return false;
            }

            if (extracted.stem) q.stem = extracted.stem;
            q.options = extracted.options;
            q.rawText = block?.block || q.rawText || '';
            q.rawBlock = block?.block || q.rawBlock || q.rawText || '';
            q.pageText = source;
            q.sourceText = source;
            q.sourceTrace = {
                ...(q.sourceTrace || {}),
                rawBlock: q.rawBlock,
                pageText: source
            };
            q.warnings = [
                ...(q.warnings || []).filter(w =>
                    !String(w).includes('选择题仅识别到') &&
                    !String(w).includes('选择题选项未识别完整')
                ),
                '已从原始 DOCX 全文按题号补回选择题选项，请核对。'
            ];
            return true;
        };

        const finalDraftNeedsOptionVisionRepair = (draft) => {
            if (!draft) return false;

            const optionCount = cleanDisplayOptionsForBatchSave(draft.options).filter(Boolean).length;
            const hasQuestionImage = Boolean(
                draft.sourcePageImage ||
                draft.sourceTrace?.sourcePageImage
            );

            return hasQuestionImage && optionCount < 2;
        };

        const normalizeInlineImageList = (images = []) => {
            const rows = Array.isArray(images) ? images : [];
            const seen = new Set();

            return rows
                .filter(img => img && img.id && img.url && img.displayable !== false)
                .filter(img => {
                    const key = String(img.id);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                })
                .map(img => ({
                    id: img.id,
                    filename: img.filename || img.name || `${img.id}.png`,
                    name: img.name || img.filename || `${img.id}.png`,
                    url: img.url,
                    align: img.align || 'center',
                    source: img.source || '',
                    displayable: img.displayable !== false,
                    ext: img.ext || '',
                    mime: img.mime || '',
                    rid: img.rid || '',
                    target: img.target || '',
                    anchorType: img.anchorType || '',
                    dimensions: img.dimensions || null,
                    layout: img.layout || null,
                    paragraphIndex: Number.isInteger(img.paragraphIndex) ? img.paragraphIndex : null,
                    contentHash: img.contentHash || ''
                }));
        };

        const convertDocxImporterDraftToRecognitionItem = (draft) => {
            const images = normalizeInlineImageList(draft?.images || []);
            const recognizedSolutionImages = normalizeInlineImageList(
                draft?.recognizedSolutionImages || []
            );
            return {
                question: draft?.questionNumber,
                questionNumber: draft?.questionNumber,
                order: draft?.order,
                type: draft?.type,
                stem: draft?.stem,
                options: draft?.options,
                answer: draft?.answer,
                solution: draft?.solution,
                layout: draft?.layout || null,
                images,
                recognizedSolutionImages,
                rawText: draft?.sourceTrace?.blockTextHead || '',
                rawBlock: draft?.sourceTrace?.blockTextHead || '',
                pageText: draft?.sourceTrace?.blockTextHead || '',
                sourceText: draft?.sourceTrace?.blockTextHead || '',
                sourceFileId: draft?.sourceFileId,
                sourceFileName: draft?.sourceFileName,
                sourcePage: draft?.sourcePage || 1,
                richBlocks: Array.isArray(draft?.richBlocks) ? draft.richBlocks : [],
                solutionRichBlocks: Array.isArray(draft?.solutionRichBlocks)
                    ? draft.solutionRichBlocks
                    : [],
                sourceTrace: {
                    ...(draft?.sourceTrace || {}),
                    imageIds: images.map(img => img.id),
                    solutionImageIds: recognizedSolutionImages.map(img => img.id)
                },
                warnings: draft?.warnings
            };
        };

        const mergeDocxVisualDraftsByQuestionNumberForV2 = (xmlDrafts = [], visualDrafts = [], deps = {}) => {
            if (!xmlDrafts.length || !visualDrafts.length) return xmlDrafts;

            const normalizeDocxMergeQuestionKeyForV2 =
                deps.normalizeDocxMergeQuestionKeyForV2 || (value => {
                    const text = String(value || '')
                        .replace(/[０-９Ａ-Ｚａ-ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
                    const num = text.match(/\d{1,3}/)?.[0] || '';
                    return num ? String(Number(num)) : '';
                });
            const mergeDocxVisualDraftIntoXmlDraftForV2 =
                deps.mergeDocxVisualDraftIntoXmlDraftForV2 || ((xmlDraft) => xmlDraft);

            const visualMap = new Map();

            for (const visualDraft of visualDrafts) {
                const qKey = normalizeDocxMergeQuestionKeyForV2(
                    visualDraft.questionNumber || visualDraft.question || visualDraft.order || ''
                );

                if (qKey && !visualMap.has(qKey)) {
                    visualMap.set(qKey, visualDraft);
                }
            }

            return xmlDrafts.map(xmlDraft => {
                const qKey = normalizeDocxMergeQuestionKeyForV2(
                    xmlDraft.questionNumber || xmlDraft.question || xmlDraft.order || ''
                );

                const visualDraft = qKey ? visualMap.get(qKey) : null;
                if (!visualDraft) return xmlDraft;

                return mergeDocxVisualDraftIntoXmlDraftForV2(xmlDraft, visualDraft);
            });
        };

        const buildDraftImagePlacementCode = (image, position = 'center') => {
            const imageId = String(image?.id || '').trim();

            if (!imageId) {
                throw new Error('图片缺少 ID，无法生成位置代码。');
            }

            const token = `[[IMAGE:${imageId}]]`;

            if (position === 'left') {
                return (
                    '\\begin{wrapfigure}{l}' +
                    '{0.34\\linewidth}' +
                    '\\centering ' +
                    token +
                    '\\end{wrapfigure}'
                );
            }

            if (position === 'right') {
                return (
                    '\\begin{wrapfigure}{r}' +
                    '{0.34\\linewidth}' +
                    '\\centering ' +
                    token +
                    '\\end{wrapfigure}'
                );
            }

            return (
                '\\begin{center}' +
                token +
                '\\end{center}'
            );
        };

        const isSourcePageImageForStemTokenV2 = (img) => {
            const source = String(img?.source || '');
            const desc = String(img?.description || img?.filename || img?.name || '');

            return (
                source === 'source-page' ||
                source === 'page-source' ||
                /来源原图|整页|PDF\s*页面|PDF页面|整页来源图/.test(desc)
            );
        };

        const draftImageContentRole = img => {
            const explicit = String(img?.contentRole || img?.role || img?.anchorField || '').toLowerCase();
            const source = String(img?.source || '').toLowerCase();
            const description = String(img?.description || '').toLowerCase();

            if (
                ['solution', 'analysis'].includes(explicit) ||
                source === 'pdf-analysis-figure-crop' ||
                /解析图|答案图/.test(description)
            ) {
                return 'solution';
            }
            return 'question';
        };

        const shouldInlineDraftImageInStemForV2 = (img) => {
            if (!img || !img.id || !img.url) return false;
            if (img.status === 'deleted') return false;
            if (isSourcePageImageForStemTokenV2(img)) return false;
            if (draftImageContentRole(img) !== 'question') return false;

            const source = String(img.source || '');
            const desc = String(img.description || '');

            return (
                source === 'auto-figure-crop' ||
                source === 'pdf-embedded-image-placement' ||
                source === 'pdf-layout-figure-crop' ||
                source === 'manual-crop' ||
                source === 'uploaded-question-image' ||
                /自动裁剪题图|PDF 坐标裁剪题图|人工裁剪题图|题中图形|题图/.test(desc)
            );
        };

        const shouldInlineDraftImageInSolutionForV2 = img => (
            Boolean(img?.id && img?.url) &&
            img.status !== 'deleted' &&
            !isSourcePageImageForStemTokenV2(img) &&
            draftImageContentRole(img) === 'solution'
        );

        const imageTokenForDraftImageV2 = (img) => {
            const id = String(img?.id || '').trim();
            return id ? `[[IMAGE:${id}]]` : '';
        };

        const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const replaceDraftImagePlacement = (content = '', image = {}, position = 'center') => {
            const id = String(image?.id || '').trim();
            if (!id) throw new Error('图片缺少 ID，无法修改位置。');

            const token = `[[IMAGE:${id}]]`;
            const escapedToken = escapeRegExp(token);
            const placementPattern = new RegExp(
                `(?:\\\\begin\\{center\\}\\s*${escapedToken}\\s*\\\\end\\{center\\}` +
                `|\\\\begin\\{wrapfigure\\}\\{[lr]\\}\\{[^}]+\\}\\s*` +
                `(?:\\\\centering\\s*)?${escapedToken}\\s*\\\\end\\{wrapfigure\\}` +
                `|${escapedToken})`,
                'g'
            );
            const replacement = buildDraftImagePlacementCode(image, position);
            const source = String(content || '');
            let replaced = false;
            const output = source.replace(placementPattern, () => {
                if (replaced) return '';
                replaced = true;
                return replacement;
            });
            return replaced
                ? output.replace(/\n{3,}/g, '\n\n').trim()
                : `${source}\n${replacement}`.trim();
        };

        const insertDraftImageAtDefaultAnchor = (content = '', image = {}, field = 'stem') => {
            const source = String(content || '').trim();
            const token = imageTokenForDraftImageV2(image);
            if (!token || source.includes(token)) return source;
            const placement = buildDraftImagePlacementCode(image, image.align || 'center');

            if (field !== 'solution') return `${source}\n${placement}`.trim();

            const lines = source.split('\n');
            const cueIndex = lines.findIndex(line => /如图|见图|下图|如下图|作出.*(?:图|截面)/.test(line));
            if (cueIndex >= 0) {
                lines.splice(cueIndex + 1, 0, placement);
                return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            }
            return `${source}\n${placement}`.trim();
        };

        const attachDraftImageTokensIntoContentForV2 = (drafts = [], draftImages = []) => {
            if (!Array.isArray(drafts) || !drafts.length) return drafts;

            const imagesByQuestionId = new Map();

            for (const img of draftImages || []) {
                if (
                    !shouldInlineDraftImageInStemForV2(img) &&
                    !shouldInlineDraftImageInSolutionForV2(img)
                ) continue;

                const qid = String(img.questionId || '').trim();
                if (!qid) continue;

                if (!imagesByQuestionId.has(qid)) {
                    imagesByQuestionId.set(qid, []);
                }

                imagesByQuestionId.get(qid).push(img);
            }

            return drafts.map(draft => {
                const qid = String(draft.id || '').trim();
                const imgs = imagesByQuestionId.get(qid) || [];
                if (!imgs.length) return draft;

                const stemImages = imgs.filter(shouldInlineDraftImageInStemForV2);
                const solutionImages = imgs.filter(shouldInlineDraftImageInSolutionForV2);
                let stem = String(draft.stem || '');
                let solution = String(draft.solution || '');
                stemImages.forEach(image => {
                    stem = insertDraftImageAtDefaultAnchor(stem, image, 'stem');
                });
                solutionImages.forEach(image => {
                    solution = insertDraftImageAtDefaultAnchor(solution, image, 'solution');
                });
                const sourceVerified = imgs.every(image =>
                    ['pdf-embedded-image-placement', 'pdf-analysis-figure-crop', 'docx-inline-figure']
                        .includes(String(image.source || ''))
                );

                return {
                    ...draft,
                    stem,
                    solution,
                    hasImage: true,
                    imageReviewStatus:
                        sourceVerified
                            ? 'confirmed'
                            : (draft.imageReviewStatus && draft.imageReviewStatus !== 'none'
                            ? draft.imageReviewStatus
                            : 'need_confirm'),
                    updatedAt: Date.now()
                };
            });
        };

        const attachDraftImageTokensIntoStemsForV2 = (drafts = [], draftImages = []) =>
            attachDraftImageTokensIntoContentForV2(drafts, draftImages);

        const buildOneClickSubmitPlan = (drafts = []) => {
            const rows = Array.isArray(drafts) ? drafts : [];
            const eligible = rows.filter(draft =>
                draft?.id &&
                draft.status !== 'submitted' &&
                draft.selected !== false &&
                !['existing', 'similar', 'answerConflict'].includes(String(draft.duplicateStatus || ''))
            );
            return {
                ids: eligible.map(draft => draft.id),
                count: eligible.length,
                blockedDuplicate: rows.filter(draft =>
                    draft?.status !== 'submitted' &&
                    ['existing', 'similar', 'answerConflict'].includes(String(draft?.duplicateStatus || ''))
                ).length,
                skippedUnselected: rows.filter(draft =>
                    draft?.status !== 'submitted' && draft?.selected === false
                ).length
            };
        };

        const createSingleFlightAsync = (executor) => {
            if (typeof executor !== 'function') {
                throw new TypeError('createSingleFlightAsync requires a function');
            }

            let inFlight = null;
            return async (...args) => {
                if (inFlight) return inFlight;

                const task = Promise.resolve().then(() => executor(...args));
                inFlight = task;
                try {
                    return await task;
                } finally {
                    if (inFlight === task) inFlight = null;
                }
            };
        };

        return {
            summarizeDraftStatus,
            normalizeDraftPreviewOptions,
            normalizeDraftEditorNewlines,
            buildDraftEditorProjection,
            syncActiveDraftEditorFromQuestion,
            draftSummaryQuestionNo,
            draftHasImageToken,
            buildBatchRecognitionSummary,
            buildDraftQuestionProblems,
            filterDraftQuestions,
            draftRawOptionSourceCandidates,
            repairDraftChoiceOptionsFromCachedFileText,
            finalDraftNeedsOptionVisionRepair,
            convertDocxImporterDraftToRecognitionItem,
            mergeDocxVisualDraftsByQuestionNumberForV2,
            buildDraftImagePlacementCode,
            buildOneClickSubmitPlan,
            createSingleFlightAsync,
            draftImageContentRole,
            replaceDraftImagePlacement,
            shouldInlineDraftImageInStemForV2,
            attachDraftImageTokensIntoContentForV2,
            attachDraftImageTokensIntoStemsForV2
        };
    }
);
