(function initHandoutHtml(root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutHtml = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // 讲义 HTML 生成器：纯字符串拼接，不碰 DOM，才能放进 node:test 里跑。
    //
    // 两条铁律：
    // 1. 本模块不调用 KaTeX。公式怎么渲染由调用方注入 renderLatex，这样
    //    浏览器里用 app.js 的 renderLatexForPrint，测试里用假的渲染器。
    // 2. renderLatex 的返回值是 HTML，绝不能再转义（否则公式变源码）；
    //    其余所有老师/题库文字（标题、班级、区块标题）一律过 escapeHtml。

    const DEFAULT_ANSWER_SPACE_MM = 24;
    const MAX_ANSWER_SPACE_MM = 120;
    const MIN_FONT_SIZE_PX = 10;
    const MAX_FONT_SIZE_PX = 24;

    const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    function escapeHtml(text) {
        return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]);
    }

    function toText(value) {
        return value == null ? '' : String(value);
    }

    // CSS 值只允许窄字符集：老师把 `}` 拼进设置里也不能造成串味。
    function cssValue(value, fallback, pattern) {
        const text = toText(value).trim();
        return text && pattern.test(text) ? text : fallback;
    }

    function normalizePage(page) {
        const source = page && typeof page === 'object' ? page : {};
        return {
            size: cssValue(source.size, 'A4', /^(?:[A-Za-z]{1,6}\d?|\d+(?:\.\d+)?mm\s+\d+(?:\.\d+)?mm)$/),
            margin: cssValue(
                source.margin,
                '18mm 16mm',
                /^\d+(?:\.\d+)?(?:mm|cm|in|pt|px)(?:\s+\d+(?:\.\d+)?(?:mm|cm|in|pt|px)){0,3}$/
            )
        };
    }

    function normalizeFontSize(value) {
        if (value === '五号') return 14;
        if (value === '小四') return 16;
        const size = Number(value);
        if (!Number.isFinite(size)) return 15;
        return Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, Math.round(size * 10) / 10));
    }

    function normalizeLineHeight(value) {
        const height = Number(value);
        if (!Number.isFinite(height)) return 1.8;
        return Math.min(2.4, Math.max(1.2, Math.round(height * 100) / 100));
    }

    function normalizeTheme(value) {
        return cssValue(value, '#1f6feb', /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/);
    }

    function normalizeFontFamily(value) {
        const text = toText(value).replace(/[;{}<>]/g, '').trim();
        return text || '"SimSun", "Songti SC", serif';
    }

    // 留白高度只有三种结局：原样、归零、夹到上限。绝不允许负数进 CSS。
    function resolveAnswerSpaceMm(raw, issues, label) {
        if (raw == null || raw === false) return 0;
        if (raw === true) return DEFAULT_ANSWER_SPACE_MM;

        let value = raw;
        if (typeof raw === 'object') {
            if (raw.show === false || raw.enabled === false) return 0;
            value = raw.heightMm == null ? DEFAULT_ANSWER_SPACE_MM : raw.heightMm;
        }

        const mm = Number(value);
        if (!Number.isFinite(mm)) {
            issues.push({ code: 'answer-space-invalid', detail: label + '留白高度不是数字，已按无留白处理。' });
            return 0;
        }
        if (mm < 0) {
            issues.push({ code: 'answer-space-invalid', detail: label + '留白高度不能是负数（' + mm + 'mm），已按无留白处理。' });
            return 0;
        }
        if (mm === 0) return 0;
        if (mm > MAX_ANSWER_SPACE_MM) {
            issues.push({
                code: 'answer-space-clamped',
                detail: label + '留白高度 ' + mm + 'mm 超出上限，已改为 ' + MAX_ANSWER_SPACE_MM + 'mm，否则一页只放得下一道题。'
            });
            return MAX_ANSWER_SPACE_MM;
        }
        return Math.round(mm * 10) / 10;
    }

    function buildStyle(page, font, themeColor) {
        const size = normalizeFontSize(font.size);
        const lineHeight = normalizeLineHeight(font.lineHeight);
        const family = normalizeFontFamily(font.family);
        const small = Math.round(size * 0.9);

        return [
            '<style>',
            '/* 讲义样式：全部限定在 .handout 内，避免和试卷打印样式互相覆盖 */',
            '.handout { font-family: ' + family + '; font-size: ' + size + 'px; line-height: ' + lineHeight + '; color: #111; }',
            '.handout-header { text-align: center; margin: 0 0 7mm; }',
            '.handout-title { font-size: ' + Math.round(size * 1.5) + 'px; font-weight: 700; letter-spacing: 1px; }',
            '.handout-subtitle { font-size: ' + Math.round(size * 0.95) + 'px; color: #333; margin-top: 2mm; }',
            '.handout-classname { font-size: ' + small + 'px; color: #333; margin-top: 1mm; }',
            '.handout-student-fields { display: flex; justify-content: center; gap: 12mm; margin-top: 3mm; font-size: ' + small + 'px; }',
            '.handout-student-fields span { display: inline-flex; align-items: flex-end; gap: 2mm; white-space: nowrap; }',
            '.handout-student-fields i { display: inline-block; width: 30mm; border-bottom: 1px solid #111; transform: translateY(-2px); }',
            '.handout-heading { font-size: ' + Math.round(size * 1.1) + 'px; font-weight: 700; margin: 6mm 0 3mm; padding-left: 2mm; border-left: 3px solid ' + themeColor + '; break-after: avoid; page-break-after: avoid; }',
            '.handout-note { margin: 0 0 3mm; }',
            '.handout-divider { border-top: 1px solid #d1d5db; margin: 5mm 0; }',
            '.handout-page-break { break-before: page; page-break-before: always; }',
            '.handout .exam-question { margin: 0 0 6mm; display: flow-root; break-inside: avoid; page-break-inside: avoid; }',
            '.handout .question-row { display: grid; grid-template-columns: 2.2em minmax(0, 1fr); align-items: start; }',
            '.handout .q-index { font-weight: 700; }',
            '.handout .question-flow-body { min-width: 0; overflow-wrap: break-word; }',
            // 选项选择器刻意写到 3 层：app.js 打印样式里有
            // `.question-flow-body .qisi-flow-options .gaokao-option` 同权重规则，
            // 这里必须压过它，否则讲义选项会退回试卷的 block 布局。
            '.handout .question-flow-body .gaokao-options { display: block; margin-top: 2mm; padding-left: 2.2em; }',
            '.handout .question-flow-body .gaokao-option { display: flex; align-items: flex-start; margin-bottom: 1mm; break-inside: avoid; page-break-inside: avoid; }',
            '.handout .question-flow-body .option-label { flex: none; width: 1.8em; margin-right: 0; font-weight: 700; }',
            '.handout .question-flow-body .option-content { flex: 1; min-width: 0; }',
            '.handout-answer-space { break-inside: avoid; page-break-inside: avoid; }',
            '.handout .print-answer, .handout .print-solution { margin-top: 2mm; padding: 1.5mm 2.5mm; border: 1px solid #e5e7eb; border-radius: 3px; font-size: ' + small + 'px; background: #f8fafc; }',
            '.handout .print-solution { background: #fff; }',
            '.handout .latex-render-error, .handout-render-fallback { color: #b91c1c; }',
            '.handout .missing-image { color: #b91c1c; font-size: 12px; }',
            '/* 打印窗口的 body 自带 24px 内边距，会和 @page 边距叠加，印出来四周太宽 */',
            '@media print { body { margin: 0; padding: 0; } }',
            '@page { size: ' + page.size + '; margin: ' + page.margin + '; }',
            '</style>'
        ].join('\n');
    }

    function createRenderer(options, escape, issues) {
        if (typeof options.renderLatex !== 'function') {
            throw new TypeError('buildHtml 需要 options.renderLatex(text, images) 渲染函数。');
        }

        // 渲染失败不抛给调用方：讲义其余部分还能印，问题进 issues 交给界面提示。
        // no 为 null 表示不属于某道题（老师写的文字段落），文案里不要拼「第 0 题」。
        return function render(value, images, field, no, fieldLabel) {
            const source = toText(value);
            if (!source.trim()) return '';

            const prefix = Number.isInteger(no) && no > 0 ? '第 ' + no + ' 题的' : '';

            let html;
            try {
                html = options.renderLatex(source, Array.isArray(images) ? images : []);
            } catch (error) {
                const message = error && error.message ? error.message : String(error);
                issues.push({
                    code: 'render-error',
                    questionNo: no == null ? null : no,
                    field,
                    detail: prefix + fieldLabel + '渲染失败：' + message + '，已按原文输出。'
                });
                return '<span class="handout-render-fallback">' + escape(source) + '</span>';
            }

            const output = toText(html);
            if (!output) {
                issues.push({
                    code: 'empty-render',
                    questionNo: no == null ? null : no,
                    field,
                    detail: prefix + fieldLabel + '渲染结果为空，请检查公式写法。'
                });
                return '';
            }
            return output;
        };
    }

    function buildOptions(question, render, no) {
        const type = toText(question && question.type);
        if (type !== '单选题' && type !== '多选题') return '';

        const options = Array.isArray(question && question.options) ? question.options : [];
        const images = Array.isArray(question && question.images) ? question.images : [];
        const rows = [];

        options.forEach((option, index) => {
            if (!toText(option).trim()) return;
            const label = String.fromCharCode(65 + index);
            rows.push(
                '<div class="gaokao-option">' +
                    '<span class="option-label">' + label + '.</span>' +
                    '<span class="option-content">' + render(option, images, 'option-' + label, no, '选项 ' + label) + '</span>' +
                '</div>'
            );
        });

        if (!rows.length) return '';
        return '<div class="gaokao-options qisi-flow-options">' + rows.join('') + '</div>';
    }

    function buildQuestion(block, question, expectedNo, context) {
        const { issues, render, escape, showAnswer, showSolution, defaultSpaceMm } = context;

        let displayNo = expectedNo;
        if (Number.isInteger(block.questionNo) && block.questionNo > 0) {
            displayNo = block.questionNo;
            if (displayNo !== expectedNo) {
                issues.push({
                    code: 'number-mismatch',
                    questionNo: displayNo,
                    detail: '第 ' + expectedNo + ' 个题目区块上写着题号 ' + displayNo +
                        '，和实际顺序不一致。重新编号后再导出。'
                });
            }
        }

        const images = Array.isArray(question && question.images) ? question.images : [];
        const stem = toText(question && question.stem);

        let body = '';
        if (!stem.trim()) {
            issues.push({
                code: 'empty-stem',
                questionNo: displayNo,
                detail: '第 ' + displayNo + ' 题的题干是空的，印出来只剩一个题号。'
            });
        } else {
            body += render(stem, images, 'stem', displayNo, '题干');
        }
        body += buildOptions(question, render, displayNo);

        const spaceMm = block.answerSpaceMm != null
            ? resolveAnswerSpaceMm(block.answerSpaceMm, issues, '第 ' + displayNo + ' 题')
            : defaultSpaceMm;

        let html = '<div class="exam-question" data-question-id="' + escape(toText(question && question.id)) +
            '" style="break-inside:avoid;page-break-inside:avoid">' +
            '<div class="question-row"><span class="q-index">' + displayNo + '.</span>' +
            '<div class="question-flow-body">' + body + '</div></div>';

        if (spaceMm > 0) {
            html += '<div class="handout-answer-space" style="height:' + spaceMm +
                'mm;break-inside:avoid;page-break-inside:avoid"></div>';
        }

        if (showAnswer && toText(question && question.answer).trim()) {
            html += '<div class="print-answer"><b>答案：</b>' +
                render(question.answer, images, 'answer', displayNo, '答案') + '</div>';
        }
        if (showSolution && toText(question && question.solution).trim()) {
            html += '<div class="print-solution"><b>解析：</b>' +
                render(question.solution, images, 'solution', displayNo, '解析') + '</div>';
        }

        return html + '</div>';
    }

    /**
     * 把讲义文档拼成可打印的 HTML 片段（不含 <html>/<body>）。
     * @param {object} doc createDoc 的产物
     * @param {Array} questions 题库题目
     * @param {{ renderLatex: Function, escapeHtml?: Function,
     *           answerSpace?: boolean|number|{show?:boolean,heightMm?:number},
     *           page?: {size?: string, margin?: string},
     *           font?: {family?: string, size?: string|number, lineHeight?: number},
     *           themeColor?: string, studentFields?: boolean }} options
     * @returns {{ html: string, issues: Array<{ code: string, detail: string }> }}
     */
    function buildHtml(doc, questions, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const escape = typeof settings.escapeHtml === 'function' ? settings.escapeHtml : escapeHtml;
        const issues = [];
        const render = createRenderer(settings, escape, issues);

        const blocks = doc && Array.isArray(doc.blocks) ? doc.blocks : [];
        const questionList = Array.isArray(questions) ? questions : [];
        const byId = new Map();
        questionList.forEach(question => {
            if (!question || question.id == null) return;
            const key = String(question.id);
            if (!byId.has(key)) byId.set(key, question);
        });

        const page = normalizePage(settings.page);
        const font = settings.font && typeof settings.font === 'object' ? settings.font : {};
        const themeColor = normalizeTheme(settings.themeColor);
        const showAnswer = Boolean(doc && doc.showAnswer);
        const showSolution = Boolean(doc && doc.showSolution);

        if (!blocks.some(block => block && block.type === 'question')) {
            issues.push({
                code: 'empty-doc',
                detail: blocks.length ? '讲义里还没有题目，只有文字区块。' : '讲义是空的，先往里面加题或加一段文字。'
            });
        }

        const title = toText(doc && doc.title);
        const subtitle = toText(doc && doc.subtitle);
        const className = toText(doc && doc.className);

        const header = '<div class="handout-header">' +
            (title.trim() ? '<div class="handout-title">' + escape(title) + '</div>' : '') +
            (subtitle.trim() ? '<div class="handout-subtitle">' + escape(subtitle) + '</div>' : '') +
            (className.trim() ? '<div class="handout-classname">' + escape(className) + '</div>' : '') +
            (settings.studentFields === true
                ? '<div class="handout-student-fields"><span>班级<i></i></span><span>姓名<i></i></span><span>日期<i></i></span></div>'
                : '') +
            '</div>';

        let body = '';
        let questionNo = 0;
        // 全局留白只解析一次，否则高度非法时同一句提示会重复 N 遍。
        const defaultSpaceMm = resolveAnswerSpaceMm(settings.answerSpace, issues, '每题');

        blocks.forEach((block, blockIndex) => {
            if (!block || typeof block !== 'object') return;

            if (block.type === 'heading') {
                body += '<h3 class="handout-heading">' + escape(toText(block.text)) + '</h3>';
                return;
            }

            if (block.type === 'note') {
                const note = toText(block.text);
                if (!note.trim()) return;
                body += '<div class="handout-note">' + render(note, [], 'note', null, '文字段落') + '</div>';
                return;
            }

            if (block.type === 'divider') {
                body += block.pageBreak
                    ? '<div class="handout-page-break" aria-hidden="true"></div>'
                    : '<div class="handout-divider" role="separator"></div>';
                return;
            }

            if (block.type === 'question') {
                questionNo += 1;
                const key = block.questionId == null ? '' : String(block.questionId);
                const question = byId.get(key);

                if (!question) {
                    issues.push({
                        code: 'missing-question',
                        questionNo,
                        detail: '第 ' + questionNo + ' 题引用的题目不存在（questionId：' + (key || '空') + '），已跳过。'
                    });
                    return;
                }

                body += buildQuestion(block, question, questionNo, {
                    issues,
                    render,
                    escape,
                    showAnswer,
                    showSolution,
                    defaultSpaceMm
                });
                return;
            }

            issues.push({
                code: 'unknown-block',
                detail: '第 ' + (blockIndex + 1) + ' 个区块的类型「' + toText(block.type) + '」不认识，已跳过。'
            });
        });

        return {
            html: buildStyle(page, font, themeColor) + '\n<div class="handout">' + header + body + '</div>',
            issues
        };
    }

    return Object.freeze({ buildHtml, escapeHtml });
});
