const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const qr = require('../qisi-handout-qr.js');

test('H9 QR creates a complete version 4 matrix', () => {
    const matrix = qr.createMatrix('question-17');

    assert.equal(matrix.length, 33);
    assert.equal(matrix.every(row => row.length === 33), true);
    assert.equal(matrix[0][0], true);
    assert.equal(matrix[6][6], true);
    assert.equal(matrix[26][26], true);
});

test('H9 QR output is local SVG without external references', () => {
    const svg = qr.toSvg('TEX题库');

    assert.match(svg, /^<svg /);
    assert.match(svg, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(
        svg,
        /(?:href|src)\s*=\s*["']\s*(?:https?:|file:|\/\/)|<script/i
    );
});

test('H9 QR rejects content beyond its verified byte capacity', () => {
    assert.throws(
        () => qr.createMatrix('x'.repeat(qr.MAX_BYTES + 1)),
        /不得超过/
    );
});

test('H9 QR matches the externally decoded reference matrix', () => {
    const bits = qr.createMatrix('TEX-H9-QR-TEST')
        .map(row => row.map(value => value ? '1' : '0').join(''))
        .join('');
    const checksum = crypto
        .createHash('sha256')
        .update(bits)
        .digest('hex');

    // This fixture was accepted by an independent OpenCV QR decoder.
    assert.equal(
        checksum,
        '4cd76c99869e1b118494e26ef1124ea035c6f47d411c040b24668ccfead81c8e'
    );
});
