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
