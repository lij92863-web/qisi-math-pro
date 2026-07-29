'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const model = require('../qisi-handout-model.js');
const editionPolicy = require('../qisi-handout-edition-policy.js');
const documentPipeline = require('../qisi-handout-document.js');
const template = require('../qisi-handout-typst-template.js');

const NOW = '2026-07-29T09:00:00.000Z';

const makeQuestionBlock = (value = {}) => ({
    id: 'question-1',
    type: 'question',
    sourceQuestionId: 'source-question-1',
    sourceUpdatedAt: '2026-07-28T08:00:00.000Z',
    snapshot: {
        snapshotVersion: 1,
        sourceQuestionId: 'source-question-1',
        sourceUpdatedAt: '2026-07-28T08:00:00.000Z',
        capturedAt: NOW,
        questionNumber: '7',
        stem: '计算 $\\frac{1}{2}，  x+1$，并防止 #eval("bad")。',
        options: [
            '$1$',
            '$2$',
            '$3$',
            '$4$'
        ],
        answer: 'SECRET_ANSWER_42',
        analysis: 'SECRET_ANALYSIS_42',
        solution: 'SECRET_SOLUTION_42',
        teacherNote: 'SECRET_TEACHER_NOTE_42',
        source: '校本题库',
        tags: ['分数'],
        knowledgePoints: ['分式'],
        meta: {
            privateEvidence: 'SECRET_META_42'
        },
        sourceTrace: {
            privateEvidence: 'SECRET_TRACE_42'
        },
        images: []
    },
    contentOverrides: {},
    display: {
        showQuestionNumber: true,
        showOptions: true,
        showKnowledgePoints: 'inherit',
        showSource: 'inherit',
        showTags: 'inherit',
        answerPlacement: 'inherit',
        analysisPlacement: 'inherit',
        solutionPlacement: 'inherit',
        answerSpaceLines: 2
    },
    questionLabel: {
        preset: 'exercise',
        customText: ''
    },
    optionLayout: {
        mode: 'auto'
    },
    images: [{
        id: 'question-image-1',
        assetId: 'asset-1',
        source: 'handout',
        placement: 'right-of-stem',
        width: {
            value: 35,
            unit: 'percent'
        },
        alignment: 'center',
        caption: '函数图像',
        order: 0
    }],
    latexNormalization: {
        useDisplayFractions: true,
        normalizePunctuation: true,
        normalizeSpacing: true
    },
    ...value
});

const makeHandout = (value = {}) => model.createHandout({
    title: 'H4 "安全" 讲义',
    settings: {
        questionDefaults: {
            showKnowledgePoints: false,
            showSource: false,
            showTags: false,
            answerPlacement: 'end',
            analysisPlacement: 'after-question',
            solutionPlacement: 'end'
        },
        page: {
            margin: {
                leftMm: 18,
                rightMm: 18,
                topMm: 19,
                bottomMm: 17
            },
            bodyFontPt: 10.5,
            lineHeightEm: 0.86
        },
        header: {
            enabled: true,
            text: '{title} · {edition}',
            alignment: 'right'
        },
        footer: {
            enabled: true,
            text: '第 {page}/{pages} 页 · {date}',
            alignment: 'center'
        },
        documentDate: '2026-07-29',
        editions: {
            teacher: {
                questionDefaults: {
                    showSource: true,
                    showTags: true
                }
            }
        }
    },
    blocks: [
        {
            id: 'heading-1',
            type: 'heading',
            level: 1,
            text: '函数专题'
        },
        {
            id: 'body-1',
            type: 'body',
            content: '#eval("owned")\n#set text(size: 99pt)'
        },
        {
            id: 'teacher-callout',
            type: 'callout',
            variant: 'teacher',
            title: '教师提示',
            content: 'SECRET_TEACHER_CALLOUT_42'
        },
        makeQuestionBlock(),
        {
            id: 'page-break-1',
            type: 'page-break'
        }
    ],
    ...value
}, {
    id: 'handout-h4',
    now: NOW
});

const ASSETS = Object.freeze({
    'asset-1': '/assets/asset-1.png'
});

