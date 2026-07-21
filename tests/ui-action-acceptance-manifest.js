const crypto = require('node:crypto');

const OWNER_EXPRESSIONS = Object.freeze({
    shared: Object.freeze([
        'select(null)',
        'toggle(l1)',
        'select(l1.name)',
        'toggle(l2)',
        'select(l2.name)',
        'select(l3.name)',
        'toggleEditor',
        'handleToggleAnswer',
        'handleToggleCart',
        'activeEditTab = tab.id',
        'handleDelete',
        'handleSaveProps',
        "view = 'entry'",
        "view = 'batchImport'; openBatchList()",
        "view = 'library'",
        'openExamBuilder',
        "view = 'personal'",
        "view = 'template'",
        'isCartOpen = true',
        'isCartOpen = false',
        'clearCart'
    ]),
    entry: Object.freeze([
        'showEntryKnowledge = !showEntryKnowledge; showEntryPersonalKnowledge = false',
        'showEntryKnowledge = false',
        "selectKnowledge(l1.name, 'system')",
        "selectKnowledge(l2.name, 'system')",
        "selectKnowledge(l3.name, 'system')",
        'showEntryPersonalKnowledge = !showEntryPersonalKnowledge; showEntryKnowledge = false',
        'showEntryPersonalKnowledge = false',
        "selectKnowledge(l1.name, 'personal')",
        "selectKnowledge(l2.name, 'personal')",
        "selectKnowledge(l3.name, 'personal')",
        '$refs.entryImgInput.click()',
        'copyMainSnippet(img.id)',
        'removeEntryImage(img.id)',
        'entryTab = t.id',
        'submitQuestion',
        '$refs.ocrInput.click()',
        "assignOcr('stem')",
        "assignOcr('answer')",
        "assignOcr('solution')"
    ]),
    review: Object.freeze([
        'clearBatchDraftWorkspace',
        "openBatchCreate('mixed')",
        'openBatchReview(batch.id)',
        'runBatchRecognition(batch.id)',
        'deleteBatchImport(batch.id)',
        'openBatchList',
        'openBatchFilePicker',
        'editBatchFilePurpose(file)',
        'removeBatchCreateFile(file.id)',
        'createDraftImportBatch',
        'showUnmatchedAnswerList',
        'unassignedImageModal = true',
        'cleanupActiveBatchDisplayPollution',
        'dedupeActiveBatchDraftsNow',
        'rerunActiveBatchRecognition',
        'batchImportFilter = tab.id',
        'selectDraftQuestion(q.id)',
        "activeDraftTab='stem'",
        "activeDraftTab='answer'",
        "activeDraftTab='solution'",
        'saveActiveDraftQuestion',
        'discardActiveDraftEditorChanges',
        'submitDraftQuestion(activeDraftQuestion.id)',
        'showActiveRawText',
        'confirmDraftImages',
        'toggleImagePositionMenu(img.id)',
        "setDraftImagePosition(img, 'left')",
        "setDraftImagePosition(img, 'center')",
        "setDraftImagePosition(img, 'right')",
        'deleteDraftImage(img.id)',
        'openSourcePageCrop(activeDraftSourcePageImages[0])',
        'openSourcePageCrop(img)',
        'submitAllDraftsOneClick',
        'closeCropModal',
        'resetCropState',
        'saveManualCropToDraft',
        'cancelBatchFilePurpose',
        'confirmBatchFilePurpose',
        'unassignedImageModal = false',
        'deleteUnassignedImage(img.id)'
    ]),
    library: Object.freeze([
        "switchLibraryKnowledgeMode('system')",
        "switchLibraryKnowledgeMode('personal')",
        "switchLibraryKnowledgeMode('external')",
        'activeExternalBatchId = batch.id; currentPage = 1',
        'recalculateExternalBatchStatus(batch.id)',
        'deleteExternalBatch(batch.id)',
        'exportQuestionBankPackage',
        'openImportBankPicker',
        'resetLibraryFilters',
        'selectAllExternalOnPage',
        'clearExternalSelection',
        'openExternalConfirmPage',
        'undoLatestExternalMerge',
        'currentPage--',
        'currentPage++',
        'cancelImportPreview',
        'confirmImportBankPreview',
        'confirmAddExternalToPersonal',
        'confirmStatusFilter = option.value',
        "applyBatchKnowledge('personal')",
        "applyBatchKnowledge('system')",
        'item.expanded = !item.expanded'
    ]),
    settings: Object.freeze([
        'createPersonalL1',
        'togglePersonalExpanded(row.node)',
        'addPersonalChild(row)',
        'renamePersonalNode(row.node)',
        'deletePersonalRow(row)',
        'selectTemplateCard(tpl)',
        'updateExistingCustomTemplate()'
    ]),
    exam: Object.freeze([
        'resetExamOrder',
        'moveCartQuestion(q.id, -1)',
        'moveCartQuestion(q.id, 1)',
        'toggleCart(q.id)',
        "exportMode='questions'",
        "exportMode='withAnswers'",
        "exportMode='split'",
        'finishExamBuild'
    ])
});

