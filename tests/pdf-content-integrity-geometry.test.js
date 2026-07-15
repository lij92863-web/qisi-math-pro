const test = require('node:test');
const assert = require('node:assert/strict');

const integrity = require('../qisi-pdf-content-integrity.js');

test('PDF coordinate normalization uses one canonical 0..1 space', () => {
    assert.deepEqual(
        integrity.normalizeBbox([100, 200, 900, 800], { space: 'thousandths' }),
        [0.1, 0.2, 0.9, 0.8]
    );
    assert.deepEqual(
        integrity.normalizeBbox([60, 80, 540, 720], {
            space: 'pixels', width: 600, height: 800
        }),
        [0.1, 0.1, 0.9, 0.9]
    );
});

test('PDF coordinate normalization supports 0/90/180/270 rotation', () => {
    assert.deepEqual(
        integrity.normalizeBbox([0.1, 0.2, 0.3, 0.4], { space: 'normalized', rotation: 90 }),
        [0.2, 0.7, 0.4, 0.9]
    );
    assert.deepEqual(
        integrity.normalizeBbox([0.1, 0.2, 0.3, 0.4], { space: 'normalized', rotation: 180 }),
        [0.7, 0.6, 0.9, 0.8]
    );
    assert.deepEqual(
        integrity.normalizeBbox([0.1, 0.2, 0.3, 0.4], { space: 'normalized', rotation: 270 }),
        [0.6, 0.1, 0.8, 0.3]
    );
});

test('invalid or out-of-bounds crop never falls back to the full page', () => {
    assert.equal(integrity.toPixelCrop([], { width: 1200, height: 1600 }), null);
    assert.equal(integrity.toPixelCrop([0, 0, 0, 0], { width: 1200, height: 1600 }), null);
    assert.deepEqual(
        integrity.toPixelCrop([900, 900, 1100, 1100], {
            space: 'thousandths', width: 1000, height: 1000, padding: 20
        }),
        {
            left: 880,
            top: 880,
            right: 1000,
            bottom: 1000,
            width: 120,
            height: 120,
            normalized: [0.9, 0.9, 1, 1]
        }
    );
});

test('slightly overflowing model question regions preserve their extent at the page edge', () => {
    assert.deepEqual(
        integrity.normalizeQuestionRegionBbox([105, 1000, 575, 1040]),
        [0.105, 0.96, 0.575, 1]
    );
    assert.deepEqual(integrity.normalizeQuestionRegionBbox([0, 0, 1600, 40]), []);
});

test('question region state machine keeps section and cross-page continuation boundaries', () => {
    const result = integrity.buildQuestionRegions([
        { kind: 'section', text: '一、单选题' },
        { kind: 'question', question: '1', page: 1, text: '题干' },
        { kind: 'option', label: 'A', page: 1, text: '选项 A' },
        { kind: 'pageBreak', page: 2 },
        { kind: 'continuation', page: 2, text: '选项续文' },
        { kind: 'question', question: '2', page: 2, text: '下一题' },
        { kind: 'analysis', page: 2, text: '答案文档边界' }
    ]);

    assert.deepEqual(result.regions.map(region => region.question), ['1', '2']);
    assert.equal(result.regions[0].section, '一、单选题');
    assert.equal(result.regions[0].pageEnd, 2);
    assert.equal(result.regions[0].optionBlocks.length, 1);
    assert.equal(result.regions[1].completeReason, 'analysis');
});

test('option label is removed only when an independent matching label exists', () => {
    assert.equal(integrity.stripDuplicateOptionLabel('B. 4', 'B', true), '4');
    assert.equal(integrity.stripDuplicateOptionLabel('B. 4', 'A', true), 'B. 4');
    assert.equal(integrity.stripDuplicateOptionLabel('B. 4', 'B', false), 'B. 4');
});
