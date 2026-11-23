(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.Components = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
﻿        const Icon = {
            props: ['name', 'size', 'class'],
            setup(props) {
                const { ref, onMounted, watch } = root.Vue;
                const el = ref(null);
                const updateIcon = () => {
                    if (el.value && window.lucide) {
                        el.value.innerHTML = '';
                        const i = document.createElement('i');
                        i.setAttribute('data-lucide', props.name);
                        if (props.class) i.className = props.class;
                        el.value.appendChild(i);
                        window.lucide.createIcons({ root: el.value, attrs: { width: props.size || 18, height: props.size || 18 } });
                    }
                };
                onMounted(updateIcon); watch(() => props.name, updateIcon);
                return { el };
            },
            template: '#icon-tpl'
        };

        const renderQuestionOptionsHtml = (options = [], images = [], flow = true) => {
            const rows = Array.isArray(options) ? options : [];
            const validRows = rows
                .map((option, index) => ({
                    index,
                    content: String(option || '').trim()
                }))
                .filter(row => row.content);

            if (!validRows.length) {
                return '';
            }

            const rowsHtml = validRows.map(row => {
                const label = String.fromCharCode(65 + row.index);
                const contentHtml = renderLatexPreviewHtml(row.content, images);

                return (
                    '<div class="gaokao-option">' +
                        '<span class="option-label">' + label + '.</span>' +
                        '<span class="option-content">' + contentHtml + '</span>' +
                    '</div>'
                );
            }).join('');

            return '<div data-auto-options class="gaokao-options' + (flow ? ' qisi-flow-options' : '') + '">' + rowsHtml + '</div>';
        };

        const LatexPreview = {
            template: '#latex-preview-tpl',
            props: {
                content: { type: String, default: '' },
                images: { type: Array, default: () => [] },
                class: { type: String, default: '' },
                options: { type: Array, default: () => [] },
                questionType: { type: String, default: '' },
                preserveLineBreaks: { type: Boolean, default: false },
                flowOptions: { type: Boolean, default: false }
            },
            setup(props) {
                return { displayImages: root.Qisi.LibraryImageResources.useStoredImages(() => props.images, root.Vue) };
            },
            computed: {
                htmlContent() {
                    const images = this.displayImages || this.images || [];
                    const stemHtml = renderLatexPreviewHtml(this.content, images, { preserveLineBreaks: this.preserveLineBreaks });
                    const isChoice = this.questionType === '单选题' || this.questionType === '多选题';
                    const options = isChoice ? renderQuestionOptionsHtml(this.options, images, false) : '';
                    const html = this.flowOptions
                        ? '<div data-qisi-question-flow><div data-question-stem>' + stemHtml + '</div>' + options + '</div>'
                        : stemHtml;
                    return root.Qisi.FigureEditor?.layoutHtml(html, images) ?? html;
                }
            }
        };

        const renderLatexPreviewHtml = (content, images = [], { preserveLineBreaks = false } = {}) => {
            // Every rendered surface (review preview, option rows, question cards)
            // shares the same math policy: bare formulas, letters, numbers and
            // (i)/(ii) labels are promoted to LaTeX before tokenizing. Doing it
            // here means no call site can bypass the rule.
            const normalizeDisplayText = root?.Qisi?.Utils?.normalizeBareLatexForDisplayText;
            if (typeof normalizeDisplayText === 'function' && typeof content === 'string') {
                content = normalizeDisplayText(content);
            }

            const escapeHtmlLocal = (value) => String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');

            const findImage = (id) => {
                const key = String(id || '').trim();
                return (images || []).find(img =>
                    String(img.id || '') === key ||
                    String(img.filename || '') === key ||
                    String(img.name || '') === key
                );
            };

            const extractPreviewImageIdFromCode = (source = '') => {
                const text = String(source || '');
                const tokenMatch = text.match(/\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/);

                if (tokenMatch?.[1]) {
                    return String(tokenMatch[1]).trim();
                }

                const graphicMatch = text.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/);
                return graphicMatch?.[1] ? String(graphicMatch[1]).trim() : '';
            };

            const renderImageToken = (rawId, placement = 'center') => {
                const id = String(rawId || '').trim();
                const img = findImage(id);

                const imageUrl = window.Qisi?.QuestionImagePolicy?.displayImageUrl(img?.url);
                if (!imageUrl || img.displayable === false) {
                    return `<span class="latex-image-placeholder">[图片暂不可预览:${escapeHtmlLocal(id)}]</span>`;
                }

                const placementClass = {
                    left: 'qisi-preview-image-left',
                    right: 'qisi-preview-image-right',
                    center: 'qisi-preview-image-center'
                }[placement] || 'qisi-preview-image-center';

                return (
                    `<span class="qisi-preview-image ${placementClass}" data-image-id="${escapeHtmlLocal(id)}">` +
                    `<img src="${escapeHtmlLocal(imageUrl)}" alt="题图" />` +
                    `</span>`
                );
            };

            const renderPlainText = (text) => {
                let source = String(text ?? '');
                const renderedChunks = [];
                const protectRenderedHtml = (html) => {
                    const token = `@@QISI_RENDERED_IMAGE_${renderedChunks.length}@@`;
                    renderedChunks.push(html);
                    return token;
                };
                const extractId = extractPreviewImageIdFromCode;

                source = source.replace(
                    /\\begin\{wrapfigure\}\s*\{([lr])\}\s*\{[^}]+\}[\s\S]*?\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\][\s\S]*?\\end\{wrapfigure\}/g,
                    (block, side) => {
                        const id = extractId(block);
                        return id ? protectRenderedHtml(renderImageToken(id, side === 'l' ? 'left' : 'right')) : block;
                    }
                );

                source = source.replace(
                    /\\begin\{wrapfigure\}\s*\{([lr])\}\s*\{[^}]+\}[\s\S]*?\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}[\s\S]*?\\end\{wrapfigure\}/g,
                    (block, side) => {
                        const id = extractId(block);
                        return id ? protectRenderedHtml(renderImageToken(id, side === 'l' ? 'left' : 'right')) : block;
                    }
                );

                source = source.replace(
                    /\\begin\{(center|flushleft|flushright)\}[\s\S]*?\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\][\s\S]*?\\end\{\1\}/g,
                    (block, environment) => {
                        const id = extractId(block);
                        if (!id) return block;
                        const placement = {
                            center: 'center',
                            flushleft: 'left',
                            flushright: 'right'
                        }[environment] || 'center';

                        return protectRenderedHtml(renderImageToken(id, placement));
                    }
                );

                source = source.replace(
                    /\\begin\{(center|flushleft|flushright)\}[\s\S]*?\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}[\s\S]*?\\end\{\1\}/g,
                    (block, environment) => {
                        const id = extractId(block);
                        if (!id) return block;
                        const placement = {
                            center: 'center',
                            flushleft: 'left',
                            flushright: 'right'
                        }[environment] || 'center';

                        return protectRenderedHtml(renderImageToken(id, placement));
                    }
                );

                source = source.replace(
                    /\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/g,
                    (match, id) => protectRenderedHtml(renderImageToken(id, 'center'))
                );

                source = source.replace(
                    /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g,
                    (match, id) => protectRenderedHtml(renderImageToken(id, 'center'))
                );

                let html = escapeHtmlLocal(source);

                if (!preserveLineBreaks) html = html.replace(/\n{2,}/g, '\n\n');
                html = html.replace(/\n/g, '<br>');

                renderedChunks.forEach((chunk, index) => {
                    html = html.replace(`@@QISI_RENDERED_IMAGE_${index}@@`, chunk);
                });

                return html;
            };

            const normalizeMathExpressionForPreview = (expression = '') => String(expression || '')
                // Strip outer dollar delimiters that leak through when the
                // tokenizer encounters nested/ambiguous $ boundaries.
                .replace(/^\$\$?\s*/, '')
                .replace(/\s*\$\$?$/, '')
                // Fix OCR malformed \text{中文$} wrapper where a spurious $
                // inside \text{} confuses the tokenizer.  Only matches when
                // the content before $ is purely CJK.
                .replace(/\\text\{([一-龥]+)\$\}/g, '$1')
                // Strip leading } and trailing { orphaned by partial wrapper
                // removal — these are never valid at expression boundaries.
                .replace(/^\}\s*/, '')
                .replace(/\s*\{$/, '')
                .replace(/\s*\n\s*/g, ' ')
                .replace(/(?<!\\)\bSangle\b/g, '\\angle')
                .replace(/(?<!\\)\bangle\b/g, '\\angle')
                .replace(/(?<!\\)\btheta\b/g, '\\theta')
                .replace(/(?<!\\)\balpha\b/g, '\\alpha')
                .replace(/(?<!\\)\bbeta\b/g, '\\beta')
                .replace(/(?<!\\)\bgamma\b/g, '\\gamma')
                .replace(/(?<!\\)\bpi\b/g, '\\pi')
                .replace(/≤/g, '\\le ')
                .replace(/≥/g, '\\ge ')
                .replace(/≠/g, '\\ne ')
                .replace(/π/g, '\\pi ')
                .replace(/∈/g, '\\in ')
                .replace(/∩/g, '\\cap ')
                .replace(/∪/g, '\\cup ')
                .replace(/→/g, '\\to ')
                .replace(/\\(?:overparen|wideparen|overarc)\s*\{([^{}]+)\}/g, '\\overset{\\frown}{$1}')
                .replace(/\\(?:overparen|wideparen|overarc)\s*([A-Z]{1,4})(?=[^A-Za-z]|$)/g, '\\overset{\\frown}{$1}')
                .trim();

            const renderMathSegmentForPreview = (segment) => {
                const raw = String(segment?.raw || '');
                const expression = normalizeMathExpressionForPreview(segment?.expression || '');

                if (!expression) return '';

                if (
                    /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]/.test(raw) ||
                    /\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/.test(raw)
                ) {
                    return renderPlainText(segment.expression || '');
                }

                // If the expression has Chinese characters AND $ delimiters,
                // it's mixed text with inline math that the tokenizer couldn't
                // split.  Re-segment on $...$ boundaries and render each part.
                if (/[一-龥]/.test(expression) && /(?<!\\)\$/.test(expression)) {
                    const segments = [];
                    // Match $$...$$ first (display), then $...$ (inline).
                    const re = /\$\$([\s\S]*?)\$\$|\$([\s\S]*?)\$/g;
                    let lastIdx = 0;
                    let m;

                    while ((m = re.exec(expression)) !== null) {
                        if (m.index > lastIdx) {
                            segments.push(renderPlainText(
                                expression.slice(lastIdx, m.index)
                            ));
                        }

                        const isDisplay = m[0].startsWith('$$');
                        const inner = normalizeMathExpressionForPreview(
                            isDisplay ? m[1] : m[2]
                        );

                        try {
                            if (!window.katex) throw new Error('KaTeX 尚未加载');
                            segments.push(root.Qisi.Utils.renderLatexFormula(window.katex.renderToString, inner, {
                                displayMode: isDisplay,
                                throwOnError: true,
                                strict: 'ignore',
                                trust: false
                            }));
                        } catch (error) {
                            segments.push(
                                `<span class="latex-render-error" title="${escapeHtmlLocal(error?.message || '公式语法错误')}">` +
                                `[公式语法错误：原文已保留] ` +
                                `${escapeHtmlLocal(inner)}` +
                                `</span>`
                            );
                        }

                        lastIdx = m.index + m[0].length;
                    }

                    if (lastIdx < expression.length) {
                        segments.push(renderPlainText(expression.slice(lastIdx)));
                    }

                    return segments.join('');
                }

                let bareChinese = false;
                try {
                    if (!window.katex) throw new Error('KaTeX 尚未加载');
                    return root.Qisi.Utils.renderLatexFormula(window.katex.renderToString, expression, {
                        displayMode: Boolean(segment.displayMode),
                        throwOnError: true,
                        // KaTeX distinguishes prose in math mode from text inside \text{}.
                        strict: (code, _message, token) => {
                            bareChinese = code === 'unicodeTextInMathMode' && /\p{Script=Han}/u.test(token?.text || '');
                            return bareChinese ? 'error' : 'ignore';
                        },
                        trust: false
                    });
                } catch (error) {
                    if (bareChinese) return renderPlainText(expression);
                    console.warn('[LATEX_RENDER][failed]', {
                        raw,
                        expression,
                        message: error?.message || String(error)
                    });

                    return (
                        `<span class="latex-render-error" title="${escapeHtmlLocal(error?.message || '公式语法错误')}">` +
                        `[公式语法错误：原文已保留] ` +
                        `${escapeHtmlLocal(expression)}` +
                        `</span>`
                    );
                }
            };

            let source = String(content || '')
                .replace(/\r\n?/g, '\n')
                .replace(/_*MATHPROTECT[_-]?\d+_*/gi, '')
                .replace(/@@QISI_MATH_\d+@@/g, '');
            if (!preserveLineBreaks) {
                source = source.replace(/([\u4e00-\u9fa5])\n([\u4e00-\u9fa5])/g, '$1$2')
                    .replace(/\n{3,}/g, '\n\n');
            }

            const parsed = tokenizeLatexSource(source);

            if (parsed.issues.length) {
                console.warn('[LATEX_RENDER][delimiter-issues]', {
                    content: source,
                    issues: parsed.issues
                });
            }

            // Detect bare LaTeX math commands embedded in plain text
            // and render them inline with KaTeX.
            const BARE_LATEX_MATH_COMMANDS = new Set([
                'overline', 'overrightarrow', 'vec', 'vect', 'sqrt', 'frac',
                'therefore', 'because', 'cdot', 'times', 'div', 'pm', 'mp',
                'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
                'angle', 'triangle', 'Delta', 'omega', 'Omega',
                'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta',
                'pi', 'sigma', 'lambda', 'mu', 'rho', 'phi', 'psi',
                'le', 'ge', 'neq', 'equiv', 'approx', 'sim', 'propto',
                'in', 'notin', 'subset', 'supset', 'subseteq', 'supseteq',
                'cup', 'cap', 'forall', 'exists', 'neg', 'vee', 'wedge',
                'infty', 'partial', 'nabla', 'sum', 'prod', 'int', 'oint',
                'left', 'right', 'langle', 'rangle',
                'mathbb', 'mathbf', 'mathrm', 'mathcal',
                'bar', 'hat', 'tilde', 'dot', 'ddot',
                'ldots', 'cdots', 'vdots', 'ddots',
                'circ', 'bullet', 'Box', 'square', 'diamond',
                'oplus', 'ominus', 'otimes', 'oslash', 'odot',
                'star', 'ast', 'bigcirc', 'bigstar', 'bigodot',
                'setminus', 'cap', 'cup', 'land', 'lor',
                'parallel', 'perp', 'mid', 'nmid',
                'to', 'mapsto', 'implies', 'iff', 'Rightarrow',
                'longrightarrow', 'longmapsto', 'xrightarrow',
                'underset', 'overset', 'stackrel',
                'displaystyle', 'textstyle', 'limits', 'nolimits',
                'prime', 'empty', 'emptyset', 'varnothing',
                'nabla', 'surd', 'top', 'bot',
                'smile', 'frown', 'wr', 'bowtie',
                'models', 'vdash', 'dashv', 'Vdash',
                'cong', 'asymp', 'doteq', 'risingdotseq',
                'fallingdotseq', 'bumpeq', 'Bumpeq',
                'gg', 'll', 'prec', 'succ', 'preceq', 'succeq',
                'sqsubset', 'sqsupset', 'sqsubseteq', 'sqsupseteq',
                'in', 'ni', 'Join', 'bowtie', 'ltimes', 'rtimes',
                'smile', 'frown', 'wr'
            ]);

            const hasBareLatexCommands = (text = '') => {
                // Fast check: does the text contain \ followed by a letter?
                if (!/\\[A-Za-z]/.test(text)) return false;
                // Check against known math commands.
                const re = /\\([A-Za-z]+)/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                    if (BARE_LATEX_MATH_COMMANDS.has(m[1])) return true;
                }
                return false;
            };

            const splitBareLatexMathIslands = (text = '') => {
                const parts = [];
                let i = 0;
                let plainStart = 0;

                while (i < text.length) {
                    if (text[i] === '\\' && i + 1 < text.length &&
                        /[A-Za-z]/.test(text[i + 1])) {
                        // Read command name.
                        let j = i + 1;
                        while (j < text.length && /[A-Za-z]/.test(text[j])) j += 1;
                        const cmdName = text.slice(i + 1, j);

                        if (BARE_LATEX_MATH_COMMANDS.has(cmdName)) {
                            // Push preceding plain text.
                            if (plainStart < i) {
                                parts.push({ type: 'text', text: text.slice(plainStart, i) });
                            }

                            // Read brace groups after the command.
                            let end = j;
                            while (end < text.length && text[end] === '{') {
                                let depth = 0;
                                let k = end;
                                while (k < text.length) {
                                    if (text[k] === '{') depth += 1;
                                    else if (text[k] === '}') {
                                        depth -= 1;
                                        if (depth === 0) { k += 1; break; }
                                    }
                                    k += 1;
                                }
                                end = k;
                            }

                            parts.push({ type: 'math', text: text.slice(i, end) });
                            i = end;
                            plainStart = end;
                            continue;
                        }
                    }
                    i += 1;
                }

                if (plainStart < text.length) {
                    parts.push({ type: 'text', text: text.slice(plainStart) });
                }

                return parts.length ? parts : [{ type: 'text', text }];
            };

            const renderTextWithBareLatex = (text) => {
                if (!hasBareLatexCommands(text)) {
                    return renderPlainText(text);
                }

                const parts = splitBareLatexMathIslands(text);

                return parts.map(part => {
                    if (part.type !== 'math') {
                        return renderPlainText(part.text);
                    }

                    const normalized = normalizeMathExpressionForPreview(part.text);

                    try {
                        if (!window.katex) throw new Error('KaTeX 尚未加载');
                        return root.Qisi.Utils.renderLatexFormula(window.katex.renderToString, normalized, {
                            displayMode: false,
                            throwOnError: true,
                            strict: 'ignore',
                            trust: false
                        });
                    } catch (error) {
                        return (
                            `<span class="latex-render-error" title="${escapeHtmlLocal(error?.message || '公式语法错误')}">` +
                            `[公式语法错误：原文已保留] ` +
                            `${escapeHtmlLocal(normalized)}` +
                            `</span>`
                        );
                    }
                }).join('');
            };

            return parsed.segments.map((segment, index, segments) => {
                if (segment.type === 'math') return renderMathSegmentForPreview(segment);
                let text = segment.raw;
                if (preserveLineBreaks) {
                    // Display math already starts and ends on its own line.
                    if (segments[index - 1]?.displayMode) text = text.replace(/^\n/, '');
                    if (segments[index + 1]?.displayMode) text = text.replace(/\n$/, '');
                }
                return renderTextWithBareLatex(text);
            }).join('');
        };

        const KnowledgeTree = {
            components: { Icon },
            props: ['treeData', 'counts', 'activeNode', 'mode'],
            emits: ['select'],
            setup(props, { emit }) {
                const toggle = (node) => { node.expanded = !node.expanded; };
                const nodeKey = node => props.mode === 'personal' ? node.id : node.name;
                const select = node => { emit('select', { name: node?.name ?? null, id: node?.id, type: props.mode || 'system' }); };
                return { toggle, select, nodeKey };
            },
            template: '#knowledge-tree-tpl'
        };

        const QuestionPreview = {
            template: '#latex-preview-tpl',
            props: {
                question: { type: Object, required: true },
                images: { type: Array, default: () => [] },
                showAnswer: Boolean,
                class: { type: String, default: '' }
            },
            computed: {
                htmlContent() {
                    const question = this.question;
                    const render = source => renderLatexPreviewHtml(source, this.images);
                    const stem = '<div data-question-stem>' + render(question.stem) + '</div>';
                    const options = ['单选题', '多选题'].includes(question.type)
                        ? renderQuestionOptionsHtml(question.options, this.images, false) : '';
                    const support = this.showAnswer ? [
                        ['answer', '参考答案', 'text-green-700'],
                        ['solution', '深度解析', 'text-blue-600']
                    ].flatMap(([field, label, color]) => {
                        if (!question[field]) return [];
                        return [`<section class="qisi-question-support" data-image-region="${field}"><b class="library-answer-heading ${color}">【${label}】</b><div>${render(question[field])}</div></section>`];
                    }).join('') : '';
                    const html = `<div data-qisi-question-flow>${stem}${options}${support}</div>`;
                    return root.Qisi.FigureEditor?.layoutHtml(html, this.images) ?? html;
                }
            }
        };

        const SystemKnowledgeBadge = {
            props: {
                path: { type: Array, required: true },
                label: { type: String, default: '系统知识点' }
            },
            template: '#system-knowledge-badge-tpl'
        };

        const QuestionCard = {
            components: { QuestionPreview, Icon, SystemKnowledgeBadge },
            props: {
                q: { type: Object, required: true, default: () => ({}) },
                isSelected: { type: Boolean, default: false },
                flatKnowledge: { type: Array, default: () => [] },
                flatPersonalKnowledge: { type: Array, default: () => [] },
                saveQuestion: Function,
                externalMode: { type: Boolean, default: false },
                pickMode: { type: Boolean, default: false },
                checked: { type: Boolean, default: false },
                externalStatus: { type: String, default: '' }
            },
            emits: ['toggle-cart', 'delete', 'toggle-pick'],
            setup(props, { emit }) {
                const { ref, shallowRef, reactive, computed, toRaw, nextTick, onUnmounted, watch } = root.Vue;
                const showAnswer = ref(false);
                const isEditing = ref(false);
                const saving = ref(false);
                const saveError = ref('');
                const activeEditTab = ref('stem');
                const editorText = ref(null);
                const aiPanel = ref(null);
                const aiSuggestion = ref(null);
                const ai = root.Qisi.QuestionAi;
                const aiMetadata = ai.metadata;
                let aiController;
                const showEditKnowledge = ref(false);
                
                const q = props.q || {};
                // The card retains its editor image array across prop refreshes.
                // Keep those library URLs until this actual consumer unmounts.
                const releaseImageResources = root.Qisi.LibraryImageResources
                    ?.retainImageResources(q.images || []) || (() => {});
                onUnmounted(releaseImageResources);
                const editStem = ref('');
                const editImages = ref([]);
                let sourceVersion;
                const cardImages = root.Qisi.LibraryImageResources.useStoredImages(() => props.q.images || [], root.Vue);
                const editorImages = root.Qisi.LibraryImageResources.useStoredImages(() => isEditing.value ? editImages.value : [], root.Vue);
                const editOptions = ref([]);
                const editAnswer = ref('');
                const editSolution = ref('');
                const editTagsStr = ref('');
                const editGrade = ref('');
                const editType = ref('');
                const editDiff = ref('');
                const editKnowledge = ref('');
                const editSystemKnowledge = ref('');
                const editSystemKnowledgeId = ref(undefined);
                const knowledgeTree = reactive(MATH_KNOWLEDGE_TREE);
                const personalKnowledgeEdit = ref(null);
                const hoverL1 = ref(null);
                const undoHistory = shallowRef([]);
                const editorFields = [
                    editStem, editImages, editOptions, editAnswer, editSolution, editTagsStr, editGrade, editType,
                    editDiff, editKnowledge, editSystemKnowledge, editSystemKnowledgeId, personalKnowledgeEdit
                ];
                const snapshotEditor = () => editorFields.map(field => field.value);
                let lastEditorSnapshot = [];
                watch(editorFields, snapshot => {
                    if (!isEditing.value || snapshot.every((value, index) => value === lastEditorSnapshot[index])) return;
                    undoHistory.value = [...undoHistory.value.slice(-49), lastEditorSnapshot];
                    lastEditorSnapshot = snapshot;
                });
                const undoEditor = () => {
                    if (!isEditing.value || saving.value || !undoHistory.value.length) return;
                    lastEditorSnapshot = undoHistory.value.at(-1);
                    undoHistory.value = undoHistory.value.slice(0, -1);
                    editorFields.forEach((field, index) => { field.value = lastEditorSnapshot[index]; });
                };
                const handleEditorUndo = event => {
                    if ((!event.ctrlKey && !event.metaKey) || event.shiftKey || event.altKey || event.isComposing ||
                        event.key.toLowerCase() !== 'z' || !isEditing.value || !undoHistory.value.length) return;
                    event.preventDefault();
                    undoEditor();
                    if (event.target.matches('img')) event.currentTarget.focus({ preventScroll: true });
                };

                const currentEditText = computed({
                    get: () => activeEditTab.value === 'stem' ? editStem.value : activeEditTab.value === 'answer' ? editAnswer.value : editSolution.value,
                    set: (v) => { 
                        if (activeEditTab.value === 'stem') editStem.value = v; 
                        else if (activeEditTab.value === 'answer') editAnswer.value = v; 
                        else editSolution.value = v;
                    }
                });
                
                const isPropsModified = computed(() => true); 
                const hasAnswer = computed(() => Boolean(isEditing.value ? editAnswer.value || editSolution.value : props.q.answer || props.q.solution));
                const preparedQuestion = computed(() => splitQuestionForStorage(editStem.value, editType.value, toRaw(editOptions.value)));
                const previewQuestion = computed(() => isEditing.value
                    ? { ...preparedQuestion.value, answer: editAnswer.value, solution: editSolution.value }
                    : props.q);
                const savedPersonalKnowledge = computed(() => {
                    const current = props.q;
                    const legacy = getQuestionKnowledge(current, 'personal');
                    const ids = root.Qisi.PersonalKnowledgeModel.knowledgeIds(current);
                    const namesById = new Map(props.flatPersonalKnowledge.map(node => [node.id, node.name]));
                    const names = [...new Set(ids.map(id => namesById.get(id)).filter(Boolean))];
                    const label = names.join('、') || legacy;
                    const choice = ids.length === 1 && names.length ? 'node:' + ids[0] : (label || ids.length ? 'current' : '');
                    return { label, choice, name: names.join('\\') || legacy };
                });
                const editPersonalKnowledge = computed({
                    get: () => personalKnowledgeEdit.value?.name ?? savedPersonalKnowledge.value.name,
                    set: name => {
                        personalKnowledgeEdit.value = name === savedPersonalKnowledge.value.name ? null : { name };
                    }
                });
                const selectPersonalKnowledgeNode = node => {
                    personalKnowledgeEdit.value = { id: node.id, name: node.name };
                };
                const editPersonalKnowledgeLabel = computed(() => {
                    const edit = personalKnowledgeEdit.value;
                    const raw = edit?.name.trim() || '';
                    if (!raw || edit.id) return raw;
                    const { names, error } = root.Qisi.PersonalKnowledgeModel.parseTags(raw, { maxTags: Infinity });
                    return error ? raw : names.join('、');
                });
                const personalKnowledgeChoice = computed({
                    get: () => {
                        const edit = personalKnowledgeEdit.value;
                        if (!edit) return savedPersonalKnowledge.value.choice;
                        if (edit.id) return 'node:' + edit.id;
                        return edit.name.trim() ? 'manual' : '';
                    },
                    set: choice => {
                        if (choice === 'current') {
                            personalKnowledgeEdit.value = null;
                        } else if (!choice) {
                            personalKnowledgeEdit.value = { name: '' };
                        } else if (choice.startsWith('node:')) {
                            const node = props.flatPersonalKnowledge.find(row => row.id === choice.slice(5));
                            if (node) selectPersonalKnowledgeNode(node);
                        }
                    }
                });
                const savedSystemId = () => props.q.systemKnowledgeId ?? props.q.meta?.systemKnowledgeId;
                const systemNodeFor = (name, id) => props.flatKnowledge.find(node => node.id === id && node.name === name)
                    || props.flatKnowledge.find(node => node.name === name);
                const findSystemPath = (nodes, id) => {
                    for (const node of nodes) {
                        if (node.id === id) return [node];
                        const childPath = node.children?.length ? findSystemPath(node.children, id) : [];
                        if (childPath.length) return [node, ...childPath];
                    }
                    return [];
                };
                const editSystemLevels = computed(() => {
                    const node = systemNodeFor(editSystemKnowledge.value, editSystemKnowledgeId.value ?? savedSystemId());
                    const path = node ? findSystemPath(knowledgeTree, node.id) : [];
                    return [{
                        label: '系统知识点', nodes: knowledgeTree, parentId: '',
                        value: path[0]?.id || (editSystemKnowledge.value ? 'legacy' : '')
                    }, ...path.slice(0, 2).flatMap((parent, index) => parent.children?.length ? [{
                        label: index === 0 ? '二级系统知识点' : '三级系统知识点',
                        nodes: parent.children, parentId: parent.id, value: path[index + 1]?.id || ''
                    }] : [])];
                });
                const selectEditSystemKnowledge = id => {
                    if (id === 'legacy') return;
                    const node = props.flatKnowledge.find(row => row.id === id);
                    editSystemKnowledge.value = node?.name || '';
                    editSystemKnowledgeId.value = node?.id || '';
                };
                const cardKnowledge = computed(() => {
                    const current = props.q;
                    const savedSystem = getQuestionKnowledge(current, 'system');
                    const system = isEditing.value ? editSystemKnowledge.value : savedSystem;
                    const systemId = isEditing.value ? editSystemKnowledgeId.value ?? savedSystemId() : savedSystemId();
                    const systemPath = system ? (systemNodeFor(system, systemId)?.path || String(system)).split(' / ') : [];
                    const savedPersonal = savedPersonalKnowledge.value.label;
                    const personal = isEditing.value && personalKnowledgeEdit.value
                        ? editPersonalKnowledgeLabel.value : savedPersonal;
                    const wasClassified = savedSystem || savedPersonal;
                    return { systemPath, personal, legacy: system || personal || wasClassified ? '' : getQuestionKnowledge(current) };
                });

                const selectEditTab = field => {
                    activeEditTab.value = field;
                    if (field !== 'stem') showAnswer.value = true;
                };
                const beginEditing = field => {
                    if (!isEditing.value) {
                        const current = props.q;
                        sourceVersion = current.updatedAt ?? null;
                        editType.value = current.type || '解答题';
                        editOptions.value = [...(current.options || ['', '', '', ''])];
                        editStem.value = mergeStemWithOptions(current.stem || '', editOptions.value, editType.value);
                        editImages.value = (current.images || []).map(image => ({ ...image }));
                        editAnswer.value = current.answer || '';
                        editSolution.value = current.solution || '';
                        editTagsStr.value = (current.meta?.tags || current.tags || []).join(', ');
                        editGrade.value = current.meta?.grade || current.grade || '高一';
                        editDiff.value = current.meta?.diff || current.diff || '中等';
                        editKnowledge.value = current.meta?.knowledge || current.knowledge || '';
                        editSystemKnowledge.value = getQuestionKnowledge(current, 'system');
                        editSystemKnowledgeId.value = undefined;
                        personalKnowledgeEdit.value = null;
                        lastEditorSnapshot = snapshotEditor();
                        undoHistory.value = [];
                        saveError.value = '';
                        isEditing.value = true;
                    }
                    selectEditTab(field);
                };
                const editField = field => {
                    if (saving.value) return;
                    beginEditing(field);
                    nextTick(() => editorText.value?.focus());
                };
                const clearAiSuggestion = () => {
                    aiController?.abort();
                    aiController = null;
                    aiSuggestion.value = null;
                };
                onUnmounted(clearAiSuggestion);
                const aiQuestion = () => ({
                    ...preparedQuestion.value, answer: editAnswer.value, solution: editSolution.value
                });
                const aiSnapshot = () => JSON.stringify({
                    question: aiQuestion(), source: editStem.value, updatedAt: props.q.updatedAt,
                    grade: editGrade.value, diff: editDiff.value, systemKnowledge: editSystemKnowledge.value,
                    systemKnowledgeId: editSystemKnowledgeId.value, personalKnowledge: personalKnowledgeEdit.value ?? savedPersonalKnowledge.value.label
                });
                const requestAi = async mode => {
                    if (props.externalMode || props.pickMode || saving.value || aiSuggestion.value?.loading) return;
                    beginEditing(isEditing.value ? activeEditTab.value : 'stem');
                    const original = currentEditText.value;
                    const field = activeEditTab.value;
                    const snapshot = aiSnapshot();
                    const question = aiQuestion();
                    const controller = new AbortController();
                    clearAiSuggestion();
                    aiController = controller;
                    aiSuggestion.value = { mode, original, field, snapshot, loading: true, knowledge: '0', usePersonalKnowledge: false };
                    const result = aiSuggestion.value;
                    try {
                        if (mode === 'metadata') {
                            if (!question.stem.trim() || snapshot.length > 24000) {
                                result.error = '请填写题干，或缩短源码后再补全属性。';
                                return;
                            }
                            const suggestion = await ai.suggestMetadata({
                                question, title: props.q.title || props.q.meta?.title,
                                knowledge: props.flatPersonalKnowledge, systemKnowledge: props.flatKnowledge, signal: controller.signal
                            });
                            if (aiSuggestion.value === result) {
                                const type = suggestion.fields.type;
                                const isChoice = value => value === '单选题' || value === '多选题';
                                if (type && isChoice(type) !== isChoice(question.type) &&
                                    question.options.some(option => String(option || '').trim())) {
                                    delete suggestion.fields.type;
                                    result.notice = '建议题型与现有选项不匹配，已保留当前题型。';
                                }
                                Object.assign(result, suggestion);
                                result.useSystemKnowledge = Boolean(suggestion.systemNode);
                            }
                        } else {
                            if (!original.trim() || original.length > 16000) {
                                result.error = '请填写要校准的内容，长源码可分段手动校准。';
                                return;
                            }
                            const suggestion = await ai.calibrate(original, controller.signal);
                            if (aiSuggestion.value === result) Object.assign(result, suggestion);
                        }
                    } catch (error) {
                        if (aiSuggestion.value === result && !controller.signal.aborted) {
                            result.error = error.status === 401 || error.status === 403
                                ? 'AI 服务未授权，请检查千问配置。' : 'AI 请求未成功，可以重试或手动编辑。';
                        }
                    } finally {
                        if (aiSuggestion.value === result) {
                            result.loading = false;
                            await nextTick();
                            aiPanel.value?.scrollIntoView({ block: 'nearest' });
                        }
                    }
                };
                const applyAiSuggestion = () => {
                    const result = aiSuggestion.value;
                    if (!result || result.loading || saving.value) return;
                    if (result.snapshot !== aiSnapshot() || (result.mode === 'calibration' && result.field !== activeEditTab.value)) {
                        result.error = '编辑内容已更改，请按当前内容重新生成建议。';
                        return;
                    }
                    if (result.mode === 'calibration') {
                        if (!result.value) return;
                        currentEditText.value = result.value;
                    } else {
                        if (!result.fields) return;
                        const concept = result.usePersonalKnowledge ? result.concepts[Number(result.knowledge)] : null;
                        if (concept?.node) {
                            const match = root.Qisi.PersonalKnowledgeModel.knowledgeIndex(props.flatPersonalKnowledge).unique(concept.node.name);
                            if (match?.id !== concept.node.id) {
                                result.error = '建议的个人知识点已变化，请重新生成或手动选择。';
                                return;
                            }
                            selectPersonalKnowledgeNode(match);
                        } else if (concept) {
                            personalKnowledgeEdit.value = { name: concept.name };
                        }
                        if (result.useSystemKnowledge) selectEditSystemKnowledge(result.systemNode.id);
                        const { type, diff, grade } = result.fields;
                        if (type) editType.value = type;
                        if (diff) editDiff.value = diff;
                        if (grade) editGrade.value = grade;
                    }
                    clearAiSuggestion();
                    nextTick(() => editorText.value?.focus({ preventScroll: true }));
                };
                const toggleEditor = () => {
                    if (saving.value) return;
                    if (isEditing.value) {
                        clearAiSuggestion();
                        isEditing.value = false;
                    }
                    else editField('stem');
                };
                const updateFigureLayout = (id, layout, field = 'stem') => {
                    if (props.externalMode || props.pickMode || saving.value) return;
                    if (!isEditing.value) beginEditing(field);
                    editImages.value = editImages.value.map(image => image.id === id ? { ...image, layout } : image);
                };
                const handleToggleAnswer = () => { showAnswer.value = !showAnswer.value; };
                const handleDelete = () => {
                    if (!saving.value && confirm('确定将这道题移出题库？')) emit('delete', props.q.id);
                };
                const handleSaveProps = async () => {
                    if (!props.saveQuestion || saving.value) return;
                    const prepared = preparedQuestion.value;
                    saveError.value = '';
                    saving.value = true;
                    try {
                        await props.saveQuestion(q.id, prepared.stem, editImages.value, editGrade.value, prepared.type,
                            editDiff.value, editAnswer.value, editSolution.value, editTagsStr.value, prepared.options,
                            editKnowledge.value, editSystemKnowledge.value, getQuestionKnowledge(props.q, 'personal'), sourceVersion,
                            { personal: personalKnowledgeEdit.value, systemId: editSystemKnowledgeId.value });
                        clearAiSuggestion();
                        isEditing.value = false;
                    } catch (error) {
                        saveError.value = error?.code === 'write-conflict'
                            ? '这道题已在其他操作中修改。请先复制当前编辑内容，再取消编辑并重新打开。'
                            : (error?.message || '更新失败，请重试。');
                    } finally {
                        saving.value = false;
                    }
                };
                const handleToggleCart = () => { emit('toggle-cart', q.id); };
                const externalStatusText = computed(() => externalStatusLabel(props.externalStatus));
                const externalStatusClassName = computed(() => externalStatusClass(props.externalStatus));
                const externalStatusTip = computed(() => externalStatusReason(props.externalStatus));
                const externalProcessText = computed(() => externalProcessStatusLabel(props.q?.processStatus));
                const handleTogglePick = () => { emit('toggle-pick', q.id); };
                const escapeLocalRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const imageToken = (id) => `[[IMAGE:${String(id || '').trim()}]]`;
                const imageSnippet = (id, align = 'center') => {
                    const token = imageToken(id);
                    if (align === 'flushleft') return `\\begin{flushleft}${token}\\end{flushleft}`;
                    if (align === 'flushright') return `\\begin{flushright}${token}\\end{flushright}`;
                    return `\\begin{center}${token}\\end{center}`;
                };
                const removeImageCodeFromText = (text = '', id = '') => {
                    const escapedId = escapeLocalRegExp(id);
                    const tokenSource = `\\[\\[(?:IMAGE|FORMULA_IMAGE):${escapedId}\\]\\]`;
                    const includeSource = `\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedId}\\}`;
                    return String(text || '')
                        .replace(new RegExp(`\\n?\\\\begin\\{wrapfigure\\}\\s*\\{[lr]\\}\\s*\\{[^}]+\\}[\\s\\S]*?(?:${tokenSource}|${includeSource})[\\s\\S]*?\\\\end\\{wrapfigure\\}`, 'g'), '')
                        .replace(new RegExp(`\\n?\\\\begin\\{(?:center|flushleft|flushright)\\}[\\s\\S]*?(?:${tokenSource}|${includeSource})[\\s\\S]*?\\\\end\\{(?:center|flushleft|flushright)\\}`, 'g'), '')
                        .replace(new RegExp(`\\n?${includeSource}`, 'g'), '')
                        .replace(new RegExp(`\\n?${tokenSource}`, 'g'), '')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();
                };
                const replaceImageCodeAlign = (text = '', id = '', align = 'center') => {
                    const cleaned = removeImageCodeFromText(text, id);
                    return `${cleaned}\n${imageSnippet(id, align)}`.trim();
                };

                const handleImageUploadEvent = (e) => {
                    const file = e.target.files[0]; 
                    if (!file) return;
                    const reader = new FileReader(); 
                    reader.onload = (ev) => {
                        const id = 'img_' + Math.random().toString(36).substring(2,8);
                        editImages.value = [...editImages.value, { id, url: ev.target.result, align: 'center' }];
                        currentEditText.value += `\n${imageSnippet(id)}\n`;
                    }; 
                    reader.readAsDataURL(file); 
                    e.target.value = null;
                };

                const handleEditPaste = (e) => {
                    const item = Array.from(e.clipboardData?.items || []).find(i => i.kind === 'file');
                    if (item) {
                        e.preventDefault(); 
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const id = 'img_' + Math.random().toString(36).substring(2,8);
                            editImages.value = [...editImages.value, { id, url: ev.target.result, align: 'center' }];
                            currentEditText.value += `\n${imageSnippet(id)}\n`;
                        }; 
                        reader.readAsDataURL(item.getAsFile());
                    }
                };

                const changeImageAlign = (imgId, newAlign) => {
                    editImages.value = editImages.value.map(image => image.id === imgId ? { ...image, align: newAlign } : image);
                    editStem.value = replaceImageCodeAlign(editStem.value, imgId, newAlign);
                    editAnswer.value = replaceImageCodeAlign(editAnswer.value, imgId, newAlign);
                    editSolution.value = replaceImageCodeAlign(editSolution.value, imgId, newAlign);
                };

                const selectKnowledge = (name) => {
                    editKnowledge.value = name;
                    showEditKnowledge.value = false;
                };

                const removeImage = (id) => {
                    editImages.value = editImages.value.filter(i => i.id !== id);
                    editStem.value = removeImageCodeFromText(editStem.value, id);
                    editAnswer.value = removeImageCodeFromText(editAnswer.value, id);
                    editSolution.value = removeImageCodeFromText(editSolution.value, id);
                };
                const copySnippet = async (id) => {
                    const img = editImages.value.find(i => i.id === id);
                    const align = img && img.align ? img.align : 'center';
                    const snippet = imageSnippet(id, align);
                    const ok = await copyText(snippet);
                    alert(ok ? "LaTeX 短码已复制！配图选行内浮动时，请将短码置于文字内部！" : "复制失败，请手动复制短码。");
                };

                return { showAnswer, isEditing, saving, saveError, previewQuestion, activeEditTab, editorText, editStem, editImages, cardImages, editorImages, editOptions, editAnswer, editSolution, editTagsStr, editGrade, editType, editDiff, editKnowledge, editSystemKnowledge, editPersonalKnowledge, showEditKnowledge, knowledgeTree, hoverL1, currentEditText, isPropsModified, hasAnswer, toggleEditor, editField, updateFigureLayout, handleToggleAnswer, handleDelete, handleSaveProps, handleToggleCart, externalStatusText, externalStatusClassName, externalStatusTip, externalProcessText, handleTogglePick, handleImageUploadEvent, handleEditPaste, changeImageAlign, selectKnowledge, removeImage, copySnippet,
                    personalKnowledgeChoice, savedPersonalKnowledge, editPersonalKnowledgeLabel, editSystemLevels, selectEditSystemKnowledge, aiPanel, aiSuggestion, aiMetadata, requestAi,
                    applyAiSuggestion, clearAiSuggestion, cardKnowledge, undoHistory, undoEditor, handleEditorUndo };
            },
            template: '#question-card-tpl'
        };



    return { Icon, LatexPreview, KnowledgeTree, QuestionCard, renderQuestionOptionsHtml, renderLatexPreviewHtml };
});
