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

        const isChoiceQuestion = question => question?.type === '单选题' || question?.type === '多选题';
        const isFillQuestion = question => question?.type === '填空题';

        const buildAdaptiveAnswerNumbers = questions => ({
            boxed: questions
                .map((question, index) => ({ question, number: index + 1 }))
                .filter(item => isChoiceQuestion(item.question))
                .map(item => item.number),
            lined: questions
                .map((question, index) => ({ question, number: index + 1 }))
                .filter(item => isFillQuestion(item.question))
                .map(item => item.number)
        });

        const chunkNumbers = (numbers, size) => {
            const chunks = [];
            for (let offset = 0; offset < numbers.length; offset += size) {
                chunks.push(numbers.slice(offset, offset + size));
            }
            return chunks;
        };

        const buildAnswerTable = numbers => {
            const isReferenceNine = numbers.length === 9;
            const flexibleWidth = ((150.32 - 14.38) / Math.max(1, numbers.length)).toFixed(3);
            const columns = numbers.map((_, index) => {
                if (isReferenceNine) {
                    return `<col class="${index < 6 ? 'answer-grid-short' : 'answer-grid-long'}">`;
                }
                return `<col style="width:${flexibleWidth}mm">`;
            }).join('');
            return `<table class="answer-grid">
                            <colgroup><col class="answer-grid-label">${columns}</colgroup>
                            <tr><th>题号</th>${numbers.map(number => `<td>${number}</td>`).join('')}</tr>
                            <tr><th>答案</th>${numbers.map(() => '<td></td>').join('')}</tr>
                        </table>`;
        };

        const buildAnswerGrid = (questionsOrCount, config) => {
            if (!config.showAnswerGrid) return '';
            const questions = Array.isArray(questionsOrCount) ? questionsOrCount : null;
            const adaptive = questions && config.answerGridMode === 'adaptive-by-type';
            const legacyCount = questions ? questions.length : questionsOrCount;
            const total = Math.max(1, Math.min(Number(config.answerGridCount || legacyCount || 0), 20));
            const adaptiveNumbers = adaptive ? buildAdaptiveAnswerNumbers(questions) : null;
            const nums = adaptiveNumbers
                ? adaptiveNumbers.boxed
                : Array.from({ length: total }, (_, index) => index + 1);
            const lineStart = Math.max(
                1,
                Number(config.answerLineStart || total + 1)
            );
            const lineCount = Math.max(
                0,
                Math.min(Number(config.answerLineCount || 0), 10)
            );
            const blanks = adaptiveNumbers
                ? adaptiveNumbers.lined
                : Array.from({ length: lineCount }, (_, index) => lineStart + index);
            if (adaptive && !nums.length && !blanks.length) return '';
            const table = (nums.length || !adaptive)
                ? (adaptive ? chunkNumbers(nums, 9).map(buildAnswerTable).join('') : buildAnswerTable(nums))
                : '';
            return `<div class="answer-grid-wrap">
                        ${table}
                        <div class="answer-lines">${blanks.map(number => `<span>${number}.<i></i></span>`).join('')}</div>
                    </div>`;
        };

        const buildAnswerSummaryGridFromRows = rows => {
            const groups = [];
            for (let offset = 0; offset < rows.length; offset += 10) {
                const chunk = rows.slice(offset, offset + 10);
                const padded = Array.from({ length: 10 }, (_, index) => chunk[index] || null);
                groups.push(`<div class="answer-summary-grid-wrap"><table class="answer-summary-grid">
                    <colgroup><col class="answer-summary-label">${padded.map(() => '<col class="answer-summary-cell">').join('')}</colgroup>
                    <tr><th>题号</th>${padded.map(row => `<td>${row ? row.number : ''}</td>`).join('')}</tr>
                    <tr><th>答案</th>${padded.map(row => `<td>${row ? row.answerHtml : ''}</td>`).join('')}</tr>
                </table></div>`);
            }
            return groups.join('');
        };

        const prepareAnswerRows = (questions, renderLatex) => questions.map((question, index) => {
            const images = question.images || [];
            return {
                number: index + 1,
                answerHtml: question.answer ? renderLatex(question.answer, images) : '',
                solutionHtml: question.solution ? renderLatex(question.solution, images) : '',
                solutionHasLabel: /^【(?:分析|详解|解答|答案|点睛)】/.test(String(question.solution || '').trim())
            };
        });

        const buildAnswerSummaryGrid = (questions, renderLatex) => buildAnswerSummaryGridFromRows(
            prepareAnswerRows(questions, renderLatex)
        );

        const buildNotice = config => {
            if (!config.showNotice) return '';
            return '<div class="notice">注意事项：请将答案填写在指定位置，保持卷面整洁。</div>';
        };

        const buildAnswerContent = (
            questions,
            forceNewPage = true,
            dependencies
        ) => {
            const { renderLatex, config = {}, fallbackTitle = '高中数学作业' } = dependencies;
            const answerTitle = config.title || fallbackTitle;
            const rows = prepareAnswerRows(questions, renderLatex);
            let content = `<div class="answer-section ${forceNewPage ? 'new-page' : ''}"><h2>《${escapeHtml(answerTitle)}》参考答案</h2>`;
            content += buildAnswerSummaryGridFromRows(rows);
            questions.forEach((question, index) => {
                const row = rows[index];
                content += `<div class="answer-item"><div class="answer-item-heading">${row.number}．${row.answerHtml || '________'}</div>`;
                if (row.solutionHtml) {
                    content += `<div class="answer-solution">${row.solutionHasLabel ? '' : '【详解】'}${row.solutionHtml}</div>`;
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
            const templateVariant = String(config.templateVariant || 'unboxed-question').replace(/[^a-z-]/gi, '');
            let content = `<main class="question-template-${templateVariant}"><div class="header">
                        <div class="title">${escapeHtml(config.title || fallbackTitle)}</div>
                        ${config.subtitle ? `<div class="subtitle">${escapeHtml(config.subtitle)}</div>` : ''}
                        ${config.organizer ? `<div class="organizer">组卷人：${escapeHtml(config.organizer)}</div>` : ''}
                        ${buildHeaderFields(config)}
                        ${buildAnswerGrid(questions, config)}
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
            buildAnswerSummaryGrid,
            buildHeaderFields,
            buildNotice,
            buildPrintOptionsHtml,
            buildQuestionContent
        };
    }
);