test('H4 edition inheritance is deterministic and student placement always fails closed', () => {
    const handout = makeHandout();
    const student = editionPolicy.resolveHandoutForEdition(
        handout,
        'student'
    );
    const teacher = editionPolicy.resolveHandoutForEdition(
        handout,
        'teacher'
    );
    const studentQuestion = student.blocks.find(
        block => block.type === 'question'
    ).question;
    const teacherQuestion = teacher.blocks.find(
        block => block.type === 'question'
    ).question;

    assert.equal(studentQuestion.display.answerPlacement, 'hidden');
    assert.equal(studentQuestion.display.analysisPlacement, 'hidden');
    assert.equal(studentQuestion.display.solutionPlacement, 'hidden');
    assert.equal(studentQuestion.showSource, undefined);
    assert.equal(
        student.blocks.some(block => block.id === 'teacher-callout'),
        false
    );

    assert.equal(teacherQuestion.display.showSource, true);
    assert.equal(teacherQuestion.display.showTags, true);
    assert.equal(teacherQuestion.display.answerPlacement, 'end');
    assert.equal(
        teacher.endSections.map(item => item.field).join(','),
        'answer,solution'
    );
    assert.deepEqual(
        editionPolicy.resolveHandoutForEdition(handout, 'teacher'),
        teacher
    );
});

test('H4 student projection physically excludes teacher fields, metadata and sentinels', () => {
    const handout = makeHandout();
    const protectedNeedles = editionPolicy.collectProtectedNeedles(
        handout
    );
    const student = editionPolicy.resolveHandoutForEdition(
        handout,
        'student'
    );
    const report = editionPolicy.scanStudentProjection(
        student,
        { protectedNeedles }
    );
    const serialized = JSON.stringify(student);

    assert.equal(report.ok, true);
    for (const needle of protectedNeedles) {
        assert.equal(serialized.includes(needle), false, needle);
    }
    for (const key of editionPolicy.FORBIDDEN_STUDENT_KEYS) {
        assert.equal(serialized.includes(`"${key}"`), false, key);
    }

    const malicious = structuredClone(student);
    malicious.blocks[0].answer = 'SECRET_ANSWER_42';
    assert.equal(
        editionPolicy.scanStudentProjection(
            malicious,
            { protectedNeedles }
        ).ok,
        false
    );
    assert.throws(
        () => editionPolicy.assertStudentProjectionSafe(
            malicious,
            { protectedNeedles }
        ),
        error => error.code === 'HANDOUT_STUDENT_LEAKAGE'
    );
});

