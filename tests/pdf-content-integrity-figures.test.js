const test = require('node:test');
const assert = require('node:assert/strict');

const integrity = require('../qisi-pdf-content-integrity.js');

test('figure ownership requires at least 0.90 overlap and one unambiguous owner', () => {
    const candidates = [
        { id: 'q4', page: 1, normalizedBbox: [0.05, 0.1, 0.95, 0.52] },
        { id: 'q5', page: 1, normalizedBbox: [0.05, 0.55, 0.95, 0.95] }
    ];
    const result = integrity.assignFigureOwner({
        figure: { page: 1, normalizedBbox: [0.5, 0.3, 0.8, 0.48] },
        candidates
    });
    assert.equal(result.status, 'assigned');
    assert.equal(result.owner.id, 'q4');
    assert.equal(result.overlap, 1);
});

test('nearest-question guessing is rejected when the figure crosses regions', () => {
    const result = integrity.assignFigureOwner({
        figure: { page: 1, normalizedBbox: [0.2, 0.45, 0.8, 0.65] },
        candidates: [
            { id: 'q4', page: 1, normalizedBbox: [0, 0, 1, 0.55] },
            { id: 'q5', page: 1, normalizedBbox: [0, 0.55, 1, 1] }
        ]
    });
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason, 'owner-overlap-below-threshold');
});

test('crop contamination reports foreign question overlap', () => {
    const result = integrity.detectCropContamination({
        cropBbox: [0.1, 0.2, 0.9, 0.7],
        ownerId: 'q4',
        regions: [
            { id: 'q4', normalizedBbox: [0.05, 0.1, 0.95, 0.6] },
            { id: 'q5', normalizedBbox: [0.05, 0.62, 0.95, 0.95] }
        ]
    });
    assert.equal(result.contaminated, true);
    assert.equal(result.foreignRegions[0].id, 'q5');
});

test('question ownership region extends to the next explicit question start', () => {
    const regions = integrity.deriveQuestionOwnershipRegions([
        { id: 'q4', sourceFileId: 'brief', page: 1, normalizedBbox: [0.138, 0.429, 0.84, 0.505] },
        { id: 'q5', sourceFileId: 'brief', page: 1, normalizedBbox: [0.138, 0.809, 0.838, 0.865] },
        { id: 'other-file-q4', sourceFileId: 'other', page: 1, normalizedBbox: [0.1, 0.4, 0.9, 0.9] }
    ]);
    const briefRegions = regions.filter(region => region.sourceFileId === 'brief');
    const decision = integrity.assignFigureOwner({
        figure: { page: 1, normalizedBbox: [0.178, 0.614, 0.35, 0.72] },
        candidates: briefRegions,
        minOverlap: 0.9
    });

    assert.deepEqual(briefRegions[0].normalizedBbox, [0.138, 0.429, 0.84, 0.809]);
    assert.equal(briefRegions[0].boundarySource, 'next-question-start');
    assert.equal(decision.status, 'assigned');
    assert.equal(decision.owner.id, 'q4');
    assert.equal(integrity.detectCropContamination({
        cropBbox: [0.178, 0.614, 0.35, 0.72],
        ownerId: 'q4',
        regions: briefRegions
    }).contaminated, false);
});

test('overlapping question boxes do not manufacture an expanded ownership region', () => {
    const regions = integrity.deriveQuestionOwnershipRegions([
        { id: 'q4', page: 1, normalizedBbox: [0.1, 0.4, 0.9, 0.7] },
        { id: 'q5', page: 1, normalizedBbox: [0.1, 0.65, 0.9, 0.9] }
    ]);

    assert.deepEqual(regions[0].normalizedBbox, [0.1, 0.4, 0.9, 0.7]);
    assert.equal(regions[0].boundaryAmbiguous, true);
});

test('crop contamination never compares coordinate bands from another page', () => {
    const result = integrity.detectCropContamination({
        cropBbox: [0.145, 0.75, 0.345, 0.88],
        ownerId: 'q4',
        page: 1,
        regions: [
            { id: 'q4', page: 1, normalizedBbox: [0.105, 0.53, 0.849, 0.9] },
            { id: 'q11', page: 2, normalizedBbox: [0.148, 0.658, 0.88, 0.788] }
        ]
    });

    assert.equal(result.contaminated, false);
    assert.deepEqual(result.foreignRegions, []);
});

