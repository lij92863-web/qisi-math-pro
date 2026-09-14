(function (root, factory) {
    const editionPolicy = root.Qisi?.HandoutEditionPolicy
        || (
            typeof require === 'function'
                ? require('./qisi-handout-edition-policy.js')
                : null
        );
    const preview = root.Qisi?.HandoutPreview
        || (
            typeof require === 'function'
                ? require('./qisi-handout-preview.js')
                : null
        );
    const template = root.Qisi?.HandoutTypstTemplate
        || (
            typeof require === 'function'
                ? require('./qisi-handout-typst-template.js')
                : null
        );
    const qr = root.Qisi?.HandoutQr
        || (
            typeof require === 'function'
                ? require('./qisi-handout-qr.js')
                : null
        );
    const api = factory(editionPolicy, preview, template, qr);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutDocument = api;

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
    function (editionPolicy, preview, template, qr) {
        'use strict';

        if (!editionPolicy || !preview || !template || !qr) {
            throw new Error('handout document dependencies are unavailable');
        }

        const FORMULA_PATTERN =
            /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|(?<!\\)\$(?!\$)[^$\n]+?(?<!\\)\$)/g;
        const PLACEHOLDER_PATTERN = /\{([a-z][a-z0-9-]*)\}/gi;
        const ALLOWED_PLACEHOLDERS = Object.freeze([
            'title',
            'edition',
            'date',
            'filename',
            'teacher',
            'school',
            'page',
            'pages'
        ]);
        const QUESTION_LABELS = Object.freeze({
            none: '',
            exercise: '例题',
            example: '例题',
            practice: '练习',
            method: '方法',
            conclusion: '结论',
            authentic: '真题',
            theorem: '定理',
            variant: '变式',
            homework: '课后作业',
            error: '易错题'
        });
        const CALLOUT_COLORS = Object.freeze({
            method: Object.freeze({
                fill: '#eff6ff',
                stroke: '#bfdbfe',
                text: '#1e3a8a'
            }),
            warning: Object.freeze({
                fill: '#fff7ed',
                stroke: '#fed7aa',
                text: '#9a3412'
            }),
            note: Object.freeze({
                fill: '#f8fafc',
                stroke: '#cbd5e1',
                text: '#334155'
            }),
            teacher: Object.freeze({
                fill: '#f5f3ff',
                stroke: '#ddd6fe',
                text: '#5b21b6'
            }),
            conclusion: Object.freeze({
                fill: '#ecfdf5',
                stroke: '#a7f3d0',
                text: '#065f46'
            })
        });

        const typstStringLiteral = value => JSON.stringify(
            String(value == null ? '' : value)
        )
            .replace(/\u2028/g, '\\u{2028}')
            .replace(/\u2029/g, '\\u{2029}');

        const unwrapFormula = source => {
            if (source.startsWith('$$')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: true,
                    delimiter: '$$'
                };
            }
            if (source.startsWith('\\[')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: true,
                    delimiter: '\\['
                };
            }
            if (source.startsWith('\\(')) {
                return {
                    latex: source.slice(2, -2),
                    displayMode: false,
                    delimiter: '\\('
                };
            }
            return {
                latex: source.slice(1, -1),
                displayMode: false,
                delimiter: '$'
            };
        };

        const normalizeLatexForDisplay = (
            value,
            settingsValue = {}
        ) => {
            const original = String(value == null ? '' : value);
            const settings = settingsValue || {};
            const operations = [];
            let normalized = original;

            if (settings.useDisplayFractions) {
                const next = normalized.replace(
                    /(^|[^\\])\\frac\b/g,
                    '$1\\dfrac'
                );
                if (next !== normalized) {
                    operations.push('use-display-fractions');
                    normalized = next;
                }
            }
            if (settings.normalizePunctuation) {
                const next = normalized
                    .replace(/，/g, ',')
                    .replace(/；/g, ';')
                    .replace(/：/g, ':');
                if (next !== normalized) {
                    operations.push('normalize-punctuation');
                    normalized = next;
                }
            }
            if (settings.normalizeSpacing) {
                const next = normalized
                    .replace(/[\u00a0\u3000]/g, ' ')
                    .replace(/[ \t]{2,}/g, ' ')
                    .trim();
                if (next !== normalized) {
                    operations.push('normalize-spacing');
                    normalized = next;
                }
            }

            return Object.freeze({
                original,
                normalized,
                operations: Object.freeze(operations)
            });
        };

        const restoreLatexNormalization = (
            auditRecord,
            currentValue
        ) => {
            if (
                !auditRecord
                || typeof auditRecord.original !== 'string'
                || typeof auditRecord.normalized !== 'string'
            ) {
                throw new TypeError('formula audit record is invalid');
            }
            if (
                currentValue != null
                && String(currentValue) !== auditRecord.normalized
            ) {
                const error = new Error(
                    'formula changed after normalization; restoration is unsafe'
                );
                error.code = 'HANDOUT_FORMULA_AUDIT_MISMATCH';
                throw error;
            }
            return auditRecord.original;
        };

        const textSource = value => String(
            value == null ? '' : value
        )
            .split(/\r?\n/)
            .map(part => `#text(${typstStringLiteral(part)})`)
            .join('#linebreak()');

        const richTextToTypst = (
            value,
            {
                blockId,
                field,
                normalization,
                audit
            }
        ) => {
            const source = String(value == null ? '' : value);
            let cursor = 0;
            let formulaIndex = 0;
            const fragments = [];

            for (const match of source.matchAll(FORMULA_PATTERN)) {
                const plain = source.slice(cursor, match.index);
                if (plain) fragments.push(textSource(plain));

                const formula = unwrapFormula(match[0]);
                const normalized = normalizeLatexForDisplay(
                    formula.latex,
                    normalization
                );
                const formulaId = `${blockId}:${field}:${formulaIndex + 1}`;
                formulaIndex += 1;
                audit.push(Object.freeze({
                    formulaId,
                    blockId,
                    field,
                    delimiter: formula.delimiter,
                    displayMode: formula.displayMode,
                    original: normalized.original,
                    normalized: normalized.normalized,
                    operations: normalized.operations
                }));
                const formulaSource = formula.displayMode
                    ? `#block(width: 100%)[#mitex(${typstStringLiteral(normalized.normalized)})]`
                    : `#mi(${typstStringLiteral(normalized.normalized)})`;
                fragments.push([
                    `/* TEX-HANDOUT-FORMULA-BEGIN ${formulaId} */`,
                    formulaSource,
                    `/* TEX-HANDOUT-FORMULA-END ${formulaId} */`,
                    ''
                ].join('\n'));
                cursor = match.index + match[0].length;
            }

            const tail = source.slice(cursor);
            if (tail) fragments.push(textSource(tail));
            return fragments.join('');
        };

        const resolveLocalPlaceholderSource = (
            value,
            context
        ) => {
            const source = String(value || '');
            const fragments = [];
            let cursor = 0;

            for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
                const placeholder = match[1].toLowerCase();
                if (!ALLOWED_PLACEHOLDERS.includes(placeholder)) {
                    throw new TypeError(
                        `unsupported handout placeholder: ${placeholder}`
                    );
                }
                if (match.index > cursor) {
                    fragments.push(
                        textSource(source.slice(cursor, match.index))
                    );
                }

                if (placeholder === 'page') {
                    fragments.push('#counter(page).display()');
                } else if (placeholder === 'pages') {
                    fragments.push(
                        '#context counter(page).final().at(0)'
                    );
                } else {
                    fragments.push(
                        textSource(context[placeholder] || '')
                    );
                }
                cursor = match.index + match[0].length;
            }

            const unresolved = source.slice(cursor);
            if (unresolved) fragments.push(textSource(unresolved));
            return fragments.join('');
        };

        const normalizeAssetPath = value => {
            const path = String(value || '');
            if (
                !/^\/assets\/[a-z0-9._/-]+$/i.test(path)
                || path.includes('..')
                || path.includes('\\')
            ) {
                throw new TypeError('handout asset path is invalid');
            }
            return path;
        };

        const renderRegionAsset = (
            assetId,
            widthMm,
            state,
            regionName,
            slotName
        ) => {
            const configured = state.assetPathById[assetId];
            const rawPath = typeof configured === 'string'
                ? configured
                : configured?.path;
            state.assetRequests.push({
                assetId,
                blockId: `settings-${regionName}-${slotName}`,
                path: rawPath || ''
            });

            if (!rawPath) {
                state.diagnostics.push({
                    code: 'missing-asset-path',
                    blockId: `settings-${regionName}-${slotName}`,
                    assetId
                });
                return '';
            }

            try {
                const path = normalizeAssetPath(rawPath);
                return `image(${typstStringLiteral(path)}, width: ${Number(widthMm)}mm)`;
            } catch (error) {
                state.diagnostics.push({
                    code: 'invalid-asset-path',
                    blockId: `settings-${regionName}-${slotName}`,
                    assetId,
                    message: error.message
                });
                return '';
            }
        };

        const renderRegionSlot = (
            slot,
            context,
            state,
            regionName,
            slotName
        ) => {
            if (!slot?.enabled) return 'none';

            const expressions = [];
            if (slot.assetId) {
                const image = renderRegionAsset(
                    slot.assetId,
                    slot.imageWidthMm,
                    state,
                    regionName,
                    slotName
                );
                if (image) expressions.push(image);
            }
            if (String(slot.text || '')) {
                const content = resolveLocalPlaceholderSource(
                    slot.text,
                    context
                );
                expressions.push(
                    [
                        'text(',
                        `  font: ${typstStringLiteral(
                            slot.fontFamily === 'sans'
                                ? 'Noto Sans CJK SC'
                                : 'Noto Serif CJK SC'
                        )},`,
                        `  size: ${slot.fontSizePt}pt,`,
                        `  weight: ${slot.fontWeight},`,
                        `  fill: rgb("${slot.color}"),`,
                        `)[#set par(leading: ${slot.lineHeight}em)\n${content}]`
                    ].join('\n')
                );
            }
            if (!expressions.length) return 'none';

            const content = expressions.length === 1
                ? expressions[0]
                : `box[${expressions
                    .map((expression, index) =>
                        `${index ? '#h(3pt) ' : ''}#${expression}`
                    )
                    .join('')}]`;
            return `align(${slotName}, ${content})`;
        };

        const withAlpha = (color, opacity) => {
            const alpha = Math.round(
                Math.max(0, Math.min(1, Number(opacity))) * 255
            ).toString(16).padStart(2, '0');
            return `${String(color).slice(0, 7)}${alpha}`;
        };

        const renderRegionSource = (
            region,
            context,
            state,
            regionName,
            page
        ) => {
            if (!region?.enabled) {
                return template.trustedSource('none');
            }

            const cells = ['left', 'center', 'right'].map(slotName =>
                `[#${renderRegionSlot(
                    region.slots?.[slotName],
                    context,
                    state,
                    regionName,
                    slotName
                )}]`
            );
            const grid = [
                'grid(',
                '  columns: (1fr, 1fr, 1fr),',
                '  column-gutter: 5pt,',
                `  ${cells.join(',\n  ')},`,
                ')'
            ].join('\n');
            let content = (
                region.offsetLeftMm
                || region.offsetRightMm
            )
                ? `pad(left: ${region.offsetLeftMm}mm, right: ${region.offsetRightMm}mm, [#${grid}])`
                : grid;

            if (region.background?.enabled) {
                const fill = withAlpha(
                    region.background.color,
                    region.background.opacity
                );
                content = [
                    'rect(',
                    '  width: 100%,',
                    `  height: ${region.background.heightMm}mm,`,
                    `  fill: rgb("${fill}"),`,
                    '  stroke: none,',
                    '  inset: (x: 4pt, y: 2pt),',
                    `  [#${content}],`,
                    ')'
                ].join('\n');
                if (region.background.bleed) {
                    const margin = page?.margin || {};
                    const offset = Number(margin.leftMm || 0);
                    const extension = offset
                        + Number(margin.rightMm || 0);
                    content = (
                        `move(dx: -${offset}mm, box(width: 100% + ${extension}mm)[#${content}])`
                    );
                }
            }

            if (region.scope === 'first-only') {
                content = (
                    `if counter(page).get().first() == 1 { ${content} } else { none }`
                );
            } else if (region.scope === 'except-first') {
                content = (
                    `if counter(page).get().first() == 1 { none } else { ${content} }`
                );
            }

            return template.trustedSource(content);
        };

        const widthSource = width => width?.unit === 'mm'
            ? `${Number(width.value)}mm`
            : `${Number(width?.value || 45)}%`;

        const renderImage = (
            image,
            state,
            blockId
        ) => {
            const configured = state.assetPathById[image.assetId];
            const rawPath = typeof configured === 'string'
                ? configured
                : configured?.path;
            const assetRequest = {
                assetId: image.assetId,
                blockId,
                path: rawPath || ''
            };
            state.assetRequests.push(assetRequest);

            if (!rawPath) {
                state.diagnostics.push({
                    code: 'missing-asset-path',
                    blockId,
                    assetId: image.assetId
                });
                return (
                    '#rect(width: 100%, inset: 8pt, stroke: rgb("#fca5a5"), '
                    + `fill: rgb("#fef2f2"))[${textSource(`缺少图片资源：${image.assetId}`)}]`
                );
            }

            let path;
            try {
                path = normalizeAssetPath(rawPath);
            } catch (error) {
                state.diagnostics.push({
                    code: 'invalid-asset-path',
                    blockId,
                    assetId: image.assetId,
                    message: error.message
                });
                return (
                    '#rect(width: 100%, inset: 8pt, stroke: rgb("#fca5a5"), '
                    + `fill: rgb("#fef2f2"))[${textSource('图片路径无效')}]`
                );
            }

            const caption = String(image.caption || '').trim();
            const imageSource = (
                `image(${typstStringLiteral(path)}, width: ${widthSource(image.width)})`
            );
            const content = caption
                ? `figure(${imageSource}, caption: [${textSource(caption)}])`
                : imageSource;
            return `#align(${image.alignment === 'inline' ? 'center' : image.alignment}, ${content})`;
        };

        const renderImageGroup = (
            images,
            state,
            blockId,
            layout = {}
        ) => {
            const ordered = (images || [])
                .slice()
                .sort((left, right) =>
                    Number(left.order || 0) - Number(right.order || 0)
                );
            const mode = layout.mode || 'flow';

            if (
                ordered.length < 2
                || ['flow', 'vertical'].includes(mode)
            ) {
                return ordered
                    .map(image => renderImage(image, state, blockId))
                    .join('\n#v(4pt)\n');
            }

            const columns = mode === 'row'
                ? Math.min(4, ordered.length)
                : Math.max(
                    1,
                    Math.min(4, Number(layout.columns || 2))
                );
            const gapMm = Math.max(
                0,
                Math.min(20, Number(layout.gapMm || 0))
            );
            const cells = ordered.map(image =>
                `[${renderImage(image, state, blockId)}]`
            );

            return [
                '#grid(',
                `  columns: (${Array.from(
                    { length: columns },
                    () => '1fr'
                ).join(', ')}),`,
                `  column-gutter: ${gapMm}mm,`,
                `  row-gutter: ${gapMm}mm,`,
                `  ${cells.join(',\n  ')},`,
                ')'
            ].join('\n');
        };

        const renderOptions = (
            question,
            state,
            blockId
        ) => {
            if (!question.display.showOptions) return '';
            const optionItems = (
                Array.isArray(question.optionItems)
                    ? question.optionItems
                    : (Array.isArray(question.options)
                        ? question.options
                        : []
                    ).map((content, index) => ({
                        index,
                        content
                    }))
            ).map(item => ({
                index: Number(item.index),
                content: String(item.content || '')
            })).filter(item => item.content.trim());
            if (!optionItems.length) return '';
            const columns = preview.resolveOptionColumns(
                question.optionLayout?.mode || 'auto',
                optionItems.map(item => item.content)
            );
            const cells = optionItems.map(item => {
                const label = String.fromCharCode(
                    65 + item.index
                );
                const content = richTextToTypst(
                    item.content,
                    {
                        blockId,
                        field: `option${item.index}`,
                        normalization: question.latexNormalization || {},
                        audit: state.normalizationAudit
                    }
                );
                return `[${textSource(`${label}. `)}${content}]`;
            });

            return [
                '#grid(',
                `  columns: (${Array.from(
                    { length: columns },
                    () => '1fr'
                ).join(', ')}),`,
                '  column-gutter: 8pt,',
                '  row-gutter: 4pt,',
                `  ${cells.join(',\n  ')},`,
                ')'
            ].join('\n');
        };

        const renderQuestionTable = (
            table,
            state,
            blockId
        ) => {
            const columns = (
                table.columnWidths || []
            ).map(width =>
                `${Math.max(1, Number(width || 0))}%`
            ).join(', ');
            const cells = [];
            for (
                let rowIndex = 0;
                rowIndex < table.rows.length;
                rowIndex += 1
            ) {
                for (
                    let columnIndex = 0;
                    columnIndex < table.rows[rowIndex].length;
                    columnIndex += 1
                ) {
                    const cell =
                        table.rows[rowIndex][columnIndex];
                    if (cell.coveredBy) continue;
                    const content = richTextToTypst(
                        cell.content,
                        {
                            blockId,
                            field:
                                `table-${table.id}-r${rowIndex}c${columnIndex}`,
                            normalization: {},
                            audit: state.normalizationAudit
                        }
                    );
                    const options = [
                        `align: ${cell.align || 'center'}`
                    ];
                    if (cell.rowSpan > 1) {
                        options.push(
                            `rowspan: ${cell.rowSpan}`
                        );
                    }
                    if (cell.colSpan > 1) {
                        options.push(
                            `colspan: ${cell.colSpan}`
                        );
                    }
                    cells.push(
                        `table.cell(${options.join(', ')})[${content}]`
                    );
                }
            }
            const lines = [
                '#table(',
                `  columns: (${columns}),`,
                '  stroke: 0.5pt + rgb("#64748b"),',
                '  inset: (x: 5pt, y: 4pt),',
                `  ${cells.join(',\n  ')},`,
                ')'
            ];
            if (String(table.caption || '').trim()) {
                lines.push(
                    `#align(center)[#text(size: 8.5pt, fill: rgb("#64748b"))[${textSource(table.caption)}]]`
                );
            }
            return lines.join('\n');
        };

        const renderQuestionTables = (
            question,
            placement,
            state,
            blockId
        ) => (question.tables || [])
            .filter(table => table.placement === placement)
            .map(table =>
                renderQuestionTable(table, state, blockId)
            )
            .join('\n#v(5pt)\n');

        const renderQuestionQr = (
            question,
            state,
            blockId
        ) => {
            if (!question.qr?.enabled) return '';
            const content =
                question.qr.contentMode === 'question-id'
                    ? question.sourceQuestionId
                    : question.qr.customContent;
            if (!String(content || '').trim()) {
                state.diagnostics.push({
                    code: 'qr-content-empty',
                    blockId,
                    message: '题目二维码内容为空'
                });
                return '';
            }
            try {
                const svg = qr.toSvg(content);
                const image = (
                    `#image.decode(bytes(${typstStringLiteral(svg)}), format: "svg", width: ${question.qr.sizeMm}mm)`
                );
                const label = String(
                    question.qr.label || ''
                ).trim();
                return label
                    ? [
                        '#align(right)[',
                        `  ${image}`,
                        `  #linebreak()#text(size: 8pt, fill: rgb("#64748b"))[${textSource(label)}]`,
                        ']'
                    ].join('\n')
                    : `#align(right)[${image}]`;
            } catch (error) {
                state.diagnostics.push({
                    code: 'qr-content-too-long',
                    blockId,
                    message: error?.message || String(error)
                });
                return '';
            }
        };

        const renderQuestionLabel = question => {
            const labels = (question.displayLabels || [])
                .map(label => {
                    const value = String(
                        label?.value || ''
                    ).trim();
                    return label?.type === 'preset'
                        ? QUESTION_LABELS[value] || value
                        : value;
                })
                .filter(Boolean);
            if (labels.length) return labels.join(' · ');
            const custom = String(
                question.questionLabel?.customText || ''
            ).trim();
            if (custom) return custom;
            return QUESTION_LABELS[
                question.questionLabel?.preset
            ] || '';
        };

        const renderMetadata = question => {
            const items = [];
            if (
                question.display.showKnowledgePoints
                && Array.isArray(question.knowledgePoints)
            ) {
                items.push(...question.knowledgePoints);
            }
            if (question.display.showSource && question.source) {
                items.push(question.source);
            }
            if (
                question.display.showTags
                && Array.isArray(question.tags)
            ) {
                items.push(...question.tags);
            }
            if (question.display.showYear && question.year) {
                items.push(question.year);
            }
            if (
                question.display.showDifficulty
                && question.diff
            ) {
                items.push(question.diff);
            }
            const unique = [...new Set(
                items.map(value => String(value || '').trim())
                    .filter(Boolean)
            )];
            return unique.length
                ? `#text(size: 8.5pt, fill: rgb("#64748b"))[${textSource(unique.join(' · '))}]`
                : '';
        };

        const renderField = (
            question,
            field,
            title,
            state,
            blockId
        ) => {
            const value = String(question[field] || '').trim();
            if (!value) return '';
            return [
                `#strong[${textSource(title)}]`,
                richTextToTypst(value, {
                    blockId,
                    field,
                    normalization: question.latexNormalization || {},
                    audit: state.normalizationAudit
                })
            ].join(' ');
        };

        const renderQuestion = (
            block,
            state,
            order
        ) => {
            const question = block.question;
            const blockId = block.id;
            const label = renderQuestionLabel(question);
            const number = String(
                question.questionNumber || order
            );
            const prefix = [
                label,
                question.display.showQuestionNumber
                    ? `${number}.`
                    : ''
            ].filter(Boolean).join(' ');
            const stem = richTextToTypst(
                question.stem,
                {
                    blockId,
                    field: 'stem',
                    normalization: question.latexNormalization || {},
                    audit: state.normalizationAudit
                }
            );
            const metadata = renderMetadata(question);
            const images = Array.isArray(question.images)
                ? question.images
                : [];
            const rightOfStem = images.filter(
                image => image.placement === 'right-of-stem'
            );
            const rightOfOptions = images.filter(
                image => image.placement === 'right-of-options'
            );
            const belowStem = images.filter(
                image => image.placement === 'below-stem'
            );
            const afterOptions = images.filter(
                image => ![
                    'right-of-stem',
                    'right-of-options',
                    'below-stem'
                ].includes(image.placement)
            );
            const stemSource = `${prefix ? `${textSource(`${prefix} `)}` : ''}${stem}`;
            const stemLayout = rightOfStem.length
                ? [
                    '#grid(',
                    '  columns: (1.55fr, 1fr),',
                    '  column-gutter: 10pt,',
                    `  [${stemSource}],`,
                    `  [${renderImageGroup(rightOfStem, state, blockId, question.imageLayout)}],`,
                    ')'
                ].join('\n')
                : stemSource;
            const options = renderOptions(question, state, blockId);
            const tablesAfterStem = renderQuestionTables(
                question,
                'after-stem',
                state,
                blockId
            );
            const tablesAfterOptions = renderQuestionTables(
                question,
                'after-options',
                state,
                blockId
            );
            const optionLayout = rightOfOptions.length
                ? [
                    '#grid(',
                    '  columns: (1.55fr, 1fr),',
                    '  column-gutter: 10pt,',
                    `  [${options}],`,
                    `  [${renderImageGroup(rightOfOptions, state, blockId, question.imageLayout)}],`,
                    ')'
                ].join('\n')
                : options;
            const inlineFields = [];
            const afterFields = [];

            for (const [field, title] of [
                ['answer', '答案'],
                ['analysis', '分析'],
                ['solution', '解析']
            ]) {
                const placement = question.display[
                    `${field}Placement`
                ];
                const rendered = renderField(
                    question,
                    field,
                    title,
                    state,
                    blockId
                );
                if (!rendered) continue;
                if (placement === 'inline') {
                    inlineFields.push(rendered);
                } else if (placement === 'after-question') {
                    afterFields.push(rendered);
                }
            }

            const lines = [
                '#block(width: 100%, breakable: true)[',
                stemLayout
            ];
            if (metadata) lines.push('#v(2pt)', metadata);
            if (belowStem.length) {
                lines.push(
                    '#v(5pt)',
                    renderImageGroup(
                        belowStem,
                        state,
                        blockId,
                        question.imageLayout
                    )
                );
            }
            if (tablesAfterStem) {
                lines.push('#v(5pt)', tablesAfterStem);
            }
            if (inlineFields.length) {
                lines.push(
                    '#h(6pt)',
                    inlineFields.join('#h(8pt)')
                );
            }
            if (optionLayout) lines.push('#v(5pt)', optionLayout);
            if (tablesAfterOptions) {
                lines.push('#v(5pt)', tablesAfterOptions);
            }
            if (afterOptions.length) {
                lines.push(
                    '#v(5pt)',
                    renderImageGroup(
                        afterOptions,
                        state,
                        blockId,
                        question.imageLayout
                    )
                );
            }
            if (question.display.answerSpaceLines > 0) {
                lines.push(
                    `#v(${question.display.answerSpaceLines * 1.4}em)`
                );
            }
            if (afterFields.length) {
                lines.push(
                    '#v(5pt)',
                    afterFields.join('\n#v(4pt)\n')
                );
            }
            if (
                question.display.showTeacherNote
                && question.teacherNote
            ) {
                lines.push(
                    '#v(5pt)',
                    renderField(
                        question,
                        'teacherNote',
                        '备注',
                        state,
                        blockId
                    )
                );
            }
            const qrSource = renderQuestionQr(
                question,
                state,
                blockId
            );
            if (qrSource) lines.push('#v(4pt)', qrSource);
            lines.push(']', '#v(7pt)');
            return lines.join('\n');
        };

        const renderNonQuestionBlock = (
            block,
            state
        ) => {
            if (block.type === 'heading') {
                return `#heading(level: ${block.level})[${richTextToTypst(
                    block.text,
                    {
                        blockId: block.id,
                        field: 'text',
                        normalization: {},
                        audit: state.normalizationAudit
                    }
                )}]`;
            }
            if (block.type === 'body') {
                return `${richTextToTypst(block.content, {
                    blockId: block.id,
                    field: 'content',
                    normalization: {},
                    audit: state.normalizationAudit
                })}\n#parbreak()`;
            }
            if (block.type === 'callout') {
                const colors = CALLOUT_COLORS[block.variant]
                    || CALLOUT_COLORS.note;
                const title = String(block.title || '').trim();
                const content = richTextToTypst(
                    block.content,
                    {
                        blockId: block.id,
                        field: 'content',
                        normalization: {},
                        audit: state.normalizationAudit
                    }
                );
                return [
                    '#rect(',
                    '  width: 100%,',
                    '  inset: 9pt,',
                    '  radius: 4pt,',
                    `  fill: rgb("${colors.fill}"),`,
                    `  stroke: rgb("${colors.stroke}"),`,
                    ')[',
                    `  #text(fill: rgb("${colors.text}"))[`,
                    title ? `    #strong[${textSource(title)}]#linebreak()` : '',
                    `    ${content}`,
                    '  ]',
                    ']'
                ].filter(Boolean).join('\n');
            }
            if (block.type === 'image') {
                return renderImage(block, state, block.id);
            }
            return '#pagebreak()';
        };

        const appendMappedBlock = (
            state,
            blockId,
            source
        ) => {
            state.bodyLines.push(
                `// TEX-HANDOUT-BLOCK-BEGIN ${blockId}`,
                source,
                `// TEX-HANDOUT-BLOCK-END ${blockId}`,
                ''
            );
        };

        const renderEndSections = (
            projection,
            state
        ) => {
            const sections = projection.endSections || [];
            if (!sections.length) return '';
            const titles = {
                answer: '答案',
                analysis: '分析',
                solution: '解析'
            };
            const questionNumbers = new Map();
            let nextQuestionNumber = 1;
            for (const block of projection.blocks || []) {
                if (block.type !== 'question') continue;
                questionNumbers.set(block.id, nextQuestionNumber);
                nextQuestionNumber += 1;
            }

            return ['answer', 'analysis', 'solution']
                .map(field => {
                    const fieldSections = sections.filter(
                        section => section.field === field
                    );
                    if (!fieldSections.length) return '';

                    const lines = [
                        `#heading(level: 2)[${textSource(titles[field])}]`
                    ];
                    for (const section of fieldSections) {
                        const content = richTextToTypst(
                            section.content,
                            {
                                blockId: section.blockId,
                                field: section.field,
                                normalization: {},
                                audit: state.normalizationAudit
                            }
                        );
                        const questionNumber = questionNumbers.get(
                            section.blockId
                        ) || section.questionNumber || '';
                        if (
                            section.mode === 'end-with-summary'
                            && String(section.summary || '').trim()
                        ) {
                            lines.push(
                                `${textSource(`${questionNumber}. `)}${richTextToTypst(
                                    section.summary,
                                    {
                                        blockId: section.blockId,
                                        field: 'stem-summary',
                                        normalization: {},
                                        audit: state.normalizationAudit
                                    }
                                )}`,
                                '#v(2pt)'
                            );
                        }
                        lines.push(
                            `${textSource(`${questionNumber}. `)}${content}`,
                            '#v(5pt)'
                        );
                    }
                    return lines.join('\n');
                })
                .filter(Boolean)
                .join('\n');
        };

        const buildLineMap = source => {
            const lines = source.split('\n');
            const openBlocks = new Map();
            const openFormulas = new Map();
            const result = [];
            let currentBlockId = '';

            lines.forEach((line, index) => {
                const begin = line.match(
                    /^\/\/ TEX-HANDOUT-BLOCK-BEGIN (.+)$/
                );
                if (begin) {
                    currentBlockId = begin[1];
                    openBlocks.set(begin[1], index + 1);
                    return;
                }
                const formulaBegin = line.match(
                    /\/\* TEX-HANDOUT-FORMULA-BEGIN (.+?) \*\//
                );
                if (formulaBegin) {
                    openFormulas.set(formulaBegin[1], {
                        blockId: currentBlockId || 'document',
                        startLine: index + 1
                    });
                    return;
                }
                const formulaEnd = line.match(
                    /\/\* TEX-HANDOUT-FORMULA-END (.+?) \*\//
                );
                if (formulaEnd) {
                    const opened = openFormulas.get(formulaEnd[1]);
                    if (opened) {
                        result.push(Object.freeze({
                            path: template.MAIN_FILE_PATH,
                            blockId: opened.blockId,
                            formulaId: formulaEnd[1],
                            startLine: opened.startLine,
                            endLine: index + 1
                        }));
                        openFormulas.delete(formulaEnd[1]);
                    }
                    return;
                }
                const end = line.match(
                    /^\/\/ TEX-HANDOUT-BLOCK-END (.+)$/
                );
                if (!end) return;
                const startLine = openBlocks.get(end[1]);
                if (startLine) {
                    result.push(Object.freeze({
                        path: template.MAIN_FILE_PATH,
                        blockId: end[1],
                        formulaId: null,
                        startLine,
                        endLine: index + 1
                    }));
                    openBlocks.delete(end[1]);
                }
                if (currentBlockId === end[1]) currentBlockId = '';
            });

            return Object.freeze(result.sort((left, right) =>
                left.startLine - right.startLine
                || Number(Boolean(right.formulaId))
                    - Number(Boolean(left.formulaId))
            ));
        };

        const scanSourceForProtectedContent = (
            source,
            protectedNeedles
        ) => {
            const findings = [];
            for (const needle of protectedNeedles) {
                const value = String(needle || '');
                if (value && source.includes(value)) {
                    findings.push({
                        code: 'protected-content-in-source',
                        value
                    });
                }
            }
            return findings;
        };

        const buildTypstDocument = (
            handout,
            edition = 'student',
            {
                assetPathById = {}
            } = {}
        ) => {
            const projection = editionPolicy.resolveHandoutForEdition(
                handout,
                edition
            );
            const protectedNeedles = editionPolicy.collectProtectedNeedles(
                handout
            );

            if (edition === 'student') {
                editionPolicy.assertStudentProjectionSafe(
                    projection,
                    { protectedNeedles }
                );
            }

            const state = {
                assetPathById: assetPathById || {},
                assetRequests: [],
                diagnostics: [],
                normalizationAudit: [],
                bodyLines: []
            };
            let questionOrder = 0;

            for (const block of projection.blocks) {
                if (block.type === 'question') {
                    questionOrder += 1;
                    appendMappedBlock(
                        state,
                        block.id,
                        renderQuestion(block, state, questionOrder)
                    );
                } else {
                    appendMappedBlock(
                        state,
                        block.id,
                        renderNonQuestionBlock(block, state)
                    );
                }
            }

            const placeholderContext = {
                title: projection.title,
                filename: projection.title,
                edition: edition === 'student'
                    ? '学生版'
                    : '教师版',
                date: projection.settings.documentDate || '',
                teacher: projection.settings.metadata?.teacher || '',
                school: projection.settings.metadata?.school || ''
            };
            const rendered = template.renderDefaultA4Template({
                title: template.trustedSource(
                    textSource(projection.title)
                ),
                edition,
                page: projection.settings.page,
                header: renderRegionSource(
                    projection.settings.header,
                    placeholderContext,
                    state,
                    'header',
                    projection.settings.page
                ),
                footer: renderRegionSource(
                    projection.settings.footer,
                    placeholderContext,
                    state,
                    'footer',
                    projection.settings.page
                ),
                headerSettings: projection.settings.header,
                footerSettings: projection.settings.footer,
                body: template.trustedSource(
                    state.bodyLines.join('\n')
                ),
                endSections: template.trustedSource(
                    renderEndSections(projection, state)
                )
            });
            const sourceFindings = edition === 'student'
                ? scanSourceForProtectedContent(
                    rendered.source,
                    protectedNeedles
                )
                : [];

            if (sourceFindings.length) {
                const error = new Error(
                    'student Typst source contains protected content'
                );
                error.code = 'HANDOUT_STUDENT_SOURCE_LEAKAGE';
                error.findings = sourceFindings;
                throw error;
            }

            return Object.freeze({
                ...rendered,
                edition,
                source: rendered.source,
                lineMap: buildLineMap(rendered.source),
                projection,
                normalizationAudit: Object.freeze(
                    state.normalizationAudit
                ),
                assetRequests: Object.freeze(
                    state.assetRequests
                ),
                diagnostics: Object.freeze(
                    state.diagnostics
                ),
                readyForCompile: state.diagnostics.length === 0,
                leakageReport: Object.freeze({
                    ok: true,
                    findings: Object.freeze([])
                })
            });
        };

        return {
            FORMULA_PATTERN,
            ALLOWED_PLACEHOLDERS,
            typstStringLiteral,
            unwrapFormula,
            normalizeLatexForDisplay,
            restoreLatexNormalization,
            resolveLocalPlaceholderSource,
            normalizeAssetPath,
            buildLineMap,
            buildTypstDocument
        };
    }
);
