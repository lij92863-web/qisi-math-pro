(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.ExamPrintRenderer = api;

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

        const escapeHtml = text => String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const buildHeaderFields = config => {
            if (!config.showHeaderFields) return '';
            const fields = ['班别', '姓名', '评分'];
            return `<div class="student-fields">${fields.map(label => `<span>${label}<i></i></span>`).join('')}</div>`;
        };

        const buildAnswerGrid = (count, config) => {
            if (!config.showAnswerGrid) return '';
            const total = Math.max(
                1,
                Math.min(Number(config.answerGridCount || count || 0), 20)
            );
            const nums = Array.from({ length: total }, (_, index) => index + 1);
            const lineStart = Math.max(
                1,
                Number(config.answerLineStart || total + 1)
            );
            const lineCount = Math.max(
                0,
                Math.min(Number(config.answerLineCount || 0), 10)
            );
            const blanks = Array.from(
                { length: lineCount },
                (_, index) => lineStart + index
            );
            return `<div class="answer-grid-wrap">
                        <table class="answer-grid">
                            <tr><th>题号</th>${nums.map(number => `<td>${number}</td>`).join('')}</tr>
                            <tr><th>答案</th>${nums.map(() => '<td></td>').join('')}</tr>
                        </table>
                        <div class="answer-lines">${blanks.map(number => `<span>${number}.<i></i></span>`).join('')}</div>
                    </div>`;
        };

        const buildNotice = config => {
            if (!config.showNotice) return '';
            return '<div class="notice">注意事项：请将答案填写在指定位置，保持卷面整洁。</div>';
        };

        const buildAnswerContent = (
            questions,
            forceNewPage = true,
            dependencies
        ) => {
            const { renderLatex } = dependencies;
            let content = `<div class="answer-section ${forceNewPage ? 'new-page' : ''}"><h2>参考答案与解析</h2>`;
            questions.forEach((question, index) => {
                content += `<div class="answer-item"><b>${index + 1}.</b> ${question.answer ? renderLatex(question.answer, question.images || []) : '________'}`;
                if (question.solution) {
                    content += `<div class="answer-solution">${renderLatex(question.solution, question.images || [])}</div>`;
                }
                content += '</div>';
            });
            return content + '</div>';
        };

        const buildPrintOptionsHtml = (question, dependencies) => {
            const { renderLatex, resolveOptionColumns } = dependencies;
            if (!(question.type === '单选题' || question.type === '多选题')) {
                return '';
            }

            if (
                !Array.isArray(question.options) ||
                !question.options.some(option => String(option || '').trim())
            ) {
                return '';
            }

            const rows = question.options
                .map((option, index) => {
                    if (!String(option || '').trim()) return '';

                    return (
                        '<div class="gaokao-option">' +
                            '<span class="option-label">' +
                                String.fromCharCode(65 + index) +
                                '.' +
                            '</span>' +
                            '<span class="option-content">' +
                                renderLatex(option, question.images || []) +
                            '</span>' +
                        '</div>'
                    );
                })
                .join('');

            const columns = Number(question.layout?.optionColumns) || (
                resolveOptionColumns
                    ? resolveOptionColumns({ options: question.options || [] })
                    : 4
            );
            return `<div class="gaokao-options qisi-flow-options" style="--qisi-option-columns:${columns}">` + rows + '</div>';
        };

        const buildQuestionContent = (questions, dependencies) => {
            const {
                config,
                fallbackTitle,
                questionMeta,
                sectionNumbers,
                getGroups,
                formatGroupSummary,
                renderLatex,
                resolveOptionColumns
            } = dependencies;
            const groups = getGroups(questions);
            let content = `<main><div class="header">
                        <div class="title">${escapeHtml(config.title || fallbackTitle)}</div>
                        ${config.subtitle ? `<div class="subtitle">${escapeHtml(config.subtitle)}</div>` : ''}
                        ${config.organizer ? `<div class="organizer">组卷人：${escapeHtml(config.organizer)}</div>` : ''}
                        ${buildHeaderFields(config)}
                        ${buildAnswerGrid(questions.length, config)}
                        ${buildNotice(config)}
                    </div>`;

            let printIndex = 1;
            groups.forEach((group, groupIndex) => {
                const sectionNumber = sectionNumbers[groupIndex] || String(groupIndex + 1);
                content += `<div class="group-title">${sectionNumber}、${escapeHtml(formatGroupSummary(group))}</div>`;
                group.items.forEach(question => {
                    const meta = questionMeta[question.id] || {};
                    const safeStem = renderLatex(question.stem, question.images || []);
                    const optionsHtml = buildPrintOptionsHtml(question, {
                        renderLatex,
                        resolveOptionColumns
                    });

                    content += `<div class="exam-question">
                                <div class="question-row"><span class="q-index">${printIndex}.</span><div class="question-flow-body">${safeStem}${optionsHtml}</div></div>`;
                    if (meta.note) {
                        content += `<div class="q-note">${escapeHtml(meta.note)}</div>`;
                    }
                    if (config.showAnswer && question.answer) {
                        content += `<div class="print-answer"><b>答案：</b>${renderLatex(question.answer, question.images || [])}</div>`;
                    }
                    if (config.showSolution && question.solution) {
                        content += `<div class="print-solution"><b>解析：</b>${renderLatex(question.solution, question.images || [])}</div>`;
                    }
                    content += '</div>';
                    printIndex += 1;
                });
            });
            return content + '</main>';
        };

        return {
            buildAnswerContent,
            buildAnswerGrid,
            buildHeaderFields,
            buildNotice,
            buildPrintOptionsHtml,
            buildQuestionContent
        };
    }
);
