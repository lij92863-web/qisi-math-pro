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
                async openFormalPreview() {
                    this.formalPreviewOpen = true;
                    await this.$nextTick();
                    await this.compileFormalPreview();
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
                        await session.compileHandout(
                            this.editor.handout,
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
                        `${this.editor.handout.title}-${edition}.pdf`
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
                    this.saveStatus = 'idle';
                    this.viewMode = 'editor';
                    this.refreshAssetUrls();
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
                    } catch (error) {
                        this.showNotice(
                            error?.message || error,
                            'error'
                        );
                    }
                },
                applyEditor(next, { autosave = true } = {}) {
                    this.editor = next;
                    this.titleDraft = next.handout.title;
                    this.sourceCheck = null;
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
                    this.sourceCheck = null;
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
                async checkSelectedSource() {
                    try {
                        this.sourceCheck =
                            await questionLibrary.compareBlockSource(
                                this.selectedQuestion
                            );
                    } catch (error) {
                        this.showNotice(
                            `源题比较失败：${error?.message || error}`,
                            'error'
                        );
                    }
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
                resolvePlaceholder(value) {
                    if (!this.previewDocument) return '';
                    const metadata =
                        this.previewDocument.settings.metadata;
                    return String(value || '')
                        .replaceAll('{title}', this.previewDocument.title)
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