test('PDF operator placements are converted into normalized page image boxes', () => {
    const OPS = {
        save: 1,
        restore: 2,
        transform: 3,
        paintImageXObject: 4
    };
    const placements = integrity.extractPlacedImageBboxes({
        fnArray: [OPS.save, OPS.transform, OPS.paintImageXObject, OPS.restore],
        argsArray: [[], [150, 0, 0, 140, 367, 600], ['img_q6'], []]
    }, {
        opCodes: OPS,
        viewportTransform: [2, 0, 0, -2, 0, 1684],
        pageWidth: 1190,
        pageHeight: 1684
    });

    assert.equal(placements.length, 1);
    assert.equal(placements[0].imageRef, 'img_q6');
    assert.deepEqual(placements[0].bbox, [617, 121, 869, 287]);
});

test('support answer markers create cross-page ownership regions', () => {
    const report = integrity.buildSupportQuestionRegions([
        {
            pageNo: 1,
            lines: [
                { text: '6【答案】C', ny1: 863 },
            ]
        },
        {
            pageNo: 2,
            lines: [
                { text: '7【答案】ABD', ny1: 406 }
            ]
        },
        {
            pageNo: 3,
            lines: [
                { text: '8【答案】AC', ny1: 91 },
                { text: '9【答案】ABD', ny1: 416 }
            ]
        }
    ], { expectedQuestionNumbers: ['6', '7', '8', '9'] });

    assert.equal(report.ok, true);
    assert.deepEqual(
        report.regions.filter(region => region.question === '6').map(region => ({
            page: region.page,
            bbox: region.normalizedBbox
        })),
        [
            { page: 1, bbox: [0, 0.863, 1, 1] },
            { page: 2, bbox: [0, 0, 1, 0.406] }
        ]
    );
});

test('embedded answer figures bind only to a unique explicit solution region', () => {
    const layouts = [
        {
            pageNo: 1,
            lines: [
                { text: '6【答案】C', ny1: 863 }
            ],
            placedImages: []
        },
        {
            pageNo: 2,
            lines: [
                { text: '7【答案】ABD', ny1: 406 }
            ],
            placedImages: [{ normalizedBbox: [0.617, 0.118, 0.87, 0.288] }]
        },
        {
            pageNo: 3,
            lines: [
                { text: '8【答案】AC', ny1: 91 },
                { text: '9【答案】ABD', ny1: 416 }
            ],
            placedImages: [{ normalizedBbox: [0.69, 0.2, 0.867, 0.366] }]
        }
    ];
    const result = integrity.bindPlacedFiguresToSolutions({
        solutions: [
            { question: '6', solution: '解析六' },
            { question: '7', solution: '解析七' },
            { question: '8', solution: '解析八' },
            { question: '9', solution: '解析九' }
        ],
        layouts,
        pageImages: [
            { pageNo: 2, imageUrl: 'data:image/jpeg;base64,page2' },
            { pageNo: 3, imageUrl: 'data:image/jpeg;base64,page3' }
        ],
        expectedQuestionNumbers: ['6', '7', '8', '9']
    });

    assert.deepEqual(result.decisions.map(decision => decision.question), ['6', '8']);
    assert.equal(result.solutions[0].images.length, 1);
    assert.equal(result.solutions[0].sourcePage, 2);
    assert.equal(result.solutions[0].sourcePageImage, 'data:image/jpeg;base64,page2');
    assert.equal(result.solutions[2].images.length, 1);
    assert.equal(result.rejected.length, 0);
});

test('support image binding fails closed when markers are discontinuous', () => {
    const result = integrity.bindPlacedFiguresToSolutions({
        solutions: [{ question: '6', solution: '解析六' }, { question: '8', solution: '解析八' }],
        layouts: [{
            pageNo: 1,
            lines: [{ text: '6【答案】C', ny1: 100 }, { text: '8【答案】AC', ny1: 500 }],
            placedImages: [{ normalizedBbox: [0.6, 0.2, 0.8, 0.4] }]
        }],
        expectedQuestionNumbers: ['6', '7', '8']
    });

    assert.equal(result.regionReport.ok, false);
    assert.equal(result.decisions.length, 0);
    assert.equal(result.solutions.some(solution => solution.images?.length), false);
});

