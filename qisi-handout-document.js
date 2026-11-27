(function (root, factory) {
    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutDocument = factory(root);
})(globalThis, function (root) {
    'use strict';

    const { limit, color, fonts, sourceNumber } = root.Qisi.HandoutLayout;
    const escape = root.Qisi.ExamPaperParts.escapeHtml;
    const safeImage = root.Qisi.QuestionImagePolicy.displayImageUrl;
    const render = (content, images) => root.Qisi.Components.renderLatexPreviewHtml(content, images, { preserveLineBreaks: true });
    const kinds = ['title', 'heading', 'text', 'knowledge', 'question', 'divider', 'image'];
    const id = () => root.crypto.randomUUID();
    const copy = value => JSON.parse(JSON.stringify(value));
    const string = value => typeof value === 'string' ? value : '';
    const style = { font: 'song', size: 15, line: 1.65, align: 'left', bold: false, color: '#17242d',
        painted: false, background: '#f3f7f6', paddingX: 0, paddingY: 0, radius: 4, border: 'none', stroke: '#bdd0cc', strokeWidth: 1,
        stemBold: false, stemColor: '#17242d', answerFont: 'song', answerSize: 14, answerColor: '#193c43',
        solutionFont: 'song', solutionSize: 14, solutionColor: '#29454d' };
    const makeBand = () => Object.fromEntries(['left', 'center', 'right'].map(side => [side, {
        enabled: false, content: '', image: '', range: 'all', font: 'kai', size: 14,
        color: '#22536d', bold: false, imageHeight: 40
    }]));
    const bodyTemplateName = '24讲义 · 正文';
    const bodyColors = {
        accent: '#3c71b7', overviewFill: '#ebf1f8', theoremFill: '#fff8ef', theoremBorder: '#f5a75b',
        theoremBadge: '#ff8618', theoremText: '#161616', example: '#008b4c', note: '#a54d00'
    };
    const bodyText = {
        overview: '基本概念\n典型例题\n方法归纳\n课后练习',
        theoremLabel: '定理',
        theorem: '在此输入定理，支持 LaTeX 公式。',
        note: '在此填写易混概念、适用条件或常见错误。'
    };
    const moduleColors = { fill: '#eef5fb', border: '#7295b8', badge: '#d3e5f6', ink: '#20334b' };

    function normalizeModule(raw, index = 0) {
        return {
            id: string(raw?.id) || id(),
            name: string(raw?.name).trim().slice(0, 120) || `自定义模块 ${index + 1}`,
            kind: ['box', 'text', 'heading'].includes(raw?.kind) ? raw.kind : 'box',
            content: string(raw?.content),
            colors: Object.fromEntries(Object.entries(moduleColors).map(([key, fallback]) => [key, color(raw?.colors?.[key], fallback)]))
        };
    }

    function normalizeBody(raw) {
        const colors = Object.fromEntries(Object.entries(bodyColors).map(([key, fallback]) => {
            const hex = color(raw?.colors?.[key], fallback);
            return [key, hex.length === 4 ? '#' + [...hex.slice(1)].map(ch => ch.repeat(2)).join('') : hex];
        }));
        const text = Object.fromEntries(Object.entries(bodyText).map(([key, fallback]) =>
            [key, typeof raw?.text?.[key] === 'string' ? raw.text[key] : fallback]));
        text.theoremLabel = text.theoremLabel.trim() || bodyText.theoremLabel;
        const modules = Array.isArray(raw?.modules) ? raw.modules.map(normalizeModule) : [];
        return { colors, text, modules };
    }

    function bodyColorVars(colors) {
        return {
            '--hc-body-accent': colors.accent,
            '--hc-body-overview-fill': colors.overviewFill,
            '--hc-body-theorem-fill': colors.theoremFill,
            '--hc-body-theorem-border': colors.theoremBorder,
            '--hc-body-theorem-badge': colors.theoremBadge,
            '--hc-body-example': colors.example,
            '--hc-body-note': colors.note
        };
    }

    function settings() {
        const footer = makeBand();
        Object.assign(footer.center, { enabled: true, content: '第 {page} / {pages} 页', color: '#17242d' });
        return { mode: 'single', paper: 'a4', width: 210, height: 297, zoom: 100, zoomFit: true, autosave: true,
            marginTop: 20, marginRight: 20, marginBottom: 20, marginLeft: 20,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
            columnGap: 8, separator: false, separatorType: 'dashed', separatorColor: '#a2aab0', separatorWidth: 1, separatorHeight: 100,
            frame: 'none', frameColor: '#17242d', frameWidth: 1, blockGap: 18, perPage: 0,
            header: makeBand(), footer, bandMode: 'sheet', startPage: 1, startNumber: 1, overrideTotal: false, totalPages: 1,
            headerLeft: 0, headerRight: 0, footerLeft: 0, footerRight: 0,
            headerLine: false, footerLine: false, headerPaint: false, footerPaint: false, bandColor: '#f0f5f4',
            watermark: '', watermarkImage: '', watermarkColor: '#526f73', watermarkOpacity: 12, watermarkSize: 45, watermarkAngle: -30,
            seal: false, sealSide: 'left', sealWidth: 14, sealText: '姓名____________  班级____________  学号____________', sealColor: '#647477', sealType: 'dashed',
            prefix: '[autoNum].', firstQuestion: 1, prefixModel: 'hanging', prefixColor: '#17242d', prefixBackground: '#e8f2ef',
            sourceTitle: false, sourceYear: false, sourceNumber: false, sourceType: false, sourceKnowledge: false,
            showAnswer: false, showSolution: false, answerPlacement: 'inline', theme: '', style: { ...style } };
    }

    function bodyTemplate(saved) {
        const s = settings();
        const body = normalizeBody(saved?.body);
        const { accent } = body.colors;
        Object.assign(s, { theme: 'body24', body, blockGap: 7, marginTop: 26, marginBottom: 21, prefixColor: accent, headerLine: true });
        const bandStyle = { enabled: true, font: 'latex', size: 12, color: accent };
        Object.assign(s.header.right, bandStyle, { content: '{section}' });
        Object.assign(s.footer.center, bandStyle, { content: '{page}' });
        Object.assign(s.style, { font: 'latex', answerFont: 'latex', solutionFont: 'latex', size: 40 / 3, line: 1.55,
            color: '#161616', stemColor: '#161616', answerSize: 40 / 3, solutionSize: 40 / 3,
            answerColor: '#161616', solutionColor: '#161616' });
        return { name: string(saved?.name).trim().slice(0, 120) || bodyTemplateName, settings: s };
    }

    function create() {
        return { schema: 1, id: id(), name: '未命名讲义', blocks: [], settings: settings(), updatedAt: 0 };
    }

    function block(kind, values = {}) {
        return { kind, text: '', questionId: null, space: 0, breakBefore: '', style: {}, figures: {},
            optionsMode: 'auto', prefix: null, prefixModel: null, box: '', split: false, ...values, id: id() };
    }

    function moduleBlock(module) {
        const values = { text: module.content, style: { color: module.colors.ink } };
        if (module.kind !== 'box') return block(module.kind, values);
        return block('text', { ...values, bodyLabel: module.name, moduleBox: {
            fill: module.colors.fill, border: module.colors.border, badge: module.colors.badge
        } });
    }

    function mergeSettings(raw) {
        const defaults = settings();
        const merged = { ...defaults, ...raw, style: { ...style, ...raw?.style } };
        if (merged.theme === 'body24') merged.body = normalizeBody(raw?.body);
        if (typeof raw?.zoomFit !== 'boolean') merged.zoomFit = Number(raw?.zoom ?? 100) === 100;
        if (!['flow', 'single', 'double'].includes(merged.mode)) merged.mode = 'single';
        for (const edge of ['header', 'footer']) {
            merged[edge] = Object.fromEntries(Object.keys(defaults[edge]).map(side =>
                [side, { ...defaults[edge][side], ...raw?.[edge]?.[side] }]));
        }
        return merged;
    }

    function normalize(raw, fresh = false, term = '讲义') {
        if (raw?.schema !== 1 || !Array.isArray(raw.blocks)) throw new Error(`请选择由${term}工作台导出的 JSON 文件。`);
        const used = new Set();
        const blocks = raw.blocks.map(source => {
            if (!kinds.includes(source?.kind)) throw new Error(`${term}中存在无法打开的区块。`);
            const entry = block(source.kind, source);
            if (typeof source.id === 'string' && !used.has(source.id)) entry.id = source.id;
            used.add(entry.id);
            entry.style = { ...source.style };
            entry.figures = { ...source.figures };
            return entry;
        });
        return { schema: 1, id: !fresh && typeof raw.id === 'string' ? raw.id : id(),
            name: string(raw.name).trim().slice(0, 120) || '未命名讲义', blocks, settings: mergeSettings(raw.settings), updatedAt: Number(raw.updatedAt) || 0 };
    }

    function question(data) {
        if (!data) return null;
        return { id: data.id, stem: string(data.stem), options: Array.isArray(data.options) ? data.options.map(string) : [],
            answer: string(data.answer), solution: string(data.solution), type: string(data.type),
            title: string(data.title || data.meta?.title || data.sourceTitle || data.source?.title || data.paperTitle),
            year: data.year || data.meta?.year || '', original: sourceNumber(data),
            knowledge: [data.knowledge, data.systemKnowledge, data.personalKnowledge].filter(Boolean).flat().join('、'),
            images: (Array.isArray(data.images) ? data.images : []).filter(Boolean).map(img => ({
                id: img.id || img.filename || img.name, url: safeImage(img.url), filename: img.filename,
                name: img.name, align: img.align, renderRole: img.renderRole, displayable: img.displayable,
                field: img.field || img.ownerField, width: img.width, layout: img.layout, storageImage: img.storageImage
            })) };
    }

    const font = value => (fonts[value] || fonts.song)[1];
    const lineStyle = value => ['solid', 'dashed', 'dotted', 'double'].includes(value) ? value : 'none';
    const align = value => ['left', 'center', 'right', 'justify'].includes(value) ? value : 'left';

    function blockStyle(entry, settings) {
        const body = settings.theme === 'body24';
        const heading = entry?.kind === 'heading';
        const colors = settings.body?.colors || bodyColors;
        let defaults = {};
        if (entry?.kind === 'title') {
            defaults = { ...(body ? { color: colors.accent, size: 22 } : { font: 'kai', size: 26 }), bold: true, align: 'center' };
        } else if (heading) {
            defaults = body ? { color: colors.accent, bold: true, size: entry.bodyRole === 'subheading' ? 16 : 18,
                align: entry.bodyRole === 'exercises' ? 'center' : 'left' } : { bold: true, size: 17 };
        } else if (body && entry?.bodyRole === 'theorem') {
            defaults = { color: colors.theoremText };
        }
        return { ...settings.style, ...defaults, ...entry?.style };
    }

    function cssStyle(entry, settings) {
        const s = blockStyle(entry, settings);
        const classic = entry.box === 'classic';
        const picture = entry.box === 'picture';
        const paddingX = limit(s.paddingX, 0, 80, 0) || (classic || picture ? 14 : 0);
        const paddingY = limit(s.paddingY, 0, 80, 0) || (classic || picture ? 10 : 0);
        const border = classic || picture ? 'solid' : lineStyle(s.border);
        return ['font-family:' + font(s.font), 'font-size:' + limit(s.size, 9, 70, 15) + 'px',
            'line-height:' + limit(s.line, 1, 3, 1.65), 'text-align:' + align(s.align), 'font-weight:' + (s.bold ? 700 : 400),
            'color:' + color(s.color), 'background:' + (classic || picture || s.painted ? color(s.background, '#f3f7f6') : 'transparent'),
            `padding:${paddingY}px ${paddingX}px`,
            'border-radius:' + limit(s.radius, 0, 36, 4) + 'px', `border:${limit(s.strokeWidth, 0, 8, 1)}px ${border} ${color(s.stroke, '#bdd0cc')}`,
            classic ? 'border-inline-start-width:4px' : ''].join(';');
    }

    function figureHtml(img, config = {}, fallback = 180) {
        const src = safeImage(config.url || img.url);
        if (!src || img.displayable === false) return '';
        const image = `<img src="${escape(src)}" alt="${escape(config.caption || '配图')}" style="width:${limit(config.width, 24, 1500, fallback)}px">`;
        return `<figure class="hc-figure" data-figure="${escape(img.id)}" style="text-align:${align(config.align || 'center')}">${image}${config.caption ? `<figcaption>${escape(config.caption)}</figcaption>` : ''}</figure>`;
    }

    function separateText(text) {
        text = text.replace(/\r\n?/g, '\n');
        const { segments } = root.Qisi.Utils.tokenizeLatexSource(text);
        const cuts = segments.filter(segment => segment.type !== 'math').flatMap(segment =>
            [...text.slice(segment.start, segment.end).matchAll(/\n/g)].map(match => segment.start + match.index));
        let start = 0;
        return [...cuts, text.length].map(end => {
            const part = text.slice(start, end).trim();
            start = end + 1;
            return part;
        });
    }

    function formattedPrefix(entry, q, number, settings) {
        const values = { autoNum: number, number: q.original, title: q.title, year: q.year };
        return String(entry.prefix ?? settings.prefix).replace(/\[(autoNum|number|title|year)\]/g, (_, key) => values[key] ?? '');
    }

    const previewSource = (settings, field) => settings.latexSelection ? ` data-latex-preview="${field}"` : '';

    function questionParts(entry, q, s, answerOnly = false, splitSupport = entry.split) {
        if (!q) return ['<div class="hc-missing">题库里的原题已移除。请重新选择题目，或删除此引用。</div>'];
        const data = { ...q, ...entry.override };
        const figures = [...(q.images || []), ...(Array.isArray(entry.localFigures) ? entry.localFigures : [])];
        const images = figures.map(img => ({ ...img, ...(entry.figures[img.id] || {}) }));
        const anchored = new Set();
        const afterStem = [], afterOptions = [];
        const stem = string(data.stem);
        const options = Array.isArray(data.options) ? data.options : [];
        const placement = Object.fromEntries(['left', 'right', 'below', 'optionLeft', 'optionRight', 'inline'].map(zone => [zone, []]));
        // The paginator may break between parts. Put the prompt illustration's
        // source in its anchor's part before measuring or splitting the question.
        for (const img of images) {
            const cfg = entry.figures[img.id] || {};
            const mentions = source => img.id && String(source || '').includes(String(img.id));
            const inPrompt = [stem, ...options].some(mentions);
            if (!inPrompt && ([data.answer, data.solution].some(mentions) || /^(answer|solution)$/.test(img.field))) continue;
            const anchor = img.layout?.anchor;
            if (anchor === 'stem' || (anchor === 'options' && options.some(opt => string(opt).trim()))) {
                anchored.add(String(img.id));
                (anchor === 'stem' ? afterStem : afterOptions).push(figureHtml(img, cfg));
            } else if (!inPrompt || cfg.place) {
                const spot = Object.hasOwn(placement, cfg.place) ? cfg.place : img.align === 'float-right' ? 'right' : img.align === 'float-left' ? 'left' : 'below';
                placement[spot].push(figureHtml(img, cfg));
            }
        }
        const renderContent = (body, relocate = true) => {
            const html = render(body, images);
            if ((!anchored.size && !Object.keys(entry.figures).length) || !html.includes('data-image-id=')) return html;
            const tree = document.createElement('template');
            tree.innerHTML = html;
            for (const node of tree.content.querySelectorAll('[data-image-id]')) {
                if (relocate && anchored.has(node.dataset.imageId)) { node.remove(); continue; }
                const cfg = entry.figures[node.dataset.imageId];
                if (!cfg) continue;
                if (cfg.place && relocate) node.remove();
                else {
                    node.style.textAlign = align(cfg.align || 'center');
                    const img = node.querySelector('img');
                    if (img) img.style.width = `${limit(cfg.width, 24, 1500, 180)}px`;
                    if (cfg.caption) {
                        const label = document.createElement('span');
                        label.className = 'hc-inline-caption';
                        label.textContent = cfg.caption;
                        node.append(label);
                    }
                }
            }
            return tree.innerHTML;
        };
        const solution = (name, label) => {
            const body = string(data[name]);
            if (!body) return [];
            const style = { ...s.style, ...entry.style };
            const regionStyle = `font-family:${font(style[`${name}Font`])};font-size:${limit(style[`${name}Size`], 9, 70, 14)}px;color:${color(style[`${name}Color`])}`;
            const heading = s.theme === 'body24' && name === 'solution' ? '解' : label;
            const previewOnly = s.previewSupport?.includes(name) ? ' data-preview-only' : '';
            const ignoreHeading = s.latexSelection ? ' data-latex-ignore' : '';
            return (splitSupport ? separateText(body) : [body]).map((part, index) => `<div class="hc-support"${previewOnly}${previewSource(s, name)} style="${escape(regionStyle)}">${index === 0 ? `<b${ignoreHeading}>${heading}　</b>` : ''}${renderContent(part, false) || '<br>'}</div>`);
        };
        const supporting = [...(s.showAnswer ? solution('answer', '答案') : []), ...(s.showSolution ? solution('solution', '解析') : [])];
        if (answerOnly) return supporting;
        const optionHtml = options.map((option, index) => string(option).trim() ? `<div class="hc-option"><span>${String.fromCharCode(65 + index)}.</span><div${previewSource(s, 'option-' + index)}>${renderContent(option)}</div></div>` : '').join('');
        const optionsMode = ['1', '2', '4'].includes(entry.optionsMode) ? entry.optionsMode : 'auto';
        const figureSide = (left, middle, right) => `<div class="hc-figure-row">${left.join('')}<div class="hc-figure-main">${middle}</div>${right.join('')}</div>`;
        const stemStyle = `color:${color(entry.style.stemColor || s.style.stemColor)};font-weight:${entry.style.stemBold ?? s.style.stemBold ? 700 : 'inherit'}`;
        const renderStem = value => `<div class="hc-stem"${previewSource(s, 'stem')} style="${stemStyle}">${renderContent(value) || '<br>'}</div>`;
        const renderedOptions = optionHtml ? `<div class="hc-options" data-options="${optionsMode}">${optionHtml}</div>` : '';
        const withOptions = (placement.optionLeft.length || placement.optionRight.length ? figureSide(placement.optionLeft, renderedOptions, placement.optionRight) : renderedOptions) + afterOptions.join('');
        const meta = [s.sourceTitle && q.title, s.sourceYear && q.year, s.sourceNumber && q.original && `原第 ${q.original} 题`,
            s.sourceType && q.type, s.sourceKnowledge && q.knowledge].filter(Boolean).map(escape).join(' · ');
        const lead = meta ? `<div class="hc-meta">${meta}</div>` : '';
        const sideImages = placement.left.length || placement.right.length;
        let prompt;
        if (sideImages) {
            prompt = [lead + figureSide(placement.left, renderStem(stem) + afterStem.join('') + placement.inline.join('') + withOptions, placement.right), ...placement.below];
        } else {
            const body = (entry.split ? separateText(stem) : [stem]).map(renderStem);
            body[body.length - 1] += afterStem.join('');
            body[0] = lead + body[0];
            prompt = [...body, ...placement.inline, withOptions, ...placement.below].filter(Boolean);
        }
        // Automatic breaks keep the stem, options and their figures together.
        if (splitSupport && !entry.split) prompt = [prompt.join('')];
        return [...prompt, ...(s.answerPlacement === 'inline' ? supporting : [])];
    }

    function contentParts(entry, q, s) {
        if (entry.kind === 'question') return questionParts(entry, q, s);
        if (entry.kind === 'divider') return ['<hr class="hc-rule">'];
        const text = string(entry.text);
        const overview = s.theme === 'body24' && entry.bodyRole === 'overview';
        const paragraphs = overview ? separateText(text).filter(Boolean) : entry.split ? separateText(text) : [text];
        const parts = paragraphs.map(value => `<div${previewSource(s, 'text')}>${render(value) || '<br>'}</div>`);
        if (entry.image) parts.unshift(figureHtml({ id: 'block-image', url: entry.image }, entry.figures['block-image'], 220));
        return parts.filter(Boolean);
    }

    function imageLayouts(entry, question) {
        if (!entry) return [];
        const sources = [...(question?.images || []), ...(entry.localFigures || [])];
        if (entry.image) sources.push({ id: 'block-image' });
        return sources.map(image => ({ ...image, layout: entry.figures[image.id]?.layout || image.layout }));
    }

    function wrap(entry, q, s, number, parts, continued = false, answerOnly = false, showSpace = true) {
        const questionBlock = entry.kind === 'question';
        const body = s.theme === 'body24';
        const bodyRole = body && ['overview', 'theorem', 'note', 'subheading', 'exercises', 'example'].includes(entry.bodyRole) ? entry.bodyRole : '';
        const example = questionBlock && bodyRole === 'example' && !answerOnly;
        const model = entry.prefixModel ?? (example ? 'inline' : s.prefixModel);
        const value = continued ? '续' : example ? `例题 ${number}` : q ? formattedPrefix(entry, q, number, s) : `${number}.`;
        const colors = s.body?.colors || bodyColors;
        const prefix = questionBlock && value && model !== 'off' ? `<span class="hc-prefix" style="color:${color(entry.prefixColor || (example ? colors.example : s.prefixColor))};--hc-prefix-bg:${color(entry.prefixBackground || s.prefixBackground, '#e8f2ef')}">${escape(value)}</span>` : '';
        const badgeLabels = { overview: '内容提要', theorem: '定理', note: '易错提醒' };
        const label = badgeLabels[bodyRole];
        const box = entry.moduleBox;
        const badge = label || box ? `<span class="hc-body24-badge">${escape(((box || bodyRole === 'theorem') && string(entry.bodyLabel).trim()) || label || '模块')}${continued ? '（续）' : ''}</span>` : '';
        const prefixModel = ['hanging', 'inline', 'pill', 'label'].includes(model) ? model : 'hanging';
        const bottom = showSpace && !answerOnly ? limit(entry.space, 0, 420, 0) : 0;
        const palette = body ? Object.entries(bodyColorVars(colors)).map(([key, value]) => `;${key}:${value}`).join('') : '';
        const boxVars = box ? `;--hc-module-fill:${color(box.fill, moduleColors.fill)};--hc-module-border:${color(box.border, moduleColors.border)};--hc-module-badge:${color(box.badge, moduleColors.badge)}` : '';
        const html = `<article class="hc-block hc-kind-${entry.kind} hc-prefix-${prefixModel}${body ? ' hc-body24' : ''}${bodyRole ? ' hc-body24-' + bodyRole : ''}${box ? ' hc-module-box' : ''}" style="${escape(cssStyle(entry, s) + palette + boxVars)}">${prefix}<div class="hc-block-body">${badge}${parts.join('')}</div></article>${bottom ? `<div class="hc-writing-space" style="height:${bottom}px"></div>` : ''}`;
        return root.Qisi.FigureEditor?.layoutHtml(html, imageLayouts(entry, q)) ?? html;
    }

    let storage, opening;
    const pendingPrefix = 'qisi_handout_pending:';

    function recordPending(doc) {
        try {
            root.localStorage.setItem(pendingPrefix + doc.id, JSON.stringify(doc));
            return true;
        } catch (_) { return false; }
    }

    function clearPending(doc) {
        try {
            const key = pendingPrefix + doc.id;
            const stored = JSON.parse(root.localStorage.getItem(key));
            if (stored && stored.updatedAt <= doc.updatedAt) root.localStorage.removeItem(key);
        } catch (_) {}
    }

    function pendingKeys() {
        try { return Object.keys(root.localStorage).filter(key => key.startsWith(pendingPrefix)); }
        catch (_) { return []; }
    }

    function discardPending() {
        for (const key of pendingKeys()) root.localStorage.removeItem(key);
    }

    async function recoverPending() {
        const { transaction } = storage;
        const keys = pendingKeys();
        for (const key of keys) {
            const raw = root.localStorage.getItem(key);
            let doc;
            try { doc = JSON.parse(raw); } catch (_) { continue; }
            if (!doc?.id || key !== pendingPrefix + doc.id || !Number.isFinite(doc.updatedAt) || !Array.isArray(doc.blocks)) continue;
            await transaction(['handoutEntries'], repo => repo.get('handoutEntries', 'doc:' + doc.id).then(previous =>
                (previous?.value?.updatedAt || 0) < doc.updatedAt ? store.save(doc) : undefined));
            if (root.localStorage.getItem(key) === raw) root.localStorage.removeItem(key);
        }
    }

    async function openStorage(database) {
        await database.open();
        const repository = root.Qisi.StorageRepository.createRepository(database);
        const migrationId = 'handout-storage-migrated';
        if (await repository.get('localSettings', migrationId)) return repository;
        let records = [];
        if (await root.Dexie.exists('QisiHandoutStudio')) {
            const legacy = new root.Dexie('QisiHandoutStudio');
            legacy.version(1).stores({ entries: 'id' });
            try { records = await legacy.table('entries').toArray(); }
            finally { legacy.close(); }
        }
        await repository.importLegacyHandouts(records, migrationId);
        return repository;
    }

    function migrateStorage(database) {
        if (!opening) opening = openStorage(database).then(repository => { storage = repository; }, error => {
            opening = undefined;
            throw error;
        });
        return opening;
    }

    function changeWorkspace(update, changeDocument = () => undefined) {
        if (!storage) return migrateStorage(db).then(() => changeWorkspace(update, changeDocument));
        const { transaction } = storage;
        return transaction(['handoutEntries'], repo => repo.get('handoutEntries', 'workspace').then(row => {
            const current = row?.value || {};
            const state = { current: current.current || null, saved: current.saved || [], templates: current.templates || [], bodyTemplate: current.bodyTemplate || null };
            const next = update(state);
            return Promise.resolve(changeDocument(repo)).then(() => repo.put('handoutEntries', { id: 'workspace', value: next })).then(() => next);
        }));
    }

    const store = {
        async get(key) {
            if (!storage) await migrateStorage(db);
            return storage.get('handoutEntries', key).then(row => row?.value);
        },
        save(doc) {
            return changeWorkspace(state => {
                const entry = { id: doc.id, name: doc.name, updatedAt: doc.updatedAt };
                return { ...state, current: doc.id, saved: [entry, ...state.saved.filter(row => row.id !== doc.id)] };
            }, repo => repo.put('handoutEntries', { id: 'doc:' + doc.id, value: doc }));
        },
        open(id) { return changeWorkspace(state => ({ ...state, current: id })); },
        remove(id) {
            return changeWorkspace(state => ({ ...state, current: state.current === id ? null : state.current, saved: state.saved.filter(row => row.id !== id) }),
                repo => repo.deleteMany('handoutEntries', ['doc:' + id]));
        },
        saveBodyTemplate(template) { return changeWorkspace(state => ({ ...state, bodyTemplate: template })); },
        changeTemplate(name, settings) {
            return changeWorkspace(state => {
                const remaining = state.templates.filter(template => template.name !== name);
                return { ...state, templates: settings ? [...remaining, { name, settings }] : remaining };
            });
        }
    };

    return Object.freeze({ create, normalize, mergeSettings, bodyTemplate, bodyColorVars, normalizeModule, moduleBlock, block, blockStyle, copy, question, contentParts, questionParts, wrap, figureHtml, imageLayouts, store, migrateStorage, recordPending, clearPending, recoverPending, discardPending, font, lineStyle, escape, safeImage, render });
});
