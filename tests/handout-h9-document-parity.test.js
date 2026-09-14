'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const model = require('../qisi-handout-model.js');
const preview = require('../qisi-handout-preview.js');
const editionPolicy = require(
    '../qisi-handout-edition-policy.js'
);
const documentPipeline = require(
    '../qisi-handout-document.js'
);
const tableTools = require('../qisi-handout-table.js');

const NOW = '2026-07-29T12:00:00.000Z';

const makeImage = (id, placement, order) => ({
    id: `image-${id}`,
    assetId: `asset-${id}`,
    source: 'handout',
    sourceImageId: '',
    placement,
    width: {
        value: 24,
        unit: 'mm'
    },
    alignment: 'center',
    caption: id,
    order
});

const makeTable = (id, placement, marker) => {
    let table = tableTools.createTable({
        id,
        rows: 1,
        columns: 2,
        placement
    });
    table = tableTools.updateCell(
        table,
        0,
        0,
        { content: marker }
    );
    return table;
};

const makeQuestionBlock = (value = {}) => ({
    id: 'question-h9',
    type: 'question',
    sourceQuestionId: 'source-h9',
    sourceUpdatedAt: '2026-07-29T11:00:00.000Z',
    snapshot: {
        snapshotVersion: 1,
        sourceQuestionId: 'source-h9',
        sourceUpdatedAt: '2026-07-29T11:00:00.000Z',
        capturedAt: NOW,
        questionNumber: '17',
        stem: 'H9_STEM $x^2=1$',
        options: ['H9_A', 'H9_B', 'H9_C', 'H9_D'],
        answer: 'H9_ANSWER',
        analysis: 'H9_ANALYSIS',
        solution: 'H9_SOLUTION',
        teacherNote: 'H9_NOTE',
        images: []
    },
    contentOverrides: {},
    images: [
        makeImage('stem', 'right-of-stem', 0),
        makeImage('below', 'below-stem', 1),
        makeImage('options', 'right-of-options', 2),
        makeImage('block', 'block', 3)
    ],
    tables: [
        makeTable('table-stem', 'after-stem', 'H9_TABLE_STEM'),
        makeTable(
            'table-options',
            'after-options',
            'H9_TABLE_OPTIONS'
        )
    ],
    ...value
});

const makeHandout = block => model.createHandout({
    title: 'H9 同构验收',
    settings: {
        header: {
            enabled: true,
            offsetLeftMm: 3,
            offsetRightMm: 4,
            background: {
                enabled: true,
                color: '#e8f0fe',
                opacity: 0.7,
                heightMm: 8,
                bleed: false
            },
            slots: {
                left: {
                    enabled: true,
                    text: '{title}',
                    fontFamily: 'sans',
                    fontSizePt: 10,
                    fontWeight: 600,
                    color: '#174ea6',
                    lineHeight: 1.3
                }
            }
        }
    },
    blocks: [block]
}, {
    id: 'handout-h9-parity',
    now: NOW
});

const ASSET_PATHS = Object.freeze({
    'asset-stem': '/assets/stem.png',
    'asset-below': '/assets/below.png',
    'asset-options': '/assets/options.png',
    'asset-block': '/assets/block.png'
});

test('H9 HTML projection and Typst keep structured image/table order', () => {
    const handout = makeHandout(makeQuestionBlock());
    const student = editionPolicy.resolveHandoutForEdition(
        handout,
        'student'
    );
    const question = student.blocks[0].question;

    assert.deepEqual(
        question.images.map(image => image.placement),
        [
            'right-of-stem',
            'below-stem',
            'right-of-options',
            'block'
        ]
    );
    assert.deepEqual(
        question.tables.map(table => table.placement),
        ['after-stem', 'after-options']
    );

    const built = documentPipeline.buildTypstDocument(
        handout,
        'student',
        { assetPathById: ASSET_PATHS }
    );
    assert.equal(built.readyForCompile, true);
    assert.deepEqual(
        built.assetRequests
            .map(item => item.assetId)
            .sort(),
        [
            'asset-below',
            'asset-block',
            'asset-options',
            'asset-stem'
        ]
    );

    const orderedMarkers = [
        '/assets/stem.png',
        '/assets/below.png',
        'H9_TABLE_STEM',
        '/assets/options.png',
        'H9_TABLE_OPTIONS',
        '/assets/block.png'
    ];
    let previousIndex = -1;
    for (const marker of orderedMarkers) {
        const index = built.source.indexOf(marker);
        assert.ok(index > previousIndex, marker);
        previousIndex = index;
    }
    assert.match(
        built.source,
        /font: "Noto Sans CJK SC"/
    );
    assert.match(
        built.source,
        /pad\(left: 3mm, right: 4mm/
    );
});

test('H9 visibility preserves option labels and removes hidden images', () => {
    const handout = makeHandout(makeQuestionBlock({
        visibility: {
            question: true,
            answer: true,
            analysis: true,
            solution: true,
            teacherNote: true,
            hiddenOptionIndexes: [1],
            hiddenImageIds: ['image-below']
        }
    }));
    const projection = preview.projectHandoutForPreview(
        handout,
        'student'
    );
    const question = projection.blocks[0].question;

    assert.deepEqual(
        question.optionItems.map(item => item.index),
        [0, 2, 3]
    );
    assert.deepEqual(
        question.images.map(image => image.id),
        ['image-stem', 'image-options', 'image-block']
    );
    assert.equal('answer' in question, false);
    assert.equal('analysis' in question, false);
    assert.equal('solution' in question, false);
});

test('H9 end placements can attach a stem or hide the body question', () => {
    const withSummary = makeHandout(makeQuestionBlock({
        display: {
            answerPlacement: 'end-with-summary',
            analysisPlacement: 'hidden',
            solutionPlacement: 'hidden'
        }
    }));
    const summaryProjection =
        editionPolicy.resolveHandoutForEdition(
            withSummary,
            'teacher'
        );
    assert.equal(summaryProjection.blocks.length, 1);
    assert.equal(summaryProjection.endSections[0].mode, 'end-with-summary');
    assert.equal(
        summaryProjection.endSections[0].summary,
        'H9_STEM $x^2=1$'
    );

    const hiddenBody = makeHandout(makeQuestionBlock({
        display: {
            answerPlacement: 'end-hide-question',
            analysisPlacement: 'hidden',
            solutionPlacement: 'hidden'
        }
    }));
    const teacher = editionPolicy.resolveHandoutForEdition(
        hiddenBody,
        'teacher'
    );
    const student = editionPolicy.resolveHandoutForEdition(
        hiddenBody,
        'student'
    );
    assert.equal(teacher.blocks.length, 0);
    assert.equal(teacher.endSections.length, 1);
    assert.equal(teacher.endSections[0].questionNumber, '17');
    assert.equal(student.blocks.length, 1);
    assert.equal(student.endSections, undefined);
});

test('H9 legacy end-answer-only values migrate to the named behavior', () => {
    const handout = makeHandout(makeQuestionBlock({
        display: {
            answerPlacement: 'end-answer-only'
        }
    }));

    assert.equal(
        handout.blocks[0].display.answerPlacement,
        'end-hide-question'
    );
});
