(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.BatchFinalGate = api;

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

        const BAD_CHAR_RE = /[�□▯▢■●◆◇�]/g;

        const requirePolicyFunction = (policy, name) => {
            const fn = policy?.[name];
            if (typeof fn !== 'function') {
                throw new TypeError(`BatchFinalGate requires policy.${name}()`);
            }
            return fn;
        };

        const cleanText = (value = '', policy = {}) => {
            const cleanRecognizedText = requirePolicyFunction(policy, 'cleanRecognizedText');
            return cleanRecognizedText(value || '');
        };

        const normalizeQuestionNo = (item = {}, policy = {}) => {
            const raw =
                item.questionNumber ??
                item.question ??
                item.no ??
                item.index ??
                item.order ??
                item.sourceTrace?.questionNo ??
                '';

            const normalizeQuestionKey = requirePolicyFunction(policy, 'normalizeQuestionKey');
            return normalizeQuestionKey(raw);
        };

        const getSourceKey = (item = {}) => String(
            item.sourceDocxFileId ||
            item.sourceQuestionFileId ||
            item.sourceFileId ||
            item.sourceTrace?.sourceDocxFileId ||
            item.sourceTrace?.sourceQuestionFileId ||
            item.sourceTrace?.sourceFileId ||
            item.sourceFileName ||
            item.sourceTrace?.sourceFileName ||
            'unknown-file'
        );

        const getCandidateIdentity = (item = {}, policy = {}) => {
            const questionNumber = normalizeQuestionNo(item, policy);
            const sourceKey = getSourceKey(item);

            return {
                questionNumber,
                sourceKey,
                key: questionNumber ? `${sourceKey}::${questionNumber}` : ''
            };
        };

        const badCharCount = (value = '') => {
            const matches = String(value || '').match(BAD_CHAR_RE);
            return matches ? matches.length : 0;
        };

        const latexSignalCount = (value = '') => {
            const matches = String(value || '').match(
                /\\frac|\\sqrt|\\sin|\\cos|\\tan|\\angle|\\triangle|\\vec|\\overrightarrow|\\overline|\\left|\\right|\\subset|\\subseteq|\\cap|\\cup|\\in|\\pi|\\theta|\\cdot|\$|[_^{}]/g
            );
            return matches ? matches.length : 0;
        };

        const chineseCount = (value = '') => {
            const matches = String(value || '').match(/[\u4e00-\u9fa5]/g);
            return matches ? matches.length : 0;
        };

        const mediaTokenCount = (value = '') => {
            const matches = String(value || '').match(
                /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/g
            );
            return matches ? matches.length : 0;
        };

        const cleanOptions = (options = [], policy = {}) => {
            const cleanDisplayOptionsForBatchSave = requirePolicyFunction(
                policy,
                'cleanDisplayOptionsForBatchSave'
            );
            const cleaned = cleanDisplayOptionsForBatchSave(options || []);
            if (!Array.isArray(cleaned)) {
                throw new TypeError(
                    'BatchFinalGate policy.cleanDisplayOptionsForBatchSave() must return an array'
                );
            }
            return [0, 1, 2, 3].map(index => cleaned[index] ?? '');
        };

        const isMeaningfulOption = (value = '', policy = {}) => {
            const raw = String(value || '').trim();

            if (!raw) return false;
            if (mediaTokenCount(raw) > 0) return true;

            const text = cleanText(raw, policy)
                .replace(/^[\s　]*[（(]?\s*[A-DＡ-Ｄ]\s*[\.．、:：\)）]?\s*/i, '')
                .replace(/[.\s、，。:：；;()（）]/g, '')
                .trim();

            if (!text) return false;
            if (/^[A-D]$/i.test(text)) return false;

            return true;
        };

        const countMeaningfulOptions = (options = [], policy = {}) =>
            cleanOptions(options, policy)
                .filter(value => isMeaningfulOption(value, policy))
                .length;

        const allCandidateText = (item = {}) => {
            const options = Array.isArray(item.options) ? item.options : [];
            return [
                item.stem,
                options.join('\n'),
                item.answer,
                item.solution,
                item.rawText,
                item.rawBlock,
                item.sourceTrace?.rawBlock,
                item.sourceTrace?.pageText
            ].map(value => String(value || '')).join('\n');
        };

        const sourceBonus = (item = {}) => {
            const source = String(
                item.sourceTrace?.source ||
                item.recognitionSource ||
                item.source ||
                ''
            ).toLowerCase();

            let score = 0;
            if (/visual|vision|qwen|strict|page-qwen|image/.test(source)) score += 50;
            if (/docx-importer/.test(source)) score += 40;
            if (/pdf-text|text-layer|fallback|local/.test(source)) score -= 10;
            return score;
        };

        const scoreCandidate = (item = {}, policy = {}) => {
            const stem = cleanText(item.stem || '', policy);
            const options = Array.isArray(item.options) ? item.options : ['', '', '', ''];
            const optionText = options.join('\n');
            const allText = allCandidateText(item);

            const optionCount = countMeaningfulOptions(options, policy);
            const badChars = badCharCount(allText);
            const latexSignals = latexSignalCount(allText);
            const chinese = chineseCount(stem);
            const mediaTokens = mediaTokenCount(allText);

            let score = 0;
            score += optionCount * 60;
            if (optionCount >= 4) score += 180;
            if (optionCount >= 2) score += 60;
            score += Math.min(120, chinese * 2);
            score += Math.min(240, latexSignals * 20);
            score += Math.min(80, mediaTokens * 30);

            if (Array.isArray(item.images) && item.images.length) score += 50;
            if (item.sourcePageImage || item.sourceTrace?.sourcePageImage) score += 25;

            score -= badChars * 80;

            if (/未能自动切出题目|识别失败|图片题识别草稿|请查看右侧图片并补全|请对照右侧原图手动补全/.test(stem)) {
                score -= 600;
            }

            if (stem.length < 8) score -= 180;

            if (
                optionCount === 0 &&
                /单选|多选|下列|正确的是|错误的是|命题|侧棱长|形状为/.test(stem)
            ) {
                score -= 220;
            }

            if (optionCount === 0 && /(^|\n)\s*A\s*[\.．、:：\)）]\s*($|\n)/.test(optionText)) {
                score -= 200;
            }

            score += sourceBonus(item);
            return score;
        };

        const rankCandidates = (candidates = [], policy = {}) =>
            [...(Array.isArray(candidates) ? candidates : [])]
                .sort((left, right) =>
                    scoreCandidate(right, policy) - scoreCandidate(left, policy)
                );

        const mergeImageLists = (lists, policy = {}) => {
            const mergeImageListsById = requirePolicyFunction(policy, 'mergeImageListsById');
            return mergeImageListsById(...lists);
        };

        const betterText = (current = '', candidate = '', policy = {}) => {
            const currentText = cleanText(current, policy);
            const candidateText = cleanText(candidate, policy);

            if (!currentText && candidateText) return candidate;
            if (currentText && !candidateText) return current;

            const currentBad = badCharCount(currentText);
            const candidateBad = badCharCount(candidateText);
            const currentMath = latexSignalCount(currentText);
            const candidateMath = latexSignalCount(candidateText);

            if (currentBad > 0 && candidateBad === 0 && candidateText.length >= 6) return candidate;
            if (candidateBad > 0 && currentBad === 0) return current;
            if (candidateMath > currentMath && candidateBad <= currentBad) return candidate;
            if (candidateText.length > currentText.length * 1.25 && candidateBad <= currentBad) return candidate;

            return current;
        };

        const mergeCandidate = (best = {}, other = {}, policy = {}) => {
            const merged = { ...best };
            const bestOptions = Array.isArray(best.options) ? best.options : ['', '', '', ''];
            const otherOptions = Array.isArray(other.options) ? other.options : ['', '', '', ''];
            const bestOptionCount = countMeaningfulOptions(bestOptions, policy);
            const otherOptionCount = countMeaningfulOptions(otherOptions, policy);

            if (
                otherOptionCount > bestOptionCount ||
                (
                    otherOptionCount === bestOptionCount &&
                    badCharCount(otherOptions.join('\n')) < badCharCount(bestOptions.join('\n')) &&
                    latexSignalCount(otherOptions.join('\n')) >= latexSignalCount(bestOptions.join('\n'))
                )
            ) {
                merged.options = otherOptions;
            }

            merged.stem = betterText(best.stem, other.stem, policy);
            merged.answer = betterText(best.answer, other.answer, policy);
            merged.solution = betterText(best.solution, other.solution, policy);
            merged.images = mergeImageLists([best.images || [], other.images || []], policy);
            merged.recognizedImages = mergeImageLists(
                [best.recognizedImages || [], other.recognizedImages || []],
                policy
            );

            if (!merged.sourcePageImage && other.sourcePageImage) {
                merged.sourcePageImage = other.sourcePageImage;
            }
            if (!merged.answerPageImage && other.answerPageImage) {
                merged.answerPageImage = other.answerPageImage;
            }
            if (!merged.solutionPageImage && other.solutionPageImage) {
                merged.solutionPageImage = other.solutionPageImage;
            }

            const bestTrace = best.sourceTrace || {};
            const otherTrace = other.sourceTrace || {};

            merged.sourceTrace = {
                ...bestTrace,
                sourcePageImage:
                    bestTrace.sourcePageImage ||
                    otherTrace.sourcePageImage ||
                    other.sourcePageImage ||
                    '',
                rawBlock:
                    bestTrace.rawBlock ||
                    otherTrace.rawBlock ||
                    other.rawBlock ||
                    other.rawText ||
                    '',
                pageText:
                    bestTrace.pageText ||
                    otherTrace.pageText ||
                    other.pageText ||
                    other.sourceText ||
                    '',
                duplicateMergedFrom: [
                    ...(Array.isArray(bestTrace.duplicateMergedFrom)
                        ? bestTrace.duplicateMergedFrom
                        : []),
                    {
                        id: other.id || '',
                        questionNumber:
                            other.questionNumber ||
                            other.question ||
                            other.order ||
                            '',
                        source:
                            otherTrace.source ||
                            other.recognitionSource ||
                            other.source ||
                            '',
                        score: scoreCandidate(other, policy),
                        badChars: badCharCount(allCandidateText(other)),
                        optionCount: countMeaningfulOptions(other.options, policy),
                        stemHead: cleanText(other.stem || '', policy).slice(0, 100)
                    }
                ]
            };

            merged.warnings = [
                ...new Set([
                    ...(best.warnings || []),
                    ...(other.warnings || []),
                    '检测到重复题号，系统已合并候选并保留质量更高版本。'
                ])
            ];

            return merged;
        };

        const buildCandidateDiagnostics = (item = {}, policy = {}) => {
            const identity = getCandidateIdentity(item, policy);
            const allText = allCandidateText(item);

            return {
                id: item.id,
                q: item.questionNumber || item.question || item.order,
                sourceKey: identity.sourceKey,
                source:
                    item.sourceTrace?.source ||
                    item.recognitionSource ||
                    item.source ||
                    '',
                score: scoreCandidate(item, policy),
                optionCount: countMeaningfulOptions(item.options, policy),
                badChars: badCharCount(allText),
                latexSignals: latexSignalCount(allText),
                stemHead: cleanText(item.stem || '', policy).slice(0, 80)
            };
        };

        const rebindDraftImages = (images = [], gateResult = {}) => {
            const keptDraftIds = new Set(
                (gateResult.drafts || []).map(draft => draft.id).filter(Boolean)
            );
            const idMap = gateResult.idMap || new Map();
            const rows = [];

            for (const image of images || []) {
                if (!image) continue;

                const next = { ...image };
                if (next.questionId && idMap.has(next.questionId)) {
                    next.questionId = idMap.get(next.questionId);
                }
                if (next.questionId && !keptDraftIds.has(next.questionId)) {
                    continue;
                }
                rows.push(next);
            }

            return rows;
        };

        return {
            getCandidateIdentity,
            isMeaningfulOption,
            countMeaningfulOptions,
            scoreCandidate,
            rankCandidates,
            mergeCandidate,
            buildCandidateDiagnostics,
            rebindDraftImages
        };
    }
);