const R3_EXPRESSIONS = new Set([
    '$refs.ocrInput.click()',
    'createDraftImportBatch',
    'runBatchRecognition(batch.id)',
    'rerunActiveBatchRecognition'
]);

const R2_EXPRESSIONS = new Set([
    'handleDelete',
    'clearCart',
    '$refs.entryImgInput.click()',
    'removeEntryImage(img.id)',
    'submitQuestion',
    'clearBatchDraftWorkspace',
    'deleteBatchImport(batch.id)',
    'openBatchFilePicker',
    'removeBatchCreateFile(file.id)',
    'cleanupActiveBatchDisplayPollution',
    'dedupeActiveBatchDraftsNow',
    'discardActiveDraftEditorChanges',
    'submitDraftQuestion(activeDraftQuestion.id)',
    'deleteDraftImage(img.id)',
    'submitAllDraftsOneClick',
    'deleteUnassignedImage(img.id)',
    'deleteExternalBatch(batch.id)',
    'exportQuestionBankPackage',
    'openImportBankPicker',
    'undoLatestExternalMerge',
    'confirmImportBankPreview',
    'confirmAddExternalToPersonal',
    'deletePersonalRow(row)',
    'finishExamBuild'
]);

const R1_EXPRESSIONS = new Set([
    'handleToggleCart',
    'handleSaveProps',
    "selectKnowledge(l1.name, 'system')",
    "selectKnowledge(l2.name, 'system')",
    "selectKnowledge(l3.name, 'system')",
    "selectKnowledge(l1.name, 'personal')",
    "selectKnowledge(l2.name, 'personal')",
    "selectKnowledge(l3.name, 'personal')",
    "assignOcr('stem')",
    "assignOcr('answer')",
    "assignOcr('solution')",
    'saveActiveDraftQuestion',
    'confirmDraftImages',
    "setDraftImagePosition(img, 'left')",
    "setDraftImagePosition(img, 'center')",
    "setDraftImagePosition(img, 'right')",
    'saveManualCropToDraft',
    'recalculateExternalBatchStatus(batch.id)',
    'createPersonalL1',
    'togglePersonalExpanded(row.node)',
    'addPersonalChild(row)',
    'renamePersonalNode(row.node)',
    'selectTemplateCard(tpl)',
    'updateExistingCustomTemplate()',
    'resetExamOrder',
    'moveCartQuestion(q.id, -1)',
    'moveCartQuestion(q.id, 1)',
    'toggleCart(q.id)',
    "exportMode='questions'",
    "exportMode='withAnswers'",
    "exportMode='split'"
]);

