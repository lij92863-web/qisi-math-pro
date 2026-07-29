(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const questionInstance = root.Qisi?.HandoutQuestionInstance
        || (
            typeof require === 'function'
                ? require('./qisi-handout-question-instance.js')
                : null
        );
    const api = factory(model, questionInstance);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutPreview = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function (model, questionInstance) {
        'use strict';

        if (!model || !questionInstance) {
            throw new Error('handout preview dependencies are unavailable');
        }

        const EDITIONS = Object.freeze([
            'student',
            'teacher'
        ]);
        const PROTECTED_FIELDS = Object.freeze([
            'answer',
            'analysis',
            'solution',
            'teacherNote'
        ]);
        const PRESENTATION_FIELDS = Object.freeze([
            'title',
            'questionNumber',
            'grade',
            'diff',
            'type',
            'knowledge',
            'knowledgeType',
            'systemKnowledge',
            'personalKnowledge',
            'knowledgePoints',
            'tags',
            'source',
            'year',
            'stem',
            'options',
            'answer',
            'analysis',
            'solution',
            'teacherNote'
        ]);

        const escapeHtml = value => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const formulaPattern =
            /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?<!\\)\$(?!\$)[^$\n]+?(?<!\\)\$)/g;

        const unwrapFormula = source => {
            if (source.startsWith('$$')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: true
                };
            }
            if (source.startsWith('\\[')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: true
                };
            }
            if (source.startsWith('\\(')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: false
                };
            }
            return {
                latex: source.slice(1, -1),
                displayMode: false
            };
        };

        const renderMathHtml = (value, katexApi) => {
            const source = String(value == null ? '' : value);
            let cursor = 0;
            let html = '';

            for (const match of source.matchAll(formulaPattern)) {
                html += escapeHtml(
                    source.slice(cursor, match.index)
                ).replace(/\r?\n/g, '<br>');

                const formula = unwrapFormula(match[0]);

                if (!katexApi?.renderToString) {
                    html += (
                        `<span class="handout-formula-source">${escapeHtml(match[0])}</span>`
                    );
                } else {
                    try {
                        html += katexApi.renderToString(
                            formula.latex,
                            {
                                displayMode: formula.displayMode,
                                throwOnError: false,
                                strict: 'ignore',
                                trust: false,
                                output: 'htmlAndMathml'
                            }
                        );
                    } catch (error) {
                        html += (
                            `<span class="handout-formula-error" title="${escapeHtml(error?.message || error)}">${escapeHtml(match[0])}</span>`
                        );
                    }
                }

                cursor = match.index + match[0].length;
            }

            html += escapeHtml(source.slice(cursor))
                .replace(/\r?\n/g, '<br>');
            return html;
        };

        const resolveOptionColumns = (mode, options) => {
            if (mode === 'one-row') return 4;
            if (mode === 'two-columns') return 2;
            if (mode === 'one-column') return 1;

            const values = (Array.isArray(options) ? options : [])
                .filter(value => String(value || '').trim());
            const longest = Math.max(
                0,
                ...values.map(value =>
                    String(value).replace(/\\[a-zA-Z]+/g, 'x').length
                )
            );

            if (values.length <= 4 && longest <= 16) return 4;
            if (longest <= 34) return 2;
            return 1;
        };

        const resolveQuestion = (block, edition) => {
            const resolved = questionInstance.applyQuestionOverrides(
                block.snapshot,
                block.contentOverrides || {}
            );
            const display = model.cloneValue(block.display || {});
            const optionColumns = resolveOptionColumns(
                block.optionLayout?.mode || 'auto',
                resolved.options
            );
            const question = {
                id: block.id,
                blockId: block.id,
                sourceQuestionId: block.sourceQuestionId,
                display,
                questionLabel: model.cloneValue(block.questionLabel || {}),
                displayLabels: model.cloneValue(
                    block.displayLabels || []
                ),
                optionLayout: {
                    mode: block.optionLayout?.mode || 'auto',
                    columns: optionColumns
                },
                imageLayout: model.cloneValue(
                    block.imageLayout || {
                        mode: 'flow',
                        columns: 2,
                        gapMm: 4
                    }
                ),
                images: model.cloneValue(block.images || [])
            };

            for (const field of PRESENTATION_FIELDS) {
                if (
                    edition === 'teacher'
                    || !PROTECTED_FIELDS.includes(field)
                ) {
                    question[field] = model.cloneValue(resolved[field]);
                }
            }

            if (edition === 'student') {
                question.display.answerPlacement = 'hidden';
                question.display.analysisPlacement = 'hidden';
                question.display.solutionPlacement = 'hidden';
            }

            return question;
        };

        const projectHandoutForPreview = (
            handout,
            edition = 'student'
        ) => {
            if (!EDITIONS.includes(edition)) {
                throw new TypeError(`unsupported preview edition: ${edition}`);
            }

            const normalized = model.assertValidHandout(handout);
            const projectedBlocks = [];
            const endSections = [];

            for (const block of normalized.blocks) {
                if (block.type !== 'question') {
                    if (
                        edition === 'student'
                        && block.type === 'callout'
                        && block.variant === 'teacher'
                    ) {
                        continue;
                    }
                    projectedBlocks.push(model.cloneValue(block));
                    continue;
                }

                const question = resolveQuestion(block, edition);
                const placements = {
                    answer: question.display.answerPlacement,
                    analysis: question.display.analysisPlacement,
                    solution: question.display.solutionPlacement
                };

                if (edition === 'teacher') {
                    for (const [field, placement] of Object.entries(placements)) {
                        if (
                            placement === 'end'
                            && String(question[field] || '').trim()
                        ) {
                            endSections.push({
                                blockId: block.id,
                                sourceQuestionId: block.sourceQuestionId,
                                field,
                                content: question[field]
                            });
                            delete question[field];
                        }
                    }
                }

                projectedBlocks.push({
                    id: block.id,
                    type: 'question',
                    sourceQuestionId: block.sourceQuestionId,
                    question
                });
            }

            return {
                schemaVersion: normalized.schemaVersion,
                id: normalized.id,
                title: normalized.title,
                edition,
                settings: model.cloneValue(normalized.settings),
                blocks: projectedBlocks,
                endSections
            };
        };

        const containsProtectedContent = (projection, needles) => {
            const haystack = JSON.stringify(projection);

            return (Array.isArray(needles) ? needles : [])
                .filter(value => String(value || '').trim())
                .some(value => haystack.includes(String(value)));
        };

        return {
            EDITIONS,
            PROTECTED_FIELDS,
            PRESENTATION_FIELDS,
            escapeHtml,
            unwrapFormula,
            renderMathHtml,
            resolveOptionColumns,
            resolveQuestion,
            projectHandoutForPreview,
            containsProtectedContent
        };
    }
);
