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
                    validateDraft: draft => validateDraftForReview(draft),
                    formalFields: Qisi.FormalAdmissionPolicy.FORMAL_FIELDS
                });
                const exportService = Qisi.ExportService.createExportService({
                    coreFingerprint: questionCoreFingerprint,
                    stemFingerprint: questionStemFingerprint,
                    resolveImages: ids =>
                        storageRepository.loadImageRecords(ids)
                });
                const view = ref('entry'); 
                const questions = ref([]);
                const cart = ref([]);
                const currentPage = ref(1);
                const pageSize = 10;
                const externalQuestions = ref([]);
                const importBatches = ref([]);
                const activeExternalBatchId = ref(null);
                const externalPickMode = ref(false);
                const selectedExternalIds = ref([]);
                const confirmItems = ref([]);
                const confirmStatusFilter = ref('all');
                const batchPersonalKnowledge = ref('');
                const batchSystemKnowledge = ref('');
                const importBankInput = ref(null);
                const pendingImportPreview = ref(null);
                const externalOnlyUnprocessed = ref(false);
                const librarySearchInput = ref('');
                const librarySearchKeyword = ref('');
                const libraryFilters = reactive({ type: '', diff: '', grade: '', answerState: '', imageState: '' });
                const coreFingerprintMap = ref(new Map());
                const stemFingerprintMap = ref(new Map());
                const examTitle = ref('高中数学期末模拟测试');
                const exportMode = ref(safeStorage.get('qisi_export_mode', 'questions') || 'questions');
                const selectedExamTemplate = ref(DEFAULT_PRESET_KEY);
                const examConfig = reactive({ ...EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY].config });
                const examQuestionMeta = reactive({});
                const examGroupConfig = reactive({});
                const draggingExamQuestionId = ref('');
                const dragOverExamQuestionId = ref('');
                const restoringExamConfig = ref(false);
                const ocrLoading = ref(false);
                const printBusy = ref(false);
                const isDraggingImg = ref(false);
                const isDraggingOcr = ref(false);
                const isCartOpen = ref(false);
                const objectUrls = new Set();
                const docxEmbeddedImageCache = new Map();
                const draftFileTextCache = new Map();
                const draftFileXmlCache = new Map();
                const draftFileRidImageUrlMapCache = new Map();
                const draftFileRidImageMetaMapCache = new Map();
                const batchImportMode = ref('list');
                const batchImportBatches = ref([]);
                const batchImportFiles = ref([]);
                const batchDraftQuestions = ref([]);
                const batchDraftImages = ref([]);
                const batchImportFilter = ref('all');
                const activeBatchId = ref('');
                const activeDraftQuestionId = ref('');
                const activeDraftTab = ref('stem');
                const batchUploadInput = ref(null);
                const isDraggingBatchFiles = ref(false);
                const batchToast = ref('');
                const unassignedImageModal = ref(false);
                const imagePositionMenuId = ref('');
                const activeDraftEditorBuffer = ref('');
                const activeDraftEditorOriginal = ref('');
                const activeDraftEditorOriginalFields = ref({});
                const activeDraftEditorQuestionId = ref('');
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
                const batchExpectedQuestionCount = ref(0);
                const unmatchedAnswers = ref([]);
                const submitSummary = ref(null);
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
                
                const entryForm = reactive({ grade: '高一', diff: '中等', type: '解答题', knowledge: '', knowledgeType: 'system', systemKnowledge: '', personalKnowledge: '', tags: '', stem: '', options: ['', '', '', ''], answer: '', solution: '', images: [] });
                const entryTab = ref('stem');
                const showEntryKnowledge = ref(false);
                const showEntryPersonalKnowledge = ref(false);
                const hoverL1 = ref(null);
                const hoverPersonalL1 = ref(null);
                
                const ocrDraftStore = reactive({ rawText: '' });

                const customTemplates = ref([]);
                const templateOverrides = ref(safeStorage.json('qisi_template_overrides', {}) || {});
                const latexTemplate = ref(safeStorage.get('qisi_template', DEFAULT_TEMPLATE) || DEFAULT_TEMPLATE);
                const editMode = ref('system'); 
                const currentPresetKey = ref('');
                const editTplName = ref('');
                
                const knowledgeTree = reactive(MATH_KNOWLEDGE_TREE);
                const personalKnowledgeTree = ref([]);
                const personalL1Name = ref('');
                const personalL2Name = ref('');
                const personalL3Name = ref('');
                const selectedPersonalL1Id = ref('');
                const selectedPersonalL2Id = ref('');
                const cartPanelAvailable = computed(() => view.value === 'library' || view.value === 'exam');
                const entryParsedQuestion = computed(() => splitQuestionForStorage(entryForm.stem, entryForm.type, entryForm.options));
                const entryPreviewStem = computed(() => entryParsedQuestion.value.stem || entryForm.stem);
                const entryPreviewOptions = computed(() => entryParsedQuestion.value.options || []);
                
                const activeKnowledge = ref(null);
                const activeKnowledgeType = ref('system');
                const libraryKnowledgeMode = ref('system');

                const syncEntryLegacyKnowledge = () => {
                    entryForm.knowledge = entryForm.personalKnowledge || entryForm.systemKnowledge || '';
                    entryForm.knowledgeType = entryForm.personalKnowledge ? 'personal' : 'system';
                };

                const buildQuestionFingerprintMaps = (items) => {
                    const coreMap = new Map();
                    const stemMap = new Map();
                    (items || []).forEach(q => {
                        if (!q) return;
                        const core = questionCoreFingerprint(q);
                        const stem = questionStemFingerprint(q);
                        if (core && !coreMap.has(core)) coreMap.set(core, q);
                        if (stem && !stemMap.has(stem)) stemMap.set(stem, q);
                    });
                    coreFingerprintMap.value = coreMap;
                    stemFingerprintMap.value = stemMap;
                };

                const resetLibraryFilters = () => {
                    librarySearchInput.value = '';
                    librarySearchKeyword.value = '';
                    Object.assign(libraryFilters, { type: '', diff: '', grade: '', answerState: '', imageState: '' });
                    currentPage.value = 1;
                };
                
                const knowledgeCounts = computed(() => window.Qisi.UiEvents.buildKnowledgeCounts(knowledgeTree, 'system', questions.value, getQuestionKnowledge));
                const personalKnowledgeCounts = computed(() => window.Qisi.UiEvents.buildKnowledgeCounts(personalKnowledgeTree.value, 'personal', questions.value, getQuestionKnowledge));
                const activeKnowledgeTree = computed(() => libraryKnowledgeMode.value === 'personal' ? personalKnowledgeTree.value : (libraryKnowledgeMode.value === 'external' ? [] : knowledgeTree));
                const activeKnowledgeCounts = computed(() => libraryKnowledgeMode.value === 'personal' ? personalKnowledgeCounts.value : (libraryKnowledgeMode.value === 'external' ? {} : knowledgeCounts.value));

                const filteredQuestions = computed(() => {
                    const sourceTree =
                        activeKnowledgeType.value === 'personal'
                            ? personalKnowledgeTree.value
                            : knowledgeTree;
                    return libraryService.filterAndSort(questions.value, {
                        keyword: librarySearchKeyword.value,
                        filters: libraryFilters,
                        knowledge: activeKnowledge.value,
                        knowledgeType: activeKnowledgeType.value,
                        knowledgeTree: sourceTree,
                        sortBy: 'createdAt',
                        direction: 'desc'
                    });
                });

                const flattenKnowledgeTree = (tree, prefix = []) => {
                    const rows = [];
                    for (const node of tree || []) {
                        const path = [...prefix, node.name];
                        rows.push({ id: node.id, name: node.name, path: path.join(' / ') });
                        if (node.children?.length) rows.push(...flattenKnowledgeTree(node.children, path));
                    }
                    return rows;
                };

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

                const showBatchToast = (message) => {
                    batchToast.value = message;
                    setTimeout(() => {
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
                    batchImportMode.value = 'list';
                    activeBatchId.value = '';
                    activeDraftQuestionId.value = '';
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

                const queueBatchFiles = async (fileList) => {
                    const files = Array.from(fileList || []);
                    batchCreateWarning.value = '';
                    if (!files.length) return;

                    if (batchCreateFiles.value.length + files.length > 10) {
                        batchCreateWarning.value = '单次任务最多添加 10 个文件，请拆成多个任务处理。';
                        return;
                    }

                    const incomingImageCount = files.filter(file => getFileType(file.name) === 'image').length;
                    const existingImageCount = batchCreateFiles.value.filter(file => file.fileType === 'image').length;
                    if (existingImageCount + incomingImageCount > 30) {
                        batchCreateWarning.value = '图片最多添加 30 张，请先筛选需要识别的图片。';
                        return;
                    }

                    const supportedTypes = new Set(['docx', 'pdf']);

                    for (const file of files) {
                        if (/\.doc$/i.test(file.name || '')) {
                            batchCreateWarning.value = `${file.name} 是旧版 .doc 文件，当前不支持直接解析。请先用 Word/WPS 另存为 .docx 后再上传。`;
                            continue;
                        }

                        const fileType = getFileType(file.name);

                        if (!supportedTypes.has(fileType)) {
                            batchCreateWarning.value = `${file.name} 暂不支持。批量导入当前仅支持 DOCX、PDF；图片请使用图片识别或手工录题入口。`;
                            continue;
                        }

                        if (fileType === 'text' && file.size > 2 * 1024 * 1024) {
                            batchCreateWarning.value = `${file.name} 超过 2MB，文本文件请拆分后再上传。`;
                            continue;
                        }

                        if (fileType !== 'text' && file.size > 50 * 1024 * 1024) {
                            batchCreateWarning.value = `${file.name} 超过 50MB，请压缩或拆分后再上传。`;
                            continue;
                        }

                        const uploadPath = await readFileAsDataUrl(file);

                        pendingPurposeQueue.value.push({
                            file,
                            id: makeBatchId('file'),
                            filename: file.name,
                            fileType,
                            fileSize: file.size,
                            uploadPath
                        });
                    }
                    if (!pendingPurposeFile.value) openNextPendingPurposeFile();
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

                const loadBatchImportData = async () => {
                    batchImportBatches.value = await storageRepository.listRecentTasks();
                    if (activeBatchId.value) {
                        const loaded = await draftPersistenceService.reloadDraftBatch(
                            activeBatchId.value
                        );
                        batchImportFiles.value = loaded.files;
                        batchDraftQuestions.value = loaded.questions;
                        batchDraftImages.value = loaded.images;
                        unmatchedAnswers.value = loaded.batch.unmatchedAnswers || [];
                    }
                };

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
                const activeDraftQuestion = computed(() => batchDraftQuestions.value.find(question => question.id === activeDraftQuestionId.value) || batchDraftQuestions.value[0] || null);
                const isValidQuestionPreviewImage = (img) => {
                    if (!img?.url) return false;
                    if (img.displayable === false) return false;
                    return true;
                };

                const pdfDraftContract = q => window.Qisi.PdfMineruContract.isRecord(q) ? window.Qisi.PdfMineruContract : window.Qisi.PdfExternalContract.isExternal(q) ? window.Qisi.PdfExternalContract : window.Qisi.PdfMultimodalContract.isV1(q) ? window.Qisi.PdfMultimodalContract : null;
                const pdfDraftMeta = q => q?.pdfReview || q?.pdfExternal || q?.pdfV1 || null;
                const activePdfReviewPanel = computed(() => pdfDraftContract(activeDraftQuestion.value)?.reviewPanel?.(activeDraftQuestion.value) || null);
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
                    pdfMeta: pdfDraftMeta
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
                const activeDraftEditorDirty = computed(() =>
                    Boolean(activeDraftQuestion.value) && (activeDraftEditorBuffer.value !== activeDraftEditorOriginal.value ||
                    window.Qisi.ReviewDraftState.draftEditorFieldSignature(activeDraftQuestion.value) !==
                        JSON.stringify(activeDraftEditorOriginalFields.value))
                );
                const protectUnsavedDraft = event => {
                    if (!activeDraftEditorDirty.value) return;
                    event.preventDefault(); event.returnValue = '';
                };
                window.addEventListener('beforeunload', protectUnsavedDraft);
                Vue.onUnmounted(() => window.removeEventListener('beforeunload', protectUnsavedDraft));

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
                    activeDraftEditorBuffer.value = activeDraftEditorOriginal.value;
                    if (activeDraftQuestion.value) window.Qisi.ReviewDraftState.restoreDraftEditorFields(activeDraftQuestion.value, activeDraftEditorOriginalFields.value);
                    showBatchToast('已放弃未保存修改。');
                };

                watch(
                    () => activeDraftQuestion.value?.id || '',
                    () => {
                        window.Qisi.ReviewDraftState.syncActiveDraftEditorFromQuestion({
                            activeDraftQuestion,
                            activeDraftEditorBuffer,
                            activeDraftEditorOriginal,
                        activeDraftEditorOriginalFields,
                            activeDraftEditorQuestionId,
                            buildDraftEditorSource
                        });
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

                const browserDocumentSource =
                    Qisi.BrowserDocumentSource.createBrowserDocumentSource({
                        makeBatchId,
                        dataUrlToBlob,
                        resolveFormulaImageTokens,
                        blockImageToken: BLOCK_IMAGE_TOKEN,
                        pdfProcessConfig: PDF_PROCESS_CONFIG,
                        docxEmbeddedImageCache,
                        draftFileTextCache,
                        draftFileXmlCache,
                        draftFileRidImageUrlMapCache,
                        draftFileRidImageMetaMapCache
                    });
                const {
                    extractPdfTextWithPdfJs,
                    extractPdfLayoutWithPdfJs,
                    extractTextFromDraftFile
                } = browserDocumentSource;

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
                            window.katex.renderToString(formula, {
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

                const strictQuestionPageRecognizer =
                    window.Qisi.QwenVisionSourcePort
                        .createStrictQuestionPageRecognizer({
                            requestText: options =>
                                qwenOcrRuntime.requestText(options),
                            parseStrictQuestionPayload,
                            postprocessRecognizedItems,
                            getDefaultType: () =>
                                batchDefaultMeta.defaultType || '单选题',
                            getRoles: getBatchFileRoles,
                            logDiagnostic: logBatchPdfDiag,
                            projectDocxVisionCandidate: input =>
                                window.Qisi.DocxProducerIdentityContract
                                    .projectDocxVisionCandidate(input)
                        });

                const strictVisualPreparedPagesRecognizer =
                    window.QisiBatchEngineV2
                        .createStrictVisualPreparedPagesRecognizer({
                            mapWithConcurrency,
                            recognizePage:
                                strictQuestionPageRecognizer,
                            collectValidFigures:
                                collectValidRecognizedFigures,
                            hasFigureCue: questionHasFigureCue,
                            locateQuestionFigures:
                                locateQuestionFiguresWithQwen,
                            normalizeFigure:
                                normalizeRecognizedFigureDescriptor,
                            isLikelyRealFigure:
                                isLikelyRealQuestionFigure,
                            mergeQuestionItems:
                                mergeStrictQuestionItemsByNumber,
                            validateQuestionItems:
                                validateVisualQuestionItems,
                            isStrictChoiceType,
                            repairChoiceAndSolutionDetails:
                                repairPageChoiceAndSolutionDetailsWithVision,
                            buildQuestionNumberGapWarning:
                                window.Qisi.UiEvents
                                    .buildQuestionNumberGapWarning,
                            normalizeFourOptions:
                                normalizeFourOptionsForCheck,
                            isBadChoiceOption,
                            cleanRecognizedText:
                                window.Qisi.Utils.cleanRecognizedText,
                            isFatalServiceError:
                                window.Qisi.Utils.isFatalQwenServiceError,
                            now: () => performance.now()
                        });

                const strictVisualQuestionProducer =
                    window.QisiBatchEngineV2.createStrictVisualQuestionProducer({
                        renderPdfFilePages,
                        recognizePreparedPages:
                            strictVisualPreparedPagesRecognizer,
                        getRoles: getBatchFileRoles,
                        logDiagnostic: logBatchPdfDiag,
                        now: () => performance.now()
                    });

                const docxToPdfConverter =
                    window.Qisi.DocxConverter.createDocxToPdfConverter({
                        request: window.fetch.bind(window),
                        createFormData: () => new FormData(),
                        dataUrlToBlob,
                        getBaseUrl: getLocalConvertBaseUrl,
                        getRoles: getBatchFileRoles,
                        now: Date.now,
                        logger: console
                    });

                const docxVisionQuestionReconciler =
                    window.Qisi.DocxVisionReconciler
                        .createDocxVisionReconciler({
                            normalizeQuestionNumber: normalizeQuestionKey,
                            cleanText:
                                window.Qisi.Utils.cleanRecognizedText,
                            mergeQuestions:
                                mergeStrictQuestionItemsByNumber
                        });

                const docxVisionQuestionSourceProducer =
                    window.Qisi.ProductionDocxVisionSourcePort
                        .createQuestionSourceProducer({
                            getImporter: () => window.QisiBatchImporter,
                            convertDocxToPdf:
                                docxToPdfConverter,
                            processStrictQuestionFile:
                                strictVisualQuestionProducer
                                    .processQuestionFile,
                            reconcileQuestions:
                                docxVisionQuestionReconciler,
                            validateQuestionItems:
                                validateVisualQuestionItems,
                            now: () => performance.now()
                        });

                const docxVisionSupportSourceProducer =
                    window.Qisi.ProductionDocxVisionSourcePort
                        .createSupportSourceProducer({
                            convertDocxToPdf:
                                docxToPdfConverter,
                            renderPdfPages: renderPdfFilePages,
                            renderOptions: {
                                scale: PDF_PROCESS_CONFIG.renderScale,
                                jpegQuality:
                                    PDF_PROCESS_CONFIG.jpegQuality,
                                sequential: true
                            },
                            recognizePreparedSupport:
                                recognizeVisualSupportFromPreparedPages,
                            mathSignalCount:
                                window.Qisi.Utils.mathSignalCount,
                            now: () => performance.now()
                        });

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

                const runProductionDocxVisionImport =
                    window.Qisi.ProductionDocxVisionSourcePort
                        .createProductionImportRunner({
                            hasQuestionRole: batchHasQuestionRole,
                            isFullRole: batchIsFullRole,
                            hasAnswerRole: batchHasAnswerRole,
                            hasSolutionRole: batchHasSolutionRole,
                            normalizeQuestionNumber: normalizeQuestionKey,
                            processQuestionSource: input =>
                                docxVisionQuestionSourceProducer({
                                    file: input.source,
                                    batch: input.batch,
                                    processFiles: input.sources,
                                    expectedQuestionCount:
                                    input.expectedQuestionCount,
                                    reportStage: input.reportStage,
                                    signal: input.signal
                                }),
                            processSupportSource: input =>
                                docxVisionSupportSourceProducer({
                                    file: input.source,
                                    expectedQuestionNumbers:
                                        input.expectedQuestionNumbers,
                                    requiredKinds: input.requiredKinds,
                                    signal: input.signal
                                })
                        });
                const runProductionPdfImport = window.Qisi.PdfMineruProducer.createProducer({
                    renderPages: renderPdfFilePages,
                    getRoles: getBatchFileRoles,
                    getExistingDrafts: batchId => storageRepository.findBy('draftQuestions', 'batchId', batchId),
                    persistSourceEvidence: (file, evidence) => storageRepository.put('draftImportFiles', { ...file, pdfMineruEvidence: evidence, updatedAt: Date.now() })
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
                        runDocxVisionImport: runProductionDocxVisionImport,
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
                            draftPersistenceService.persistReviewDraftBatch({
                                batchId: command.batchId,
                                drafts: command.drafts,
                                images: command.images,
                                files: command.sourceFiles.map(file => ({
                                    ...file,
                                    ...(command.pdfEvidence ? { [command.pdfEvidence.protocol === 'pdf-mineru-v1' ? 'pdfMineruEvidence' : command.pdfEvidence.protocol === 'pdf-external-v2' ? 'pdfExternalEvidence' : 'pdfV1Evidence']: { ...command.pdfEvidence, tasks: command.pdfEvidence.tasks?.filter(e => e.sourceId === file.id), unassigned: command.pdfEvidence.unassigned?.filter(e => e.source_id === file.id) }, parseStatus: command.pdfEvidence.errors.some(e => e.sourceId === file.id) ? 'partial' : 'success' } : { parseStatus: 'success' }),
                                    errorMessage: '',
                                    updatedAt: command.batchPatch.updatedAt
                                })),
                                batchPatch: { ...command.batchPatch, importWarnings: command.warnings, unmatchedAnswers: command.unmatched },
                                idempotencyKey: command.idempotencyKey,
                                expectedVersion: command.expectedVersion,
                                signal: command.signal
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

                const normalUiImportController =
                    window.Qisi.NormalUiImportController
                        .createNormalUiImportController({
                            bridge: productionImportBridge,
                            canReuseCommittedRequest: window.Qisi.ProductionImportRoutePolicy
                                .canReuseNormalUiCommittedRequest,
                            loadBatch: batchId =>
                                storageRepository.get('draftImportBatches', batchId),
                            applyReviewModel: async result => {
                                activeBatchId.value = result.batchId;
                                await loadBatchImportData();
                                batchImportMode.value = 'review';
                                activeDraftQuestionId.value =
                                    result.readback.questions[0]?.id || '';
                                await nextTick();
                            },
                            notifySuccess: ({ draftCount }) =>
                                showBatchToast(`批量识别完成：生成 ${draftCount} 道草稿。`),
                            notifyFailure: ({ code, message }) =>
                                showBatchToast(`批量识别失败：${message || code}`)
                        });

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

                const openBatchReview = async (batchId) => {
                    activeBatchId.value = batchId;
                    batchImportMode.value = 'review';
                    batchImportFilter.value = 'all';
                    activeDraftTab.value = 'stem';
                    await loadBatchImportData();
                    activeDraftQuestionId.value = batchDraftQuestions.value[0]?.id || '';
                    await nextTick();
                    window.Qisi.ReviewDraftState.syncActiveDraftEditorFromQuestion({
                        activeDraftQuestion,
                        activeDraftEditorBuffer,
                        activeDraftEditorOriginal,
                        activeDraftEditorOriginalFields,
                        activeDraftEditorQuestionId,
                        buildDraftEditorSource
                    });
                };

                const selectDraftQuestion = async (id) => {
                    const decision = window.Qisi.ReviewSessionCommands.resolveSelection({
                        currentId: activeDraftQuestionId.value,
                        nextId: id,
                        dirty: activeDraftEditorDirty.value
                    });
                    if (decision === 'noop') return;
                    if (decision === 'prompt') {
                        const leave = confirm('当前题目的 LaTeX 有未保存修改。切换题目将放弃这些修改，是否继续？');
                        if (!leave) return;
                        discardActiveDraftEditorChanges();
                    }

                    activeDraftQuestionId.value = id;
                    activeDraftTab.value = 'stem';
                    await nextTick();
                    window.Qisi.ReviewDraftState.syncActiveDraftEditorFromQuestion({
                        activeDraftQuestion,
                        activeDraftEditorBuffer,
                        activeDraftEditorOriginal,
                        activeDraftEditorOriginalFields,
                        activeDraftEditorQuestionId,
                        buildDraftEditorSource
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
                    window.Qisi.ReviewDraftState.syncActiveDraftEditorFromQuestion({ activeDraftQuestion, activeDraftEditorBuffer, activeDraftEditorOriginal, activeDraftEditorOriginalFields, activeDraftEditorQuestionId, buildDraftEditorSource });
                    showBatchToast('已采用人工选择；请核对并重新确认。');
                };

                const acknowledgePdfTaskIssues = async () => {
                    const q = activeDraftQuestion.value;
                    if (!pdfDraftContract(q)?.acknowledgeTaskIssues || q.status === 'submitted') return;
                    const next = pdfDraftContract(q).acknowledgeTaskIssues(toRaw(q), reviewController);
                    const persisted = await runReviewDraftPersistenceCommand({ batchId: q.batchId, draft: next, expectedDraftVersion: q.version });
                    if (persisted) { Object.assign(q, persisted.draft); await loadBatchImportData(); showBatchToast('已记录来源范围检查，请重新确认本题。'); }
                };
                const removeEditorOptionWarning = (q) => {
                    q.warnings = (q.warnings || []).filter(warning =>
                        !String(warning).includes('题目编辑源码暂未识别出选项')
                    );
                };

                const commitDraftEditorBufferToQuestion = (q) => {
                    if (!q) return null;
                    if (Boolean(pdfDraftContract(q))) {
                        Object.assign(q, pdfDraftContract(q).applyEditorSource(toRaw(q), activeDraftEditorBuffer.value, reviewController));
                        return buildDraftEditorProjection(activeDraftEditorBuffer.value, q);
                    }

                    const plan = window.Qisi.ReviewEditorCommit.planEditorCommit({
                        question: q,
                        source: activeDraftEditorBuffer.value,
                        images: activeDraftPreviewImages.value || [],
                        migrateImageTokens: migrateLegacyIncludegraphicsToQisiTokens,
                        normalizeDuplicates: normalizeImagePlacementDuplicates,
                        normalizeNewlines: window.Qisi.ReviewDraftState.normalizeDraftEditorNewlines,
                        buildProjection: buildDraftEditorProjection
                    });
                    activeDraftEditorBuffer.value = plan.editorSource;
                    q.editorSource = plan.editorSource;
                    if (plan.optionWarning) window.Qisi.Utils.addWarningOnce(q, plan.optionWarning);
                    else removeEditorOptionWarning(q);
                    Object.assign(q, reviewController.editFields(q, {
                        stem: plan.stem,
                        options: plan.options
                    }));
                    q.updatedAt = Date.now();

                    return plan.projection;
                };

                const saveActiveDraftQuestion = async (options = {}) => {
                    const q = activeDraftQuestion.value;
                    if (!q) return false;
                    const expectedDraftVersion = q.version;

                    window.Qisi.ReviewDraftState.applyDraftEditorMetadata(q);
                    commitDraftEditorBufferToQuestion(q);
                    cleanSingleDraftForSave(q);
                    normalizeDraftQuestionBeforeSave(q);
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        expectedDraftVersion
                    });
                    if (!persisted) return false;
                    Object.assign(q, persisted.draft);
                    await refreshBatchStats(q.batchId);

                    activeDraftEditorOriginal.value = activeDraftEditorBuffer.value;
                    activeDraftEditorOriginalFields.value = window.Qisi.ReviewDraftState.snapshotDraftEditorFields(q);
                    activeDraftEditorQuestionId.value = q.id || '';

                    if (!options.silent) {
                        showBatchToast('题目 LaTeX 已保存。');
                    }

                    return true;
                };

                const confirmDraftImages = async () => {
                    const q = activeDraftQuestion.value;
                    if (!q) return;
                    const expectedDraftVersion = q.version;
                    const plan = window.Qisi.ReviewImageCommands.planConfirmImages({
                        question: q,
                        images: activeDraftRealQuestionImages.value
                    });
                    q.imageReviewStatus = 'confirmed';
                    q.warnings = plan.warnings;
                    cleanSingleDraftForSave(q);
                    const updates = new Map(plan.imageUpdates.map(update => [update.id, update]));
                    for (const image of activeDraftRealQuestionImages.value) {
                        const update = updates.get(image.id);
                        if (!update) continue;
                        image.status = update.status;
                        image.confidence = update.confidence;
                    }
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        images: activeDraftRealQuestionImages.value.map(toRaw),
                        expectedDraftVersion
                    });
                    if (!persisted) return;
                    await refreshBatchStats(q.batchId);
                    await loadBatchImportData();
                    showBatchToast('图片已确认。');
                };

                const deleteDraftImage = async (imageId) => {
                    if (!confirm('确定删除这张图片吗？')) return;
                    const image = batchDraftImages.value.find(img => img.id === imageId);
                    const q = activeDraftQuestion.value;
                    if (!image || !q) return;
                    const expectedDraftVersion = q.version;
                    image.status = 'deleted';
                    if (Boolean(pdfDraftContract(q))) {
                        const next = pdfDraftContract(q).removeImage(toRaw(q), imageId, reviewController);
                        const result = await runReviewDraftPersistenceCommand({ batchId: q.batchId, draft: next, images: [toRaw(image)], expectedDraftVersion });
                        if (result) { Object.assign(q, result.draft); activeDraftEditorBuffer.value = buildDraftEditorSource(q); await loadBatchImportData(); }
                        return;
                    }
                    const plan = window.Qisi.ReviewImageCommands.planImageDeletion({
                        question: q,
                        imageId,
                        currentSource: q.editorSource ||
                            activeDraftEditorBuffer.value ||
                            q.stem ||
                            buildDraftEditorSource(q),
                        removeToken: removeImageTokenFromStemForV2
                    });
                    Object.assign(q, reviewController.editFields(q, {
                        images: plan.images,
                        stem: plan.stem
                    }));
                    const cleanedEditorSource = plan.editorSource;
                    q.editorSource = cleanedEditorSource;

                    if (q.id === activeDraftQuestionId.value) {
                        activeDraftEditorBuffer.value = cleanedEditorSource;
                        activeDraftEditorOriginal.value = cleanedEditorSource;
                        activeDraftEditorOriginalFields.value = window.Qisi.ReviewDraftState.snapshotDraftEditorFields(q);
                    }

                    const remainingRealImages = activeDraftRealQuestionImages.value
                        .filter(img => img.id !== imageId && img.status !== 'deleted');

                    q.hasImage = remainingRealImages.length > 0 || (q.images || []).length > 0;
                    if (!q.hasImage) q.imageReviewStatus = 'none';
                    cleanSingleDraftForSave(q);
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        images: [toRaw(image)],
                        expectedDraftVersion
                    });
                    if (!persisted) return;
                    await loadBatchImportData();
                };

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
                const savePdfManualCrop = async (q, source, bbox) => {
                    const file = batchImportFiles.value.find(f => f.id === source.sourceFileId);
                    const crop = await browserPdfRenderer.renderPdfRegion(file, { pageNo: source.sourcePage, bbox });
                    const image = { id: makeBatchId('crop'), batchId: q.batchId, questionId: q.id, ...crop, bbox, source: 'manual-crop', sourceFileId: file.id, sourceFileName: file.filename, sourcePage: source.sourcePage, status: 'bound' };
                    const next = pdfDraftContract(q).applyManualCrop(toRaw(q), image, cropState.belongsTo || 'stem', reviewController);
                    const result = await runReviewDraftPersistenceCommand({ batchId: q.batchId, draft: next, images: [image], expectedDraftVersion: q.version });
                    if (result) { Object.assign(q, result.draft); activeDraftEditorBuffer.value = buildDraftEditorSource(q); await loadBatchImportData(); closeCropModal(); }
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

                    cropState.sourceImage = img;
                    cropState.belongsTo = activeDraftTab.value === 'stem' ? 'stem' : activeDraftTab.value;
                    resetCropState();
                    cropModalOpen.value = true;

                    await nextTick();
                };

                const closeCropModal = () => {
                    cropModalOpen.value = false;
                    cropState.sourceImage = null;
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

                const loadImageForCrop = (url) => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('裁剪图片加载失败'));
                    img.src = url;
                });

                const saveManualCropToDraft = async () => {
                    const q = activeDraftQuestion.value;
                    const source = cropState.sourceImage;

                    if (!q || !source?.url) {
                        showBatchToast('当前没有可保存的裁剪来源。');
                        return;
                    }
                    const expectedDraftVersion = q.version;

                    const imgEl = cropImageRef.value;
                    if (!imgEl) {
                        showBatchToast('裁剪图片未加载完成。');
                        return;
                    }

                    const x = Math.min(cropState.x, cropState.x + cropState.w);
                    const y = Math.min(cropState.y, cropState.y + cropState.h);
                    const w = Math.abs(cropState.w);
                    const h = Math.abs(cropState.h);

                    if (w < 20 || h < 20) {
                        showBatchToast('裁剪区域太小，请重新框选。');
                        return;
                    }

                    if (Boolean(pdfDraftContract(q))) {
                        const width = imgEl.getBoundingClientRect().width, height = imgEl.getBoundingClientRect().height;
                        await savePdfManualCrop(q, source, [x / width * 1000, y / height * 1000, (x + w) / width * 1000, (y + h) / height * 1000]);
                        return;
                    }
                    let rawImg;
                    try {
                        rawImg = await loadImageForCrop(source.url);
                    } catch (error) {
                        console.warn('[BATCH_CROP][load-failed]', error);
                        showBatchToast('来源原图加载失败，无法裁剪。');
                        return;
                    }

                    const displayWidth = imgEl.clientWidth || imgEl.getBoundingClientRect().width;
                    const displayHeight = imgEl.clientHeight || imgEl.getBoundingClientRect().height;

                    if (!displayWidth || !displayHeight || !rawImg.naturalWidth || !rawImg.naturalHeight) {
                        showBatchToast('图片尺寸异常，无法裁剪。');
                        return;
                    }

                    const scaleX = rawImg.naturalWidth / displayWidth;
                    const scaleY = rawImg.naturalHeight / displayHeight;

                    const sx = Math.max(0, Math.round(x * scaleX));
                    const sy = Math.max(0, Math.round(y * scaleY));
                    const sw = Math.min(rawImg.naturalWidth - sx, Math.round(w * scaleX));
                    const sh = Math.min(rawImg.naturalHeight - sy, Math.round(h * scaleY));

                    if (sw <= 0 || sh <= 0) {
                        showBatchToast('裁剪区域无效，请重新框选。');
                        return;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = sw;
                    canvas.height = sh;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        showBatchToast('浏览器不支持图片裁剪。');
                        return;
                    }

                    ctx.drawImage(rawImg, sx, sy, sw, sh, 0, 0, sw, sh);

                    const url = canvas.toDataURL('image/png');
                    const now = Date.now();
                    const imageId = makeBatchId('crop');

                    const croppedImage = {
                        id: imageId,
                        batchId: q.batchId || activeBatchId.value || '',
                        questionId: q.id,
                        url,
                        filename: `crop_q${q.questionNumber || q.order || ''}_${now}.png`,
                        name: `crop_q${q.questionNumber || q.order || ''}_${now}.png`,
                        sourceFileId: source.sourceFileId || q.sourceFileId || q.sourceQuestionFileId || '',
                        sourcePage: source.sourcePage || q.sourcePage || 1,
                        source: 'manual-crop',
                        description: '人工裁剪题图',
                        status: 'bound',
                        confidence: 1,
                        displayable: true,
                        bbox: [sx, sy, sx + sw, sy + sh],
                        createdAt: now,
                        updatedAt: now
                    };

                    const nextStem = appendImageTokensToStemForV2(q.stem || '', [croppedImage]);

                    Object.assign(q, reviewController.editFields(q, {
                        stem: nextStem,
                        images: [
                            ...(q.images || []),
                            { id: croppedImage.id, url, align: 'center' }
                        ]
                    }));
                    q.hasImage = true;
                    q.imageReviewStatus = 'confirmed';
                    q.updatedAt = now;

                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        images: [croppedImage],
                        expectedDraftVersion
                    });
                    if (!persisted) return;
                    await loadBatchImportData();

                    closeCropModal();
                    showBatchToast('已保存当前题裁剪图。');
                };

                const bindUnassignedImage = async (imageId, questionId) => {
                    const image = batchDraftImages.value.find(img => img.id === imageId);
                    const q = batchDraftQuestions.value.find(item => item.id === questionId);
                    if (!image || !q) return;
                    const expectedDraftVersion = q.version;
                    image.questionId = q.id;
                    image.status = 'need_confirm';
                    image.confidence = image.confidence || 0.78;
                    Object.assign(q, reviewController.editFields(q, {
                        images: [
                            ...(q.images || []),
                            { id: image.id, url: image.url, align: 'center' }
                        ],
                        stem: appendImageTokensToStemForV2(
                            q.stem || '',
                            [{
                                ...image,
                                source: image.source ||
                                    'uploaded-question-image'
                            }]
                        )
                    }));
                    q.hasImage = true;
                    q.imageReviewStatus = 'need_confirm';
                    q.warnings = [...new Set([...(q.warnings || []), '该题图片需要确认后才能入库。'])];
                    cleanSingleDraftForSave(q);
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: q.batchId,
                        draft: toRaw(q),
                        images: [toRaw(image)],
                        expectedDraftVersion
                    });
                    if (!persisted) return;
                    await refreshBatchStats(q.batchId);
                    await loadBatchImportData();
                };

                const deleteUnassignedImage = async (imageId) => {
                    if (!confirm('确定删除这张未分配图片吗？')) return;
                    const image = batchDraftImages.value.find(
                        item => item.id === imageId
                    );
                    if (!image) return;
                    const persisted = await runReviewDraftPersistenceCommand({
                        batchId: image.batchId,
                        imageId,
                        expectedUpdatedAt:
                            image.updatedAt ?? image.createdAt ?? 0,
                        updatedAt: Date.now(),
                        patch: { status: 'deleted' }
                    }, {
                        kind: 'image',
                        failureMessage: '删除图片失败'
                    });
                    if (!persisted) return;
                    await refreshBatchStats(activeBatchId.value);
                    await loadBatchImportData();
                };

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
                    error?.message || '正式入库失败。');

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

                // One-tap review: save the editor, confirm, then submit in one
                // action. Both steps still go through the same workflow service
                // and formal-admission gates; this only removes the extra clicks.
                const confirmAndSubmitDraft = async (questionId = activeDraftQuestionId.value) => {
                    const id = String(questionId || '');
                    if (!id) return false;
                    if (id === activeDraftQuestionId.value && activeDraftEditorDirty.value) {
                        const saved = await saveActiveDraftQuestion({ silent: true });
                        if (!saved) return false;
                    }
                    const draft = batchDraftQuestions.value.find(item => item.id === id);
                    if (!draft?.batchId) return false;
                    try {
                        const confirmed = await reviewWorkflowService.confirmDraft({
                            batchId: draft.batchId,
                            draftId: draft.id,
                            expectedDraftVersion: draft.version,
                            actorId: 'local-teacher'
                        });
                        if (!confirmed.accepted) {
                            alert(confirmed.validation?.errors?.[0]?.message || '题目校验失败，暂时不能入库。');
                            return false;
                        }
                        const submitted = await reviewWorkflowService.submitDraft({
                            batchId: draft.batchId,
                            draftId: draft.id,
                            expectedDraftVersion: confirmed.draft.version,
                            actorId: 'local-teacher'
                        });
                        if (!submitted.accepted) {
                            alert(submitted.validation?.errors?.[0]?.message || '正式入库准入校验失败。');
                            await loadBatchImportData();
                            return false;
                        }
                    } catch (error) {
                        alert(formalSubmitErrorMessage(error));
                        await loadBatchImportData();
                        return false;
                    }
                    await loadData();
                    await loadBatchImportData();
                    showBatchToast('已确认并入库。');
                    return true;
                };

                const selectedDraftIds = ref([]);
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
                const confirmSelectedDrafts = async () => {
                    const ids = [...selectedDraftIds.value];
                    if (!ids.length) {
                        showBatchToast('请先勾选要确认的题目。');
                        return;
                    }
                    if (activeDraftEditorDirty.value &&
                        !await saveActiveDraftQuestion({ silent: true })) return;
                    let confirmedCount = 0;
                    const failed = [];
                    for (const draft of window.Qisi.ReviewBatchConfirm
                        .eligibleDrafts(batchDraftQuestions.value, ids)) {
                        try {
                            const result = await reviewWorkflowService.confirmDraft({
                                batchId: draft.batchId,
                                draftId: draft.id,
                                expectedDraftVersion: draft.version,
                                actorId: 'local-teacher'
                            });
                            if (result.accepted) confirmedCount += 1;
                            else failed.push(id);
                        } catch (error) {
                            failed.push(id);
                        }
                    }
                    selectedDraftIds.value = failed;
                    await loadBatchImportData();
                    showBatchToast(window.Qisi.ReviewBatchConfirm
                        .batchConfirmNotice(confirmedCount, failed.length));
                };

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
                    const text = unmatchedAnswers.value.map(x => `第${x.questionNumber || x.question}题 ${x.field === 'solution' ? '解析' : '答案'}：${x.value || x[x.field || 'answer'] || x.evidence?.values?.join('\n') || ''}｜${x.sourceFileName || x.sourceFile || ''}`).join('\n');
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

                const missingCartQuestionIds = computed(() => cart.value.filter(id => !questions.value.some(q => q?.id === id)));
                const cartQuestionsOrdered = computed(() => cart.value
                    .map(id => questions.value.find(q => q && q.id === id))
                    .filter(Boolean));

                const getTemplateCard = (id, tpl) => {
                    const override = templateOverrides.value[id] || {};
                    return { id, name: override.name || tpl.name, desc: tpl.desc, code: override.code || tpl.code, system: true };
                };

                const allTemplateCards = computed(() => [
                    ...Object.entries(PRESET_TEMPLATES).map(([id, tpl]) => getTemplateCard(id, tpl)),
                    ...customTemplates.value.map(tpl => ({ id: tpl.id, name: tpl.name, desc: tpl.desc || '自定义模板', code: tpl.code, system: false }))
                ]);

                const examPresets = computed(() => ({
                    ...Object.fromEntries(Object.entries(EXAM_LAYOUT_PRESETS).map(([id, preset]) => {
                        const override = templateOverrides.value[id] || {};
                        // 系统模板被改过版式时，override.config 必须生效，否则改完一切换就还原。
                        return [id, { ...preset, name: override.name || preset.name, desc: PRESET_TEMPLATES[id]?.desc || preset.desc,
                            config: { ...preset.config, ...(override.config || {}) } }];
                    })),
                    ...Object.fromEntries(customTemplates.value.map(tpl => [
                        tpl.id,
                        { name: tpl.name, desc: tpl.desc || '自定义模板', config: { ...EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY].config, ...(tpl.config || {}), title: tpl.config?.title || tpl.name } }
                    ]))
                }));

                const selectedExamPreset = computed(() => examPresets.value[selectedExamTemplate.value] || examPresets.value[DEFAULT_PRESET_KEY]);

                const getExamGroupsForQuestions = (sourceQuestions) => window.Qisi.ExamGroups.groupQuestions({
                    questions: sourceQuestions,
                    groupConfig: examGroupConfig,
                    questionMeta: examQuestionMeta,
                    typeOrder: EXAM_TYPE_ORDER,
                    defaultGroupConfig: DEFAULT_GROUP_CONFIG,
                    typeLabels: QUESTION_TYPE_LABELS
                });

                const activeExamGroups = computed(() => getExamGroupsForQuestions(cartQuestionsOrdered.value));

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

                const getGroupCfg = (type) => {
                    if (!examGroupConfig[type]) {
                        examGroupConfig[type] = { ...(DEFAULT_GROUP_CONFIG[type] || { title: QUESTION_TYPE_LABELS[type] || type || '其他题型', points: 0 }) };
                    }
                    return examGroupConfig[type];
                };

                const syncExamMeta = () => {
                    cartQuestionsOrdered.value.forEach((q, idx) => {
                        const groupCfg = getGroupCfg(q.type);
                        if (!examQuestionMeta[q.id]) {
                            examQuestionMeta[q.id] = {
                                name: q.type || `第 ${idx + 1} 题`,
                                points: Number(groupCfg.points || 0),
                                source: q.knowledge || q.meta?.knowledge || '',
                                note: ''
                            };
                        } else if (!examQuestionMeta[q.id].points) {
                            examQuestionMeta[q.id].points = Number(groupCfg.points || 0);
                        }
                    });
                };

                const syncExamGroups = () => {
                    activeExamGroups.value.forEach(group => {
                        const cfg = getGroupCfg(group.type);
                        if (!cfg.text) cfg.text = groupSummaryText(group);
                    });
                    syncExamMeta();
                };

                const openExamBuilder = () => {
                    syncExamGroups();
                    view.value = 'exam';
                    isCartOpen.value = false;
                };

                const groupSummaryText = (group) => {
                    return group.text || `${group.title}：本大题共 ${group.count} 小题，每小题 ${Number(group.points || 0)} 分，共计 ${group.total} 分。`;
                };

                watch(cartQuestionsOrdered, () => {
                    syncExamMeta();
                }, { deep: true });

                watch(cart, (val) => {
                    safeStorage.setJson('qisi_exam_cart', toRaw(val));
                }, { deep: true });

                watch(examQuestionMeta, (val) => {
                    safeStorage.setJson(
                        'qisi_exam_question_meta',
                        toRaw(val)
                    );
                }, { deep: true });

                watch(view, (val) => {
                    safeStorage.set('qisi_last_view', val);
                });

                watch(exportMode, (val) => {
                    safeStorage.set('qisi_export_mode', val);
                });

                watch(externalPickMode, (enabled) => {
                    if (!enabled) selectedExternalIds.value = [];
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
                        activeExternalBatchId.value = null;
                        externalPickMode.value = false;
                        selectedExternalIds.value = [];
                    }
                };

                const handleKnowledgeSelect = (payload) => {
                    const name = typeof payload === 'object' ? payload.name : payload;
                    const type = typeof payload === 'object' ? payload.type : libraryKnowledgeMode.value;
                    activeKnowledge.value = name;
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

                const attachQuestionImageUrls = async (items) => window.Qisi.LibraryImageResources.attachImageUrls({
                    items: items || [],
                    storage: storageRepository,
                    createObjectUrl: blob => URL.createObjectURL(blob),
                    rememberUrl: url => objectUrls.add(url),
                    applyOptionSplit,
                    warn: (message, payload) => console.warn(message, payload)
                });

                const loadData = async () => {
                    try {
                        objectUrls.forEach(url => URL.revokeObjectURL(url));
                        objectUrls.clear();
                        const snapshot = await window.Qisi.LibrarySnapshot.loadLibrarySnapshot({
                            storage: storageRepository,
                            draftPersistence: draftPersistenceService,
                            batchId: activeBatchId.value,
                            attachImages: attachQuestionImageUrls
                        });
                        questions.value = snapshot.questions;
                        buildQuestionFingerprintMaps(questions.value);
                        externalQuestions.value = snapshot.externalQuestions;
                        importBatches.value = snapshot.importBatches;
                        batchImportBatches.value = snapshot.recentTasks;
                        if (snapshot.activeDraft) {
                            batchImportFiles.value = snapshot.activeDraft.files;
                            batchDraftQuestions.value = snapshot.activeDraft.questions;
                            batchDraftImages.value = snapshot.activeDraft.images;
                        }
                        customTemplates.value = snapshot.customTemplates;
                        personalKnowledgeTree.value = snapshot.personalKnowledgeTree;
                    } catch (error) {
                        console.error('题库数据加载失败', error);
                        alert(`题库数据加载失败：${error?.message || error}`);
                    }
                };

                const auditQuestionLatexData = async () => {
                    const storedQuestions = await db.questions.toArray();
                    const imageRecords = await db.images.toArray();
                    const storedImageIds = new Set(
                        imageRecords.map(record => String(record?.id || '')).filter(Boolean)
                    );
                    const issues = [];

                    const inspectField = (question, fieldName, value) => {
                        const source = String(value || '');
                        if (!source) return;

                        const parsed = window.Qisi.Utils.tokenizeLatexSource(source);

                        for (const issue of parsed.issues) {
                            issues.push({
                                questionId: question.id,
                                field: fieldName,
                                type: issue.type,
                                detail: issue.preview
                            });
                        }

                        for (const segment of parsed.segments) {
                            if (segment.type !== 'math') continue;
                            const expression = String(segment.expression || '').replace(/\s*\n\s*/g, ' ').trim();
                            try {
                                window.katex.renderToString(expression, {
                                    throwOnError: true,
                                    strict: 'ignore'
                                });
                            } catch (error) {
                                issues.push({
                                    questionId: question.id,
                                    field: fieldName,
                                    type: 'katex-error',
                                    detail: error?.message || String(error),
                                    source: segment.raw
                                });
                            }
                        }

                        const imageRefs = [
                            ...source.matchAll(/\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/g),
                            ...source.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g)
                        ];
                        const questionImageIds = new Set(
                            (question.images || []).map(image => String(image?.id || '')).filter(Boolean)
                        );

                        for (const match of imageRefs) {
                            const imageId = String(match[1] || '').trim();
                            if (!questionImageIds.has(imageId)) {
                                issues.push({
                                    questionId: question.id,
                                    field: fieldName,
                                    type: 'image-not-in-question',
                                    detail: imageId
                                });
                            }
                            if (!storedImageIds.has(imageId)) {
                                issues.push({
                                    questionId: question.id,
                                    field: fieldName,
                                    type: 'image-blob-missing',
                                    detail: imageId
                                });
                            }
                        }

                        if (/MATHPROTECT|@@QISI_MATH_/.test(source)) {
                            issues.push({
                                questionId: question.id,
                                field: fieldName,
                                type: 'internal-token-leaked',
                                detail: source.slice(0, 160)
                            });
                        }
                    };

                    for (const question of storedQuestions) {
                        inspectField(question, 'stem', question.stem);
                        inspectField(question, 'answer', question.answer);
                        inspectField(question, 'solution', question.solution);
                        (question.options || []).forEach((option, index) => {
                            inspectField(question, `option${index}`, option);
                        });
                    }

                    console.table(issues);
                    return issues;
                };

                const backupStatus = reactive({});
                const backupWorkspace = Qisi.BackupWorkspace.createBackupWorkspace({
                    database: db, backup: Qisi.Backup, repository: storageRepository,
                    supported: typeof window.showDirectoryPicker === 'function',
                    mutationEvents: Dexie.on('storagemutated'),
                    pickDirectory: options => window.showDirectoryPicker(options),
                    withFileLock: work => navigator.locks.request('qisi-backup-files', work),
                    recordReport: (time, report) => { safeStorage.set('qisi_last_full_backup_at', String(time)); safeStorage.setJson('qisi_last_full_backup_report', report); },
                    onRestored: () => window.location.reload()
                }, backupStatus);
                backupWorkspace.start();
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

                const migrateSafeQuestionLatexData = async () => {
                    const changedCount = await libraryService
                        .migrateSafeQuestionLatexData();

                    await loadData();
                    console.log('[LATEX_MIGRATION][done]', { changedCount });
                    return changedCount;
                };

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

                const getExternalMatchInfo = (extQ) => {
                    const core = questionCoreFingerprint(extQ);
                    const stem = questionStemFingerprint(extQ);

                    const exact = coreFingerprintMap.value.get(core);
                    if (exact) {
                        const extAnswer = extQ.answer || '';
                        const localAnswer = exact.answer || '';
                        const answerConflict = hasText(extAnswer) && hasText(localAnswer) && !sameTextLoose(extAnswer, localAnswer);

                        if (answerConflict) {
                            return { status: 'answerConflict', matchedQuestion: exact, reason: '题干和选项基本一致，但答案不一致' };
                        }

                        const canFillAnswer = !hasText(exact.answer) && hasText(extQ.answer);
                        const canFillSolution = !hasText(exact.solution) && hasText(extQ.solution);
                        const canFillPersonalKnowledge = !hasText(getQuestionKnowledge(exact, 'personal')) && hasText(getQuestionKnowledge(extQ, 'personal'));
                        const canFillSystemKnowledge = !hasText(getQuestionKnowledge(exact, 'system')) && hasText(getQuestionKnowledge(extQ, 'system'));

                        if (canFillAnswer || canFillSolution || canFillPersonalKnowledge || canFillSystemKnowledge) {
                            return { status: 'fillable', matchedQuestion: exact, reason: '个人题库已有此题，但可补全答案、解析或知识点' };
                        }

                        return { status: 'existing', matchedQuestion: exact, reason: '个人题库已有完整相同题目' };
                    }

                    const similar = stem ? stemFingerprintMap.value.get(stem) : null;

                    if (similar && questionCoreFingerprint(similar) !== core) {
                        return { status: 'similar', matchedQuestion: similar, reason: '题干相同或高度相似，但选项或结构不同，需要人工确认' };
                    }

                    return { status: 'new', matchedQuestion: null, reason: '个人题库中未发现相同题目' };
                };

                const getExternalStatus = (extQ) => getExternalMatchInfo(extQ).status;

                const exportQuestionBankPackage = async () => {
                    try {
                        if (!window.JSZip) {
                            alert('JSZip 未加载，暂时无法导出题库数据。');
                            return;
                        }

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
                        const zip = new JSZip();
                        zip.file(
                            'manifest.json',
                            JSON.stringify(plan.manifest, null, 2)
                        );
                        zip.file(
                            'questions.json',
                            JSON.stringify(plan.questions, null, 2)
                        );

                        for (const row of plan.images) {
                            if (row?.blob) zip.file(`images/${row.id}.png`, row.blob);
                        }

                        const blob = await zip.generateAsync({ type: 'blob' });
                        downloadBlob(blob, plan.filename);
                    } catch (error) {
                        console.error('导出题库数据失败', error);
                        alert(`导出题库数据失败：${error?.message || error}`);
                    }
                };

                const openImportBankPicker = () => {
                    importBankInput.value?.click();
                };

                const handleImportBankFileChange = async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = null;
                    if (!file) return;
                    await previewQuestionBankPackage(file);
                };

                const parseQuestionBankPackage = async (file) => {
                    if (!window.JSZip) throw new Error('JSZip 未加载，暂时无法导入题库数据。');
                    const zip = await window.Qisi.ArchiveSecurity.load(JSZip, file, 'question-bank', { name: file.name || '', type: file.type || '' });
                    const manifestText = await zip.file('manifest.json')?.async('string');
                    const questionsText = await zip.file('questions.json')?.async('string');
                    if (!questionsText) throw new Error('题库数据包格式不正确：缺少 questions.json。');

                    const manifest = manifestText ? JSON.parse(manifestText) : {};
                    const rawQuestions = JSON.parse(questionsText);
                    if (!Array.isArray(rawQuestions)) throw new Error('题库数据包格式不正确：questions.json 不是数组。');

                    const sourceTeacher = manifest?.createdBy?.name || '外部教师';
                    const batchTitle = manifest?.title || file.name.replace(/\.zip$/i, '') || '导入题库';
                    const exportedAt = manifest?.exportedAt || '';
                    const imagePayloads = [];
                    const preparedQuestions = [];

                    let importOrder = 0;
                    for (const raw of rawQuestions) {
                        const cleanImages = [];
                        for (const img of raw.images || []) {
                            const oldId = img.id;
                            const newImgId = `img_pending_${importOrder}_${oldId || Math.random().toString(36).slice(2, 8)}`;
                            const filePath = img.file || (oldId ? `images/${oldId}.png` : '');
                            const imgFile = filePath ? zip.file(filePath) : null;
                            if (!imgFile) throw new Error('题库包缺少图片文件：' + filePath);
                            if (imgFile) {
                                imagePayloads.push({ tempId: newImgId, oldId, filePath, blob: await imgFile.async('blob') });
                            }
                            cleanImages.push({ ...img, tempId: newImgId, oldId, align: img.align || 'center' });
                        }
                        preparedQuestions.push({ raw, cleanImages, importOrder });
                        importOrder += 1;
                    }

                    const duplicateCandidates = await db.importBatches
                        .where('sourceTeacher').equals(sourceTeacher)
                        .toArray()
                        .catch(() => []);
                    const mayDuplicate = duplicateCandidates.some(batch => {
                        const sameTeacher = (batch.sourceTeacher || '') === sourceTeacher;
                        const sameTitle = (batch.title || '') === batchTitle;
                        const sameCount = Number(batch.questionCount || 0) === rawQuestions.length;
                        const sameExport = exportedAt && batch.exportedAt && Math.abs(new Date(batch.exportedAt).getTime() - new Date(exportedAt).getTime()) < 60 * 1000;
                        return sameTeacher && sameTitle && sameCount && (!exportedAt || sameExport);
                    });

                    return {
                        file,
                        manifest,
                        rawQuestions,
                        preparedQuestions,
                        imagePayloads,
                        sourceTeacher,
                        batchTitle,
                        exportedAt,
                        schemaVersion: manifest?.schemaVersion || 'unknown',
                        mayDuplicate
                    };
                };

                const previewQuestionBankPackage = async (file) => {
                    try {
                        pendingImportPreview.value = await parseQuestionBankPackage(file);
                    } catch (error) {
                        console.error('解析题库数据失败', error);
                        alert(`解析题库数据失败：${error?.message || error}`);
                    }
                };

                const cancelImportPreview = () => {
                    pendingImportPreview.value = null;
                };

                const confirmImportBankPreview = async () => {
                    if (!pendingImportPreview.value) return;
                    if (pendingImportPreview.value.mayDuplicate) {
                        const ok = confirm('这份题库数据可能已经导入过，是否继续？');
                        if (!ok) return;
                    }
                    await importQuestionBankPackage(toRaw(pendingImportPreview.value));
                };

                const importQuestionBankPackage = async (parsedPackage) => {
                    try {
                        const { file, manifest, rawQuestions, preparedQuestions, imagePayloads, sourceTeacher, batchTitle, exportedAt, schemaVersion } = parsedPackage;
                        const importedAt = Date.now();
                        const batchId = `batch_${importedAt}_${Math.random().toString(36).slice(2, 8)}`;
                        const batch = {
                            id: batchId,
                            sourceTeacher,
                            title: batchTitle,
                            fileName: file.name,
                            importedAt,
                            questionCount: rawQuestions.length,
                            imageCount: imagePayloads.length,
                            exportedAt,
                            schemaVersion,
                            importStatus: 'success'
                        };

                        const imageIdMap = new Map();
                        imagePayloads.forEach((img, idx) => {
                            imageIdMap.set(img.tempId, `ext_${batchId}_${img.oldId || idx}_${Math.random().toString(36).slice(2, 6)}`);
                        });

                        // 数据准备在调用方完成；写入只走仓储的单事务方法。
                        const imageRows = imagePayloads.map(img => ({
                            id: imageIdMap.get(img.tempId),
                            blob: img.blob,
                            createdAt: importedAt
                        }));
                        const questionRows = preparedQuestions.map(prepared => {
                            const raw = prepared.raw;
                            const importOrder = prepared.importOrder;
                            const sourceQuestionId = raw.id || `source_${importOrder}`;
                            const extId = `ext_${batchId}_${sourceQuestionId}_${importOrder}`;
                            const cleanImages = prepared.cleanImages.map(img => ({
                                ...img,
                                id: imageIdMap.get(img.tempId) || `ext_${batchId}_${img.oldId || importOrder}_${Math.random().toString(36).slice(2, 6)}`,
                                align: img.align || 'center'
                            }));
                            const extQ = {
                                ...raw,
                                id: extId,
                                sourceQuestionId,
                                sourceTeacher,
                                batchId,
                                importOrder,
                                importedAt,
                                processStatus: 'unprocessed',
                                detectedStatus: '',
                                linkedQuestionId: '',
                                images: cleanImages,
                                meta: { ...(raw.meta || {}), external: true, sourceTeacher, batchId },
                                sourceFingerprint: questionCoreFingerprint(raw),
                                sourceStemFingerprint: questionStemFingerprint(raw)
                            };
                            delete extQ.exportFingerprint;
                            delete extQ.exportStemFingerprint;
                            return extQ;
                        });
                        await storageRepository.importExternalBatch({
                            batch,
                            images: imageRows,
                            questions: questionRows
                        });

                        await loadData();
                        pendingImportPreview.value = null;
                        libraryKnowledgeMode.value = 'external';
                        activeKnowledge.value = null;
                        activeKnowledgeType.value = 'external';
                        activeExternalBatchId.value = batchId;
                        currentPage.value = 1;
                        view.value = 'library';

                        alert(`导入完成：已进入外部题库。\n来源：${sourceTeacher}\n题目数量：${rawQuestions.length}`);
                    } catch (error) {
                        console.error('导入题库数据失败', error);
                        alert(`导入失败，未写入题库数据：${error?.message || error}`);
                    }
                };

                const toggleExternalPick = (id) => {
                    if (selectedExternalIds.value.includes(id)) {
                        selectedExternalIds.value = selectedExternalIds.value.filter(x => x !== id);
                    } else {
                        selectedExternalIds.value.push(id);
                    }
                };

                const clearExternalSelection = () => {
                    selectedExternalIds.value = [];
                };

                const selectAllExternalOnPage = () => {
                    const ids = paginatedExternalQuestions.value.map(q => q.id);
                    const set = new Set(selectedExternalIds.value);
                    ids.forEach(id => set.add(id));
                    selectedExternalIds.value = [...set];
                };

                const openExternalConfirmPage = () => {
                    if (selectedExternalIds.value.length === 0) {
                        alert('请先选择要加入个人题库的题目。');
                        return;
                    }

                    confirmItems.value = selectedExternalIds.value
                        .map(id => externalQuestions.value.find(q => q.id === id))
                        .filter(Boolean)
                        .map(q => {
                            const matchInfo = getExternalMatchInfo(q);
                            return {
                                externalId: q.id,
                                question: q,
                                status: matchInfo.status,
                                matchedQuestionId: matchInfo.matchedQuestion?.id || '',
                                matchedQuestion: matchInfo.matchedQuestion ? JSON.parse(JSON.stringify(toRaw(matchInfo.matchedQuestion))) : null,
                                reason: matchInfo.reason,
                                action: defaultActionForExternalStatus(matchInfo.status),
                                personalKnowledge: '',
                                systemKnowledge: '',
                                expanded: false
                            };
                        });

                    batchPersonalKnowledge.value = '';
                    batchSystemKnowledge.value = '';
                    view.value = 'externalConfirm';
                };

                const applyBatchKnowledge = (type) => {
                    if (type === 'personal') {
                        confirmItems.value.forEach(item => { item.personalKnowledge = batchPersonalKnowledge.value; });
                    }
                    if (type === 'system') {
                        confirmItems.value.forEach(item => { item.systemKnowledge = batchSystemKnowledge.value; });
                    }
                };

                const copyExternalToPersonalQuestion = (extQ, item) => {
                    const now = Date.now();
                    const personalKnowledge = item.personalKnowledge || getQuestionKnowledge(extQ, 'personal') || '';
                    const systemKnowledge = item.systemKnowledge || getQuestionKnowledge(extQ, 'system') || '';
                    const primaryKnowledge = personalKnowledge || systemKnowledge ||
                        extQ.personalKnowledge || extQ.systemKnowledge ||
                        extQ.meta?.personalKnowledge || extQ.meta?.systemKnowledge ||
                        extQ.knowledge || extQ.meta?.knowledge || '';
                    const primaryKnowledgeType = personalKnowledge
                        ? 'personal'
                        : (systemKnowledge ? 'system' : (extQ.knowledgeType || extQ.meta?.knowledgeType || 'system'));
                    const sourceTags = Array.isArray(extQ.meta?.tags) ? extQ.meta.tags : (Array.isArray(extQ.tags) ? extQ.tags : []);
                    const tags = [
                        ...sourceTags,
                        '外部导入',
                        `来源_${extQ.sourceTeacher || '外部教师'}`
                    ].filter(Boolean);

                    return {
                        id: `q_${now}_${Math.random().toString(36).slice(2, 8)}`,
                        grade: extQ.grade || extQ.meta?.grade || '高一',
                        diff: extQ.diff || extQ.meta?.diff || '中等',
                        type: extQ.type || '解答题',
                        stem: extQ.stem || '',
                        options: Array.isArray(extQ.options) ? [...extQ.options] : ['', '', '', ''],
                        answer: extQ.answer || '',
                        solution: extQ.solution || '',
                        images: (extQ.images || []).map(img => ({ id: img.id, align: img.align || 'center' })),
                        knowledge: primaryKnowledge,
                        knowledgeType: primaryKnowledgeType,
                        systemKnowledge,
                        personalKnowledge,
                        meta: {
                            ...(extQ.meta || {}),
                            grade: extQ.grade || extQ.meta?.grade || '高一',
                            diff: extQ.diff || extQ.meta?.diff || '中等',
                            knowledge: primaryKnowledge,
                            knowledgeType: primaryKnowledgeType,
                            systemKnowledge,
                            personalKnowledge,
                            tags,
                            sources: [
                                ...(extQ.meta?.sources || []),
                                { type: 'external', sourceTeacher: extQ.sourceTeacher || '外部教师', batchId: extQ.batchId, externalId: extQ.id, addedAt: now }
                            ]
                        },
                        createdAt: now,
                        updatedAt: now
                    };
                };

                const buildFilledQuestionFromExternal = (localQ, extQ, item) => {
                    const now = Date.now();
                    const next = JSON.parse(JSON.stringify(toRaw(localQ)));
                    if (!hasText(next.answer) && hasText(extQ.answer)) next.answer = extQ.answer;
                    if (!hasText(next.solution) && hasText(extQ.solution)) next.solution = extQ.solution;
                    if (!next.meta) next.meta = {};

                    const personalToFill = item.personalKnowledge || getQuestionKnowledge(extQ, 'personal');
                    const systemToFill = item.systemKnowledge || getQuestionKnowledge(extQ, 'system');

                    if (!hasText(next.personalKnowledge) && personalToFill) {
                        next.personalKnowledge = personalToFill;
                        next.meta.personalKnowledge = personalToFill;
                    }
                    if (!hasText(next.systemKnowledge) && systemToFill) {
                        next.systemKnowledge = systemToFill;
                        next.meta.systemKnowledge = systemToFill;
                    }

                    const primaryKnowledge = next.personalKnowledge || next.systemKnowledge || next.knowledge || '';
                    const primaryKnowledgeType = next.personalKnowledge ? 'personal' : (next.systemKnowledge ? 'system' : next.knowledgeType || 'system');
                    next.knowledge = primaryKnowledge;
                    next.knowledgeType = primaryKnowledgeType;
                    next.meta.knowledge = primaryKnowledge;
                    next.meta.knowledgeType = primaryKnowledgeType;

                    const oldTags = Array.isArray(next.meta.tags) ? next.meta.tags : (Array.isArray(next.tags) ? next.tags : []);
                    next.meta.tags = [...new Set([...oldTags, '外部补全', `来源_${extQ.sourceTeacher || '外部教师'}`])];
                    next.meta.sources = [
                        ...(next.meta.sources || []),
                        { type: 'external-fill', sourceTeacher: extQ.sourceTeacher || '外部教师', batchId: extQ.batchId, externalId: extQ.id, filledAt: now }
                    ];
                    next.updatedAt = now;
                    return next;
                };

                const confirmAddExternalToPersonal = async () => {
                    try {
                        const unresolved = window.Qisi.LibraryExternalMerge
                            .countUnresolved(confirmItems.value);

                        if (unresolved > 0) {
                            const ok = confirm(`还有 ${unresolved} 道疑似同题或答案冲突题未处理。是否跳过这些题并继续？`);
                            if (!ok) return;
                        }

                        const now = Date.now();
                        const operations = window.Qisi.LibraryExternalMerge.buildMergeOperations({
                            items: confirmItems.value,
                            findQuestion: id => questions.value.find(question => question.id === id),
                            getMatchInfo: getExternalMatchInfo,
                            fillQuestion: buildFilledQuestionFromExternal,
                            copyQuestion: copyExternalToPersonalQuestion
                        });
                        if (!operations.length) return;

                        const result = await libraryService.commitExternalMerge({
                            id: `merge_${now}_${Math.random().toString(36).slice(2, 8)}`,
                            createdAt: now,
                            operations
                        });
                        const {
                            added = 0,
                            filled = 0,
                            skipped = 0
                        } = result.summary || {};

                        await loadData();
                        selectedExternalIds.value = [];
                        externalPickMode.value = false;
                        view.value = 'library';
                        libraryKnowledgeMode.value = 'external';
                        alert(`处理完成：新增 ${added} 道，补全 ${filled} 道，跳过 ${skipped} 道。`);
                    } catch (error) {
                        console.error('加入个人题库失败', error);
                        alert(`加入个人题库失败：${error?.message || error}`);
                    }
                };

                const undoLatestExternalMerge = async () => {
                    const latest = await libraryService
                        .getLatestReversibleExternalMerge();
                    if (!latest) {
                        alert('暂无可撤销的加入记录。');
                        return;
                    }
                    const ok = confirm(`确定撤销最近一次加入吗？\n新增 ${latest.summary?.added || 0} 道、补全 ${latest.summary?.filled || 0} 道、跳过 ${latest.summary?.skipped || 0} 道将恢复到处理前状态。`);
                    if (!ok) return;

                    try {
                        await libraryService.undoExternalMerge({
                            mergeBatchId: latest.id,
                            revertedAt: Date.now()
                        });
                        await loadData();
                        alert('已撤销最近一次加入。');
                    } catch (error) {
                        console.error('撤销加入失败', error);
                        alert(`撤销失败：${error?.message || error}`);
                    }
                };

                const deleteExternalBatch = async (batchId) => {
                    const batch = importBatches.value.find(b => b.id === batchId);
                    if (!batch) return;
                    const ok = confirm(`确定删除导入批次「${batch.title || '导入题库'}」吗？\n只会删除外部题库暂存题，不会删除正式题库。`);
                    if (!ok) return;
                    await storageRepository.deleteExternalBatch(batchId);
                    if (activeExternalBatchId.value === batchId) activeExternalBatchId.value = null;
                    await loadData();
                };

                const recalculateExternalBatchStatus = async (batchId) => {
                    await storageRepository.recalcExternalBatchStatus(
                        batchId,
                        row => ({ detectedStatus: getExternalMatchInfo(row).status })
                    );
                    await loadData();
                    alert('已重新计算本批次题目状态。');
                };

                onMounted(async () => {
                    try {
                        if (navigator.storage?.persist) await navigator.storage.persist();
                    } catch (error) {
                        console.warn('持久化存储权限申请被跳过', error);
                    }
                    await loadData();
                    const savedCart = safeStorage.json('qisi_exam_cart', []);
                    if (Array.isArray(savedCart)) cart.value = savedCart;
                    Object.assign(examQuestionMeta, safeStorage.json('qisi_exam_question_meta', {}) || {});
                    try {
                        restoringExamConfig.value = true;
                        const savedTemplate = safeStorage.get('qisi_exam_template', DEFAULT_PRESET_KEY) || DEFAULT_PRESET_KEY;
                        const hasSavedTemplate = !!EXAM_LAYOUT_PRESETS[savedTemplate] || customTemplates.value.some(t => t.id === savedTemplate);
                        selectedExamTemplate.value = hasSavedTemplate ? savedTemplate : DEFAULT_PRESET_KEY;
                        // qisi_exam_config 现在带 template 标记：只认本模板自己的临时改动，
                        // 避免在 A 模板调好的字号跑到 B 模板上去。
                        const savedRaw = hasSavedTemplate ? safeStorage.json('qisi_exam_config', null) : null;
                        const savedConfig = savedRaw && savedRaw.template
                            ? (savedRaw.template === selectedExamTemplate.value ? savedRaw.config : null)
                            : savedRaw;
                        Object.assign(examConfig, EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY].config, examPresets.value[selectedExamTemplate.value]?.config || {}, savedConfig || {});
                        Object.assign(examGroupConfig, safeStorage.json('qisi_exam_group_config', {}) || {});
                        nextTick(() => { restoringExamConfig.value = false; });
                    } catch (e) {
                        Object.assign(examConfig, EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY].config);
                        restoringExamConfig.value = false;
                    }
                    try {
                        const parsed = safeStorage.json('qisi_draft_v2', null);
                        if (parsed && typeof parsed === 'object') {
                            Object.assign(entryForm, parsed);
                            if(!Array.isArray(entryForm.options)) entryForm.options = ['', '', '', ''];
                            if(!Array.isArray(entryForm.images)) entryForm.images = [];
                            if(typeof entryForm.tags !== 'string') entryForm.tags = '';
                            if(!entryForm.knowledgeType) entryForm.knowledgeType = 'system';
                            if(!entryForm.systemKnowledge && entryForm.knowledgeType === 'system') entryForm.systemKnowledge = entryForm.knowledge || '';
                            if(!entryForm.personalKnowledge && entryForm.knowledgeType === 'personal') entryForm.personalKnowledge = entryForm.knowledge || '';
                            syncEntryLegacyKnowledge();
                        }
                    } catch (e) { console.warn('[ENTRY_DRAFT][restore-failed]', { code: 'ENTRY_DRAFT_RESTORE_FAILED' }); }
                    
                    const isCustom = customTemplates.value.find(t => t.code === latexTemplate.value);
                    if (isCustom) { editMode.value = 'custom'; currentPresetKey.value = isCustom.id; editTplName.value = isCustom.name; } 
                    else {
                        const isSystem = allTemplateCards.value.find(t => t.system && t.code === latexTemplate.value);
                        if (isSystem) { editMode.value = 'system'; currentPresetKey.value = isSystem.id; editTplName.value = isSystem.name; } 
                        else { editMode.value = 'new'; currentPresetKey.value = ''; editTplName.value = '我的修改模板'; }
                    }
                    syncExamGroups();
                    const savedView = safeStorage.get('qisi_last_view');
                    if (['entry', 'batchImport', 'library', 'exam', 'personal', 'template'].includes(savedView)) view.value = savedView;
                });

                watch(examConfig, (val) => {
                    // 带 template 标记：恢复时只认本模板自己的临时改动。
                    safeStorage.setJson('qisi_exam_config', { template: selectedExamTemplate.value, config: toRaw(val) });
                    examTitle.value = val.title || examTitle.value;
                }, { deep: true });

                watch(examGroupConfig, (val) => {
                    safeStorage.setJson(
                        'qisi_exam_group_config',
                        toRaw(val)
                    );
                }, { deep: true });

                watch(selectedExamTemplate, (key) => {
                    safeStorage.set('qisi_exam_template', key);
                    if (restoringExamConfig.value) return;
                    // 切模板时按模板自身配置重建；缺了这步，自定义模板会退回默认版式。
                    Object.assign(examConfig, EXAM_LAYOUT_PRESETS[DEFAULT_PRESET_KEY].config, examPresets.value[key]?.config || {});
                    if (PRESET_TEMPLATES[key] && editMode.value === 'system' && currentPresetKey.value !== key) {
                        const tpl = getTemplateCard(key, PRESET_TEMPLATES[key]);
                        currentPresetKey.value = tpl.id;
                        editTplName.value = tpl.name;
                        latexTemplate.value = tpl.code;
                    }
                });

                watch(entryForm, (val) => {
                    if (val.stem || (Array.isArray(val.images) && val.images.length > 0)) {
                        const saveObj = {...val, images: (Array.isArray(val.images) ? val.images : []).map(i => ({id: i.id, align: i.align}))};
                        safeStorage.setJson('qisi_draft_v2', saveObj);
                    }
                }, { deep: true });

                const handleDrop = (e) => { isDraggingImg.value = false; if (e.dataTransfer.files[0]) handleEntryImgUpload(e.dataTransfer.files[0]); };
                const handleFileChange = (e) => { if (e.target.files[0]) handleEntryImgUpload(e.target.files[0]); e.target.value = null; };
                const handleOcrDrop = (e) => { isDraggingOcr.value = false; if (e.dataTransfer.files[0]) handleOcrFile(e.dataTransfer.files[0]); };
                
                const handleEntryImgUpload = (file) => {
                    const reader = new FileReader(); 
                    reader.onload = (e) => {
                        const id = 'img_' + Math.random().toString(36).substring(2,8);
                        entryForm.images.push({ id, url: e.target.result, align: 'center' }); // 默认居中设好
                        entryForm[entryTab.value] += `\n\\begin{center}[[IMAGE:${id}]]\\end{center}\n`;
                        // 图片一进来就落库。草稿只留 id 和 align（不留 base64），
                        // 否则刷新一次草稿就把图丢了，提交后题目带着空图引用入库，
                        // 之后整个题库都无法导出。
                        fetch(e.target.result).then(res => res.blob())
                            .then(blob => db.images.put({ id, blob, createdAt: Date.now() }))
                            .catch(error => console.warn('[ENTRY_IMAGE][persist-failed]', { id, message: error?.message }));
                    }; 
                    reader.readAsDataURL(file);
                };

                const handleEntryPaste = (e) => {
                    const items = e.clipboardData?.items;
                    if (items) {
                        for (let i=0; i<items.length; i++) {
                            if (items[i].kind === 'file') {
                                e.preventDefault();
                                handleEntryImgUpload(items[i].getAsFile());
                            }
                        }
                    }
                };

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
                let submitInFlight = false;

                const submitQuestion = async () => {
                    if (submitInFlight) return;
                    submitInFlight = true;
                    if(!entryForm.stem.trim()) {
                        submitInFlight = false;
                        alert('题干为空，先把 OCR 内容送入题干或手动输入题目。');
                        return;
                    }

                    try {
                        const now = Date.now();
                        syncEntryLegacyKnowledge();
                        const plan = window.Qisi.ManualEntryModel.buildManualQuestion({
                            form: toRaw(entryForm),
                            now,
                            splitQuestion: splitQuestionForStorage,
                            images: toRaw(entryForm.images)
                        });
                        const newQ = plan.question;

                        const imageRecords = [];
                        const lostImageIds = [];
                        for (const img of entryForm.images) {
                            if (img?.url && img.url.startsWith('data:')) {
                                const blob = await (await fetch(img.url)).blob();
                                imageRecords.push({
                                    id: img.id,
                                    blob,
                                    createdAt: now
                                });
                            } else if (img?.id) {
                                // 刷新过页面：草稿里只剩 id，二进制在图片库里。
                                const stored = await db.images.get(img.id);
                                if (stored?.blob) {
                                    imageRecords.push({ id: img.id, blob: stored.blob, createdAt: now });
                                } else {
                                    lostImageIds.push(img.id);
                                }
                            }
                        }
                        // 不许带着悬空图片引用入库：那会让整个题库导出时报
                        // 「题库缺少图片数据」，一次手滑锁死全部导出。
                        if (lostImageIds.length) {
                            throw new Error('这几张图片没有存进来：' + lostImageIds.join('、') +
                                '。请删掉重新粘贴，否则这道题会带着空图入库。');
                        }

                        await libraryService.saveQuestion(newQ, {
                            imageRecords,
                            confirmationToken: `manual-entry:${newQ.id}`
                        });

                        entryForm.stem = ''; entryForm.options = ['', '', '', '']; entryForm.answer = ''; entryForm.solution = ''; entryForm.images = [];
                        safeStorage.remove('qisi_draft_v2');
                        activeKnowledge.value = null;
                        currentPage.value = 1;
                        await loadData();

                        view.value = 'library';
                        submitInFlight = false;
                    } catch (error) {
                        console.error('保存入库失败', error);
                        alert(`保存入库失败：${error?.message || error}`);
                        submitInFlight = false;
                    }
                };

                const toggleCart = (id) => { 
                    if (cart.value.includes(id)) cart.value = cart.value.filter(i => i !== id); 
                    else {
                        cart.value.push(id);
                        syncExamMeta();
                    }
                };
                const moveCartQuestion = (id, dir) => {
                    const q = questions.value.find(item => item?.id === id);
                    if (!q) return;
                    const type = q.type || '其他题型';
                    const typeIds = cart.value.filter(cartId => {
                        const item = questions.value.find(question => question?.id === cartId);
                        return item && (item.type || '其他题型') === type;
                    });
                    const idx = typeIds.indexOf(id);
                    const next = idx + dir;
                    if (idx < 0 || next < 0 || next >= typeIds.length) return;
                    reorderQuestionWithinType(id, next);
                };
                const examDisplayIndex = (id) => {
                    let index = 1;
                    for (const group of activeExamGroups.value) {
                        for (const item of group.items) {
                            if (item.id === id) return index;
                            index += 1;
                        }
                    }
                    return index;
                };

                const reorderQuestionWithinType = (sourceId, targetIndex) => {
                    const result = window.Qisi.ExamGroups.reorderWithinType({
                        sourceId,
                        targetIndex,
                        cart: cart.value,
                        questions: questions.value
                    });
                    if (result.changed) cart.value = result.cart;
                    return result.changed;
                };

                let examDragCleanup = null;
                const startExamPointerDrag = (id, e) => {
                    if (e?.button !== undefined && e.button !== 0) return;
                    if (e?.target?.closest?.('button,input,select,textarea,a')) return;
                    const card = e?.currentTarget?.classList?.contains('exam-edit-card') ? e.currentTarget : e?.currentTarget?.closest?.('.exam-edit-card');
                    if (!card) return;
                    const section = card.closest('.exam-group-block');
                    if (!section) return;
                    e.preventDefault?.();

                    if (examDragCleanup) examDragCleanup(true);

                    const startY = e.clientY;
                    let started = false;
                    let targetIndex = 0;
                    let sourceIndex = 0;
                    let rects = [];
                    const previousSelect = document.body.style.userSelect;
                    card.setPointerCapture?.(e.pointerId);

                    let lastY = startY;
                    let frame = 0;
                    const cardsInSection = () => [...section.querySelectorAll('.exam-edit-card[data-exam-qid]')]
                        .filter(el => el.dataset.examQid);
                    const typeIndexOf = () => {
                        const sourceQ = questions.value.find(q => q?.id === id);
                        const type = sourceQ?.type || '其他题型';
                        return cart.value.filter(cartId => {
                            const q = questions.value.find(item => item?.id === cartId);
                            return q && (q.type || '其他题型') === type;
                        }).indexOf(id);
                    };
                    const beginDrag = () => {
                        if (started) return;
                        started = true;
                        sourceIndex = typeIndexOf();
                        targetIndex = sourceIndex;
                        rects = cardsInSection().map(el => {
                            const box = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return { el, top: box.top, height: box.height, gap: parseFloat(style.marginBottom) || 0 };
                        });
                        rects.forEach(item => {
                            item.el.style.transition = 'transform .18s ease-out, box-shadow .18s ease, border-color .18s ease';
                            item.el.style.willChange = 'transform';
                        });
                        card.style.transition = 'box-shadow .18s ease, border-color .18s ease';
                        card.style.zIndex = '8';
                        document.body.style.userSelect = 'none';
                        document.body.classList.add('exam-drag-active');
                        draggingExamQuestionId.value = id;
                        dragOverExamQuestionId.value = '';
                    };
                    const paintDrag = () => {
                        frame = 0;
                        const sourceItem = rects.find(item => item.el === card);
                        if (!sourceItem) return;
                        const sourceStep = sourceItem.height + sourceItem.gap;
                        const dragOffset = lastY - startY;
                        const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
                        rects.forEach((item, index) => {
                            if (item.el === card) return;
                            let offset = 0;
                            if (dragOffset > 0 && index > sourceIndex) {
                                const delay = Math.max(0, item.top - sourceItem.top - sourceStep);
                                offset = -clamp(dragOffset - delay, 0, sourceStep);
                            }
                            if (dragOffset < 0 && index < sourceIndex) {
                                const delay = Math.max(0, sourceItem.top - item.top - sourceStep);
                                offset = clamp(-dragOffset - delay, 0, sourceStep);
                            }
                            item.el.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
                        });
                        card.style.transform = `translate3d(0, ${dragOffset}px, 0)`;
                    };
                    const updateTarget = (clientY) => {
                        let nextIndex = rects.length - 1;
                        for (let i = 0; i < rects.length; i += 1) {
                            const center = rects[i].top + rects[i].height / 2;
                            if (clientY < center) {
                                nextIndex = i;
                                break;
                            }
                        }
                        targetIndex = Math.max(0, Math.min(nextIndex, rects.length - 1));
                        dragOverExamQuestionId.value = '';
                    };
                    const onMove = (ev) => {
                        if (ev.pointerId !== e.pointerId) return;
                        lastY = ev.clientY;
                        if (!started && Math.abs(lastY - startY) < 6) return;
                        beginDrag();
                        ev.preventDefault();
                        updateTarget(lastY);
                        if (!frame) frame = requestAnimationFrame(paintDrag);
                    };
                    const cleanup = (immediate = false) => {
                        document.removeEventListener('pointermove', onMove);
                        document.removeEventListener('pointerup', onEnd);
                        document.removeEventListener('pointercancel', onEnd);
                        card.releasePointerCapture?.(e.pointerId);
                        document.body.style.userSelect = previousSelect;
                        if (frame) cancelAnimationFrame(frame);
                        draggingExamQuestionId.value = '';
                        dragOverExamQuestionId.value = '';
                        const shouldAnimateReorder = started && !immediate && targetIndex !== sourceIndex;
                        if (!shouldAnimateReorder) document.body.classList.remove('exam-drag-active');
                        const clearStyles = () => {
                            rects.forEach(item => {
                                item.el.style.transform = '';
                                item.el.style.transition = '';
                                item.el.style.willChange = '';
                                item.el.style.zIndex = '';
                            });
                        };
                        if (shouldAnimateReorder) {
                            const visualTopById = new Map(rects.map(item => [item.el.dataset.examQid, item.el.getBoundingClientRect().top]));
                            rects.forEach(item => {
                                item.el.style.transition = 'none';
                                item.el.style.transform = '';
                                item.el.style.zIndex = '';
                            });
                            reorderQuestionWithinType(id, targetIndex);
                            nextTick(() => {
                                const freshCards = cardsInSection();
                                freshCards.forEach(el => {
                                    const firstTop = visualTopById.get(el.dataset.examQid);
                                    if (firstTop === undefined) return;
                                    const delta = firstTop - el.getBoundingClientRect().top;
                                    if (Math.abs(delta) > 1) {
                                        el.style.transition = 'none';
                                        el.style.transform = `translate3d(0, ${delta}px, 0)`;
                                        el.style.willChange = 'transform';
                                    }
                                });
                                requestAnimationFrame(() => {
                                    freshCards.forEach(el => {
                                        el.style.transition = 'transform .18s ease-out';
                                        el.style.transform = '';
                                    });
                                    setTimeout(() => {
                                        freshCards.forEach(el => {
                                            el.style.transition = '';
                                            el.style.willChange = '';
                                            el.style.zIndex = '';
                                        });
                                        document.body.classList.remove('exam-drag-active');
                                    }, 200);
                                });
                            });
                        } else {
                            clearStyles();
                        }
                        if (examDragCleanup === cleanup) examDragCleanup = null;
                    };
                    const onEnd = (ev) => {
                        if (ev.pointerId !== e.pointerId) return;
                        cleanup();
                    };

                    examDragCleanup = cleanup;
                    document.addEventListener('pointermove', onMove, { passive: false });
                    document.addEventListener('pointerup', onEnd);
                    document.addEventListener('pointercancel', onEnd);
                };
                const dropExamQuestion = (targetId) => {
                    const sourceId = draggingExamQuestionId.value;
                    draggingExamQuestionId.value = '';
                    dragOverExamQuestionId.value = '';
                    if (!sourceId || sourceId === targetId) return;
                    const sourceQ = questions.value.find(q => q.id === sourceId);
                    const targetQ = questions.value.find(q => q.id === targetId);
                    if (!sourceQ || !targetQ || sourceQ.type !== targetQ.type) return;
                    const typeIds = cart.value.filter(id => {
                        const q = questions.value.find(item => item?.id === id);
                        return q && q.type === sourceQ.type;
                    });
                    const targetIndex = typeIds.filter(id => id !== sourceId).indexOf(targetId);
                    if (targetIndex >= 0) reorderQuestionWithinType(sourceId, targetIndex);
                };
                const resetExamOrder = () => { cart.value = [...cart.value].sort((a, b) => String(a).localeCompare(String(b))); };
                const clearCart = () => { if (confirm("确定清空试卷篮吗？")) cart.value = []; };
                const deleteQuestion = async (id) => {
                    await libraryService.softDelete(id);
                    await loadData();
                    cart.value = cart.value.filter(i => i !== id);
                };
                
                const saveEditedQuestion = async (id, stem, imgs, g, t, d, ans, sol, tagsStr, opts, knowledge, systemKnowledgeArg = '', personalKnowledgeArg = '') => {
                    const q = questions.value.find(q => q.id === id);
                    if(q) {
                        const expectedUpdatedAt = q.updatedAt;
                        const next = JSON.parse(JSON.stringify(toRaw(q)));
                        const now = Date.now();
                        const imageRecords = [];
                        for (const img of imgs || []) {
                            if (img?.url && img.url.startsWith('data:')) {
                                const blob = await (await fetch(img.url)).blob();
                                imageRecords.push({
                                    id: img.id,
                                    blob,
                                    createdAt: now
                                });
                            }
                        }
                        next.stem = stem;
                        next.images = (imgs || []).filter(i => i && i.id).map(i => ({ id: i.id, align: i.align || 'center' }));
                        next.type = t; next.answer = ans; next.solution = sol; next.options = opts;
                        next.grade = g; next.diff = d;
                        const systemKnowledge = systemKnowledgeArg || '';
                        const personalKnowledge = personalKnowledgeArg || '';
                        const primaryKnowledge = personalKnowledge || systemKnowledge || knowledge || '';
                        const primaryKnowledgeType = personalKnowledge ? 'personal' : 'system';
                        next.knowledge = primaryKnowledge;
                        next.knowledgeType = primaryKnowledgeType;
                        if(!next.meta) next.meta = {};
                        next.systemKnowledge = systemKnowledge;
                        next.personalKnowledge = personalKnowledge;
                        next.meta.systemKnowledge = systemKnowledge;
                        next.meta.personalKnowledge = personalKnowledge;
                        next.meta.grade = g; next.meta.diff = d; next.meta.knowledge = primaryKnowledge; next.meta.knowledgeType = primaryKnowledgeType; next.meta.tags = String(tagsStr || '').split(',').filter(x => x.trim());
                        next.userEdited = true;
                        next.updatedAt = now;
                        await libraryService.replaceQuestion(next, {
                            expectedUpdatedAt,
                            imageRecords
                        });
                    }
                    await loadData();
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
                            images: this.images || []
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

                const formatLatexForPrint = (text) => root.Qisi.HandoutFormulaGate.preparePrintSource(text);

                const escapeHtml = (text) => String(text || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');

                const printImageHtml = (img, align = 'center') => {
                    const imageUrl = window.Qisi.QuestionImagePolicy.displayImageUrl(img?.url);
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

                const renderPrintPositionedImageBlocks = (source = '', images = []) => {
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
                                return image
                                    ? printImageHtml(image, side === 'l' ? 'flushleft' : 'flushright')
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`;
                            }
                        )
                        .replace(
                            /\\begin\{(center|flushleft|flushright)\}[\s\S]*?\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\][\s\S]*?\\end\{\1\}/g,
                            (block, environment, id) => {
                                const image = findPrintImage(id);
                                return image
                                    ? printImageHtml(image, environment)
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`;
                            }
                        )
                        .replace(
                            /\[\[(?:IMAGE|FORMULA_IMAGE):([^\]]+)\]\]/g,
                            (match, id) => {
                                const image = findPrintImage(id);
                                return image
                                    ? printImageHtml(image, 'center')
                                    : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`;
                            }
                        );
                };

                const renderPrintTextChunk = (text, images = []) => {
                    const htmlChunks = [];
                    const protectHtml = (html) => {
                        const token = `@@QISI_PRINT_IMAGE_${htmlChunks.length}@@`;
                        htmlChunks.push(html);
                        return token;
                    };
                    const withTokenImages = renderPrintPositionedImageBlocks(text, images)
                        .replace(/<img class="print-image[\s\S]*?alt="题图" \/>|<span class="missing-image">[\s\S]*?<\/span>/g, protectHtml);
                    const escaped = escapeHtml(withTokenImages)
                        .replace(/\n{2,}/g, '<br><br>')
                        .replace(/\n/g, '');
                    const withWrapFigures = escaped.replace(
                        /\\begin\{wrapfigure\}\s*\{([lr])\}\s*\{[^}]+\}[\s\S]*?\\includegraphics(?:\[.*?\])?\{([^}]+)\}[\s\S]*?\\end\{wrapfigure\}/g,
                        (match, side, id) => {
                            const img = (images || []).find(item => String(item.id) === String(id).trim());
                            return img
                                ? printImageHtml(img, side === 'l' ? 'flushleft' : 'flushright')
                                : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`;
                        }
                    );
                    const withImages = withWrapFigures.replace(/(?:\\begin\{(center|flushleft|flushright)\}\s*)?\\includegraphics(?:\[.*?\])?\{([^}]+)\}(?:\s*\\end\{(?:center|flushleft|flushright)\})?/g, (match, align, id) => {
                        const img = (images || []).find(item =>
                            String(item.id || '') === String(id).trim() ||
                            String(item.filename || '') === String(id).trim() ||
                            String(item.name || '') === String(id).trim()
                        );
                        return img ? printImageHtml(img, align) : `<span class="missing-image">[丢失:${escapeHtml(id)}]</span>`;
                    });
                    let restored = withImages;
                    htmlChunks.forEach((chunk, index) => {
                        restored = restored.replace(`@@QISI_PRINT_IMAGE_${index}@@`, chunk);
                    });
                    return applyPrintWritingRules(restored);
                };

                const normalizeMathExpressionForPrint = root.Qisi.HandoutFormulaGate.normalizeForKatex;

                const renderLatexForPrint = (text, images = []) => {
                    const source = formatLatexForPrint(text).replace(/<br><br>/g, '\n\n');
                    if (!source) return '';

                    const parsed = window.Qisi.Utils.tokenizeLatexSource(source);

                    if (parsed.issues.length) {
                        console.warn('[PRINT_LATEX][delimiter-issues]', { content: source, issues: parsed.issues });
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
                                if (!window.katex) throw new Error('KaTeX 尚未加载');
                                return window.katex.renderToString(expression, {
                                    displayMode: Boolean(segment.displayMode),
                                    throwOnError: true,
                                    strict: 'ignore',
                                    trust: false
                                });
                            } catch (error) {
                                console.warn('[PRINT_LATEX][failed]', {
                                    raw: segment.raw,
                                    expression,
                                    message: error?.message || String(error)
                                });

                                return '<span class="latex-render-error">[公式语法错误] ' + escapeHtml(segment.raw || expression) + '</span>';
                            }
                        })
                        .join('');
                };

                const hydrateQuestionsForPrint = async (qs) => {
                    const ids = [...new Set(qs.flatMap(q => (q.images || []).map(img => img.id)).filter(Boolean))];
                    const imageRows = ids.length ? await db.images.where('id').anyOf(ids).toArray() : [];
                    return Promise.all(qs.map(async q => {
                        const clone = { ...q, meta: q.meta ? { ...q.meta } : undefined, options: [...(q.options || [])] };
                        clone.images = await Promise.all((q.images || []).map(async img => {
                            const row = imageRows.find(item => item.id === img.id);
                            if (row?.blob) return { ...img, url: await blobToDataUrl(row.blob) };
                            return { ...img };
                        }));
                        return clone;
                    }));
                };

                const buildHeaderFields = () => window.Qisi.ExamPaperParts.buildHeaderFields({
                    show: examConfig.showHeaderFields,
                    template: selectedExamTemplate.value
                });

                const buildAnswerGrid = (count) => window.Qisi.ExamPaperParts.buildAnswerGrid({
                    show: examConfig.showAnswerGrid,
                    count,
                    config: examConfig
                });

                const buildNotice = () => window.Qisi.ExamPaperParts.buildNotice({
                    show: examConfig.showNotice,
                    template: selectedExamTemplate.value
                });

                const buildAnswerContent = (qs, forceNewPage = true) => window.Qisi.ExamPaperParts.buildAnswerContent({
                    questions: qs,
                    forceNewPage,
                    render: renderLatexForPrint
                });

                const buildPrintOptionsHtml = (q) => {
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

                const buildQuestionContent = (qs = cartQuestionsOrdered.value) => {
                    const groups = getExamGroupsForQuestions(qs);
                    const headerClass = selectedExamTemplate.value === 'quizSheet' ? 'header quiz-sheet-header' : 'header';
                    let content = `${examConfig.showCornerMarks ? '<div class="corner-marks"><i></i><i></i><i></i><i></i></div>' : ''}<main class="${examConfig.compactMode ? 'paper-compact' : ''} ${selectedExamTemplate.value === 'quizSheet' ? 'paper-quiz-sheet' : ''}">${selectedExamTemplate.value === 'examZh' && examConfig.showSecretMark ? '<div class="secret-mark">绝密 ★ 启用前</div>' : ''}<div class="${headerClass}">
                        <div class="title" style="font-size:24px;font-weight:bold;margin-bottom:8px;">${escapeHtml(examConfig.title || examTitle.value)}</div>
                        ${examConfig.subtitle ? `<div class="subtitle">${escapeHtml(examConfig.subtitle)}</div>` : ''}
                        ${examConfig.organizer ? `<div class="organizer">组卷人：${escapeHtml(examConfig.organizer)}</div>` : ''}
                        ${buildHeaderFields()}
                        ${buildAnswerGrid(qs.length)}
                        ${buildNotice()}
                    </div>`;

                    let printIndex = 1;
                    groups.forEach((group, groupIndex) => {
                        const sectionNo = CHINESE_SECTION_NUMBERS[groupIndex] || String(groupIndex + 1);
                        content += `<div class="group-title">${sectionNo}、${escapeHtml(groupSummaryText(group))}</div>`;
                        group.items.forEach((q) => {
                            const meta = examQuestionMeta[q.id] || {};
                            const safeStem = renderLatexForPrint(q.stem, q.images || []);
                            const optionsHtml = buildPrintOptionsHtml(q);

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

                // 打印窗口里的字体栈与字号档位。
                // 全部用 Windows 自带字体的名字，老师电脑上一定装得到，
                // 不会出现「选了楷体结果印成默认宋体」。
                const PRINT_FONT_STACKS = {
                    '思源宋体': '"SimSun", "Songti SC", serif',
                    '霞鹜文楷': '"KaiTi", "STKaiti", serif',
                    '黑体': '"SimHei", "Heiti SC", sans-serif',
                    '微软雅黑': '"Microsoft YaHei", "PingFang SC", sans-serif'
                };
                const PRINT_FONT_SIZES = { '三号': '21px', '四号': '19px', '小四': '16px', '五号': '14px', '小五': '12px' };

                const openPrintWindow = (content, title = '试卷打印') => {
                    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${escapeHtml(new URL('./vendor/katex/katex.min.css', window.location.href).href)}"/>
<style>
body {
    font-family: ${PRINT_FONT_STACKS[examConfig.fontFamily] || PRINT_FONT_STACKS['思源宋体']};
    padding:24px;
    color:#111;
    line-height:1.8;
    font-size:${PRINT_FONT_SIZES[examConfig.fontSize] || PRINT_FONT_SIZES['小四']};
}
.subtitle,.organizer { font-size:14px; color:#333; }
.notice { margin:12px auto 0; padding:0; border:0; text-align:left; font-size:13px; }
.exam-notice { max-width:100%; line-height:1.55; }
.exam-notice b { display:block; margin-bottom:3px; }
.exam-notice ol { margin:0; padding-left:1.8em; text-align:left; }
.secret-mark { font-weight:bold; margin-bottom:12px; }
.header { text-align:center; margin-bottom:24px; border-bottom:0; padding-bottom:0; }
.quiz-sheet-header { margin-bottom:16px; }
.student-fields { display:flex; justify-content:center; gap:14mm; margin:8px 0 6px; font-weight:bold; }
.student-fields span { display:inline-flex; align-items:flex-end; gap:2mm; white-space:nowrap; }
.student-fields i { display:inline-block; width:34mm; border-bottom:1px solid #111; transform:translateY(-2px); }
.answer-grid-wrap { display:flex; flex-direction:column; align-items:center; gap:4mm; margin:4px 0 7mm; }
.answer-grid { border-collapse:collapse; font-weight:bold; }
.answer-grid th,.answer-grid td { border:1px solid #111; min-width:12mm; height:8mm; text-align:center; padding:0 2mm; }
.answer-grid th { min-width:13mm; }
.answer-lines { display:grid; grid-template-columns:repeat(3, 1fr); gap:8mm; width:82%; font-weight:bold; }
.answer-lines span { display:flex; align-items:flex-end; gap:2mm; }
.answer-lines i { flex:1; border-bottom:2px solid #111; transform:translateY(-2px); }
.corner-marks i { position:fixed; width:7mm; height:7mm; z-index:0; }
.corner-marks i:nth-child(1) { left:18mm; top:14mm; border-right:1px solid #bbb; border-bottom:1px solid #bbb; }
.corner-marks i:nth-child(2) { right:18mm; top:14mm; border-left:1px solid #bbb; border-bottom:1px solid #bbb; }
.corner-marks i:nth-child(3) { left:18mm; bottom:14mm; border-right:1px solid #bbb; border-top:1px solid #bbb; }
.corner-marks i:nth-child(4) { right:18mm; bottom:14mm; border-left:1px solid #bbb; border-top:1px solid #bbb; }
.group-title { margin:24px 0 10px; font-weight:bold; border:0; padding:0; font-size:17px; }
.paper-compact .group-title { margin:14px 0 8px; }
.exam-question { margin-bottom:28px; break-inside:avoid; page-break-inside:avoid; display:flow-root; overflow:visible; }
.paper-compact .exam-question { margin-bottom:16px; }
.question-row { display:grid; grid-template-columns:2.4em minmax(0, 1fr); column-gap:0; align-items:start; }
.q-index { font-weight:bold; line-height:1.8; }
.question-stem { margin-bottom:12px; min-width:0; line-break:strict; text-wrap:pretty; display:flow-root; overflow:visible; }
.question-stem::after,.exam-question::after { content:""; display:block; clear:both; }
.question-flow-body { min-width:0; overflow:visible; line-break:strict; text-wrap:pretty; }
.question-flow-body::after { content:""; display:block; clear:both; }
.gaokao-options { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); column-gap:14px; row-gap:8px; margin-top:10px; padding-left:2.2em; width:100%; box-sizing:border-box; }
.gaokao-options:has(.option-content .katex-display), .gaokao-options.long-options { grid-template-columns:repeat(2, minmax(0, 1fr)); }
.question-flow-body .qisi-flow-options { clear:none !important; display:block !important; width:auto !important; margin-top:10px; padding-left:2.2em; }
.question-flow-body .qisi-flow-options .gaokao-option { display:block; margin-bottom:5px; }
.question-flow-body .qisi-flow-options .option-label { display:inline-block; width:1.8em; margin-right:0; }
.question-flow-body .qisi-flow-options .option-content { display:inline; } .question-flow-body .qisi-flow-options .option-content:has(img) { display:inline-block; vertical-align:top; }
.question-head { display:none; }
.print-toolbar { position:sticky; top:0; margin:-24px -24px 18px; padding:10px 24px; background:#f8fafc; border-bottom:1px solid #e5e7eb; font-family:"Microsoft YaHei", sans-serif; }
.print-toolbar button { border:0; background:#1a73e8; color:#fff; border-radius:6px; padding:8px 14px; font-weight:700; cursor:pointer; }
.print-toolbar button:disabled { background:#94a3b8; cursor:wait; }
@media print { .print-toolbar { display:none; } }
.q-note { margin-top:8px; font-size:13px; color:#555; border-left:3px solid ${examConfig.themeColor || '#1f9d45'}; padding-left:8px; }
.print-answer,.print-solution { clear:both; margin-top:8px; padding:8px 10px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:4px; }
.answer-section.new-page { break-before:page; }
.answer-section h2 { text-align:center; margin-bottom:20px; }
.answer-item { margin-bottom:12px; }
.answer-solution { margin-top:4px; color:#333; }
.gaokao-option { display:flex; align-items:flex-start; min-width:0; break-inside:avoid; page-break-inside:avoid; }
.option-label { margin-right:6px; font-weight:bold; line-height:1.8; }
.option-content { flex:1; min-width:0; line-height:1.8; overflow-wrap:normal; word-break:normal; }
.option-content .katex, .katex { font-size:1.04em; white-space:nowrap; }
.katex-display { margin:.5em 0; overflow-x:auto; overflow-y:hidden; }
.answer-blank,.nowrap { display:inline-block; white-space:nowrap; break-inside:avoid; }
.answer-blank { min-width:2.4em; text-align:center; }
.print-image { max-width:82mm; max-height:48mm; width:auto; height:auto; object-fit:contain; page-break-inside:avoid; break-inside:avoid; }
.print-image.centered { display:block; margin:8px auto 10px; }
.print-image.float-left { float:left; margin:4px 12px 8px 0; }
.print-image.float-right { float:right; margin:4px 0 8px 12px; }
.missing-image { color:#dc2626; font-size:12px; }
@page { size:${examConfig.paperSize || 'A4'}; margin:18mm 16mm; }
</style>
</head>
<body>
<div class="print-toolbar"><button id="printBtn" onclick="window.print()" disabled>正在准备图片...</button></div>
${content}
<script>
const btn = document.getElementById('printBtn');
const imgs = Array.from(document.images);
const imageReady = Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
    img.onload = resolve;
    img.onerror = resolve;
})));
const fontReady = document.fonts?.ready || Promise.resolve();
Promise.all([imageReady, fontReady]).then(() => {
    if (btn) {
        btn.disabled = imgs.some(img => !img.naturalWidth) || Boolean(document.querySelector('.missing-image'));
        btn.textContent = btn.disabled ? '图片未能完整加载，请修复后重新生成' : '渲染已就绪，打印 / 另存为 PDF';
    }
});
</script>
</body>
</html>`;
                    const blob = new Blob(['\uFEFF' + html], { type: 'text/html;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
                    return true;
                };

                const printExam = async () => {
                    if (missingCartQuestionIds.value.length) { alert('试卷车有题目已不存在，请核对后再打印。'); return; }
                    if(cart.value.length === 0) return alert("请先从题库中挑选试题放入试卷篮！");
                    if (printBusy.value) return;
                    printBusy.value = true;
                    try {
                        syncExamMeta();
                        const qs = await hydrateQuestionsForPrint(cartQuestionsOrdered.value);
                        // 导出前逐题验公式。宁可这次不导出，也不让老师拿到
                        // 一份印着红字或空白公式的讲义。
                        if (!root.Qisi.HandoutFormulaGate.confirmBeforeExport(qs, {
                            includeAnswer: examConfig.showAnswer || ['split', 'withAnswers'].includes(exportMode.value),
                            includeSolution: examConfig.showSolution || ['split', 'withAnswers'].includes(exportMode.value)
                        })) return;
                        const questionsContent = buildQuestionContent(qs);
                        if (exportMode.value === 'split') {
                            const answersContent = buildAnswerContent(qs, false);
                            openPrintWindow(questionsContent, '试题卷');
                            setTimeout(() => openPrintWindow(answersContent, '答案卷'), 600);
                        } else if (exportMode.value === 'withAnswers') {
                            const answersContent = buildAnswerContent(qs, true);
                            openPrintWindow(`${questionsContent}${answersContent}`, '试卷与答案');
                        } else {
                            openPrintWindow(questionsContent, '试题卷');
                        }
                    } catch (error) {
                        console.error('打印准备失败', error);
                        alert(`打印准备失败：${error?.message || error}`);
                    } finally {
                        printBusy.value = false;
                    }
                };

                const finishExamBuild = () => {
                    printExam();
                };

                const selectTemplateCard = (tpl) => {
                    editMode.value = tpl.system ? 'system' : 'custom';
                    currentPresetKey.value = tpl.id;
                    editTplName.value = tpl.name;
                    latexTemplate.value = tpl.code;
                    if ((tpl.system && EXAM_LAYOUT_PRESETS[tpl.id]) || (!tpl.system && tpl.id)) selectedExamTemplate.value = tpl.id;
                };
                const selectPresetTemplate = (key) => selectTemplateCard(getTemplateCard(key, PRESET_TEMPLATES[key]));
                const selectCustomTemplate = (tpl) => selectTemplateCard({ ...tpl, system: false });
                const triggerNewCustomTemplate = () => { editMode.value = 'new'; currentPresetKey.value = ''; editTplName.value = '我的新模板'; latexTemplate.value = DEFAULT_TEMPLATE; };
                const handleCodeInput = (e) => { latexTemplate.value = e.target.value; };
                
                const saveNewCustomTemplate = async () => {
                    // 模板 = 版式配置 + LaTeX 代码。只存代码会让老师调好的字体字号全部丢失。
                    const tpl = window.Qisi.ExamTemplateModel.buildCustomTemplate({
                        id: 'tpl_' + Date.now(),
                        name: editTplName.value,
                        code: ensureImagePackagesForLatex(latexTemplate.value),
                        config: toRaw(examConfig),
                        now: Date.now()
                    });
                    latexTemplate.value = tpl.code;
                    await db.customTemplates.put(tpl);
                    // 只刷模板表，不跑全库 loadData：后者会把全库图片的 blob URL
                    // 全部 revoke 再重建，页面上图片会闪白一下。
                    customTemplates.value = await storageRepository.listTable('customTemplates', { orderBy: 'createdAt', reverse: true });
                    editMode.value = 'custom'; currentPresetKey.value = tpl.id; alert('已存为新模板');
                };
                
                const updateExistingCustomTemplate = async () => {
                    if (PRESET_TEMPLATES[currentPresetKey.value]) {
                        templateOverrides.value = {
                            ...templateOverrides.value,
                            [currentPresetKey.value]: window.Qisi.ExamTemplateModel.buildSystemOverride({
                                name: editTplName.value,
                                code: ensureImagePackagesForLatex(latexTemplate.value),
                                config: toRaw(examConfig),
                                now: Date.now()
                            })
                        };
                        latexTemplate.value = templateOverrides.value[currentPresetKey.value].code;
                        safeStorage.setJson(
                            'qisi_template_overrides',
                            toRaw(templateOverrides.value)
                        );
                        alert('系统模板已更新');
                        return;
                    }
                    const nextCode = ensureImagePackagesForLatex(latexTemplate.value);
                    latexTemplate.value = nextCode;
                    await db.customTemplates.update(currentPresetKey.value, window.Qisi.ExamTemplateModel
                        .buildCustomTemplateUpdate({ name: editTplName.value, code: nextCode, config: toRaw(examConfig) }));
                    customTemplates.value = await storageRepository.listTable('customTemplates', { orderBy: 'createdAt', reverse: true });
                    alert('已更新');
                };
                
                const deleteCustomTemplate = async (id) => {
                    await db.customTemplates.delete(id);
                    customTemplates.value = await storageRepository.listTable('customTemplates', { orderBy: 'createdAt', reverse: true });
                    selectPresetTemplate(DEFAULT_PRESET_KEY);
                };

                const savePersonalKnowledge = async () => {
                    await db.personalKnowledge.put({ id: 'tree', nodes: toRaw(personalKnowledgeTree.value), updatedAt: Date.now() });
                };

                const personalTreeRows = computed(() =>
                    window.Qisi.PersonalKnowledgeModel.flattenRows(personalKnowledgeTree.value)
                );

                const togglePersonalExpanded = async (node) => {
                    node.expanded = node.expanded === false;
                    await savePersonalKnowledge();
                };

                const addPersonalChild = async (row) => {
                    const label = row.level === 1 ? '二级方向名称' : '三级知识点名称';
                    const name = prompt(label, '');
                    if (!name || !name.trim()) return;
                    row.node.children = row.node.children || [];
                    const child = { id: `pk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), children: row.level === 1 ? [] : undefined, expanded: true };
                    row.node.children.push(child);
                    row.node.expanded = true;
                    if (row.level === 1) {
                        selectedPersonalL1Id.value = row.node.id;
                        selectedPersonalL2Id.value = child.id;
                    } else {
                        selectedPersonalL1Id.value = row.grandParent?.id || '';
                        selectedPersonalL2Id.value = row.node.id;
                    }
                    await savePersonalKnowledge();
                };

                const deletePersonalRow = (row) => {
                    const parentId = row.level === 1 ? '' : row.parent?.id || '';
                    deletePersonalNode(row.level, row.node.id, parentId);
                };

                const createPersonalL1 = async () => {
                    const name = personalL1Name.value.trim();
                    if (!name) return;
                    const node = window.Qisi.PersonalKnowledgeModel.buildNode({ id: `pk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, level: 1 });
                    personalKnowledgeTree.value.push(node);
                    selectedPersonalL1Id.value = node.id;
                    selectedPersonalL2Id.value = '';
                    personalL1Name.value = '';
                    await savePersonalKnowledge();
                };

                const createPersonalL2 = async () => {
                    const parent = personalKnowledgeTree.value.find(n => n.id === selectedPersonalL1Id.value);
                    const name = personalL2Name.value.trim();
                    if (!parent || !name) return;
                    parent.children = parent.children || [];
                    parent.expanded = true;
                    const node = window.Qisi.PersonalKnowledgeModel.buildNode({ id: `pk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, level: 2 });
                    parent.children.push(node);
                    selectedPersonalL2Id.value = node.id;
                    personalL2Name.value = '';
                    await savePersonalKnowledge();
                };

                const createPersonalL3 = async () => {
                    const l1 = personalKnowledgeTree.value.find(n => n.id === selectedPersonalL1Id.value);
                    const parent = l1?.children?.find(n => n.id === selectedPersonalL2Id.value);
                    const name = personalL3Name.value.trim();
                    if (!parent || !name) return;
                    parent.children = parent.children || [];
                    parent.expanded = true;
                    parent.children.push(window.Qisi.PersonalKnowledgeModel.buildNode({ id: `pk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name, level: 3 }));
                    personalL3Name.value = '';
                    await savePersonalKnowledge();
                };

                const renamePersonalNode = async (node) => {
                    const name = prompt('新的知识点名称', node.name);
                    if (!name || !name.trim()) return;
                    node.name = name.trim();
                    await savePersonalKnowledge();
                };

                const deletePersonalNode = async (level, id, parentId = '') => {
                    if (!confirm('确定删除这个知识点及其下级吗？')) return;
                    if (level === 1) {
                        personalKnowledgeTree.value = personalKnowledgeTree.value.filter(n => n.id !== id);
                        if (selectedPersonalL1Id.value === id) {
                            selectedPersonalL1Id.value = '';
                            selectedPersonalL2Id.value = '';
                        }
                    } else if (level === 2) {
                        const l1 = personalKnowledgeTree.value.find(n => n.id === parentId);
                        if (l1) l1.children = (l1.children || []).filter(n => n.id !== id);
                        if (selectedPersonalL2Id.value === id) selectedPersonalL2Id.value = '';
                    } else {
                        for (const l1 of personalKnowledgeTree.value) {
                            const l2 = l1.children?.find(n => n.id === parentId);
                            if (l2) l2.children = (l2.children || []).filter(n => n.id !== id);
                        }
                    }
                    await savePersonalKnowledge();
                };

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
                    backupWorkspace, backupStatus, view, questions, filteredQuestions, cart, currentPage,
                    totalPages: computed(() =>
                        libraryService.paginate(
                            filteredQuestions.value,
                            currentPage.value,
                            pageSize
                        ).totalPages
                    ),
                    paginatedQuestions: computed(() =>
                        libraryService.paginate(
                            filteredQuestions.value,
                            currentPage.value,
                            pageSize
                        ).items
                    ),
                    externalQuestions, importBatches, externalTeacherGroups, failedImportBatches, activeExternalBatchId, filteredExternalQuestions, paginatedExternalQuestions, externalTotalPages,
                    externalPickMode, selectedExternalIds, toggleExternalPick, clearExternalSelection, selectAllExternalOnPage, openExternalConfirmPage, externalOnlyUnprocessed,
                    confirmItems, filteredConfirmItems, confirmStatusFilter, confirmStatusOptions, confirmStatusCount, batchPersonalKnowledge, batchSystemKnowledge, flatSystemKnowledge, flatPersonalKnowledge, flatKnowledge, applyBatchKnowledge, confirmAddExternalToPersonal,
                    importBankInput, openImportBankPicker, handleImportBankFileChange, pendingImportPreview, cancelImportPreview, confirmImportBankPreview, exportQuestionBankPackage,
                    undoLatestExternalMerge, deleteExternalBatch, recalculateExternalBatchStatus,
                    batchImportMode, batchImportBatches, recentBatchImportBatches, batchImportFiles, batchDraftQuestions, filteredDraftQuestions, batchDraftImages, batchImportFilter, activeBatchId, activeBatch, activeDraftQuestionId, activeDraftQuestion, batchRecognitionSummary, activeDraftEditorBuffer, activeDraftEditorOriginal, activeDraftSourceLabel, activeDraftEditorDirty, activeDraftEditorPreview, activeDraftEditorTextarea, activeDraftImages, activeDraftRealQuestionImages, activeDraftSourcePageImages, activeDraftPreviewImages, unassignedDraftImages, activeDraftTab, batchUploadInput, isDraggingBatchFiles, batchToast, unassignedImageModal, imagePositionMenuId, cropModalOpen, cropImageRef, cropState, cropSelectionStyle, pendingPurposeFile, pendingPurposeRoles, batchCreateFiles, batchCreateTypeHint, batchCreateWarning, batchExpectedQuestionCount, batchDefaultMeta, unmatchedAnswers, submitSummary,
                    openBatchCreate, openBatchList, clearBatchDraftWorkspace, openBatchFilePicker, handleBatchFileChange, handleBatchDrop, handleBatchHomeDrop, togglePurposeRole, confirmBatchFilePurpose, cancelBatchFilePurpose, editBatchFilePurpose, removeBatchCreateFile, createDraftImportBatch, runBatchRecognition, cancelBatchRecognition, rerunActiveBatchRecognition, dedupeActiveBatchDraftsNow, openBatchReview, selectDraftQuestion, updateDraftQuestionField, saveActiveDraftQuestion, markDraftReviewed, submitDraftQuestion, confirmAndSubmitDraft, selectedDraftIds, draftMetaExpanded, toggleDraftSelection, selectAllDrafts, confirmSelectedDrafts, openBatchSubmitSummary, confirmBatchSubmit, deleteBatchImport, validatePageRange, batchStatusText, draftQuestionStatusText, roleLabel, rolesLabel, fileTypeText, formatFileSize, draftQuestionProblems, confirmDraftImages, deleteDraftImage, toggleImagePositionMenu, copyDraftImagePlacementLatex, openSourcePageCrop, openPdfSource, closeCropModal, resetCropState, startManualCrop, moveManualCrop, endManualCrop, saveManualCropToDraft, bindUnassignedImage, deleteUnassignedImage, showUnmatchedAnswerList, showActiveRawText, showCropNotice, cleanupActiveBatchDisplayPollution, markActiveDraftUserEdited, choosePdfCandidate, pdfDraftMeta, activePdfReviewPanel, activePdfUnassigned, acknowledgePdfTaskIssues, insertDraftEditorText, discardActiveDraftEditorChanges,
                    syncActiveDraftEditorFromQuestion: () => window.Qisi.ReviewDraftState.syncActiveDraftEditorFromQuestion({
                        activeDraftQuestion,
                        activeDraftEditorBuffer,
                        activeDraftEditorOriginal,
                        activeDraftEditorOriginalFields,
                        activeDraftEditorQuestionId,
                        buildDraftEditorSource
                    }),
                    librarySearchInput, libraryFilters, resetLibraryFilters,
                    getExternalStatus, externalStatusLabel, externalStatusClass, actionLabel,
                    cartQuestions: cartQuestionsOrdered,
                    cartGrouped: computed(() => { const sel = questions.value.filter(q => q && cart.value.includes(q.id)); return sel.reduce((acc, q) => { (acc[q.type] = acc[q.type] || []).push(q); return acc; }, {}); }),
                    missingCartQuestionIds, cartQuestionsOrdered, activeExamGroups, examQuestionMeta, examGroupConfig, selectedExamTemplate, examConfig, examPresets, selectedExamPreset, templateFeatureOptions, printBusy, moveCartQuestion, examDisplayIndex, startExamPointerDrag, dropExamQuestion, draggingExamQuestionId, dragOverExamQuestionId, resetExamOrder, groupSummaryText, syncExamGroups, openExamBuilder, finishExamBuild,
                    entryForm, entryTab, entryPreviewStem, entryPreviewOptions, isDraggingImg, isDraggingOcr, ocrDraftStore, ocrLoading, examTitle, exportMode, latexTemplate,
                    presets: PRESET_TEMPLATES, allTemplateCards, customTemplates, currentPresetKey, editMode, editTplName, 
                    knowledgeTree, personalKnowledgeTree, personalTreeRows, activeKnowledge, activeKnowledgeType, libraryKnowledgeMode, activeKnowledgeTree, activeKnowledgeCounts, knowledgeCounts, personalKnowledgeCounts, handleKnowledgeSelect, switchLibraryKnowledgeMode, isCartOpen, cartPanelAvailable, showEntryKnowledge, showEntryPersonalKnowledge, hoverL1, hoverPersonalL1,
                    personalL1Name, personalL2Name, personalL3Name, selectedPersonalL1Id, selectedPersonalL2Id,
                    createPersonalL1, createPersonalL2, createPersonalL3, togglePersonalExpanded, addPersonalChild, deletePersonalRow, renamePersonalNode, deletePersonalNode,
                    handleDrop, handleFileChange, handleEntryPaste, handleOcrDrop, handleOcrChange, submitQuestion, toggleCart, clearCart, deleteQuestion, saveEditedQuestion, printExam,
                    assignOcr: (f) => { 
                        const area = document.querySelector('textarea[placeholder="识别文本结果..."]');
                        let selected = ocrDraftStore.rawText;
                        if (area && area.selectionStart !== area.selectionEnd) { selected = area.value.substring(area.selectionStart, area.selectionEnd); }
                        entryForm[f] += (entryForm[f] ? '\n\n' : '') + selected; 
                    },
                    selectPresetTemplate, selectCustomTemplate, selectTemplateCard, triggerNewCustomTemplate, handleCodeInput, saveNewCustomTemplate, updateExistingCustomTemplate, deleteCustomTemplate,
                    setGlobalTemplate: () => {
                        latexTemplate.value = ensureImagePackagesForLatex(latexTemplate.value);
                        safeStorage.set('qisi_template', latexTemplate.value);
                        alert('全局默认已更新');
                    },
                    changeEntryAlign: (id, align) => {
                        const img = entryForm.images.find(i => i.id === id); if(img) img.align = align;
                        const escapedId = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const tokenSource = `\\[\\[(?:IMAGE|FORMULA_IMAGE):${escapedId}\\]\\]`;
                        const includeSource = `\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedId}\\}`;
                        const r = new RegExp(`(?:\\\\begin\\{(?:center|flushleft|flushright)\\}\\s*)?(?:${tokenSource}|${includeSource})(?:\\s*\\\\end\\{(?:center|flushleft|flushright)\\})?`, 'g');
                        const rep = `\\begin{${align}}[[IMAGE:${id}]]\\end{${align}}`;
                        entryForm.stem = entryForm.stem.replace(r, rep); entryForm.answer = entryForm.answer.replace(r, rep); entryForm.solution = entryForm.solution.replace(r, rep);
                    },
                    removeEntryImage: (id) => {
                        entryForm.images = entryForm.images.filter(i => i.id !== id);
                        const escapedId = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const tokenSource = `\\[\\[(?:IMAGE|FORMULA_IMAGE):${escapedId}\\]\\]`;
                        const includeSource = `\\\\includegraphics(?:\\[[^\\]]*\\])?\\{${escapedId}\\}`;
                        const block = new RegExp(`\\n?\\\\begin\\{(?:wrapfigure|center|flushleft|flushright)\\}[\\s\\S]*?(?:${tokenSource}|${includeSource})[\\s\\S]*?\\\\end\\{(?:wrapfigure|center|flushleft|flushright)\\}`, 'g');
                        const inline = new RegExp(`\\n?(?:${tokenSource}|${includeSource})`, 'g');
                        const clean = value => String(value || '').replace(block, '').replace(inline, '').replace(/\n{3,}/g, '\n\n').trim();
                        entryForm.stem = clean(entryForm.stem);
                        entryForm.answer = clean(entryForm.answer);
                        entryForm.solution = clean(entryForm.solution);
                    },
                    selectKnowledge,
                    copyMainSnippet: async (id) => {
                        const img = entryForm.images.find(i => i.id === id);
                        const align = img && img.align ? img.align : 'center';
                        const snippet = `\\begin{${align}}[[IMAGE:${id}]]\\end{${align}}`;
                        const ok = await copyText(snippet);
                        alert(ok ? "LaTeX 短码已复制！配图选行内浮动时，请将短码置于文字内部！" : "复制失败，请手动复制短码。");
                    }
                };
            },
            template: '#app-tpl'
        };

                const app = createApp(App);
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
