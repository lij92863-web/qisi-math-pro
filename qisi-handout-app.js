(function (root) {
    'use strict';

    const bootElement = document.getElementById('handout-app');
    const required = [
        'Database',
        'HandoutModel',
        'HandoutQuestionInstance',
        'HandoutAssetRepository',
        'HandoutRepository',
        'HandoutQuestionLibrary',
        'HandoutEditorState',
        'HandoutBatchSettings',
        'HandoutPreview',
        'HandoutPdfSession'
    ];

    const renderFatalBootError = error => {
        const message = String(error?.message || error || '未知启动错误');
        bootElement.innerHTML = '';
        const main = document.createElement('main');
        main.className = 'handout-boot handout-boot-error';
        const title = document.createElement('h1');
        title.textContent = '讲义模块没有成功启动';
        const detail = document.createElement('p');
        detail.textContent = message;
        const retry = document.createElement('button');
        retry.className = 'button primary';
        retry.textContent = '重新加载';
        retry.addEventListener('click', () => location.reload());
        main.append(title, detail, retry);
        bootElement.appendChild(main);
        root.__TEX_HANDOUT_READY__ = false;
        root.__TEX_HANDOUT_BOOT_ERROR__ = message;
    };

    const assertDependencies = () => {
        if (!root.Vue) {
            throw new Error('本地 Vue 运行库不可用');
        }
        for (const name of required) {
            if (!root.Qisi?.[name]) {
                throw new Error(`讲义依赖没有加载：Qisi.${name}`);
            }
        }
    };

    const createId = prefix => {
        const suffix = root.crypto?.randomUUID?.()
            || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        return `${prefix}-${suffix}`;
    };

    const createMathComponent = preview => ({
        props: {
            content: {
                type: [String, Number],
                default: ''
            }
        },
        computed: {
            html() {
                return preview.renderMathHtml(
                    this.content,
                    root.katex
                );
            }
        },
        template: '<span class="math-content" v-html="html"></span>'
    });

    const createAppOptions = ({
        repository,
        questionLibrary,
        modules
    }) => {
        const {
            model,
            questionInstance,
            editorState,
            batchSettings,
            preview
        } = modules;

        return {
            template: '#handout-app-template',
            components: {
                MathContent: createMathComponent(preview)
            },
            data() {
                return {
                    ready: false,
                    startupError: '',
                    handouts: [],
                    editor: null,
                    titleDraft: '',
                    saveStatus: 'idle',
                    saving: false,
                    saveRequested: false,
                    saveTimer: null,
                    notice: {
                        kind: 'info',
                        message: ''
                    },
                    viewMode: 'editor',
                    previewEdition: 'student',
                    inspectorTab: 'content',
                    globalTab: 'page',
                    questionTabs: [
                        { id: 'content', label: '内容' },
                        { id: 'options', label: '选项' },
                        { id: 'images', label: '图片' },
                        { id: 'answers', label: '答案解析' },
                        { id: 'labels', label: '标签' },
                        { id: 'display', label: '显示' },
                        { id: 'source', label: '源题' }
                    ],
                    questionModal: false,
                    questionLoading: false,
                    questionResults: [],
                    questionSearch: {
                        query: '',
                        grade: '',
                        type: '',
                        diff: ''
                    },
                    revisionModal: false,
                    revisions: [],
                    confirmDialog: null,
                    sourceCheck: null,
                    sourceUpdateBundle: null,
                    sourceUpdateFields: [],
                    acceptedSourceConflicts: [],
                    sourceUpdateSummary: {},
                    newDisplayLabel: '',
                    selectedQuestionIds: [],
                    batchPanelOpen: false,
                    batchDraft: {
                        optionLayoutMode: '',
                        answerPlacement: '',
                        analysisPlacement: '',
                        questionLabelPreset: '',
                        customLabel: '',
                        imageLayoutMode: '',
                        imageColumns: '',
                        imageWidthPercent: '',
                        showKnowledgePoints: '',
                        answerSpaceLines: ''
                    },
                    assetUrls: {},
                    assetRecords: [],
                    pendingQuestionImageIndex: -1,
                    formalSession: null,
                    formalPreviewOpen: false,
                    formalPageNumber: 1,
                    formalPageCount: 0,
                    formalRendering: false,
                    formalError: '',
                    formalDiagnostics: [],
                    formalScopeBlockId: '',
                    formalState: {
                        phase: 'idle',
                        requestId: null,
                        edition: null,
                        diagnostics: [],
                        metrics: null,
                        byteLength: 0,
                        pageCount: 0
                    }
                };
            },
            computed: {
                selectedBlock() {
                    return this.editor
                        ? editorState.getSelectedBlock(this.editor)
                        : null;
                },
                selectedQuestion() {
                    return this.selectedBlock?.type === 'question'
                        ? this.selectedBlock
                        : null;
                },
                questionBlocks() {
                    return this.editor?.handout.blocks.filter(
                        block => block.type === 'question'
                    ) || [];
                },
                selectedQuestionCount() {
                    return this.selectedQuestionIds.length;
                },
                formalScopeLabel() {
                    return this.formalScopeBlockId
                        ? '单题'
                        : '整份讲义';
                },
                effectiveSelectedQuestion() {
                    if (!this.selectedQuestion) return {};
                    return questionInstance.applyQuestionOverrides(
                        this.selectedQuestion.snapshot,
                        this.selectedQuestion.contentOverrides
                    );
                },
                previewDocument() {
                    if (!this.editor) return null;
                    try {
                        return preview.projectHandoutForPreview(
                            this.editor.handout,
                            this.previewEdition
                        );
                    } catch (error) {
                        this.showNotice(
                            `预览数据无效：${error?.message || error}`,
                            'error'
                        );
                        return null;
                    }
                },
                canUndo() {
                    return Boolean(this.editor?.undoStack.length);
                },
                canRedo() {
                    return Boolean(this.editor?.redoStack.length);
                },
                saveStatusLabel() {
                    return {
                        idle: '已从本地打开',
                        dirty: '有未保存修改',
                        saving: '正在保存',
                        saved: '已保存到本地',
                        error: '保存失败'
                    }[this.saveStatus] || this.saveStatus;
                },
                formalBusy() {
                    return [
                        'preparing',
                        'compiling'
                    ].includes(this.formalState.phase);
                },
                formalStatusLabel() {
                    return {
                        idle: '尚未生成',
                        preparing: '正在检查内容与图片',
                        compiling: '正在本地排版',
                        ready: '正式 PDF 已就绪',
                        cancelled: '已取消',
                        failed: '生成失败'
                    }[this.formalState.phase] || this.formalState.phase;
                },
                sourceStatusLabel() {
                    if (!this.sourceCheck) return '';
                    return {
                        unchanged: this.sourceCheck.sourceTimestampChanged
                            ? '源题时间已变化，内容字段未变化'
                            : '源题没有变化',
                        updated: '源题已有更新',
                        missing: '正式题库中已找不到源题'
                    }[this.sourceCheck.status] || '源题状态未知';
                }
            },
            async mounted() {
                root.addEventListener('beforeunload', this.beforeUnload);
                try {
                    await this.reloadHandouts();
                    if (this.handouts.length) {
                        await this.openHandout(this.handouts[0].id, {
                            skipFlush: true
                        });
                    }
                    this.ready = true;
                    root.__TEX_HANDOUT_READY__ = true;
                    root.__TEX_HANDOUT_APP__ = this;
                } catch (error) {
                    this.startupError = String(
                        error?.message || error
                    );
                    root.__TEX_HANDOUT_READY__ = false;
                    root.__TEX_HANDOUT_BOOT_ERROR__ =
                        this.startupError;
                }
            },
            beforeUnmount() {
                root.removeEventListener('beforeunload', this.beforeUnload);
                this.formalSession?.dispose();
                this.releaseAssetUrls();
                clearTimeout(this.saveTimer);
            },
            methods: {
                reloadPage() {
                    location.reload();
                },
                beforeUnload(event) {
                    this.formalSession?.dispose();
                    this.releaseAssetUrls();
                    if (this.editor?.dirty) {
                        event.preventDefault();
                        event.returnValue = '';
                    }
                },
                showNotice(message, kind = 'info') {
                    this.notice = {
                        message: String(message || ''),
                        kind
                    };
                },
                setPreviewEdition(edition) {
                    if (
                        !['student', 'teacher'].includes(edition)
                        || edition === this.previewEdition
                    ) return;
                    this.closeFormalPreview();
                    this.previewEdition = edition;
                },
                ensureFormalSession() {
                    if (this.formalSession) return this.formalSession;
                    this.formalSession =
                        root.Qisi.HandoutPdfSession.createPdfSession({
                            onStateChange: state => {
                                this.formalState = state;
                                this.formalDiagnostics = [
                                    ...(state.diagnostics || [])
                                ];
                                if (state.pageCount) {
                                    this.formalPageCount =
                                        state.pageCount;
                                }
                            }
                        });
                    return this.formalSession;
                },
                async openFormalPreview(blockId = '') {
                    this.formalScopeBlockId =
                        typeof blockId === 'string'
                            ? blockId
                            : '';
                    this.formalPreviewOpen = true;
                    await this.$nextTick();
                    await this.compileFormalPreview();
                },
                async openSingleQuestionFormalPreview() {
                    if (!this.selectedQuestion) return;
                    await this.openFormalPreview(
                        this.selectedQuestion.id
                    );
                },
                async compileFormalPreview() {
                    if (!this.editor || this.formalBusy) return;
                    this.formalError = '';
                    this.formalDiagnostics = [];
                    this.formalPageNumber = 1;
                    this.formalPageCount = 0;
                    try {
                        await this.flushSave();
                        const session = this.ensureFormalSession();
                        const scopedHandout = this.formalScopeBlockId
                            ? model.assertValidHandout({
                                ...this.editor.handout,
                                blocks:
                                    this.editor.handout.blocks.filter(
                                        block =>
                                            block.id
                                            === this.formalScopeBlockId
                                    )
                            })
                            : this.editor.handout;
                        await session.compileHandout(
                            scopedHandout,
                            this.previewEdition,
                            {
                                assetRecords: this.assetRecords
                            }
                        );
                        await this.$nextTick();
                        await this.renderFormalPage();
                    } catch (error) {
                        if (error?.name === 'AbortError') return;
                        this.formalError = String(
                            error?.message || error
                        );
                        this.formalDiagnostics = [
                            ...(error?.diagnostics
                                || this.formalState.diagnostics
                                || [])
                        ];
                    }
                },
                async renderFormalPage() {
                    if (
                        !this.formalSession
                        || this.formalState.phase !== 'ready'
                    ) return;
                    this.formalRendering = true;
                    try {
                        const result =
                            await this.formalSession.renderPreview(
                                this.$refs.formalCanvas,
                                {
                                    pageNumber: this.formalPageNumber
                                }
                            );
                        this.formalPageCount = result.pageCount;
                    } catch (error) {
                        this.formalError = String(
                            error?.message || error
                        );
                    } finally {
                        this.formalRendering = false;
                    }
                },
                async changeFormalPage(offset) {
                    const target = this.formalPageNumber + offset;
                    if (
                        target < 1
                        || target > this.formalPageCount
                        || this.formalRendering
                    ) return;
                    this.formalPageNumber = target;
                    await this.renderFormalPage();
                },
                cancelFormalPreview() {
                    this.closeFormalPreview();
                },
                closeFormalPreview() {
                    if (this.formalBusy) {
                        this.formalSession?.cancel(
                            '正式 PDF 预览已关闭'
                        );
                    }
                    this.formalSession?.closePreview();
                    this.formalPreviewOpen = false;
                    this.formalPageNumber = 1;
                    this.formalPageCount = 0;
                    this.formalRendering = false;
                    this.formalError = '';
                    this.formalDiagnostics = [];
                    this.formalScopeBlockId = '';
                },
                downloadFormalPdf() {
                    if (
                        !this.formalSession
                        || this.formalState.phase !== 'ready'
                    ) return;
                    const edition = this.previewEdition === 'student'
                        ? '学生版'
                        : '教师版';
                    const descriptor = this.formalSession.download(
                        `${this.editor.handout.title}-${this.formalScopeBlockId ? '单题-' : ''}${edition}.pdf`
                    );
                    this.showNotice(
                        `已导出 ${descriptor.filename}`,
                        'success'
                    );
                },
                formatFileSize(bytes) {
                    const value = Number(bytes);
                    if (!Number.isFinite(value) || value < 1) return '';
                    if (value < 1024) return `${value} B`;
                    if (value < 1024 * 1024) {
                        return `${(value / 1024).toFixed(1)} KB`;
                    }
                    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
                },
                async reloadHandouts() {
                    this.handouts = await repository.list();
                },
                async createNewHandout() {
                    await this.flushSave();
                    const created = await repository.create({
                        title: `新讲义 ${this.handouts.length + 1}`
                    });
                    await this.reloadHandouts();
                    this.loadEditor(created);
                    this.showNotice('新讲义已创建并保存在本地。', 'success');
                },
                loadEditor(handout) {
                    this.closeFormalPreview();
                    this.editor = editorState.createEditorState(handout);
                    this.titleDraft = this.editor.handout.title;
                    this.inspectorTab = 'content';
                    this.globalTab = 'page';
                    this.sourceCheck = null;
                    this.sourceUpdateBundle = null;
                    this.sourceUpdateFields = [];
                    this.acceptedSourceConflicts = [];
                    this.sourceUpdateSummary = {};
                    this.selectedQuestionIds = [];
                    this.batchPanelOpen = false;
                    this.saveStatus = 'idle';
                    this.viewMode = 'editor';
                    this.refreshAssetUrls();
                    this.scanSourceUpdates();
                },
                async openHandout(id, { skipFlush = false } = {}) {
                    if (
                        !skipFlush
                        && this.editor?.handout.id === id
                    ) {
                        return;
                    }
                    if (!skipFlush) await this.flushSave();
                    const handout = await repository.get(id);
                    if (!handout) {
                        this.showNotice('讲义不存在或已被删除。', 'error');
                        await this.reloadHandouts();
                        return;
                    }
                    this.loadEditor(handout);
                },
                async duplicateCurrent() {
                    if (!this.editor) return;
                    await this.flushSave();
                    const copy = await repository.duplicate(
                        this.editor.handout.id
                    );
                    await this.reloadHandouts();
                    this.loadEditor(copy);
                    this.showNotice('讲义和其本地图片已完整复制。', 'success');
                },
                requestDeleteHandout() {
                    if (!this.editor) return;
                    this.confirmDialog = {
                        type: 'handout',
                        id: this.editor.handout.id,
                        title: '删除这份讲义？',
                        message: '讲义、历史版本和讲义图片将从本地删除；正式题库不会受到影响。'
                    };
                },
                requestDeleteBlock(blockId) {
                    this.confirmDialog = {
                        type: 'block',
                        id: blockId,
                        title: '删除这个内容块？',
                        message: '删除后可在本次编辑历史中撤销。'
                    };
                },
                async runConfirmedAction() {
                    const action = this.confirmDialog;
                    this.confirmDialog = null;
                    if (!action) return;

                    if (action.type === 'handout') {
                        await repository.remove(action.id);
                        this.releaseAssetUrls();
                        this.editor = null;
                        await this.reloadHandouts();
                        if (this.handouts.length) {
                            await this.openHandout(
                                this.handouts[0].id,
                                { skipFlush: true }
                            );
                        }
                        this.showNotice('讲义已删除，正式题库未修改。', 'success');
                        return;
                    }

                    this.applyEditor(
                        editorState.deleteBlock(
                            this.editor,
                            action.id
                        )
                    );
                },
                commitTitle() {
                    if (!this.editor) return;
                    const title = this.titleDraft.trim();
                    if (!title) {
                        this.titleDraft = this.editor.handout.title;
                        this.showNotice('讲义名称不能为空。', 'error');
                        return;
                    }
                    this.safeMutation(() =>
                        editorState.commitHandout(
                            this.editor,
                            {
                                ...this.editor.handout,
                                title
                            },
                            {
                                mutationKey: 'handout:title'
                            }
                        )
                    );
                },
                safeMutation(callback) {
                    try {
                        this.applyEditor(callback());
                        return true;
                    } catch (error) {
                        this.showNotice(
                            error?.message || error,
                            'error'
                        );
                        return false;
                    }
                },
                applyEditor(next, { autosave = true } = {}) {
                    this.editor = next;
                    this.titleDraft = next.handout.title;
                    this.sourceCheck = null;
                    const questionIds = new Set(
                        next.handout.blocks
                            .filter(
                                block => block.type === 'question'
                            )
                            .map(block => block.id)
                    );
                    this.selectedQuestionIds =
                        this.selectedQuestionIds.filter(
                            blockId => questionIds.has(blockId)
                        );
                    if (autosave && next.dirty) {
                        this.scheduleSave();
                    }
                },
                scheduleSave() {
                    clearTimeout(this.saveTimer);
                    this.saveStatus = 'dirty';
                    this.saveTimer = setTimeout(
                        () => this.flushSave(),
                        500
                    );
                },
                async flushSave() {
                    clearTimeout(this.saveTimer);
                    if (!this.editor?.dirty) return;
                    if (this.saving) {
                        this.saveRequested = true;
                        return;
                    }

                    this.saving = true;
                    try {
                        do {
                            this.saveRequested = false;
                            if (!this.editor?.dirty) break;
                            const submitted = model.cloneValue(
                                this.editor.handout
                            );
                            this.saveStatus = 'saving';
                            const saved = await repository.autosave(
                                submitted,
                                {
                                    expectedUpdatedAt:
                                        submitted.updatedAt
                                }
                            );
                            this.editor = editorState.acknowledgeSave(
                                this.editor,
                                submitted,
                                saved
                            );
                            this.titleDraft =
                                this.editor.handout.title;
                        } while (
                            this.saveRequested
                            || this.editor?.dirty
                        );

                        this.saveStatus = 'saved';
                        await this.reloadHandouts();
                    } catch (error) {
                        this.saveStatus = 'error';
                        this.showNotice(
                            error?.code === 'HANDOUT_CONFLICT'
                                ? '讲义在另一个页面被修改，请重新打开后决定保留哪个版本。'
                                : `保存失败：${error?.message || error}`,
                            'error'
                        );
                    } finally {
                        this.saving = false;
                    }
                },
                performUndo() {
                    if (!this.editor) return;
                    this.applyEditor(editorState.undo(this.editor));
                },
                performRedo() {
                    if (!this.editor) return;
                    this.applyEditor(editorState.redo(this.editor));
                },
                clearSelection() {
                    if (!this.editor) return;
                    this.editor = editorState.selectBlock(
                        this.editor,
                        null
                    );
                },
                selectEditorBlock(id) {
                    this.editor = editorState.selectBlock(
                        this.editor,
                        id
                    );
                    this.sourceCheck =
                        this.sourceUpdateSummary[id] || null;
                    this.sourceUpdateBundle = null;
                    this.sourceUpdateFields = [];
                    this.acceptedSourceConflicts = [];
                    if (this.selectedQuestion) {
                        this.inspectorTab = 'content';
                    }
                },
                addSimpleBlock(type) {
                    const block = editorState.createBlock(
                        type,
                        {
                            id: createId('block')
                        }
                    );
                    this.safeMutation(() =>
                        editorState.insertBlock(this.editor, block)
                    );
                },
                updateSimpleBlock(blockId, patch) {
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            blockId,
                            patch,
                            {
                                mutationKey:
                                    `simple:${blockId}:${Object.keys(patch).join(',')}`
                            }
                        )
                    );
                },
                copySelected(blockId) {
                    this.safeMutation(() =>
                        editorState.copyBlock(
                            this.editor,
                            blockId,
                            {
                                createId
                            }
                        )
                    );
                },
                moveSelected(blockId, offset) {
                    this.safeMutation(() =>
                        editorState.moveBlock(
                            this.editor,
                            blockId,
                            offset
                        )
                    );
                },
                chooseStandaloneImage() {
                    this.$refs.standaloneImageInput?.click();
                },
                validateImageFile(file) {
                    if (!file || !String(file.type).startsWith('image/')) {
                        throw new TypeError('请选择有效的图片文件。');
                    }
                    if (file.size < 1 || file.size > 15 * 1024 * 1024) {
                        throw new RangeError('图片必须大于 0 且不超过 15 MB。');
                    }
                },
                async storeUploadedImage(file, kind) {
                    this.validateImageFile(file);
                    return repository.importAsset(
                        this.editor.handout.id,
                        {
                            blob: file,
                            kind
                        }
                    );
                },
                async addStandaloneImage(event) {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                        const asset = await this.storeUploadedImage(
                            file,
                            'handout-image'
                        );
                        await this.refreshAssetUrls();
                        const block = editorState.createBlock(
                            'image',
                            {
                                id: createId('block'),
                                assetId: asset.id
                            }
                        );
                        this.applyEditor(
                            editorState.insertBlock(
                                this.editor,
                                block
                            )
                        );
                    } catch (error) {
                        this.showNotice(error?.message || error, 'error');
                    }
                },
                async replaceStandaloneImage(event) {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file || !this.selectedBlock) return;
                    try {
                        const asset = await this.storeUploadedImage(
                            file,
                            'handout-image'
                        );
                        await this.refreshAssetUrls();
                        this.updateSimpleBlock(
                            this.selectedBlock.id,
                            {
                                assetId: asset.id,
                                source: 'handout'
                            }
                        );
                    } catch (error) {
                        this.showNotice(error?.message || error, 'error');
                    }
                },
                async openQuestionLibrary() {
                    this.questionModal = true;
                    await this.runQuestionSearch();
                },
                async runQuestionSearch() {
                    this.questionLoading = true;
                    try {
                        this.questionResults =
                            await questionLibrary.search({
                                ...this.questionSearch,
                                limit: 80
                            });
                    } catch (error) {
                        this.showNotice(
                            `题库读取失败：${error?.message || error}`,
                            'error'
                        );
                    } finally {
                        this.questionLoading = false;
                    }
                },
                async insertQuestion(questionId) {
                    try {
                        await this.flushSave();
                        const bundle =
                            await questionLibrary.getQuestionBundle(
                                questionId
                            );
                        if (bundle.missingImageIds.length) {
                            throw new Error(
                                `源题图片缺失：${bundle.missingImageIds.join(', ')}`
                            );
                        }
                        const inserted =
                            await repository.insertQuestionSnapshot(
                                this.editor.handout.id,
                                {
                                    question: bundle.question,
                                    sourceImages: bundle.sourceImages,
                                    expectedUpdatedAt:
                                        this.editor.handout.updatedAt
                                }
                            );
                        this.editor =
                            editorState.acceptPersistedChange(
                                this.editor,
                                inserted.handout,
                                inserted.blockId
                            );
                        this.questionModal = false;
                        this.saveStatus = 'saved';
                        await Promise.all([
                            this.reloadHandouts(),
                            this.refreshAssetUrls()
                        ]);
                        this.showNotice(
                            '题目已按快照插入；讲义修改不会回写题库。',
                            'success'
                        );
                    } catch (error) {
                        this.showNotice(
                            `插入失败：${error?.message || error}`,
                            'error'
                        );
                    }
                },
                effectiveQuestionFor(block) {
                    return questionInstance.applyQuestionOverrides(
                        block.snapshot,
                        block.contentOverrides
                    );
                },
                previewColumnsFor(block) {
                    return preview.resolveOptionColumns(
                        block.optionLayout.mode,
                        this.effectiveQuestionFor(block).options
                    );
                },
                updateQuestionField(field, value) {
                    this.safeMutation(() =>
                        editorState.updateQuestionOverride(
                            this.editor,
                            this.selectedQuestion.id,
                            field,
                            value
                        )
                    );
                },
                restoreQuestionField(field) {
                    this.safeMutation(() =>
                        editorState.restoreQuestionContent(
                            this.editor,
                            this.selectedQuestion.id,
                            field
                        )
                    );
                },
                restoreAllQuestionContent() {
                    this.safeMutation(() =>
                        editorState.restoreQuestionContent(
                            this.editor,
                            this.selectedQuestion.id
                        )
                    );
                },
                updateQuestionOption(index, value) {
                    const options = [
                        ...(this.effectiveSelectedQuestion.options || [])
                    ];
                    options[index] = value;
                    this.updateQuestionField('options', options);
                },
                addQuestionOption() {
                    const options = [
                        ...(this.effectiveSelectedQuestion.options || []),
                        ''
                    ];
                    this.updateQuestionField('options', options);
                },
                removeQuestionOption(index) {
                    const options = [
                        ...(this.effectiveSelectedQuestion.options || [])
                    ];
                    options.splice(index, 1);
                    this.updateQuestionField('options', options);
                },
                updateQuestionSection(section, patch) {
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => ({
                                ...block,
                                [section]: {
                                    ...block[section],
                                    ...patch
                                }
                            }),
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:${section}`
                            }
                        )
                    );
                },
                updateQuestionDisplay(patch) {
                    this.updateQuestionSection('display', patch);
                },
                addQuestionDisplayLabel(type, value) {
                    const text = String(value || '').trim();
                    if (!text) return;
                    if (
                        this.selectedQuestion.displayLabels.some(
                            label =>
                                label.type === type
                                && label.value === text
                        )
                    ) {
                        this.newDisplayLabel = '';
                        return;
                    }
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => ({
                                ...block,
                                displayLabels: [
                                    ...(block.displayLabels || []),
                                    {
                                        type,
                                        value: text
                                    }
                                ]
                            }),
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:display-label`
                            }
                        )
                    );
                    this.newDisplayLabel = '';
                },
                removeQuestionDisplayLabel(index) {
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => ({
                                ...block,
                                displayLabels:
                                    block.displayLabels.filter(
                                        (_, labelIndex) =>
                                            labelIndex !== index
                                    )
                            }),
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:display-label-remove`
                            }
                        )
                    );
                },
                updateQuestionImage(index, patch) {
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => {
                                const images = block.images.map(
                                    (image, imageIndex) => imageIndex === index
                                        ? {
                                            ...image,
                                            ...patch
                                        }
                                        : image
                                );
                                return {
                                    ...block,
                                    images
                                };
                            },
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:image:${index}`
                            }
                        )
                    );
                },
                async replaceQuestionImage(index, event) {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                        const asset = await this.storeUploadedImage(
                            file,
                            'question-image-replacement'
                        );
                        await this.refreshAssetUrls();
                        this.updateQuestionImage(index, {
                            assetId: asset.id,
                            source: 'handout',
                            sourceImageId: ''
                        });
                    } catch (error) {
                        this.showNotice(error?.message || error, 'error');
                    }
                },
                removeQuestionImage(index) {
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => ({
                                ...block,
                                images: block.images.filter(
                                    (_, imageIndex) => imageIndex !== index
                                ).map((image, order) => ({
                                    ...image,
                                    order
                                }))
                            }),
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:remove-image`
                            }
                        )
                    );
                },
                moveQuestionImage(index, offset) {
                    const target = index + offset;
                    if (
                        target < 0
                        || target >= this.selectedQuestion.images.length
                    ) return;
                    this.safeMutation(() =>
                        editorState.updateBlock(
                            this.editor,
                            this.selectedQuestion.id,
                            block => {
                                const images = [...block.images];
                                const [image] = images.splice(index, 1);
                                images.splice(target, 0, image);
                                return {
                                    ...block,
                                    images: images.map((item, order) => ({
                                        ...item,
                                        order
                                    }))
                                };
                            },
                            {
                                mutationKey:
                                    `question:${this.selectedQuestion.id}:move-image`
                            }
                        )
                    );
                },
                restoreSelectedQuestionImages() {
                    this.safeMutation(() =>
                        editorState.restoreQuestionImages(
                            this.editor,
                            this.selectedQuestion.id
                        )
                    );
                    this.refreshAssetUrls();
                },
                async scanSourceUpdates() {
                    if (!this.editor) return;
                    const handoutId = this.editor.handout.id;
                    const entries = await Promise.all(
                        this.questionBlocks.map(async block => {
                            try {
                                return [
                                    block.id,
                                    await questionLibrary
                                        .compareBlockSource(block)
                                ];
                            } catch (error) {
                                return [
                                    block.id,
                                    {
                                        status: 'error',
                                        changedFields: [],
                                        conflictFields: [],
                                        message: String(
                                            error?.message || error
                                        )
                                    }
                                ];
                            }
                        })
                    );
                    if (
                        this.editor?.handout.id !== handoutId
                    ) return;

                    this.sourceUpdateSummary =
                        Object.fromEntries(entries);
                    const updatedCount = entries.filter(
                        ([, comparison]) =>
                            comparison.status === 'updated'
                    ).length;
                    if (updatedCount) {
                        this.showNotice(
                            `${updatedCount} 道题的题库源题已有更新；请逐题查看差异并明确选择要更新的字段。`,
                            'info'
                        );
                    }
                },
                async checkSelectedSource() {
                    if (!this.selectedQuestion) return;
                    try {
                        const comparison =
                            await questionLibrary.compareBlockSource(
                                this.selectedQuestion
                            );
                        this.sourceCheck = comparison;
                        this.sourceUpdateSummary = {
                            ...this.sourceUpdateSummary,
                            [this.selectedQuestion.id]: comparison
                        };
                        this.sourceUpdateFields = (
                            comparison.changedFields || []
                        ).filter(field =>
                            !comparison.conflictFields.includes(field)
                        );
                        this.acceptedSourceConflicts = [];
                        this.sourceUpdateBundle =
                            comparison.status === 'missing'
                                ? null
                                : await questionLibrary.getQuestionBundle(
                                    this.selectedQuestion.sourceQuestionId
                                );
                    } catch (error) {
                        this.showNotice(
                            `源题比较失败：${error?.message || error}`,
                            'error'
                        );
                    }
                },
                setSourceUpdateField(field, checked) {
                    const fields = new Set(this.sourceUpdateFields);
                    if (checked) fields.add(field);
                    else fields.delete(field);
                    this.sourceUpdateFields = [...fields];
                    if (!checked) {
                        this.acceptedSourceConflicts =
                            this.acceptedSourceConflicts.filter(
                                value => value !== field
                            );
                    }
                },
                setSourceConflictAccepted(field, checked) {
                    const accepted = new Set(
                        this.acceptedSourceConflicts
                    );
                    if (checked) accepted.add(field);
                    else accepted.delete(field);
                    this.acceptedSourceConflicts = [...accepted];
                },
                async applySelectedSourceUpdate() {
                    if (
                        !this.selectedQuestion
                        || !this.sourceUpdateBundle
                    ) return;
                    try {
                        await this.flushSave();
                        if (
                            this.sourceUpdateFields.includes('images')
                            && this.sourceUpdateBundle.missingImageIds.length
                        ) {
                            throw new Error(
                                `源题图片缺失：${this.sourceUpdateBundle.missingImageIds.join(', ')}`
                            );
                        }
                        const updated =
                            await repository
                                .updateQuestionSnapshotFields(
                                    this.editor.handout.id,
                                    this.selectedQuestion.id,
                                    {
                                        question:
                                            this.sourceUpdateBundle
                                                .question,
                                        sourceImages:
                                            this.sourceUpdateBundle
                                                .sourceImages,
                                        selectedFields:
                                            this.sourceUpdateFields,
                                        acceptedConflictFields:
                                            this
                                                .acceptedSourceConflicts,
                                        expectedUpdatedAt:
                                            this.editor.handout.updatedAt
                                    }
                                );
                        this.editor =
                            editorState.acceptPersistedChange(
                                this.editor,
                                updated.handout,
                                updated.blockId
                            );
                        this.saveStatus = 'saved';
                        this.sourceCheck = null;
                        this.sourceUpdateBundle = null;
                        this.sourceUpdateFields = [];
                        this.acceptedSourceConflicts = [];
                        await Promise.all([
                            this.reloadHandouts(),
                            this.refreshAssetUrls(),
                            this.scanSourceUpdates()
                        ]);
                        this.showNotice(
                            `已明确更新 ${updated.updatedFields.length} 个源题字段；正式题库未被修改。`,
                            'success'
                        );
                    } catch (error) {
                        this.showNotice(
                            error?.code === 'HANDOUT_SOURCE_CONFLICT'
                                ? `冲突字段必须逐项确认：${error.conflictFields.join('、')}`
                                : `源题更新失败：${error?.message || error}`,
                            'error'
                        );
                    }
                },
                isQuestionBatchSelected(blockId) {
                    return this.selectedQuestionIds.includes(blockId);
                },
                toggleQuestionBatchSelection(blockId, checked) {
                    const ids = new Set(this.selectedQuestionIds);
                    if (checked) ids.add(blockId);
                    else ids.delete(blockId);
                    this.selectedQuestionIds = [...ids];
                },
                selectAllQuestionsForBatch() {
                    this.selectedQuestionIds =
                        this.questionBlocks.map(block => block.id);
                },
                clearBatchSelection() {
                    this.selectedQuestionIds = [];
                    this.batchPanelOpen = false;
                },
                applyBatchSettings() {
                    const draft = this.batchDraft;
                    const patch = {};

                    if (draft.optionLayoutMode) {
                        patch.optionLayout = {
                            mode: draft.optionLayoutMode
                        };
                    }
                    const display = {};
                    if (draft.answerPlacement) {
                        display.answerPlacement =
                            draft.answerPlacement;
                    }
                    if (draft.analysisPlacement) {
                        display.analysisPlacement =
                            draft.analysisPlacement;
                    }
                    if (draft.showKnowledgePoints) {
                        display.showKnowledgePoints =
                            draft.showKnowledgePoints === 'true'
                                ? true
                                : draft.showKnowledgePoints === 'false'
                                    ? false
                                    : 'inherit';
                    }
                    if (draft.answerSpaceLines !== '') {
                        display.answerSpaceLines = Number(
                            draft.answerSpaceLines
                        );
                    }
                    if (Object.keys(display).length) {
                        patch.display = display;
                    }
                    if (draft.questionLabelPreset) {
                        patch.questionLabel = {
                            preset: draft.questionLabelPreset,
                            customText: ''
                        };
                    }
                    const customLabels = String(
                        draft.customLabel || ''
                    ).split(/[,，]/)
                        .map(value => value.trim())
                        .filter(Boolean);
                    if (customLabels.length) {
                        patch.displayLabels = customLabels.map(
                            value => ({
                                type: 'custom',
                                value
                            })
                        );
                    }
                    if (
                        draft.imageLayoutMode
                        || draft.imageColumns !== ''
                    ) {
                        patch.imageLayout = {};
                        if (draft.imageLayoutMode) {
                            patch.imageLayout.mode =
                                draft.imageLayoutMode;
                        }
                        if (draft.imageColumns !== '') {
                            patch.imageLayout.columns = Number(
                                draft.imageColumns
                            );
                        }
                    }
                    if (draft.imageWidthPercent !== '') {
                        patch.images = {
                            width: {
                                value: Number(
                                    draft.imageWidthPercent
                                ),
                                unit: 'percent'
                            }
                        };
                    }
                    if (!this.selectedQuestionIds.length) {
                        this.showNotice(
                            '请先选择至少一道题。',
                            'error'
                        );
                        return;
                    }
                    if (!Object.keys(patch).length) {
                        this.showNotice(
                            '请至少选择一项批量设置。',
                            'error'
                        );
                        return;
                    }

                    const applied = this.safeMutation(() => {
                        const handout =
                            batchSettings
                                .applyBatchQuestionSettings(
                                    this.editor.handout,
                                    this.selectedQuestionIds,
                                    patch
                                );
                        return editorState.commitHandout(
                            this.editor,
                            handout,
                            {
                                mutationKey:
                                    `batch:${Date.now()}`
                            }
                        );
                    });
                    if (!applied) return;
                    this.batchPanelOpen = false;
                    this.showNotice(
                        `已批量更新 ${this.selectedQuestionCount} 道题；可使用撤销恢复。`,
                        'success'
                    );
                },
                updateRegionSlot(regionName, slotName, patch) {
                    const region =
                        this.editor.handout.settings[regionName];
                    const slots = {
                        ...region.slots,
                        [slotName]: {
                            ...region.slots[slotName],
                            ...patch
                        }
                    };
                    const regionPatch = {
                        slots
                    };
                    if (
                        Object.prototype.hasOwnProperty.call(
                            patch,
                            'text'
                        )
                    ) {
                        regionPatch[slotName] = patch.text;
                    }
                    this.updateGlobal(regionName, regionPatch);
                },
                async uploadRegionSlotImage(
                    regionName,
                    slotName,
                    event
                ) {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                        const asset = await this.storeUploadedImage(
                            file,
                            `${regionName}-slot-image`
                        );
                        await this.refreshAssetUrls();
                        this.updateRegionSlot(
                            regionName,
                            slotName,
                            {
                                enabled: true,
                                assetId: asset.id
                            }
                        );
                    } catch (error) {
                        this.showNotice(
                            error?.message || error,
                            'error'
                        );
                    }
                },
                removeRegionSlotImage(regionName, slotName) {
                    this.updateRegionSlot(
                        regionName,
                        slotName,
                        { assetId: '' }
                    );
                },
                updateRegionBackground(regionName, patch) {
                    const region =
                        this.editor.handout.settings[regionName];
                    this.updateGlobal(
                        regionName,
                        {
                            background: {
                                ...region.background,
                                ...patch
                            }
                        }
                    );
                },
                updateGlobal(section, patch) {
                    this.safeMutation(() =>
                        editorState.updateSettings(
                            this.editor,
                            section,
                            patch
                        )
                    );
                },
                async loadRevisions() {
                    await this.flushSave();
                    this.revisions = await repository.listRevisions(
                        this.editor.handout.id
                    );
                    this.revisionModal = true;
                },
                async restoreRevision(revisionId) {
                    try {
                        const restored =
                            await repository.restoreRevision(
                                this.editor.handout.id,
                                revisionId,
                                {
                                    expectedUpdatedAt:
                                        this.editor.handout.updatedAt
                                }
                            );
                        this.loadEditor(restored);
                        this.revisionModal = false;
                        await this.reloadHandouts();
                        this.showNotice('历史版本已恢复并保存。', 'success');
                    } catch (error) {
                        this.showNotice(
                            `恢复失败：${error?.message || error}`,
                            'error'
                        );
                    }
                },
                releaseAssetUrls() {
                    for (const url of Object.values(this.assetUrls)) {
                        URL.revokeObjectURL(url);
                    }
                    this.assetUrls = {};
                    this.assetRecords = [];
                },
                async refreshAssetUrls() {
                    this.releaseAssetUrls();
                    if (!this.editor) return;
                    const records = await repository.listAssets(
                        this.editor.handout.id
                    );
                    const urls = {};
                    for (const record of records) {
                        if (
                            record.blob instanceof Blob
                            && record.blob.size
                        ) {
                            urls[record.id] =
                                URL.createObjectURL(record.blob);
                        }
                    }
                    this.assetRecords = records;
                    this.assetUrls = urls;
                },
                assetUrl(assetId) {
                    return this.assetUrls[assetId] || '';
                },
                imageStyle(image) {
                    const width = image?.width || {
                        value: 45,
                        unit: 'mm'
                    };
                    return {
                        width: width.unit === 'percent'
                            ? `${width.value}%`
                            : `${width.value}mm`,
                        maxWidth: '100%'
                    };
                },
                questionImageGroupStyle(question) {
                    const layout = question.imageLayout || {};
                    if (
                        !['row', 'grid'].includes(layout.mode)
                    ) return {};
                    const columns = layout.mode === 'row'
                        ? Math.min(
                            4,
                            Math.max(1, question.images.length)
                        )
                        : Number(layout.columns || 2);
                    return {
                        display: 'grid',
                        gridTemplateColumns:
                            `repeat(${columns}, minmax(0, 1fr))`,
                        gap: `${Number(layout.gapMm || 0)}mm`
                    };
                },
                regionPreviewStyle(region) {
                    if (!region?.background?.enabled) return {};
                    const opacity = Math.round(
                        Number(region.background.opacity || 0)
                        * 255
                    ).toString(16).padStart(2, '0');
                    return {
                        backgroundColor:
                            `${region.background.color}${opacity}`,
                        minHeight:
                            `${region.background.heightMm}mm`
                    };
                },
                blockLabel(block) {
                    if (block.type === 'heading') {
                        return block.text || '标题';
                    }
                    if (block.type === 'body') return '正文';
                    if (block.type === 'callout') {
                        return block.title || '提示框';
                    }
                    if (block.type === 'image') return '图片';
                    if (block.type === 'page-break') return '分页';
                    if (block.type === 'question') {
                        const number =
                            block.snapshot.questionNumber || '';
                        return number
                            ? `题目 ${number}`
                            : '题目';
                    }
                    return block.type;
                },
                optionLetter(index) {
                    return String.fromCharCode(65 + index);
                },
                splitTags(value) {
                    return [...new Set(
                        String(value || '')
                            .split(/[,，]/)
                            .map(item => item.trim())
                            .filter(Boolean)
                    )];
                },
                questionNumberFor(block) {
                    const explicit = block.question.questionNumber;
                    if (explicit) return explicit;
                    const questions = this.previewDocument.blocks.filter(
                        item => item.type === 'question'
                    );
                    return questions.findIndex(
                        item => item.id === block.id
                    ) + 1;
                },
                questionLabelText(question) {
                    if (question.questionLabel.preset === 'custom') {
                        return question.questionLabel.customText;
                    }
                    return {
                        example: '例题',
                        exercise: '练习',
                        thinking: '思考'
                    }[question.questionLabel.preset] || '';
                },
                questionDisplayLabels(question) {
                    const presets = {
                        authentic: '真题',
                        theorem: '定理',
                        example: '例题',
                        variant: '变式',
                        practice: '课堂练习',
                        homework: '课后作业',
                        error: '易错题'
                    };
                    const labels = (
                        question.displayLabels || []
                    ).map(label =>
                        label.type === 'preset'
                            ? presets[label.value] || label.value
                            : label.value
                    ).filter(Boolean);
                    if (labels.length) return labels;
                    const legacy = this.questionLabelText(question);
                    return legacy ? [legacy] : [];
                },
                resolvePlaceholder(value) {
                    if (!this.previewDocument) return '';
                    const metadata =
                        this.previewDocument.settings.metadata;
                    return String(value || '')
                        .replaceAll('{title}', this.previewDocument.title)
                        .replaceAll('{filename}', this.previewDocument.title)
                        .replaceAll('{teacher}', metadata.teacher || '')
                        .replaceAll('{school}', metadata.school || '')
                        .replaceAll('{page}', '1')
                        .replaceAll('{pages}', '—');
                },
                formatTime(value) {
                    const date = new Date(value);
                    return Number.isFinite(date.getTime())
                        ? new Intl.DateTimeFormat('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        }).format(date)
                        : '未知时间';
                }
            }
        };
    };

    const boot = async () => {
        try {
            assertDependencies();
            const database = root.Qisi.Database.getDatabase();
            await database.open();
            const repository =
                root.Qisi.HandoutRepository.createHandoutRepository({
                    db: database
                });
            const questionLibrary =
                root.Qisi.HandoutQuestionLibrary
                    .createHandoutQuestionLibrary({
                        db: database
                    });
            const app = root.Vue.createApp(
                createAppOptions({
                    repository,
                    questionLibrary,
                    modules: {
                        model: root.Qisi.HandoutModel,
                        questionInstance:
                            root.Qisi.HandoutQuestionInstance,
                        editorState:
                            root.Qisi.HandoutEditorState,
                        batchSettings:
                            root.Qisi.HandoutBatchSettings,
                        preview: root.Qisi.HandoutPreview
                    }
                })
            );

            app.config.errorHandler = error => {
                root.__TEX_HANDOUT_RUNTIME_ERRORS__ =
                    root.__TEX_HANDOUT_RUNTIME_ERRORS__ || [];
                root.__TEX_HANDOUT_RUNTIME_ERRORS__.push(
                    String(error?.stack || error)
                );
                console.error('[TEX_HANDOUT][runtime]', error);
            };
            app.mount('#handout-app');
        } catch (error) {
            console.error('[TEX_HANDOUT][boot]', error);
            renderFatalBootError(error);
        }
    };

    boot();
})(globalThis);
