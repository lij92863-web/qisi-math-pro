(function initExamPaperParts(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ExamPaperParts = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Paper document fragments: header fields, answer grid, notice and the answer
    // section. They return strings only; the page owns the window and the renderer.
    const HEADER_FIELDS = Object.freeze({
        examZh: ['班级', '姓名', '考号'],
        default: ['班别', '姓名', '评分']
    });
    const NOTICE_EXAM_ZH = `<div class="notice exam-notice"><b>注意事项：</b>
                            <ol>
                                <li>答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。</li>
                                <li>回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，用橡皮擦干净后，再选涂其它答案标号。回答非选择题时，将答案写在答题卡上。写在本试卷上无效。</li>
                                <li>考试结束后，将本试卷和答题卡一并交回。</li>
                            </ol>
                        </div>`;
    const NOTICE_DEFAULT = '<div class="notice">注意事项：请将答案填写在指定位置，保持卷面整洁。</div>';

    const buildHeaderFields = ({ show, template } = {}) => {
        if (!show) return '';
        const fields = template === 'examZh' ? HEADER_FIELDS.examZh : HEADER_FIELDS.default;
        return `<div class="student-fields">${fields.map(label => `<span>${label}<i></i></span>`).join('')}</div>`;
    };

    const buildAnswerGrid = ({ show, count, config = {} } = {}) => {
        if (!show) return '';
        const total = Math.max(1, Math.min(Number(config.answerGridCount || count || 0), 20));
        const nums = Array.from({ length: total }, (_, idx) => idx + 1);
        const lineStart = Math.max(1, Number(config.answerLineStart || total + 1));
        const lineCount = Math.max(0, Math.min(Number(config.answerLineCount || 0), 10));
        const blanks = Array.from({ length: lineCount }, (_, idx) => lineStart + idx);
        return `<div class="answer-grid-wrap">
                        <table class="answer-grid">
                            <tr><th>题号</th>${nums.map(n => `<td>${n}</td>`).join('')}</tr>
                            <tr><th>答案</th>${nums.map(() => '<td></td>').join('')}</tr>
                        </table>
                        <div class="answer-lines">${blanks.map(n => `<span>${n}.<i></i></span>`).join('')}</div>
                    </div>`;
    };

    const buildNotice = ({ show, template } = {}) => {
        if (!show) return '';
        return template === 'examZh' ? NOTICE_EXAM_ZH : NOTICE_DEFAULT;
    };

    const buildAnswerContent = ({ questions, forceNewPage = true, render } = {}) => {
        if (typeof render !== 'function') {
            const error = new Error('EXAM_PAPER_RENDER_REQUIRED');
            error.code = 'EXAM_PAPER_RENDER_REQUIRED';
            throw error;
        }
        let content = `<div class="answer-section ${forceNewPage ? 'new-page' : ''}"><h2>参考答案与解析</h2>`;
        (Array.isArray(questions) ? questions : []).forEach((question, index) => {
            content += `<div class="answer-item"><b>${index + 1}.</b> ${question.answer
                ? render(question.answer, question.images || [])
                : '________'}`;
            if (question.solution) {
                content += `<div class="answer-solution">${render(question.solution, question.images || [])}</div>`;
            }
            content += `</div>`;
        });
        return content + `</div>`;
    };

    return Object.freeze({
        HEADER_FIELDS, NOTICE_EXAM_ZH, NOTICE_DEFAULT,
        buildHeaderFields, buildAnswerGrid, buildNotice, buildAnswerContent
    });
});
