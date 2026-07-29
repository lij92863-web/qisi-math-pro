'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const model = require('../qisi-handout-model.js');
const questionInstance =
    require('../qisi-handout-question-instance.js');
const sourceUpdate = require('../qisi-handout-source-update.js');
const batchSettings = require('../qisi-handout-batch-settings.js');
const editorState = require('../qisi-handout-editor-state.js');
const assetRepository =
    require('../qisi-handout-asset-repository.js');
const editionPolicy =
    require('../qisi-handout-edition-policy.js');
const documentPipeline =
    require('../qisi-handout-document.js');

const NOW = '2026-07-29T10:00:00.000Z';
const SOURCE_TIME = '2026-07-28T08:00:00.000Z';

const makeQuestionBlock = (id, value = {}) => ({
    id,
    type: 'question',
    sourceQuestionId: `source-${id}`,
    sourceUpdatedAt: SOURCE_TIME,
    snapshot: {
        snapshotVersion: 1,
        sourceQuestionId: `source-${id}`,
        sourceUpdatedAt: SOURCE_TIME,
        capturedAt: NOW,
        questionNumber: id.slice(-1),
        stem: `题干 ${id}`,
        options: ['1', '2', '3', '4'],
        answer: `答案 ${id}`,
        analysis: `分析 ${id}`,
        solution: `解析 ${id}`,
        knowledgePoints: ['函数'],
        images: [],
        ...value.snapshot
    },
    contentOverrides: value.contentOverrides || {},
    display: {
        showQuestionNumber: true,
        showOptions: true,
        showKnowledgePoints: 'inherit',
        showSource: 'inherit',
        showTags: 'inherit',
        answerPlacement: 'inherit',
        analysisPlacement: 'inherit',
        solutionPlacement: 'inherit',
        answerSpaceLines: 0
    },
    questionLabel: {
        preset: 'none',
        customText: ''
    },
    displayLabels: [],
    optionLayout: {
        mode: 'auto'
    },
    imageLayout: {
        mode: 'flow',
        columns: 2,
        gapMm: 4
    },
    images: value.images || [],
    latexNormalization: {
        useDisplayFractions: false,
        normalizePunctuation: false,
        normalizeSpacing: false
    }
});

const makeHandout = (blocks, settings = {}) =>
    model.createHandout({
        title: 'H7 讲义',
        blocks,
        settings
    }, {
        id: 'handout-h7',
        now: NOW
    });

test('H7 batch settings change only selected presentation fields and undo in one step', () => {
    const original = makeHandout([
        makeQuestionBlock('question-1'),
        makeQuestionBlock('question-2')
    ]);
    const changed = batchSettings.applyBatchQuestionSettings(
        original,
        ['question-1'],
        {
            display: {
                answerPlacement: 'end',
                showKnowledgePoints: true,
                answerSpaceLines: 3
            },
            optionLayout: {
                mode: 'two-columns'
            },
            displayLabels: [{
                type: 'custom',
                value: '方法一'
            }],
            imageLayout: {
                mode: 'grid',
                columns: 2,
                gapMm: 5
            }
        }
    );
    const first = changed.blocks[0];
    const second = changed.blocks[1];

    assert.equal(first.display.answerPlacement, 'end');
    assert.equal(first.optionLayout.mode, 'two-columns');
    assert.equal(first.displayLabels[0].value, '方法一');
    assert.equal(first.snapshot.stem, '题干 question-1');
    assert.equal(second.optionLayout.mode, 'auto');

    const initialState = editorState.createEditorState(original);
    const committed = editorState.commitHandout(
        initialState,
        changed,
        { mutationKey: 'batch-test' }
    );
    assert.equal(committed.undoStack.length, 1);
    assert.deepEqual(
        editorState.undo(committed).handout,
        editorState.normalizeForEditing(original)
    );

    assert.throws(
        () => batchSettings.applyBatchQuestionSettings(
            original,
            ['question-1'],
            {
                stem: '禁止批量改题干'
            }
        ),
        /unsupported field/
    );
});

test('H7 source refresh requires explicit conflict acceptance and updates only selected fields', () => {
    const block = makeQuestionBlock(
        'question-1',
        {
            contentOverrides: {
                stem: '讲义局部题干'
            }
        }
    );
    const source = {
        id: 'source-question-1',
        updatedAt: '2026-07-29T11:00:00.000Z',
        stem: '题库新题干',
        options: ['A', 'B', 'C', 'D'],
        answer: '题库新答案',
        analysis: '分析 question-1',
        solution: '解析 question-1',
        knowledgePoints: ['函数'],
        images: []
    };
    const comparison = questionInstance.compareQuestionSource(
        block.snapshot,
        source,
        block.contentOverrides
    );

    assert.ok(comparison.changedFields.includes('stem'));
    assert.ok(comparison.conflictFields.includes('stem'));
    assert.throws(
        () => sourceUpdate.createSourceUpdatePlan(
            block,
            source,
            {
                selectedFields: ['stem', 'answer']
            }
        ),
        error => error.code === 'HANDOUT_SOURCE_CONFLICT'
    );

    const plan = sourceUpdate.createSourceUpdatePlan(
        block,
        source,
        {
            selectedFields: ['stem', 'answer'],
            acceptedConflictFields: ['stem']
        }
    );
    const refreshed = sourceUpdate.applySourceUpdatePlan(
        block,
        source,
        plan,
        {
            now: '2026-07-29T11:01:00.000Z'
        }
    );

    assert.equal(refreshed.snapshot.stem, '题库新题干');
    assert.equal(refreshed.snapshot.answer, '题库新答案');
    assert.deepEqual(
        refreshed.snapshot.options,
        block.snapshot.options
    );
    assert.equal('stem' in refreshed.contentOverrides, false);
    assert.equal(source.stem, '题库新题干');
});

