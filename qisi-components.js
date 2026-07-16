        const Icon = {
            props: ['name', 'size', 'class'],
            setup(props) {
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

        const renderQuestionOptionsHtml = (options = [], images = []) => {
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

            const columns = window.Qisi?.DocxLayout?.resolveOptionColumns
                ? window.Qisi.DocxLayout.resolveOptionColumns({ options: validRows.map(row => row.content) })
                : 1;
            return `<div class="gaokao-options qisi-flow-options" style="--qisi-option-columns:${columns}">` + rowsHtml + '</div>';
        };

        const LatexPreview = {
            template: '#latex-preview-tpl',
            props: {
                content: { type: String, default: '' },
                images: { type: Array, default: () => [] },
                class: { type: String, default: '' },
                options: { type: Array, default: () => [] },
                questionType: { type: String, default: '' },
                flowOptions: { type: Boolean, default: false }
            },
            computed: {
                htmlContent() {
                    const stemHtml = renderLatexPreviewHtml(this.content, this.images || []);
                    const isChoice = this.questionType === '单选题' || this.questionType === '多选题';

                    if (!this.flowOptions || !isChoice) {
                        return stemHtml;
                    }

                    return stemHtml + renderQuestionOptionsHtml(this.options, this.images || []);
                }
            }
        };

        const renderLatexPreviewHtml = (content, images = []) => {
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

                if (!img?.url || img.displayable === false) {
                    return `<span class="latex-image-placeholder">[图片暂不可预览:${escapeHtmlLocal(id)}]</span>`;
                }

                const placementClass = {
                    left: 'qisi-preview-image-left',
                    right: 'qisi-preview-image-right',
                    center: 'qisi-preview-image-center'
                }[placement] || 'qisi-preview-image-center';

                return (
                    `<span class="qisi-preview-image ${placementClass}" data-image-id="${escapeHtmlLocal(id)}">` +
                    `<img src="${escapeHtmlLocal(img.url)}" alt="题图" />` +
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
                const layoutApi = window.Qisi?.DocxLayout;
                const tableApi = window.Qisi?.DocxTableLatex;

                if (layoutApi?.replaceLayoutBlocks && layoutApi?.renderLayoutHtml) {
                    source = layoutApi.replaceLayoutBlocks(source, block => protectRenderedHtml(
                        layoutApi.renderLayoutHtml(block, {
                            renderImage: item => renderImageToken(item.id, 'center'),
                            renderContent: value => renderLatexPreviewHtml(value, images)
                        })
                    ));
                }

                if (
                    tableApi?.replaceLatexTableBlocks &&
                    tableApi?.renderLatexTableHtml
                ) {
                    source = tableApi.replaceLatexTableBlocks(source, block => protectRenderedHtml(
                        tableApi.renderLatexTableHtml(block, {
                            renderCell: cellContent => renderLatexPreviewHtml(cellContent, images)
                        })
                    ));
                }

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

                html = html
                    .replace(/\n{2,}/g, '<br><br>')
                    .replace(/\n/g, '<br>');

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
                if (/[一-龥]/.test(expression) && /\$/.test(expression)) {
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
                            segments.push(window.katex.renderToString(inner, {
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

                // If the expression is purely Chinese text, render as plain
                // text — don't pass it to KaTeX.
                if (/[一-龥]/.test(expression)) {
                    return renderPlainText(expression);
                }

                try {
                    if (!window.katex) throw new Error('KaTeX 尚未加载');
                    return window.katex.renderToString(expression, {
                        displayMode: Boolean(segment.displayMode),
                        throwOnError: true,
                        strict: 'ignore',
                        trust: false
                    });
                } catch (error) {
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

            const layoutApiForSource = window.Qisi?.DocxLayout;
            const layoutParts = layoutApiForSource?.splitLayoutBlocks
                ? layoutApiForSource.splitLayoutBlocks(content)
                : [{ kind: 'text', value: content }];
            if (
                layoutApiForSource?.renderLayoutHtml &&
                layoutParts.some(part => part.kind === 'layout')
            ) {
                return layoutParts.map(part => (
                    part.kind === 'layout'
                        ? layoutApiForSource.renderLayoutHtml(part.value, {
                            renderImage: item => renderImageToken(item.id, 'center'),
                            renderContent: value => renderLatexPreviewHtml(value, images)
                        })
                        : renderLatexPreviewHtml(part.value, images)
                )).join('');
            }

            const tableApiForSource = window.Qisi?.DocxTableLatex;
            const tableParts = tableApiForSource?.splitLatexTableBlocks
                ? tableApiForSource.splitLatexTableBlocks(content)
                : [{ kind: 'text', value: content }];
            if (
                tableApiForSource?.renderLatexTableHtml
                && tableParts.some(part => part.kind === 'table')
            ) {
                return tableParts.map(part => (
                    part.kind === 'table'
                        ? tableApiForSource.renderLatexTableHtml(part.value, {
                            renderCell: cellContent => renderLatexPreviewHtml(cellContent, images)
                        })
                        : renderLatexPreviewHtml(part.value, images)
                )).join('');
            }

            const displaySource = typeof window.Qisi?.Utils?.normalizeBareLatexForDisplayText === 'function'
                ? window.Qisi.Utils.normalizeBareLatexForDisplayText(content)
                : content;
            const source = String(displaySource || '')
                .replace(/\r\n?/g, '\n')
                .replace(/_*MATHPROTECT[_-]?\d+_*/gi, '')
                .replace(/@@QISI_MATH_\d+@@/g, '')
                .replace(/([\u4e00-\u9fa5])\n([\u4e00-\u9fa5])/g, '$1$2')
                .replace(/\n{3,}/g, '\n\n');

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
                'overline', 'overrightarrow', 'vec', 'sqrt', 'frac',
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
                        return window.katex.renderToString(normalized, {
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

            return parsed.segments
                .map(segment => segment.type === 'math'
                    ? renderMathSegmentForPreview(segment)
                    : renderTextWithBareLatex(segment.raw))
                .join('');
        };

        const KnowledgeTree = {
            components: { Icon },
            props: ['treeData', 'counts', 'activeNode', 'mode'],
            emits: ['select'],
            setup(props, { emit }) {
                const toggle = (node) => { node.expanded = !node.expanded; };
                const select = (name) => { emit('select', { name, type: props.mode || 'system' }); };
                return { toggle, select };
            },
            template: '#knowledge-tree-tpl'
        };

        const QuestionCard = {
            components: { LatexPreview, Icon },
            props: {
                q: { type: Object, required: true, default: () => ({}) },
                isSelected: { type: Boolean, default: false },
                flatKnowledge: { type: Array, default: () => [] },
                flatPersonalKnowledge: { type: Array, default: () => [] },
                externalMode: { type: Boolean, default: false },
                pickMode: { type: Boolean, default: false },
                checked: { type: Boolean, default: false },
                externalStatus: { type: String, default: '' }
            },
            emits: ['toggle-cart', 'edit', 'delete', 'toggle-pick'],
            setup(props, { emit }) {
                const showAnswer = ref(false);
                const isEditing = ref(false);
                const activeEditTab = ref('stem');
                const showEditKnowledge = ref(false);
                
                const q = props.q || {};
                const editStem = ref(mergeStemWithOptions(q.stem || '', q.options || ['', '', '', ''], q.type || '解答题'));
                const editImages = ref(q.images || []);
                const editOptions = ref(q.options ? [...q.options] : ['', '', '', '']);
                const editAnswer = ref(q.answer || '');
                const editSolution = ref(q.solution || '');
                const editTagsStr = ref((q.meta?.tags || q.tags || []).join(', '));
                const editGrade = ref(q.meta?.grade || q.grade || '高一');
                const editType = ref(q.type || '解答题');
                const editDiff = ref(q.meta?.diff || q.diff || '中等');
                const editKnowledge = ref(q.meta?.knowledge || q.knowledge || '');
                const editSystemKnowledge = ref(getQuestionKnowledge(q, 'system'));
                const editPersonalKnowledge = ref(getQuestionKnowledge(q, 'personal'));
                const hoverL1 = ref(null);

                const currentEditText = computed({
                    get: () => activeEditTab.value === 'stem' ? editStem.value : activeEditTab.value === 'answer' ? editAnswer.value : editSolution.value,
                    set: (v) => { 
                        if (activeEditTab.value === 'stem') editStem.value = v; 
                        else if (activeEditTab.value === 'answer') editAnswer.value = v; 
                        else editSolution.value = v;
                    }
                });
                
                const isPropsModified = computed(() => true); 
                const hasAnswer = computed(() => !!(q.answer || q.solution));

                const toggleEditor = () => { isEditing.value = !isEditing.value; activeEditTab.value = 'stem'; };
                const handleToggleAnswer = () => { showAnswer.value = !showAnswer.value; };
                const handleDelete = () => { if (confirm('确定彻底删除？')) emit('delete', q.id); };
                const handleSaveProps = () => {
                    const prepared = splitQuestionForStorage(editStem.value, editType.value, toRaw(editOptions.value));
                    editType.value = prepared.type;
                    emit('edit', q.id, prepared.stem, editImages.value, editGrade.value, prepared.type, editDiff.value, editAnswer.value, editSolution.value, editTagsStr.value, prepared.options, editKnowledge.value, editSystemKnowledge.value, editPersonalKnowledge.value); 
                    isEditing.value = false; 
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
                        editImages.value.push({ id, url: ev.target.result, align: 'center' });
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
                            editImages.value.push({ id, url: ev.target.result, align: 'center' });
                            currentEditText.value += `\n${imageSnippet(id)}\n`;
                        }; 
                        reader.readAsDataURL(item.getAsFile());
                    }
                };

                const changeImageAlign = (imgId, newAlign) => {
                    editImages.value.forEach(i => { if(i.id === imgId) i.align = newAlign; });
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

                const knowledgeTree = reactive(MATH_KNOWLEDGE_TREE);

                return { showAnswer, isEditing, activeEditTab, editStem, editImages, editOptions, editAnswer, editSolution, editTagsStr, editGrade, editType, editDiff, editKnowledge, editSystemKnowledge, editPersonalKnowledge, showEditKnowledge, knowledgeTree, hoverL1, currentEditText, isPropsModified, hasAnswer, toggleEditor, handleToggleAnswer, handleDelete, handleSaveProps, handleToggleCart, externalStatusText, externalStatusClassName, externalStatusTip, externalProcessText, handleTogglePick, handleImageUploadEvent, handleEditPaste, changeImageAlign, selectKnowledge, removeImage, copySnippet };
            },
            template: '#question-card-tpl'
        };


