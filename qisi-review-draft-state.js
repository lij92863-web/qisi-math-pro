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
                    target: img.target || ''
                }));
        };

        const convertDocxImporterDraftToRecognitionItem = (draft) => {
            const images = normalizeInlineImageList(draft?.images || []);
            return {
                question: draft?.questionNumber,
                questionNumber: draft?.questionNumber,
                order: draft?.order,
                type: draft?.type,
                stem: draft?.stem,
                options: draft?.options,
                answer: draft?.answer,
                solution: draft?.solution,
                images,
                rawText: draft?.sourceTrace?.blockTextHead || '',
                rawBlock: draft?.sourceTrace?.blockTextHead || '',
                pageText: draft?.sourceTrace?.blockTextHead || '',
                sourceText: draft?.sourceTrace?.blockTextHead || '',
                sourceFileId: draft?.sourceFileId,
                sourceFileName: draft?.sourceFileName,
                sourcePage: draft?.sourcePage || 1,
                sourceTrace: {
                    ...(draft?.sourceTrace || {}),
                    imageIds: images.map(img => img.id)
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

        const shouldInlineDraftImageInStemForV2 = (img) => {
            if (!img || !img.id || !img.url) return false;
            if (img.status === 'deleted') return false;
            if (isSourcePageImageForStemTokenV2(img)) return false;

            const source = String(img.source || '');
            const desc = String(img.description || '');

            return (
                source === 'auto-figure-crop' ||
                source === 'pdf-layout-figure-crop' ||
                source === 'manual-crop' ||
                source === 'uploaded-question-image' ||
                /自动裁剪题图|PDF 坐标裁剪题图|人工裁剪题图|题中图形|题图/.test(desc)
            );
        };

        const imageTokenForDraftImageV2 = (img) => {
            const id = String(img?.id || '').trim();
            return id ? `[[IMAGE:${id}]]` : '';
        };

        const INLINE_IMAGE_TOKEN_RE_FOR_V2 = /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/g;

        const appendImageTokensToStemForV2 = (stem = '', images = []) => {
            let output = String(stem || '').trim();

            const existing = new Set(
                (output.match(INLINE_IMAGE_TOKEN_RE_FOR_V2) || [])
                    .map(token => token.trim())
            );

            const tokens = (images || [])
                .filter(shouldInlineDraftImageInStemForV2)
                .map(imageTokenForDraftImageV2)
                .filter(Boolean);

            for (const token of tokens) {
                if (!existing.has(token)) {
                    output = `${output}\n${token}`.trim();
                    existing.add(token);
                }
            }

            return output;
        };

        const attachDraftImageTokensIntoStemsForV2 = (drafts = [], draftImages = []) => {
            if (!Array.isArray(drafts) || !drafts.length) return drafts;

            const imagesByQuestionId = new Map();

            for (const img of draftImages || []) {
                if (!shouldInlineDraftImageInStemForV2(img)) continue;

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

                return {
                    ...draft,
                    stem: appendImageTokensToStemForV2(draft.stem || '', imgs),
                    hasImage: true,
                    imageReviewStatus:
                        draft.imageReviewStatus && draft.imageReviewStatus !== 'none'
                            ? draft.imageReviewStatus
                            : 'need_confirm',
                    updatedAt: Date.now()
                };
            });
        };

        return {
            summarizeDraftStatus,
            normalizeDraftPreviewOptions,
            normalizeDraftEditorNewlines,
            syncActiveDraftEditorFromQuestion,
            draftSummaryQuestionNo,
            draftRawOptionSourceCandidates,
            repairDraftChoiceOptionsFromCachedFileText,
            finalDraftNeedsOptionVisionRepair,
            convertDocxImporterDraftToRecognitionItem,
            mergeDocxVisualDraftsByQuestionNumberForV2,
            buildDraftImagePlacementCode,
            shouldInlineDraftImageInStemForV2,
            attachDraftImageTokensIntoStemsForV2
        };
    }
);