test('embedded question figures bind by explicit regions and reject text-band crops', () => {
    const result = integrity.bindPlacedFiguresToQuestions({
        questions: [
            { question: '4', stem: '如图，折扇题', recognizedImages: [{ image_bbox: [100, 500, 900, 700] }] },
            { question: '5', stem: '下一题' }
        ],
        layouts: [{
            pageNo: 1,
            lines: [
                { text: '4. 如图，折扇题', nx1: 100, ny1: 300, nx2: 550, ny2: 330 },
                { text: 'A. 292π B. 1330√2/3π C. 195π D. 243π', nx1: 100, ny1: 620, nx2: 900, ny2: 660 },
                { text: '5. 下一题', nx1: 100, ny1: 720, nx2: 500, ny2: 750 }
            ],
            placedImages: [
                { imageRef: 'real-q4', normalizedBbox: [0.16, 0.40, 0.84, 0.58] },
                { imageRef: 'text-band', normalizedBbox: [0.08, 0.60, 0.92, 0.68] }
            ]
        }],
        expectedQuestionNumbers: ['4', '5']
    });

    assert.equal(result.decisions.length, 1);
    assert.equal(result.decisions[0].question, '4');
    assert.equal(result.questions[0].recognizedImages.length, 1);
    assert.equal(result.questions[0].recognizedImages[0].source, 'pdf-embedded-image-placement');
    assert.equal(result.questions[0].recognizedImages[0].contentRole, 'question');
    assert.equal(
        integrity.isVerifiedPdfQuestionFigure(result.questions[0].recognizedImages[0], '4'),
        true
    );
    assert.equal(
        integrity.isVerifiedPdfQuestionFigure(result.questions[0].recognizedImages[0], '5'),
        false
    );
    assert.equal(
        integrity.isVerifiedPdfQuestionFigure({
            ...result.questions[0].recognizedImages[0],
            image_bbox: [0, 0, 1000, 1000]
        }, '4'),
        false
    );
    assert.ok(result.rejected.some(item => item.reason === 'figure-crop-contains-options'));
    assert.equal(result.questions[0].manualReviewRequired, true);
});

test('validated question bbox sequence safely fills a missing PDF text marker boundary', () => {
    const result = integrity.bindPlacedFiguresToQuestions({
        questions: [
            { question: '10', sourcePage: 2, sourceFileId: 'full', normalizedQuestionBbox: [0.1, 0.1, 0.9, 0.2] },
            { question: '11', sourcePage: 2, sourceFileId: 'full', normalizedQuestionBbox: [0.1, 0.35, 0.9, 0.45] },
            { question: '12', sourcePage: 2, sourceFileId: 'full', normalizedQuestionBbox: [0.1, 0.7, 0.9, 0.8] }
        ],
        layouts: [{
            pageNo: 2,
            lines: [
                { text: '10. previous', nx1: 100, ny1: 100, nx2: 500, ny2: 130 },
                { text: '12. next', nx1: 100, ny1: 700, nx2: 500, ny2: 730 }
            ],
            placedImages: [
                { imageRef: 'q11-figure', normalizedBbox: [0.2, 0.48, 0.8, 0.62] }
            ]
        }],
        expectedQuestionNumbers: ['10', '11', '12']
    });

    assert.equal(result.regionReport.ok, true);
    assert.equal(result.regionReport.source, 'validated-question-bbox-sequence');
    assert.equal(result.decisions.length, 1);
    assert.equal(result.decisions[0].question, '11');
});

test('PDF text regions recover question numbers split into separate glyph runs', () => {
    const result = integrity.bindPlacedFiguresToQuestions({
        questions: [
            { question: '10', stem: 'previous' },
            { question: '11', stem: 'figure question' },
            { question: '12', stem: 'next' }
        ],
        layouts: [{
            pageNo: 2,
            lines: [
                { text: '10 . previous', nx1: 100, ny1: 100, nx2: 500, ny2: 130 },
                { text: '1 1 . figure question', nx1: 100, ny1: 300, nx2: 500, ny2: 330 },
                { text: '１２．next', nx1: 100, ny1: 700, nx2: 500, ny2: 730 }
            ],
            placedImages: [
                { imageRef: 'q11-figure', normalizedBbox: [0.6, 0.4, 0.85, 0.6] }
            ]
        }],
        expectedQuestionNumbers: ['10', '11', '12']
    });

    assert.equal(result.regionReport.ok, true);
    assert.equal(result.regionReport.complete, true);
    assert.deepEqual(result.regionReport.markers.map(marker => marker.question), ['10', '11', '12']);
    assert.deepEqual(result.decisions.map(decision => decision.question), ['11']);
    assert.equal(result.questions[1].recognizedImages[0].source, 'pdf-embedded-image-placement');
});

