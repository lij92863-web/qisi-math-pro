(function () {
    'use strict';

    const MEDIA_TOKEN_RE = /(\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\})/g;

    const asText = (value = '') => String(value || '').replace(/\r\n?/g, '\n').trim();

    const uniq = (items = []) => [...new Set((items || []).filter(Boolean))];

    const getRoles = (file, helpers) => {
        if (helpers.getBatchFileRoles) return helpers.getBatchFileRoles(file);
        const roles = Array.isArray(file?.roles) ? file.roles.filter(Boolean) : [];
        return roles.length ? uniq(roles) : (file?.role ? [file.role] : []);
    };

    const isQuestionFile = (file, helpers) => helpers.batchHasQuestionRole
        ? helpers.batchHasQuestionRole(file)
        : getRoles(file, helpers).some(role => role === 'question' || role === 'full');

    const isAnswerFile = (file, helpers) => helpers.batchHasAnswerRole
        ? helpers.batchHasAnswerRole(file)
        : getRoles(file, helpers).some(role => role === 'answer' || role === 'full');

    const isSolutionFile = (file, helpers) => helpers.batchHasSolutionRole
        ? helpers.batchHasSolutionRole(file)
        : getRoles(file, helpers).some(role => role === 'solution' || role === 'full');

    const makeId = (helpers, prefix) => helpers.makeBatchId
        ? helpers.makeBatchId(prefix)
        : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const cleanText = (helpers, text = '') => helpers.cleanDisplayTextForBatchSave
        ? helpers.cleanDisplayTextForBatchSave(text)
        : asText(text);

    const cleanOptions = (helpers, options = []) => {
        if (helpers.cleanDisplayOptionsForBatchSave) {
            return helpers.cleanDisplayOptionsForBatchSave(options);
        }
        const arr = Array.isArray(options) ? options : [];
        return [0, 1, 2, 3].map(idx => asText(arr[idx] || ''));
    };

    const normalizeQuestionKey = (helpers, value = '') => {
        if (helpers.normalizeQuestionKey) return helpers.normalizeQuestionKey(value);
        const text = String(value || '').replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
        const num = text.match(/\d{1,3}/)?.[0] || '';
        return num ? String(Number(num)) : '';
    };

    const normalizeType = (helpers, rawType, stem, options, answer, fallback) => {
        if (helpers.normalizeQuestionType) {
            return helpers.normalizeQuestionType(rawType, stem, options, answer, fallback);
        }
        return options.filter(Boolean).length >= 2 ? '单选题' : (fallback || '解答题');
    };

    const optionHasContent = (value = '') => {
        const text = asText(value);
        if (!text) return false;
        if (MEDIA_TOKEN_RE.test(text)) {
            MEDIA_TOKEN_RE.lastIndex = 0;
            return true;
        }
        MEDIA_TOKEN_RE.lastIndex = 0;
        const compact = text
            .replace(/^[\s　]*[（(]?\s*[A-DＡ-Ｄ]\s*[\.\．、:：\)）]?\s*/i, '')
            .replace(/[.\s、，。:：；;()（）]/g, '')
            .trim();
        return Boolean(compact) && !/^[A-D]$/i.test(compact);
    };

    const splitQuestionBlocksV2 = (text = '') => {
        const source = asText(text);
        if (!source) return [];

        const markerRe = /(?:^|\n)\s*(?:第\s*([0-9０-９]{1,3})\s*题|[（(]\s*([0-9０-９]{1,3})\s*[)）]|([0-9０-９]{1,3})\s*[.．、:：)）])\s*/g;
        const marks = [];
        let match;

        while ((match = markerRe.exec(source)) !== null) {
            const rawNo = match[1] || match[2] || match[3] || '';
            const no = rawNo.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
            marks.push({
                questionNumber: no,
                start: match.index,
                contentStart: markerRe.lastIndex
            });
        }

        if (!marks.length) {
            return [{ questionNumber: '1', rawBlock: source, index: 0 }];
        }

        return marks.map((mark, idx) => {
            const next = marks[idx + 1];
            const rawBlock = source.slice(mark.start, next ? next.start : source.length).trim();
            const body = source.slice(mark.contentStart, next ? next.start : source.length).trim();
            return {
                questionNumber: mark.questionNumber || String(idx + 1),
                rawBlock,
                body,
                index: idx
            };
        }).filter(item => item.rawBlock || item.body);
    };

    const stripAnswerSolution = (text = '') => {
        const source = asText(text);
        const answerMatch = source.match(/(?:答案|参考答案|答)[:：]\s*/);
        const solutionMatch = source.match(/(?:解析|详解|解答|说明)[:：]\s*/);
        let stem = source;
        let answer = '';
        let solution = '';

        const firstCut = [answerMatch?.index, solutionMatch?.index]
            .filter(idx => typeof idx === 'number' && idx >= 0)
            .sort((a, b) => a - b)[0];

        if (typeof firstCut === 'number') stem = source.slice(0, firstCut).trim();
        if (answerMatch) {
            const start = answerMatch.index + answerMatch[0].length;
            const end = solutionMatch && solutionMatch.index > answerMatch.index ? solutionMatch.index : source.length;
            answer = source.slice(start, end).trim();
        }
        if (solutionMatch) {
            const start = solutionMatch.index + solutionMatch[0].length;
            solution = source.slice(start).trim();
        }

        return { stem, answer, solution };
    };

    const parseOptionsV2 = (blockText = '') => {
        const source = asText(blockText);
        const options = ['', '', '', ''];
        const labelRe = /(^|[\n\r]|[\s　]+)([A-DＡ-Ｄ])\s*[\.\．、:：\)）]\s*/g;
        const hits = [];
        let match;

        while ((match = labelRe.exec(source)) !== null) {
            const label = String(match[2] || '').replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248)).toUpperCase();
            hits.push({
                label,
                start: match.index + (match[1] || '').length,
                contentStart: labelRe.lastIndex
            });
        }

        if (hits.length < 2) {
            return { stemText: source, options, optionCount: 0 };
        }

        for (let i = 0; i < hits.length; i += 1) {
            const hit = hits[i];
            const idx = hit.label.charCodeAt(0) - 65;
            if (idx < 0 || idx > 3) continue;
            const next = hits[i + 1];
            options[idx] = source.slice(hit.contentStart, next ? next.start : source.length).trim();
        }

        const first = hits[0];
        const stemText = source.slice(0, first.start).trim();
        return {
            stemText,
            options,
            optionCount: options.filter(optionHasContent).length
        };
    };

    const buildQuestionBlocksFromEvidenceV2 = (evidence, helpers = {}) => {
        const picked = chooseEvidenceSourceTextV2(evidence);
        const source = asText(picked.source || '');

        evidence.selectedSourceKind = picked.sourceKind;

        if (!source) return [];

        evidence.warnings = [
            ...new Set([
                ...(evidence.warnings || []),
                `V2 文本源选择：${picked.sourceKind}；${picked.reason}`
            ])
        ];

        console.groupCollapsed('[BATCH_V2][source-choice]');
        console.log({
            evidenceId: evidence.id,
            sourceFileName: evidence.sourceFileName,
            pageNo: evidence.pageNo,
            picked: picked.sourceKind,
            reason: picked.reason,
            textSummary: picked.textSummary,
            ocrSummary: picked.ocrSummary
        });
        console.groupEnd();

        return splitQuestionBlocksV2(source).map((block, idx) => {
            const split = stripAnswerSolution(block.body || block.rawBlock);
            const parsed = parseOptionsV2(split.stem);
            const options = cleanOptions(helpers, parsed.options);
            const stem = cleanText(helpers, parsed.stemText || split.stem);

            return {
                id: makeId(helpers, 'qb'),
                questionNumber: block.questionNumber || String(idx + 1),
                order: idx + 1,
                stem,
                options,
                answer: cleanText(helpers, split.answer),
                solution: cleanText(helpers, split.solution),
                rawBlock: block.rawBlock,
                pageText: source,
                evidenceId: evidence.id,
                evidence,
                sourceKind: picked.sourceKind,
                sourcePickReason: picked.reason
            };
        }).filter(block => block.stem || block.options.some(optionHasContent) || block.rawBlock);
    };

    const extractSupportItemsV2 = (evidences = [], kind = 'answer', helpers = {}) => {
        const label = kind === 'solution' ? 'solution' : 'answer';
        const rows = [];

        for (const evidence of evidences) {
            const picked = chooseEvidenceSourceTextV2(evidence);
            evidence.selectedSourceKind = picked.sourceKind;
            const source = asText(picked.source || '');
            for (const block of splitQuestionBlocksV2(source)) {
                const split = stripAnswerSolution(block.body || block.rawBlock);
                const fallback = kind === 'solution' ? split.solution || split.stem : split.answer || split.stem;
                rows.push({
                    question: block.questionNumber,
                    [label]: cleanText(helpers, fallback),
                    sourceFileId: evidence.sourceFileId,
                    sourceFileName: evidence.sourceFileName,
                    sourcePage: evidence.pageNo,
                    rawBlock: block.rawBlock
                });
            }
        }

        return rows.filter(item => asText(item[label]));
    };

    const splitPdfTextByPage = (text = '', pageCount = 1) => {
        const source = asText(text);
        if (!source) return [];
        const formPages = source.split(/\f+/).map(asText).filter(Boolean);
        if (formPages.length > 1) return formPages;
        return pageCount <= 1 ? [source] : [source, ...Array(Math.max(0, pageCount - 1)).fill('')];
    };

    const createEvidence = (file, helpers, patch = {}) => ({
        id: patch.id || makeId(helpers, 'pe'),
        batchId: file.batchId || '',
        sourceFileId: file.id || '',
        sourceFileName: file.filename || '',
        fileType: file.fileType || 'text',
        roles: getRoles(file, helpers),
        pageNo: patch.pageNo || 1,
        pageImage: patch.pageImage || '',
        textLayer: patch.textLayer || '',
        ocrMarkdown: patch.ocrMarkdown || '',
        layout: patch.layout || null,
        width: patch.width || 0,
        height: patch.height || 0,
        warnings: patch.warnings || [],
        errors: patch.errors || []
    });

    const hasUsefulQuestionTextLayer = (text = '') => {
        const source = asText(text)
            .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
            .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

        if (source.length < 80) return false;

        const questionMarks = source.match(
            /(?:^|\n|\s)(?:第\s*)?\d{1,3}\s*(?:题)?[.．、:：)）]/g
        ) || [];

        const hasA = /(?:^|\n|\s)A\s*[.．、:：)）]/.test(source);
        const hasB = /(?:^|\n|\s)B\s*[.．、:：)）]/.test(source);

        return questionMarks.length >= 2 && hasA && hasB;
    };

    const countBadGlyphsV2 = (text = '') => {
        const source = String(text || '');

        const matches = source.match(
            /[\uFFFD�□▯■▪▫◼◻]|[\uE000-\uF8FF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g
        );

        return matches ? matches.length : 0;
    };

    const countLatexSignalsV2 = (text = '') => {
        const source = String(text || '');

        const matches = source.match(
            /\\frac|\\sqrt|\\sin|\\cos|\\tan|\\angle|\\triangle|\\vec|\\overrightarrow|\\overline|\\subset|\\subseteq|\\in|\\cap|\\cup|\\pi|\\theta|\$[^$\n]+\$/g
        );

        return matches ? matches.length : 0;
    };

    const countChoiceSignalsV2 = (text = '') => {
        const source = String(text || '')
            .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

        const matches = source.match(/(?:^|\n|\s)[A-D]\s*[.．、:：)）]/g);
        return matches ? matches.length : 0;
    };

    const summarizeEvidenceTextV2 = (label, text = '') => {
        const source = String(text || '');
        const blocks = splitQuestionBlocksV2(source);

        return {
            label,
            length: source.length,
            badGlyphs: countBadGlyphsV2(source),
            latexSignals: countLatexSignalsV2(source),
            choiceSignals: countChoiceSignalsV2(source),
            blockCount: blocks.length,
            blockNumbers: blocks.map(b => b.questionNumber).slice(0, 20),
            preview: source.slice(0, 500)
        };
    };

    const chooseEvidenceSourceTextV2 = (evidence = {}) => {
        const textLayer = asText(evidence.textLayer || '');
        const ocrMarkdown = asText(evidence.ocrMarkdown || '');
        const forceVisionOcr = evidence?.forceVisionOcr === true;

        const textSummary = summarizeEvidenceTextV2
            ? summarizeEvidenceTextV2('textLayer-source-choice', textLayer)
            : {
                label: 'textLayer-source-choice',
                length: textLayer.length,
                badGlyphs: 0,
                latexSignals: 0,
                choiceSignals: 0,
                blockCount: splitQuestionBlocksV2(textLayer).length,
                blockNumbers: splitQuestionBlocksV2(textLayer).map(b => b.questionNumber)
            };

        const ocrSummary = summarizeEvidenceTextV2
            ? summarizeEvidenceTextV2('ocrMarkdown-source-choice', ocrMarkdown)
            : {
                label: 'ocrMarkdown-source-choice',
                length: ocrMarkdown.length,
                badGlyphs: 0,
                latexSignals: 0,
                choiceSignals: 0,
                blockCount: splitQuestionBlocksV2(ocrMarkdown).length,
                blockNumbers: splitQuestionBlocksV2(ocrMarkdown).map(b => b.questionNumber)
            };

        if (!textLayer && !ocrMarkdown) {
            return {
                source: '',
                sourceKind: 'empty',
                reason: 'no textLayer and no ocrMarkdown',
                forceVisionOcr,
                textSummary,
                ocrSummary
            };
        }

        if (!ocrMarkdown) {
            return {
                source: textLayer,
                sourceKind: 'textLayer',
                reason: 'ocrMarkdown empty',
                textSummary,
                ocrSummary
            };
        }

        if (!textLayer) {
            return {
                source: ocrMarkdown,
                sourceKind: 'ocrMarkdown',
                reason: 'textLayer empty',
                textSummary,
                ocrSummary
            };
        }

        const textBroken =
            textSummary.badGlyphs >= 3 ||
            (textSummary.length >= 100 && textSummary.latexSignals === 0 && textSummary.badGlyphs >= 1);

        const ocrBlockOk =
            ocrSummary.blockCount >= Math.max(1, textSummary.blockCount - 1);

        const ocrChoiceOk =
            ocrSummary.choiceSignals >= Math.max(0, textSummary.choiceSignals - 4);

        const ocrClearlyCleaner =
            ocrSummary.badGlyphs <= Math.max(0, Math.floor(textSummary.badGlyphs * 0.25));

        const ocrFormulaBetter =
            ocrSummary.latexSignals > textSummary.latexSignals;

        if (textBroken && ocrBlockOk && ocrChoiceOk && ocrClearlyCleaner && ocrFormulaBetter) {
            return {
                source: ocrMarkdown,
                sourceKind: 'ocrMarkdown',
                reason:
                    `prefer OCR: textBroken=${textBroken}, ` +
                    `blocks ${textSummary.blockCount}->${ocrSummary.blockCount}, ` +
                    `badGlyphs ${textSummary.badGlyphs}->${ocrSummary.badGlyphs}, ` +
                    `latex ${textSummary.latexSignals}->${ocrSummary.latexSignals}`,
                textSummary,
                ocrSummary
            };
        }

        if (
            ocrBlockOk &&
            ocrChoiceOk &&
            ocrSummary.badGlyphs < textSummary.badGlyphs &&
            ocrSummary.latexSignals >= textSummary.latexSignals + 5
        ) {
            return {
                source: ocrMarkdown,
                sourceKind: 'ocrMarkdown',
                reason:
                    `prefer OCR by score: blocks ${textSummary.blockCount}->${ocrSummary.blockCount}, ` +
                    `badGlyphs ${textSummary.badGlyphs}->${ocrSummary.badGlyphs}, ` +
                    `latex ${textSummary.latexSignals}->${ocrSummary.latexSignals}`,
                textSummary,
                ocrSummary
            };
        }

        return {
            source: textLayer,
            sourceKind: 'textLayer',
            reason:
                `keep textLayer: blocks ${textSummary.blockCount}->${ocrSummary.blockCount}, ` +
                `badGlyphs ${textSummary.badGlyphs}->${ocrSummary.badGlyphs}, ` +
                `latex ${textSummary.latexSignals}->${ocrSummary.latexSignals}`,
            textSummary,
            ocrSummary
        };
    };

    const addLooseVisionOcrLegacy = async (evidence, helpers) => {
        const textSummary = summarizeEvidenceTextV2('textLayer-before-ocr', evidence.textLayer || '');

        const forceVisionOcr =
            helpers?.forceVisionOcr === true ||
            evidence?.forceVisionOcr === true;

        const formulaLooksBroken =
            textSummary.badGlyphs >= 2 ||
            (textSummary.length >= 100 && textSummary.latexSignals === 0 && textSummary.badGlyphs >= 1);

        console.groupCollapsed('[BATCH_V2][evidence-quality-before-ocr]');
        console.log({
            evidenceId: evidence.id,
            sourceFileName: evidence.sourceFileName,
            pageNo: evidence.pageNo,
            textSummary,
            formulaLooksBroken,
            forceVisionOcr,
            hasPageImage: Boolean(evidence.pageImage),
            hasOcrFunction: Boolean(helpers.recognizePageMarkdownWithQwen)
        });
        console.groupEnd();

        if (!forceVisionOcr && !formulaLooksBroken) {
            evidence.warnings.push('PDF 文本层未检测到明显公式乱码，暂不调用视觉 OCR。');
            return evidence;
        }

        if (!evidence.pageImage || !helpers.recognizePageMarkdownWithQwen) {
            evidence.warnings.push('PDF 文本层疑似公式乱码，但缺少页面图片或 OCR 函数，暂只能使用文本层。');
            return evidence;
        }

        try {
            evidence.warnings.push('PDF 文本层疑似公式乱码，已尝试补充视觉 OCR Markdown 供诊断。');
            evidence.ocrMarkdown = await helpers.recognizePageMarkdownWithQwen(evidence.pageImage);

            const ocrSummary = summarizeEvidenceTextV2('ocrMarkdown-after-ocr', evidence.ocrMarkdown || '');

            console.groupCollapsed('[BATCH_V2][evidence-quality-after-ocr]');
            console.log({
                evidenceId: evidence.id,
                sourceFileName: evidence.sourceFileName,
                pageNo: evidence.pageNo,
                forceVisionOcr,
                textSummary,
                ocrSummary,
                shouldPreferOcrLater:
                    ocrSummary.blockCount >= Math.max(1, textSummary.blockCount - 1) &&
                    ocrSummary.badGlyphs <= textSummary.badGlyphs &&
                    ocrSummary.latexSignals >= textSummary.latexSignals
            });
            console.groupEnd();

            evidence.warnings.push(
                `OCR 诊断：textLayer题块=${textSummary.blockCount}，坏字符=${textSummary.badGlyphs}，LaTeX信号=${textSummary.latexSignals}；` +
                `ocrMarkdown题块=${ocrSummary.blockCount}，坏字符=${ocrSummary.badGlyphs}，LaTeX信号=${ocrSummary.latexSignals}。`
            );
        } catch (error) {
            if (helpers.isFatalQwenServiceError?.(error)) throw error;
            evidence.warnings.push(`视觉 OCR Markdown 诊断失败，仍使用文本层：${error?.message || String(error)}`);
        }

        return evidence;
    };

    const addLooseVisionOcr = async (evidence, helpers) => {
        const textSummary = summarizeEvidenceTextV2('textLayer-before-ocr', evidence.textLayer || '');

        const forceVisionOcr =
            helpers?.forceVisionOcr === true ||
            evidence?.forceVisionOcr === true;

        const formulaLooksBroken =
            textSummary.badGlyphs >= 2 ||
            (textSummary.length >= 100 && textSummary.latexSignals === 0 && textSummary.badGlyphs >= 1);

        console.groupCollapsed('[BATCH_V2][evidence-quality-before-ocr]');
        console.log({
            evidenceId: evidence.id,
            sourceFileName: evidence.sourceFileName,
            pageNo: evidence.pageNo,
            textSummary,
            formulaLooksBroken,
            forceVisionOcr,
            hasPageImage: Boolean(evidence.pageImage),
            hasOcrFunction: Boolean(helpers.recognizePageMarkdownWithQwen)
        });
        console.groupEnd();

        if (!forceVisionOcr && !formulaLooksBroken) {
            evidence.warnings.push('PDF 文本层未检测到明显公式乱码，暂不调用视觉 OCR。');
            return evidence;
        }

        if (!evidence.pageImage || !helpers.recognizePageMarkdownWithQwen) {
            evidence.warnings.push(
                forceVisionOcr
                    ? '已要求强制视觉 OCR，但缺少页面图片或 OCR 函数。'
                    : 'PDF 文本层疑似公式乱码，但缺少页面图片或 OCR 函数，暂只能使用文本层。'
            );
            return evidence;
        }

        try {
            evidence.warnings.push(
                forceVisionOcr
                    ? '已按 DOCX 视觉增强要求强制执行 OCR Markdown。'
                    : 'PDF 文本层疑似公式乱码，已尝试补充视觉 OCR Markdown。'
            );

            evidence.ocrMarkdown = await helpers.recognizePageMarkdownWithQwen(evidence.pageImage);

            const ocrSummary = summarizeEvidenceTextV2('ocrMarkdown-after-ocr', evidence.ocrMarkdown || '');

            console.groupCollapsed('[BATCH_V2][evidence-quality-after-ocr]');
            console.log({
                evidenceId: evidence.id,
                sourceFileName: evidence.sourceFileName,
                pageNo: evidence.pageNo,
                forceVisionOcr,
                textSummary,
                ocrSummary,
                shouldPreferOcrLater:
                    forceVisionOcr ||
                    (
                        ocrSummary.blockCount >= Math.max(1, textSummary.blockCount - 1) &&
                        ocrSummary.badGlyphs <= textSummary.badGlyphs &&
                        ocrSummary.latexSignals >= textSummary.latexSignals
                    )
            });
            console.groupEnd();

            evidence.warnings.push(
                `OCR 诊断：textLayer题块=${textSummary.blockCount}，坏字符=${textSummary.badGlyphs}，LaTeX信号=${textSummary.latexSignals}；` +
                `ocrMarkdown题块=${ocrSummary.blockCount}，坏字符=${ocrSummary.badGlyphs}，LaTeX信号=${ocrSummary.latexSignals}。`
            );
        } catch (error) {
            if (helpers.isFatalQwenServiceError?.(error)) throw error;
            evidence.warnings.push(`视觉 OCR Markdown 失败，仍使用文本层：${error?.message || String(error)}`);
        }

        return evidence;
    };

    const buildPdfEvidence = async (file, helpers) => {
        const assertCoordinatorActive = () => {
            if (helpers.pdfSignal?.aborted) {
                const error = new Error('PDF_COORDINATOR_ABORTED');
                error.code = 'PDF_COORDINATOR_ABORTED';
                throw error;
            }
        };
        let pageImages = [];
        let textLayer = '';
        let layoutPages = [];
        const fileWarnings = [];
        const fileErrors = [];

        assertCoordinatorActive();
        try {
            pageImages = await helpers.renderPdfFilePages(file);
            assertCoordinatorActive();
        } catch (error) {
            if (String(error?.code || '').startsWith('PDF_COORDINATOR_')) throw error;
            fileWarnings.push(`PDF 页面图渲染失败，继续尝试文本层兜底：${error?.message || String(error)}`);
        }

        try {
            textLayer = await helpers.extractPdfTextWithPdfJs(file);
            assertCoordinatorActive();
        } catch (error) {
            if (String(error?.code || '').startsWith('PDF_COORDINATOR_')) throw error;
            fileWarnings.push(`PDF 文本层提取失败：${error?.message || String(error)}`);
        }

        try {
            if (helpers.extractPdfLayoutWithPdfJs) {
                layoutPages = await helpers.extractPdfLayoutWithPdfJs(file);
                assertCoordinatorActive();
            }
        } catch (error) {
            if (String(error?.code || '').startsWith('PDF_COORDINATOR_')) throw error;
            fileWarnings.push(`PDF 文本坐标提取失败：${error?.message || String(error)}`);
        }

        const pageTexts = splitPdfTextByPage(textLayer, Math.max(1, pageImages.length || 1));
        const count = Math.max(pageImages.length, pageTexts.length);
        const evidences = [];

        for (let i = 0; i < count; i += 1) {
            assertCoordinatorActive();
            const page = pageImages[i] || {};
            const pageNo = page.pageNo || i + 1;
            const layout = (layoutPages || []).find(row => Number(row.pageNo) === Number(pageNo)) || null;
            const evidence = createEvidence(file, helpers, {
                pageNo,
                pageImage: page.url || page.imageUrl || '',
                textLayer: pageTexts[i] || '',
                layout,
                warnings: [...fileWarnings],
                errors: [...fileErrors]
            });

            if (!evidence.pageImage && !evidence.textLayer) {
                evidence.errors.push('该页既无页面图也无文本层。');
            } else {
                await addLooseVisionOcr(evidence, helpers);
            }

            assertCoordinatorActive();
            if (typeof helpers.onPdfPageProgress === 'function') {
                await helpers.onPdfPageProgress({
                    sourceId: String(file.id || ''),
                    pageNo: i + 1,
                    totalPages: count
                });
            }

            evidences.push(evidence);
        }

        return evidences;
    };

    const buildDocxEvidence = async (file, helpers) => {
        const warnings = [];
        if (helpers.convertDocxRecordToPdfRecord) {
            try {
                const pdfRecord = await helpers.convertDocxRecordToPdfRecord(file);
                const evidences = await buildPdfEvidence({
                    ...pdfRecord,
                    id: file.id,
                    batchId: file.batchId,
                    filename: file.filename,
                    roles: getRoles(file, helpers),
                    role: file.role
                }, helpers);
                evidences.forEach(evidence => {
                    evidence.fileType = 'docx';
                    evidence.warnings.unshift('DOCX 已优先转 PDF 后按页面处理。');
                });
                return evidences;
            } catch (error) {
                if (helpers.isFatalQwenServiceError?.(error)) throw error;
                warnings.push(`DOCX 转 PDF 失败，已改用文本层兜底：${error?.message || String(error)}`);
            }
        }

        let text = '';
        try {
            text = await helpers.extractTextFromDraftFile(file);
        } catch (error) {
            warnings.push(`DOCX 文本层提取失败：${error?.message || String(error)}`);
        }

        return [createEvidence(file, helpers, {
            pageNo: 1,
            textLayer: text || '',
            warnings,
            errors: text ? [] : ['DOCX 转 PDF 和文本层提取均失败。']
        })];
    };

    const buildImageEvidence = async (file, helpers) => {
        const evidence = createEvidence(file, helpers, {
            pageNo: 1,
            pageImage: file.uploadPath || '',
            textLayer: '',
            ocrMarkdown: ''
        });
        await addLooseVisionOcr(evidence, helpers);
        return [evidence];
    };

    const buildTextEvidence = async (file, helpers) => {
        let text = '';
        const warnings = [];
        try {
            text = await helpers.extractTextFromDraftFile(file);
        } catch (error) {
            warnings.push(`文本文件读取失败：${error?.message || String(error)}`);
        }
        return [createEvidence(file, helpers, {
            pageNo: 1,
            textLayer: text,
            warnings,
            errors: text ? [] : ['文本文件内容为空。']
        })];
    };

    const buildPageEvidenceForFile = async (file, helpers) => {
        if (file.fileType === 'pdf') return buildPdfEvidence(file, helpers);
        if (file.fileType === 'docx') return buildDocxEvidence(file, helpers);
        if (file.fileType === 'image') return buildImageEvidence(file, helpers);
        return buildTextEvidence(file, helpers);
    };

    const attachSupportItems = (drafts, supportItems, kind, helpers, unmatched) => {
        const field = kind === 'solution' ? 'solution' : 'answer';
        const byKey = new Map();
        supportItems.forEach((item, idx) => {
            const key = normalizeQuestionKey(helpers, item.question);
            if (key && !byKey.has(key)) byKey.set(key, item);
            item.__order = idx;
        });

        let matchedCount = 0;
        drafts.forEach((draft, idx) => {
            const key = normalizeQuestionKey(helpers, draft.questionNumber);
            const matched = key ? byKey.get(key) : null;
            if (matched) {
                draft[field] = matched[field] || draft[field] || '';
                matched.__used = true;
                matchedCount += 1;
            } else if (!supportItems.some(item => normalizeQuestionKey(helpers, item.question)) && supportItems.length === drafts.length) {
                const ordered = supportItems[idx];
                if (ordered) {
                    draft[field] = ordered[field] || draft[field] || '';
                    ordered.__used = true;
                    matchedCount += 1;
                    draft.warnings.push(`${kind === 'solution' ? '解析' : '答案'}文件无题号，已按顺序匹配，请核对。`);
                }
            } else if (kind === 'answer') {
                draft.warnings.push('答案文件未匹配到本题答案，请手动补充。');
            }
        });

        supportItems
            .filter(item => !item.__used)
            .forEach(item => unmatched.push({
                question: item.question || '',
                answer: item.answer || item.solution || '',
                sourceFile: item.sourceFileName || '',
                kind
            }));

        if (supportItems.length && matchedCount !== supportItems.length) {
            drafts.forEach(draft => draft.warnings.push(`${kind === 'solution' ? '解析' : '答案'}数量或题号未完全匹配，未乱配。`));
        }
    };

    const buildManualDraft = (evidence, batch, helpers, order) => {
        const now = Date.now();
        const meta = batch.defaultMeta || {};
        return {
            id: makeId(helpers, 'dq'),
            batchId: batch.id,
            order,
            questionNumber: String(order),
            type: meta.defaultType || '解答题',
            grade: meta.grade || '高一',
            diff: meta.diff || '中等',
            year: meta.year || '',
            source: meta.source || '',
            province: meta.province || '',
            tags: Array.isArray(meta.tags) ? meta.tags : [],
            systemKnowledge: meta.systemKnowledge || '',
            personalKnowledge: meta.personalKnowledge || '',
            stem: '图片题识别草稿，请查看右侧原图并补全题干。',
            options: ['', '', '', ''],
            answer: '',
            solution: '',
            images: [],
            sourcePageImage: evidence.pageImage || '',
            sourceQuestionFileId: evidence.sourceFileId || '',
            sourceFileId: evidence.sourceFileId || '',
            sourceFileName: evidence.sourceFileName || '',
            sourcePage: evidence.pageNo || 1,
            sourceTrace: {
                source: 'batch-v2',
                sourceFileId: evidence.sourceFileId || '',
                sourceFileName: evidence.sourceFileName || '',
                sourcePage: evidence.pageNo || 1,
                sourcePageImage: evidence.pageImage || '',
                rawBlock: '',
                pageText: evidence.textLayer || evidence.ocrMarkdown || '',
                warnings: evidence.warnings || [],
                errors: evidence.errors || []
            },
            confidence: 0.35,
            warnings: uniq(['视觉识别失败或未切出题目，已生成可人工审核草稿。', ...(evidence.warnings || [])]),
            status: 'pending',
            duplicateStatus: 'unchecked',
            selected: true,
            userEdited: false,
            hasImage: Boolean(evidence.pageImage),
            imageReviewStatus: evidence.pageImage ? 'need_confirm' : 'none',
            createdAt: now,
            updatedAt: now
        };
    };

    const buildDraftsFromBlocks = (blocks, batch, helpers) => {
        const now = Date.now();
        const meta = batch.defaultMeta || {};
        return blocks.map((block, idx) => {
            const evidence = block.evidence || {};
            const options = cleanOptions(helpers, block.options || []);
            const stem = cleanText(helpers, block.stem || block.rawBlock || '');
            const answer = cleanText(helpers, block.answer || '');
            const solution = cleanText(helpers, block.solution || '');
            const type = normalizeType(helpers, meta.defaultType, stem, options, answer, meta.defaultType || '');

            return {
                id: makeId(helpers, 'dq'),
                batchId: batch.id,
                order: idx + 1,
                questionNumber: block.questionNumber || String(idx + 1),
                type,
                grade: meta.grade || '高一',
                diff: meta.diff || '中等',
                year: meta.year || '',
                source: meta.source || '',
                province: meta.province || '',
                tags: Array.isArray(meta.tags) ? meta.tags : [],
                systemKnowledge: meta.systemKnowledge || '',
                personalKnowledge: meta.personalKnowledge || '',
                stem,
                options,
                answer,
                solution,
                images: [],
                sourcePageImage: evidence.pageImage || '',
                sourceQuestionFileId: evidence.sourceFileId || '',
                sourceFileId: evidence.sourceFileId || '',
                sourceFileName: evidence.sourceFileName || '',
                sourcePage: evidence.pageNo || 1,
                sourceTrace: {
                    source: 'batch-v2',
                    sourceFileId: evidence.sourceFileId || '',
                    sourceFileName: evidence.sourceFileName || '',
                    sourcePage: evidence.pageNo || 1,
                    sourcePageImage: evidence.pageImage || '',
                    rawBlock: block.rawBlock || '',
                    pageText: block.pageText || evidence.textLayer || evidence.ocrMarkdown || '',
                    evidenceId: evidence.id || '',
                    sourceKind: block.sourceKind || evidence.selectedSourceKind || '',
                    layout: evidence.layout || null,
                    warnings: evidence.warnings || [],
                    errors: evidence.errors || []
                },
                confidence: evidence.ocrMarkdown ? 0.75 : (evidence.textLayer ? 0.68 : 0.45),
                warnings: uniq([...(evidence.warnings || []), ...(options.filter(Boolean).length && options.filter(optionHasContent).length < 4 ? ['选择题选项可能不完整，请核对。'] : [])]),
                status: 'pending',
                duplicateStatus: 'unchecked',
                selected: true,
                userEdited: false,
                hasImage: Boolean(evidence.pageImage),
                imageReviewStatus: evidence.pageImage ? 'need_confirm' : 'none',
                createdAt: now,
                updatedAt: now
            };
        });
    };

    const normalizeBboxV2 = (bbox = []) => {
        if (!Array.isArray(bbox) || bbox.length !== 4) return [];

        let vals = bbox.map(Number);
        if (vals.some(v => !Number.isFinite(v))) return [];

        let [x1, y1, x2, y2] = vals;

        if (x1 > x2) [x1, x2] = [x2, x1];
        if (y1 > y2) [y1, y2] = [y2, y1];

        const maxCoord = Math.max(x1, y1, x2, y2);
        if (maxCoord <= 1.5) {
            x1 *= 1000;
            x2 *= 1000;
            y1 *= 1000;
            y2 *= 1000;
        }

        x1 = Math.max(0, Math.min(1000, Math.round(x1)));
        y1 = Math.max(0, Math.min(1000, Math.round(y1)));
        x2 = Math.max(0, Math.min(1000, Math.round(x2)));
        y2 = Math.max(0, Math.min(1000, Math.round(y2)));

        if (x2 - x1 < 8 || y2 - y1 < 8) return [];

        return [x1, y1, x2, y2];
    };

    const bboxAreaV2 = (bbox = []) => {
        if (!Array.isArray(bbox) || bbox.length !== 4) return 0;
        return Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
    };

    const unionBboxesV2 = (bboxes = []) => {
        const rows = (bboxes || []).map(normalizeBboxV2).filter(b => b.length === 4);
        if (!rows.length) return [];

        return [
            Math.min(...rows.map(b => b[0])),
            Math.min(...rows.map(b => b[1])),
            Math.max(...rows.map(b => b[2])),
            Math.max(...rows.map(b => b[3]))
        ];
    };

    const hasFigureCueV2 = (draft = {}) => {
        const text = [
            draft.stem,
            ...(Array.isArray(draft.options) ? draft.options : [])
        ].map(asText).join('\n');

        return /图|如图|图中|图甲|图乙|示意图|统计图|函数图|几何图|折扇|圆弧|扇形/.test(text);
    };

    const normalizeLineTextV2 = (text = '') => String(text || '')
        .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
        .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
        .replace(/\s+/g, ' ')
        .trim();

    const isQuestionMarkerLineV2 = (line = {}) => {
        const text = normalizeLineTextV2(line.text || '');
        const m = text.match(/^(\d{1,3})\s*[.．、:：)）]/);
        return m ? String(Number(m[1])) : '';
    };

    const isOptionLineV2 = (line = {}) => {
        const text = normalizeLineTextV2(line.text || '');
        return /^A\s*[.．、:：)）]/.test(text) ||
            /(^|\s)A\s*[.．、:：)）].{0,80}(^|\s)B\s*[.．、:：)）]/.test(text);
    };

    const isLongStemLineV2 = (line = {}) => {
        const text = normalizeLineTextV2(line.text || '');
        if (!text) return false;
        if (isOptionLineV2(line)) return false;
        if (/^[甲乙丙丁]$/.test(text)) return false;
        if (/^[A-D]\s*[.．、:：)）]/.test(text)) return false;
        return text.length >= 8;
    };

    const buildQuestionBandBboxFromPdfLayoutV2 = (draft = {}) => {
        const evidence = draft.sourceTrace?.evidence || draft.evidence || {};
        const layout = evidence.layout || draft.sourceTrace?.layout || null;
        const lines = Array.isArray(layout?.lines) ? layout.lines : [];

        if (!lines.length) return [];

        const qKey = normalizeQuestionKey({}, draft.questionNumber || draft.question || draft.order);
        if (!qKey) return [];

        const questionMarkers = lines
            .map(line => ({ line, q: isQuestionMarkerLineV2(line) }))
            .filter(row => row.q);

        const current = questionMarkers.find(row => row.q === qKey);
        if (!current) return [];

        const currentTop = current.line.ny1;
        const next = questionMarkers
            .filter(row => Number(row.q) > Number(qKey) && row.line.ny1 > currentTop)
            .sort((a, b) => a.line.ny1 - b.line.ny1)[0];

        const nextTop = next ? next.line.ny1 : 1000;

        const qLines = lines
            .filter(line => line.ny1 >= currentTop - 2 && line.ny1 < nextTop - 2)
            .sort((a, b) => a.ny1 - b.ny1);

        if (!qLines.length) return [];

        const optionLine = qLines.find(line => isOptionLineV2(line));
        if (!optionLine) return [];

        const longStemLines = qLines
            .filter(line => line.ny2 < optionLine.ny1)
            .filter(isLongStemLineV2);

        if (!longStemLines.length) return [];

        const lastStemLine = longStemLines[longStemLines.length - 1];

        let y1 = Math.min(1000, lastStemLine.ny2 + 10);
        let y2 = Math.max(0, optionLine.ny1 - 10);

        if (y2 - y1 < 35) return [];

        const contentLines = qLines.filter(line => line.ny1 >= currentTop && line.ny1 < nextTop);
        const minX = Math.min(...contentLines.map(line => line.nx1).filter(Number.isFinite));
        const maxX = Math.max(...contentLines.map(line => line.nx2).filter(Number.isFinite));

        let x1 = Math.max(0, Math.min(1000, minX - 35));
        let x2 = Math.max(0, Math.min(1000, maxX + 35));

        if (!Number.isFinite(x1) || !Number.isFinite(x2) || x2 - x1 < 100) {
            x1 = 70;
            x2 = 930;
        }

        return [x1, y1, x2, y2];
    };

    const buildPdfLayoutFigureDraftImagesV2 = async (drafts = [], batch, helpers = {}) => {
        const rows = [];

        if (!helpers.cropDataUrlByBbox) return rows;

        for (const draft of drafts || []) {
            if (!hasFigureCueV2(draft)) continue;

            const pageImage = draft.sourcePageImage || draft.sourceTrace?.sourcePageImage || '';
            if (!pageImage) continue;

            const evidence = draft.sourceTrace?.evidence || draft.evidence || {};
            if (!evidence.layout && !draft.sourceTrace?.layout) continue;

            const bbox = buildQuestionBandBboxFromPdfLayoutV2(draft);
            if (!bbox.length) {
                draft.warnings = uniq([
                    ...(draft.warnings || []),
                    '题目疑似含图，但未能用 PDF 文本坐标确定题图区域，请从来源原图手动裁剪。'
                ]);
                continue;
            }

            let url = '';
            try {
                url = await helpers.cropDataUrlByBbox(pageImage, bbox, 10);
            } catch (error) {
                draft.warnings = uniq([
                    ...(draft.warnings || []),
                    `PDF 坐标题图裁剪失败，请手动裁剪：${error?.message || String(error)}`
                ]);
                continue;
            }

            const imageId = makeId(helpers, 'dimg');

            rows.push({
                id: imageId,
                batchId: batch.id,
                questionId: draft.id,
                filename: `${draft.sourceFileName || 'pdf'}_p${draft.sourcePage || 1}_q${draft.questionNumber || draft.order}_figure.png`,
                name: `${draft.sourceFileName || 'pdf'}_p${draft.sourcePage || 1}_q${draft.questionNumber || draft.order}_figure.png`,
                url,
                sourceFileId: draft.sourceFileId || draft.sourceQuestionFileId || '',
                sourcePage: draft.sourcePage || 1,
                bbox,
                confidence: 0.82,
                description: 'PDF 坐标裁剪题图',
                source: 'pdf-layout-figure-crop',
                status: 'need_confirm',
                displayable: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });

            draft.hasImage = true;
            draft.imageReviewStatus = 'need_confirm';
            draft.warnings = uniq([
                ...(draft.warnings || []),
                '已根据 PDF 文本坐标裁剪疑似题图，请核对。'
            ]);
        }

        return rows;
    };

    const buildAutoFigureDraftImagesV2 = async (drafts = [], batch, helpers = {}) => {
        const rows = [];

        if (!helpers.locateQuestionFiguresWithQwen || !helpers.cropDataUrlByBbox) {
            return rows;
        }

        const groups = new Map();

        for (const draft of drafts || []) {
            const pageImage = draft.sourcePageImage || draft.sourceTrace?.sourcePageImage || '';
            if (!pageImage) continue;

            const sourceFileId =
                draft.sourceFileId ||
                draft.sourceQuestionFileId ||
                draft.sourceTrace?.sourceFileId ||
                '';

            const pageNo =
                draft.sourcePage ||
                draft.pageIndex ||
                draft.sourceTrace?.sourcePage ||
                draft.sourceTrace?.pageIndex ||
                1;

            const key = `${sourceFileId || 'file'}::${pageNo}`;

            if (!groups.has(key)) {
                groups.set(key, {
                    sourceFileId,
                    sourceFileName: draft.sourceFileName || draft.sourceTrace?.sourceFileName || '',
                    pageNo,
                    pageImage,
                    drafts: []
                });
            }

            groups.get(key).drafts.push(draft);
        }

        for (const group of groups.values()) {
            const questionSummaries = group.drafts.map(draft => ({
                question: draft.questionNumber || draft.question || draft.order,
                questionNumber: draft.questionNumber || draft.question || draft.order,
                order: draft.order,
                stem: draft.stem || '',
                options: Array.isArray(draft.options) ? draft.options : [],
                hasFigureCue: hasFigureCueV2(draft)
            }));

            let locatedFigures = [];

            try {
                locatedFigures = await helpers.locateQuestionFiguresWithQwen({
                    pageImage: group.pageImage,
                    pageNo: group.pageNo,
                    sourceFileName: group.sourceFileName,
                    questions: questionSummaries
                }) || [];
            } catch (error) {
                group.drafts.forEach(draft => {
                    draft.warnings = uniq([
                        ...(draft.warnings || []),
                        `题图自动定位失败，保留来源原图供人工裁剪：${error?.message || String(error)}`
                    ]);
                });
                continue;
            }

            const draftByQuestion = new Map();

            for (const draft of group.drafts) {
                const key = normalizeQuestionKey(helpers, draft.questionNumber || draft.question || draft.order);
                if (key && !draftByQuestion.has(key)) draftByQuestion.set(key, draft);
            }

            const figuresByQuestion = new Map();

            for (const fig of locatedFigures) {
                const qKey = normalizeQuestionKey(helpers, fig.question || fig.questionNumber || fig.no);
                if (!qKey || !draftByQuestion.has(qKey)) continue;

                const bbox = normalizeBboxV2(fig.image_bbox || fig.imageBbox || fig.bbox || fig.图片区域);
                if (!bbox.length) continue;

                if (bboxAreaV2(bbox) > 520000) continue;

                if (!figuresByQuestion.has(qKey)) {
                    figuresByQuestion.set(qKey, []);
                }

                figuresByQuestion.get(qKey).push({
                    bbox,
                    description: asText(fig.image_description || fig.description || '题中图形'),
                    confidence: Number(fig.image_confidence || fig.confidence || 0.82)
                });
            }

            for (const [qKey, figures] of figuresByQuestion.entries()) {
                const draft = draftByQuestion.get(qKey);
                if (!draft || !figures.length) continue;

                const union = unionBboxesV2(figures.map(item => item.bbox));
                if (!union.length) continue;

                let croppedUrl = '';

                try {
                    croppedUrl = await helpers.cropDataUrlByBbox(group.pageImage, union, 14);
                } catch (error) {
                    draft.warnings = uniq([
                        ...(draft.warnings || []),
                        `题图裁剪失败，保留来源原图供人工裁剪：${error?.message || String(error)}`
                    ]);
                    continue;
                }

                const confidence = Math.min(
                    1,
                    Math.max(...figures.map(item => Number(item.confidence || 0.82)))
                );

                const imageId = makeId(helpers, 'dimg');
                const status = confidence >= 0.88 ? 'bound' : 'need_confirm';

                const description = uniq(figures.map(item => item.description).filter(Boolean)).join('；') || '自动裁剪题图';

                rows.push({
                    id: imageId,
                    batchId: batch.id,
                    questionId: draft.id,
                    filename: `${group.sourceFileName || 'page'}_p${group.pageNo}_q${draft.questionNumber || draft.order}_figure.png`,
                    name: `${group.sourceFileName || 'page'}_p${group.pageNo}_q${draft.questionNumber || draft.order}_figure.png`,
                    url: croppedUrl,
                    sourceFileId: group.sourceFileId,
                    sourcePage: group.pageNo,
                    bbox: union,
                    confidence,
                    description: `自动裁剪题图：${description}`,
                    source: 'auto-figure-crop',
                    status,
                    displayable: true,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                draft.hasImage = true;
                draft.imageReviewStatus =
                    status === 'bound'
                        ? (draft.imageReviewStatus === 'low_confidence' ? 'low_confidence' : 'confirmed')
                        : 'need_confirm';

                draft.warnings = uniq([
                    ...(draft.warnings || []),
                    status === 'bound'
                        ? '已自动裁剪题中图形，请核对。'
                        : '已自动裁剪疑似题中图形，请确认是否正确。'
                ]);
            }
        }

        return rows;
    };

    const processBatchV2 = async ({ batch, files, helpers }) => {
        if (!batch) throw new Error('缺少 batch。');
        if (!Array.isArray(files) || !files.length) throw new Error('缺少批量录题文件。');

        const evidences = [];
        const fatalErrors = [];

        for (const file of files) {
            try {
                const rows = await buildPageEvidenceForFile(file, helpers);
                rows.forEach(evidence => evidences.push(evidence));
            } catch (error) {
                if (String(error?.code || '').startsWith('PDF_COORDINATOR_')) throw error;
                if (helpers.isFatalQwenServiceError?.(error)) throw error;
                fatalErrors.push(`${file.filename || file.id}: ${error?.message || String(error)}`);
            }
        }

        const usableEvidence = evidences.filter(item => item.pageImage || item.textLayer);

        if (!usableEvidence.length) {
            const emptyEvidence = {
                id: makeId(helpers, 'pe'),
                batchId: batch.id,
                sourceFileId: '',
                sourceFileName: '',
                fileType: 'unknown',
                roles: ['question'],
                pageNo: 1,
                pageImage: '',
                textLayer: '',
                ocrMarkdown: '',
                width: 0,
                height: 0,
                warnings: fatalErrors.length ? fatalErrors : ['没有生成可识别页面。'],
                errors: fatalErrors
            };

            const draft = buildManualDraft(emptyEvidence, batch, helpers, 1);
            draft.stem = '文件未能生成可识别页面。请检查 PDF 是否损坏，或重新导出为清晰 PDF/图片后再试。';
            draft.warnings = [
                ...new Set([
                    ...(draft.warnings || []),
                    ...fatalErrors.map(msg => `文件处理失败：${msg}`)
                ])
            ];

            return {
                evidences,
                drafts: [draft],
                draftImages: [],
                unmatched: [],
                warnings: draft.warnings,
                errors: fatalErrors
            };
        }

        const questionEvidence = usableEvidence.filter(evidence => isQuestionFile({ role: evidence.roles[0], roles: evidence.roles }, helpers));
        const answerEvidence = usableEvidence.filter(evidence => isAnswerFile({ role: evidence.roles[0], roles: evidence.roles }, helpers) && !isQuestionFile({ role: evidence.roles[0], roles: evidence.roles }, helpers));
        const solutionEvidence = usableEvidence.filter(evidence => isSolutionFile({ role: evidence.roles[0], roles: evidence.roles }, helpers) && !isQuestionFile({ role: evidence.roles[0], roles: evidence.roles }, helpers));

        const questionBlocks = [];
        for (const evidence of questionEvidence) {
            const blocks = buildQuestionBlocksFromEvidenceV2(evidence, helpers);
            questionBlocks.push(...blocks);
        }

        let drafts = buildDraftsFromBlocks(questionBlocks.filter(Boolean).filter(block => !block.manual), batch, helpers);

        if (!drafts.length) {
            const fallbackEvidence = questionEvidence.find(evidence => evidence.pageImage || evidence.textLayer) || usableEvidence[0];
            drafts = [buildManualDraft(fallbackEvidence, batch, helpers, 1)];
        }

        const unmatched = [];
        const answerSupportItems = extractSupportItemsV2(
            answerEvidence, 'answer', helpers
        );
        const solutionSupportItems = extractSupportItemsV2(
            solutionEvidence, 'solution', helpers
        );
        if (helpers.deferPdfCandidateProjection !== true) {
            attachSupportItems(
                drafts, answerSupportItems, 'answer', helpers, unmatched
            );
            attachSupportItems(
                drafts, solutionSupportItems, 'solution', helpers, unmatched
            );
        }

        drafts = drafts
            .sort((a, b) => {
                const ak = Number(normalizeQuestionKey(helpers, a.questionNumber) || a.order || 0);
                const bk = Number(normalizeQuestionKey(helpers, b.questionNumber) || b.order || 0);
                return ak - bk;
            })
            .map((draft, idx) => ({ ...draft, order: idx + 1, updatedAt: Date.now() }));

        let draftImages = [];

        // 默认禁用 AI 整页自动裁图；改用 PDF 文本坐标确定题图区间。
        try {
            const pdfLayoutImages = await buildPdfLayoutFigureDraftImagesV2(drafts, batch, helpers);
            draftImages.push(...pdfLayoutImages);
        } catch (error) {
            drafts.forEach(draft => {
                if (hasFigureCueV2(draft)) {
                    draft.warnings = uniq([
                        ...(draft.warnings || []),
                        `PDF 坐标题图裁剪流程失败，请从来源原图手动裁剪：${error?.message || String(error)}`
                    ]);
                }
            });
        }

        // AI 整页自动裁图仍然默认关闭，不能自动执行。
        // 只有以后实现题号区域坐标校验后，才允许恢复。

        if (fatalErrors.length) {
            drafts.forEach(draft => draft.warnings.push(...fatalErrors.map(msg => `部分文件处理失败：${msg}`)));
        }

        return {
            evidences,
            drafts,
            draftImages,
            unmatched,
            warnings: uniq([
                ...usableEvidence.flatMap(evidence => evidence.warnings || []),
                ...(draftImages.length ? [`已自动裁剪 ${draftImages.length} 张题图。`] : [])
            ]),
            errors: fatalErrors
        };
    };

    const selfTest = async () => {
        const helpers = {
            makeBatchId: (prefix) => `${prefix}_test_${Math.random().toString(36).slice(2, 6)}`,
            getBatchFileRoles: (file) => file.roles || [file.role || 'question'],
            batchHasQuestionRole: (file) => (file.roles || [file.role]).some(role => role === 'question' || role === 'full'),
            batchHasAnswerRole: (file) => (file.roles || [file.role]).some(role => role === 'answer' || role === 'full'),
            batchHasSolutionRole: (file) => (file.roles || [file.role]).some(role => role === 'solution' || role === 'full'),
            renderPdfFilePages: async () => [{ pageNo: 1, url: 'data:image/png;base64,test-page' }],
            extractPdfTextWithPdfJs: async () => [1, 2, 3, 4, 5, 6].map(n => `${n}. 题干${n} A. [[IMAGE:img_${n}]] B. $x^2+1$ C. [[FORMULA_IMAGE:f${n}]] D. \\\\includegraphics{g${n}}`).join('\n'),
            convertDocxRecordToPdfRecord: async (file) => ({ ...file, fileType: 'pdf' }),
            extractTextFromDraftFile: async () => '',
            recognizePageMarkdownWithQwen: async () => { throw new Error('vision down'); },
            cleanRecognizedText: (x) => asText(x),
            cleanDisplayTextForBatchSave: (x) => asText(x),
            cleanDisplayOptionsForBatchSave: (options) => [0, 1, 2, 3].map(idx => asText(options[idx] || '')),
            normalizeQuestionType: (raw, stem, options) => options.filter(Boolean).length >= 2 ? '单选题' : (raw || '解答题'),
            normalizeQuestionKey: (value) => String(value || '').match(/\d+/)?.[0] || '',
            isFatalQwenServiceError: () => false
        };

        const result = await processBatchV2({
            batch: { id: 'batch_selftest', defaultMeta: { defaultType: '单选题', grade: '高一', diff: '中等' } },
            files: [{ id: 'file_pdf', batchId: 'batch_selftest', filename: 'self.pdf', fileType: 'pdf', roles: ['question'], uploadPath: 'data:application/pdf;base64,test' }],
            helpers
        });

        const checks = {
            pdfTextLayerSixQuestions: result.drafts.length === 6,
            horizontalOptionsFour: result.drafts[0]?.options?.filter(optionHasContent).length === 4,
            visionFailureNotFailed: result.drafts.some(draft => draft.warnings.some(w => /视觉 OCR Markdown 诊断失败|PDF 文本层未检测到明显公式乱码|PDF 文本层疑似公式乱码/.test(w))),
            sourcePageImageKept: result.drafts.every(draft => draft.sourcePageImage),
            optionTokensKept: result.drafts[0]?.options?.some(opt => opt.includes('[[IMAGE:')) &&
                result.drafts[0]?.options?.some(opt => opt.includes('[[FORMULA_IMAGE:')) &&
                result.drafts[0]?.options?.some(opt => opt.includes('\\includegraphics')),
            mismatchWarningOnly: result.errors.length === 0
        };

        const pass = Object.values(checks).every(Boolean);
        const payload = { pass, checks, draftCount: result.drafts.length, result };
        console.groupCollapsed(`[BATCH_V2_SELFTEST] ${pass ? 'PASS' : 'FAIL'}`);
        console.log(payload);
        console.groupEnd();
        return payload;
    };

    window.QisiBatchEngineV2 = {
        processBatchV2,
        splitQuestionBlocksV2,
        parseOptionsV2,
        buildQuestionBlocksFromEvidenceV2
    };
    window.__qisiBatchV2SelfTest = selfTest;
})();
