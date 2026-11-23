(function initHandoutFormulaGate(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutFormulaGate = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    // 讲义/试卷导出前的公式门禁。
    //
    // 为什么要有它：现有打印路径在 KaTeX 抛错时只打一条 console.warn，然后
    // 把原文塞进红字继续导出（app.js renderLatexForPrint）。对老师来说这等于
    // 「印出来才发现第 7 题是一行红字」。本模块把这件事提前到导出之前，
    // 给出「哪一题、哪个字段、什么问题」，由调用方决定阻断还是放行。
    //
    // 不做的事：不改正公式、不猜意图、不吞掉问题。只报告。

    const TEXT_FIELDS = ['stem', 'answer', 'solution'];

    // 这些命令 KaTeX 会「编译通过但什么也不画」，是最危险的一类：
    // 屏幕上不报错，导出的 PDF 里就是一块空白。
    // 已实测（katex 0.16.47）：\includegraphics 不抛错、输出为空。
    const SILENT_EMPTY = [
        { pattern: /\\includegraphics\b/, reason: '图片引用在公式里不会渲染，导出后会缺图' },
        { pattern: /\\includeonly\b/, reason: '该命令不产生可见内容' }
    ];

    function resolveKatex(explicit) {
        if (explicit) return explicit;
        if (root && root.katex) return root.katex;
        if (typeof require === 'function') {
            try { return require('katex'); } catch (error) { return null; }
        }
        return null;
    }

    function resolveUtils(explicit) {
        if (explicit) return explicit;
        if (root && root.Qisi && root.Qisi.Utils) return root.Qisi.Utils;
        if (typeof require === 'function') {
            try { return require('./qisi-utils.js'); } catch (error) { return null; }
        }
        return null;
    }

    // 必须与 app.js 的 normalizeMathExpressionForPrint 保持一致：
    // 门禁如果比打印宽松，就会出现「门禁说没问题、打印却报错」。
    // tests/handout-formula-gate.test.js 锁住了这份行为。
    function normalizeForKatex(expression) {
        return String(expression || '')
            .replace(/\s*\n\s*/g, ' ')
            .replace(/\\(?:overparen|wideparen|overarc)\s*\{([^{}]+)\}/g, '\\overset{\\frown}{$1}')
            .replace(/\\(?:overparen|wideparen|overarc)\s*([A-Z]{1,4})(?=[^A-Za-z]|$)/g, '\\overset{\\frown}{$1}')
            .trim();
    }

    // Both the gate and the renderer consume this exact source. In particular,
    // bare LaTeX must be wrapped before either side tokenizes it.
    function preparePrintSource(value, explicitUtils) {
        const utils = resolveUtils(explicitUtils);
        if (!value) return '';
        const source = utils.normalizeLatexText(utils.normalizeBareLatexForDisplayText(value));
        const environment = /(?<!\$|\\\()\\begin\{(?:aligned|align\*?|equation\*?|cases|array|[pbBvV]?matrix)\}[\s\S]*?\\end\{(?:aligned|align\*?|equation\*?|cases|array|[pbBvV]?matrix)\}(?!\$|\\\))/g;
        return source.replace(environment, match => `$$${match}$$`);
    }

    function scanExpression(expression, segment, katex) {
        const blocking = [];
        const warnings = [];
        const raw = String(segment.raw || '');
        // 图片占位符由打印路径单独处理，不属于公式。
        if (/\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/.test(raw)) return { blocking, warnings };

        for (const rule of SILENT_EMPTY) {
            if (rule.pattern.test(expression)) blocking.push({ kind: 'silent-empty', message: rule.reason, raw });
        }
        if (blocking.length) return { blocking, warnings };

        const strictFindings = [];
        try {
            katex.renderToString(normalizeForKatex(expression), {
                displayMode: Boolean(segment.displayMode),
                throwOnError: true,
                trust: false,
                strict: (code, message) => {
                    strictFindings.push({ code, message });
                    return 'ignore';
                }
            });
        } catch (error) {
            blocking.push({
                kind: 'compile-error',
                message: String(error && error.message ? error.message : error),
                raw
            });
            return { blocking, warnings };
        }

        for (const finding of strictFindings) {
            warnings.push({ kind: 'renders-with-warning', code: finding.code, message: finding.message, raw });
        }
        return { blocking, warnings };
    }

    function checkField(target, field, value, context) {
        const parsed = context.utils.tokenizeLatexSource(preparePrintSource(value, context.utils));
        for (const issue of parsed.issues || []) {
            target.blocking.push({
                ...context.label,
                field,
                kind: issue.type === 'unclosed-math' ? 'unclosed-delimiter' : String(issue.type),
                message: '公式定界符没有配对（' + String(issue.openToken || '$') + ' 之后找不到结束符），整段会当成普通文字印出来',
                raw: String(issue.preview || '')
            });
        }
        for (const segment of parsed.segments || []) {
            if (segment.type !== 'math') continue;
            const result = scanExpression(segment.expression || '', segment, context.katex);
            for (const item of result.blocking) target.blocking.push({ ...context.label, field, ...item });
            for (const item of result.warnings) target.warnings.push({ ...context.label, field, ...item });
        }
    }

    /**
     * @param {Array} questions 形如 [{ id, stem, answer, solution, options: [] }]
     * @returns {{ ok, blocking, warnings, checked, katexUnavailable }}
     *   ok 为 true 表示可以安全导出；blocking 为空但 warnings 非空时仍可导出。
     */
    function check(questions, options = {}) {
        const katex = resolveKatex(options.katex);
        const utils = resolveUtils(options.utils);
        if (!katex || !utils || typeof utils.tokenizeLatexSource !== 'function') {
            return {
                ok: false,
                katexUnavailable: true,
                blocking: [{ kind: 'engine-unavailable', message: '公式引擎未加载，无法校验公式，已阻止导出。' }],
                warnings: [],
                checked: 0
            };
        }

        const blocking = [];
        const warnings = [];
        let checked = 0;
        const list = Array.isArray(questions) ? questions : [];

        list.forEach((question, index) => {
            const label = {
                questionId: question && question.id != null ? question.id : null,
                questionNo: question?.printLabel ? null : (question?.printQuestionNo ?? index + 1),
                ...(question?.printLabel ? { printLabel: question.printLabel } : {})
            };
            const target = { blocking, warnings };
            const context = { label, katex, utils };

            for (const field of TEXT_FIELDS.filter(field =>
                field === 'stem' || options[field === 'answer' ? 'includeAnswer' : 'includeSolution'] !== false)) {
                if (question && question[field] != null && String(question[field]).trim()) checked += 1;
                checkField(target, field, question && question[field], context);
            }

            const choices = Array.isArray(question && question.options) ? question.options : [];
            choices.forEach((option, optionIndex) => {
                if (option != null && String(option).trim()) checked += 1;
                checkField(target, 'option-' + String.fromCharCode(65 + optionIndex), option, context);
            });
        });

        return {
            ok: blocking.length === 0,
            katexUnavailable: false,
            blocking,
            warnings,
            checked
        };
    }

    // 把门禁结果压成老师能读的一句话，UI 直接显示，不必自己拼文案。
    function describe(result) {
        if (!result || result.ok) return '';
        const byQuestion = new Map();
        const contentLabels = new Set();
        for (const item of result.blocking) {
            if (item.printLabel) { contentLabels.add('「' + item.printLabel + '」'); continue; }
            const key = item.questionNo == null ? '?' : item.questionNo;
            if (!byQuestion.has(key)) byQuestion.set(key, []);
            byQuestion.get(key).push(item.field);
        }
        const numbers = [...byQuestion.keys()].sort((a, b) => Number(a) - Number(b));
        if (contentLabels.size) {
            const labels = [...contentLabels];
            if (numbers.length) labels.unshift('第 ' + numbers.join('、') + ' 题');
            return labels.join('、') + '的公式有 ' + result.blocking.length + ' 处问题，导出会印成红字或空白。';
        }
        return '第 ' + numbers.join('、') + ' 题的公式有 ' + result.blocking.length + ' 处问题，导出会印成红字或空白。';
    }

    // 导出前的唯一入口：返回 true 才允许往下走。
    // 没有确认框时一律返回 false（fail-closed），不让"悄悄导出"发生。
    function confirmBeforeExport(questions, options = {}) {
        const result = check(questions, options);
        if (result.ok) return true;
        const ask = options.confirm || (root && typeof root.confirm === 'function' ? root.confirm.bind(root) : null);
        if (typeof ask !== 'function') return false;
        const detail = result.blocking.slice(0, 6)
            .map(item => (item.printLabel || (item.questionNo ? '第 ' + item.questionNo + ' 题' : '校验')) + ' · ' + (item.field || '公式') + '：' + item.message)
            .join('\n');
        const more = result.blocking.length > 6 ? '\n……另有 ' + (result.blocking.length - 6) + ' 处' : '';
        return Boolean(ask(describe(result) + '\n\n' + detail + more +
            '\n\n点「取消」回去改题；点「确定」仍然导出（这些公式会显示成原文）。'));
    }

    return Object.freeze({ check, describe, confirmBeforeExport, normalizeForKatex, preparePrintSource });
});
