(function (root, factory) {
    const start = () => root.Qisi.Runtime.boot(() => factory(root), {
        requiredModules: ['Backup', 'Config', 'Components']
    });
    root.Qisi = root.Qisi || {};
    root.Qisi.App = { start };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.Qisi.App;
    else if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const { createApp, ref, reactive, watch, onMounted, nextTick, computed, toRaw } = root.Vue;
    const { PRESET_TEMPLATES, DEFAULT_PRESET_KEY, DEFAULT_TEMPLATE, EXAM_LAYOUT_PRESETS, QUESTION_TYPE_LABELS, DEFAULT_GROUP_CONFIG, EXAM_TYPE_ORDER, CHINESE_SECTION_NUMBERS } = root.Qisi.Config;
    const { Icon, LatexPreview, KnowledgeTree, QuestionCard, renderQuestionOptionsHtml, renderLatexPreviewHtml } = root.Qisi.Components;
﻿        const App = {
            components: { Icon, LatexPreview, KnowledgeTree, QuestionCard },
            setup() {
                console.log('当前运行版本：batch-refactor-01-DOCX批量录题模块拆分');
                const storageRepository = Qisi.StorageRepository.createRepository(db, {
                    duplicatePolicy: Qisi.QuestionDuplicatePolicy,
                    personalKnowledgeModel: Qisi.PersonalKnowledgeModel,
                    getQuestionKnowledge,
                    admission: {
                        evaluateDraftAdmission: Qisi.FormalAdmissionPolicy.evaluateDraftAdmission,
                        validateAdmissionDecision: Qisi.FormalAdmissionPolicy.validateAdmissionDecision,
                        buildQuestionV2: Qisi.FormalAdmissionPolicy.buildQuestionV2,
                        validateQuestionV2: Qisi.RecognitionContracts.validateQuestionV2
                    }
                });
                const batchFormalSubmit = Qisi.BatchFormalSubmit.createBatchFormalSubmit({
                    policy: Qisi.FormalAdmissionPolicy,
                    repository: storageRepository,
                    createStateMachine: options =>
                        Qisi.ImportStateMachine.createImportStateMachine(options)
                });
                const libraryService = Qisi.LibraryService.createLibraryService({
                    repository: storageRepository,
                    matchesFilters:
                        Qisi.Utils.questionMatchesLibraryFilters,
                    getKnowledge: getQuestionKnowledge,
                    findKnowledgeNode: Qisi.Utils.findNode,
                    compareNodeId: (tree, id) => Qisi.PersonalKnowledgeModel.locateNode(tree, id)?.node,
                    cacheSearchText: true,
                    fingerprint: questionCoreFingerprint
                });
                const productionReviewValidator =
                    Qisi.ProductionReviewValidator.createProductionReviewValidator({
                        policy: Qisi.FormalAdmissionPolicy
                    });
                const importValidationPorts =
                    Qisi.ImportValidationService.createProductionValidationPorts({
                        reviewValidator: productionReviewValidator
                    });
                const draftPersistenceService = Object.freeze({
                    createDraftBatch: command =>
                        Qisi.DraftPersistenceService.createDraftBatch(
                            command, storageRepository
                        ),
                    persistDraftBatch: command =>
                        Qisi.DraftPersistenceService.persistDraftBatch(
                            command, storageRepository
                        ),
                    persistReviewDraftBatch: command =>
                        Qisi.DraftPersistenceService.persistReviewDraftBatch(
                            command, storageRepository
                        ),
                    persistReviewDraftCommand: command =>
                        Qisi.DraftPersistenceService.persistReviewDraftCommand(
                            command, storageRepository
                        ),
                    persistReviewImageCommand: command =>
                        Qisi.DraftPersistenceService.persistReviewImageCommand(
                            command, storageRepository
                        ),
                    reloadDraftBatch: batchId =>
                        Qisi.DraftPersistenceService.reloadDraftBatch(
                            batchId, storageRepository
                        ),
                    reloadDraftReview: (batchId, draftId) =>
                        Qisi.DraftPersistenceService.reloadDraftReview(
                            batchId, draftId, storageRepository
                        ),
                    refreshDraftBatchStats: command =>
                        Qisi.DraftPersistenceService.refreshDraftBatchStats(
                            command, storageRepository
                        ),
                    deleteDraftBatch: (batchId, options) =>
                        Qisi.DraftPersistenceService.deleteDraftBatch(
                            batchId, storageRepository, options
                        )
                });
                const reviewController = Qisi.ReviewController.createReviewController({
                    validateDraft: (draft, options) => validateDraftForReview(draft, options),
                    formalFields: Qisi.FormalAdmissionPolicy.FORMAL_FIELDS
                });
                const exportService = Qisi.ExportService.createExportService({
                    coreFingerprint: questionCoreFingerprint,
                    stemFingerprint: questionStemFingerprint,
                    resolveImages: ids =>
                        storageRepository.loadImageRecords(ids)
                });
                const view = ref('entry'); 
                const databaseStatus = ref('opening');
                const onDatabaseBlocked = () => { databaseStatus.value = 'blocked'; };
                const onDatabaseVersionChange = () => { databaseStatus.value = 'outdated'; db.close(); };
                db.on('blocked', onDatabaseBlocked);
                db.on('versionchange', onDatabaseVersionChange);
                Vue.onUnmounted(() => {
                    db.on('blocked').unsubscribe(onDatabaseBlocked);
                    db.on('versionchange').unsubscribe(onDatabaseVersionChange);
                });
                const libraryRevision = ref(0);
                const cartQuestionRevision = ref(0);
                const liveQuestions = Qisi.LibraryService.createLiveQuestionIndex({
                    compareKeys: Dexie.cmp,
                    fingerprint: { core: questionCoreFingerprint, stem: questionStemFingerprint },
                    normalize: record => Qisi.LibraryImageResources.prepareStoredRows([record], applyOptionSplit)[0],
                    classify: row => ({
                        systemKnowledge: getQuestionKnowledge(row, 'system'),
                        personalKnowledge: getQuestionKnowledge(row, 'personal'),
                        personalKnowledgeIds: row.personalKnowledgeIds ?? row.meta?.personalKnowledgeIds
                    }),
                    onChange: (ids, classifications) => {
                        libraryRevision.value++;
                        if (ids) for (const [row, weight] of classifications) {
                            systemCounter.adjust(row, weight);
                            personalCounter.adjust(row, weight);
                        }
                        else { rebuildKnowledgeCounter('system'); rebuildKnowledgeCounter('personal'); }
                        if (!ids || (cart.value.length && ids.some(id => cart.value.includes(id)))) cartQuestionRevision.value++;
                    }
                });
                const questions = computed(() => { libraryRevision.value; return liveQuestions.ordered.slice(); });
                const storedImages = Qisi.LibraryImageResources.configureStoredImages({
                    storage: storageRepository, createObjectUrl: blob => URL.createObjectURL(blob),
                    revokeObjectUrl: url => URL.revokeObjectURL(url)
                });
                const examState = Qisi.ExamGroups.createState({ ref, reactive, preferences: safeStorage });
                const cart = examState.cart;
                const currentPage = ref(1);
                const pageSize = 10;
                const externalQuestions = ref([]);
                const importBatches = ref([]);
                const externalState = Qisi.LibraryExternalMerge.createExternalState({ ref });
                const { activeExternalBatchId, externalPickMode, selectedExternalIds, confirmItems, batchPersonalKnowledge, batchSystemKnowledge, pendingImportPreview } = externalState;
                
                
                
                const confirmStatusFilter = ref('all');
                
                
                const importBankInput = ref(null);
                
                const externalOnlyUnprocessed = ref(false);
                const librarySearchInput = ref('');
                const librarySearchKeyword = ref('');
                const libraryFilters = reactive({ type: '', diff: '', grade: '', answerState: '', imageState: '' });
                const examTitle = examState.title;
                const exportMode = examState.mode;
                const templateState = Qisi.ExamTemplateModel.createState({ ref, reactive, preferences: safeStorage,
                    defaultKey: DEFAULT_PRESET_KEY, layoutPresets: EXAM_LAYOUT_PRESETS, defaultTemplate: DEFAULT_TEMPLATE });
                const selectedExamTemplate = templateState.selected;
                const examConfig = templateState.config;
                const examQuestionMeta = examState.questionMeta;
                const examGroupConfig = examState.groupConfig;
                const draggingExamQuestionId = examState.dragging;
                const dragOverExamQuestionId = examState.dragOver;
                
                const ocrLoading = ref(false);
                const printState = Qisi.PrintResources.createState({ ref });
                const printBusy = printState.busy;
                const isDraggingImg = ref(false);
                const isDraggingOcr = ref(false);
                const isCartOpen = ref(false);
                const reviewSession = window.Qisi.ReviewSessionCommands.createReviewSession({
                    ref, fields: window.Qisi.ReviewDraftState,
                    storage: storageRepository, persistence: draftPersistenceService
                });
                const {
                    activeBatchId, activeDraftQuestionId, activeDraftTab, selectedDraftIds, batchImportMode,
                    batchImportFilter, batchImportBatches, batchImportFiles, batchDraftQuestions, batchDraftImages,
                    unmatchedAnswers, activeDraftEditorBuffer, activeDraftEditorOriginal, activeDraftEditorOriginalFields, activeDraftEditorQuestionId
                } = reviewSession.refs;
                const batchUploadInput = ref(null);
                const isDraggingBatchFiles = ref(false);
                const batchToast = ref('');
                const unassignedImageModal = ref(false);
                const imagePositionMenuId = ref('');
                const activeDraftEditorTextarea = ref(null);
                const cropModalOpen = ref(false);
                const cropImageRef = ref(null);
                const cropState = reactive({
                    sourceImage: null,
                    dragging: false,
                    startX: 0,
                    startY: 0,
                    x: 0,
                    y: 0,
                    w: 0,
                    h: 0
                });
                const cropSelectionStyle = computed(() => {
                    const x = Math.min(cropState.x, cropState.x + cropState.w);
                    const y = Math.min(cropState.y, cropState.y + cropState.h);
                    const w = Math.abs(cropState.w);
                    const h = Math.abs(cropState.h);

                    return {
                        left: `${x}px`,
                        top: `${y}px`,
                        width: `${w}px`,
                        height: `${h}px`
                    };
                });
                const pendingPurposeFile = ref(null);
                const pendingPurposeQueue = ref([]);
                const pendingPurposeRoles = ref([]);
                const batchCreateFiles = ref([]);
                const batchCreateTypeHint = ref('mixed');
                const batchCreateWarning = ref('');
                const batchFileQueueBusy = ref(false);
                const batchExpectedQuestionCount = ref(0);
                const submitSummary = ref(null);
                const batchSubmitBusy = ref(false);
                const batchDefaultMeta = reactive({
                    subject: '数学',
                    defaultType: '',
                    grade: '',
                    diff: '',
                    year: '',
                    source: '',
                    province: '',
                    tags: '',
                    systemKnowledge: '',
                    personalKnowledge: ''
                });
                
                const manualState = Qisi.ManualEntryModel.createEntryState({ reactive, ref });
                const entryForm = manualState.form;
                const entryTab = manualState.tab;
                const showEntryKnowledge = ref(false);
                const showEntryPersonalKnowledge = ref(false);
                const hoverL1 = ref(null);
                const hoverPersonalL1 = ref(null);
                
                const ocrDraftStore = reactive({ rawText: '' });

                const customTemplates = templateState.templates;
                const templateOverrides = templateState.overrides;
                const latexTemplate = templateState.code;
                const editMode = templateState.mode; 
                const currentPresetKey = templateState.current;
                const editTplName = templateState.name;
                
                const knowledgeTree = reactive(MATH_KNOWLEDGE_TREE);
                const personalState = Qisi.PersonalKnowledgeModel.createState({ ref });
                const personalKnowledgeTree = personalState.tree;
                const personalL1Name = personalState.name1;
                const personalL2Name = personalState.name2;
                const personalL3Name = personalState.name3;
                const selectedPersonalL1Id = personalState.selected1;
                const selectedPersonalL2Id = personalState.selected2;
                const cartPanelAvailable = computed(() => view.value === 'library' || view.value === 'exam');
                const entryParsedQuestion = computed(() => splitQuestionForStorage(entryForm.stem, entryForm.type, entryForm.options));
                const entryPreviewStem = computed(() => entryParsedQuestion.value.stem || entryForm.stem);
                const entryPreviewOptions = computed(() => entryParsedQuestion.value.options || []);
                
                const activeKnowledge = ref(null);
                const activeKnowledgeType = ref('system');
                const libraryKnowledgeMode = ref('system');

                const syncEntryLegacyKnowledge = () => manualWorkspace.syncKnowledge();

                const resetLibraryFilters = () => {
                    librarySearchInput.value = '';
                    librarySearchKeyword.value = '';
                    Object.assign(libraryFilters, { type: '', diff: '', grade: '', answerState: '', imageState: '' });
                    currentPage.value = 1;
                };
                
                const knowledgeCounts = reactive(Object.create(null));
                const personalKnowledgeCounts = reactive(Object.create(null));
                let systemCounter, personalCounter;
                const rebuildKnowledgeCounter = type => {
                    const personal = type === 'personal';
                    const counts = personal ? personalKnowledgeCounts : knowledgeCounts;
                    for (const key of Object.keys(counts)) delete counts[key];
                    const counter = window.Qisi.UiEvents.createKnowledgeCounter(personal ? personalKnowledgeTree.value : knowledgeTree,
                        type, getQuestionKnowledge, { byId: personal, counts });
                    for (const row of liveQuestions.totals.values()) counter.adjust(row, row.count);
                    if (personal) personalCounter = counter;
                    else systemCounter = counter;
                };
                watch(personalKnowledgeTree, () => rebuildKnowledgeCounter('personal'), { flush: 'sync' });
                const activeKnowledgeTree = computed(() => libraryKnowledgeMode.value === 'personal' ? personalKnowledgeTree.value : (libraryKnowledgeMode.value === 'external' ? [] : knowledgeTree));
                const activeKnowledgeCounts = computed(() => libraryKnowledgeMode.value === 'personal' ? personalKnowledgeCounts : (libraryKnowledgeMode.value === 'external' ? {} : knowledgeCounts));

                const libraryCriteria = computed(() => {
                    const sourceTree =
                        activeKnowledgeType.value === 'personal'
                            ? personalKnowledgeTree.value
                            : knowledgeTree;
                    return {
                        keyword: librarySearchKeyword.value,
                        filters: { ...libraryFilters },
                        knowledge: activeKnowledgeType.value === 'personal' ? '' : activeKnowledge.value,
                        knowledgeId: activeKnowledgeType.value === 'personal' ? activeKnowledge.value : '',
                        knowledgeType: activeKnowledgeType.value,
                        knowledgeTree: sourceTree, personalKnowledgeTree: personalKnowledgeTree.value,
                        sortBy: 'createdAt',
                        direction: 'desc'
                    };
                });
                const libraryPage = computed(() => {
                    libraryRevision.value;
                    const result = liveQuestions.select(libraryCriteria.value, libraryService.makePredicate);
                    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
                    const start = (Math.min(totalPages, currentPage.value) - 1) * pageSize;
                    return { total: result.length, totalPages, items: result.slice(start, start + pageSize) };
                });
                const filteredQuestions = computed(() => {
                    libraryRevision.value;
                    return liveQuestions.select(libraryCriteria.value, libraryService.makePredicate).slice();
                });

                const flattenKnowledgeTree = Qisi.PersonalKnowledgeModel.flattenPaths;

                const flatSystemKnowledge = computed(() => flattenKnowledgeTree(knowledgeTree));
                const flatPersonalKnowledge = computed(() => flattenKnowledgeTree(personalKnowledgeTree.value));
                const flatKnowledge = computed(() => flatSystemKnowledge.value);

                const batchStatusText = (status) => ({
                    draft: '已创建',
                    pending: '等待识别',
                    processing: '识别中',
                    review: '待审核',
                    completed: '已完成',
                    failed: '识别失败'
                }[status] || '待处理');

                const draftQuestionStatusText = (status) => ({
                    pending: '待确认',
                    reviewed: '已确认',
                    submitted: '已入库',
                    skipped: '已跳过'
                }[status] || '待确认');

                const roleLabel = (role) => ({
                    question: '题目',
                    answer: '答案',
                    solution: '解析',
                    full: '题目 + 答案 + 解析',
                    supplemental_image: '补充图片'
                }[role] || '未设置');

                const rolesLabel = (file) => {
                    const roles = Array.isArray(file?.roles) && file.roles.length ? file.roles : [file?.role].filter(Boolean);
                    if (roles.includes('full')) return roleLabel('full');
                    if (roles.includes('supplemental_image')) return roleLabel('supplemental_image');
                    return roles.map(roleLabel).join(' + ') || '未设置';
                };

                const fileTypeText = (window.Qisi && window.Qisi.FileDispatcher)
                    ? window.Qisi.FileDispatcher.fileTypeText
                    : (type) => ({ pdf: 'PDF', docx: 'Word', image: '图片', text: '文本', excel: 'Excel', unknown: '未知' }[type] || '未知');

                const getFileType = (window.Qisi && window.Qisi.FileDispatcher)
                    ? window.Qisi.FileDispatcher.getFileType
                    : (fileName = '') => {
                        const ext = String(fileName).split('.').pop()?.toLowerCase() || '';
                        if (ext === 'pdf') return 'pdf';
                        if (ext === 'docx' || ext === 'doc') return 'docx';
                        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
                        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel';
                        if (ext === 'txt') return 'text';
                        return 'unknown';
                    };

                const formatFileSize = (window.Qisi && window.Qisi.FileDispatcher)
                    ? window.Qisi.FileDispatcher.formatFileSize
                    : (size = 0) => {
                        if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
                        return `${Math.max(1, Math.round(size / 1024))} KB`;
                    };

                const makeBatchId = (window.Qisi && window.Qisi.FileDispatcher)
                    ? window.Qisi.FileDispatcher.makeBatchId
                    : (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

                let batchToastTimer = null; const showBatchToast = (message) => {
                    clearTimeout(batchToastTimer); batchToast.value = message;
                    batchToastTimer = setTimeout(() => {
                        if (batchToast.value === message) batchToast.value = '';
                    }, 1800);
                };

                const getBatchFileRoles = window.Qisi.FileDispatcher.getBatchFileRoles;
                const batchHasRole = window.Qisi.FileDispatcher.batchHasRole;
                const batchHasQuestionRole = window.Qisi.FileDispatcher.batchHasQuestionRole;
                const batchHasAnswerRole = window.Qisi.FileDispatcher.batchHasAnswerRole;
                const batchHasSolutionRole = window.Qisi.FileDispatcher.batchHasSolutionRole;
                const batchIsFullRole = window.Qisi.FileDispatcher.batchIsFullRole;
                const batchIsSupplementalImage = window.Qisi.FileDispatcher.batchIsSupplementalImage;

                const openBatchCreate = (type = 'mixed') => {
                    if (!reviewSession.leaveBatch(confirm)) return;
                    batchImportMode.value = 'create';
                    batchCreateTypeHint.value = type;
                    batchCreateWarning.value = '';
                    activeBatchId.value = '';
                    activeDraftQuestionId.value = '';
                    if (!batchCreateFiles.value.length && type === 'text') {
                        batchCreateFiles.value.push({
                            id: makeBatchId('file'),
                            batchId: '',
                            filename: '粘贴文本.txt',
                            fileType: 'text',
                            fileSize: 0,
                            role: 'full',
                            roles: ['full'],
                            pageRange: '',
                            uploadPath: 'data:text/plain;charset=utf-8,',
                            parseStatus: 'pending',
                            parseResultId: '',
                            errorMessage: '',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            textDraft: ''
                        });
                    }
                };

                const openBatchList = async () => {
                    if (!reviewSession.leaveBatch(confirm)) return;
                    batchImportMode.value = 'list';
                    await loadBatchImportData();
                };

                const clearBatchDraftWorkspace = async () => {
                    const ok = confirm(
                        '确定清空全部批量录题草稿并重新开始吗？\n\n' +
                        '只会删除批量录题草稿、任务记录、上传文件记录和草稿图片；不会删除正式题库、正式图片、模板或知识点。'
                    );
                    if (!ok) return;

                    try {
                        const batches = await storageRepository.listRecentTasks();
                        await draftMaintenanceService.deleteDraftBatches({
                            batchIds: batches.map(batch => batch.id)
                        });

                        activeBatchId.value = '';
                        activeDraftQuestionId.value = '';
                        batchDraftQuestions.value = [];
                        batchDraftImages.value = [];
                        batchImportFiles.value = [];
                        unmatchedAnswers.value = [];
                        submitSummary.value = null;
                        batchImportMode.value = 'list';
                        await loadBatchImportData();
                        showBatchToast('批量录题草稿已清空，可以重新开始。');
                    } catch (error) {
                        console.error('[BATCH_DEBUG][clear-draft-workspace-failed]', error);
                        alert(`清空批量录题草稿失败：${error?.message || error}`);
                    }
                };

                const openBatchFilePicker = () => batchUploadInput.value?.click();

                const openNextPendingPurposeFile = () => {
                    pendingPurposeFile.value = pendingPurposeQueue.value.shift() || null;

                    if (!pendingPurposeFile.value) {
                        pendingPurposeRoles.value = [];
                        return;
                    }

                    const filename = String(pendingPurposeFile.value.filename || '').toLowerCase();

                    if (pendingPurposeFile.value.fileType === 'image') {
                        if (/^(page-\d+|test|试卷|题目|卷面)/i.test(filename)) {
                            pendingPurposeRoles.value = ['question'];
                        } else {
                            pendingPurposeRoles.value = [];
                        }
                        return;
                    }

                    if (pendingPurposeFile.value.fileType === 'text') {
                        pendingPurposeRoles.value = ['full'];
                        return;
                    }

                    pendingPurposeRoles.value = [];
                };

                const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
                    reader.readAsDataURL(file);
                });

                const queueBatchFiles = async (fileList, { fromClipboard = false } = {}) => {
                    const files = Array.from(fileList || []);
                    if (!files.length || batchFileQueueBusy.value) return;
                    batchCreateWarning.value = '';

                    const pendingCount = pendingPurposeQueue.value.length + Number(Boolean(pendingPurposeFile.value));
                    if (batchCreateFiles.value.length + pendingCount + files.length > 10) {
                        batchCreateWarning.value = '单次任务最多添加 10 个文件，请拆成多个任务处理。';
                        return;
                    }

                    batchFileQueueBusy.value = true;
                    try {
                        const queued = [];
                        const maxFileBytes = 50 * 1024 * 1024;
                        for (const source of files) {
                            if (/\.doc$/i.test(source.name)) {
                                batchCreateWarning.value = `${source.name} 是旧版 .doc 文件，当前不支持直接解析。请先用 Word/WPS 另存为 .docx 后再上传。`;
                                continue;
                            }
                            const type = getFileType(source.name);
                            const pastedImage = fromClipboard && Qisi.ClipboardFiles.imageMime(source);
                            if (type !== 'docx' && type !== 'pdf' && !pastedImage) {
                                batchCreateWarning.value = `${source.name} 暂不支持。可上传 DOCX、PDF，或粘贴 PNG、JPG、WEBP 图片。`;
                                continue;
                            }
                            if (source.size > maxFileBytes) {
                                batchCreateWarning.value = `${source.name} 超过 50MB，请压缩或拆分后再添加。`;
                                continue;
                            }
                            try {
                                const file = pastedImage ? await Qisi.ClipboardFiles.imageToPdf(source) : source;
                                if (file.size > maxFileBytes) {
                                    batchCreateWarning.value = `${source.name} 转为 PDF 后超过 50MB，请裁剪或缩小图片。`;
                                    continue;
                                }
                                queued.push({
                                    file, id: makeBatchId('file'), filename: file.name,
                                    fileType: pastedImage ? 'pdf' : type,
                                    fileSize: file.size, uploadPath: await readFileAsDataUrl(file)
                                });
                            } catch {
                                batchCreateWarning.value = pastedImage
                                    ? `无法转换图片「${source.name}」，请确认图片能正常打开，或缩小后重试。`
                                    : `无法读取文件「${source.name}」，请重新添加。`;
                            }
                        }
                        if (view.value !== 'batchImport' || batchImportMode.value !== 'create') return;
                        pendingPurposeQueue.value.push(...queued);
                        if (!pendingPurposeFile.value) openNextPendingPurposeFile();
                    } finally {
                        batchFileQueueBusy.value = false;
                    }
                };

                const handleBatchFileChange = async (event) => {
                    await queueBatchFiles(event.target.files);
                    event.target.value = null;
                };

                const handleBatchDrop = async (event) => {
                    isDraggingBatchFiles.value = false;
                    await queueBatchFiles(event.dataTransfer.files);
                };

                const handleBatchHomeDrop = async (event) => {
                    isDraggingBatchFiles.value = false;
                    batchImportMode.value = 'create';
                    await queueBatchFiles(event.dataTransfer.files);
                };
                const handleBatchPastedFiles = async (files) => {
                    if (pendingPurposeFile.value || batchFileQueueBusy.value) return;
                    if (batchImportMode.value === 'list') openBatchCreate();
                    if (batchImportMode.value === 'create') await queueBatchFiles(files, { fromClipboard: true });
                };

                const togglePurposeRole = (role) => {
                    const roles = new Set(pendingPurposeRoles.value);
                    if (roles.has(role)) roles.delete(role);
                    else roles.add(role);
                    if (role === 'full' && roles.has('full')) {
                        roles.delete('question');
                        roles.delete('answer');
                        roles.delete('solution');
                    }
                    if (['question', 'answer', 'solution'].includes(role) && roles.has(role)) {
                        roles.delete('full');
                        roles.delete('supplemental_image');
                    }
                    if (role === 'supplemental_image' && roles.has('supplemental_image')) {
                        roles.clear();
                        roles.add('supplemental_image');
                    }
                    pendingPurposeRoles.value = [...roles];
                };

                const confirmBatchFilePurpose = () => {
                    if (!pendingPurposeFile.value || pendingPurposeRoles.value.length === 0) return;
                    const roles = [...new Set(pendingPurposeRoles.value)];
                    let role = 'mixed';
                    if (roles.includes('supplemental_image')) role = 'supplemental_image';
                    else if (roles.includes('full')) role = 'full';
                    else if (roles.includes('question')) role = 'question';
                    else if (roles.includes('answer')) role = 'answer';
                    else if (roles.includes('solution')) role = 'solution';
                    const now = Date.now();
                    batchCreateFiles.value.push({
                        ...pendingPurposeFile.value,
                        batchId: '',
                        role,
                        roles,
                        pageRange: '',
                        parseStatus: 'pending',
                        parseResultId: '',
                        errorMessage: '',
                        createdAt: now,
                        updatedAt: now
                    });
                    openNextPendingPurposeFile();
                };

                const cancelBatchFilePurpose = () => {
                    openNextPendingPurposeFile();
                };

                const editBatchFilePurpose = (file) => {
                    if (!file || activeBatchId.value) {
                        alert('任务已开始识别。如需修改文件用途，请新建任务。');
                        return;
                    }
                    batchCreateFiles.value = batchCreateFiles.value.filter(item => item.id !== file.id);
                    pendingPurposeFile.value = { ...file };
                    pendingPurposeRoles.value = Array.isArray(file.roles) && file.roles.length ? [...file.roles] : [file.role].filter(Boolean);
                };

                const removeBatchCreateFile = (fileId) => {
                    if (!confirm('确定删除这个文件吗？')) return;
                    batchCreateFiles.value = batchCreateFiles.value.filter(file => file.id !== fileId);
                };

                const loadBatchImportData = () => reviewSession.reload();

                const runReviewDraftPersistenceCommand = async (command, { kind = 'draft', failureMessage = '草稿保存失败' } = {}) =>
                    window.Qisi.ReviewSessionCommands.persistDraftCommand({
                        service: draftPersistenceService,
                        command,
                        kind,
                        failureMessage,
                        notify: showBatchToast
                    });

                const recentBatchImportBatches = computed(() => [...batchImportBatches.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 12));
                const activeBatch = computed(() => batchImportBatches.value.find(batch => batch.id === activeBatchId.value) || null);
                const activeDraftQuestion = computed(() => reviewSession.current());
                const isValidQuestionPreviewImage = (img) => {
                    if (!img?.url) return false;
                    if (img.displayable === false) return false;
                    return true;
                };

                const pdfDraftContract = q => window.Qisi.PdfMineruContract.isRecord(q) ? window.Qisi.PdfMineruContract : window.Qisi.PdfExternalContract.isExternal(q) ? window.Qisi.PdfExternalContract : window.Qisi.PdfMultimodalContract.isV1(q) ? window.Qisi.PdfMultimodalContract : null;
                const pdfDraftMeta = q => q?.pdfReview || q?.pdfExternal || q?.pdfV1 || null;
                const pdfScopeWarnings = q => {
                    const meta = pdfDraftMeta(q);
                    return pdfDraftContract(q)?.acknowledgeTaskIssues && !meta?.taskIssuesAcknowledged && Array.isArray(meta?.taskProblems)
                        ? meta.taskProblems : [];
                };
                const sourcePageIndex = computed(() => Qisi.ReviewImageProjection.indexSourcePages(batchImportFiles.value));
                const activePdfReviewPanel = computed(() => {
                    const panel = pdfDraftContract(activeDraftQuestion.value)?.reviewPanel?.(activeDraftQuestion.value);
                    return panel ? { ...panel, sources: activeDraftSourcePageImages.value } : null;
                });
                const activePdfUnassigned = computed(() => batchImportFiles.value.flatMap(file => ((file.pdfMineruEvidence || file.pdfExternalEvidence)?.unassigned || []).map(fragment => ({ ...fragment, sourceFileName: file.filename }))));
                const activeDraftImages = computed(() => window.Qisi.ReviewImageProjection.projectActiveImages({
                    question: activeDraftQuestion.value,
                    boundImages: batchDraftImages.value,
                    isRealFigureRow: isRealQuestionFigureImageRow,
                    isPreviewable: isValidQuestionPreviewImage,
                    mergeById: mergeImageListsById,
                    pdfContract: pdfDraftContract
                }));

                const activeDraftRealQuestionImages = computed(() => window.Qisi.ReviewImageProjection.projectRealQuestionImages({
                    question: activeDraftQuestion.value,
                    boundImages: batchDraftImages.value,
                    isRealFigureRow: isRealQuestionFigureImageRow,
                    isPreviewable: isValidQuestionPreviewImage,
                    mergeById: mergeImageListsById,
                    pdfContract: pdfDraftContract
                }));

                const activeDraftSourcePageImages = computed(() => window.Qisi.ReviewImageProjection.projectSourcePageImages({
                    question: activeDraftQuestion.value,
                    batchId: activeBatchId.value,
                    isRealFigureRow: isRealQuestionFigureImageRow,
                    isPreviewable: isValidQuestionPreviewImage,
                    mergeById: mergeImageListsById,
                    pdfContract: pdfDraftContract,
                    pdfMeta: pdfDraftMeta, sourcePageIndex: sourcePageIndex.value
                }));

                const activeDraftPreviewImages = computed(() => window.Qisi.ReviewImageProjection.projectPreviewImages({
                    question: activeDraftQuestion.value,
                    realQuestionImages: activeDraftRealQuestionImages.value,
                    isRealFigureRow: isRealQuestionFigureImageRow,
                    isPreviewable: isValidQuestionPreviewImage,
                    mergeById: mergeImageListsById
                }));
                const toggleImagePositionMenu = (imageId = '') => {
                    const id = String(imageId || '').trim();

                    if (!id) {
                        imagePositionMenuId.value = '';
                        return;
                    }

                    imagePositionMenuId.value =
                        imagePositionMenuId.value === id ? '' : id;
                };
                const copyDraftImagePlacementLatex = async (image, position) => {
                    try {
                        const code = window.Qisi.ReviewDraftState.buildDraftImagePlacementCode(image, position);
                        const copied = await copyText(code);

                        if (!copied) {
                            throw new Error('浏览器未允许写入剪贴板');
                        }

                        imagePositionMenuId.value = '';

                        const label = {
                            left: '靠左',
                            center: '居中',
                            right: '靠右'
                        }[position] || '居中';

                        if (position === 'left' || position === 'right') {
                            showBatchToast(`${label}图片代码已复制，请粘贴到题干开头。`);
                        } else {
                            showBatchToast('居中图片代码已复制，请粘贴到题干中的目标位置。');
                        }
                    } catch (error) {
                        console.error('[BATCH_IMAGE][copy-placement-failed]', error);
                        showBatchToast(`复制失败：${error?.message || String(error)}`);
                    }
                };
                const activeDraftSourceLabel = computed({
                    get: () => activeDraftQuestion.value?.meta?.source ||
                        (typeof activeDraftQuestion.value?.source === 'string' ? activeDraftQuestion.value.source : ''),
                    set: value => { const q = activeDraftQuestion.value; if (q) q.meta = { ...(q.meta || {}), source: value }; }
                });
                const activeDraftEditorDirty = computed(() => reviewSession.dirty());
                reviewSession.protectExit({ target: window });
                Vue.onUnmounted(reviewSession.dispose);

                const buildDraftEditorSource = (q) => window.Qisi.ReviewEditorProjection.buildEditorSource({
                    question: q,
                    pdfContract: pdfDraftContract,
                    mergeStemWithOptions,
                    normalizeNewlines: window.Qisi.ReviewDraftState.normalizeDraftEditorNewlines
                });

                const buildDraftEditorProjection = (source, question) => window.Qisi.ReviewEditorProjection.buildEditorProjection({
                    source,
                    question,
                    pdfContract: pdfDraftContract,
                    normalizeNewlines: window.Qisi.ReviewDraftState.normalizeDraftEditorNewlines,
                    splitChoiceSource: window.Qisi.ReviewDraftState.splitChoiceSourceForEditor,
                    normalizePreviewOptions: window.Qisi.ReviewDraftState.normalizeDraftPreviewOptions
                });

                const activeDraftEditorPreview = computed(() =>
                    buildDraftEditorProjection(
                        activeDraftEditorBuffer.value,
                        activeDraftQuestion.value
                    )
                );

                const insertDraftEditorText = async (text = '') => {
                    const textarea = activeDraftEditorTextarea.value;
                    const insertion = String(text || '');

                    if (!textarea) {
                        activeDraftEditorBuffer.value += insertion;
                        return;
                    }

                    const start = textarea.selectionStart ?? 0;
                    const end = textarea.selectionEnd ?? start;
                    const current = activeDraftEditorBuffer.value;

                    activeDraftEditorBuffer.value =
                        current.slice(0, start) +
                        insertion +
                        current.slice(end);

                    await nextTick();

                    const cursor = start + insertion.length;
                    textarea.focus();
                    textarea.setSelectionRange(cursor, cursor);
                };

                const discardActiveDraftEditorChanges = () => {
                    reviewSession.discard();
                    showBatchToast('已放弃未保存修改。');
                };

                watch(
                    () => activeDraftQuestion.value?.id || '',
                    () => {
                        reviewSession.syncCurrent(buildDraftEditorSource);
                    },
                    { immediate: true }
                );
                // Read-only projection: the rules live in qisi-review-draft-read-model.js.
                // The page passes the existing owners explicitly; the module never writes.
                const batchRecognitionSummary = computed(() =>
                    window.Qisi.ReviewDraftReadModel.summarizeDrafts(batchDraftQuestions.value || [], {
                        questionNo: window.Qisi.ReviewDraftState.draftSummaryQuestionNo,
                        countValidOptions,
                        isChoiceDraft,
                        cleanText: window.Qisi.Utils.cleanRecognizedText
                    })
                );
                const unassignedDraftImages = computed(() => batchDraftImages.value.filter(image => !image.questionId && image.status === 'unassigned'));
                const filteredDraftQuestions = computed(() =>
                    window.Qisi.ReviewDraftReadModel.filterDrafts(
                        batchDraftQuestions.value || [],
                        batchImportFilter.value,
                        draftQuestionProblems
                    )
                );

                const defaultMetaForStorage = () => ({
                    ...toRaw(batchDefaultMeta),
                    tags: String(batchDefaultMeta.tags || '').split(',').map(tag => tag.trim()).filter(Boolean)
                });

                const createDraftImportBatch = async () => {
                    batchCreateWarning.value = '';
                    if (!batchCreateFiles.value.length) {
                        batchCreateWarning.value = '请先添加要识别的文件。';
                        return;
                    }
                    if (!batchCreateFiles.value.some(batchHasQuestionRole)) {
                        batchCreateWarning.value = '请至少上传一个题目文件，系统需要先识别题目内容。';
                        return;
                    }
                    let producerMode;
                    try {
                        producerMode = window.Qisi.ProductionImportRoutePolicy
                            .selectNormalUiProducerMode(window.Qisi.SourceRoleClassifier
                                .classifySourceRoles(toRaw(batchCreateFiles.value)));
                    } catch (error) {
                        batchCreateWarning.value = '文件组合暂不支持识别，请将 DOCX 与 PDF 分别创建任务。';
                        return;
                    }
                    const invalidPdf = batchCreateFiles.value.find(file => file.fileType === 'pdf' && !window.Qisi.Utils.validatePageRange(file.pageRange));
                    if (invalidPdf) {
                        batchCreateWarning.value = '页码范围格式不正确，请参考：1-5，8，10-12。';
                        return;
                    }
                    const hasAnswer = batchCreateFiles.value.some(batchHasAnswerRole);
                    if (!hasAnswer && !confirm('当前任务没有单独的答案文件。系统将尝试从题目文件中识别答案；如果识别不到，后续可在审核页手动填写答案。是否继续？')) return;

                    const now = Date.now();
                    const batchId = makeBatchId('batch');
                    const title = batchCreateFiles.value[0]?.filename || '批量录题任务';
                    const fileTypes = new Set(batchCreateFiles.value.map(file => file.fileType));
                    const batch = {
                        id: batchId,
                        title,
                        sourceType: fileTypes.size === 1 ? [...fileTypes][0] : 'mixed',
                        producerMode,
                        sourceVersion: 1,
                        sourceFileName: batchCreateFiles.value.map(file => file.filename).join(' + '),
                        status: 'pending',
                        progress: 0,
                        totalCount: 0,
                        reviewedCount: 0,
                        submittedCount: 0,
                        problemCount: 0,
                        unassignedImageCount: 0,
                        defaultMeta: defaultMetaForStorage(),
                        expectedQuestionCount:
                            Math.max(0, Math.floor(Number(batchExpectedQuestionCount.value || 0))),
                        unmatchedAnswers: [],
                        createdAt: now,
                        updatedAt: now,
                        errorMessage: ''
                    };
                    const files = batchCreateFiles.value.map(file => ({
                        ...toRaw(file),
                        batchId,
                        sourceVersion: batch.sourceVersion,
                        uploadPath: file.textDraft !== undefined
                            ? `data:text/plain;charset=utf-8,${encodeURIComponent(file.textDraft || '')}`
                            : file.uploadPath,
                        updatedAt: now
                    }));
                    try {
                        await draftPersistenceService.createDraftBatch({
                            batch,
                            files
                        });
                    } catch (error) {
                        batchCreateWarning.value =
                            `创建任务失败：${error?.code || error?.message || 'storage-failure'}`;
                        return;
                    }
                    batchCreateFiles.value = [];
                    batchImportMode.value = 'list';
                    await loadBatchImportData();
                    setTimeout(() => {
                        runBatchRecognition(batchId).catch(error => {
                            console.error('[BATCH_DEBUG][initial-run-failed]', {
                                batchId,
                                message: error?.message || String(error)
                            }, error);
                        });
                    }, 80);
                };

                const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
                const getLocalConvertBaseUrl = () => {
                    if (/^https?:$/i.test(window.location.protocol)) {
                        return window.location.origin;
                    }

                    return 'http://localhost:3000';
                };

                window.__qisiCheckLocalConvert = async function () {
                    const baseUrl = getLocalConvertBaseUrl();
                    const resp = await fetch(`${baseUrl}/api/convert/self-test`, {
                        cache: 'no-store'
                    });
                    const data = await resp.json();

                    console.groupCollapsed('[QISI_LOCAL_CONVERT_SELF_TEST]');
                    console.log(data);
                    console.groupEnd();

                    return data;
                };
                const qwenOcrRuntime =
                    Qisi.QwenVisionSourcePort.createProductionOcrRuntime({
                        onAiRequest: label => recordBatchCostCall(label),
                        getMode: () => activeRecognitionMode,
                        cleanText: value =>
                            window.Qisi.Utils.cleanRecognizedText(value),
                        isFatalError: error =>
                            window.Qisi.Utils.isFatalQwenServiceError(error),
                        warn: code => console.warn(code)
                    });
                const qwenTaskClient = qwenOcrRuntime.taskClient;
                const qwenDocumentOcrSource =
                    qwenOcrRuntime.documentOcrSource;
                const PDF_PROCESS_CONFIG = {
                    maxPagesWithoutConfirm: 20,
                    pageRenderTimeoutMs: 45000,
                    pageVisionTimeoutMs: 120000,
                    maxVisionCallsCheapPerPage: 1,
                    maxVisionCallsStandardPerPage: 2,
                    maxVisionCallsAccuratePerPage: 4,
                    renderScale: 2.0,
                    jpegQuality: 0.86
                };
                const DOCX_TEXT_ONLY_WARNING =
                    '当前 Word 文件未能通过本地服务转成 PDF，只能使用文本层兜底，复杂公式和选项可能不完整。请确认已运行 npm start，并从 http://localhost:3000/main.html 打开软件。';
                let activeRecognitionMode = 'standard';
                let activeBatchCostStats = null;

                const estimateVisionCalls = (pageCount, mode) => {
                    if (mode === 'cheap') return pageCount;
                    if (mode === 'standard') return pageCount * 1.2;
                    return pageCount * 3;
                };

                const recordBatchCostCall = (label = 'Qwen 请求') => {
                    if (!activeBatchCostStats) return;
                    const textLike = /文本|对齐|选项二次|选项重建|答案解析结构化/.test(label) && !/图片|视觉|OCR/.test(label);

                    if (textLike) {
                        activeBatchCostStats.textCalls += 1;
                        console.log('[BATCH_COST][text-call]', {
                            mode: activeBatchCostStats.mode,
                            textCalls: activeBatchCostStats.textCalls,
                            label
                        });
                    } else {
                        activeBatchCostStats.visionCalls += 1;
                        console.log('[BATCH_COST][vision-call]', {
                            mode: activeBatchCostStats.mode,
                            visionCalls: activeBatchCostStats.visionCalls,
                            label
                        });
                    }
                };

                const batchDebugEnabled = true;
                const toBatchDebugQuestion = (item = {}) => ({
                    question: item.question ?? item.questionNumber ?? item.no ?? item.index ?? item.题号 ?? '',
                    type: item.type ?? item.题型 ?? '',
                    stem: window.Qisi.Utils.cleanRecognizedText(item.stem ?? item.questionText ?? item.question_text ?? item.content ?? item.text ?? item.题干 ?? item.题目内容 ?? '').slice(0, 600),
                    options: normalizeRecognizedOptions(extractItemOptions ? extractItemOptions(item) : item.options).map(opt => window.Qisi.Utils.cleanRecognizedText(opt).slice(0, 200)),
                    optionCount: normalizeRecognizedOptions(extractItemOptions ? extractItemOptions(item) : item.options).filter(opt => window.Qisi.Utils.cleanRecognizedText(opt)).length,
                    answer: window.Qisi.Utils.cleanRecognizedText(item.answer ?? item.答案 ?? item.correctAnswer ?? item.correct_answer ?? '').slice(0, 160),
                    solution: window.Qisi.Utils.cleanRecognizedText(item.solution ?? item.analysis ?? item.explanation ?? item.解析 ?? item.详解 ?? item.解答 ?? '').slice(0, 600),
                    rawText: window.Qisi.Utils.cleanRecognizedText(item.rawText ?? item.raw_text ?? item.rawBlock ?? item.sourceText ?? '').slice(0, 800)
                });
                const batchDebugLog = (label, payload) => {
                    if (!batchDebugEnabled) return;
                    try {
                        console.log(`[BATCH_DEBUG][${label}]`, JSON.stringify(payload, null, 2));
                    } catch (error) {
                        console.warn(`[BATCH_DEBUG][${label}] 打印失败`, error);
                    }
                };

                const buildSupportLeadingMissingBlockEvidence = ({
                    filename = '',
                    documentText = '',
                    missingBlocks = [],
                    expectedQuestionNumbers = [],
                    parsedQuestionNumbers = [],
                    blocks = [],
                    diagnostics = {}
                } = {}) => {
                    const source =
                        String(documentText || '');

                    const lines =
                        source.split('\n');

                    const markerKinds =
                        Array.isArray(diagnostics.markerKinds)
                            ? diagnostics.markerKinds
                            : [];

                    const firstBlock =
                        Array.isArray(blocks) && blocks.length
                            ? blocks[0]
                            : null;

                    const firstMarker =
                        markerKinds[0] || {};

                    const firstParsedQuestionNumber =
                        firstBlock?.questionNumber ||
                        firstMarker.questionNumber ||
                        parsedQuestionNumbers[0] ||
                        '';

                    const firstParsedMarkerLineNo =
                        Number(
                            firstBlock?.markerLineNo ||
                            firstMarker.lineNo ||
                            0
                        );

                    const firstParsedMarkerKind =
                        firstBlock?.markerKind ||
                        firstMarker.markerKind ||
                        '';

                    const markerLineIndex =
                        firstParsedMarkerLineNo > 0
                            ? firstParsedMarkerLineNo - 1
                            : -1;

                    const leadingTextHead =
                        markerLineIndex >= 0
                            ? lines
                                .slice(0, markerLineIndex)
                                .join('\n')
                                .slice(0, 800)
                            : source.slice(0, 800);

                    const firstParsedMarkerRawLine =
                        markerLineIndex >= 0
                            ? String(lines[markerLineIndex] || '')
                            : '';

                    const toLineEvidence = (line, index) => ({
                        lineNo:
                            index + 1,
                        rawLine:
                            line,
                        escapedLine:
                            JSON.stringify(line),
                        length:
                            String(line || '').length
                    });

                    const rejected =
                        Array.isArray(
                            diagnostics.rejectedMarkerCandidates
                        )
                            ? diagnostics.rejectedMarkerCandidates
                            : [];

                    return {
                        filename,
                        missingBlocks,
                        expectedQuestionNumbers,
                        parsedQuestionNumbers,
                        firstParsedQuestionNumber,
                        firstParsedMarkerLineNo,
                        firstParsedMarkerKind,
                        leadingTextHead,
                        leadingLines:
                            lines
                                .slice(0, 15)
                                .map(toLineEvidence),
                        firstParsedMarkerRawLine,
                        firstRejectedMarkerCandidates:
                            rejected
                                .slice(0, 5)
                                .map(candidate => {
                                    const rawLine =
                                        String(
                                            candidate?.rawLine ||
                                            ''
                                        );

                                    return {
                                        lineNo:
                                            candidate?.lineNo,
                                        reason:
                                            candidate?.reason ||
                                            '',
                                        rawLine,
                                        escapedLine:
                                            candidate
                                                ?.escapedLine ||
                                            JSON.stringify(rawLine)
                                    };
                                })
                    };
                };


                const recognizePageAsDocumentText =
                    qwenDocumentOcrSource.recognizeDocumentText;
                const recognizePageMarkdownWithQwen =
                    qwenDocumentOcrSource.recognizePageMarkdown;

                const normalizeOcrQuestionOutput = (
                    source = ''
                ) => {
                    let text = String(source || '')
                        .replace(/\r\n?/g, '\n')
                        .trim();

                    // 删除模型可能返回的 Markdown 代码围栏。
                    text = text
                        .replace(/^```(?:latex|tex|markdown)?\s*/i, '')
                        .replace(/\s*```$/i, '')
                        .trim();

                    // 将 itemize/enumerate 中的带标签选项转为系统标准 A. B. C. D.
                    text = text.replace(
                        /\\begin\{(?:itemize|enumerate)\}([\s\S]*?)\\end\{(?:itemize|enumerate)\}/g,
                        (block, body) => {
                            const options = [];

                            const itemPattern =
                                /\\item\s*(?:\[([A-DＡ-Ｄ])[.．、:]?\])?\s*([\s\S]*?)(?=\\item\b|$)/g;

                            let match;
                            let fallbackIndex = 0;

                            while (
                                (match = itemPattern.exec(body)) !== null
                            ) {
                                const rawLabel =
                                    String(match[1] || '').trim();

                                const label = rawLabel
                                    ? rawLabel
                                        .replace(/[Ａ-Ｄ]/g, ch =>
                                            String.fromCharCode(
                                                ch.charCodeAt(0) - 65248
                                            )
                                        )
                                        .toUpperCase()
                                    : String.fromCharCode(
                                        65 + fallbackIndex
                                    );

                                const content =
                                    String(match[2] || '')
                                        .trim();

                                if (content) {
                                    options.push(
                                        `${label}. ${content}`
                                    );
                                }

                                fallbackIndex += 1;
                            }

                            return options.length
                                ? `\n\n${options.join('\n')}\n`
                                : block;
                        }
                    );

                    // 清理残余列表命令。
                    text = text
                        .replace(
                            /\\begin\{(?:itemize|enumerate)\}/g,
                            ''
                        )
                        .replace(
                            /\\end\{(?:itemize|enumerate)\}/g,
                            ''
                        )
                        .replace(
                            /\\item\s*\[([A-DＡ-Ｄ])[.．、:]?\]\s*/g,
                            (match, label) => {
                                const normalized =
                                    String(label)
                                        .replace(/[Ａ-Ｄ]/g, ch =>
                                            String.fromCharCode(
                                                ch.charCodeAt(0) - 65248
                                            )
                                        )
                                        .toUpperCase();

                                return `${normalized}. `;
                            }
                        )
                        .replace(/\n{3,}/g, '\n\n')
                        .trim();

                    return text;
                };

                const BLOCK_IMAGE_TOKEN = (id) => `[[IMAGE:${id}]]`;

                const questionContentPolicy =
                    Qisi.QuestionContentPolicy.createQuestionContentPolicy({
                        recognizeFormulaText: (imageUrl, signal) =>
                            qwenDocumentOcrSource.recognizeFormulaText(
                                imageUrl,
                                signal
                            ),
                        blockImageToken: BLOCK_IMAGE_TOKEN,
                        getDefaultType: () =>
                            batchDefaultMeta.defaultType || '解答题'
                    });
                const {
                    cleanDisplayTextForBatchSave,
                    cleanDisplayOptionsForBatchSave,
                    cleanDisplayFieldsOnly,
                    addWarningOnce,
                    countValidOptions,
                    isChoiceDraft,
                    choiceQuestionMissingOptions,
                    resolveFormulaImageTokens,
                    normalizeMathTextForLatex,
                    normalizeMathTextForLatexSafe,
                    repairCommonLatexOcrErrors,
                    normalizeRecognizedOptions,
                    sanitizeChoiceOptions,
                    solutionLooksFormulaPoor,
                    preferFormulaRichSolution,
                    hasChoiceLabelSignal,
                    stripQuestionSectionNoise,
                    choiceRepairDeps,
                    normalizeQuestionType,
                    normalizeQuestionKey,
                    choiceOptionIssue
                } = questionContentPolicy;

                const pageQuestionParser =
                    Qisi.PageQuestionParser.createPageQuestionParser({
                        cleanDisplayTextForBatchSave,
                        normalizeQuestionKey,
                        hasChoiceLabelSignal
                    });
                const {
                    splitPageMarkdownIntoQuestionBlocks,
                    parseOptionsFromBlock,
                    getCurrentQuestionBlockFromPageText,
                    extractOptionsFromCurrentBlockOnly,
                    attachSourceTraceToDraftQuestion
                } = pageQuestionParser;

                const {
                    solutionLooksBroken,
                    solutionQualityIssue,
                    solutionMatchesQuestionContext
                } = Qisi.SolutionQualityPolicy;

                const {
                    extractGraphicRefs,
                    normalizeInlineImageList,
                    mergeImageListsById
                } = Qisi.QuestionImagePolicy;

                const supportTextParser =
                    Qisi.SupportTextParser.createSupportTextParser({
                        normalizeQuestionKey,
                        stripQuestionSectionNoise,
                        extractGraphicRefs,
                        normalizeMathTextForLatexSafe
                    });
                const {
                    parseAnswerItemsFromText,
                    parseSolutionItemsFromText,
                    parseAnswerAndSolutionItemsFromText
                } = supportTextParser;

                const supportLatexPolicy =
                    Qisi.SupportLatexPolicy.createSupportLatexPolicy({
                        repairCommonLatexOcrErrors
                    });
                const {
                    normalizeRecognizedSupportLatex,
                    normalizeAnswerForLatex
                } = supportLatexPolicy;

                const recognitionStructurePolicy =
                    Qisi.RecognitionStructurePolicy
                        .createRecognitionStructurePolicy({
                            stripQuestionSectionNoise,
                            splitQuestionForStorage,
                            normalizeQuestionType,
                            normalizeAnswerForLatex,
                            normalizeInlineImageList,
                            collectValidRecognizedFigures: item =>
                                collectValidRecognizedFigures(item),
                            mergeStemWithOptions,
                            batchDebugLog,
                            toBatchDebugQuestion,
                            getDefaultType: () =>
                                batchDefaultMeta.defaultType || '单选题',
                            choiceRepairDeps
                        });
                const {
                    prepareQuestionRecognitionText,
                    splitQuestionBlocksByNumber,
                    parseQuestionItemsFromText,
                    extractItemOptions,
                    parseStrictQuestionPayload,
                    extractAnswerArray,
                    extractSolutionArray,
                    postprocessRecognizedItems,
                    splitMergedRecognizedItems
                } = recognitionStructurePolicy;

                const visualQuestionSource =
                    Qisi.VisualQuestionSource.createVisualQuestionSource({
                        qwenTaskClient,
                        getRecognitionMode: () => activeRecognitionMode,
                        cleanDisplayOptionsForBatchSave,
                        solutionLooksFormulaPoor,
                        normalizeQuestionKey,
                        cleanDisplayTextForBatchSave,
                        preferFormulaRichSolution
                    });
                const {
                    locateQuestionFiguresWithQwen,
                    repairPageChoiceAndSolutionDetailsWithVision,
                    cropDataUrlByBbox
                } = visualQuestionSource;

const logBatchPdfDiag = (stage, payload = {}, level = 'log') => {
                    try {
                        const label = `[BATCH_PDF_DIAG][${stage}]`;
                        const method = level === 'error'
                            ? 'error'
                            : level === 'warn'
                                ? 'warn'
                                : 'log';

                        if (console.groupCollapsed) {
                            console.groupCollapsed(label);
                            console[method](payload);
                            console.groupEnd();
                            return;
                        }

                        console[method](label, payload);
                    } catch (error) {
                        console.warn('[BATCH_PDF_DIAG][log-failed]', {
                            stage,
                            message: error?.message || String(error)
                        });
                    }
                };

                const browserPdfRenderer =
                    Qisi.BrowserPdfRenderer.createBrowserPdfRenderer({
                        dataUrlToBlob,
                        getBatchFileRoles,
                        logBatchPdfDiag,
                        batchHasQuestionRole,
                        estimateVisionCalls,
                        recordRenderedPages: pageCount => {
                            if (activeBatchCostStats) {
                                activeBatchCostStats.pages += pageCount;
                            }
                        },
                        showBatchToast,
                        getRecognitionMode: () => activeRecognitionMode,
                        pdfProcessConfig: PDF_PROCESS_CONFIG
                    });
                const { renderPdfFilePages } = browserPdfRenderer;

                const visualSupportSource =
                    Qisi.VisualSupportSource.createVisualSupportSource({
                        normalizeQuestionKey,
                        normalizeAnswerForLatex,
                        normalizeRecognizedSupportLatex,
                        extractGraphicRefs,
                        extractAnswerArray,
                        extractSolutionArray,
                        cleanRecognizedText,
                        buildSupportLeadingMissingBlockEvidence,
                        parseAnswerAndSolutionItemsFromText,
                        recognizePageAsDocumentText,
                        attachPdfPageTrace:
                            Qisi.PdfSafePartialPipeline.attachPdfPageTrace,
                        getBatchFileRoles,
                        logBatchPdfDiag,
                        qwenTaskClient
                    });
                const {
                    recognizeVisualSupportFromPreparedPages
                } = visualSupportSource;

                const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
                    reader.readAsDataURL(blob);
                });



                const extractLatexFragmentsForCheck = (text = '') => {
                    const source = String(text || '');
                    const fragments = [];

                    source.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g, (match, a, b, c, d) => {
                        fragments.push(a || b || c || d || '');
                        return match;
                    });

                    const hasBareLatexSignal = /\\(?:frac|sqrt|sin|cos|tan|angle|parallel|perp|begin|vec|overrightarrow|overline)|[_^]/.test(source);
                    if (!fragments.length && hasBareLatexSignal) fragments.push(source);

                    return fragments.map(x => String(x || '').trim()).filter(Boolean);
                };

                const latexErrorCountForText = (text = '') => {
                    if (!window.katex) return 0;
                    return extractLatexFragmentsForCheck(text).filter(formula => {
                        try {
                            Qisi.Utils.renderLatexFormula(window.katex.renderToString, formula, {
                                throwOnError: true,
                                strict: false
                            });
                            return false;
                        } catch {
                            return true;
                        }
                    }).length;
                };

                const strictQuestionPolicy =
                    Qisi.StrictQuestionPolicy.createStrictQuestionPolicy({
                        cleanDisplayOptionsForBatchSave,
                        latexErrorCountForText
                    });
                const {
                    optionCountForGolden,
                    isBadChoiceOption,
                    normalizeFourOptionsForCheck,
                    isStrictChoiceType,
                    validateDocxVisualItems,
                    validateVisualQuestionItems,
                    mergeStrictQuestionItemsByNumber,
                    mapWithConcurrency,
                    questionHasFigureCue,
                    normalizeRecognizedFigureDescriptor,
                    isLikelyRealQuestionFigure,
                    collectValidRecognizedFigures,
                    isRealQuestionFigureImageRow,
                    runBatchDocxGoldenCheck
                } = strictQuestionPolicy;

                const productionImportOutputPorts = Object.freeze({
                    cleanText: window.Qisi.Utils.cleanRecognizedText,
                    normalizeQuestionKey,
                    cleanOptions: window.Qisi.Utils.cleanDisplayOptionsForBatchSave,
                    mergeImages: mergeImageListsById
                });

                const batchFinalGateOptionCount = (options = []) => {
                    return window.Qisi.ProductionImportOutputPort.countMeaningfulOptions(
                        options,
                        productionImportOutputPorts
                    );
                };

                const batchFinalGateDedupeDrafts = (drafts = [], context = {}) => {
                    const result = window.Qisi.ProductionImportOutputPort.projectImportOutput(
                        {
                            drafts,
                            draftImages: context.draftImages || [],
                            stage: context.stage || 'unknown'
                        },
                        productionImportOutputPorts
                    );

                    console.groupCollapsed(`[BATCH_FINAL_GATE][${result.diagnostics.stage}]`);
                    console.log('before =', (drafts || []).length, 'after =', result.drafts.length);
                    console.table(result.diagnostics.before);
                    console.table(result.diagnostics.after);
                    console.groupEnd();

                    return result;
                };

                const {
                    appendImageTokensToStemForV2,
                    normalizeImagePlacementDuplicates,
                    migrateLegacyIncludegraphicsToQisiTokens,
                    ensureImagePackagesForLatex,
                    removeImageTokenFromStemForV2
                } = Qisi.ReviewDraftState;

                const runProductionDocxDeterministicImport =
                    window.Qisi.ProductionDocxSourcePort
                        .createProductionImportRunner({
                            coordinator: window.Qisi.DocxImportCoordinator,
                            importer: window.QisiBatchImporter,
                            getDefaultMeta: () => toRaw(batchDefaultMeta || {}),
                            cleanText: cleanDisplayTextForBatchSave,
                            cleanOptions: cleanDisplayOptionsForBatchSave,
                            getRoles: getBatchFileRoles,
                            normalizeQuestionNumber: normalizeQuestionKey,
                            parseSupportText:
                                parseAnswerAndSolutionItemsFromText,
                            makeId: makeBatchId,
                            clock: Date.now
                        });

                const runProductionPdfImport = window.Qisi.ImportDraftCommand.createPdfProducer({
                    producer: window.Qisi.PdfMineruProducer, storage: storageRepository,
                    renderPages: renderPdfFilePages, getRoles: getBatchFileRoles
                });

                const productionImportBridge =
                    window.Qisi.ProductionImportBridge.createProductionImportBridge({
                        createStateMachine: options =>
                            window.Qisi.ImportStateMachine.createImportStateMachine(options),
                        loadBatchAndFiles: input =>
                            window.Qisi.BatchContextService.loadBatchAndFiles({
                                ...input,
                                getRoles: getBatchFileRoles
                            }, { repository: storageRepository }),
                        classifySourceRoles: manifest =>
                            window.Qisi.SourceRoleClassifier.classifySourceRoles(manifest),
                        resolveProductionRoute: input =>
                            window.Qisi.ProductionImportRoutePolicy
                                .resolveProductionImportRoute(input),
                        runDocxImport: runProductionDocxDeterministicImport,
                        runPdfImport: runProductionPdfImport,
                        normalizeCandidates: drafts =>
                            window.Qisi.CandidateNormalizer.normalizeCandidates(
                                [{ questions: drafts }],
                                window.Qisi.SupportRepair
                            ),
                        projectImportOutput: input =>
                            window.Qisi.ProductionImportOutputPort.projectImportOutput(
                                input,
                                {
                                    cleanText: cleanDisplayTextForBatchSave,
                                    normalizeQuestionKey,
                                    cleanOptions: cleanDisplayOptionsForBatchSave,
                                    mergeImages: mergeImageListsById,
                                    clock: Date.now
                                }
                            ),
                        validateCandidates: (drafts, context) =>
                            window.Qisi.ImportValidationService.validateImportDrafts(
                                drafts,
                                { ...importValidationPorts, context }
                            ),
                        buildReviewDrafts: (drafts, context) =>
                            window.Qisi.ReviewDraftBuilder.buildReviewDrafts(
                                drafts,
                                context
                            ),
                        persistReviewDraftBatch: command =>
                            window.Qisi.ImportDraftCommand.buildPersistReviewDraftBatchCall({
                                command,
                                persist: payload =>
                                    draftPersistenceService.persistReviewDraftBatch(payload)
                            }),
                        reloadDraftBatch: batchId =>
                            draftPersistenceService.reloadDraftBatch(batchId),
                        createDiagnostics: () =>
                            window.Qisi.ImportDiagnostics.createImportDiagnostics({
                                clock: () => performance.now(),
                                logger: event =>
                                    console.info('[QISI_IMPORT_DIAGNOSTICS]', event)
                            }),
                        reportProgress: input =>
                            window.Qisi.ProductionImportStatusPort.reportProgress(
                                input,
                                { repository: storageRepository }
                            ),
                        reportImportFailure: input =>
                            window.Qisi.ProductionImportStatusPort.reportImportFailure(
                                input,
                                { repository: storageRepository }
                            ),
                        clock: Date.now
                    });

                const normalUiImportController = window.Qisi.ImportRunCommands.createWorkspace({
                    createController: window.Qisi.NormalUiImportController.createNormalUiImportController,
                    bridge: productionImportBridge, storage: storageRepository, session: reviewSession,
                    canReuseCommittedRequest: window.Qisi.ProductionImportRoutePolicy.canReuseNormalUiCommittedRequest,
                    sourceFor: buildDraftEditorSource, afterRender: nextTick, notify: showBatchToast
                });
                Vue.onUnmounted(normalUiImportController.dispose);

                const runBatchRecognition = async (batchId) => window.Qisi.ImportRunCommands.runBatch({
                    batchId,
                    controller: normalUiImportController,
                    warn: (message, payload) => console.warn(message, payload)
                });

                const cancelBatchRecognition = batchId => window.Qisi.ImportRunCommands.cancelBatch({
                    batchId,
                    controller: normalUiImportController,
                    notify: showBatchToast
                });

                const openBatchReview = async batchId => {
                    await reviewSession.openBatch(batchId, {
                        sourceFor: buildDraftEditorSource, afterRender: nextTick, confirmLeave: confirm
                    });
                };
                const selectDraftQuestion = async id => {
                    await reviewSession.select(id, {
                        sourceFor: buildDraftEditorSource, afterRender: nextTick, confirmLeave: confirm
                    });
                };

                const cleanSingleDraftForSave = (q) => {
                    if (!q) return q;
                    if (Boolean(pdfDraftContract(q))) { q.updatedAt = Date.now(); return q; }

                    window.Qisi.Utils.preserveRawEvidence(q);

                    // 只清理显示字段
                    window.Qisi.Utils.cleanDisplayFieldsOnly(q);

                    q.updatedAt = Date.now();
                    return q;
                };

                const markActiveDraftUserEdited = (field = '') => {
                    const q = activeDraftQuestion.value;
                    if (!q || q.status === 'submitted') return;
                    Object.assign(
                        q,
                        reviewController.markFieldsManual(q, [field])
                    );
                };

                const updateDraftQuestionField = async (field, value) => {
                    const q = activeDraftQuestion.value;
                    if (!q || q.status === 'submitted') return;
                    const expectedDraftVersion = q.version;

                    Object.assign(
                        q,
                        reviewController.editField(q, field, value)
                    );

                    cleanSingleDraftForSave(q);
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        expectedDraftVersion
                    });
                    if (!persisted) return;
                    Object.assign(q, persisted.draft);
                    showBatchToast('已保存草稿。');
                };

                const choosePdfCandidate = async (field, index) => {
                    const q = activeDraftQuestion.value;
                    if (!q || q.status === 'submitted') return;
                    if (activeDraftEditorDirty.value) { showBatchToast('请先保存或放弃未保存编辑，再采用候选。'); return; }
                    const expectedDraftVersion = q.version;
                    const next = pdfDraftContract(q).chooseCandidate(toRaw(q), field, index, reviewController);
                    const persisted = await runReviewDraftPersistenceCommand({ batchId: q.batchId, draft: next, images: next.images, expectedDraftVersion });
                    if (!persisted) return;
                    Object.assign(q, persisted.draft);
                    activeDraftEditorBuffer.value = buildDraftEditorSource(q);
                    await loadBatchImportData();
                    reviewSession.syncCurrent(buildDraftEditorSource);
                    showBatchToast('已采用人工选择；请核对并重新确认。');
                };

                const saveActiveDraftQuestion = (options = {}) => reviewSession.save({
                    images: activeDraftPreviewImages.value || [], prepareDraft: prepareEditorDraft,
                    refreshStats: refreshBatchStats, notify: showBatchToast, silent: Boolean(options.silent)
                });

                const confirmDraftImages = () => reviewImageCommands.confirmImages();
                const deleteDraftImage = imageId => reviewImageCommands.deleteImage(imageId, confirm);

                const openPdfSource = async (source) => {
                    const file = batchImportFiles.value.find(f => f.id === source.sourceFileId);
                    if (!file || file.fileType !== 'pdf') return;
                    const viewer = window.open('', '_blank');
                    if (!viewer) { showBatchToast('请允许浏览器打开原 PDF。'); return; }
                    try {
                        const url = URL.createObjectURL(await dataUrlToBlob(file.uploadPath));
                        viewer.opener = null;
                        viewer.location.href = url + '#page=' + (source.sourcePage || 1);
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                    } catch (error) { viewer.close(); showBatchToast('原 PDF 打开失败：' + error.message); }
                };
                const resetCropState = () => {
                    cropState.dragging = false;
                    cropState.startX = 0;
                    cropState.startY = 0;
                    cropState.x = 0;
                    cropState.y = 0;
                    cropState.w = 0;
                    cropState.h = 0;
                };

                const openSourcePageCrop = async (img) => {
                    const q = activeDraftQuestion.value;

                    if (!q) {
                        showBatchToast('请先选择一道题。');
                        return;
                    }

                    if (!img?.url) {
                        showBatchToast('没有可裁剪的来源原图。');
                        return;
                    }

                    const token = reviewImageCommands.captureCrop(img);
                    if (!token) return;
                    cropState.sessionToken = token;
                    cropState.sourceImage = img;
                    cropState.belongsTo = activeDraftTab.value === 'stem' ? 'stem' : activeDraftTab.value;
                    resetCropState();
                    cropModalOpen.value = true;

                    await nextTick();
                };

                const closeCropModal = () => {
                    cropModalOpen.value = false;
                    cropState.sourceImage = null;
                    cropState.sessionToken = null;
                    resetCropState();
                };

                const getCropPoint = (event) => {
                    const imgEl = cropImageRef.value;
                    if (!imgEl) return { x: 0, y: 0 };

                    const rect = imgEl.getBoundingClientRect();

                    return {
                        x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
                        y: Math.max(0, Math.min(rect.height, event.clientY - rect.top))
                    };
                };

                const startManualCrop = (event) => {
                    if (!cropState.sourceImage?.url) return;

                    const p = getCropPoint(event);

                    cropState.dragging = true;
                    cropState.startX = p.x;
                    cropState.startY = p.y;
                    cropState.x = p.x;
                    cropState.y = p.y;
                    cropState.w = 0;
                    cropState.h = 0;
                };

                const moveManualCrop = (event) => {
                    if (!cropState.dragging) return;

                    const p = getCropPoint(event);

                    cropState.x = cropState.startX;
                    cropState.y = cropState.startY;
                    cropState.w = p.x - cropState.startX;
                    cropState.h = p.y - cropState.startY;
                };

                const endManualCrop = () => {
                    cropState.dragging = false;
                };

                const saveManualCropToDraft = async () => {
                    const element = cropImageRef.value, source = cropState.sourceImage;
                    if (!element) { showBatchToast('裁剪图片未加载完成。'); return; }
                    const display = element.getBoundingClientRect();
                    const token = cropState.sessionToken;
                    const saved = await reviewImageCommands.crop({
                        token, source, target: cropState.belongsTo || 'stem',
                        region: { x: Math.min(cropState.x, cropState.x + cropState.w),
                            y: Math.min(cropState.y, cropState.y + cropState.h), w: Math.abs(cropState.w), h: Math.abs(cropState.h) },
                        display: { width: element.clientWidth || display.width, height: element.clientHeight || display.height },
                        isCancelled: () => !cropModalOpen.value || cropState.sourceImage !== source
                    });
                    if (saved && cropState.sessionToken === token && cropState.sourceImage === source) closeCropModal();
                };
                const bindUnassignedImage = (imageId, questionId) => reviewImageCommands.bind(imageId, questionId);
                const deleteUnassignedImage = imageId => reviewImageCommands.deleteUnassigned(imageId, confirm);

                const reviewDraftNormalizationPolicy =
                    Qisi.ReviewDraftNormalizationPolicy
                        .createReviewDraftNormalizationPolicy({
                            choiceOptionIssue,
                            solutionQualityIssue,
                            attachSourceTraceToDraftQuestion,
                            extractOptionsFromCurrentBlockOnly,
                            normalizeQuestionType,
                            choiceQuestionMissingOptions,
                            countValidOptions,
                            addWarningOnce,
                            batchDebugLog,
                            toBatchDebugQuestion,
                            getDefaultType: () =>
                                batchDefaultMeta.defaultType || '解答题',
                            clock: Date.now
                        });
                const {
                    validateDraftContentForReview,
                    normalizeDraftQuestionBeforeSave,
                    draftQuestionProblems
                } = reviewDraftNormalizationPolicy;

                const validateDraftForReview = q => {
                    const contentMessage = validateDraftContentForReview(q);
                    return productionReviewValidator.validate(q, {
                        baseErrors: contentMessage
                            ? [{ code: 'review-content-invalid', message: contentMessage }]
                            : [],
                        baseWarnings: q?.warnings || []
                    });
                };

                const draftMaintenanceService =
                    Qisi.DraftMaintenanceService
                        .createDraftMaintenanceService({
                            persistence: draftPersistenceService,
                            dedupeDrafts: batchFinalGateDedupeDrafts,
                            countOptions: batchFinalGateOptionCount,
                            problemsForDraft: draftQuestionProblems,
                            preserveRawEvidence:
                                window.Qisi.Utils.preserveRawEvidence,
                            cleanDisplayFields:
                                window.Qisi.Utils.cleanDisplayFieldsOnly,
                            clock: Date.now
                        });
                const reviewWorkflowService =
                    Qisi.ReviewWorkflowService
                        .createReviewWorkflowService({
                            persistence: draftPersistenceService,
                            reviewController,
                            validateDraft: validateDraftForReview,
                            confirmSelectedContent: draft => {
                                const contract = pdfDraftContract(draft);
                                let next = draft;
                                if (pdfScopeWarnings(next).length) next = contract.acknowledgeTaskIssues(next);
                                if (next.images?.length && ['need_confirm', 'low_confidence'].includes(next.imageReviewStatus)) {
                                    next.imageReviewStatus = 'confirmed';
                                    next.warnings = Qisi.ReviewImageCommands.planConfirmImages({ question: next }).warnings;
                                }
                                return next;
                            },
                            normalizeDraft: draft => {
                                normalizeDraftQuestionBeforeSave(draft);
                                return draft;
                            },
                            formalSubmit: batchFormalSubmit,
                            refreshBatchStats: command =>
                                draftMaintenanceService
                                    .refreshBatchStats(command),
                            mergeImages: mergeImageListsById,
                            dataUrlToBlob,
                            resolveImageRecords: ids => storageRepository.loadImageRecords(ids),
                            clock: Date.now
                        });

                const refreshBatchStats = async batchId => {
                    if (!batchId) return null;
                    return draftMaintenanceService.refreshBatchStats({
                        batchId
                    });
                };

                const formalSubmitErrorMessage = error => ({
                    DUPLICATE_EXACT: '题库已存在相同题目。',
                    DUPLICATE_SIMILAR: '题库存在疑似重复题目。',
                    DUPLICATE_ANSWER_CONFLICT: '题库存在题干相同但答案冲突的题目。',
                    REVIEW_WORKFLOW_NOT_REVIEWED: '请先标记已确认，再提交入库。',
                    REVIEW_WORKFLOW_STALE_DRAFT: '草稿已被其他操作更新，请刷新后重试。',
                    REVIEW_WORKFLOW_SUBMITTED_IMMUTABLE: '该草稿已经提交入库。'
                }[error?.code] || error?.details?.policyErrors?.[0]?.message ||
                    error?.details?.errors?.[0]?.message || error?.message || error?.code || '正式入库失败。');

                const prepareEditorDraft = window.Qisi.ReviewEditorCommit.createDraftPreparer({
                    controller: reviewController, state: window.Qisi.ReviewDraftState,
                    utils: window.Qisi.Utils, normalizeDraft: normalizeDraftQuestionBeforeSave,
                    pdfContract: pdfDraftContract, projection: buildDraftEditorProjection,
                    migrateImageTokens: migrateLegacyIncludegraphicsToQisiTokens,
                    normalizeDuplicates: normalizeImagePlacementDuplicates
                });
                const reviewImageCommands = window.Qisi.ReviewImageCommands.createImageCommands({
                    session: reviewSession, controller: reviewController, persistence: draftPersistenceService,
                    utils: window.Qisi.Utils, pdfContract: pdfDraftContract, sourceFor: buildDraftEditorSource,
                    realImagesFor: question => window.Qisi.ReviewImageProjection.projectRealQuestionImages({
                        question, boundImages: batchDraftImages.value, isRealFigureRow: isRealQuestionFigureImageRow,
                        isPreviewable: isValidQuestionPreviewImage, mergeById: mergeImageListsById,
                        pdfContract: pdfDraftContract, pdfMeta: pdfDraftMeta
                    }),
                    sourceImagesFor: question => window.Qisi.ReviewImageProjection.projectSourcePageImages({
                        question, batchId: activeBatchId.value, isRealFigureRow: isRealQuestionFigureImageRow,
                        isPreviewable: isValidQuestionPreviewImage, mergeById: mergeImageListsById,
                        pdfContract: pdfDraftContract, pdfMeta: pdfDraftMeta, sourcePageIndex: sourcePageIndex.value
                    }),
                    appendTokens: appendImageTokensToStemForV2, removeToken: removeImageTokenFromStemForV2,
                    cropPort: window.Qisi.ReviewImageCommands.createCropPort({ ImageClass: Image, document, pdfRenderer: browserPdfRenderer }),
                    makeId: makeBatchId, refreshStats: refreshBatchStats, notify: showBatchToast
                });
                const markDraftReviewed = async () => {
                    try {
                    const q = activeDraftQuestion.value;
                    if (!q) return;

                    if (activeDraftEditorDirty.value) {
                        const saved = await saveActiveDraftQuestion({ silent: true });
                        if (!saved) return;
                    }
                    const result = await reviewWorkflowService.confirmDraft({
                        batchId: q.batchId,
                        draftId: q.id,
                        expectedDraftVersion: q.version,
                        actorId: 'local-teacher'
                    });
                    if (!result.accepted) {
                        alert(result.validation?.errors?.[0]?.message ||
                            '题目校验失败。');
                        return;
                    }
                    activeDraftEditorOriginal.value = activeDraftEditorBuffer.value;
                    activeDraftEditorOriginalFields.value = window.Qisi.ReviewDraftState.snapshotDraftEditorFields(q);
                    await loadBatchImportData();
                    showBatchToast('已标记为确认。');

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const submitDraftQuestion = async (questionId = activeDraftQuestionId.value, silent = false) => {
                    if (
                        questionId === activeDraftQuestionId.value &&
                        activeDraftEditorDirty.value
                    ) {
                        const saved = await saveActiveDraftQuestion({
                            silent: true
                        });
                        if (!saved) return false;
                    }
                    const draft = batchDraftQuestions.value.find(
                        item => item.id === questionId
                    );
                    if (!draft?.batchId) return false;
                    try {
                        const result = await reviewWorkflowService.submitDraft({
                            batchId: draft.batchId,
                            draftId: draft.id,
                            expectedDraftVersion: draft.version,
                            actorId: 'local-teacher'
                        });
                        if (!result.accepted) {
                            if (!silent) alert(
                                result.validation?.errors?.[0]?.message ||
                                result.decision?.errors?.[0]?.message ||
                                '正式入库准入校验失败。'
                            );
                            return false;
                        }
                    } catch (error) {
                        if (!silent) alert(formalSubmitErrorMessage(error));
                        return false;
                    }
                    await loadData();
                    await loadBatchImportData();
                    if (!silent) showBatchToast('已提交入库。');
                    return true;
                };

                const reviewCurrentDraft = questionId => reviewActions.reviewDraft(questionId), submitReviewedDraft = questionId => reviewActions.submitReviewed(questionId);

                const draftMetaExpanded = ref(false);
                const toggleDraftSelection = (id) => {
                    selectedDraftIds.value = window.Qisi.ReviewBatchConfirm
                        .toggleSelection(selectedDraftIds.value, id);
                };
                const selectAllDrafts = () => {
                    selectedDraftIds.value = window.Qisi.ReviewBatchConfirm.selectAllVisible(
                        selectedDraftIds.value,
                        filteredDraftQuestions.value.map(item => item.id)
                    );
                };
                const confirmSelectedDrafts = () => reviewActions.confirmSelected();

                const openBatchSubmitSummary = async () => {                    try {
                    if (!activeBatchId.value) return;
                    submitSummary.value = await reviewWorkflowService
                        .prepareReviewedBatch({
                            batchId: activeBatchId.value
                        });

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const submitSelectedDrafts = async () => {
                    if (batchSubmitBusy.value) return;
                    batchSubmitBusy.value = true;
                    try { return await reviewActions.submitSelected(); }
                    finally { batchSubmitBusy.value = false; }
                };

                const rerunActiveBatchRecognition = async () => window.Qisi.ImportRunCommands.rerunBatch({
                    batchId: activeBatchId.value,
                    confirmRerun: message => confirm(message),
                    run: runBatchRecognition,
                    openReview: openBatchReview,
                    notify: showBatchToast
                });

                const dedupeActiveBatchDraftsNow = async () => {
                    try {
                    const batchId = activeBatchId.value;
                    if (!batchId) {
                        showBatchToast('当前没有打开批量任务。');
                        return;
                    }
                    if (!confirm('去重会删除重复草稿及其人工修改，请先核对并保存需要保留的内容。确定继续？')) return;
                    if (activeDraftEditorDirty.value && !await saveActiveDraftQuestion({ silent: true })) return;
                    const result = await draftMaintenanceService
                        .dedupeBatchDrafts({
                        batchId,
                        files: batchImportFiles.value || []
                    });
                    await loadBatchImportData();
                    activeDraftQuestionId.value = batchDraftQuestions.value[0]?.id || '';
                    showBatchToast(
                        `已清理重复题：${result.beforeCount} 条 → ${result.afterCount} 条。`
                    );

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const showUnmatchedAnswerList = () => {
                    const text = unmatchedAnswers.value.map(row => {
                        const number = row.questionNumber || row.question;
                        const value = row.value || row[row.field || 'answer'] || row.evidence?.values?.join('\n') || row.rawText || '';
                        return `${number ? `第 ${number} 题` : '题号未确定'} ${row.field === 'solution' ? '解析' : '答案'}：${value}｜${row.sourceFileName || row.sourceFile || ''}`;
                    }).join('\n');
                    alert(text || '没有未匹配答案。');
                };

                const showActiveRawText = () => {
                    alert(activeDraftQuestion.value?.rawText || '暂无原文');
                };

                const cleanupActiveBatchDisplayPollution = async () => {
                    try {
                    const batchId = activeBatchId.value;
                    if (!batchId) {
                        alert('当前没有打开批量任务。');
                        return;
                    }
                    const result = await draftMaintenanceService
                        .cleanupDisplayFields({ batchId });
                    if (result.changedCount) await loadBatchImportData();
                    showBatchToast(
                        `已清理 ${result.changedCount} 道题的显示字段污染。`
                    );

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const showCropNotice = (sourceImage = null) => {
                    const page = sourceImage?.sourcePage ? `第 ${sourceImage.sourcePage} 页` : '来源原图';
                    alert(`${page}已保留；重新裁剪将在接入页面坐标后开放。`);
                };

                const confirmBatchSubmit = async () => {
                    try {
                    if (!submitSummary.value) return;
                    const result = await reviewWorkflowService
                        .submitReviewedBatch({
                            batchId: activeBatchId.value,
                            draftIds: submitSummary.value.ids,
                            actorId: 'local-teacher'
                        });
                    submitSummary.value = null;
                    await loadData();
                    await loadBatchImportData();
                    showBatchToast(
                        `已提交 ${result.okCount} 道题，失败 ${result.failedCount} 道。`
                    );

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const deleteBatchImport = async (batchId) => {
                    try {
                    if (!confirm('确定删除这个批量录题任务吗？已入库的正式题目不会受影响。')) return;
                    await draftMaintenanceService.deleteDraftBatch({ batchId });
                    await openBatchList();

                    } catch (error) {
                        showBatchToast(`操作未完成：${error?.code || error?.message || 'storage-failure'}`);
                    }
                };

                const externalTeacherGroups = computed(() => {
                    const teacherMap = new Map();

                    for (const batch of importBatches.value.filter(b => b.importStatus !== 'failed')) {
                        const teacher = batch.sourceTeacher || '外部教师';
                        if (!teacherMap.has(teacher)) {
                            teacherMap.set(teacher, { teacher, batches: [] });
                        }

                        const count = externalQuestions.value.filter(q => q.batchId === batch.id).length;
                        const unprocessedCount = externalQuestions.value.filter(q =>
                            q.batchId === batch.id && (!q.processStatus || q.processStatus === 'unprocessed')
                        ).length;

                        teacherMap.get(teacher).batches.push({ ...batch, count, unprocessedCount });
                    }

                    return [...teacherMap.values()].map(group => ({
                        ...group,
                        batches: group.batches.sort((a, b) => b.importedAt - a.importedAt)
                    }));
                });

                const failedImportBatches = computed(() => importBatches.value
                    .filter(batch => batch.importStatus === 'failed')
                    .sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0)));

                const filteredExternalQuestions = computed(() => {
                    let result = externalQuestions.value;
                    if (activeExternalBatchId.value) result = result.filter(q => q.batchId === activeExternalBatchId.value);
                    if (externalOnlyUnprocessed.value) {
                        result = result.filter(q => !q.processStatus || q.processStatus === 'unprocessed');
                    }
                    result = result.filter(q => window.Qisi.Utils.questionMatchesLibraryFilters(q, {
                        keyword: librarySearchKeyword.value,
                        filters: libraryFilters,
                        hasText
                    }));
                    return [...result].sort((a, b) => {
                        if (a.batchId === b.batchId) return (a.importOrder || 0) - (b.importOrder || 0);
                        return (b.importedAt || 0) - (a.importedAt || 0);
                    });
                });

                const paginatedExternalQuestions = computed(() => filteredExternalQuestions.value.slice(
                    (currentPage.value - 1) * pageSize,
                    currentPage.value * pageSize
                ));

                const externalTotalPages = computed(() => Math.ceil(filteredExternalQuestions.value.length / pageSize) || 1);

                const confirmStatusOptions = [
                    { value: 'all', label: '全部' },
                    { value: 'new', label: '新题' },
                    { value: 'fillable', label: '可补全' },
                    { value: 'existing', label: '已存在' },
                    { value: 'similar', label: '疑似同题' },
                    { value: 'answerConflict', label: '答案冲突' }
                ];

                const confirmStatusCount = (status) => status === 'all'
                    ? confirmItems.value.length
                    : confirmItems.value.filter(item => item.status === status).length;

                const filteredConfirmItems = computed(() => confirmStatusFilter.value === 'all'
                    ? confirmItems.value
                    : confirmItems.value.filter(item => item.status === confirmStatusFilter.value));

                const examWorkspace = Qisi.ExamGroups.createWorkspace({
                    state: examState, getQuestions: () => questions.value,
                    getQuestion: id => { cartQuestionRevision.value; return liveQuestions.byId.get(id); },
                    getLayout: () => ({ template: selectedExamTemplate.value, config: examConfig, title: examTitle.value, mode: exportMode.value }),
                    preferences: safeStorage, typeOrder: EXAM_TYPE_ORDER, defaultGroupConfig: DEFAULT_GROUP_CONFIG, typeLabels: QUESTION_TYPE_LABELS,
                    confirm: message => confirm(message), notify: message => alert(message),
                    onOpen: () => { view.value = 'exam'; isCartOpen.value = false; },
                    observeCart: listener => watch(cart, listener, { deep: true, flush: 'sync' }),
                    observeMeta: listener => watch(examQuestionMeta, listener, { deep: true, flush: 'sync' }),
                    observeGroups: listener => watch(examGroupConfig, listener, { deep: true, flush: 'sync' }),
                    observeQuestions: listener => watch(cartQuestionRevision, listener, { flush: 'sync' }),
                    observeMode: listener => watch(exportMode, listener, { flush: 'sync' }),
                    observeNavigation: listener => watch(view, listener, { flush: 'sync' })
                });
                examWorkspace.attachPointer(Qisi.ExamGroups.createPointerDragPort({ document, window,
                    raf: callback => requestAnimationFrame(callback), caf: id => cancelAnimationFrame(id),
                    later: (callback, delay) => setTimeout(callback, delay), cancelLater: id => clearTimeout(id), afterRender: nextTick, workspace: examWorkspace }));
                Vue.onUnmounted(examWorkspace.dispose);
                const missingCartQuestionIds = computed(examWorkspace.missing);
                const cartQuestionsOrdered = computed(examWorkspace.ordered);

                const templateWorkspace = Qisi.ExamTemplateModel.createWorkspace({
                    state: templateState, repository: storageRepository, preferences: safeStorage,
                    presets: PRESET_TEMPLATES, layoutPresets: EXAM_LAYOUT_PRESETS, defaultKey: DEFAULT_PRESET_KEY, defaultTemplate: DEFAULT_TEMPLATE,
                    ensurePackages: ensureImagePackagesForLatex, notify: message => alert(message),
                    titleChanged: title => { examTitle.value = title || examTitle.value; },
                    observeConfig: listener => watch(examConfig, listener, { deep: true, flush: 'sync' }),
                    observeSelected: listener => watch(selectedExamTemplate, listener, { flush: 'sync' })
                });
                Vue.onUnmounted(templateWorkspace.dispose);
                const getTemplateCard = templateWorkspace.card;

                const allTemplateCards = computed(templateWorkspace.cards);

                const examPresets = computed(templateWorkspace.examPresets);

                const selectedExamPreset = computed(() => examPresets.value[selectedExamTemplate.value] || examPresets.value[DEFAULT_PRESET_KEY]);

                const getExamGroupsForQuestions = examWorkspace.groups;

                const activeExamGroups = computed(() => examWorkspace.groups());

                const templateFeatureOptions = computed(() => {
                    const common = [
                        { key: 'showHeaderFields', label: '显示班级 / 姓名 / 评分' },
                        { key: 'showAnswerGrid', label: '显示选择题答题表' },
                        { key: 'showCornerMarks', label: '显示页面角标' },
                        { key: 'compactMode', label: '紧凑排版，适合题量多' }
                    ];
                    if (selectedExamTemplate.value === 'examZh') {
                        return [
                            { key: 'showSecretMark', label: '显示“绝密 ★ 启用前”' },
                            { key: 'showNotice', label: '显示考试注意事项' },
                            { key: 'showHeaderFields', label: '显示班级 / 姓名 / 考号栏' },
                            { key: 'compactMode', label: '紧凑排版，适合题量多' }
                        ];
                    }
                    return common;
                });

                const getGroupCfg = examWorkspace.groupConfig;

                const syncExamMeta = examWorkspace.syncMeta;

                const syncExamGroups = examWorkspace.syncGroups;

                const openExamBuilder = examWorkspace.open;

                const groupSummaryText = examWorkspace.groupSummary;

                

                

                

                watch(view, (val) => {
                    safeStorage.set('qisi_last_view', val);
                });

                

                watch(externalPickMode, (enabled) => {
                    externalWorkspace.pickModeChanged(enabled);
                });

                let searchTimer = null;
                watch(librarySearchInput, (value) => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => {
                        librarySearchKeyword.value = value || '';
                        currentPage.value = 1;
                    }, 220);
                });

                watch(libraryFilters, () => {
                    currentPage.value = 1;
                }, { deep: true });

                watch(externalOnlyUnprocessed, () => {
                    currentPage.value = 1;
                });

                const switchLibraryKnowledgeMode = (mode) => {
                    libraryKnowledgeMode.value = mode;
                    activeKnowledgeType.value = mode;
                    activeKnowledge.value = null;
                    currentPage.value = 1;
                    if (mode !== 'external') {
                        externalWorkspace.leaveExternal();
                    }
                };

                const handleKnowledgeSelect = (payload) => {
                    const name = typeof payload === 'object' ? payload.name : payload;
                    const type = typeof payload === 'object' ? payload.type : libraryKnowledgeMode.value;
                    activeKnowledge.value = type === 'personal' ? payload?.id || null : name;
                    activeKnowledgeType.value = type || libraryKnowledgeMode.value;
                    currentPage.value = 1;
                };

                const selectKnowledge = (name, type = 'system') => {
                    if (type === 'personal') entryForm.personalKnowledge = name || '';
                    else entryForm.systemKnowledge = name || '';
                    syncEntryLegacyKnowledge();
                    showEntryKnowledge.value = false;
                    showEntryPersonalKnowledge.value = false;
                };

                const mutationEvents = Dexie.on('storagemutated');
                const refreshKnowledgeOnCommit = parts => {
                    if (!parts?.[`idb://${db.name}/personalKnowledge/`]?.d) return;
                    personalWorkspace.reloadTree().then(changed => {
                        if (changed && activeKnowledgeType.value === 'personal' && activeKnowledge.value &&
                            !Qisi.PersonalKnowledgeModel.locateNode(personalKnowledgeTree.value, activeKnowledge.value)) {
                            handleKnowledgeSelect({ type: 'personal' });
                        }
                    }).catch(error => console.warn('知识点更新读取失败', error));
                };
                const librarySyncStale = ref(false);
                const librarySyncRetrying = ref(false);
                const managedQuestions = Qisi.LibrarySnapshot.createQuestionChangeFeed({
                    storage: storageRepository, databaseName: db.name, mutationEvents,
                    replace: liveQuestions.replace, apply: liveQuestions.apply,
                    report: error => console.error('题库更新失败', error),
                    onStale: stale => { librarySyncStale.value = stale; }
                });
                const retryLibrarySync = async () => {
                    librarySyncRetrying.value = true;
                    try { await managedQuestions.refresh(); }
                    catch { /* The sync banner stays visible on failure. */ }
                    finally { librarySyncRetrying.value = false; }
                };
                const invalidateImages = parts => {
                    const range = parts?.[`idb://${db.name}/images/`];
                    if (!range?.d) return;
                    const ids = [], nodes = [range];
                    while (nodes.length) {
                        const node = nodes.pop();
                        if (node.from !== node.to) { storedImages.invalidate(); return; }
                        ids.push(node.from);
                        if (node.l) nodes.push(node.l);
                        if (node.r) nodes.push(node.r);
                    }
                    storedImages.invalidate(ids);
                };
                mutationEvents.subscribe(invalidateImages);
                mutationEvents.subscribe(refreshKnowledgeOnCommit);
                Vue.onUnmounted(() => {
                    managedQuestions.dispose();
                    mutationEvents.unsubscribe(invalidateImages);
                    mutationEvents.unsubscribe(refreshKnowledgeOnCommit);
                });
                const libraryLoader = window.Qisi.LibrarySnapshot.createLibraryLoader({
                    storage: storageRepository,
                    managedQuestions, deferImages: true,
                    draftPersistence: draftPersistenceService,
                    imageResources: window.Qisi.LibraryImageResources,
                    urlPort: {
                        createObjectUrl: blob => URL.createObjectURL(blob),
                        revokeObjectUrl: url => URL.revokeObjectURL(url)
                    },
                    applyOptionSplit,
                    fingerprint: { core: questionCoreFingerprint, stem: questionStemFingerprint },
                    warn: (message, payload) => console.warn(message, payload),
                    publish(snapshot) {
                        const domain = snapshot.domain || 'all';
                        if (['all', 'external', 'banks'].includes(domain)) {
                            externalQuestions.value = snapshot.externalQuestions;
                            importBatches.value = snapshot.importBatches;
                        }
                        if (domain === 'all') {
                            batchImportBatches.value = snapshot.recentTasks;
                            if (snapshot.activeDraft && snapshot.batchId === activeBatchId.value) {
                                batchImportFiles.value = snapshot.activeDraft.files;
                                batchDraftQuestions.value = snapshot.activeDraft.questions;
                                batchDraftImages.value = snapshot.activeDraft.images;
                            }
                            templateWorkspace.acceptLoadedTemplates(snapshot.customTemplates);
                            personalWorkspace.acceptLoadedTree(snapshot.personalKnowledgeTree);
                        }
                    },
                    afterPublish: nextTick
                });
                Vue.onUnmounted(libraryLoader.dispose);
                const loadData = async (domain = 'all') => {
                    try {
                        if (domain === 'library') await libraryLoader.refreshLibrary();
                        else await libraryLoader.refresh(activeBatchId.value);
                    } catch (error) {
                        console.error('题库数据加载失败', error);
                        alert(`题库数据加载失败：${error?.message || error}`);
                    }
                };

                const reviewActions = window.Qisi.ReviewBatchConfirm.createReviewActions({
                    session: reviewSession, workflow: reviewWorkflowService,
                    editor: { prepareDraft: prepareEditorDraft, imagesFor: () => activeDraftPreviewImages.value || [], refreshStats: refreshBatchStats },
                    sourceFor: buildDraftEditorSource, refreshLibrary: () => libraryLoader.refresh(),
                    notify: showBatchToast, reportFailure: message => alert(message), errorText: formalSubmitErrorMessage
                });

                const questionMaintenance = Qisi.LibraryService.createQuestionMaintenance({
                    repository: storageRepository, service: libraryService,
                    tokenize: source => Qisi.Utils.tokenizeLatexSource(source),
                    renderMath: (source, options) => Qisi.Utils.renderLatexFormula(window.katex.renderToString, source, options),
                    refreshLibrary: () => libraryLoader.refreshLibrary(),
                    report(event) {
                        if (event.kind === 'audit') console.table(event.issues);
                        else if (event.kind === 'migration-complete') console.log('[LATEX_MIGRATION][done]', { changedCount: event.changedCount });
                        else console.warn('[LATEX_MIGRATION][incomplete]', event);
                    }
                });
                const auditQuestionLatexData = questionMaintenance.audit;

                const handoutStatus = ref('loading');
                const initHandoutStorage = async () => {
                    handoutStatus.value = 'loading';
                    try {
                        await Qisi.HandoutDocument.migrateStorage(db);
                        await Qisi.HandoutDocument.recoverPending();
                        handoutStatus.value = '';
                    } catch (error) {
                        handoutStatus.value = 'failed';
                        console.warn('[HANDOUT_STORAGE][unavailable]', error);
                    }
                };
                const backupStatus = reactive({});
                const tempCleanup = reactive({ busy: false, message: '' });
                const cleanupTempFiles = async () => {
                    if (tempCleanup.busy || !window.confirm('清理本地服务的闲置上传和转换临时文件？正在使用的文件与题库备份会保留。')) return;
                    tempCleanup.busy = true;
                    tempCleanup.message = '';
                    try {
                        const response = await fetch('/api/maintenance/temp-files/cleanup', {
                            method: 'POST', headers: { 'X-Qisi-Temp-Cleanup': '1' }
                        });
                        if (!response.ok) throw new Error('TEMP_CLEANUP_UNAVAILABLE');
                        const { removed, freedBytes, failed } = await response.json();
                        tempCleanup.message = `已清理 ${removed} 项临时文件，释放 ${(freedBytes / 1024 ** 2).toFixed(1)} MiB。` +
                            (failed ? `有 ${failed} 项未能读取或清理。` : '');
                    } catch (_) { tempCleanup.message = '暂时无法清理临时文件，请重启本地服务后重试。'; }
                    finally { tempCleanup.busy = false; }
                };
                const backupWorkspace = Qisi.BackupWorkspace.createBackupWorkspace({
                    database: db, backup: Qisi.Backup, repository: storageRepository,
                    handoutsReady: () => handoutStatus.value === '',
                    supported: typeof window.showDirectoryPicker === 'function',
                    mutationEvents,
                    pickDirectory: options => window.showDirectoryPicker(options),
                    loadFolder: async () => (await db.table('localSettings').get('backup-folder'))?.value,
                    saveFolder: value => storageRepository.put('localSettings', { id: 'backup-folder', value: structuredClone(value) }),
                    withFileLock: work => navigator.locks.request('qisi-backup-files', work),
                    recordReport: (_time, report) => safeStorage.setJson('qisi_last_full_backup_report', report),
                    onRestored: (_settingsIncluded, handoutsIncluded) => {
                        if (handoutsIncluded) Qisi.HandoutDocument.discardPending();
                        window.location.reload();
                    }
                }, backupStatus);
                Vue.onUnmounted(backupWorkspace.dispose);

                const downloadQuestionMetadataBackup = async () => {
                    const storedQuestions = await db.questions.toArray();
                    const payload = {
                        exportedAt: new Date().toISOString(),
                        questions: storedQuestions
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                        type: 'application/json'
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `qisi-question-backup-${Date.now()}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                };

                const migrateSafeQuestionLatexData = questionMaintenance.migrate;

                window.auditQuestionLatexData = auditQuestionLatexData;
                window.downloadQuestionMetadataBackup = downloadQuestionMetadataBackup;
                window.exportFullQisiBackup = async () => {
                    const result =
                        await Qisi.Backup.exportFullDatabaseBackup(db);

                    console.log('[QISI_BACKUP][export-result]', result);

                    return result;
                };
                window.getLastFullBackupReport = () =>
                    Qisi.Backup.getLastFullBackupReport();
                window.runStage0SafetyCheck = async () => {
                    const tableNames = db.tables.map(table => table.name);
                    const requiredTables = [
                        'questions',
                        'images',
                        'draftImportBatches',
                        'draftImportFiles',
                        'draftQuestions',
                        'draftImages'
                    ];
                    const missingTables = requiredTables.filter(
                        name => !tableNames.includes(name)
                    );
                    const counts = {};

                    for (const name of requiredTables) {
                        if (!tableNames.includes(name)) continue;
                        counts[name] = await db.table(name).count();
                    }

                    const backupReport =
                        Qisi.Backup.getLastFullBackupReport();

                    const report = {
                        ok:
                            missingTables.length === 0 &&
                            Boolean(backupReport?.ok),
                        checkedAt: new Date().toISOString(),
                        missingTables,
                        counts,
                        runtime: {
                            hasQisi: Boolean(window.Qisi),
                            hasRuntime: Boolean(window.Qisi?.Runtime),
                            hasBackup: Boolean(window.Qisi?.Backup)
                        },
                        backupReport
                    };

                    console.group('[QISI_STAGE0][safety-check]');
                    console.log(report);
                    console.table(
                        Object.entries(counts).map(([table, count]) => ({
                            table,
                            count
                        }))
                    );
                    console.groupEnd();

                    return report;
                };
                window.migrateSafeQuestionLatexData = migrateSafeQuestionLatexData;

                const externalModel = Qisi.LibraryService.createExternalQuestionModel({
                    coreFingerprint: questionCoreFingerprint, stemFingerprint: questionStemFingerprint,
                    getIndexes: () => { libraryRevision.value; return liveQuestions; },
                    getKnowledge: getQuestionKnowledge, hasText, sameText: sameTextLoose
                });
                const externalPackages = Qisi.ExportService.createPackageService({
                    loadArchive: file => Qisi.ArchiveSecurity.openBlob(file, 'question-bank'),
                    listImportBatches: () => storageRepository.listTable('importBatches'),
                    coreFingerprint: questionCoreFingerprint, stemFingerprint: questionStemFingerprint
                });
                const externalWorkspace = Qisi.LibraryExternalMerge.createWorkspace({
                    state: externalState, library: libraryService, packages: externalPackages, model: externalModel,
                    repository: storageRepository,
                    read: { questionById: id => liveQuestions.byId.get(id), externalQuestions: () => externalQuestions.value,
                        pagedExternalQuestions: () => paginatedExternalQuestions.value, importBatches: () => importBatches.value },
                    refresh: { external: () => libraryLoader.refreshExternal(), banks: () => libraryLoader.refreshQuestionBanks() },
                    notify: message => alert(message), confirm: message => confirm(message),
                    defaultAction: defaultActionForExternalStatus,
                    observeNavigation: listener => watch([view, libraryKnowledgeMode, activeExternalBatchId], listener, { flush: 'sync' }),
                    navigate(destination) {
                        if (destination === 'confirm') { view.value = 'externalConfirm'; return; }
                        view.value = 'library'; libraryKnowledgeMode.value = 'external';
                        if (destination === 'imported') {
                            activeKnowledge.value = null; activeKnowledgeType.value = 'external'; currentPage.value = 1;
                        }
                    }
                });
                Vue.onUnmounted(externalWorkspace.dispose);
                const getExternalMatchInfo = externalModel.getMatchInfo;

                const getExternalStatus = (extQ) => getExternalMatchInfo(extQ).status;

                const exportQuestionBankPackage = async () => {
                    try {
                        let teacherName = safeStorage.get('qisi_teacher_name', '');
                        if (!teacherName) {
                            teacherName = prompt('请输入导出教师姓名，用于对方按来源分类', '我的题库') || '我的题库';
                            safeStorage.set('qisi_teacher_name', teacherName);
                        }

                        const allQuestions = (
                            await storageRepository.loadLibrary()
                        ).reverse();
                        const plan = await exportService.build(
                            allQuestions.map(toRaw),
                            { teacherName }
                        );
                        if (plan.missingImageIds.length) throw new Error('题库缺少图片数据，请补回图片后导出：' + plan.missingImageIds.join('、'));
                        const blob = await Qisi.ExportService.writeQuestionBank(plan, Qisi.ArchiveSecurity);
                        downloadBlob(blob, plan.filename);
                    } catch (error) {
                        console.error('导出题库数据失败', error);
                        alert(`导出题库数据失败：${error?.message || error}`);
                    }
                };

                const openImportBankPicker = () => {
                    importBankInput.value?.click();
                };

                const handleImportBankFileChange = externalWorkspace.handleFileChange;

                

                const previewQuestionBankPackage = externalWorkspace.preview;

                const cancelImportPreview = externalWorkspace.cancelPreview;

                const confirmImportBankPreview = externalWorkspace.confirmImport;

                

                const toggleExternalPick = externalWorkspace.togglePick;

                const clearExternalSelection = externalWorkspace.clearSelection;

                const selectAllExternalOnPage = externalWorkspace.selectAllOnPage;

                const openExternalConfirmPage = externalWorkspace.openConfirm;

                const applyBatchKnowledge = externalWorkspace.applyBatchKnowledge;

                

                

                const confirmAddExternalToPersonal = externalWorkspace.commit;

                const undoLatestExternalMerge = externalWorkspace.undo;

                const deleteExternalBatch = externalWorkspace.deleteBatch;

                const recalculateExternalBatchStatus = externalWorkspace.recalculate;

                onMounted(async () => {
                    try {
                        await db.open();
                        if (databaseStatus.value === 'blocked') databaseStatus.value = 'opening';
                        await initHandoutStorage();
                        await backupWorkspace.start();
                        try {
                            if (navigator.storage?.persist) await navigator.storage.persist();
                        } catch (error) {
                            console.warn('持久化存储权限申请被跳过', error);
                        }
                        await loadData();
                        examWorkspace.restore();
                        templateWorkspace.restore();
                        await manualWorkspace.restore();
                        templateWorkspace.restoreEditor();
                        syncExamGroups();
                        const savedView = safeStorage.get('qisi_last_view');
                        if (['entry', 'batchImport', 'library', 'exam', 'personal', 'template'].includes(savedView)) view.value = savedView;
                        if (databaseStatus.value === 'opening') databaseStatus.value = '';
                    } catch (error) {
                        if (databaseStatus.value !== 'outdated') databaseStatus.value = 'failed';
                        console.error('题库数据库打开失败', error);
                    }
                });

                

                

                

                

                const handleDrop = (e) => { isDraggingImg.value = false; if (e.dataTransfer.files[0]) handleEntryImgUpload(e.dataTransfer.files[0]); };
                const handleFileChange = (e) => { if (e.target.files[0]) handleEntryImgUpload(e.target.files[0]); e.target.value = null; };
                const handleOcrDrop = (e) => { isDraggingOcr.value = false; if (e.dataTransfer.files[0]) handleOcrFile(e.dataTransfer.files[0]); };
                
                const manualWorkspace = Qisi.ManualEntryModel.createWorkspace({
                    state: manualState, library: libraryService, repository: storageRepository,
                    imagePort: Qisi.ManualEntryModel.createImagePort({ FileReader, fetch: value => fetch(value) }),
                    preferences: { read: () => safeStorage.json('qisi_draft_v2', null),
                        save: value => safeStorage.setJson('qisi_draft_v2', value), remove: () => safeStorage.remove('qisi_draft_v2') },
                    splitQuestion: splitQuestionForStorage, refreshLibrary: () => libraryLoader.refreshLibrary(),
                    resolvePersonalKnowledge: name => Qisi.PersonalKnowledgeModel.knowledgeIndex(flatPersonalKnowledge.value).unique(name)?.id,
                    notify: message => alert(message),
                    observeForm: listener => watch(entryForm, listener, { deep: true, flush: 'sync' }),
                    observeNavigation: listener => watch(view, listener, { flush: 'sync' }),
                    onSaved() { activeKnowledge.value = null; currentPage.value = 1; view.value = 'library'; }
                });
                Vue.onUnmounted(manualWorkspace.dispose);
                const handleEntryImgUpload = manualWorkspace.upload;

                const handleEntryPaste = manualWorkspace.paste;

                const handleOcrChange = async (e) => {
                    const file = e.target.files[0]; 
                    if (!file) return; 
                    handleOcrFile(file); 
                    e.target.value = null;
                };

                const handleOcrFile = async (file) => {
                    ocrLoading.value = true;
                    const reader = new FileReader(); 
                    reader.onload = async () => {
                        try {
                            const content = await qwenDocumentOcrSource
                                .recognizeManualQuestion(reader.result);
                            const normalizedText = normalizeOcrQuestionOutput(content);
                            ocrDraftStore.rawText = normalizedText;
                        } catch (e) { console.error('识别失败', e); alert("识别失败"); } 
                        ocrLoading.value = false;
                    }; 
                    reader.onerror = () => {
                        ocrLoading.value = false;
                        alert('图片读取失败');
                    };
                    reader.readAsDataURL(file);
                };

                // 两次点击之间隔着一个 await，按钮本身不会自己变灰。
                // 没有这个互斥，手快双击就会存出两道一模一样的题。
                

                const submitQuestion = manualWorkspace.submit;

                const toggleCart = examWorkspace.toggle;
                const moveCartQuestion = examWorkspace.move;
                const examDisplayIndex = examWorkspace.displayIndex;

                const reorderQuestionWithinType = examWorkspace.reorder;

                
                const startExamPointerDrag = examWorkspace.startPointer;
                const dropExamQuestion = examWorkspace.drop;
                const resetExamOrder = examWorkspace.reset;
                const clearCart = examWorkspace.clear;
                const deleteQuestion = async (id) => {
                    await libraryService.softDelete(id);
                    await loadData('library');
                    examWorkspace.remove(id);
                };
                
                const saveEditedQuestion = async (id, stem, imgs, g, t, d, ans, sol, tagsStr, opts, knowledge, systemKnowledgeArg = '', personalKnowledgeArg = '', sourceVersion, knowledgeEdits = {}) => {
                    const { personal: personalKnowledgeEdit, systemId } = knowledgeEdits;
                    const q = liveQuestions.byId.get(id);
                    if (!q && sourceVersion !== undefined) throw new Error('这道题已从题库移除。');
                    if(q) {
                        const expectedUpdatedAt = sourceVersion === undefined ? (q.updatedAt ?? null) : sourceVersion;
                        const next = JSON.parse(JSON.stringify(toRaw(q)));
                        const now = Date.now();
                        const imageRecords = [];
                        for (const img of imgs || []) {
                            if (img?.url && img.url.startsWith('data:')) {
                                const blob = await (await fetch(img.url)).blob();
                                const existingImage = await storageRepository.get('images', img.id);
                                imageRecords.push({
                                    ...(existingImage || {}), id: img.id, blob,
                                    createdAt: existingImage?.createdAt ?? now
                                });
                            }
                        }
                        next.stem = stem;
                        next.images = (imgs || []).filter(i => i && i.id).map(Qisi.QuestionImagePolicy.imageReference);
                        next.type = t; next.answer = ans; next.solution = sol; next.options = opts;
                        next.grade = g; next.diff = d;
                        const systemKnowledge = systemKnowledgeArg || '';
                        const personalKnowledge = personalKnowledgeArg || '';
                        const savedSystem = getQuestionKnowledge(q, 'system');
                        const legacyKnowledge = systemId === '' && knowledge === savedSystem ? '' : knowledge;
                        const primaryKnowledge = personalKnowledge || systemKnowledge || legacyKnowledge || '';
                        const primaryKnowledgeType = personalKnowledge ? 'personal' : 'system';
                        next.meta ||= {};
                        next.knowledge = next.meta.knowledge = primaryKnowledge;
                        next.knowledgeType = next.meta.knowledgeType = primaryKnowledgeType;
                        next.systemKnowledge = systemKnowledge;
                        next.meta.systemKnowledge = systemKnowledge;
                        if (systemId) {
                            next.systemKnowledgeId = next.meta.systemKnowledgeId = systemId;
                        } else if (systemId === '' || systemKnowledge !== savedSystem) {
                            delete next.systemKnowledgeId;
                            delete next.meta.systemKnowledgeId;
                        }
                        next.personalKnowledge = next.meta.personalKnowledge = personalKnowledge;
                        if (!personalKnowledgeEdit && personalKnowledge !== getQuestionKnowledge(q, 'personal')) {
                            const node = Qisi.PersonalKnowledgeModel.knowledgeIndex(flatPersonalKnowledge.value).unique(personalKnowledge);
                            next.personalKnowledgeIds = next.meta.personalKnowledgeIds = node ? [node.id] : [];
                        }
                        next.meta.grade = g; next.meta.diff = d; next.meta.tags = String(tagsStr || '').split(',').filter(x => x.trim());
                        next.userEdited = true;
                        next.updatedAt = now;
                        await libraryService.replaceQuestion(next, {
                            expectedUpdatedAt,
                            imageRecords,
                            personalKnowledgeEdit: personalKnowledgeEdit && {
                                ...personalKnowledgeEdit,
                                legacyKnowledge,
                                newId: personalKnowledgeEdit.id || !personalKnowledgeEdit.name.trim()
                                    ? undefined : 'pk_' + crypto.randomUUID()
                            }
                        });
                    }
                    await loadData(q ? 'library' : 'all');
                };

                const installLatexDisplayNormalizer = () => {
                    if (!LatexPreview?.computed?.htmlContent || LatexPreview.__qisiDisplayLatexNormalizerInstalled) return;
                    const originalHtmlContent = LatexPreview.computed.htmlContent;
                    LatexPreview.computed.htmlContent = function () {
                        return originalHtmlContent.call({
                            // Vue component instances expose computed properties through accessors.
                            // Spreading the instance reads htmlContent again and recurses.
                            questionType: this.questionType,
                            flowOptions: this.flowOptions,
                            content: window.Qisi.Utils.normalizeBareLatexForDisplayText(this.content),
                            options: window.Qisi.Utils.normalizeBareLatexForDisplayOptions(this.options),
                            images: this.images || [],
                            displayImages: this.displayImages,
                            preserveLineBreaks: this.preserveLineBreaks
                        });
                    };
                    LatexPreview.__qisiDisplayLatexNormalizerInstalled = true;
                };

                window.__qisiLatexDisplayNormalizeSelfTest = function () {
                    const cases = [
                        {
                            name: 'bare-frac-sqrt-pi',
                            input: '\\frac{1330鈭?}{3}蟺',
                            expected: '$\\frac{1330\\sqrt{2}}{3}\\pi$'
                        },
                        {
                            name: 'mixed-chinese-bare-frac',
                            input: '表面积为 \\frac{1330鈭?}{3}蟺',
                            expected: '表面积为 $\\frac{1330\\sqrt{2}}{3}\\pi$'
                        },
                        {
                            name: 'already-wrapped',
                            input: '已有 $\\frac{1}{2}$ 不重复',
                            expected: '已有 $\\frac{1}{2}$ 不重复'
                        },
                        {
                            name: 'plain-number-pi',
                            input: '292蟺',
                            expected: '$292\\pi$'
                        },
                        {
                            name: 'sqrt-glyph-safe',
                            input: 'A. 表面积为 12鈭?',
                            expected: 'A. 表面积为 $12\\sqrt{2}$'
                        },
                        {
                            name: 'multiple-options',
                            input: 'A. 1\nB. \\frac{1330鈭?}{3}蟺\nC. $\\frac{1}{2}$',
                            expected: 'A. 1\nB. $\\frac{1330\\sqrt{2}}{3}\\pi$\nC. $\\frac{1}{2}$'
                        }
                    ];

                    const results = cases.map(testCase => {
                        const actual = window.Qisi.Utils.normalizeBareLatexForDisplayText(testCase.input);
                        return {
                            ...testCase,
                            actual,
                            ok: actual === testCase.expected
                        };
                    });

                    const ok = results.every(result => result.ok);
                    console.table(results.map(({ name, ok, input, expected, actual }) => ({ name, ok, input, expected, actual })));
                    return { ok, results };
                };

                const paperDocumentBuilder = Qisi.ExamPaperParts.createDocumentBuilder({
                    prepareSource: Qisi.HandoutFormulaGate.preparePrintSource, normalizeMath: Qisi.HandoutFormulaGate.normalizeForKatex,
                    tokenize: Qisi.Utils.tokenizeLatexSource, displayImageUrl: Qisi.QuestionImagePolicy.displayImageUrl,
                    renderMath: (expression, options) => { if (!window.katex) throw new Error('KaTeX 尚未加载'); return Qisi.Utils.renderLatexFormula(window.katex.renderToString, expression, options); },
                    groupQuestions: Qisi.ExamGroups.groupQuestions, typeOrder: EXAM_TYPE_ORDER, defaultGroupConfig: DEFAULT_GROUP_CONFIG,
                    typeLabels: QUESTION_TYPE_LABELS, sectionNumbers: CHINESE_SECTION_NUMBERS, warn: (event, details) => console.warn(event, details)
                });

                

                

                

                

                

                

                

                

                

                

                

                

                

                

                // 打印窗口里的字体栈与字号档位。
                // 全部用 Windows 自带字体的名字，老师电脑上一定装得到，
                // 不会出现「选了楷体结果印成默认宋体」。
                
                

                const printOutput = Qisi.PrintResources.createOutputWorkspace({
                    ...Qisi.PrintResources.createBrowserPort({ document, window, URL, Blob, BroadcastChannel, crypto }), escapeHtml: Qisi.ExamPaperParts.escapeHtml
                });
                const printWorkspace = Qisi.PrintResources.createPrintWorkspace({
                    busy: printBusy, capture: examWorkspace.snapshot,
                    loadImageRows: ids => storageRepository.loadImageRecords(ids), imagePort: Qisi.PrintResources.createBlobEncoder({ FileReader }),
                    validateFormulas: Qisi.HandoutFormulaGate.confirmBeforeExport, builder: paperDocumentBuilder,
                    output: printOutput, notify: message => alert(message)
                });
                Vue.onUnmounted(printWorkspace.dispose);

                const printExam = printWorkspace.print;

                const finishExamBuild = printWorkspace.print;

                const selectTemplateCard = templateWorkspace.selectCard;
                const selectPresetTemplate = templateWorkspace.selectPreset;
                const selectCustomTemplate = templateWorkspace.selectCustom;
                const triggerNewCustomTemplate = templateWorkspace.startNew;
                const handleCodeInput = templateWorkspace.inputCode;
                
                const saveNewCustomTemplate = templateWorkspace.saveNew;
                
                const updateExistingCustomTemplate = templateWorkspace.update;
                
                const deleteCustomTemplate = templateWorkspace.remove;

                const personalWorkspace = Qisi.PersonalKnowledgeModel.createWorkspace({
                    state: personalState, repository: storageRepository,
                    prompt: (label, value) => prompt(label, value), confirm: message => confirm(message), notify: message => alert(message),
                    countTree: Qisi.UiEvents.buildKnowledgeCounts, getKnowledge: getQuestionKnowledge
                });
                Vue.onUnmounted(personalWorkspace.dispose);

                const personalTreeRows = computed(() =>
                    window.Qisi.PersonalKnowledgeModel.flattenRows(personalKnowledgeTree.value)
                );

                const togglePersonalExpanded = personalWorkspace.toggle;

                const addPersonalChild = personalWorkspace.addChild;

                const deletePersonalRow = personalWorkspace.removeRow;

                const createPersonalL1 = personalWorkspace.create1;

                const createPersonalL2 = personalWorkspace.create2;

                const createPersonalL3 = personalWorkspace.create3;

                const renamePersonalNode = personalWorkspace.rename;

                const deletePersonalNode = personalWorkspace.remove;

                if (typeof window !== 'undefined') {
                    Object.assign(window, {
                        cleanDisplayTextForBatchSave,
                        cleanDisplayOptionsForBatchSave,
                        countValidOptions
                    });
                    Object.defineProperty(window, 'activeDraftPreviewImages', {
                        configurable: true,
                        get: () => activeDraftPreviewImages.value
                    });
                }

                installLatexDisplayNormalizer();

                return {
                    videoCropFigure: input => reviewImageCommands.crop({ ...input, token: reviewImageCommands.captureCrop(input.source) }),
                    videoRecognizeCrop: async (dataUrl, signal, withFigures) => {
                        if (withFigures) {
                            try {
                                const result = await qwenDocumentOcrSource.recognizeEntryCrop(dataUrl, signal);
                                return { ...result, text: normalizeOcrQuestionOutput(result.text) };
                            } catch (error) {
                                if (signal.aborted || error.status === 401 || error.status === 403) throw error;
                            }
                        }
                        return normalizeOcrQuestionOutput(await qwenDocumentOcrSource.recognizeManualQuestion(dataUrl, signal, { crop: true }));
                    },
                    videoCropEntryFigure: (source, bbox) => cropDataUrlByBbox(source, bbox, 3, { normalized: true }),
                    videoApplyEntryRecognition: manualWorkspace.applyRecognition,
                    videoUploadCrop: file => manualWorkspace.upload(file),
                    backupWorkspace, backupStatus, view, questions, filteredQuestions, libraryPage, cart, currentPage, databaseStatus,
                    handoutStatus, initHandoutStorage,
                    tempCleanup, cleanupTempFiles,
                    librarySyncStale, librarySyncRetrying, retryLibrarySync,
                    reloadDatabasePage: () => window.location.reload(),
                    totalPages: computed(() => libraryPage.value.totalPages),
                    paginatedQuestions: computed(() => libraryPage.value.items),
                    externalQuestions, importBatches, externalTeacherGroups, failedImportBatches, activeExternalBatchId, filteredExternalQuestions, paginatedExternalQuestions, externalTotalPages,
                    externalPickMode, selectedExternalIds, toggleExternalPick, clearExternalSelection, selectAllExternalOnPage, openExternalConfirmPage, externalOnlyUnprocessed,
                    confirmItems, filteredConfirmItems, confirmStatusFilter, confirmStatusOptions, confirmStatusCount, batchPersonalKnowledge, batchSystemKnowledge, flatSystemKnowledge, flatPersonalKnowledge, flatKnowledge, applyBatchKnowledge, confirmAddExternalToPersonal,
                    importBankInput, openImportBankPicker, handleImportBankFileChange, pendingImportPreview, cancelImportPreview, confirmImportBankPreview, exportQuestionBankPackage,
                    undoLatestExternalMerge, deleteExternalBatch, recalculateExternalBatchStatus,
                    batchImportMode, batchImportBatches, recentBatchImportBatches, batchImportFiles, batchDraftQuestions, filteredDraftQuestions, batchDraftImages, batchImportFilter, activeBatchId, activeBatch, activeDraftQuestionId, activeDraftQuestion, batchRecognitionSummary, activeDraftEditorBuffer, activeDraftEditorOriginal, activeDraftSourceLabel, activeDraftEditorDirty, activeDraftEditorPreview, activeDraftEditorTextarea, activeDraftImages, activeDraftRealQuestionImages, activeDraftSourcePageImages, activeDraftPreviewImages, unassignedDraftImages, activeDraftTab, batchUploadInput, isDraggingBatchFiles, batchToast, unassignedImageModal, imagePositionMenuId, cropModalOpen, cropImageRef, cropState, cropSelectionStyle, pendingPurposeFile, pendingPurposeRoles, batchCreateFiles, batchCreateTypeHint, batchCreateWarning, batchExpectedQuestionCount, batchDefaultMeta, unmatchedAnswers, submitSummary, batchSubmitBusy,
                    openBatchCreate, openBatchList, clearBatchDraftWorkspace, openBatchFilePicker, handleBatchFileChange, handleBatchDrop, handleBatchHomeDrop, togglePurposeRole, confirmBatchFilePurpose, cancelBatchFilePurpose, editBatchFilePurpose, removeBatchCreateFile, createDraftImportBatch, runBatchRecognition, cancelBatchRecognition, rerunActiveBatchRecognition, dedupeActiveBatchDraftsNow, openBatchReview, selectDraftQuestion, updateDraftQuestionField, saveActiveDraftQuestion, markDraftReviewed, submitDraftQuestion, reviewCurrentDraft, submitReviewedDraft, selectedDraftIds, draftMetaExpanded, toggleDraftSelection, selectAllDrafts, confirmSelectedDrafts, openBatchSubmitSummary, submitSelectedDrafts, confirmBatchSubmit, deleteBatchImport, validatePageRange, batchStatusText, draftQuestionStatusText, roleLabel, rolesLabel, fileTypeText, formatFileSize, draftQuestionProblems, confirmDraftImages, deleteDraftImage, toggleImagePositionMenu, copyDraftImagePlacementLatex, openSourcePageCrop, openPdfSource, closeCropModal, resetCropState, startManualCrop, moveManualCrop, endManualCrop, saveManualCropToDraft, bindUnassignedImage, deleteUnassignedImage, showUnmatchedAnswerList, showActiveRawText, showCropNotice, cleanupActiveBatchDisplayPollution, markActiveDraftUserEdited, choosePdfCandidate, pdfDraftMeta, activePdfReviewPanel, activePdfUnassigned, insertDraftEditorText, discardActiveDraftEditorChanges,
                    handleBatchPastedFiles, batchFileQueueBusy,
                    syncActiveDraftEditorFromQuestion: () => reviewSession.syncCurrent(buildDraftEditorSource),
                    librarySearchInput, libraryFilters, resetLibraryFilters,
                    getExternalStatus, externalStatusLabel, externalStatusClass, actionLabel,
                    cartQuestions: cartQuestionsOrdered,
                    missingCartQuestionIds, cartQuestionsOrdered, activeExamGroups, examQuestionMeta, examGroupConfig, selectedExamTemplate, examConfig, examPresets, selectedExamPreset, templateFeatureOptions, printBusy, moveCartQuestion, examDisplayIndex, startExamPointerDrag, dropExamQuestion, draggingExamQuestionId, dragOverExamQuestionId, resetExamOrder, groupSummaryText, syncExamGroups, openExamBuilder, finishExamBuild,
                    entryForm, entryTab, entryPreviewStem, entryPreviewOptions, entryPreviewType: computed(() => entryParsedQuestion.value.type), isDraggingImg, isDraggingOcr, ocrDraftStore, ocrLoading, examTitle, exportMode, latexTemplate,
                    presets: PRESET_TEMPLATES, allTemplateCards, customTemplates, currentPresetKey, editMode, editTplName, 
                    knowledgeTree, personalKnowledgeTree, personalTreeRows, activeKnowledge, activeKnowledgeType, libraryKnowledgeMode, activeKnowledgeTree, activeKnowledgeCounts, knowledgeCounts, personalKnowledgeCounts, handleKnowledgeSelect, switchLibraryKnowledgeMode, isCartOpen, cartPanelAvailable, showEntryKnowledge, showEntryPersonalKnowledge, hoverL1, hoverPersonalL1,
                    personalL1Name, personalL2Name, personalL3Name, selectedPersonalL1Id, selectedPersonalL2Id,
                    createPersonalL1, createPersonalL2, createPersonalL3, ensurePersonalKnowledgeTag: personalWorkspace.ensureTag, ensurePersonalKnowledgeTags: personalWorkspace.ensureTags, togglePersonalExpanded, addPersonalChild, deletePersonalRow, renamePersonalNode, deletePersonalNode,
                    handleDrop, handleFileChange, handleEntryPaste, handleOcrDrop, handleOcrChange, submitQuestion, toggleCart, clearCart, deleteQuestion, saveEditedQuestion, printExam,
                    assignOcr: field => {
                        const area = document.querySelector('textarea[placeholder="识别文本结果..."]');
                        const selected = area && area.selectionStart !== area.selectionEnd
                            ? area.value.substring(area.selectionStart, area.selectionEnd) : ocrDraftStore.rawText;
                        manualWorkspace.appendText(field, selected);
                    },
                    selectPresetTemplate, selectCustomTemplate, selectTemplateCard, triggerNewCustomTemplate, handleCodeInput, saveNewCustomTemplate, updateExistingCustomTemplate, deleteCustomTemplate,
                    setGlobalTemplate: templateWorkspace.setGlobal,
                    changeEntryAlign: manualWorkspace.alignImage,
                    removeEntryImage: manualWorkspace.removeImage,
                    selectKnowledge,
                    copyMainSnippet: async id => {
                        const snippet = manualWorkspace.snippet(id);
                        if (!snippet) return;
                        const ok = await copyText(snippet);
                        alert(ok ? 'LaTeX 短码已复制！配图选行内浮动时，请将短码置于文字内部！' : '复制失败，请手动复制短码。');
                    }
                };
            },
            template: '#app-tpl'
        };

                const app = createApp(App);
                root.Qisi.FigureEditor?.install(app);
                if (Qisi.VideoWorkspace) Qisi.VideoWorkspace.install(app);
                app.config.errorHandler = (error, instance, info) => {
                    console.error('Vue 运行错误已捕获', { error, info, instance });
                };
                window.addEventListener('error', (event) => {
                    console.error('全局运行错误已捕获', event.error || event.message);
                });
                window.addEventListener('unhandledrejection', (event) => {
                    console.error('未处理的异步错误已捕获', event.reason);
                    event.preventDefault();
                });
                app.component('icon', Icon);
                app.component('latex-preview', LatexPreview);
                app.component('knowledge-tree', KnowledgeTree);
                app.component('question-card', QuestionCard);
                Qisi.PersonalKnowledgeModel?.install(app);

                try {
                    const scroller = window.VueVirtualScroller || window['vue-virtual-scroller'] || window['VueVirtualScroller'];
                    if (scroller && scroller.RecycleScroller) {
                        app.component('RecycleScroller', scroller.RecycleScroller);
                        app.component('DynamicScroller', scroller.DynamicScroller);
                        app.component('DynamicScrollerItem', scroller.DynamicScrollerItem);
                    }
                } catch (error) {
                    console.warn("虚拟列表加载被安全跳过", error);
                }

                const appProxy =
                    app.mount('#app');

                Qisi.Runtime.setRuntimeDependency(
                    'AppProxy',
                    appProxy
                );

                console.log('[QISI_RUNTIME][booted]', {
                    build: 'foundation-01'
                });

                return app;



});
