const test = require('node:test');
const assert = require('node:assert/strict');
const Figures = require('../qisi-pdf-figure-extract.js');

// A page image stand-in: white paper, with the dark pixels the test paints.
const paper = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) });
const paint = (image, [x0, y0, x1, y1]) => {
    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
            const at = (y * image.width + x) * 4;
            image.data[at] = 0; image.data[at + 1] = 0; image.data[at + 2] = 0;
        }
    }
    return image;
};

test('a drawing the text layer does not cover is found inside its own band', () => {
    const image = paint(paper(400, 300), [120, 60, 300, 240]);
    const found = Figures.findFigureInBand({ image, textBoxes: [[20, 10, 380, 40], [20, 260, 380, 290]] });
    assert.equal(found.accepted, true, found.reason);
    assert.deepEqual(found.bbox, [120, 60, 300, 240]);
    assert.ok(found.inkPixels >= 180 * 180);
    assert.equal(found.components, 1);
});

test('text alone is never a figure, however much ink the lines carry', () => {
    const image = paint(paper(400, 300), [20, 10, 380, 40]);
    paint(image, [20, 260, 380, 290]);
    const found = Figures.findFigureInBand({ image, textBoxes: [[20, 10, 380, 40], [20, 260, 380, 290]] });
    assert.equal(found.accepted, false);
    assert.equal(found.reason, 'no-figure-ink');
});

test('a drawing that may continue past the band is refused rather than cropped', () => {
    const image = paint(paper(400, 300), [0, 60, 300, 240]);
    const found = Figures.findFigureInBand({ image, textBoxes: [[320, 10, 390, 40]] });
    assert.equal(found.accepted, false);
    assert.equal(found.reason, 'figure-touches-band-edge');
    assert.ok(found.inkPixels > 0, 'the ink is still reported, only the crop is refused');
});

test('a candidate covering most of the band is the question, not its figure', () => {
    const image = paint(paper(400, 300), [10, 10, 390, 290]);
    const found = Figures.findFigureInBand({ image, textBoxes: [] });
    assert.equal(found.accepted, false);
    assert.equal(found.reason, 'candidate-covers-band');
});

test('a thin rule and a lone dash stay below the ink and size floors', () => {
    const image = paint(paper(400, 300), [80, 150, 320, 152]);
    const found = Figures.findFigureInBand({ image, textBoxes: [] });
    assert.equal(found.accepted, false);
    assert.equal(found.reason, 'no-figure-ink');
    const speck = paint(paper(400, 300), [200, 150, 206, 156]);
    assert.equal(Figures.findFigureInBand({ image: speck, textBoxes: [] }).accepted, false);
});

test('a raster is addressed the way the crop helper reads it', () => {
    // Large rasters: a bbox that would be misread as thousandths is emitted as thousandths.
    const large = { width: 1191, height: 1684 };
    assert.deepEqual(Figures.bboxForRaster([59, 362, 632, 473], large), [50, 215, 531, 281]);
    assert.deepEqual(Figures.bboxForRaster([900, 1200, 1100, 1400], large), [900, 1200, 1100, 1400]);
    // A small raster is addressed in its own pixels.
    const small = { width: 595, height: 842 };
    assert.deepEqual(Figures.bboxForRaster([59, 362, 632, 473], small), [59, 362, 632, 473]);
});

// The scan only ever sees the band it was handed: a drawing that belongs to the neighbouring question is
// not in this band's pixels, so it cannot reach this question's crop.
test('a band without a drawing reports that, and a band too small to hold one is refused outright', () => {
    assert.deepEqual(Figures.findFigureInBand({ image: paper(200, 100), textBoxes: [] }).reason, 'no-figure-ink');
    const tiny = paint(paper(30, 20), [2, 2, 28, 18]);
    assert.equal(Figures.findFigureInBand({ image: tiny, textBoxes: [] }).reason, 'band-too-small');
});

// A question like "图甲…图乙…" carries two drawings. The union rectangle of both would swallow the space
// between them, so blobs that are far apart become separate figures - and each still has to pass the same
// edge, size and band-coverage rules on its own.
test('two drawings far apart are two figures, and a drawing across the band edge is dropped alone', () => {
    const image = paint(paper(600, 300), [40, 60, 200, 240]);
    paint(image, [420, 60, 560, 240]);
    const found = Figures.findFigureInBand({ image, textBoxes: [[210, 10, 410, 40]] });
    assert.equal(found.accepted, true, found.reason);
    assert.equal(found.figures.length, 2);
    assert.deepEqual(found.figures.map(item => item.bbox), [[40, 60, 200, 240], [420, 60, 560, 240]]);
    assert.deepEqual(found.bbox, [40, 60, 560, 240], 'the union is still reported as evidence');

    const two = paint(paper(600, 300), [0, 60, 160, 240]);
    paint(two, [420, 60, 560, 240]);
    const mixed = Figures.findFigureInBand({ image: two, textBoxes: [[210, 10, 410, 40]] });
    assert.equal(mixed.figures.length, 1, 'the drawing that reaches the band edge is refused');
    assert.deepEqual(mixed.figures[0].bbox, [420, 60, 560, 240]);
    assert.equal(mixed.reason, 'figure-touches-band-edge', 'the refusal is still reported');
});

test('strokes of one drawing that nearly touch are grouped into one figure', () => {
    const image = paint(paper(400, 300), [100, 100, 160, 160]);
    paint(image, [168, 100, 228, 160]);
    const found = Figures.findFigureInBand({ image, textBoxes: [[20, 10, 380, 40]] });
    assert.equal(found.figures.length, 1);
    assert.deepEqual(found.figures[0].bbox, [100, 100, 228, 160]);
    assert.equal(found.figures[0].components, 2);
});

// The threshold follows the band's own paper tone, so a pale drawing on a bright page and a drawing on a
// washed-out scan are both found, while the tone of that scan is not mistaken for ink.
test('what counts as ink follows the background of the band itself', () => {
    const pale = paper(400, 300);
    for (let y = 100; y < 240; y += 1) for (let x = 100; x < 300; x += 1) {
        const at = (y * pale.width + x) * 4;
        pale.data[at] = 205; pale.data[at + 1] = 205; pale.data[at + 2] = 205;
    }
    assert.equal(Figures.findFigureInBand({ image: pale, textBoxes: [[20, 10, 380, 40]] }).accepted, true,
        'a light grey drawing on white paper is a drawing');

    const washed = { width: 400, height: 300, data: new Uint8ClampedArray(400 * 300 * 4) };
    for (let at = 0; at < washed.data.length; at += 4) {
        washed.data[at] = 214; washed.data[at + 1] = 214; washed.data[at + 2] = 214;
    }
    for (let y = 100; y < 240; y += 1) for (let x = 100; x < 300; x += 1) {
        const at = (y * washed.width + x) * 4;
        washed.data[at] = 120; washed.data[at + 1] = 120; washed.data[at + 2] = 120;
    }
    const found = Figures.findFigureInBand({ image: washed, textBoxes: [[20, 10, 380, 40]] });
    assert.equal(found.accepted, true, found.reason);
    assert.deepEqual(found.figures[0].bbox, [100, 100, 300, 240]);
});