test('H4 Typst string and placeholder handling prevents source injection', () => {
    assert.equal(
        documentPipeline.typstStringLiteral(
            '" ] #eval("owned")\n#set page(width: 1pt)'
        ),
        '"\\" ] #eval(\\"owned\\")\\n#set page(width: 1pt)"'
    );
    assert.match(
        documentPipeline.resolveLocalPlaceholderSource(
            '{title} · {page}/{pages} · {date}',
            {
                title: '讲义',
                date: '2026-07-29'
            }
        ),
        /counter\(page\)\.display/
    );
    assert.throws(
        () => documentPipeline.resolveLocalPlaceholderSource(
            '{title} {unknown}',
            { title: '讲义' }
        ),
        /unsupported handout placeholder/i
    );

    const built = documentPipeline.buildTypstDocument(
        makeHandout(),
        'student',
        { assetPathById: ASSETS }
    );
    assert.doesNotMatch(built.source, /\n#eval\("owned"\)/);
    assert.doesNotMatch(built.source, /\n#set text\(size: 99pt\)/);
    assert.match(
        built.source,
        /#text\("#eval\(\\"owned\\"\)"\)#linebreak\(\)#text\("#set text\(size: 99pt\)"\)/
    );
});

test('H4 formula display normalization is audited and reversible', () => {
    const normalized = documentPipeline.normalizeLatexForDisplay(
        '\\frac{1}{2}，  x',
        {
            useDisplayFractions: true,
            normalizePunctuation: true,
            normalizeSpacing: true
        }
    );

    assert.equal(normalized.normalized, '\\dfrac{1}{2}, x');
    assert.deepEqual(normalized.operations, [
        'use-display-fractions',
        'normalize-punctuation',
        'normalize-spacing'
    ]);
    assert.equal(
        documentPipeline.restoreLatexNormalization(
            normalized,
            normalized.normalized
        ),
        '\\frac{1}{2}，  x'
    );
    assert.throws(
        () => documentPipeline.restoreLatexNormalization(
            normalized,
            'changed'
        ),
        error => error.code === 'HANDOUT_FORMULA_AUDIT_MISMATCH'
    );
});

test('H4 student and teacher Typst documents share layout policy but not protected content', () => {
    const handout = makeHandout();
    const before = structuredClone(handout);
    const student = documentPipeline.buildTypstDocument(
        handout,
        'student',
        { assetPathById: ASSETS }
    );
    const teacher = documentPipeline.buildTypstDocument(
        handout,
        'teacher',
        { assetPathById: ASSETS }
    );

    assert.equal(student.templateId, template.TEMPLATE_ID);
    assert.equal(student.templateVersion, template.TEMPLATE_VERSION);
    assert.equal(student.readyForCompile, true);
    assert.equal(student.leakageReport.ok, true);
    assert.equal(student.projection.blocks.find(
        block => block.type === 'question'
    ).question.optionLayout.columns, 4);
    assert.match(student.source, /columns: \(1fr, 1fr, 1fr, 1fr\)/);
    assert.match(student.source, /columns: \(1\.55fr, 1fr\)/);
    assert.match(student.source, /\/assets\/asset-1\.png/);
    assert.match(student.source, /counter\(page\)\.display/);
    assert.match(student.source, /counter\(page\)\.final/);
    assert.doesNotMatch(student.source, /SECRET_(ANSWER|ANALYSIS|SOLUTION|TEACHER)/);

    assert.match(teacher.source, /SECRET_ANSWER_42/);
    assert.match(teacher.source, /SECRET_ANALYSIS_42/);
    assert.match(teacher.source, /SECRET_SOLUTION_42/);
    assert.match(teacher.source, /SECRET_TEACHER_CALLOUT_42/);
    assert.equal(teacher.projection.endSections.length, 2);
    assert.deepEqual(handout, before);
});

test('H4 document output is deterministic, maps every emitted block, and records formulas', () => {
    const handout = makeHandout();
    const first = documentPipeline.buildTypstDocument(
        handout,
        'student',
        { assetPathById: ASSETS }
    );
    const second = documentPipeline.buildTypstDocument(
        handout,
        'student',
        { assetPathById: ASSETS }
    );

    assert.equal(first.source, second.source);
    assert.deepEqual(first.lineMap, second.lineMap);
    assert.deepEqual(
        first.lineMap.map(item => item.blockId),
        [
            'heading-1',
            'body-1',
            'question-1',
            'page-break-1'
        ]
    );
    assert.ok(first.lineMap.every(
        item => item.endLine >= item.startLine
    ));
    assert.ok(first.normalizationAudit.length >= 5);
    const stemFormula = first.normalizationAudit.find(
        item => item.field === 'stem'
    );
    assert.equal(stemFormula.normalized, '\\dfrac{1}{2}, x+1');
    assert.equal(
        documentPipeline.restoreLatexNormalization(
            stemFormula,
            stemFormula.normalized
        ),
        '\\frac{1}{2}，  x+1'
    );
});

test('H4 missing or unsafe assets fail the compile-readiness contract', () => {
    const missing = documentPipeline.buildTypstDocument(
        makeHandout(),
        'student'
    );
    const unsafe = documentPipeline.buildTypstDocument(
        makeHandout(),
        'student',
        {
            assetPathById: {
                'asset-1': '/../outside.png'
            }
        }
    );

    assert.equal(missing.readyForCompile, false);
    assert.deepEqual(
        missing.diagnostics.map(item => item.code),
        ['missing-asset-path']
    );
    assert.equal(unsafe.readyForCompile, false);
    assert.deepEqual(
        unsafe.diagnostics.map(item => item.code),
        ['invalid-asset-path']
    );
    assert.throws(
        () => documentPipeline.normalizeAssetPath('/assets/../secret'),
        /invalid/i
    );
});

test('H4 has one centrally managed A4 template', () => {
    const documentSource = fs.readFileSync(
        path.join(__dirname, '..', 'qisi-handout-document.js'),
        'utf8'
    );
    const templateSource = fs.readFileSync(
        path.join(__dirname, '..', 'qisi-handout-typst-template.js'),
        'utf8'
    );

    assert.doesNotMatch(documentSource, /#set page\(/);
    assert.match(templateSource, /#set page\(/);
    assert.match(templateSource, /paper: "a4"/);
    assert.match(templateSource, /Noto Serif CJK SC/);
});