// Only blocking choice/input dialogs are catalogued here. Status/error alerts are
// notifications and do not alter whether an action may proceed.
const DIALOGS_BY_EXPRESSION = Object.freeze({
    handleDelete: Object.freeze(['confirm']),
    clearCart: Object.freeze(['confirm']),
    clearBatchDraftWorkspace: Object.freeze(['confirm']),
    'removeBatchCreateFile(file.id)': Object.freeze(['confirm']),
    createDraftImportBatch: Object.freeze(['confirm']),
    'selectDraftQuestion(q.id)': Object.freeze(['confirm']),
    'deleteDraftImage(img.id)': Object.freeze(['confirm']),
    rerunActiveBatchRecognition: Object.freeze(['confirm']),
    'deleteBatchImport(batch.id)': Object.freeze(['confirm']),
    'deleteUnassignedImage(img.id)': Object.freeze(['confirm']),
    'deleteExternalBatch(batch.id)': Object.freeze(['confirm']),
    undoLatestExternalMerge: Object.freeze(['confirm']),
    confirmImportBankPreview: Object.freeze(['confirm']),
    confirmAddExternalToPersonal: Object.freeze(['confirm']),
    'deletePersonalRow(row)': Object.freeze(['confirm']),
    exportQuestionBankPackage: Object.freeze(['prompt']),
    'addPersonalChild(row)': Object.freeze(['prompt']),
    'renamePersonalNode(row.node)': Object.freeze(['prompt'])
});

const FILE_CHOOSER_EXPRESSIONS = new Set([
    '$refs.entryImgInput.click()',
    '$refs.ocrInput.click()',
    'openBatchFilePicker',
    'openImportBankPicker'
]);

const BROWSER_NAVIGATION_EXPRESSIONS = new Set([
    "view = 'entry'",
    "view = 'batchImport'; openBatchList()",
    "view = 'library'",
    'openExamBuilder',
    "view = 'personal'",
    "view = 'template'",
    "openBatchCreate('mixed')",
    'openBatchList',
    "switchLibraryKnowledgeMode('system')",
    "switchLibraryKnowledgeMode('personal')",
    "switchLibraryKnowledgeMode('external')"
]);

const COMPOSABLE_EVIDENCE = Object.freeze({
    'tests/entry-composable.test.js': new Set([
        "selectKnowledge(l1.name, 'system')",
        "selectKnowledge(l2.name, 'system')",
        "selectKnowledge(l3.name, 'system')",
        "selectKnowledge(l1.name, 'personal')",
        "selectKnowledge(l2.name, 'personal')",
        "selectKnowledge(l3.name, 'personal')",
        'copyMainSnippet(img.id)',
        'removeEntryImage(img.id)'
    ]),
    'tests/library-composable.test.js': new Set([
        "switchLibraryKnowledgeMode('system')",
        "switchLibraryKnowledgeMode('personal')",
        "switchLibraryKnowledgeMode('external')",
        'resetLibraryFilters'
    ]),
    'tests/settings-composable.test.js': new Set([
        'createPersonalL1',
        'togglePersonalExpanded(row.node)',
        'addPersonalChild(row)',
        'renamePersonalNode(row.node)',
        'deletePersonalRow(row)',
        'selectTemplateCard(tpl)',
        'updateExistingCustomTemplate()'
    ]),
    'tests/exam-composable.test.js': new Set([
        'clearCart',
        'openExamBuilder',
        'resetExamOrder',
        'moveCartQuestion(q.id, -1)',
        'moveCartQuestion(q.id, 1)',
        'toggleCart(q.id)'
    ]),
    'tests/review-composable.test.js': new Set([
        'batchImportFilter = tab.id',
        'toggleImagePositionMenu(img.id)',
        'discardActiveDraftEditorChanges'
    ])
});

