(function (root) {
    'use strict';

    const L = root.Qisi.HandoutLayout;
    const D = root.Qisi.HandoutDocument;
    const inspectorWidthKey = 'qisi_handout_inspector_width';
    const labels = { title: '卷名', heading: '小节', text: '文本', knowledge: '知识', question: '题目', divider: '分隔线', image: '图片' };
    const modes = [['flow', '流式'], ['single', '单列'], ['double', '双列']];
    const presets = [
        ['title', '标题', '数学专题练习'],
        ['text', '学生信息', '姓名 __________　　班级 __________　　学号 __________'],
        ['text', '试卷说明', '考试时间 ____ 分钟　　满分 ____ 分\n请在对应区域作答，解答题写出必要的步骤。'],
        ['heading', '单项选择题', '一、单项选择题'], ['heading', '多项选择题', '二、多项选择题'],
        ['heading', '填空题', '三、填空题'], ['heading', '解答题', '四、解答题'], ['divider', '水平分隔线', '']
    ];
    const bodyPresets = [
        ['title', '章标题', '第 1 章　专题名称'],
        ['heading', '节标题', '1.1　小节名称'],
        ['heading', '小节标题', '1.1.1　小节名称', 'subheading'],
        ['text', '内容提要', '', 'overview'],
        ['text', '定理框', '', 'theorem'],
        ['text', '易错提醒', '', 'note'],
        ['heading', '章末练习', '第 1 章　练习', 'exercises']
    ];
    const lines = [['solid', '实线'], ['dashed', '虚线'], ['dotted', '点线'], ['double', '双线']];
    const boxStyles = [['none', '无边框'], ...lines];
    const fonts = Object.entries(L.fonts).map(([key, [name]]) => [key, name]);
    const plain = D.render;
    function prepareColumn(node, scale = 1) {
        root.Qisi.FigureEditor.estimateAutoColumns(node, scale);
        root.Qisi.FigureEditor.compactLegacyFigures(node, scale);
    }

    function fitParts(parts, start, room, force, space, measure) {
        const end = parts.length;
        const probe = stop => {
            const row = measure(start, stop);
            return stop === end && space ? { ...row, height: row.height + space, space } : row;
        };
        let low = start + 1;
        let best = probe(low);
        if (best.height > room) return force ? [best, low] : null;
        // Grow the range from the start of this fragment, keeping measurements
        // close to a column's worth of content even in a very long solution.
        for (let high = Math.min(end, start + 2); low < end; high = Math.min(end, start + (high - start) * 2)) {
            const candidate = probe(high);
            if (candidate.height <= room) {
                best = candidate;
                low = high;
                continue;
            }
            while (high - low > 1) {
                const mid = Math.floor((low + high) / 2);
                const row = probe(mid);
                if (row.height > room) high = mid;
                else {
                    best = row;
                    low = mid;
                }
            }
            break;
        }
        return [best, low];
    }

    // Both views typeset at the physical column width. Only the final painting
    // is scaled, so browser line breaks and the document-space coordinates agree.
    const paperPreview = {
        mounted(frame, binding) {
            const column = frame.firstElementChild;
            const sync = () => {
                const width = parseFloat(getComputedStyle(column).width);
                if (!width || !frame.clientWidth) return;
                const scale = Math.min(2, frame.clientWidth / width);
                column.dataset.paperScale = scale;
                column.style.transform = 'scale(' + scale + ')';
                frame.style.height = Math.ceil(column.offsetHeight * scale) + 'px';
                binding.instance.$refs.figureEditor?.scheduleSync();
            };
            let revision = 0;
            const typeset = async () => {
                const id = ++revision;
                sync();
                await Promise.all([waitImages(column), document.fonts?.ready]);
                if (id !== revision || !frame.isConnected) return;
                prepareColumn(column, Number(column.dataset.paperScale) || 1);
                sync();
            };
            let animation = 0;
            const observer = new ResizeObserver(() => {
                cancelAnimationFrame(animation);
                animation = requestAnimationFrame(sync);
            });
            observer.observe(frame.parentElement);
            observer.observe(column);
            frame.preview = { typeset, disconnect() { ++revision; observer.disconnect(); cancelAnimationFrame(animation); } };
            typeset();
        },
        updated(frame, binding) { if (binding.value !== binding.oldValue) frame.preview.typeset(); },
        beforeUnmount(frame) { frame.preview.disconnect(); }
    };

    function readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    function waitImages(element) {
        return Promise.all([...element.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    }

    function paperDropTarget(canvas, columnRows, x, y) {
        const hit = document.elementFromPoint(x, y);
        if (!hit || !canvas.contains(hit)) return null;
        const sheet = hit.closest('.hc-sheet');
        const column = hit.closest('.hc-column') || [...(sheet?.querySelectorAll('.hc-column') || [])].find(col => {
            const box = col.getBoundingClientRect();
            return x >= box.left && x <= box.right;
        });
        if (!column) return null;
        const rect = column.getBoundingClientRect();
        const relativeY = y - rect.top;
        const rows = columnRows(column, rect.top);
        const target = rows.find(row => relativeY < row.bottom) || rows.at(-1);
        if (!target) return null;
        return { ...target, column, rect, after: relativeY > (target.top + target.bottom) / 2 };
    }

    function visiblePaperRows(canvas) {
        const viewport = canvas.getBoundingClientRect();
        return [...canvas.querySelectorAll('.hc-sheet')].flatMap(sheet => {
            const box = sheet.getBoundingClientRect();
            return box.bottom > viewport.top && box.top < viewport.bottom
                ? [...sheet.querySelectorAll('[data-paper-draggable]')] : [];
        });
    }

    const Field = {
        props: ['label', 'modelValue', 'kind', 'options', 'min', 'max', 'step'],
        emits: ['update:modelValue'],
        methods: {
            update(event) {
                const field = event.target;
                this.$emit('update:modelValue', this.kind === 'check' ? field.checked :
                    ['number', 'range'].includes(this.kind) ? (field.value === '' ? '' : field.valueAsNumber) : field.value);
            }
        },
        template: `<label class="hc-field" :class="{'hc-field-toggle':kind==='check'}">
            <span>{{label}}</span>
            <select v-if="options" :value="modelValue" @change="update"><option v-for="[value, name] in options" :key="value" :value="value">{{name}}</option></select>
            <textarea v-else-if="kind==='textarea'" :value="modelValue" @input="update" rows="3"></textarea>
            <input v-else-if="kind==='check'" type="checkbox" :checked="modelValue" @change="update">
            <input v-else :type="kind||'text'" :value="modelValue" :min="min" :max="max" :step="step||1" @input="update">
            <output v-if="kind==='range'">{{modelValue}}</output>
        </label>`
    };

    const component = {
        props: { documentTerm: { type: String, default: '讲义' }, questions: { type: Array, default: () => [] }, basket: { type: Array, default: () => [] }, knowledge: { type: Array, default: () => [] } },
        emits: ['close'],
        components: { HcField: Field },
        directives: { paperPreview },
        data() {
            return { doc: D.create(), saved: [], templates: [], ready: false, dirty: false, selected: [], selectedBand: '', anchor: '', panel: '', tab: 'header',
                modal: '', search: '', importSort: 'basket', importSource: 'basket', importSelected: [], chosenAsset: '', imageTarget: null, copied: [], questionLimit: 60, assetLimit: 48,
                edit: null, pages: [], revision: 0, rendering: false, printing: false, width: 0, message: '', error: '',
                layoutImages: new Map(), galleryImages: [], chosenAssetKey: '', studioActive: true,
                inspectorSize: { min: 0, max: 0, current: 0 }, undoAvailable: false,
                labels, modes, fonts, lines, boxStyles, paperOptions: Object.entries(L.papers).map(([key, [name, w, h]]) => [key, w ? `${name} · ${w} × ${h} mm` : name]),
                savedBodyTemplate: null, templateDraft: null, templateSaving: false, templateModuleId: '',
                moduleKinds: [['box','带框模块'], ['text','正文段'], ['heading','小节标题']],
                moduleColors: [['fill','框底色'], ['border','边框色'], ['badge','标签底色'], ['ink','文字色']],
                templateColors: [['accent','章节与页码'], ['overviewFill','提要底色'], ['theoremFill','定理框底色'],
                    ['theoremBorder','定理框边框'], ['theoremBadge','定理标签底色'], ['theoremText','定理正文文字'],
                    ['example','例题标签'], ['note','提醒与解答标记']],
                inspectorSections: [['presets','预设内容','layout-template'], ['prefix','题号前缀','hash'], ['source','题目信息','info'],
                    ['answers','答案配置','list-checks'], ['style','字体样式','type'], ['titles','标题模板','heading'], ['classic','经典盒子','box'],
                    ['picture','绘本盒子','book-open'], ['move','分页 / 移动','move-vertical'], ['page','页面配置','settings'],
                    ['rules','布局规则','sliders-horizontal'], ['organize','元素组织','list-ordered'], ['maintenance','内容维护','clipboard-list']],
                pageTabs: [['header','页眉页脚'], ['geometry','边距边框'], ['double','分栏与密封线'], ['watermark','图文水印'], ['templates','自定义模板']],
                sides: [['left','左'],['center','中'],['right','右']], edges: [['Top','上'],['Right','右'],['Bottom','下'],['Left','左']],
                alignOptions: [['left','左对齐'],['center','居中'],['right','右对齐'],['justify','两端对齐']],
                styleScope: 'selected', prefixDraft: '', prefixModelDraft: 'hanging', styleDraft: null, editName: '', assetSearch: '',
                saveTail: Promise.resolve(), bandSlot: 'left', bandEdge: 'header',
                crop: { left: 0, right: 0, top: 0, bottom: 0, white: 0 } };
        },
        computed: {
            s() { return this.doc.settings; },
            presets() { return [[presets[0][0], this.documentTerm + presets[0][1], presets[0][2]], ...presets.slice(1)]; },
            defaultDocumentName() { return '未命名' + this.documentTerm; },
            editableName: {
                get() { return this.nameInMode(this.doc.name); },
                set(name) { this.doc.name = name; }
            },
            documentName() { return this.editableName.trim() || this.defaultDocumentName; },
            bodyTemplate() {
                const template = D.bodyTemplate(this.savedBodyTemplate);
                if (!this.savedBodyTemplate) template.name = '24' + this.documentTerm + ' · 正文';
                return template;
            },
            bodyPresets() {
                const text = this.s.body?.text;
                const standard = bodyPresets.map(([kind, label, fallback, role]) => [kind, label, text?.[role] ?? fallback, role]);
                const extra = (this.s.body?.modules || []).map(module =>
                    [module.kind === 'heading' ? 'heading' : 'text', module.name, module.content, '', module]);
                return [...standard, ...extra];
            },
            templateModule() { return this.templateDraft?.modules.find(module => module.id === this.templateModuleId); },
            templateModulePreview() {
                if (!this.templateModule) return '';
                const entry = D.moduleBlock(this.templateModule);
                const s = this.bodyTemplate.settings;
                return D.wrap(entry, null, s, 0, D.contentParts(entry, null, s));
            },
            counts() {
                const counts = {};
                for (const item of this.doc.blocks) counts[item.kind] = (counts[item.kind] || 0) + 1;
                return counts;
            },
            geo() { return L.pageGeometry(this.s); },
            layoutInputs() {
                const s = this.s;
                return [this.doc.blocks, this.geo, s.mode, s.perPage, s.blockGap, s.prefix, s.firstQuestion, s.prefixModel,
                    s.prefixColor, s.prefixBackground, s.sourceTitle, s.sourceYear, s.sourceNumber, s.sourceType, s.sourceKnowledge,
                    s.showAnswer, s.showSolution, s.answerPlacement, s.theme, s.body?.colors, s.style];
            },
            actualZoom() {
                return this.s.zoomFit && this.width > 0 ? this.width / this.geo.width : L.limit(this.s.zoom, 25, 400, 100) / 100;
            },
            zoomText() { return `${Math.round(this.actualZoom * 100)}%`; },
            bodySections() {
                if (this.s.theme !== 'body24') return [];
                const byId = new Map(this.doc.blocks.map(item => [item.id, item]));
                let section = this.documentName;
                return this.pages.map(page => {
                    const rows = page.columns.flat();
                    const chapter = rows[0]?.kind === 'title';
                    for (const { id } of rows) {
                        const item = byId.get(id);
                        if (item?.kind === 'title' || (item?.kind === 'heading' && item.bodyRole !== 'subheading')) {
                            section = String(item.text || '').trim() || this.documentName;
                        }
                    }
                    return { chapter, section };
                });
            },
            byId() { return new Map(this.questions.filter(q => q?.id != null).map(q => [String(q.id), q])); },
            questionNumbers() {
                let next = Math.trunc(L.limit(this.s.firstQuestion, 1, 9999, 1));
                const numbers = new Map();
                for (const block of this.doc.blocks) if (block.kind === 'question') numbers.set(block.id, next++);
                return numbers;
            },
            activeItems() { return this.doc.blocks.filter(item => this.selected.includes(item.id)); },
            allSelected() { return this.doc.blocks.length > 0 && this.activeItems.length === this.doc.blocks.length; },
            currentItem() { return this.activeItems.length === 1 ? this.activeItems[0] : null; },
            orderedQuestions() {
                const pool = this.importSource === 'basket' ? this.basket.flatMap(id => this.byId.get(String(id)) || []) : this.questions;
                return L.orderQuestions(pool, this.importSort);
            },
            visibleQuestions() {
                const query = this.search.trim().toLowerCase();
                if (!query) return this.orderedQuestions;
                return this.orderedQuestions.filter(q => [q.stem, q.type, q.title, q.meta?.title, q.knowledge, q.year, q.meta?.year, L.sourceNumber(q)].some(value => String(value || '').toLowerCase().includes(query)));
            },
            assets() {
                const unique = new Map();
                for (const q of this.questions) for (const img of q.images || []) {
                    const src = D.safeImage(img.url);
                    if ((src || img.storageImage) && img.displayable !== false) {
                        const key = src || img.id;
                        unique.set(key, { ...img, key, url: src, title: img.name || img.filename || q.title || q.meta?.title || '题库配图' });
                    }
                }
                for (const item of this.doc.blocks) if (item.image) unique.set(item.image, { key: item.image, url: item.image, title: item.text || this.documentTerm + '图片' });
                const query = this.assetSearch.trim().toLowerCase();
                return [...unique.values()].filter(img => img.title.toLowerCase().includes(query));
            },
            assetWindow() { return this.studioActive && this.modal === 'gallery' ? this.assets.slice(0, this.assetLimit) : []; },
            selectedSpace() { return this.activeItems[0]?.space || 0; },
            hasOverflow() { return this.pages.some(page => page.columns.some(col => col.some(item => item.overflow > 0))); },
            band() { return this.s[this.bandEdge][this.bandSlot]; },
            editorQuestion() { return this.edit?.kind === 'question' ? this.resolve(this.edit) : null; },
            editorHtml() {
                if (!this.edit) return '';
                const previewSupport = ['answer', 'solution'].filter(name => this.s.answerPlacement !== 'inline' ||
                    !(name === 'answer' ? this.s.showAnswer : this.s.showSolution));
                const s = { ...this.s, showAnswer: true, showSolution: true, answerPlacement: 'inline', previewSupport };
                return D.wrap(this.edit, this.editorQuestion, s, this.questionIndex(this.edit.id), D.contentParts(this.edit, this.editorQuestion, s));
            },
            editorImages() { return D.imageLayouts(this.edit, this.editorQuestion); }
        },
        watch: {
            selected(ids) { if (ids.length) this.selectedBand = ''; },
            doc: { deep: true, handler() {
                if (!this.ready) return;
                if (!this._restoringUndo) {
                    this.undoAvailable = true;
                    clearTimeout(this._undoTimer);
                    // Keep edits from one continuous input or slider gesture together.
                    this._undoTimer = setTimeout(() => this.commitUndo(), 300);
                }
                this.dirty = true;
                clearTimeout(this._saveTimer);
                if (this.s.autosave) this._saveTimer = setTimeout(() => this.save(false), 450);
            } },
            layoutInputs: { deep: true, handler() {
                if (!this.ready) return;
                if (this._onlySpace && this._measured && !this.rendering) this.scheduleSpaceLayout();
                else this.scheduleLayout();
                this._onlySpace = false;
            } },
            questions() { if (this.ready && this.doc.blocks.some(entry => entry.kind === 'question' && !entry.snapshot)) this.scheduleLayout(); },
            async assetWindow(images, _previous, onCleanup) {
                const lease = root.Qisi.LibraryImageResources.openStoredImages(images);
                let current = true;
                onCleanup(() => { current = false; this.$nextTick(lease.release); });
                this.galleryImages = [];
                try {
                    const rows = await lease.ready;
                    if (current) this.galleryImages = rows.filter(row => row.url);
                } catch (error) { if (current) this.error = error.message || '图库读取失败。'; }
            }
        },
        async mounted() {
            window.addEventListener('keydown', this.studioKey, true);
            this.$refs.canvas.addEventListener('wheel', this.zoomPaperWithWheel, { passive: false });
            this._sortable = root.Sortable.create(this.$refs.objects, {
                draggable: '.hc-object', animation: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140,
                forceFallback: true, fallbackTolerance: 5,
                filter: event => event.shiftKey || event.ctrlKey || event.metaKey,
                preventOnFilter: false,
                ghostClass: 'hc-sort-ghost', chosenClass: 'hc-sort-chosen', delayOnTouchOnly: true, delay: 100,
                onEnd: ({ item, oldDraggableIndex, newDraggableIndex }) => {
                    if (!Number.isInteger(oldDraggableIndex) || !Number.isInteger(newDraggableIndex) || oldDraggableIndex === newDraggableIndex) return;
                    const list = this.$refs.objects;
                    item.remove();
                    list.insertBefore(item, list.children[oldDraggableIndex] || null);
                    this.moveBlock(oldDraggableIndex, newDraggableIndex);
                }
            });
            this._preferences = root.Qisi.StorageRepository.createPreferenceFacade(root.localStorage, { strict: false });
            this._inspectorPreferred = this._preferences.json(inspectorWidthKey, null);
            this._workspaceResize = new ResizeObserver(() => {
                if (!this._stopInspectorResize && this.$refs.workspace?.clientWidth) this.syncInspectorWidth();
            });
            this._workspaceResize.observe(this.$refs.workspace);
            this._resize = new ResizeObserver(([entry]) => {
                this._canvasWidth = entry.contentRect.width;
                if (this._canvasWidth <= 0) return;
                if (this._stopInspectorResize) {
                    if (this.s.zoomFit) this.$refs.canvas.style.setProperty('--hc-drag-scale', this._canvasWidth / this.geo.width);
                } else {
                    this.$refs.canvas.style.removeProperty('--hc-drag-scale');
                    this.width = this._canvasWidth;
                }
            });
            this._resize.observe(this.$refs.canvas);
            try {
                const workspace = await D.store.get('workspace');
                this.syncWorkspace(workspace);
                if (workspace?.current) this.doc = D.normalize(await D.store.get(`doc:${workspace.current}`), false, this.documentTerm);
            } catch (e) { this.error = `无法读取${this.documentTerm}存储。${e.message || ''}`; }
            await this.$nextTick();
            this.prefixDraft = this.s.prefix;
            this.prefixModelDraft = this.s.prefixModel;
            this.resetUndo();
            this.ready = true;
            this.scheduleLayout();
            document.fonts?.ready.then(() => { if (this.ready) this.scheduleLayout(); });
        },
        activated() { this.studioActive = true; if (this.ready) this.scheduleLayout(); },
        deactivated() {
            this.studioActive = false;
            ++this.revision;
            clearTimeout(this._layoutTimer);
            this._layoutImageLease?.release();
            this._layoutImageLease = null;
            this.layoutImages = new Map();
        },
        beforeUnmount() {
            window.removeEventListener('keydown', this.studioKey, true);
            this.$refs.canvas.removeEventListener('wheel', this.zoomPaperWithWheel);
            cancelAnimationFrame(this._zoomFrame || 0);
            this._sortable?.destroy();
            this._stopInspectorResize?.();
            this._workspaceResize?.disconnect();
            this._resize?.disconnect();
            clearTimeout(this._saveTimer);
            clearTimeout(this._layoutTimer);
            cancelAnimationFrame(this._spaceFrame || 0);
            clearTimeout(this._messageTimer);
            clearTimeout(this._undoTimer);
            if (this.ready && this.dirty && this.s.autosave) this.save(false);
            this.ready = false;
            this._stopPointer?.();
            this._stopPaperDrag?.();
            this._paperDrop?.clear();
            this._layoutImageLease?.release();
        },
        methods: {
            undoSnapshot() {
                const { zoom, zoomFit, autosave, ...settings } = this.s;
                return JSON.stringify([this.doc.name, this.doc.blocks, settings]);
            },
            resetUndo() {
                clearTimeout(this._undoTimer);
                this._undoTimer = null;
                this._undoPast = [];
                this._undoBase = this.undoSnapshot();
                this.undoAvailable = false;
            },
            commitUndo() {
                if (this._undoTimer == null) return;
                clearTimeout(this._undoTimer);
                this._undoTimer = null;
                const current = this.undoSnapshot();
                if (this._undoBase !== current) {
                    this._undoPast.push(this._undoBase);
                    this._undoBase = current;
                    let characters = this._undoPast.reduce((sum, state) => sum + state.length, 0);
                    while (this._undoPast.length > 30 || (characters > 16_000_000 && this._undoPast.length > 1)) {
                        characters -= this._undoPast.shift().length;
                    }
                }
                this.undoAvailable = this._undoPast.length > 0;
            },
            undo() {
                this.commitUndo();
                const previous = this._undoPast?.pop();
                if (!previous) return;
                this._stopPaperDrag?.();
                this._paperDrop?.clear();
                const [name, blocks, settings] = JSON.parse(previous);
                const { zoom, zoomFit, autosave } = this.s;
                this._undoBase = previous;
                this.undoAvailable = this._undoPast.length > 0;
                this._restoringUndo = true;
                Object.assign(this.doc, { name, blocks, settings: { ...settings, zoom, zoomFit, autosave } });
                const ids = new Set(blocks.map(block => block.id));
                this.selected = this.selected.filter(id => ids.has(id));
                this.selectedBand = '';
                if (!ids.has(this.anchor)) this.anchor = '';
                this.prefixDraft = this.currentItem?.prefix ?? this.s.prefix;
                this.prefixModelDraft = this.currentItem?.prefixModel ?? this.s.prefixModel;
                if (this.panel === 'style') this.syncStyle();
                this.$nextTick(() => { this._restoringUndo = false; });
                this.notice('已撤回上一步');
            },
            studioKey(event) {
                const target = event.target;
                if (!this.ready || !this.$el.isConnected || (target !== document.body && !this.$el.contains(target)) ||
                    event.isComposing || target.isContentEditable ||
                    target.closest('textarea, input:not([type=checkbox], [type=radio], [type=range], [type=color])')) return;
                if (event.key === 'Backspace' || event.key === 'Enter' || event.key === ' ' ||
                    (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key))) this.commitUndo();
                if (this.modal || event.shiftKey || event.altKey || !(event.ctrlKey || event.metaKey)) return;
                const key = event.key.toLowerCase();
                if (key !== 'z' && !(key === 'a' && this.$refs.canvas.contains(target))) return;
                event.preventDefault();
                event.stopPropagation();
                if (key === 'a') this.selectKind();
                else this.undo();
            },
            setZoom(value) {
                this.s.zoom = L.limit(value, 25, 400, 100);
                this.s.zoomFit = false;
            },
            zoomPaperWithWheel(event) {
                const canvas = this.$refs.canvas;
                if (!(event.ctrlKey || event.metaKey) || !canvas.contains(document.activeElement) || this.modal) return;
                event.preventDefault();
                if (!event.deltaY || this._stopPaperDrag || this._paperDrop) return;
                const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
                const delta = (this._wheelZoom?.delta || 0) + event.deltaY * unit;
                this._wheelZoom = { delta, x: event.clientX, y: event.clientY };
                if (this._zoomFrame) return;
                this._zoomFrame = requestAnimationFrame(() => {
                    const { delta, x, y } = this._wheelZoom;
                    this._zoomFrame = 0;
                    this._wheelZoom = null;
                    const before = this.actualZoom;
                    const next = L.limit(before * 100 * Math.exp(-delta * .0016), 25, 400, 100);
                    if (Math.abs(before * 100 - next) < .001) return;
                    const hit = document.elementFromPoint(x, y)?.closest('.hc-sheet-spacer');
                    const anchor = hit && canvas.contains(hit) ? hit : null;
                    const original = (anchor || canvas).getBoundingClientRect();
                    const previousLeft = canvas.scrollLeft;
                    const previousTop = canvas.scrollTop;
                    this.setZoom(next);
                    this.$nextTick(() => {
                        const ratio = this.actualZoom / before;
                        if (anchor?.isConnected) {
                            const current = anchor.getBoundingClientRect();
                            canvas.scrollLeft += current.left + (x - original.left) * ratio - x;
                            canvas.scrollTop += current.top + (y - original.top) * ratio - y;
                        } else {
                            canvas.scrollLeft = (previousLeft + x - original.left) * ratio - (x - original.left);
                            canvas.scrollTop = (previousTop + y - original.top) * ratio - (y - original.top);
                        }
                    });
                });
            },
            inspectorBounds() {
                const workspace = this.$refs.workspace;
                const track = getComputedStyle(workspace);
                const min = Number.parseInt(track.getPropertyValue('--hc-inspector-min'), 10);
                const standard = Number.parseInt(track.getPropertyValue('--hc-inspector-default'), 10);
                const previewMin = Number.parseInt(track.getPropertyValue('--hc-preview-min'), 10);
                const remaining = workspace.clientWidth - this.$refs.outline.offsetWidth - this.$refs.splitter.offsetWidth - previewMin;
                return { min, max: Math.max(min, Math.min(640, remaining)), standard };
            },
            syncInspectorWidth() {
                const { min, max, standard } = this.inspectorBounds();
                const current = Math.round(L.limit(this._inspectorPreferred ?? standard, min, max, min));
                this.$refs.workspace.style.setProperty('--hc-inspector-width', current + 'px');
                this.inspectorSize = { min, max, current };
            },
            setInspectorWidth(value) {
                this._inspectorPreferred = value;
                this.syncInspectorWidth();
                this._preferences.setJson(inspectorWidthKey, value);
            },
            resizeInspector(event) {
                if (event.button !== 0 || this._stopInspectorResize) return;
                event.preventDefault();
                const start = event.clientX;
                const workspace = this.$refs.workspace;
                const bar = event.currentTarget;
                const { min, max } = this.inspectorBounds();
                const original = this.inspectorSize.current;
                let next = original;
                let frame = 0;
                const current = pointer => Math.round(L.limit(original + start - pointer.clientX, min, max, original));
                const move = pointer => {
                    if (pointer.pointerId !== event.pointerId) return;
                    next = current(pointer);
                    if (!frame) frame = requestAnimationFrame(() => {
                        frame = 0;
                        workspace.style.setProperty('--hc-inspector-width', next + 'px');
                    });
                };
                const stop = pointer => {
                    if (pointer && pointer.pointerId !== event.pointerId) return;
                    cancelAnimationFrame(frame);
                    bar.removeEventListener('pointermove', move);
                    bar.removeEventListener('pointerup', stop);
                    bar.removeEventListener('pointercancel', stop);
                    bar.removeEventListener('lostpointercapture', stop);
                    workspace.classList.remove('hc-resizing');
                    this._stopInspectorResize = null;
                    if (pointer?.type === 'pointerup' && current(pointer) !== original) this.setInspectorWidth(current(pointer));
                    else this.syncInspectorWidth();
                    if (this._canvasWidth > 0) this.width = this._canvasWidth;
                    this.$refs.canvas.style.removeProperty('--hc-drag-scale');
                };
                this._stopInspectorResize = stop;
                bar.focus({ preventScroll: true });
                bar.setPointerCapture(event.pointerId);
                workspace.classList.add('hc-resizing');
                bar.addEventListener('pointermove', move);
                bar.addEventListener('pointerup', stop);
                bar.addEventListener('pointercancel', stop);
                bar.addEventListener('lostpointercapture', stop);
            },
            resizeInspectorKey(event) {
                const offset = { ArrowLeft: 16, ArrowRight: -16 }[event.key];
                if (offset == null && event.key !== 'Home') return;
                event.preventDefault();
                const { current, min, max } = this.inspectorSize;
                this.setInspectorWidth(offset == null ? null : L.limit(current + offset, min, max, current));
            },
            notice(message) {
                this.error = '';
                this.message = message;
                clearTimeout(this._messageTimer);
                this._messageTimer = setTimeout(() => { this.message = ''; }, 3500);
            },
            describe(item) {
                const q = item.kind === 'question' ? item.snapshot || this.byId.get(String(item.questionId)) : null;
                return (item.override?.stem || item.text || q?.stem || q?.title || labels[item.kind]).replace(/\s+/g, ' ').slice(0, 72);
            },
            resolve(item, images = this.layoutImages) {
                if (item.snapshot) return item.snapshot;
                const question = D.question(this.byId.get(String(item.questionId)));
                if (question) question.images = question.images.map(image => {
                    const loaded = images.get(String(image.id));
                    return loaded ? { ...image, url: loaded.url, displayable: loaded.displayable } : image;
                });
                return question;
            },
            questionIndex(id) {
                return this.questionNumbers.get(id) ?? Math.trunc(L.limit(this.s.firstQuestion, 1, 9999, 1));
            },
            nameInMode(name) {
                return ['未命名讲义', '未命名试卷'].includes(name) ? this.defaultDocumentName : name;
            },
            async save(announce = true) {
                if (!this.doc.blocks.length && !this.saved.some(row => row.id === this.doc.id) && !announce) return;
                const snapshot = D.copy(this.doc);
                snapshot.name = this.documentName;
                snapshot.updatedAt = Date.now();
                const stateAtSave = JSON.stringify(this.doc);
                const task = this.saveTail.catch(() => {}).then(async () => {
                    this.syncWorkspace(await D.store.save(snapshot));
                    if (this.doc.id === snapshot.id && JSON.stringify(this.doc) === stateAtSave) this.dirty = false;
                    if (announce) this.notice(`${this.documentTerm}已保存`);
                });
                this.saveTail = task;
                try { await task; } catch (e) { this.error = `保存失败。${e.message || ''}`; }
            },
            syncWorkspace(workspace) {
                this.saved = Array.isArray(workspace?.saved) ? workspace.saved : [];
                this.templates = Array.isArray(workspace?.templates) ? workspace.templates : [];
                this.savedBodyTemplate = workspace?.bodyTemplate || null;
            },
            async switchDoc(action) {
                clearTimeout(this._saveTimer);
                if (this.doc.blocks.length && this.dirty && !this.s.autosave && !root.confirm(`当前${this.documentTerm}有未保存的更改。切换${this.documentTerm}？`)) return;
                if (this.dirty && this.s.autosave) await this.save(false);
                await this.saveTail.catch(() => {});
                try {
                    const next = await action();
                    if (!next) return;
                    this.ready = false;
                    this.doc = next;
                    this.selected = [];
                    this.selectedBand = '';
                    this.anchor = '';
                    this.modal = '';
                    this.panel = '';
                    this.prefixDraft = this.s.prefix;
                    this.prefixModelDraft = this.s.prefixModel;
                    this.dirty = false;
                    await this.$nextTick();
                    this.resetUndo();
                    this.ready = true;
                    this.$refs.canvas.scrollTop = 0;
                    this.scheduleLayout();
                    this.syncWorkspace(await D.store.open(this.saved.some(row => row.id === next.id) ? next.id : null));
                } catch (e) { this.error = e.message || `无法打开${this.documentTerm}。`; }
            },
            async removeSaved(row) {
                if (!root.confirm(`删除已保存的${this.documentTerm}「${this.nameInMode(row.name)}」？`)) return;
                try {
                    await this.saveTail.catch(() => {});
                    const active = row.id === this.doc.id;
                    if (active) clearTimeout(this._saveTimer);
                    this.syncWorkspace(await D.store.remove(row.id));
                    if (active) {
                        this.dirty = false;
                        await this.switchDoc(D.create);
                        this.modal = 'library';
                    }
                    this.notice(`已删除保存的${this.documentTerm}`);
                } catch (e) { this.error = e.message || `删除${this.documentTerm}失败。`; }
            },
            duplicateDoc() {
                const next = D.normalize(this.doc, true, this.documentTerm);
                next.name = `${this.documentName}（副本）`;
                this.switchDoc(() => next).then(() => { if (this.doc.id === next.id) this.save(); });
            },
            newDocument() { return this.switchDoc(D.create); },
            openDocument(id) { return this.switchDoc(async () => D.normalize(await D.store.get(`doc:${id}`), false, this.documentTerm)); },
            async openLibrary() {
                this.modal = 'library';
                try { this.syncWorkspace(await D.store.get('workspace')); }
                catch (e) { this.error = e.message || `无法读取已保存${this.documentTerm}。`; }
            },
            download(name, body) {
                const url = URL.createObjectURL(new Blob([body], { type: 'application/json;charset=utf-8' }));
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = name.replace(/[\\/:*?"<>|]/g, '_') + '.json';
                anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            },
            async share() {
                const portable = D.copy(this.doc);
                portable.name = this.documentName;
                const toPortable = async url => {
                    if (!url?.startsWith('blob:')) return url;
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('有一张图片暂时无法读取。');
                    return readFile(await response.blob());
                };
                try {
                    const images = this.doc.blocks.flatMap(entry => entry.kind === 'question' && !entry.snapshot
                        ? this.byId.get(String(entry.questionId))?.images || [] : []);
                    const lease = root.Qisi.LibraryImageResources.openStoredImages(images);
                    try {
                        const resolved = new Map((await lease.ready).map(image => [String(image.id), image]));
                        for (const entry of portable.blocks) {
                            if (entry.kind === 'question') entry.snapshot = this.resolve(entry, resolved);
                            for (const image of entry.snapshot?.images || []) {
                                image.url = await toPortable(image.url);
                                delete image.storageImage;
                            }
                        }
                    } finally { lease.release(); }
                    for (const entry of portable.blocks) {
                        for (const image of entry.localFigures || []) image.url = await toPortable(image.url);
                        entry.image = await toPortable(entry.image);
                        for (const config of Object.values(entry.figures || {})) config.url = await toPortable(config.url);
                    }
                    for (const edge of ['header', 'footer']) for (const slot of Object.values(portable.settings[edge])) slot.image = await toPortable(slot.image);
                    portable.settings.watermarkImage = await toPortable(portable.settings.watermarkImage);
                    this.download(portable.name, JSON.stringify(portable, null, 2));
                    this.notice(`已导出可导入的${this.documentTerm}文件`);
                } catch (e) { this.error = e.message || `导出${this.documentTerm}失败。`; }
            },
            async importFile(event) {
                const file = event.target.files[0];
                event.target.value = '';
                if (!file) return;
                try {
                    const next = D.normalize(JSON.parse(await file.text()), true, this.documentTerm);
                    await this.switchDoc(() => next);
                    if (this.doc.id === next.id) await this.save();
                } catch (e) { this.error = e instanceof SyntaxError ? `${this.documentTerm}文件格式无效。` : e.message; }
            },
            editBodyTemplate() {
                this.templateDraft = { name: this.bodyTemplate.name, ...D.copy(this.bodyTemplate.settings.body) };
                this.templateModuleId = this.templateDraft.modules[0]?.id || '';
                this.modal = 'template';
            },
            addBodyModule() {
                const modules = this.templateDraft.modules;
                const module = D.normalizeModule(null, modules.length);
                modules.push(module);
                this.templateModuleId = module.id;
            },
            removeBodyModule() {
                const modules = this.templateDraft.modules;
                const index = modules.indexOf(this.templateModule);
                if (index < 0) return;
                modules.splice(index, 1);
                this.templateModuleId = modules[Math.min(index, modules.length - 1)]?.id || '';
            },
            async saveBodyTemplate(apply = false) {
                const draft = this.templateDraft;
                const name = draft.name.trim().slice(0, 120);
                if (!name || this.templateSaving) return;
                this.templateSaving = true;
                try {
                    const body = D.copy({ colors: draft.colors, text: draft.text, modules: draft.modules });
                    this.syncWorkspace(await D.store.saveBodyTemplate({ name, body }));
                    if (this.templateDraft === draft) this.closeModal();
                    if (apply) this.applyTemplate(this.bodyTemplate);
                    else this.notice('正文模板已保存');
                } catch (e) { this.error = e.message; }
                finally { this.templateSaving = false; }
            },
            async saveTemplate() {
                const name = this.editName.trim();
                if (!name) return;
                const settings = D.copy(this.s);
                try { this.syncWorkspace(await D.store.changeTemplate(name, settings)); this.editName = ''; this.notice('页面模板已保存'); }
                catch (e) { this.error = e.message; }
            },
            async removeTemplate(name) {
                if (!root.confirm(`删除模板「${name}」？`)) return;
                try { this.syncWorkspace(await D.store.changeTemplate(name)); this.notice('模板已删除'); }
                catch (e) { this.error = e.message; }
            },
            applyTemplate(template) {
                const { autosave } = this.s;
                this.doc.settings = D.mergeSettings({ ...template.settings, autosave });
                this.prefixDraft = this.s.prefix;
                this.prefixModelDraft = this.s.prefixModel;
                this.notice(`已应用「${template.name}」`);
            },
            mode(mode) {
                if (mode === 'double' && this.s.paper === 'a4') this.s.paper = 'a3';
                if (mode === 'single' && this.s.paper === 'a3') this.s.paper = 'a4';
                this.s.mode = mode;
            },
            openPanel(panel) {
                this.panel = this.panel === panel ? '' : panel;
                if (panel === 'prefix') {
                    this.prefixDraft = this.currentItem?.prefix ?? this.s.prefix;
                    this.prefixModelDraft = this.currentItem?.prefixModel ?? this.s.prefixModel;
                }
                if (panel === 'style') this.syncStyle();
            },
            syncStyle() {
                const item = this.currentItem || this.activeItems[0];
                this.styleDraft = D.blockStyle(item, this.s);
            },
            styleValue(key, value) {
                this.styleDraft[key] = value;
                if (this.styleScope === 'all' || !this.activeItems.length) this.s.style[key] = value;
                for (const entry of this.styleScope === 'all' ? this.doc.blocks : this.activeItems) entry.style[key] = value;
            },
            applyPrefix(scope) {
                if (scope === 'all') {
                    this.s.prefix = this.prefixDraft;
                    this.s.prefixModel = this.prefixModelDraft;
                }
                const entries = scope === 'selected' ? this.activeItems : scope === 'type' ? this.doc.blocks.filter(item => item.kind === 'question' && this.resolve(item)?.type === this.resolve(this.currentItem)?.type) : this.doc.blocks;
                for (const entry of entries.filter(item => item.kind === 'question')) Object.assign(entry, {
                    prefix: this.prefixDraft, prefixModel: this.prefixModelDraft, prefixColor: this.s.prefixColor, prefixBackground: this.s.prefixBackground
                });
                this.notice('题号已更新');
            },
            choose(id, event = {}) {
                if (event.shiftKey && this.anchor) {
                    const ids = this.doc.blocks.map(item => item.id);
                    const a = ids.indexOf(this.anchor), b = ids.indexOf(id);
                    if (a >= 0 && b >= 0) this.selected = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
                } else if (event.ctrlKey || event.metaKey || event.target?.type === 'checkbox') {
                    this.selected = this.selected.includes(id) ? this.selected.filter(x => x !== id) : [...this.selected, id];
                } else this.selected = [id];
                this.anchor = id;
                if (this.panel === 'style') this.syncStyle();
                if (event.currentTarget?.classList.contains('hc-object-list')) this.scrollToBlock(id);
            },
            scrollToBlock(id) {
                const entry = [...this.$refs.canvas.querySelectorAll('[data-block]')].find(el => el.dataset.block === id);
                entry?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            },
            pointerSelect(event) {
                if (event.button || !event.shiftKey || event.ctrlKey || event.metaKey) return;
                const row = event.target.closest('[data-entry]');
                if (!row) return;
                const start = event.clientY;
                const first = row.dataset.entry;
                let moved = false;
                let frame = 0;
                const move = pointer => {
                    if (!moved && Math.abs(pointer.clientY - start) < 5) return;
                    moved = true;
                    if (frame) cancelAnimationFrame(frame);
                    frame = requestAnimationFrame(() => {
                        frame = 0;
                        const target = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest('[data-entry]');
                        if (target) {
                            this.anchor = first;
                            this.choose(target.dataset.entry, { shiftKey: true });
                            this.anchor = first;
                        }
                    });
                };
                const stop = () => {
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', stop);
                    window.removeEventListener('pointercancel', stop);
                    this._stopPointer = null;
                    if (moved) this._ignoreListClick = Date.now() + 150;
                };
                this._stopPointer?.();
                this._stopPointer = stop;
                window.addEventListener('pointermove', move);
                window.addEventListener('pointerup', stop);
                window.addEventListener('pointercancel', stop);
            },
            listClick(event) {
                if (Date.now() < (this._ignoreListClick || 0)) return;
                const row = event.target.closest('[data-entry]');
                if (row) this.choose(row.dataset.entry, event);
            },
            clearPaperSelection(event) {
                if (event.target.closest('[data-block],button')) return;
                this.clearSelection();
            },
            clearSelection() {
                this.selected = [];
                this.selectedBand = '';
                this.anchor = '';
            },
            chooseBand(edge) {
                this.clearSelection();
                this.selectedBand = edge;
            },
            removeBand() {
                const edge = this.selectedBand;
                if (!edge) return;
                for (const slot of Object.values(this.s[edge])) Object.assign(slot, { enabled: false, content: '', image: '' });
                this.s[`${edge}Line`] = false;
                this.s[`${edge}Paint`] = false;
                this.selectedBand = '';
            },
            startPaperDrag(event) {
                if (!event.button && !event.target.closest('button, input, a')) this.$refs.canvas.focus({ preventScroll: true });
                if (event.button || event.pointerType === 'touch' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey ||
                    this._stopPaperDrag || this._paperDrop || this.rendering || event.target.closest('button, input, a')) return;
                const row = event.target.closest('[data-paper-draggable]');
                if (!row) return;
                const indexes = new Map(this.doc.blocks.map((item, i) => [item.id, i]));
                const from = indexes.get(row.dataset.block);
                if (from === undefined) return;
                const canvas = this.$refs.canvas;
                const stage = canvas.parentElement;
                const box = row.getBoundingClientRect();
                const zoom = this.actualZoom;
                const gap = this.blockGap();
                const step = box.height / zoom + gap;
                const sourceColumn = row.parentElement;
                const startX = event.clientX;
                const startY = event.clientY;
                const startScroll = canvas.scrollTop;
                const columns = new Map();
                let x = startX, y = startY, frame = 0, ghost, line, lastColumn, lastTo, lastTravel;
                let shifted = new Map();
                const readColumn = (column, top = column.getBoundingClientRect().top) => {
                    if (!columns.has(column)) columns.set(column, [...column.querySelectorAll('[data-paper-draggable]')].map(node => {
                        const rect = node.getBoundingClientRect();
                        return { index: indexes.get(node.dataset.block), content: node.firstElementChild, top: rect.top - top, bottom: rect.bottom - top };
                    }));
                    return columns.get(column);
                };
                const positionGhost = (left, top, origin) => {
                    ghost.style.transform = `translate3d(${left - origin.left}px,${top - origin.top}px,0) scale(${zoom})`;
                };
                const destination = (clientX, clientY) => {
                    const target = paperDropTarget(canvas, readColumn, clientX, clientY);
                    if (!target || target.index === undefined) return null;
                    const boundary = target.index + Number(target.after);
                    const to = boundary - Number(boundary > from);
                    return to === from ? null : { ...target, boundary, to };
                };
                const preview = (target, travel = null) => {
                    if (lastColumn === target?.column && lastTo === target?.to && lastTravel === travel) return;
                    lastColumn = target?.column;
                    lastTo = target?.to;
                    lastTravel = travel;
                    const next = new Map();
                    stage.classList.toggle('hc-paper-cross-column', !!target && target.column !== sourceColumn);
                    if (travel !== null) {
                        const rows = readColumn(sourceColumn);
                        const source = rows.find(item => item.content === row.firstElementChild);
                        const down = travel > 0;
                        for (const item of rows) {
                            if (down ? item.index <= from : item.index >= from) continue;
                            const separation = down ? item.top - source.bottom : source.top - item.bottom;
                            // Adjacent cards move as soon as the drag starts; later cards move as the gap reaches them.
                            const distance = Math.min(step, Math.max(0, Math.abs(travel) - Math.max(0, separation / zoom - gap)));
                            if (distance) next.set(item.content, down ? -distance : distance);
                        }
                    } else if (target?.column === sourceColumn) {
                        for (const item of readColumn(sourceColumn)) {
                            if (item.index > from && item.index <= target.to) next.set(item.content, -step);
                            if (item.index < from && item.index >= target.to) next.set(item.content, step);
                        }
                    } else if (target) {
                        for (const item of readColumn(sourceColumn)) if (item.index > from) next.set(item.content, -step);
                        for (const item of readColumn(target.column)) if (item.index >= target.boundary) next.set(item.content, step);
                    }
                    for (const content of shifted.keys()) if (!next.has(content)) content.style.removeProperty('transform');
                    for (const [content, offset] of next) {
                        if (shifted.get(content) !== offset) content.style.transform = `translate3d(0,${offset}px,0)`;
                    }
                    shifted = next;
                };
                const slotTop = target => {
                    const offset = (shifted.get(target.content) || 0) * zoom;
                    return target.rect.top + (target.after ? target.bottom + offset + gap * zoom : target.top + Math.min(0, offset));
                };
                const paint = () => {
                    const target = destination(x, y);
                    const area = canvas.getBoundingClientRect();
                    const edge = 46;
                    const scroll = x >= area.left && x <= area.right && y >= area.top && y <= area.bottom
                        ? Math.max(0, y - area.bottom + edge) - Math.max(0, area.top + edge - y) : 0;
                    const origin = stage.getBoundingClientRect();
                    const column = sourceColumn.getBoundingClientRect();
                    const inSourceColumn = (!target || target.column === sourceColumn) && x >= column.left && x <= column.right &&
                        y >= area.top && y <= area.bottom;
                    preview(target, inSourceColumn ? (y - startY + canvas.scrollTop - startScroll) / zoom : null);
                    positionGhost(box.left + x - startX, box.top + y - startY, origin);
                    line.hidden = !target;
                    if (!line.hidden) {
                        const { rect } = target;
                        line.style.width = rect.width + 'px';
                        line.style.transform = `translate3d(${rect.left - origin.left}px,${slotTop(target) - origin.top - 3}px,0)`;
                    }
                    const before = canvas.scrollTop;
                    if (scroll) canvas.scrollTop += scroll * .4;
                    frame = canvas.scrollTop !== before ? requestAnimationFrame(paint) : 0;
                };
                const move = pointer => {
                    if (pointer.pointerId !== event.pointerId) return;
                    x = pointer.clientX;
                    y = pointer.clientY;
                    if (!ghost && Math.hypot(x - startX, y - startY) < 6) return;
                    pointer.preventDefault();
                    if (!ghost) {
                        ghost = row.firstElementChild.cloneNode(true);
                        ghost.className = 'hc-paper-ghost';
                        ghost.querySelectorAll('.hc-writing-space, .hc-overflow').forEach(node => node.remove());
                        ghost.style.width = box.width / zoom + 'px';
                        ghost.setAttribute('aria-hidden', 'true');
                        line = document.createElement('div');
                        line.className = 'hc-paper-drop-line';
                        line.hidden = true;
                        stage.append(ghost, line);
                        row.classList.add('hc-paper-source');
                        stage.classList.add('hc-paper-dragging');
                    }
                    if (!frame) frame = requestAnimationFrame(paint);
                };
                let settleTimeout;
                const clear = () => {
                    clearTimeout(settleTimeout);
                    if (this._paperDrop?.clear === clear) this._paperDrop = null;
                    stage.classList.remove('hc-paper-dragging', 'hc-paper-cross-column', 'hc-paper-finishing');
                    for (const content of shifted.keys()) content.style.removeProperty('transform');
                    row.classList.remove('hc-paper-source');
                    line?.remove();
                    ghost?.remove();
                };
                const capture = () => {
                    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
                    const positions = new Map(visiblePaperRows(canvas).map(node =>
                        [node.dataset.paperDraggable, node.firstElementChild.getBoundingClientRect()]));
                    positions.set(row.dataset.paperDraggable, ghost.getBoundingClientRect());
                    return positions;
                };
                const settle = positions => {
                    clear();
                    if (!positions) return;
                    const scale = this.actualZoom;
                    const motions = visiblePaperRows(canvas).flatMap(node => {
                        const previous = positions.get(node.dataset.paperDraggable);
                        if (!previous) return [];
                        const content = node.firstElementChild;
                        const rect = content.getBoundingClientRect();
                        // Keep the same paper visible while its previous position eases into place.
                        const dx = (previous.left - rect.left) / scale;
                        const dy = (previous.top - rect.top) / scale;
                        return Math.abs(dx) + Math.abs(dy) > 1 ? [{ content, dx, dy }] : [];
                    });
                    for (const { content, dx, dy } of motions) {
                        content.animate([{ transform: `translate3d(${dx}px,${dy}px,0)` }, { transform: 'none' }],
                            { duration: 190, easing: 'cubic-bezier(.25,.6,.35,1)' });
                    }
                };
                const finish = pointer => {
                    if (pointer?.pointerId != null && pointer.pointerId !== event.pointerId) return;
                    const target = ghost && pointer?.type === 'pointerup' ? destination(pointer.clientX, pointer.clientY) : null;
                    cancelAnimationFrame(frame);
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', finish);
                    window.removeEventListener('pointercancel', finish);
                    window.removeEventListener('blur', finish);
                    window.removeEventListener('keydown', escapeDrag, true);
                    this._stopPaperDrag = null;
                    if (ghost && pointer?.type === 'pointerup') {
                        const consumeClick = click => { click.preventDefault(); click.stopPropagation(); };
                        canvas.addEventListener('click', consumeClick, { capture: true, once: true });
                        setTimeout(() => canvas.removeEventListener('click', consumeClick, true), 0);
                    }
                    if (!target) { clear(); return; }
                    stage.classList.add('hc-paper-finishing');
                    preview(target);
                    const origin = stage.getBoundingClientRect();
                    line.hidden = true;
                    ghost.classList.add('hc-paper-settling');
                    positionGhost(target.rect.left, slotTop(target), origin);
                    this._paperDrop = { capture, settle, clear };
                    settleTimeout = setTimeout(clear, 2500);
                    this.moveBlock(from, target.to);
                };
                const escapeDrag = key => {
                    if (key.key === 'Escape' && ghost) {
                        key.stopPropagation();
                        finish();
                    }
                };
                this._stopPaperDrag = finish;
                window.addEventListener('pointermove', move, { passive: false });
                window.addEventListener('pointerup', finish);
                window.addEventListener('pointercancel', finish);
                window.addEventListener('blur', finish);
                window.addEventListener('keydown', escapeDrag, true);
            },
            selectKind(kind) { this.selected = this.doc.blocks.filter(item => !kind || item.kind === kind).map(item => item.id); },
            insert(entries, position = 'tail') {
                const index = position === 'head' ? 0 : position === 'after' && this.activeItems.length ? this.doc.blocks.lastIndexOf(this.activeItems.at(-1)) + 1 : this.doc.blocks.length;
                this.doc.blocks.splice(index, 0, ...entries);
                this.selected = entries.map(item => item.id);
                this.anchor = this.selected.at(-1) || '';
            },
            addText(kind = 'text') {
                const entry = D.block(kind);
                this.edit = entry;
                this.figureId = '';
                this.modal = 'editor';
            },
            addPreset([kind, , text, bodyRole, module], position) {
                if (module) { this.insert([D.moduleBlock(module)], position); return; }
                const values = { text };
                if (bodyRole) values.bodyRole = bodyRole;
                if (bodyRole === 'theorem') values.bodyLabel = this.s.body.text.theoremLabel;
                this.insert([D.block(kind, values)], position);
            },
            markExample(enabled) {
                for (const item of this.activeItems) if (item.kind === 'question') item.bodyRole = enabled ? 'example' : '';
            },
            insertBreak() { this.insert([D.block('divider', { breakBefore: 'page' })], 'after'); },
            useKnowledge(item) {
                this.insert([D.block('knowledge', { text: item.path || item.name || String(item) })], 'after');
                this.closeModal();
            },
            beginImport(source) {
                this.importSource = source;
                this.search = '';
                this.importSelected = [];
                this.questionLimit = 60;
                this.modal = 'questions';
            },
            importQuestions(ids) {
                const set = new Set(ids.map(String));
                const entries = this.orderedQuestions.filter(q => set.has(String(q.id))).map(q => D.block('question', { questionId: q.id }));
                if (!entries.length) return;
                this.insert(entries, this.selected.length ? 'after' : 'tail');
                this.modal = '';
                this.notice(`已添加 ${entries.length} 道题`);
            },
            move(direction) {
                const selected = new Set(this.selected);
                if (!selected.size) return;
                const blocks = this.doc.blocks;
                if (direction === 'top' || direction === 'bottom') {
                    const other = blocks.filter(item => !selected.has(item.id));
                    this.doc.blocks = direction === 'top' ? [...this.activeItems, ...other] : [...other, ...this.activeItems];
                } else if (direction === 'up') {
                    for (let i = 1; i < blocks.length; i++) if (selected.has(blocks[i].id) && !selected.has(blocks[i - 1].id)) [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
                } else {
                    for (let i = blocks.length - 2; i >= 0; i--) if (selected.has(blocks[i].id) && !selected.has(blocks[i + 1].id)) [blocks[i], blocks[i + 1]] = [blocks[i + 1], blocks[i]];
                }
            },
            moveBlock(from, to) {
                if (from === to) return;
                const [entry] = this.doc.blocks.splice(from, 1);
                this.doc.blocks.splice(to, 0, entry);
                this.selected = [entry.id];
                this.anchor = entry.id;
            },
            reorder(type) {
                const list = this.doc.blocks.filter(item => item.kind === 'question');
                if (type === 'reverse') list.reverse();
                else if (type === 'type') {
                    const order = ['单选题','多选题','填空题','解答题','证明题'];
                    const rank = item => { const index = order.indexOf(this.resolve(item)?.type); return index < 0 ? order.length : index; };
                    list.sort((a, b) => rank(a) - rank(b));
                } else list.sort((a, b) => (Number(this.resolve(a)?.original) || Infinity) - (Number(this.resolve(b)?.original) || Infinity));
                let i = 0;
                this.doc.blocks = this.doc.blocks.map(item => item.kind === 'question' ? list[i++] : item);
            },
            duplicate(position) { this.insert(this.activeItems.map(item => D.block(item.kind, D.copy(item))), position); },
            copySelection() {
                this.copied = this.activeItems.map(D.copy);
                this.notice(`已复制 ${this.copied.length} 项`);
            },
            pasteSelection(position) { this.insert(this.copied.map(item => D.block(item.kind, D.copy(item))), position); },
            deleteSelectedWithBackspace(event) {
                const target = event.target;
                if (!(this.selected.length || this.selectedBand) || this.modal || event.defaultPrevented || event.isComposing ||
                    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
                    target.isContentEditable || target.closest('textarea, select, input:not([type=checkbox], [type=radio])')) return;
                event.preventDefault();
                event.stopPropagation();
                if (this.selectedBand) this.removeBand();
                else this.remove();
            },
            remove(all = false) {
                if (all && !root.confirm(`清空这份${this.documentTerm}的全部内容？`)) return;
                const set = new Set(this.selected);
                this.doc.blocks = all ? [] : this.doc.blocks.filter(item => !set.has(item.id));
                this.selected = [];
            },
            space(value) {
                this._onlySpace = !this.activeItems.some(item => item.split);
                for (const item of this.activeItems) item.space = L.limit(value, 0, 420, 0);
                this.$nextTick(() => { this._onlySpace = false; });
            },
            setBreak(value) { for (const item of this.activeItems) item.breakBefore = value; },
            applyBox(box) {
                for (const item of this.activeItems) item.box = box;
                if (this.activeItems.length) this.notice(box ? '已应用盒子样式' : '已移除盒子样式');
            },
            openEditor(id, figure) {
                const item = this.doc.blocks.find(entry => entry.id === id);
                if (!item) return;
                const edit = D.copy(item);
                if (item.kind === 'question' && !edit.override) {
                    const q = this.resolve(item);
                    if (!q) return this.beginImport('library');
                    edit.override = { stem: q.stem, options: [...q.options], answer: q.answer, solution: q.solution };
                }
                this.message = '';
                this.edit = edit;
                this.modal = 'editor';
                if (figure) this.$nextTick(() => this.$refs.figureEditor?.select(figure));
            },
            saveEditor() {
                const index = this.doc.blocks.findIndex(item => item.id === this.edit.id);
                if (index < 0) this.insert([this.edit], 'after');
                else this.doc.blocks.splice(index, 1, this.edit);
                this.selected = [this.edit.id];
                this.closeModal();
                this.notice('内容已更新');
            },
            closeModal() { this.modal = ''; this.edit = null; this.templateDraft = null; },
            setFigureLayout(id, layout) {
                this.edit.figures[id] = { ...this.edit.figures[id], layout };
            },
            pickImage(target = 'block') {
                this.imageTarget = target;
                this.assetSearch = '';
                this.assetLimit = 48;
                this.chosenAsset = '';
                this.chosenAssetKey = '';
                this._gallerySelection = null;
                this.modal = 'gallery';
            },
            async uploadImage(event) {
                const file = event.target.files[0];
                event.target.value = '';
                if (!file) return;
                try {
                    const data = await readFile(file);
                    if (!D.safeImage(data)) throw new Error('请选择 PNG、JPEG、WebP 等图片。');
                    this.chosenAsset = data;
                    this.chosenAssetKey = '';
                } catch (e) { this.error = e.message; }
            },
            async chooseGalleryAsset(image) {
                const selection = {};
                this._gallerySelection = selection;
                try {
                    const value = image.url.startsWith('blob:') ? await readFile(await (await fetch(image.url)).blob()) : image.url;
                    if (this.modal === 'gallery' && this._gallerySelection === selection) {
                        this.chosenAsset = value;
                        this.chosenAssetKey = image.key;
                    }
                } catch (_) { if (this._gallerySelection === selection) this.error = '无法读取选中的图片，请重新选择。'; }
            },
            async useImage(url = this.chosenAsset) {
                let image = D.safeImage(url);
                if (!image) return;
                if (image.startsWith('blob:')) {
                    try { image = await readFile(await (await fetch(image)).blob()); }
                    catch { this.error = '无法读取选中的图片，请重新选择。'; return; }
                }
                switch (this.imageTarget) {
                    case 'band': Object.assign(this.band, { image, enabled: true }); break;
                    case 'watermark': this.s.watermarkImage = image; break;
                    case 'editor':
                        if (this.edit.kind === 'question') (this.edit.localFigures ||= []).push({ id: crypto.randomUUID(), url: image });
                        else this.edit.image = image;
                        this.modal = 'editor';
                        return;
                    case 'crop': this.chosenAsset = image; this.crop = { left: 0, right: 0, top: 0, bottom: 0, white: 0 }; this.modal = 'crop'; return;
                    default: this.insert([D.block('image', { image, box: this.imageTarget === 'picture' ? 'picture' : '' })], 'after');
                }
                this.modal = '';
            },
            async cropImage() {
                try {
                    const img = new Image();
                    img.src = this.chosenAsset;
                    await img.decode();
                    const { left, right, top, bottom, white } = this.crop;
                    const sx = Math.round(img.naturalWidth * left / 100), sy = Math.round(img.naturalHeight * top / 100);
                    const width = Math.round(img.naturalWidth * (100 - left - right) / 100);
                    const height = Math.round(img.naturalHeight * (100 - top - bottom) / 100);
                    if (width <= 0 || height <= 0) throw new Error('裁剪范围过小。');
                    const scale = Math.min(1, 2000 / Math.max(width, height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.max(1, Math.round(width * scale));
                    canvas.height = Math.max(1, Math.round(height * scale));
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, sx, sy, width, height, 0, 0, canvas.width, canvas.height);
                    if (white > 0) {
                        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        for (let i = 0; i < pixels.data.length; i += 4) {
                            if (Math.min(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]) >= 256 - white) pixels.data[i + 3] = 0;
                        }
                        ctx.putImageData(pixels, 0, 0);
                    }
                    this.imageTarget = 'block';
                    await this.useImage(canvas.toDataURL('image/png'));
                    this.notice('已插入处理后的图片');
                } catch (e) { this.error = `无法处理图片。${e.message || ''}`; }
            },
            resetOverrides() {
                const items = this.activeItems.filter(entry => entry.kind === 'question' && this.byId.has(String(entry.questionId)));
                if (!items.length || !root.confirm('恢复选中题目的题干、选项、答案及解析为题库当前版本？')) return;
                for (const entry of items) delete entry.override;
                this.notice('已恢复题库版本');
            },
            removeDuplicates() {
                const seen = new Set();
                const before = this.doc.blocks.length;
                this.doc.blocks = this.doc.blocks.filter(item => {
                    if (item.kind !== 'question') return true;
                    const key = String(item.questionId);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                this.selected = this.selected.filter(id => this.doc.blocks.some(item => item.id === id));
                this.notice(`已移除 ${before - this.doc.blocks.length} 个重复引用`);
            },
            scheduleLayout() {
                const revision = ++this.revision;
                this.rendering = true;
                clearTimeout(this._layoutTimer);
                cancelAnimationFrame(this._spaceFrame || 0);
                this._spaceFrame = 0;
                this._layoutTimer = setTimeout(() => {
                    this.layout(revision).catch(e => { if (this.ready && revision === this.revision) this.error = `排版失败。${e.message || ''}`; });
                }, 36);
            },
            scheduleSpaceLayout() {
                if (this._spaceFrame) return;
                this._spaceFrame = requestAnimationFrame(() => {
                    this._spaceFrame = 0;
                    if (this.ready && this._measured) this.applyMeasured(this._measured, this.geo, this.s);
                });
            },
            applyMeasured(rows, geometry, settings) {
                const blanks = new Map(this.doc.blocks.map(item => [item.id, L.limit(item.space, 0, 420, 0)]));
                const spaced = rows.map(row => {
                    const space = blanks.get(row.id);
                    return space ? { ...row, height: row.height + space, space } : row;
                });
                const drop = this._paperDrop;
                const positions = drop?.capture();
                this.pages = root.Vue.markRaw(L.paginate(spaced, geometry, { mode: settings.mode, perPage: settings.perPage, gap: this.blockGap() }));
                if (drop) this.$nextTick(() => { if (this._paperDrop === drop) drop.settle(positions); });
            },
            async layout(revision) {
                this.rendering = true;
                let lease;
                try {
                    await this.$nextTick();
                    if (!this.ready || revision !== this.revision) return;
                    const geometry = this.geo;
                    const s = this.s;
                    const stage = this.$refs.measure;
                    const references = this.doc.blocks.flatMap(entry => entry.kind === 'question' && !entry.snapshot
                        ? this.byId.get(String(entry.questionId))?.images || [] : []);
                    lease = root.Qisi.LibraryImageResources.openStoredImages(references);
                    const images = new Map((await lease.ready).map(image => [String(image.id), image]));
                    if (!this.ready || revision !== this.revision) return;
                    stage.style.width = `${geometry.columnWidth}px`;
                    const items = [];
                    const appended = [];
                    let number = Math.trunc(L.limit(s.firstQuestion, 1, 9999, 1));
                    for (const entry of this.doc.blocks) {
                        const q = entry.kind === 'question' ? this.resolve(entry, images) : null;
                        const no = q || entry.kind === 'question' ? number++ : 0;
                        items.push({ entry, q, no, parts: D.contentParts(entry, q, s) });
                        if (q && s.answerPlacement === 'end' && (s.showAnswer || s.showSolution)) {
                            const parts = D.questionParts(entry, q, s, true);
                            if (parts.length) appended.push({ entry: { ...entry, id: entry.id + ':answer', split: true }, q, no, parts, answerOnly: true });
                        }
                    }
                    if (appended.length) {
                        const entry = D.block('heading', { id: 'answer-heading', text: '参考答案与解析', breakBefore: 'page' });
                        entry.id = 'answer-heading';
                        items.push({ entry, no: 0, parts: D.contentParts(entry, null, s) }, ...appended);
                    }
                    const probes = items.map(item => {
                        const node = document.createElement('div');
                        node.className = 'hc-unit';
                        node.innerHTML = D.wrap(item.entry, item.q, s, item.no, item.parts, false, item.answerOnly, false);
                        return node;
                    });
                    stage.replaceChildren(...probes);
                    let timer;
                    // Trigger the font requests for the measured text and its math before paginating.
                    stage.getBoundingClientRect();
                    await Promise.race([Promise.all([waitImages(stage), document.fonts?.ready]), new Promise(resolve => { timer = setTimeout(resolve, 2200); })]);
                    clearTimeout(timer);
                    if (!this.ready || revision !== this.revision) return;
                    root.Qisi.FigureEditor.estimateAutoColumns(stage);
                    const measured = (node, item, start = 0) => {
                        prepareColumn(node);
                        const id = item.entry.id;
                        return { id, key: start ? `${id}:part:${start}` : id, kind: item.answerOnly ? 'support' : item.entry.kind,
                            continued: start > 0, movable: !item.answerOnly && id !== 'answer-heading',
                            breakBefore: start ? '' : item.entry.breakBefore, keepNext: ['title','heading'].includes(item.entry.kind),
                            html: node.innerHTML, height: node.getBoundingClientRect().height };
                    };
                    const fragmentProbe = document.createElement('div');
                    fragmentProbe.className = 'hc-unit';
                    this._measured = items.map((item, index) => {
                        const whole = measured(probes[index], item);
                        if (s.mode === 'flow') return whole;
                        const maySplitSupport = item.q && s.answerPlacement === 'inline' && (s.showAnswer || s.showSolution);
                        const parts = !item.entry.split && maySplitSupport ? D.questionParts(item.entry, item.q, s, false, true) : item.parts;
                        if ((!item.entry.split && !maySplitSupport) || parts.length <= 1) return whole;
                        const measure = (start, stop) => {
                            fragmentProbe.innerHTML = D.wrap(item.entry, item.q, s, item.no, parts.slice(start, stop), start > 0, item.answerOnly, false);
                            return measured(fragmentProbe, item, start);
                        };
                        const splitAt = start => (room, force, space) => {
                            stage.append(fragmentProbe);
                            try {
                                const fit = fitParts(parts, start, room, force, space, measure);
                                if (!fit) return null;
                                const [row, stop] = fit;
                                const rest = stop < parts.length ? { height: Infinity, space, splitAt: splitAt(stop) } : null;
                                return [row, rest];
                            } finally { fragmentProbe.remove(); }
                        };
                        let firstHeight;
                        return { ...whole, splitAt: splitAt(0), firstHeight: () => {
                            if (firstHeight === undefined) {
                                stage.append(fragmentProbe);
                                try { firstHeight = Math.min(whole.height, measure(0, 1).height); }
                                finally { fragmentProbe.remove(); }
                            }
                            return firstHeight;
                        } };
                    });
                    this.applyMeasured(this._measured, geometry, s);
                    stage.replaceChildren();
                    const previous = this._layoutImageLease;
                    this._layoutImageLease = lease; lease = null;
                    this.layoutImages = root.Vue.markRaw(images);
                    if (previous) this.$nextTick(previous.release);
                } finally {
                    lease?.release();
                    if (revision === this.revision) this.rendering = false;
                }
            },
            blockGap() { return L.limit(this.s.blockGap, 0, 90, 18); },
            splitBlock(id) {
                const item = this.doc.blocks.find(entry => entry.id === id);
                if (!item) return;
                item.split = true;
                this.selected = [id];
                this.openPanel('move');
                this.notice('已按段落尝试拆分。单个图文段仍过高时，可缩小配图或调整留白。');
            },
            frameStyle() {
                return `${L.limit(this.s.frameWidth, 0, 8, 1)}px ${D.lineStyle(this.s.frame)} ${L.color(this.s.frameColor)}`;
            },
            fullHeight(page) {
                if (this.s.mode !== 'flow') return this.geo.height;
                const rows = page.columns[0] || [];
                return Math.max(this.geo.height, this.geo.top + this.geo.bottom + rows.reduce((sum, item) => sum + item.height, 0) + Math.max(0, rows.length - 1) * this.blockGap());
            },
            bands(page, edge) {
                const { columns, left, right, gap, columnWidth } = this.geo;
                const s = this.s;
                const body = this.bodySections[page];
                if (body?.chapter) return [];
                const half = columns === 2 && s.bandMode === 'half';
                const offsetLeft = L.limit(s[`${edge}Left`], -25, 40, 0) * L.PX_PER_MM;
                const offsetRight = L.limit(s[`${edge}Right`], -25, 40, 0) * L.PX_PER_MM;
                return Array.from({ length: half ? 2 : 1 }, (_, i) => {
                    const index = half ? page * 2 + i : page;
                    const number = L.pageLabel(s, index, this.pages.length * (half ? 2 : 1));
                    const x = left + offsetLeft + i * (columnWidth + gap);
                    const width = (half ? columnWidth : this.geo.width - left - right) - offsetLeft - offsetRight;
                    const values = this.sides.map(([side]) => {
                        const slot = s[edge][side];
                        if (!slot.enabled || (slot.range === 'first' && index > 0) || (slot.range === 'odd' && index % 2) || (slot.range === 'even' && index % 2 === 0)) return {};
                        const variables = { page: number.current, pages: number.total, section: body?.section || this.documentName };
                        const content = String(slot.content || '').replace(/\{(page|pages|section)\}/g, (_, key) => variables[key]);
                        return { content, url: D.safeImage(slot.image), imageHeight: L.limit(slot.imageHeight, 8, 100, 40),
                            style: { fontFamily: D.font(slot.font), fontSize: `${L.limit(slot.size, 8, 36, 14)}px`, fontWeight: slot.bold ? 700 : 400, color: L.color(slot.color) } };
                    });
                    const rule = body ? `1px solid ${s.body.colors.accent}` : '1px solid #a8b4b6';
                    const present = Boolean(s[`${edge}Line`] || s[`${edge}Paint`] || values.some(slot => slot.content || slot.url));
                    return { values, present, style: { left: `${x}px`, width: `${Math.max(24, width)}px`, height: `${Math.max(18, (edge === 'header' ? this.geo.top : this.geo.bottom) * .85)}px`, background: s[`${edge}Paint`] ? L.color(s.bandColor, '#f0f5f4') : 'none',
                        borderBottom: edge === 'header' && s.headerLine ? rule : '', borderTop: edge === 'footer' && s.footerLine ? rule : '' } };
                });
            },
            separatorStyle() {
                const g = this.geo;
                const ratio = L.limit(this.s.separatorHeight, 10, 100, 100) / 100;
                return { left: `${g.left + g.columnWidth + g.gap / 2}px`, top: `${g.top + (1 - ratio) * g.contentHeight / 2}px`,
                    height: `${g.contentHeight * ratio}px`, borderLeft: `${L.limit(this.s.separatorWidth, .5, 6, 1)}px ${D.lineStyle(this.s.separatorType)} ${L.color(this.s.separatorColor)}` };
            },
            watermarkStyle() {
                return { opacity: L.limit(this.s.watermarkOpacity, 0, 80, 12) / 100, color: L.color(this.s.watermarkColor),
                    fontSize: `${L.limit(this.s.watermarkSize, 12, 180, 45)}px`, transform: `translate(-50%, -50%) rotate(${L.limit(this.s.watermarkAngle, -90, 90, -30)}deg)` };
            },
            sealStyle() {
                const side = this.s.sealSide === 'right' ? 'right' : 'left';
                const border = `${D.lineStyle(this.s.sealType)} 1px ${L.color(this.s.sealColor)}`;
                return { [side]: `${L.limit(this.s[`margin${side === 'right' ? 'Right' : 'Left'}`], 4, 120, 20) * L.PX_PER_MM}px`,
                    width: `${this.geo.seal}px`, top: `${this.geo.top}px`, bottom: `${this.geo.bottom}px`, color: L.color(this.s.sealColor),
                    [side === 'right' ? 'borderLeft' : 'borderRight']: border };
            },
            async print() {
                if (!this.doc.blocks.length || this.rendering || this.printing) return;
                const missing = this.doc.blocks.find(entry => entry.kind === 'question' && !this.resolve(entry));
                if (missing) {
                    this.error = `第 ${this.questionIndex(missing.id)} 题的题库引用已失效。请替换或删除这道题后再导出。`;
                    return;
                }
                if (this.hasOverflow) { this.error = '有题块超过纸面高度。请调整图片、留白，或使用分割预览后再导出。'; return; }
                const printedQuestions = this.doc.blocks.map(entry => entry.kind === 'question'
                    ? { ...this.resolve(entry), ...entry.override, printQuestionNo: this.questionIndex(entry.id) }
                    : { stem: entry.text, printLabel: String(entry.text || '').trim().slice(0, 24) || '正文' });
                if (!root.Qisi.HandoutFormulaGate.confirmBeforeExport(printedQuestions, { includeAnswer: this.s.showAnswer, includeSolution: this.s.showSolution })) return;
                const viewer = window.open('', '_blank');
                if (!viewer) { this.error = '浏览器拦截了打印窗口，请允许打开弹窗。'; return; }
                this.printing = true;
                try {
                    viewer.opener = null;
                    const pages = [...this.$refs.canvas.querySelectorAll('.hc-sheet')].map(el => {
                        const clone = el.cloneNode(true);
                        clone.removeAttribute('style');
                        clone.querySelectorAll('.hc-overflow').forEach(node => node.remove());
                        clone.querySelectorAll('.hc-selected').forEach(node => node.classList.remove('hc-selected'));
                        return clone;
                    });
                    const { width, height } = this.geo;
                    const documentHeight = this.s.mode === 'flow' ? this.fullHeight(this.pages[0]) : height;
                    if (documentHeight > 19200) throw new Error(`流式${this.documentTerm}过长，请切换到单列或双列后导出。`);
                    const mm = px => `${(px / L.PX_PER_MM).toFixed(4)}mm`;
                    const handoutCss = document.querySelector('link[href^="./qisi-handout-composer.css"]')?.href || './qisi-handout-composer.css';
                    const figureCss = document.querySelector('link[href^="./qisi-figure-editor.css"]')?.href || './qisi-figure-editor.css';
                    const css = ['./vendor/katex/katex.min.css', './qisi-noto-serif-sc.css', handoutCss, figureCss].map(path =>
                        `<link rel="stylesheet" href="${D.escape(new URL(path, location.href).href)}">`).join('');
                    const portableImages = new Map();
                    for (const page of pages) {
                        if (page.querySelector('.latex-image-placeholder, .hc-missing')) throw new Error('有配图无法读取。请修复题图后重新导出。');
                        for (const img of page.querySelectorAll('img')) {
                            img.loading = 'eager';
                            const url = img.getAttribute('src') || '';
                            if (!url.startsWith('blob:')) continue;
                            if (!portableImages.has(url)) {
                                const response = await fetch(url);
                                if (!response.ok) throw new Error('有配图无法读取。请重新导出。');
                                portableImages.set(url, await readFile(await response.blob()));
                            }
                            img.src = portableImages.get(url);
                        }
                    }
                    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><base href="${D.escape(location.href)}"><title>${D.escape(this.documentName)}</title>${css}<style>
                        @page { size:${mm(width)} ${mm(documentHeight)}; margin:0 }
                        html,body{margin:0;padding:0;background:#fff} .hc-print .hc-sheet{width:${mm(width)};height:${mm(documentHeight)};position:relative;box-shadow:none;margin:auto;content-visibility:visible}
                        .hc-print-action{display:block;margin:8px auto}
                        @media print {
                            .hc-print-action{display:none}
                            .hc-print .hc-sheet{height:calc(${mm(documentHeight)} - 1px);break-inside:avoid}
                            .hc-print .hc-sheet + .hc-sheet{break-before:page}
                            *{print-color-adjust:exact;-webkit-print-color-adjust:exact}
                        }
                    </style></head><body class="hc-print"><button type="button" class="hc-print-action" disabled>正在准备打印…</button>${pages.map(page => page.outerHTML).join('')}
                    <script>
                        const button = document.querySelector('.hc-print-action');
                        const failed = () => { button.textContent = '配图、字体或样式未能完整加载，请重新导出。'; };
                        const timer = setTimeout(failed, 30000);
                        addEventListener('load', async () => {
                            URL.revokeObjectURL(location.href);
                            try {
                                if ([...document.querySelectorAll('link')].some(link => !link.sheet)) throw Error('style');
                                document.body.getBoundingClientRect();
                                await Promise.all([document.fonts.ready, ...[...document.images].map(image => image.decode())]);
                                if ([...document.fonts].some(font => font.status === 'error')) throw Error('font');
                                if (button.textContent !== '正在准备打印…') return;
                                button.addEventListener('click', () => window.print());
                                button.disabled = false;
                                button.textContent = '打印 / 另存为 PDF';
                                window.print();
                            } catch (_) { failed(); }
                            finally { clearTimeout(timer); }
                        }, { once: true });
                    </script></body></html>`;
                    if (!viewer.closed) viewer.location.replace(URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })));
                } catch (e) { viewer.close(); this.error = e.message || '无法生成打印预览。'; }
                finally { this.printing = false; }
            },
            safeImage: D.safeImage,
            bodyColorVars: D.bodyColorVars,
            limit: L.limit,
            figureOf(event) { return event.target.closest('[data-figure]')?.dataset.figure || event.target.closest('[data-image-id]')?.dataset.imageId; },
            plain
        }
    };

    component.template = `
    <section class="hc-studio" data-testid="handout-studio" @pointerdown.capture="commitUndo"
        @keydown.esc.stop="modal ? closeModal() : (selectedBand ? clearSelection() : panel='')" @keydown.backspace="deleteSelectedWithBackspace">
        <header class="hc-command">
            <button class="hc-button hc-files" @click="openLibrary"><icon name="folder-open" size="16"></icon> 我的{{documentTerm}}</button>
            <input class="hc-name" v-model="editableName" maxlength="120" :aria-label="documentTerm+'名称'" :placeholder="defaultDocumentName">
            <span class="hc-save-state" aria-live="polite">{{dirty?'待保存':saved.some(row=>row.id===doc.id)?'已保存':''}}</span>
            <div class="hc-command-actions">
                <button class="hc-button" @click="undo" :disabled="!undoAvailable" aria-keyshortcuts="Control+Z Meta+Z" title="撤回上一步（Ctrl+Z）"><icon name="undo-2" size="15"></icon> 撤回</button>
                <button class="hc-button" @click="pickImage('crop')">图片处理</button>
                <button class="hc-button" @click="share" :disabled="!doc.blocks.length"><icon name="share-2" size="15"></icon> 分享{{documentTerm}}</button>
                <button class="hc-button" @click="print" :disabled="!doc.blocks.length||rendering||printing"><icon name="printer" size="15"></icon> 导出 PDF</button>
                <button class="hc-button hc-primary" @click="save()" :disabled="!ready"><icon name="save" size="15"></icon> 保存{{documentTerm}}</button>
                <button class="hc-button hc-quiet" @click="$emit('close')" :aria-label="'关闭'+documentTerm+'工作台'">✕</button>
            </div>
        </header>
        <div class="hc-layout-bar">
            <div class="hc-segments" aria-label="布局模式">
                <button v-for="[value, label] in modes" :key="value" :aria-pressed="s.mode===value" @click="mode(value)">{{label}}</button>
            </div>
            <select v-model="s.paper" aria-label="页面尺寸"><option v-for="[v,t] in paperOptions" :key="v" :value="v">{{t}}</option></select>
            <button class="hc-button hc-quiet" v-if="s.paper==='custom'" @click="panel='page';tab='geometry'">设置尺寸</button>
            <span class="hc-layout-count">{{counts.question||0}} 题 · {{counts.knowledge||0}} 知识 · {{(counts.title||0)+(counts.heading||0)+(counts.text||0)}} 文本<span v-if="s.mode!=='flow'"> · {{pages.length}} 页</span></span>
            <div class="hc-layout-controls">
                <div class="hc-zoom">
                    <input type="range" min="25" max="400" step="1" :value="Math.round(actualZoom*100)" @input="setZoom($event.target.valueAsNumber)" aria-label="预览缩放">
                    <button class="hc-button hc-quiet" aria-label="预览恢复到 100%" title="恢复到 100%" @click="setZoom(100)">{{zoomText}}</button>
                    <button class="hc-button hc-fit" :aria-pressed="s.zoomFit" @click="s.zoomFit=true">适宽</button>
                </div>
                <button class="hc-button hc-quiet hc-reflow" @click="scheduleLayout" title="重新排版" aria-label="重新排版"><icon name="rotate-cw" size="16"></icon><span>重新排版</span></button>
            </div>
        </div>

        <div class="hc-workspace" ref="workspace">
            <aside class="hc-outline" ref="outline">
                <div class="hc-sidebar-title"><h2>内容</h2><span>{{doc.blocks.length}} 项</span></div>
                <div class="hc-outline-actions">
                    <button class="hc-button hc-tinted" @click="beginImport('basket')"><icon name="shopping-basket" size="15"></icon> 试题篮 <b>{{basket.length}}</b></button>
                    <button class="hc-button" @click="beginImport('library')"><icon name="plus" size="15"></icon> 从题库选题</button>
                </div>
                <div class="hc-select-tools">
                    <button @click="allSelected ? selected=[] : selectKind()" :aria-pressed="allSelected" :disabled="!doc.blocks.length">全选</button>
                    <button @click="selectKind('question')" :disabled="!counts.question">仅题目</button>
                    <button @click="clearSelection" :disabled="!selected.length&&!selectedBand">取消选择</button>
                </div>
                <div class="hc-object-list" ref="objects" tabindex="0" @pointerdown="pointerSelect" @click="listClick" :aria-label="documentTerm+'内容列表'">
                    <div v-for="(item,index) in doc.blocks" :key="item.id" class="hc-object" :class="{'hc-object-active':selected.includes(item.id)}" :data-entry="item.id"
                        @keydown.alt.up.prevent="selected=[item.id];move('up')" @keydown.alt.down.prevent="selected=[item.id];move('down')">
                        <input type="checkbox" :checked="selected.includes(item.id)" :aria-label="'选择第 '+(index+1)+' 项'">
                        <button class="hc-object-text" :title="describe(item)" aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown" @dblclick.stop="openEditor(item.id)">
                            <span class="hc-object-meta">{{labels[item.kind]}} <b>{{item.kind==='question'?questionIndex(item.id):index+1}}</b><small v-if="item.breakBefore">{{item.breakBefore==='page'?'换页':'换栏'}}</small></span>
                            <span class="hc-object-label">{{describe(item)}}</span>
                        </button>
                    </div>
                </div>
                <div class="hc-outline-footer"><hc-field label="自动保存" kind="check" v-model="s.autosave"></hc-field></div>
            </aside>

            <div class="hc-stage-wrap">
                <div class="hc-canvas" ref="canvas" tabindex="0" :aria-label="documentTerm+'纸面预览'" aria-keyshortcuts="Control+A Meta+A"
                    :style="{'--hc-page-scale':actualZoom}" @pointerdown="startPaperDrag" @dragstart.prevent @click="clearPaperSelection">
                    <div v-for="(page,pi) in pages" :key="pi" class="hc-sheet-spacer" :style="{'--hc-page-width':geo.width+'px','--hc-page-height':fullHeight(page)+'px'}">
                        <section class="hc-sheet" :class="{'hc-body24-sheet':s.theme==='body24'}" :data-sheet="pi+1">
                            <div v-if="s.watermark||s.watermarkImage" class="hc-watermark" :style="watermarkStyle()"><img v-if="safeImage(s.watermarkImage)" :src="safeImage(s.watermarkImage)" alt="水印">{{s.watermark}}</div>
                            <template v-if="s.mode!=='flow'" v-for="edge in ['header','footer']" :key="edge">
                                <div v-for="(band,index) in bands(pi,edge)" :key="index" :class="['hc-band','hc-band-'+edge,{'hc-band-interactive':band.present,'hc-band-active':band.present&&selectedBand===edge}]" :style="band.style"
                                    :role="band.present?'button':null" :tabindex="band.present?0:null" :aria-label="band.present?(edge==='header'?'页眉':'页脚'):null" :aria-pressed="band.present?selectedBand===edge:null"
                                    @click.stop="chooseBand(edge)" @keydown.enter.stop.prevent="chooseBand(edge)" @keydown.space.stop.prevent="chooseBand(edge)">
                                    <div v-for="(value,si) in band.values" :key="si" :style="value.style"><img v-if="value.url" :src="value.url" :style="{height:value.imageHeight+'px'}" alt=""><span>{{value.content}}</span></div>
                                </div>
                            </template>
                            <div v-if="s.seal&&s.mode!=='flow'" class="hc-seal" :style="sealStyle()"><span>{{s.sealText}}</span></div>
                            <div v-if="s.separator&&s.mode==='double'" class="hc-separator" :style="separatorStyle()"></div>
                            <div v-if="s.frame!=='none'" class="hc-page-frame" :style="{inset:geo.top+'px '+geo.right+'px '+geo.bottom+'px '+geo.left+'px',border:frameStyle()}"></div>
                            <div class="hc-columns" :style="{left:geo.left+'px',right:geo.right+'px',top:geo.top+'px',columnGap:geo.gap+'px'}">
                                <div class="hc-column" v-for="(column,ci) in page.columns" :key="ci" :style="{width:geo.columnWidth+'px',gap:blockGap()+'px'}">
                                    <div v-for="row in column" :key="row.key" class="hc-unit" :class="{'hc-selected':selected.includes(row.id),'hc-over':row.overflow}" :data-block="row.id" :data-paper-draggable="row.movable?row.key:null"
                                        @click="choose(row.id,$event)" @dblclick="openEditor(row.id,figureOf($event))">
                                        <div class="hc-paper-content">
                                            <div v-html="row.html"></div>
                                            <div v-if="row.space" class="hc-writing-space" :style="{height:row.space+'px'}" aria-hidden="true"></div>
                                            <div class="hc-overflow" v-if="row.overflow"><strong>超出 {{row.overflow}} px</strong><button @click.stop="openEditor(row.id)">编辑题块</button><button @click.stop="splitBlock(row.id)">分割预览</button></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="!doc.blocks.length&&ready" class="hc-paper-empty"><icon name="files" size="26"></icon><h2>从一份空白{{documentTerm}}开始</h2><button class="hc-button hc-primary" @click="beginImport(basket.length?'basket':'library')">添加题目</button><button class="hc-button hc-quiet" @click="openPanel('presets')">插入卷首预设</button></div>
                        </section>
                    </div>
                </div>
                <div v-if="selectedBand" class="hc-selection-bar" aria-label="所选页眉或页脚操作">
                    <div class="hc-selection-actions">
                        <strong>{{selectedBand==='header'?'已选中页眉':'已选中页脚'}}</strong>
                        <button class="hc-text-danger" @click="removeBand" aria-keyshortcuts="Backspace">{{selectedBand==='header'?'删除页眉':'删除页脚'}}</button>
                    </div>
                </div>
                <div v-else-if="selected.length" class="hc-selection-bar" aria-label="所选元素操作">
                    <div class="hc-selection-actions">
                        <strong>选中 {{activeItems.length}} 项</strong>
                        <button v-if="currentItem" @click="openEditor(currentItem.id)">编辑</button>
                        <button @click="duplicate('after')">复制一份</button>
                        <button @click="openPanel('style')">样式</button>
                        <button @click="move('up')" aria-label="上移">↑</button><button @click="move('down')" aria-label="下移">↓</button>
                        <button @click="openPanel('move')">分页</button><button class="hc-text-danger" @click="remove()" aria-keyshortcuts="Backspace" :title="'删除选中的'+documentTerm+'块（Backspace）'">删除</button>
                    </div>
                    <hc-field :label="selected.length>1?'批量底部留白':'底部留白'" kind="range" :min="0" :max="420" :model-value="selectedSpace" @update:model-value="space"></hc-field>
                </div>
                <div class="hc-measure" ref="measure" aria-hidden="true"></div>
            </div>

            <div class="hc-splitter" ref="splitter" role="separator" aria-label="调整右侧工具栏宽度" aria-orientation="vertical"
                aria-controls="hc-inspector" tabindex="0" :aria-valuemin="inspectorSize.min" :aria-valuemax="inspectorSize.max" :aria-valuenow="inspectorSize.current"
                title="拖动调整右栏宽度，双击恢复默认" @pointerdown="resizeInspector" @keydown="resizeInspectorKey" @dblclick="setInspectorWidth(null)"></div>
            <aside class="hc-inspector" id="hc-inspector" :aria-label="documentTerm+'工具'">
                <div class="hc-sidebar-title"><h2>{{panel?(inspectorSections.find(el=>el[0]===panel)||[])[1]:'编排工具'}}</h2><button v-if="panel" class="hc-button hc-quiet" @click="panel=''">全部工具</button></div>
                <div class="hc-inspector-content">
                    <div v-if="!panel" class="hc-tool-home">
                        <h3>插入内容</h3><div class="hc-tool-grid hc-tool-insert">
                            <button class="hc-button" @click="addText()"><icon name="file-plus" size="16"></icon>添加文本</button><button class="hc-button" @click="modal='knowledge';search=''"><icon name="book-open" size="16"></icon>添加知识</button>
                            <button class="hc-button" @click="pickImage()"><icon name="image" size="16"></icon>图库选图</button><button class="hc-button" @click="panel='page';tab='templates'"><icon name="layout-template" size="16"></icon>模板素材</button>
                        </div>
                        <h3>排版设置</h3><div class="hc-tool-grid hc-tool-settings"><button v-for="[key,label,symbol] in inspectorSections" :key="key" class="hc-button" @click="openPanel(key)"><icon :name="symbol" size="16"></icon>{{label}}</button></div>
                        <h3>选中内容</h3><div class="hc-tool-grid">
                            <button class="hc-button" @click="copySelection" :disabled="!selected.length"><icon name="copy" size="16"></icon>复制选中</button><button class="hc-button" @click="pasteSelection('after')" :disabled="!copied.length"><icon name="clipboard-paste" size="16"></icon>插入选中</button>
                            <button class="hc-button" @click="applyBox('')" :disabled="!activeItems.some(item=>item.box)">移除盒子</button><button class="hc-button hc-text-danger" @click="remove()" :disabled="!selected.length">删除选中</button>
                            <template v-if="s.theme==='body24'"><button class="hc-button hc-tinted" @click="markExample(true)" :disabled="!activeItems.some(item=>item.kind==='question'&&item.bodyRole!=='example')">设为例题</button><button class="hc-button" @click="markExample(false)" :disabled="!activeItems.some(item=>item.bodyRole==='example')">取消例题</button></template>
                        </div>
                        <div class="hc-tool-grid hc-more"><button class="hc-button hc-quiet" @click="modal='more'">更多操作</button><button class="hc-button hc-quiet" @click="modal='help'">操作说明</button></div>
                    </div>

                    <template v-if="panel==='presets'||panel==='titles'">
                        <div v-for="preset in (s.theme==='body24' ? (panel==='titles'?bodyPresets.filter(item=>item[0]!=='text'):bodyPresets) : (panel==='titles'?[presets[0],['title','科目标题','数　学'],['heading','专题小标题','第一讲　函数的性质']]:presets))" :key="preset[4]?.id||preset[1]" class="hc-preset">
                            <strong>{{preset[1]}}</strong><p v-if="preset[2]">{{preset[2]}}</p><hr v-else>
                            <div class="hc-row"><button class="hc-button hc-quiet" @click="addPreset(preset,'head')">插入开头</button><button class="hc-button hc-quiet" @click="addPreset(preset,'after')" :disabled="!selected.length">插入选中后</button><button class="hc-button hc-quiet" @click="addPreset(preset,'tail')">插入末尾</button></div>
                        </div>
                    </template>

                    <template v-if="panel==='prefix'">
                        <hc-field label="起始题号" kind="number" :min="1" :max="9999" v-model="s.firstQuestion"></hc-field>
                        <hc-field label="前缀格式" v-model="prefixDraft"></hc-field>
                        <div class="hc-chip-row"><button v-for="key in ['autoNum','number','title','year']" :key="key" @click="prefixDraft+='['+key+']'" :title="{autoNum:'自动题号',number:'原始题号',title:'原题标题',year:'年份'}[key]">[{{key}}]</button></div>
                        <hc-field label="题号样式" v-model="prefixModelDraft" :options="[['hanging','悬挂缩进'],['inline','同行'],['pill','圆角编号'],['label','独立标签'],['off','隐藏题号']]"></hc-field>
                        <div class="hc-two"><hc-field label="题号颜色" kind="color" v-model="s.prefixColor"></hc-field><hc-field label="标签底色" kind="color" v-model="s.prefixBackground"></hc-field></div>
                        <div class="hc-actions"><button class="hc-button hc-primary" @click="applyPrefix('all')">应用到所有题目</button><button class="hc-button" @click="applyPrefix('selected')" :disabled="!activeItems.some(item=>item.kind==='question')">应用到选中题目</button><button class="hc-button" @click="applyPrefix('type')" :disabled="currentItem?.kind!=='question'">应用到同题型</button><button class="hc-button hc-quiet" @click="prefixDraft='';applyPrefix('all')">清除前缀</button></div>
                    </template>

                    <template v-if="panel==='source'">
                        <hc-field v-for="[key,label] in [['sourceTitle','原题标题'],['sourceYear','年份'],['sourceNumber','原题号'],['sourceType','题型'],['sourceKnowledge','知识点']]" :key="key" :label="label" kind="check" v-model="s[key]"></hc-field>
                    </template>
                    <template v-if="panel==='answers'">
                        <hc-field label="显示答案" kind="check" v-model="s.showAnswer"></hc-field><hc-field label="显示解析" kind="check" v-model="s.showSolution"></hc-field>
                        <hc-field label="答案位置" v-model="s.answerPlacement" :options="[['inline','跟随题目'],['end','汇总到文末']]"></hc-field>
                        <div class="hc-row"><button class="hc-button" @click="s.showAnswer=false;s.showSolution=false">学生版</button><button class="hc-button" @click="s.showAnswer=true;s.showSolution=true">教师版</button></div>
                    </template>

                    <template v-if="panel==='style'&&styleDraft">
                        <hc-field label="样式应用范围" v-model="styleScope" :options="[['selected',activeItems.length?'当前选中':'默认正文'],['all','所有元素']]"></hc-field>
                        <div class="hc-section">
                            <h3>通用样式</h3>
                            <hc-field label="字体" :options="fonts" :model-value="styleDraft.font" @update:model-value="styleValue('font',$event)"></hc-field>
                            <div class="hc-two"><hc-field label="字号" kind="number" :min="9" :max="70" :model-value="styleDraft.size" @update:model-value="styleValue('size',$event)"></hc-field><hc-field label="行距" kind="number" :min="1" :max="3" :step="0.05" :model-value="styleDraft.line" @update:model-value="styleValue('line',$event)"></hc-field></div>
                            <hc-field label="对齐" :options="alignOptions" :model-value="styleDraft.align" @update:model-value="styleValue('align',$event)"></hc-field>
                            <hc-field label="加粗" kind="check" :model-value="styleDraft.bold" @update:model-value="styleValue('bold',$event)"></hc-field>
                            <div class="hc-two"><hc-field label="文字颜色" kind="color" :model-value="styleDraft.color" @update:model-value="styleValue('color',$event)"></hc-field><hc-field label="背景颜色" kind="color" :model-value="styleDraft.background" @update:model-value="styleValue('background',$event);styleValue('painted',true)"></hc-field></div>
                            <hc-field label="填充背景" kind="check" :model-value="styleDraft.painted" @update:model-value="styleValue('painted',$event)"></hc-field>
                            <div class="hc-two"><hc-field v-for="[k,t,max] in [['paddingX','左右内距',80],['paddingY','上下内距',80],['radius','圆角',36],['strokeWidth','边框粗细',8]]" :key="k" :label="t" :model-value="styleDraft[k]" @update:model-value="styleValue(k,$event)" kind="number" :min="0" :max="max"></hc-field></div>
                            <div class="hc-two"><hc-field label="边框样式" :model-value="styleDraft.border" @update:model-value="styleValue('border',$event)" :options="boxStyles"></hc-field><hc-field label="边框颜色" kind="color" :model-value="styleDraft.stroke" @update:model-value="styleValue('stroke',$event)"></hc-field></div>
                        </div>
                        <div class="hc-section"><h3>题干样式</h3><hc-field label="题干加粗" kind="check" :model-value="styleDraft.stemBold" @update:model-value="styleValue('stemBold',$event)"></hc-field><hc-field label="题干颜色" kind="color" :model-value="styleDraft.stemColor" @update:model-value="styleValue('stemColor',$event)"></hc-field></div>
                        <div class="hc-section" v-for="[scope,title] in [['answer','答案'],['solution','解析']]" :key="scope"><h3>{{title}}样式</h3>
                            <hc-field label="字体" :options="fonts" :model-value="styleDraft[scope+'Font']" @update:model-value="styleValue(scope+'Font',$event)"></hc-field>
                            <div class="hc-two"><hc-field label="字号" kind="number" :min="9" :max="70" :model-value="styleDraft[scope+'Size']" @update:model-value="styleValue(scope+'Size',$event)"></hc-field><hc-field label="颜色" kind="color" :model-value="styleDraft[scope+'Color']" @update:model-value="styleValue(scope+'Color',$event)"></hc-field></div>
                        </div>
                    </template>

                    <template v-if="panel==='classic'||panel==='picture'">
                        <p class="hc-muted">先选择纸面或左侧列表中的内容，再应用容器样式。</p>
                        <button class="hc-button hc-primary" @click="applyBox(panel)" :disabled="!selected.length">应用到选中</button>
                        <button v-if="panel==='picture'" class="hc-button" @click="pickImage('picture')">选图插入绘本盒子</button>
                        <button class="hc-button" @click="applyBox('')" :disabled="!activeItems.some(item=>item.box)">移除盒子</button>
                    </template>

                    <template v-if="panel==='move'">
                        <div class="hc-tool-grid"><button class="hc-button" @click="setBreak('page')" :disabled="!selected.length">段前换页</button><button class="hc-button" @click="setBreak('column')" :disabled="!selected.length">段前换栏</button><button class="hc-button" @click="setBreak('')" :disabled="!selected.length">清除分页标记</button><button class="hc-button" @click="splitBlock(currentItem.id)" :disabled="!currentItem">分割预览</button></div>
                        <div class="hc-section hc-tool-grid"><button v-for="[key,label] in [['top','置顶'],['bottom','置底'],['up','上移'],['down','下移']]" :key="key" class="hc-button" @click="move(key)" :disabled="!selected.length">{{label}}</button></div>
                        <hc-field v-if="selected.length" label="底部留白" kind="range" :min="0" :max="420" :model-value="selectedSpace" @update:model-value="space"></hc-field>
                        <button class="hc-button" @click="insertBreak">插入分隔页</button>
                    </template>

                    <template v-if="panel==='rules'">
                        <hc-field label="每页最多题目数" kind="number" :min="0" :max="100" v-model="s.perPage"></hc-field>
                        <p class="hc-muted">单列分页时生效。0 代表不限。题干、答案、解析按一道题计。</p>
                        <hc-field label="题块间距 px" kind="range" :min="0" :max="90" v-model="s.blockGap"></hc-field>
                        <div class="hc-row"><button class="hc-button" @click="s.perPage=0;s.blockGap=18">重置规则</button><button class="hc-button hc-primary" @click="scheduleLayout();notice('已应用布局规则')">开始执行</button></div>
                    </template>

                    <template v-if="panel==='organize'">
                        <div class="hc-actions"><button class="hc-button" @click="reorder('original')" :disabled="!counts.question">按原题号升序</button><button class="hc-button" @click="reorder('type')" :disabled="!counts.question">按题型归组</button><button class="hc-button" @click="reorder('reverse')" :disabled="!counts.question">倒转题目顺序</button>
                            <button class="hc-button" @click="copySelection" :disabled="!selected.length">复制选中</button><button class="hc-button" @click="pasteSelection('after')" :disabled="!copied.length">插入到选中之后</button><button class="hc-button" @click="pasteSelection('tail')" :disabled="!copied.length">插入到末尾</button></div>
                    </template>
                    <template v-if="panel==='maintenance'">
                        <div class="hc-actions"><button class="hc-button" @click="resetOverrides" :disabled="!activeItems.some(item=>item.override)">恢复选中题目的题库版本</button><button class="hc-button" @click="removeDuplicates" :disabled="!counts.question">移除重复引用</button><button class="hc-button hc-text-danger" @click="remove()" :disabled="!selected.length">删除选中内容</button><button class="hc-button hc-text-danger" @click="remove(true)" :disabled="!doc.blocks.length">删除全部内容</button></div>
                    </template>

                    <template v-if="panel==='page'">
                        <div class="hc-page-tabs"><button v-for="[key,label] in pageTabs" :key="key" :aria-pressed="tab===key" @click="tab=key">{{label}}</button></div>
                        <template v-if="tab==='header'">
                            <hc-field label="区域" v-model="bandEdge" :options="[['header','页眉'],['footer','页脚']]"></hc-field>
                            <div class="hc-two"><hc-field label="左偏移 mm" kind="number" :min="-25" :max="40" v-model="s[bandEdge+'Left']"></hc-field><hc-field label="右偏移 mm" kind="number" :min="-25" :max="40" v-model="s[bandEdge+'Right']"></hc-field></div>
                            <div class="hc-two"><hc-field label="通栏底色" kind="check" v-model="s[bandEdge+'Paint']"></hc-field><hc-field label="横线" kind="check" v-model="s[bandEdge+'Line']"></hc-field></div>
                            <hc-field v-if="s[bandEdge+'Paint']" label="底色" kind="color" v-model="s.bandColor"></hc-field>
                            <div class="hc-segments hc-band-tabs"><button v-for="[key,label] in sides" :key="key" :aria-pressed="bandSlot===key" @click="bandSlot=key">{{label}}</button></div>
                            <hc-field label="显示此插槽" kind="check" v-model="band.enabled"></hc-field>
                            <hc-field label="内容" v-model="band.content"></hc-field>
                            <div class="hc-chip-row"><button @click="band.content+='{page}'">当前页 {page}</button><button @click="band.content+='{pages}'">总页数 {pages}</button><button v-if="s.theme==='body24'" @click="band.content+='{section}'">当前小节 {section}</button></div>
                            <hc-field label="图片链接" v-model="band.image"></hc-field>
                            <div class="hc-row"><button class="hc-button" @click="pickImage('band')">选图片</button><button class="hc-button" @click="band.image=''" :disabled="!band.image">移除图片</button></div>
                            <hc-field label="显示范围" v-model="band.range" :options="[['all','全部页面'],['first','首页'],['odd','奇数页'],['even','偶数页']]"></hc-field>
                            <hc-field label="字体" v-model="band.font" :options="fonts"></hc-field>
                            <div class="hc-two"><hc-field label="字号" kind="number" :min="8" :max="36" v-model="band.size"></hc-field><hc-field label="图高 px" kind="number" :min="8" :max="100" v-model="band.imageHeight"></hc-field><hc-field label="颜色" kind="color" v-model="band.color"></hc-field><hc-field label="加粗" kind="check" v-model="band.bold"></hc-field></div>
                            <div class="hc-section"><h3>双列页眉页脚</h3><hc-field label="编号方式" v-model="s.bandMode" :options="[['sheet','整张纸一套'],['half','左右半页各一套']]"></hc-field></div>
                            <div v-if="s.mode==='single'" class="hc-section"><h3>单列页码</h3><div class="hc-two"><hc-field label="起始页" kind="number" :min="1" :max="999" v-model="s.startPage"></hc-field><hc-field label="起始值" kind="number" :min="1" :max="9999" v-model="s.startNumber"></hc-field></div><hc-field label="指定总页数" kind="check" v-model="s.overrideTotal"></hc-field><hc-field v-if="s.overrideTotal" label="总页数" kind="number" :min="1" :max="9999" v-model="s.totalPages"></hc-field></div>
                        </template>
                        <template v-if="tab==='geometry'">
                            <hc-field label="纸张" v-model="s.paper" :options="paperOptions"></hc-field>
                            <div class="hc-two" v-if="s.paper==='custom'"><hc-field label="纸宽 mm" kind="number" :min="70" :max="750" v-model="s.width"></hc-field><hc-field label="纸高 mm" kind="number" :min="70" :max="750" v-model="s.height"></hc-field></div>
                            <div class="hc-section" v-for="[key,title,max] in [['margin','页边距 mm',120],['padding','正文内边距 px',64]]" :key="key"><h3>{{title}}</h3><div class="hc-two"><hc-field v-for="[edge,label] in edges" :key="edge" :label="label" kind="number" :min="key==='margin'?4:0" :max="max" v-model="s[key+edge]"></hc-field></div></div>
                            <div class="hc-section"><h3>版心边框</h3><hc-field label="线型" v-model="s.frame" :options="boxStyles"></hc-field><div class="hc-two"><hc-field label="粗细" kind="number" :min="0" :max="8" v-model="s.frameWidth"></hc-field><hc-field label="颜色" kind="color" v-model="s.frameColor"></hc-field></div><div class="hc-row"><button class="hc-button" @click="s.frame='solid';s.frameWidth=2;s.frameColor='#17242d'">默认边框</button><button class="hc-button" @click="s.frame='none'">清除</button></div></div>
                        </template>
                        <template v-if="tab==='double'">
                            <hc-field label="双列栏间距 mm" kind="range" :min="0" :max="40" v-model="s.columnGap"></hc-field>
                            <hc-field label="显示栏间线" kind="check" v-model="s.separator"></hc-field>
                            <div v-if="s.separator" class="hc-section"><div class="hc-two"><hc-field label="线型" v-model="s.separatorType" :options="lines"></hc-field><hc-field label="颜色" kind="color" v-model="s.separatorColor"></hc-field></div><hc-field label="粗细 px" kind="range" :min="0.5" :max="6" :step="0.5" v-model="s.separatorWidth"></hc-field><hc-field label="高度 %" kind="range" :min="10" :max="100" v-model="s.separatorHeight"></hc-field></div>
                            <hc-field label="显示密封线" kind="check" v-model="s.seal"></hc-field><div v-if="s.seal" class="hc-section"><hc-field label="位置" v-model="s.sealSide" :options="[['left','左侧'],['right','右侧']]"></hc-field><hc-field label="占宽 mm" kind="range" :min="3" :max="40" v-model="s.sealWidth"></hc-field><hc-field label="密封线文字" kind="textarea" v-model="s.sealText"></hc-field><div class="hc-two"><hc-field label="线型" v-model="s.sealType" :options="lines"></hc-field><hc-field label="颜色" kind="color" v-model="s.sealColor"></hc-field></div></div>
                        </template>
                        <template v-if="tab==='watermark'">
                            <hc-field label="水印文字" v-model="s.watermark"></hc-field><div class="hc-row"><button class="hc-button" @click="pickImage('watermark')">选水印图片</button><button class="hc-button" @click="s.watermarkImage=''" :disabled="!s.watermarkImage">移除图片</button></div>
                            <hc-field label="颜色" kind="color" v-model="s.watermarkColor"></hc-field><hc-field label="不透明度 %" kind="range" :min="0" :max="80" v-model="s.watermarkOpacity"></hc-field><hc-field label="字号" kind="range" :min="12" :max="180" v-model="s.watermarkSize"></hc-field><hc-field label="旋转角度" kind="range" :min="-90" :max="90" v-model="s.watermarkAngle"></hc-field>
                        </template>
                        <template v-if="tab==='templates'">
                            <div class="hc-template">
                                <div class="hc-template-preview" :style="bodyColorVars(bodyTemplate.settings.body.colors)" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                                <h3><button type="button" class="hc-template-name" @click="editBodyTemplate" :aria-label="'编辑模板 '+bodyTemplate.name">{{bodyTemplate.name}}</button></h3>
                                <p>A4 单列，包含内容提要、定理、例题和易错提醒。中文 Noto Serif SC，英文和公式使用 LaTeX 字形。</p>
                                <p v-if="bodyTemplate.settings.body.modules.length">自定义模块 {{bodyTemplate.settings.body.modules.length}} 个</p>
                                <button class="hc-button hc-primary" @click="applyTemplate(bodyTemplate)">应用正文模板</button>
                                <button class="hc-button" @click="editBodyTemplate">编辑模板</button>
                                <button v-if="s.theme==='body24'" class="hc-button" @click="openPanel('presets')">插入正文模块</button>
                            </div>
                            <hc-field label="模板名称" v-model="editName"></hc-field><button class="hc-button hc-primary" @click="saveTemplate" :disabled="!editName.trim()">把当前设置保存为模板</button>
                            <div class="hc-section"><p v-if="!templates.length" class="hc-muted">暂无自定义模板。</p><div v-for="template in templates" :key="template.name" class="hc-file-row"><strong>{{template.name}}</strong><button class="hc-button" @click="applyTemplate(template)">应用</button><button class="hc-button hc-text-danger" @click="removeTemplate(template.name)">删除</button></div></div>
                        </template>
                    </template>
                </div>
            </aside>
        </div>

        <input hidden ref="importFile" type="file" accept=".json,application/json" @change="importFile">
        <div v-if="modal" class="hc-overlay" @click.self="closeModal()">
            <section class="hc-dialog" :class="{'hc-dialog-wide':['questions','gallery'].includes(modal),'hc-dialog-editor':modal==='editor','hc-dialog-template':modal==='template'}" role="dialog" aria-modal="true" :aria-label="({library:'我的'+documentTerm,questions:'选题',editor:'编辑内容',gallery:'图库选图',crop:'图片处理',knowledge:'选知识点',more:'更多操作',help:'操作说明',template:'编辑正文模板'})[modal]">
                <header class="hc-dialog-head"><h2>{{({library:'我的'+documentTerm,questions:'添加题目',editor:'编辑内容',gallery:'图库选图',crop:'图片处理',knowledge:'添加知识',more:'更多操作',help:'操作说明',template:'编辑正文模板'})[modal]}}</h2><button class="hc-button hc-quiet" @click="closeModal()" aria-label="关闭对话框">✕</button></header>

                <template v-if="modal==='template'">
                    <div class="hc-dialog-body hc-template-layout">
                        <div class="hc-template-options">
                            <hc-field label="正文模板名称" v-model="templateDraft.name"></hc-field>
                            <div class="hc-template-preview" :style="bodyColorVars(templateDraft.colors)" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
                            <div class="hc-section">
                                <h3>配色</h3>
                                <div class="hc-two"><hc-field v-for="[key,label] in templateColors" :key="key" :label="label" kind="color" v-model="templateDraft.colors[key]"></hc-field></div>
                            </div>
                            <div class="hc-section">
                                <h3>内置模块的默认内容</h3>
                                <hc-field label="内容提要" kind="textarea" v-model="templateDraft.text.overview"></hc-field>
                                <hc-field label="定理标签" v-model="templateDraft.text.theoremLabel"></hc-field>
                                <hc-field label="定理框内容" kind="textarea" v-model="templateDraft.text.theorem"></hc-field>
                                <hc-field label="易错提醒内容" kind="textarea" v-model="templateDraft.text.note"></hc-field>
                            </div>
                        </div>
                        <div class="hc-template-modules">
                            <div class="hc-template-module-head"><h3>自定义模块</h3><button class="hc-button hc-tinted" @click="addBodyModule">添加模块</button></div>
                            <p v-if="!templateDraft.modules.length" class="hc-muted">可添加带框模块、正文段或小节标题。</p>
                            <div class="hc-template-module-list">
                                <button v-for="module in templateDraft.modules" :key="module.id" class="hc-button" :aria-pressed="module.id===templateModuleId" @click="templateModuleId=module.id">{{module.name||'未命名模块'}}</button>
                            </div>
                            <template v-if="templateModule">
                                <hc-field label="模块名称" v-model="templateModule.name"></hc-field>
                                <hc-field label="模块样式" v-model="templateModule.kind" :options="moduleKinds"></hc-field>
                                <hc-field label="模块内容" kind="textarea" v-model="templateModule.content"></hc-field>
                                <div class="hc-two"><hc-field v-for="[key,label] in (templateModule.kind==='box'?moduleColors:moduleColors.slice(-1))" :key="key" :label="label" kind="color" v-model="templateModule.colors[key]"></hc-field></div>
                                <div class="hc-template-module-preview" aria-label="模块预览" v-html="templateModulePreview"></div>
                                <button class="hc-button hc-text-danger" @click="removeBodyModule">移除该模块</button>
                            </template>
                        </div>
                    </div>
                    <footer class="hc-dialog-foot"><button class="hc-button" @click="closeModal()">取消</button><button class="hc-button" :disabled="!templateDraft.name.trim()||templateSaving" @click="saveBodyTemplate(false)">保存模板</button><button class="hc-button hc-primary" :disabled="!templateDraft.name.trim()||templateSaving" @click="saveBodyTemplate(true)">保存并应用</button></footer>
                </template>

                <template v-if="modal==='library'">
                    <div class="hc-dialog-body"><div class="hc-row"><button class="hc-button hc-primary" @click="newDocument()">新建{{documentTerm}}</button><button class="hc-button" @click="$refs.importFile.click()">导入{{documentTerm}}文件</button></div>
                        <p v-if="!saved.length" class="hc-muted">保存的{{documentTerm}}会在这里显示。</p>
                        <div v-for="row in saved" :key="row.id" class="hc-file-row"><strong>{{nameInMode(row.name)}}</strong><button class="hc-button" @click="openDocument(row.id)">打开</button><button class="hc-button hc-text-danger" @click="removeSaved(row)">删除</button></div>
                    </div>
                </template>

                <template v-if="modal==='questions'">
                    <div class="hc-question-toolbar"><div class="hc-segments"><button :aria-pressed="importSource==='basket'" @click="beginImport('basket')">试题篮 ({{basket.length}})</button><button :aria-pressed="importSource==='library'" @click="beginImport('library')">题库</button></div><input class="hc-search" v-model="search" placeholder="搜索关键词、年份或原题号" aria-label="搜索题库"><select v-model="importSort" aria-label="导入题目排序"><option value="basket">当前顺序</option><option value="ascending">原题号升序</option><option value="descending">原题号降序</option><option value="directory">知识目录顺序</option><option value="yearAsc">年份升序</option><option value="yearDesc">年份降序</option><option value="random">随机顺序</option></select></div>
                    <div class="hc-dialog-body hc-question-list">
                        <p v-if="!visibleQuestions.length" class="hc-muted">{{importSource==='basket'?'试题篮里没有匹配的题目，可切换到题库。':'题库中没有匹配的题目。'}}</p>
                        <article v-for="q in visibleQuestions.slice(0,questionLimit)" :key="q.id" class="hc-question-card"><input v-model="importSelected" type="checkbox" :value="q.id" :aria-label="'选择题目 '+q.id"><div><small>{{q.type||'题目'}} {{q.questionNumber?'· 原第 '+q.questionNumber+' 题':''}} {{q.title||q.meta?.title||''}}</small><latex-preview :content="q.stem" :images="q.images||[]" preserve-line-breaks></latex-preview></div><button class="hc-button" @click="importQuestions([q.id])">加入{{documentTerm}}</button></article>
                        <button v-if="visibleQuestions.length>questionLimit" class="hc-button" @click="questionLimit+=60">加载更多题目</button>
                    </div>
                    <footer class="hc-dialog-foot"><span>{{visibleQuestions.length}} 道匹配 · 已选 {{importSelected.length}}</span><button class="hc-button" @click="importQuestions(visibleQuestions.map(q=>q.id))" :disabled="!visibleQuestions.length">导入全部匹配</button><button class="hc-button hc-primary" @click="importQuestions(importSelected)" :disabled="!importSelected.length">导入选中</button></footer>
                </template>

                <template v-if="modal==='editor'&&edit">
                    <div class="hc-edit-grid">
                        <div class="hc-edit-form">
                            <template v-if="edit.kind==='question'">
                                <hc-field label="题干 LaTeX" kind="textarea" v-model="edit.override.stem"></hc-field>
                                <hc-field label="选项布局" v-model="edit.optionsMode" :options="[['auto','自动'],['4','一行四项'],['2','两列'],['1','一列']]"></hc-field>
                                <div class="hc-two"><hc-field v-for="(_,i) in edit.override.options" :key="i" :label="'选项 '+String.fromCharCode(65+i)" v-model="edit.override.options[i]"></hc-field></div>
                                <button class="hc-button" @click="edit.override.options.push('')" :disabled="edit.override.options.length>=12">添加选项</button>
                                <hc-field label="答案" kind="textarea" v-model="edit.override.answer"></hc-field><hc-field label="解析" kind="textarea" v-model="edit.override.solution"></hc-field>
                            </template>
                            <template v-else><hc-field v-if="edit.bodyRole==='theorem'||edit.moduleBox" :label="edit.moduleBox?'模块标题':'定理标题'" v-model="edit.bodyLabel"></hc-field><hc-field label="文本内容" kind="textarea" v-model="edit.text"></hc-field>
                                <div v-if="edit.moduleBox" class="hc-two"><hc-field v-for="[key,label] in moduleColors.slice(0,3)" :key="key" :label="label" kind="color" v-model="edit.moduleBox[key]"></hc-field><hc-field label="文字色" kind="color" v-model="edit.style.color"></hc-field></div>
                            </template>
                            <button class="hc-button" @click="pickImage('editor')">添加配图</button>
                        </div>
                        <figure-preview ref="figureEditor" class="hc-edit-preview" role="region" aria-label="内容预览" tabindex="0"
                            :images="editorImages" @layout="setFigureLayout">
                            <div class="hc-edit-frame" v-paper-preview="editorHtml">
                                <div class="hc-edit-column" :style="{width:geo.columnWidth+'px'}" v-html="editorHtml"></div>
                            </div></figure-preview>
                    </div>
                    <footer class="hc-dialog-foot"><span>修改保存在这份{{documentTerm}}内。</span><button class="hc-button" @click="closeModal()">取消</button><button class="hc-button hc-primary" @click="saveEditor">保存内容</button></footer>
                </template>

                <template v-if="modal==='gallery'">
                    <div class="hc-dialog-body"><div class="hc-row"><input class="hc-search" v-model="assetSearch" aria-label="搜索图片" placeholder="搜索题库配图"><label class="hc-button hc-upload">上传本地图片<input type="file" accept="image/*" @change="uploadImage"></label></div>
                        <div v-if="chosenAsset" class="hc-image-choice"><img :src="chosenAsset" alt="已选图片"></div>
                        <p class="hc-muted" v-if="!assets.length&&!chosenAsset">可以上传本地图片。</p>
                        <div class="hc-gallery-grid"><button v-for="image in galleryImages" :key="image.key" class="hc-asset" :aria-pressed="chosenAssetKey===image.key" @click="chooseGalleryAsset(image)"><img :src="image.url" alt="" loading="lazy"><span>{{image.title}}</span></button></div>
                        <button v-if="assets.length>assetLimit" class="hc-button" @click="assetLimit+=48">加载更多图片</button>
                    </div>
                    <footer class="hc-dialog-foot"><button class="hc-button" @click="imageTarget==='editor'?modal='editor':closeModal()">返回</button><button class="hc-button hc-primary" @click="useImage()" :disabled="!chosenAsset">使用选中图片</button></footer>
                </template>

                <template v-if="modal==='crop'">
                    <div class="hc-dialog-body"><div class="hc-image-choice"><img :src="chosenAsset" :style="{clipPath:'inset('+crop.top+'% '+crop.right+'% '+crop.bottom+'% '+crop.left+'%)'}" alt="裁剪范围预览"></div><hc-field v-for="[key,title] in [['left','剪去左侧 %'],['right','剪去右侧 %'],['top','剪去顶部 %'],['bottom','剪去底部 %'],['white','去白底强度']]" :key="key" :label="title" kind="range" :min="0" :max="45" v-model="crop[key]"></hc-field></div>
                    <footer class="hc-dialog-foot"><button class="hc-button" @click="crop={left:0,right:0,top:0,bottom:0,white:0}">重置</button><button class="hc-button hc-primary" @click="cropImage">处理并插入</button></footer>
                </template>

                <template v-if="modal==='knowledge'">
                    <div class="hc-dialog-body"><input v-model="search" class="hc-search" placeholder="搜索知识点" aria-label="搜索知识点"><div class="hc-knowledge"><button v-for="(item,i) in knowledge.filter(row=>String(row.path||row.name||row).includes(search)).slice(0,80)" :key="i" class="hc-button" @click="useKnowledge(item)">{{item.path||item.name||item}}</button></div><button class="hc-button" @click="addText('knowledge')">手写知识说明</button></div>
                </template>

                <template v-if="modal==='more'"><div class="hc-dialog-body hc-actions"><button class="hc-button" @click="duplicateDoc">另存{{documentTerm}}副本</button><button class="hc-button" @click="$refs.importFile.click()">导入{{documentTerm}}文件</button><button class="hc-button" @click="closeModal();scheduleLayout()">刷新版面</button><button class="hc-button hc-text-danger" @click="remove(true);closeModal()" :disabled="!doc.blocks.length">清空{{documentTerm}}内容</button></div></template>
                <template v-if="modal==='help'"><div class="hc-dialog-body hc-help"><p>纸面和左侧列表都可以上下拖动排序。点纸面空白处可取消选择，Ctrl+A 全选，Ctrl+滚轮缩放，Ctrl+Z 撤回上一步。</p><p>双击纸面或列表中的内容可编辑。在编辑预览里可拖动配图，点击配图后可拖四角缩放，按住 Shift 保持等比例。选中题块后拖动底部滑杆，可一次设置几道题的作答空间。</p><p>点选页眉或页脚后可按 Backspace 删除。单列可限制每页题数。双列按左栏、右栏、下一张纸续排，页眉页脚可按整张纸或左右半页计数。</p><p>导出 PDF 会打开打印窗口，可选择“另存为 PDF”。分享{{documentTerm}}可下载 JSON 文件，在另一台电脑的{{documentTerm}}工作台导入。</p></div></template>
            </section>
        </div>
        <div v-if="error||message" class="hc-toast" :class="{'hc-toast-error':error}" :role="error?'alert':'status'"><span>{{error||message}}</span><button @click="error='';message=''" aria-label="关闭提示">✕</button></div>
    </section>`;

    root.Qisi.HandoutComposer = { component, install(app) { app.component('handout-composer', component); } };
})(globalThis);