test('question bbox fallback fails closed when the expected sequence is incomplete', () => {
    const report = integrity.buildValidatedQuestionBboxRegions([
        { question: '10', sourcePage: 2, normalizedQuestionBbox: [0.1, 0.1, 0.9, 0.2] },
        { question: '12', sourcePage: 2, normalizedQuestionBbox: [0.1, 0.7, 0.9, 0.8] }
    ], ['10', '11', '12']);

    assert.equal(report.ok, false);
    assert.equal(report.regions.length, 0);
    assert.ok(report.warnings.some(warning => warning.code === 'question-bbox-sequence-mismatch'));
});

test('question bbox fallback excludes only ambiguous owners and keeps safe page regions', () => {
    const report = integrity.buildValidatedQuestionBboxRegions([
        { question: '4', sourcePage: 1, normalizedQuestionBbox: [0.1, 0.1, 0.9, 0.4] },
        { question: '5', sourcePage: 1, normalizedQuestionBbox: [0.1, 0.5, 0.9, 0.9] },
        { question: '6', sourcePage: 1, normalizedQuestionBbox: [0.1, 0.85, 0.9, 0.95] }
    ], ['4', '5', '6']);

    assert.equal(report.ok, true);
    assert.equal(report.complete, false);
    assert.deepEqual(report.regions.map(region => region.question), ['4', '6']);
    assert.ok(report.warnings.some(warning => warning.code === 'question-bbox-boundary-ambiguous'));
});

test('figure text contamination rejects prose, foreign questions and option clusters', () => {
    const prose = integrity.detectFigureTextContamination({
        cropBbox: [0.1, 0.2, 0.9, 0.5],
        ownerQuestion: '4',
        lines: [
            { text: '折扇是我国古老文化的延续，它常以字画的形式体现传统文化', nx1: 120, ny1: 220, nx2: 880, ny2: 260 },
            { text: '若图乙是某圆台的侧面展开图，则该圆台的侧面积是', nx1: 120, ny1: 280, nx2: 850, ny2: 320 }
        ]
    });
    assert.equal(prose.contaminated, true);
    assert.equal(prose.reason, 'figure-crop-contains-prose');

    const foreign = integrity.detectFigureTextContamination({
        cropBbox: [0.1, 0.2, 0.9, 0.5],
        ownerQuestion: '4',
        lines: [{ text: '6. 已知圆锥的轴截面是正三角形', nx1: 120, ny1: 250, nx2: 800, ny2: 290 }]
    });
    assert.equal(foreign.reason, 'figure-crop-foreign-question');
});

test('question layout integrity applies normalization and figure binding as one boundary step', () => {
    const result = integrity.applyQuestionLayoutIntegrity({
        questions: [
            { question: '1', stem: '1. stem', options: ['', '', '', ''] },
            { question: '2', stem: '2. next', options: ['', '', '', ''] }
        ],
        layouts: [{
            pageNo: 1,
            lines: [
                { text: '1. stem', nx1: 100, ny1: 100, nx2: 400, ny2: 130 },
                { text: '2. next', nx1: 100, ny1: 700, nx2: 400, ny2: 730 }
            ],
            placedImages: [
                { imageRef: 'q1-figure', normalizedBbox: [0.2, 0.25, 0.8, 0.55] }
            ]
        }],
        expectedQuestionNumbers: ['1', '2']
    });

    assert.equal(result.questions.length, 2);
    assert.equal(result.figureBinding.decisions.length, 1);
    assert.equal(result.questions[0].recognizedImages[0].source, 'pdf-embedded-image-placement');
    assert.equal(result.questions[0].contentIntegrity.version, 'pdf-math-region-r1');
});
