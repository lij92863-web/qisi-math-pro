(function initQuestionContentPolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.QuestionContentPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createQuestionContentPolicy(ports = {}) {
        for (const name of [
            'recognizeFormulaText',
            'blockImageToken',
            'getDefaultType'
        ]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Question content policy requires ${name}.`
                );
                error.code = 'QUESTION_CONTENT_POLICY_PORT_REQUIRED';
                throw error;
            }
        }

        const recognizeFormulaText = ports.recognizeFormulaText;
        const BLOCK_IMAGE_TOKEN = ports.blockImageToken;
        const getDefaultType = ports.getDefaultType;

        const cleanDisplayTextForBatchSave = (text) =>
            root.Qisi.Utils.cleanDisplayTextForBatchSave(text);

        const cleanDisplayOptionsForBatchSave = (options) =>
            root.Qisi.Utils.cleanDisplayOptionsForBatchSave(options);

        const cleanDisplayFieldsOnly = (q) =>
            root.Qisi.Utils.cleanDisplayFieldsOnly(q);

        const addWarningOnce = (q, message) =>
            root.Qisi.Utils.addWarningOnce(q, message);

        const optionTextHasContent = (value = '') => {
            const text = root.Qisi.Utils.cleanDisplayTextForBatchSave(value);
            if (!text) return false;
            if (root.Qisi.Utils.hasBatchMediaToken(text)) return true;

            const compact = text
                .replace(/^[\s　]*[（(]?\s*[A-DＡ-Ｄ]\s*[\.\．、:：\)）]?\s*/i, '')
                .replace(/[.\s、，。:：；;()（）]/g, '')
                .trim();

            if (!compact) return false;
            if (/^[A-D]$/i.test(compact)) return false;

            return true;
        };

        const countValidOptions = (options) => {
            if (!Array.isArray(options)) return 0;
            return root.Qisi.Utils.cleanDisplayOptionsForBatchSave(options).filter(optionTextHasContent).length;
        };

        const isChoiceDraft = (q) => {
            return q?.type === '单选题' || q?.type === '多选题';
        };

        const choiceQuestionMissingOptions = (q) => {
            if (!isChoiceDraft(q)) return false;
            return countValidOptions(q.options) < 4;
        };

        const recognizeFormulaImageToLatex = async (imageUrl) => {
            if (!imageUrl) return '';
            try {
                const text = await recognizeFormulaText(imageUrl);
                return root.Qisi.Utils.cleanFormulaOcrText(text);
            } catch (error) {
                if (
                    error?.name === 'AbortError' ||
                    error?.code === 'OCR_REQUEST_CANCELLED' ||
                    root.Qisi.Utils.isFatalQwenServiceError(error)
                ) {
                    throw error;
                }
                console.warn('公式图片 OCR 失败，保留为图片 token，不删除。', error);
                return '';
            }
        };

        const resolveFormulaImageTokens = async (text, imageRefs = []) => {
            let source = String(text || '');
            const refs = new Map((imageRefs || []).map(img => [img.id, img]));

            const formulaMatches = [...source.matchAll(/\[\[FORMULA_IMAGE:([^\]]+)\]\]/g)];

            for (const match of formulaMatches) {
                const id = match[1];
                const img = refs.get(id);

                const latex = img?.url ? await recognizeFormulaImageToLatex(img.url) : '';

                // OCR 成功：写 LaTeX；OCR 失败：降级为普通图片 token，不能删。
                const fallbackImageToken = img?.id ? BLOCK_IMAGE_TOKEN(img.id) : match[0];

                source = source.replace(match[0], latex || fallbackImageToken);
            }

            return root.Qisi.Utils.cleanDisplayTextForBatchSave(source);
        };

        const normalizeMathTextForLatex = (value) => {
            const raw = root.Qisi.Utils.cleanRecognizedText(value);
            if (!raw) return '';
            const superscriptMap = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
            const normalizeSymbols = (text) => text
                .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, m => `^{${[...m].map(ch => superscriptMap[ch] || ch).join('')}}`)
                .replace(/△\s*([A-Z]{2,4})/g, '\\triangle $1')
                .replace(/∠\s*([A-Z]{1,3})/g, '\\angle $1')
                .replace(/π/g, '\\pi')
                .replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}')
                .replace(/≤/g, '\\le ')
                .replace(/≥/g, '\\ge ')
                .replace(/≠/g, '\\ne ')
                .replace(/⊂/g, '\\subset ')
                .replace(/⊆/g, '\\subseteq ')
                .replace(/∈/g, '\\in ')
                .replace(/∩/g, '\\cap ')
                .replace(/∪/g, '\\cup ')
                .replace(/→/g, '\\to ');
            const mathRun = /(?:\\(?:triangle|angle|vec|overline)\s*(?:\{[^{}\n]+\}|[A-Z]{1,4}))|(?:\\(?:d?frac)\s*\{[^{}\n]+\}\s*\{[^{}\n]+\})|(?:\\sqrt(?:\[[^\]\n]+\])?\s*\{[^{}\n]+\})|(?:\\(?:sin|cos|tan|ln|log|alpha|beta|gamma|theta|lambda|mu|pi|le|ge|ne|subset|subseteq|in|cap|cup|to|cdot|times|parallel|perp)(?![A-Za-z]))|(?:[A-Za-z]{1,4}\s*[=<>+\-]\s*[A-Za-z0-9{}\\^_+\-*/().]+)/g;
            const { protectedText, chunks, issues } = protectLatexMathSegments(raw);
            if (issues.length) {
                console.warn('[LATEX_NORMALIZE][delimiter-issues]', { raw, issues });
            }
            let text = protectedText;
            text = normalizeSymbols(text);
            text = text.replace(mathRun, (match, offset, all) => {
                const clean = match.trim();
                if (!clean || /@@QISI_MATH_SEGMENT_\d+@@/.test(clean)) return match;
                const before = all[offset - 1] || '';
                const after = all[offset + match.length] || '';
                if (before === '$' || after === '$') return match;
                if (/^[A-D]$/.test(clean)) return match;
                return `$${clean}$`;
            });
            return restoreLatexMathSegments(text, chunks);
        };

        const repairCommonLatexOcrErrors = (value) => {
            if (!value && value !== 0) return '';
            return String(value)
                .replace(/(?<!\\)\bSangle\b/g, '\\angle')
                .replace(/(?<!\\)\btheta\b/g, '\\theta')
                .replace(/(?<!\\)\balpha\b/g, '\\alpha')
                .replace(/(?<!\\)\bbeta\b/g, '\\beta')
                .replace(/(?<!\\)\bgamma\b/g, '\\gamma')
                .replace(/(?<!\\)\bpi\b/g, '\\pi');
        };

        const normalizeMathTextForLatexSafe = (value) => normalizeMathTextForLatex(repairCommonLatexOcrErrors(value));

        const stripLeadingOptionLabel = (value) => root.Qisi.Utils.cleanRecognizedText(value)
            .replace(/^[\s　]*[（(]?\s*([A-DＡ-Ｄ])\s*[\.\．、:：\)）]\s*/i, '')
            .trim();

        const normalizeRecognizedOptions = (options) => {
            const direct = Array.isArray(options)
                ? options.map(opt => {
                    if (opt && typeof opt === 'object') {
                        return opt.text ?? opt.content ?? opt.value ?? opt.option ?? '';
                    }
                    return opt;
                })
                : (options && typeof options === 'object'
                    ? ['A', 'B', 'C', 'D'].map(key => {
                        const item = options[key] ?? options[key.toLowerCase()] ?? options[`选项${key}`] ?? '';
                        if (item && typeof item === 'object') {
                            return item.text ?? item.content ?? item.value ?? item.option ?? '';
                        }
                        return item;
                    })
                    : []);

            return [0, 1, 2, 3].map(idx => stripLeadingOptionLabel(direct[idx] || ''));
        };

        const optionLooksLikeLabelResidue = (value) => {
            const text = root.Qisi.Utils.cleanRecognizedText(value)
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[.\s、，。:：；;()（）]/g, '')
                .toUpperCase();
            return /^[A-D]$/.test(text);
        };

        const optionHasSubstance = (value) => {
            const text = stripLeadingOptionLabel(value);
            if (!text) return false;

            if (optionLooksLikeLabelResidue(text)) return false;

            if (/\\|[_^=<>]|[\u4e00-\u9fa5]|\d|[{}()[\]（）]|⊂|⊆|∈|∩|∪|∅|√|π|∞|≤|≥|≠|∵|∴/.test(text)) {
                return true;
            }

            if (/^[A-Za-z]$/.test(text) && !/^[A-D]$/i.test(text)) return true;

            return text.replace(/\s+/g, '').length >= 1;
        };

        const sanitizeChoiceOptions = (options) => normalizeRecognizedOptions(options)
            .map(opt => optionHasSubstance(opt) ? normalizeMathTextForLatexSafe(opt) : '');

        const solutionLooksFormulaPoor = (stem = '', solution = '') => {
            const cleanStem = root.Qisi.Utils.cleanRecognizedText(stem);
            const cleanSolution = root.Qisi.Utils.cleanRecognizedText(solution);

            if (!cleanSolution) return true;

            const stemSignal = root.Qisi.Utils.mathSignalCount(cleanStem);
            const solutionSignal = root.Qisi.Utils.mathSignalCount(cleanSolution);

            // 题干数学信号明显，但解析完全没有数学信号，基本就是被普通文字化了。
            if (stemSignal >= 2 && solutionSignal === 0) return true;

            // 解析中有“所以、得、故选、因为”，但没有任何等式或 LaTeX，也很可疑。
            if (/因为|所以|可得|解得|故选|故/.test(cleanSolution) && solutionSignal === 0 && /[A-D]|[0-9]/.test(cleanStem)) {
                return true;
            }

            return false;
        };

        const preferFormulaRichSolution = (candidate = '', existing = '', stem = '') => {
            const next = root.Qisi.Utils.cleanDisplayTextForBatchSave(candidate);
            const old = root.Qisi.Utils.cleanDisplayTextForBatchSave(existing);

            if (!next) return old;
            if (!old) return next;

            const nextSignal = root.Qisi.Utils.mathSignalCount(next);
            const oldSignal = root.Qisi.Utils.mathSignalCount(old);

            if (nextSignal > oldSignal) return next;

            // 禁止用无公式长中文覆盖已有公式解析。
            if (oldSignal > 0 && nextSignal === 0) return old;

            // 如果题干数学信号很强，而新解析没有公式，不覆盖。
            if (root.Qisi.Utils.mathSignalCount(stem) >= 2 && nextSignal === 0) return old;

            // 同等公式密度时，才允许更长版本覆盖。
            if (nextSignal === oldSignal && next.length > old.length * 1.15) return next;

            return old;
        };

        const hasChoiceLabelSignal = (text = '') => {
            const source = root.Qisi.Utils.cleanRecognizedText(text)
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));

            return /(?:^|[\n\r\s　])A\s*[\.\．、:：\)）]/.test(source) &&
                /(?:^|[\n\r\s　])B\s*[\.\．、:：\)）]/.test(source);
        };

        const stripQuestionSectionNoise = (text) => root.Qisi.Utils.cleanRecognizedText(text)
            .replace(/\[\[TYPE:[^\]]+\]\]/g, '\n')
            .replace(/(?:^|\n|\s)(?:[一二三四五六七八九十]+[、.．]\s*)?(?:单项选择题|单选题|多项选择题|多选题|填空题|解答题|证明题)\s*[：:]?[^0-9\n]{0,90}(?=\n|$)/g, '\n')
            .replace(/(?:本题|本大题|本小题)[^。\n]{0,120}(?:分|分。|。)?/g, '')
            .replace(/全部选对[^。\n]{0,80}(?:分|分。|。)?/g, '')
            .replace(/部分选对[^。\n]{0,80}(?:分|分。|。)?/g, '')
            .replace(/有选错[^。\n]{0,80}(?:分|分。|。)?/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const choiceRepairDeps = {
            sanitizeChoiceOptions,
            normalizeMathTextForLatexSafe,
            stripQuestionSectionNoise,
            splitQuestionForStorage
        };

        const normalizeQuestionType = (rawType, stem = '', options = [], answer = '', fallback = '') => {
            const raw = root.Qisi.Utils.cleanRecognizedText(rawType);
            const sourceStem = root.Qisi.Utils.cleanRecognizedText(stem);
            const haystack = `${raw}\n${sourceStem}`;

            const optionCount = (options || []).filter(opt => root.Qisi.Utils.cleanRecognizedText(opt)).length;
            const ans = root.Qisi.Utils.cleanRecognizedText(answer)
                .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/[.\s、，。:：；;()（）]/g, '')
                .toUpperCase();

            const answerLooksChoice = /^[A-D]{1,4}$/.test(ans);
            const stemHasChoiceBlank = /[（(]\s*[）)]/.test(sourceStem);
            const stemHasOptionLabels =
                /(?:^|[\n\r\s　])A\s*[\.\．、:：\)）]/.test(sourceStem) &&
                /(?:^|[\n\r\s　])B\s*[\.\．、:：\)）]/.test(sourceStem);

            const choiceLanguageSignal = /下列|正确的是|错误的是|故选|选项|单项选择|单选|多项选择|多选|全部选对|部分选对|有选错/.test(haystack);

            if (/多项选择|多选/.test(haystack) || /全部选对|部分选对|有选错|有多项符合/.test(haystack)) {
                return '多选题';
            }

            if (/单项选择|单选/.test(haystack)) {
                return '单选题';
            }

            if (optionCount >= 2 && answerLooksChoice && ans.length >= 2) {
                return '多选题';
            }

            if (optionCount >= 2) {
                return '单选题';
            }

            // 关键：答案是 A/B/C/D，且题干有选择题特征时，不能继续归成“解答题”。
            if (answerLooksChoice && (stemHasChoiceBlank || stemHasOptionLabels || choiceLanguageSignal)) {
                return ans.length >= 2 ? '多选题' : '单选题';
            }

            if (/填空/.test(haystack)) {
                return '填空题';
            }

            if (/证明/.test(haystack)) {
                return '证明题';
            }

            if (/解答/.test(haystack)) {
                return '解答题';
            }

            if (/_{2,}|（\s*）|\(\s*\)/.test(sourceStem) && root.Qisi.Utils.cleanRecognizedText(answer) && root.Qisi.Utils.cleanRecognizedText(answer).length <= 30) {
                return '填空题';
            }

            return fallback || getDefaultType() || '解答题';
        };

        const normalizeQuestionKey = (value) => {
            const text = String(value || '')
                .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
                .replace(/第|题|[.．、:：\s]/g, '')
                .trim();

            const num = text.match(/\d{1,3}/)?.[0] || '';
            return num ? String(Number(num)) : '';
        };

        const choiceOptionIssue = (type, options, answer = '') => {
            if (!['单选题', '多选题'].includes(type)) return '';
            const cleanOptions = sanitizeChoiceOptions(options);
            const optionCount = cleanOptions.filter(Boolean).length;
            if (optionCount < 4) return '选择题选项未识别完整，请补全 A/B/C/D。';
            const letters = [...new Set(root.Qisi.Utils.cleanRecognizedText(answer).replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248)).toUpperCase().match(/[A-D]/g) || [])];
            const missingLetters = letters.filter(letter => !cleanOptions[letter.charCodeAt(0) - 65]);
            if (missingLetters.length) return `答案包含 ${missingLetters.join('、')}，但对应选项未识别，请先补全选项。`;
            return '';
        };


        return Object.freeze({
            cleanDisplayTextForBatchSave,
            cleanDisplayOptionsForBatchSave,
            cleanDisplayFieldsOnly,
            addWarningOnce,
            countValidOptions,
            isChoiceDraft,
            choiceQuestionMissingOptions,
            resolveFormulaImageTokens,
            normalizeMathTextForLatex,
            normalizeMathTextForLatexSafe,
            repairCommonLatexOcrErrors,
            normalizeRecognizedOptions,
            sanitizeChoiceOptions,
            solutionLooksFormulaPoor,
            preferFormulaRichSolution,
            hasChoiceLabelSignal,
            stripQuestionSectionNoise,
            choiceRepairDeps,
            normalizeQuestionType,
            normalizeQuestionKey,
            choiceOptionIssue
        });
    }

    return Object.freeze({ createQuestionContentPolicy });
});
