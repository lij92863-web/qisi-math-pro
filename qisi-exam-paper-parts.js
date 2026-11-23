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

    const escapeHtml = (text) => String(text || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
    const createDocumentBuilder = ({ prepareSource, normalizeMath, tokenize, renderMath, displayImageUrl, groupQuestions,
        typeOrder = [], defaultGroupConfig = {}, typeLabels = {}, sectionNumbers = [], warn = () => {} } = {}) => {
        if ([prepareSource, normalizeMath, tokenize, renderMath, displayImageUrl, groupQuestions].some(port => typeof port !== 'function')) throw new Error('EXAM_PAPER_DEPENDENCY_REQUIRED');
        const formatLatexForPrint = prepareSource, normalizeMathExpressionForPrint = normalizeMath, CHINESE_SECTION_NUMBERS = sectionNumbers;
        const report = (diagnostics, event, details) => { diagnostics.push({ event, ...details }); warn(event, details); };
        const groupSummaryText = group => group.text || `${group.title}：本大题共 ${group.count} 小题，每小题 ${Number(group.points || 0)} 分，共计 ${group.total} 分。`;
        const printImageHtml = (img, align = 'center') => {
                    const imageUrl = displayImageUrl(img?.url);
                    if (!imageUrl) return `<span class="missing-image">[图片未加载]</span>`;
                    const src = escapeHtml(imageUrl);
                    const placement = align || img.align || 'center';
                    if (placement === 'flushleft') return `<img class="print-image float-left" src="${src}" alt="题图" />`;
                    if (placement === 'flushright') return `<img class="print-image float-right" src="${src}" alt="题图" />`;
                    return `<img class="print-image centered" src="${src}" alt="题图" />`;
                };
        const applyPrintWritingRules = (html) => html
                    .replace(/（\s*）/g, '<span class="answer-blank">（&nbsp;&nbsp;）</span>')
                    .replace(/\(\s*\)/g, '<span class="answer-blank">(&nbsp;&nbsp;)</span>')
                    .replace(/([（(])(<span class="katex[\s\S]*?<\/span>)([）)])/g, '<span class="nowrap">$1$2$3</span>');
        const renderPrintPositionedImageBlocks = (source, images, protectHtml) => {
                    const findPrintImage = (id) => {
                        const key = String(id || '').trim();
                        return (images || []).find(item =>
                            String(item.id || '') === key ||
                            String(item.filename || '') === key ||
                            String(item.name || '') === key
                        );
                    };

                    return String(source || '')
                        .replace(
                            /\\begin\{wrapfigure\}\s*\{([lr])\}\s*\{[^}]+\}[\s\S]*?\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\][\s\S]*?\\end\{wrapfigure\}/g,
                            (block, side, id) => {
                                const image = findPrintImage(id);
                                return protectHtml(image
                                    ? printImageHtml(image, side === 'l' ? 'flushleft' : 'flushright')
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`);
                            }
                        )
                        .replace(
                            /\\begin\{(center|flushleft|flushright)\}[\s\S]*?\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\][\s\S]*?\\end\{\1\}/g,
                            (block, environment, id) => {
                                const image = findPrintImage(id);
                                return protectHtml(image
                                    ? printImageHtml(image, environment)
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`);
                            }
                        )
                        .replace(
                            /\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/g,
                            (match, id) => {
                                const image = findPrintImage(id);
                                return protectHtml(image
                                    ? printImageHtml(image, 'center')
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`);
                            }
                        );
                };
        const renderPrintTextChunk = (text, images = []) => {
                    const htmlChunks = [];
                    // Only HTML generated from image references is trusted. Source
                    // text cannot claim a slot, even if it resembles our markup.
                    let prefix = '@@QISI_PRINT_IMAGE_';
                    while (String(text).replace(/\n/g, '').includes(prefix)) prefix += '_';
                    const protectHtml = (html) => {
                        const token = `${prefix}${htmlChunks.length}@@`;
                        htmlChunks.push(html);
                        return token;
                    };
                    const withTokenImages = renderPrintPositionedImageBlocks(text, images, protectHtml);
                    const withWrapFigures = withTokenImages.replace(
                        /\\begin\{wrapfigure\}\s*\{([lr])\}\s*\{[^}]+\}[\s\S]*?\\includegraphics(?:\[.*?\])?\{([^}]+)\}[\s\S]*?\\end\{wrapfigure\}/g,
                        (match, side, id) => {
                            const img = (images || []).find(item => String(item.id) === String(id).trim());
                            return protectHtml(img
                                ? printImageHtml(img, side === 'l' ? 'flushleft' : 'flushright')
                                : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`);
                        }
                    );
                    const withImages = withWrapFigures.replace(/(?:\\begin\{(center|flushleft|flushright)\}\s*)?\\includegraphics(?:\[.*?\])?\{([^}]+)\}(?:\s*\\end\{(?:center|flushleft|flushright)\})?/g, (match, align, id) => {
                        const img = (images || []).find(item =>
                            String(item.id || '') === String(id).trim() ||
                            String(item.filename || '') === String(id).trim() ||
                            String(item.name || '') === String(id).trim()
                        );
                        return protectHtml(img ? printImageHtml(img, align) : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`);
                    });
                    const escaped = escapeHtml(withImages)
                        .replace(/\n{2,}/g, '<br><br>')
                        .replace(/\n/g, '');
                    // A single pass never interprets placeholder-like text in
                    // generated URLs as another slot.
                    const restored = escaped.replace(new RegExp(prefix + '(\\d+)@@', 'g'),
                        (token, index) => htmlChunks[Number(index)] ?? token);
                    return applyPrintWritingRules(restored);
                };
        const renderSource = (text, images = [], diagnostics = []) => {
                    const source = formatLatexForPrint(text).replace(/<br><br>/g, '\n\n');
                    if (!source) return '';

                    const parsed = tokenize(source);

                    if (parsed.issues.length) {
                        report(diagnostics, '[PRINT_LATEX][delimiter-issues]', { content: source, issues: parsed.issues });
                    }

                    return parsed.segments
                        .map(segment => {
                            if (segment.type !== 'math') {
                                return renderPrintTextChunk(segment.raw, images);
                            }

                            if (
                                /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/.test(segment.raw) ||
                                /\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/.test(segment.raw)
                            ) {
                                return renderPrintTextChunk(segment.expression || '', images);
                            }

                            const expression = normalizeMathExpressionForPrint(segment.expression);

                            try {
                                return renderMath(expression, {
                                    displayMode: Boolean(segment.displayMode),
                                    throwOnError: true,
                                    strict: 'ignore',
                                    trust: false
                                });
                            } catch (error) {
                                report(diagnostics, '[PRINT_LATEX][failed]', {
                                    raw: segment.raw,
                                    expression,
                                    message: error?.message || String(error)
                                });

                                return '<span class="latex-render-error">[公式语法错误] ' + escapeHtml(segment.raw || expression) + '</span>';
                            }
                        })
                        .join('');
                };
        const buildPrintOptionsHtml = (q, diagnostics = []) => { const renderLatexForPrint = (text, images) => renderSource(text, images, diagnostics);
                    if (!(q.type === '单选题' || q.type === '多选题')) {
                        return '';
                    }

                    if (!Array.isArray(q.options) || !q.options.some(option => String(option || '').trim())) {
                        return '';
                    }

                    const rows = q.options
                        .map((option, index) => {
                            if (!String(option || '').trim()) {
                                return '';
                            }

                            return (
                                '<div class="gaokao-option">' +
                                    '<span class="option-label">' +
                                        String.fromCharCode(65 + index) +
                                        '.' +
                                    '</span>' +
                                    '<span class="option-content">' +
                                        renderLatexForPrint(option, q.images || []) +
                                    '</span>' +
                                '</div>'
                            );
                        })
                        .join('');

                    return '<div class="gaokao-options qisi-flow-options">' + rows + '</div>';
                };
        const buildQuestionContent = (qs, paper, diagnostics) => {
                    const renderLatexForPrint = (text, images) => renderSource(text, images, diagnostics);
                    const examConfig = paper.config, examQuestionMeta = paper.questionMeta;
                    const selectedExamTemplate = { value: paper.template }, examTitle = { value: paper.title };
                    const groups = groupQuestions({ questions: qs, groupConfig: paper.groupConfig, questionMeta: paper.questionMeta, typeOrder, defaultGroupConfig, typeLabels });
                    const headerClass = selectedExamTemplate.value === 'quizSheet' ? 'header quiz-sheet-header' : 'header';
                    let content = `${examConfig.showCornerMarks ? '<div class="corner-marks"><i></i><i></i><i></i><i></i></div>' : ''}<main class="${examConfig.compactMode ? 'paper-compact' : ''} ${selectedExamTemplate.value === 'quizSheet' ? 'paper-quiz-sheet' : ''}">${selectedExamTemplate.value === 'examZh' && examConfig.showSecretMark ? '<div class="secret-mark">绝密 ★ 启用前</div>' : ''}<div class="${headerClass}">
                        <div class="title" style="font-size:24px;font-weight:bold;margin-bottom:8px;">${escapeHtml(examConfig.title || examTitle.value)}</div>
                        ${examConfig.subtitle ? `<div class="subtitle">${escapeHtml(examConfig.subtitle)}</div>` : ''}
                        ${examConfig.organizer ? `<div class="organizer">组卷人：${escapeHtml(examConfig.organizer)}</div>` : ''}
                        ${buildHeaderFields({ show: paper.config.showHeaderFields, template: paper.template })}
                        ${buildAnswerGrid({ show: paper.config.showAnswerGrid, count: qs.length, config: paper.config })}
                        ${buildNotice({ show: paper.config.showNotice, template: paper.template })}
                    </div>`;

                    let printIndex = 1;
                    groups.forEach((group, groupIndex) => {
                        const sectionNo = CHINESE_SECTION_NUMBERS[groupIndex] || String(groupIndex + 1);
                        content += `<div class="group-title">${sectionNo}、${escapeHtml(groupSummaryText(group))}</div>`;
                        group.items.forEach((q) => {
                            const meta = examQuestionMeta[q.id] || {};
                            const safeStem = renderLatexForPrint(q.stem, q.images || []);
                            const optionsHtml = buildPrintOptionsHtml(q, diagnostics);

                            content += `<div class="exam-question">
                                <div class="question-row"><span class="q-index">${printIndex}.</span><div class="question-flow-body">${safeStem}${optionsHtml}</div></div>`;
                            if (meta.note) content += `<div class="q-note">${escapeHtml(meta.note)}</div>`;
                            if (examConfig.showAnswer && q.answer) content += `<div class="print-answer"><b>答案：</b>${renderLatexForPrint(q.answer, q.images || [])}</div>`;
                            if (examConfig.showSolution && q.solution) content += `<div class="print-solution"><b>解析：</b>${renderLatexForPrint(q.solution, q.images || [])}</div>`;
                            content += `</div>`;
                            printIndex += 1;
                        });
                    });
                    return content + `</main>`;
                };
        const buildPaper = ({ paper, questions = paper?.questions } = {}) => {
            if (!['questions','withAnswers','split'].includes(paper?.mode)) throw new Error('EXAM_PAPER_MODE_INVALID');
            if (!Array.isArray(questions) || !Array.isArray(paper.questions) || JSON.stringify(questions.map(q=>q?.id)) !== JSON.stringify(paper.questions.map(q=>q?.id))) throw new Error('EXAM_PAPER_SNAPSHOT_MISMATCH');
            const diagnostics = [], questionsContent = buildQuestionContent(questions, paper, diagnostics);
            const answersContent = paper.mode === 'questions' ? '' : buildAnswerContent({ questions, forceNewPage: paper.mode === 'withAnswers', render: (text, images) => renderSource(text, images, diagnostics) });
            const documents = paper.mode === 'split' ? [{ title:'试题卷',content:questionsContent },{ title:'答案卷',content:answersContent }]
                : [{ title:paper.mode==='withAnswers'?'试卷与答案':'试题卷',content:questionsContent+answersContent }];
            return { questionsContent, answersContent, documents, diagnostics };
        };
        return Object.freeze({ buildPaper, render: renderSource, printImageHtml });
    };
    return Object.freeze({
        escapeHtml, createDocumentBuilder, HEADER_FIELDS, NOTICE_EXAM_ZH, NOTICE_DEFAULT,
        buildHeaderFields, buildAnswerGrid, buildNotice, buildAnswerContent
    });
});