test('H7 header/footer assets participate in ownership and copy remapping', () => {
    const handout = makeHandout(
        [],
        {
            header: {
                slots: {
                    left: {
                        enabled: true,
                        text: '{title}',
                        assetId: 'asset-logo',
                        imageWidthMm: 12
                    }
                }
            }
        }
    );
    assert.deepEqual(
        assetRepository.collectHandoutAssetIds(handout),
        ['asset-logo']
    );
    const remapped = assetRepository.remapHandoutAssetIds(
        handout,
        new Map([['asset-logo', 'asset-logo-copy']])
    );
    assert.equal(
        remapped.settings.header.slots.left.assetId,
        'asset-logo-copy'
    );
});

test('H7 regions migrate legacy text and deep-merge edition slot overrides', () => {
    const legacy = makeHandout(
        [],
        {
            header: {
                enabled: true,
                left: '旧版左侧',
                center: '',
                right: ''
            }
        }
    );
    const migrated = editorState.normalizeForEditing(legacy);
    assert.equal(
        migrated.settings.header.slots.left.text,
        '旧版左侧'
    );
    assert.equal(
        migrated.settings.header.slots.left.enabled,
        true
    );

    const handout = makeHandout(
        [],
        {
            header: {
                enabled: true,
                left: '旧字段不得覆盖显式槽',
                slots: {
                    left: {
                        enabled: false,
                        text: '显式关闭'
                    },
                    center: {
                        enabled: true,
                        text: '基础中间'
                    }
                },
                background: {
                    enabled: true,
                    color: '#e8f0fe',
                    opacity: 0.2
                }
            },
            editions: {
                teacher: {
                    header: {
                        slots: {
                            center: {
                                text: '教师中间'
                            }
                        },
                        background: {
                            opacity: 0.4
                        }
                    }
                }
            }
        }
    );
    const teacher = editionPolicy.resolveHandoutForEdition(
        handout,
        'teacher'
    );

    assert.equal(teacher.settings.header.slots.left.enabled, false);
    assert.equal(teacher.settings.header.slots.left.text, '显式关闭');
    assert.equal(
        teacher.settings.header.slots.center.text,
        '教师中间'
    );
    assert.equal(
        teacher.settings.header.background.color,
        '#e8f0fe'
    );
    assert.equal(
        teacher.settings.header.background.opacity,
        0.4
    );
});

test('H7 HTML/formal projections share custom labels, image grid and bounded regions', () => {
    const block = makeQuestionBlock(
        'question-1',
        {
            images: [
                {
                    id: 'image-1',
                    assetId: 'asset-1',
                    source: 'handout',
                    placement: 'below-stem',
                    width: {
                        value: 46,
                        unit: 'percent'
                    },
                    alignment: 'center',
                    caption: '图一',
                    order: 0
                },
                {
                    id: 'image-2',
                    assetId: 'asset-2',
                    source: 'handout',
                    placement: 'below-stem',
                    width: {
                        value: 46,
                        unit: 'percent'
                    },
                    alignment: 'center',
                    caption: '图二',
                    order: 1
                }
            ]
        }
    );
    block.displayLabels = [
        {
            type: 'preset',
            value: 'authentic'
        },
        {
            type: 'custom',
            value: '方法一'
        }
    ];
    block.imageLayout = {
        mode: 'row',
        columns: 2,
        gapMm: 4
    };
    const handout = makeHandout(
        [block],
        {
            metadata: {
                teacher: '张老师',
                school: '示例中学'
            },
            header: {
                enabled: true,
                scope: 'all',
                distanceMm: 8,
                heightMm: 9,
                slots: {
                    left: {
                        enabled: true,
                        text: '{title}',
                        assetId: 'asset-logo',
                        imageWidthMm: 10
                    },
                    center: {
                        enabled: true,
                        text: '{school}'
                    }
                },
                background: {
                    enabled: true,
                    color: '#e8f0fe',
                    opacity: 0.25,
                    heightMm: 9,
                    bleed: false
                }
            },
            footer: {
                enabled: true,
                scope: 'all',
                right: '第 {page}/{pages} 页'
            }
        }
    );
    const teacher = editionPolicy.resolveHandoutForEdition(
        handout,
        'teacher'
    );
    const document = documentPipeline.buildTypstDocument(
        handout,
        'teacher',
        {
            assetPathById: {
                'asset-1': '/assets/asset-1.png',
                'asset-2': '/assets/asset-2.png',
                'asset-logo': '/assets/asset-logo.png'
            }
        }
    );

    assert.deepEqual(
        teacher.blocks[0].question.displayLabels,
        block.displayLabels
    );
    assert.equal(
        teacher.blocks[0].question.imageLayout.mode,
        'row'
    );
    assert.match(document.source, /真题 · 方法一/);
    assert.match(document.source, /columns: \(1fr, 1fr\)/);
    assert.match(document.source, /asset-logo\.png/);
    assert.match(document.source, /#e8f0fe40/i);
    assert.equal(document.readyForCompile, true);
    assert.deepEqual(
        document.assetRequests.map(item => item.assetId).sort(),
        ['asset-1', 'asset-2', 'asset-logo']
    );
});
