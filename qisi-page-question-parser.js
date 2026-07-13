(function initPageQuestionParser(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PageQuestionParser = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createPageQuestionParser(ports = {}) {
        for (const name of ["cleanDisplayTextForBatchSave","normalizeQuestionKey","hasChoiceLabelSignal"]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Page question parser requires ${name}.`
                );
                error.code = 'PAGE_QUESTION_PARSER_PORT_REQUIRED';
                throw error;
            }
        }

        const cleanDisplayTextForBatchSave = ports.cleanDisplayTextForBatchSave;
        const normalizeQuestionKey = ports.normalizeQuestionKey;
        const hasChoiceLabelSignal = ports.hasChoiceLabelSignal;

        const splitPageMarkdownIntoQuestionBlocks = (markdown = '') => {
            const text = root.Qisi.Utils.cleanRecognizedText(markdown)
                .replace(/\r/g, '\n')
                .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

            if (!text) return [];

            const matches = [];

            // 支持：
            // 1.
            // 1、
            // 1)
            // （1）
            // (1)
            // 第1题
            // **1.**
            const re = /(?:^|\n)\s*(?:\*\*)?\s*(?:第\s*)?[（(]?\s*(\d{1,3})\s*[）)]?\s*(?:题)?\s*(?:[\.．、:：\)）]\s*)?(?:\*\*)?/g;

            let m;
            while ((m = re.exec(text)) !== null) {
                const qno = Number(m[1]);
                if (!Number.isFinite(qno) || qno <= 0) continue;

                const prefix = m[0];
                const start = m.index + (prefix.startsWith('\n') ? 1 : 0);

                // 避免把正文中的年份、编号误当题号：题号命中后面至少要有一点正文
                const tail = text.slice(re.lastIndex, re.lastIndex + 60);
                if (!tail.trim()) continue;

                matches.push({
                    question: String(qno),
                    start,
                    contentStart: re.lastIndex
                });
            }

            if (!matches.length) return [];

            const unique = [];
            const seen = new Set();

            for (const hit of matches) {
                const key = `${hit.question}_${hit.start}`;
                if (seen.has(key)) continue;
                seen.add(key);
                unique.push(hit);
            }

            return unique.map((hit, idx) => {
                const next = unique[idx + 1];
                const end = next ? next.start : text.length;
                const block = text.slice(hit.start, end).trim();

                return {
                    question: hit.question,
                    block
                };
            }).filter(item => item.block.length >= 8);
        };

        const parseOptionsFromBlock = (block = '') => {
            const source = root.Qisi.Utils.cleanRecognizedText(block)
                .replace(/\r/g, '\n')
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/([A-D])\s*[．.、:：]\s*/g, '$1. ')
                .replace(/[ \t]{2,}/g, ' ')
                .trim();

            if (!source) {
                return { stem: '', options: ['', '', '', ''] };
            }

            const labelRegex = /(^|[\n\r\s　]|[（(])([A-D])\s*(?:[\.．、:：\)）]|(?=\s*[$\\\u4e00-\u9fa5A-Za-z0-9（(]))/g;

            const hits = [];
            let match;

            while ((match = labelRegex.exec(source)) !== null) {
                hits.push({
                    label: match[2],
                    start: match.index + match[1].length,
                    contentStart: labelRegex.lastIndex
                });
            }

            const candidates = [];

            for (let i = 0; i < hits.length; i += 1) {
                if (hits[i].label !== 'A') continue;

                const ordered = [];
                const expected = ['A', 'B', 'C', 'D'];

                for (let j = i; j < hits.length; j += 1) {
                    const need = expected[ordered.length];
                    if (hits[j].label === need) {
                        ordered.push(hits[j]);
                        if (ordered.length === 4) break;
                    }
                }

                if (ordered.length >= 2) {
                    candidates.push(ordered);
                }
            }

            if (!candidates.length) {
                return {
                    stem: root.Qisi.Utils.cleanDisplayTextForBatchSave(source),
                    options: ['', '', '', '']
                };
            }

            const scoreCandidate = (ordered) => {
                let score = ordered.length * 10;

                const beforeA = source.slice(Math.max(0, ordered[0].start - 20), ordered[0].start);
                if (/[（(]\s*$/.test(beforeA)) score += 2;
                if (/\n\s*$/.test(beforeA)) score += 2;

                ordered.forEach((hit, idx) => {
                    const next = ordered[idx + 1];
                    const end = next ? next.start : source.length;
                    const content = source.slice(hit.contentStart, end).trim();

                    if (content.length >= 1) score += 1;
                    if (content.length >= 3) score += 2;
                    if (/^[A-D]$/i.test(content)) score -= 8;
                    if (/^[,，、。；;]+$/.test(content)) score -= 8;
                });

                // 避免把“点 A、B、C、D”当成选项
                const fullOptionZone = source.slice(ordered[0].start, ordered[ordered.length - 1].start + 30);
                if (/点\s*A\s*[、,]\s*B\s*[、,]\s*C\s*[、,]\s*D/.test(fullOptionZone)) {
                    score -= 20;
                }

                return score;
            };

            const ordered = candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];

            const stem = source.slice(0, ordered[0].start).trim();
            const options = ['', '', '', ''];

            ordered.forEach((hit, idx) => {
                const next = ordered[idx + 1];
                const end = next ? next.start : source.length;

                const value = source
                    .slice(hit.contentStart, end)
                    .replace(/^[\s　]*[A-D]\s*[\.\．、:：\)）]?\s*/i, '')
                    .trim();

                const optionIndex = hit.label.charCodeAt(0) - 65;

                if (optionIndex >= 0 && optionIndex < 4) {
                    options[optionIndex] = root.Qisi.Utils.cleanDisplayTextForBatchSave(value);
                }
            });

            const validCount = options.filter(opt => {
                const s = root.Qisi.Utils.cleanRecognizedText(opt).replace(/[.\s、，。:：；;()（）]/g, '');
                return s && !/^[A-D]$/i.test(s);
            }).length;

            if (validCount < 2) {
                return {
                    stem: root.Qisi.Utils.cleanDisplayTextForBatchSave(source),
                    options: ['', '', '', '']
                };
            }

            return {
                stem: root.Qisi.Utils.cleanDisplayTextForBatchSave(stem || source),
                options: root.Qisi.Utils.cleanDisplayOptionsForBatchSave(options)
            };
        };

        const getCurrentQuestionBlockFromPageText = (q) => {
            if (!q) return '';

            const qno = normalizeQuestionKey(q.questionNumber || q.question || q.order || '');

            const sources = [
                q.rawBlock,
                q.rawText,
                q.sourceTrace?.rawBlock,
                q.recognitionRaw?.rawBlock,
                q.pageText,
                q.sourceText,
                q.pageTextOriginal,
                q.sourceTextOriginal,
                q.sourceTrace?.pageText,
                q.sourceTrace?.sourceText,
                q.sourceTrace?.pageTextOriginal,
                q.sourceTrace?.sourceTextOriginal,
                q.pdfTextLayer,
                q.textLayer,
                q.sourceTrace?.pdfTextLayer,
                q.sourceTrace?.textLayer
            ].map(cleanRecognizedText).filter(Boolean);

            const candidates = [];

            for (const source of sources) {
                const normalized = source
                    .replace(/\r/g, '\n')
                    .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

                if (!normalized) continue;

                if (qno) {
                    const blocks = splitPageMarkdownIntoQuestionBlocks(normalized);
                    const matched = blocks.find(item => normalizeQuestionKey(item.question) === qno);
                    if (matched?.block) candidates.push(matched.block);

                    const questionStartRe = new RegExp(
                        `(?:^|\\n)\\s*(?:第\\s*)?[（(]?\\s*${qno}\\s*[）)]?\\s*(?:题)?\\s*[\\.．、:：\\)）]?\\s*`,
                        'g'
                    );

                    const startMatch = questionStartRe.exec(normalized);
                    if (startMatch) {
                        const start = startMatch.index;
                        const tail = normalized.slice(questionStartRe.lastIndex);
                        const nextMatch = tail.match(/\n\s*(?:第\s*)?[（(]?\s*\d{1,3}\s*[）)]?\s*(?:题)?\s*[\.．、:：\)）]\s*/);
                        const end = nextMatch ? questionStartRe.lastIndex + nextMatch.index : normalized.length;
                        candidates.push(normalized.slice(start, end).trim());
                    }
                }

                candidates.push(normalized);
            }

            const unique = [...new Set(candidates.map(cleanRecognizedText).filter(Boolean))];

            if (!unique.length) return '';

            const scoreBlock = (block) => {
                const parsed = parseOptionsFromBlock(block);
                const optionCount = parsed.options.filter(Boolean).length;
                let score = optionCount * 100;

                if (hasChoiceLabelSignal(block)) score += 30;
                score += Math.min(20, root.Qisi.Utils.mathSignalCount(block) * 2);

                const stemHead = root.Qisi.Utils.cleanRecognizedText(q.stem || '').slice(0, 20);
                if (stemHead && block.includes(stemHead)) score += 10;

                return score;
            };

            return unique.sort((a, b) => scoreBlock(b) - scoreBlock(a))[0] || '';
        };

        const extractOptionsFromCurrentBlockOnly = (q) => {
            if (!q) return q;

            const existing = root.Qisi.Utils.cleanDisplayOptionsForBatchSave(q.options);
            if (existing.filter(Boolean).length >= 4) {
                q.options = existing;
                return q;
            }

            const rawSources = [
                q.rawBlock,
                q.rawText,
                q.sourceTrace?.rawBlock,
                q.recognitionRaw?.rawBlock,
                q.pageText,
                q.sourceText,
                q.pageTextOriginal,
                q.sourceTextOriginal,
                q.sourceTrace?.pageText,
                q.sourceTrace?.sourceText,
                q.sourceTrace?.pageTextOriginal,
                q.sourceTrace?.sourceTextOriginal,
                q.pdfTextLayer,
                q.textLayer,
                q.sourceTrace?.pdfTextLayer,
                q.sourceTrace?.textLayer,
                getCurrentQuestionBlockFromPageText(q)
            ].map(cleanRecognizedText).filter(Boolean);

            const answerLooksChoice = /^[A-D]{1,4}$/.test(
                root.Qisi.Utils.cleanRecognizedText(q.answer)
                    .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                    .replace(/[.\s、，。:：；;()（）]/g, '')
                    .toUpperCase()
            );

            const shouldTry =
                ['单选题', '多选题'].includes(q.type) ||
                answerLooksChoice ||
                rawSources.some(hasChoiceLabelSignal);

            if (!shouldTry) return q;

            const best = rawSources
                .map(source => parseOptionsFromBlock(source))
                .filter(parsed => parsed && parsed.options)
                .sort((a, b) => b.options.filter(Boolean).length - a.options.filter(Boolean).length)[0];

            if (!best) return q;

            const extracted = root.Qisi.Utils.cleanDisplayOptionsForBatchSave(best.options);
            const extractedCount = extracted.filter(Boolean).length;
            const existingCount = existing.filter(Boolean).length;

            if (extractedCount > existingCount && extractedCount >= 2) {
                q.options = extracted;

                if (best.stem && best.stem.length >= 8 && best.stem.length >= root.Qisi.Utils.cleanRecognizedText(q.stem).length * 0.35) {
                    q.stem = cleanDisplayTextForBatchSave(best.stem);
                }

                if (!['单选题', '多选题'].includes(q.type)) {
                    q.type = root.Qisi.Utils.cleanRecognizedText(q.answer).replace(/\s/g, '').length >= 2 ? '多选题' : '单选题';
                }

                root.Qisi.Utils.addWarningOnce(q, `已从当前题原始证据中提取 ${extractedCount}/4 个选项，请核对。`);
            }

            return q;
        };

        const attachSourceTraceToDraftQuestion = (q, files = []) => {
            if (!q) return q;
            root.Qisi.Utils.preserveRawEvidence(q);
            const sourceFileId = q.sourceFileId || q.sourceQuestionFileId || q.sourceTrace?.sourceFileId || '';
            const sourceFile = files.find(file => file.id === sourceFileId) || {};
            const imageIds = [
                ...(q.imageIds || []),
                ...((q.images || []).map(img => img.id).filter(Boolean)),
                ...((q.recognizedImages || []).map(img => img.id).filter(Boolean))
            ];
            q.sourceFileId = sourceFileId;
            q.sourceFileName = q.sourceFileName || sourceFile.filename || q.sourceTrace?.sourceFileName || '';
            q.pageIndex = q.pageIndex || q.sourcePage || q.sourceTrace?.pageIndex || 0;
            if (!q.rawText) q.rawText = q.rawBlock || q.sourceText || q.pageText || q.stem || '';
            q.sourceTrace = {
                ...(q.sourceTrace || {}),
                sourceFileId,
                sourceFileName: q.sourceFileName,
                pageIndex: q.pageIndex,
                sourcePage: q.sourcePage || q.sourceTrace?.sourcePage || 0,
                sourcePageImage: q.sourcePageImage || q.sourceTrace?.sourcePageImage || '',
                rawBlock: q.sourceTrace?.rawBlock || q.rawBlock || q.rawText || '',
                pageText: q.sourceTrace?.pageText || q.pageText || q.sourceText || '',
                sourceText: q.sourceTrace?.sourceText || q.sourceText || q.pageText || '',
                imageIds: [...new Set(imageIds)]
            };
            return q;
        };


        return Object.freeze({
            splitPageMarkdownIntoQuestionBlocks,
            parseOptionsFromBlock,
            getCurrentQuestionBlockFromPageText,
            extractOptionsFromCurrentBlockOnly,
            attachSourceTraceToDraftQuestion
        });
    }

    return Object.freeze({ createPageQuestionParser });
});