const EFFECTS_BY_EXPRESSION = Object.freeze({
    handleDelete: Object.freeze(['formal-bank-delete']),
    handleToggleCart: Object.freeze(['persistent-cart-write']),
    handleSaveProps: Object.freeze(['formal-bank-write']),
    clearCart: Object.freeze(['persistent-cart-clear']),
    '$refs.entryImgInput.click()': Object.freeze(['file-chooser']),
    'copyMainSnippet(img.id)': Object.freeze(['clipboard-write']),
    'removeEntryImage(img.id)': Object.freeze(['entry-image-remove']),
    submitQuestion: Object.freeze(['formal-bank-write']),
    '$refs.ocrInput.click()': Object.freeze(['file-chooser', 'ai-ocr']),
    clearBatchDraftWorkspace: Object.freeze(['draft-storage-delete']),
    'runBatchRecognition(batch.id)': Object.freeze(['draft-storage-write', 'ai-ocr']),
    'deleteBatchImport(batch.id)': Object.freeze(['draft-storage-delete']),
    openBatchFilePicker: Object.freeze(['file-chooser']),
    'removeBatchCreateFile(file.id)': Object.freeze(['staged-file-remove']),
    createDraftImportBatch: Object.freeze(['draft-storage-write', 'ai-ocr']),
    cleanupActiveBatchDisplayPollution: Object.freeze(['draft-content-rewrite']),
    dedupeActiveBatchDraftsNow: Object.freeze(['draft-storage-delete']),
    rerunActiveBatchRecognition: Object.freeze(['draft-storage-write', 'ai-ocr']),
    saveActiveDraftQuestion: Object.freeze(['draft-storage-write']),
    discardActiveDraftEditorChanges: Object.freeze(['unsaved-edit-discard']),
    'submitDraftQuestion(activeDraftQuestion.id)': Object.freeze(['formal-bank-write']),
    confirmDraftImages: Object.freeze(['draft-storage-write']),
    "setDraftImagePosition(img, 'left')": Object.freeze(['draft-storage-write']),
    "setDraftImagePosition(img, 'center')": Object.freeze(['draft-storage-write']),
    "setDraftImagePosition(img, 'right')": Object.freeze(['draft-storage-write']),
    'deleteDraftImage(img.id)': Object.freeze(['draft-image-delete']),
    submitAllDraftsOneClick: Object.freeze(['formal-bank-write']),
    saveManualCropToDraft: Object.freeze(['draft-image-write']),
    'deleteUnassignedImage(img.id)': Object.freeze(['draft-image-delete']),
    'recalculateExternalBatchStatus(batch.id)': Object.freeze(['external-staging-write']),
    'deleteExternalBatch(batch.id)': Object.freeze(['external-staging-delete']),
    exportQuestionBankPackage: Object.freeze(['file-download']),
    openImportBankPicker: Object.freeze(['file-chooser']),
    undoLatestExternalMerge: Object.freeze(['formal-bank-rollback']),
    confirmImportBankPreview: Object.freeze(['external-staging-write']),
    confirmAddExternalToPersonal: Object.freeze(['formal-bank-write']),
    createPersonalL1: Object.freeze(['knowledge-tree-write']),
    'togglePersonalExpanded(row.node)': Object.freeze(['knowledge-tree-write']),
    'addPersonalChild(row)': Object.freeze(['knowledge-tree-write']),
    'renamePersonalNode(row.node)': Object.freeze(['knowledge-tree-write']),
    'deletePersonalRow(row)': Object.freeze(['knowledge-tree-delete']),
    'selectTemplateCard(tpl)': Object.freeze(['template-preference-write']),
    'updateExistingCustomTemplate()': Object.freeze(['template-storage-write']),
    resetExamOrder: Object.freeze(['persistent-cart-write']),
    'moveCartQuestion(q.id, -1)': Object.freeze(['persistent-cart-write']),
    'moveCartQuestion(q.id, 1)': Object.freeze(['persistent-cart-write']),
    'toggleCart(q.id)': Object.freeze(['persistent-cart-write']),
    "exportMode='questions'": Object.freeze(['print-preference-write']),
    "exportMode='withAnswers'": Object.freeze(['print-preference-write']),
    "exportMode='split'": Object.freeze(['print-preference-write']),
    finishExamBuild: Object.freeze(['print-window', 'blob-url'])
});

const COMPONENT_DELEGATES = Object.freeze({
    'select(null)': 'knowledge-tree-component',
    'toggle(l1)': 'knowledge-tree-component',
    'select(l1.name)': 'knowledge-tree-component',
    'toggle(l2)': 'knowledge-tree-component',
    'select(l2.name)': 'knowledge-tree-component',
    'select(l3.name)': 'knowledge-tree-component',
    toggleEditor: 'question-card-component',
    handleToggleAnswer: 'question-card-component',
    handleToggleCart: 'question-card-component',
    'activeEditTab = tab.id': 'question-card-component',
    handleDelete: 'question-card-component',
    handleSaveProps: 'question-card-component'
});

function stableActionId(expression) {
    return `ui-${crypto.createHash('sha256').update(expression).digest('hex').slice(0, 16)}`;
}

