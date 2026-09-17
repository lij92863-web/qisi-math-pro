/**
 * Finding the figure of one question in a rendered PDF page.
 *
 * The whole argument rests on two facts the pipeline already proves:
 *   1. every glyph the page's text layer carries comes with its own box, and
 *   2. a question's band is bounded by its own anchor line and the next anchor (or section heading).
 * So inside a band, ink that no text box covers cannot be text - it is drawn content, and the band is what
 * proves which question it belongs to. Nothing here reads meaning out of pixels: no shape matching, no
 * "looks like a triangle". The output is a rectangle and the amount of ink that supported it.
 *
 * The scan stays inside the band (one getImageData of that band), and it refuses more readily than it
 * accepts: a "figure" that fills most of the band is the question itself, a figure that touches the band
 * edge may continue past the ownership proof, and a handful of stray strokes is not a figure. A refusal is
 * reported with its reason, so the teacher sees "no figure attached, here is why" instead of a wrong crop.
 */
(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfFigureExtract = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const DEFAULTS = {
        // A pixel darker than this (0-255 luminance) is ink.
        darkness: 200,
        // Ink below this many pixels is stray strokes, not a figure.
        minInkPixels: 900,
        // A connected blob smaller than this is noise (a dash, a stray dot, an antialiasing halo).
        minComponentPixels: 64,
        // A figure narrower or shorter than this is a rule or a bracket, not a figure.
        minSize: 40,
        // A candidate covering more of the band than this is the question, not its figure.
        maxBandRatio: 0.72,
        // A text box owns the pixels inside it plus this slack (antialiasing spills over the box).
        textPadding: 2
    };

    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

    const luminanceAt = (data, offset) =>
        0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];

    /**
     * @param image  {width, height, data} of the band's pixels (an ImageData of the band, or a stub in tests)
     * @param textBoxes [[x0, y0, x1, y1]] of the band's own text lines, in band-local pixels
     * @returns {{accepted: boolean, reason: string, bbox: number[], inkPixels: number, components: number}}
     */
    const findFigureInBand = ({ image, textBoxes = [], options = {} } = {}) => {
        const settings = { ...DEFAULTS, ...options };
        const width = Math.floor(image?.width || 0);
        const height = Math.floor(image?.height || 0);
        const empty = reason => ({ accepted: false, reason, bbox: [], inkPixels: 0, components: 0 });
        if (!width || !height || !image?.data) return empty('no-raster');
        if (width < settings.minSize || height < settings.minSize) return empty('band-too-small');

        const pixelCount = width * height;
        // 0 = free, 1 = text, 2 = ink of a non-text blob.
        const mask = new Uint8Array(pixelCount);
        for (const box of textBoxes) {
            if (!Array.isArray(box) || box.length !== 4) continue;
            const x0 = clamp(Math.floor(Math.min(box[0], box[2])) - settings.textPadding, 0, width);
            const x1 = clamp(Math.ceil(Math.max(box[0], box[2])) + settings.textPadding, 0, width);
            const y0 = clamp(Math.floor(Math.min(box[1], box[3])) - settings.textPadding, 0, height);
            const y1 = clamp(Math.ceil(Math.max(box[1], box[3])) + settings.textPadding, 0, height);
            for (let y = y0; y < y1; y += 1) mask.fill(1, y * width + x0, y * width + x1);
        }

        let inkPixels = 0;
        for (let y = 0; y < height; y += 1) {
            const row = y * width;
            for (let x = 0; x < width; x += 1) {
                const at = row + x;
                if (mask[at] === 1) continue;
                if (luminanceAt(image.data, at * 4) < settings.darkness) { mask[at] = 2; inkPixels += 1; }
            }
        }
        if (inkPixels < settings.minInkPixels) {
            return { accepted: false, reason: 'no-figure-ink', bbox: [], inkPixels, components: 0 };
        }

        // Connected ink, four-neighbour, iterative: one blob is one drawn object, and the union of the blobs
        // that are big enough is the figure's rectangle.
        const seen = new Uint8Array(pixelCount);
        const stack = [];
        let components = 0;
        let left = width; let top = height; let right = -1; let bottom = -1;
        let keptInk = 0;
        for (let start = 0; start < pixelCount; start += 1) {
            if (mask[start] !== 2 || seen[start]) continue;
            let size = 0;
            let minX = width; let minY = height; let maxX = -1; let maxY = -1;
            seen[start] = 1;
            stack.push(start);
            while (stack.length) {
                const current = stack.pop();
                const y = Math.floor(current / width);
                const x = current - y * width;
                size += 1;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (x > 0 && mask[current - 1] === 2 && !seen[current - 1]) { seen[current - 1] = 1; stack.push(current - 1); }
                if (x + 1 < width && mask[current + 1] === 2 && !seen[current + 1]) { seen[current + 1] = 1; stack.push(current + 1); }
                if (y > 0 && mask[current - width] === 2 && !seen[current - width]) { seen[current - width] = 1; stack.push(current - width); }
                if (y + 1 < height && mask[current + width] === 2 && !seen[current + width]) { seen[current + width] = 1; stack.push(current + width); }
            }
            if (size < settings.minComponentPixels) continue;
            components += 1;
            keptInk += size;
            if (minX < left) left = minX;
            if (minY < top) top = minY;
            if (maxX > right) right = maxX;
            if (maxY > bottom) bottom = maxY;
        }
        if (!components || right < 0) {
            return { accepted: false, reason: 'no-figure-ink', bbox: [], inkPixels, components: 0 };
        }

        const boxWidth = right - left + 1;
        const boxHeight = bottom - top + 1;
        const result = { inkPixels, components, keptInk };
        if (boxWidth < settings.minSize || boxHeight < settings.minSize) {
            return { ...result, accepted: false, reason: 'figure-too-small', bbox: [] };
        }
        if (boxWidth * boxHeight > width * height * settings.maxBandRatio) {
            return { ...result, accepted: false, reason: 'candidate-covers-band', bbox: [] };
        }
        // A blob that reaches the band's edge may continue into the neighbouring question: ownership is not
        // provable, so nothing is attached rather than a crop that might have taken the neighbour's drawing.
        if (left === 0 || top === 0 || right === width - 1 || bottom === height - 1) {
            return { ...result, accepted: false, reason: 'figure-touches-band-edge', bbox: [] };
        }
        return { ...result, accepted: true, reason: '', bbox: [left, top, right + 1, bottom + 1] };
    };

    /**
     * The app's crop helper reads a bbox either as pixels of the source image or, when every coordinate is
     * <= 1000 and the image is larger than 1200px, as thousandths of it. Emitting the space the reader will
     * assume keeps a small figure in the top-left corner from being cropped in the wrong place.
     */
    const bboxForRaster = (bbox, raster) => {
        const width = Number(raster?.width || 0);
        const height = Number(raster?.height || 0);
        if (!Array.isArray(bbox) || bbox.length !== 4 || !width || !height) return [];
        const large = width > 1200 || height > 1200;
        // Pixels that already reach past 1000 are unambiguous, and a small raster is never rescaled.
        if (!large || Math.max(...bbox) > 1000) return bbox.map(value => Math.round(value));
        return bbox.map((value, index) => {
            const size = index % 2 === 0 ? width : height;
            return Math.round(clamp(value, 0, size) / size * 1000);
        });
    };

    return { DEFAULTS, findFigureInBand, bboxForRaster };
});