function riskFor(expression) {
    if (R3_EXPRESSIONS.has(expression)) return 'R3';
    if (R2_EXPRESSIONS.has(expression)) return 'R2';
    if (R1_EXPRESSIONS.has(expression)) return 'R1';
    return 'R0';
}

function delegateOwnerFor(owner, expression, risk) {
    if (COMPONENT_DELEGATES[expression]) return COMPONENT_DELEGATES[expression];
    if (risk === 'R3') return 'batch-recognition-coordinator';
    if (owner === 'shared') return 'shared-coordinator';
    return `${owner}-composable`;
}

function automatedEvidenceFor(expression) {
    if (BROWSER_NAVIGATION_EXPRESSIONS.has(expression)) {
        return 'tests/app-ui-navigation-browser.test.js';
    }
    for (const [testFile, expressions] of Object.entries(COMPOSABLE_EVIDENCE)) {
        if (expressions.has(expression)) return testFile;
    }
    return '';
}

function manualAcceptanceFor({ expression, owner, risk, dialogs, sideEffects }) {
    const effectText = sideEffects.length
        ? `只出现已登记副作用：${sideEffects.join('、')}`
        : '界面状态按按钮语义变化，且不产生未登记副作用';
    const dialogText = dialogs.length
        ? `先验证 ${dialogs.join('/')} 的取消路径不改数据，再验证确认路径`
        : '触发一次并核对唯一可见状态变化';
    return Object.freeze({
        precondition: `在全新隔离浏览器上下文准备 ${owner} 的 ${risk} fixture，不读取或改写用户现有 IndexedDB`,
        action: `定位唯一可见控件并触发表达式：${expression}；${dialogText}`,
        expected: `${effectText}；页面、控制台、未处理 Promise 均无错误`,
        isolation: risk === 'R3'
            ? '拦截 /api/ai/** 与 /api/ocr/** 并断言请求数为 0；使用模拟响应另测确认路径'
            : '使用一次性 IndexedDB/存储命名空间；测试结束销毁上下文'
    });
}

const actionManifest = Object.freeze(
    Object.entries(OWNER_EXPRESSIONS).flatMap(([owner, expressions]) => expressions.map(expression => {
        const risk = riskFor(expression);
        const id = stableActionId(expression);
        const dialogs = DIALOGS_BY_EXPRESSION[expression] || Object.freeze([]);
        const sideEffects = EFFECTS_BY_EXPRESSION[expression] || Object.freeze([]);
        const automatedEvidence = automatedEvidenceFor(expression);
        return Object.freeze({
            id,
            expression,
            owner,
            risk,
            fixture: `${risk === 'R3' ? 'blocked-recognition' : risk === 'R2' ? 'isolated-effect' : risk === 'R1' ? 'persistence-spy' : 'state-only'}:${owner}:${id}`,
            dialogs,
            sideEffects,
            delegateOwner: delegateOwnerFor(owner, expression, risk),
            automatedEvidence,
            manualAcceptance: automatedEvidence
                ? null
                : manualAcceptanceFor({ expression, owner, risk, dialogs, sideEffects })
        });
    }))
);

module.exports = Object.freeze({
    actionManifest,
    stableActionId,
    expected: Object.freeze({
        bindingCount: 139,
        actionableBindingCount: 137,
        distinctExpressionCount: 117,
        ownerCounts: Object.freeze({ shared: 21, entry: 19, review: 40, library: 22, settings: 7, exam: 8 }),
        confirmExpressions: Object.freeze(Object.entries(DIALOGS_BY_EXPRESSION)
            .filter(([, dialogs]) => dialogs.includes('confirm')).map(([expression]) => expression).sort()),
        promptExpressions: Object.freeze(Object.entries(DIALOGS_BY_EXPRESSION)
            .filter(([, dialogs]) => dialogs.includes('prompt')).map(([expression]) => expression).sort()),
        fileChooserExpressions: Object.freeze([...FILE_CHOOSER_EXPRESSIONS].sort()),
        aiOcrExpressions: Object.freeze([...R3_EXPRESSIONS].sort()),
        browserNavigationExpressions: Object.freeze([...BROWSER_NAVIGATION_EXPRESSIONS].sort())
    })
});
