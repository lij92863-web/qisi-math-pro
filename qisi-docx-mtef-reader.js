(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxMtefReader = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const asBytes = value => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return new Uint8Array(value || []);
    };

    const symbolMap = new Map([
        [0x00b1, '\\pm '], [0x00d7, '\\times '], [0x00f7, '\\div '], [0x03bb, '\\lambda '],
        [0x03c0, '\\pi '], [0x2208, '\\in '], [0x2212, '-'], [0x2229, '\\cap '],
        [0x222a, '\\cup '], [0x2260, '\\ne '], [0x2264, '\\le '], [0x2265, '\\ge '],
        [0x2286, '\\subseteq '], [0x22c5, '\\cdot '], [0x25b3, '\\triangle ']
    ]);

    class Cursor {
        constructor(value) {
            this.bytes = asBytes(value);
            this.index = 0;
            this.diagnostics = [];
        }

        byte() {
            if (this.index >= this.bytes.length) throw new Error('Unexpected end of MTEF data.');
            return this.bytes[this.index++];
        }

        uint16() {
            return this.byte() | (this.byte() << 8);
        }

        unsigned() {
            const first = this.byte();
            return first === 255 ? this.uint16() : first;
        }

        signed() {
            const first = this.byte();
            return first === 255 ? this.uint16() - 32768 : first - 128;
        }

        cString() {
            const values = [];
            while (this.index < this.bytes.length) {
                const value = this.byte();
                if (!value) break;
                values.push(value);
            }
            return String.fromCharCode(...values);
        }

        nudge(options) {
            if (!(options & 0x08)) return;
            const x = this.byte();
            const y = this.byte();
            if (x === 128 && y === 128) this.index += 4;
        }
    }

    const skipDimensions = cursor => {
        const count = cursor.byte();
        let completed = 0;
        let high = true;
        while (completed < count) {
            const value = cursor.bytes[cursor.index];
            const nibble = high ? value >> 4 : value & 0x0f;
            high = !high;
            if (high) cursor.index += 1;
            if (nibble === 0x0f) completed += 1;
        }
        if (!high) cursor.index += 1;
    };

    const skipPreferences = cursor => {
        cursor.byte();
        skipDimensions(cursor);
        skipDimensions(cursor);
        const count = cursor.byte();
        for (let index = 0; index < count; index += 1) {
            const fontIndex = cursor.unsigned();
            if (fontIndex) cursor.byte();
        }
    };

    const charLatex = code => {
        if (symbolMap.has(code)) return symbolMap.get(code);
        if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
        if (code <= 0x10ffff) return String.fromCodePoint(code);
        return '';
    };

    const readList = cursor => {
        const rows = [];
        while (cursor.index < cursor.bytes.length) {
            if (cursor.bytes[cursor.index] === 0) {
                cursor.index += 1;
                break;
            }
            rows.push(readRecord(cursor));
        }
        return rows;
    };

    const visible = rows => rows.filter(row => row?.latex || row?.kind === 'line');

    const templateLatex = (selector, variation, rows, cursor) => {
        const slots = visible(rows).filter(row => row.kind === 'line').map(row => row.latex);
        const unsupported = () => {
            cursor.diagnostics.push(`unsupported-template-${selector}`);
            return '';
        };
        if (selector >= 0 && selector <= 8) {
            const fences = [
                ['\\langle', '\\rangle'], ['(', ')'], ['\\{', '\\}'], ['[', ']'],
                ['|', '|'], ['\\|', '\\|'], ['\\lfloor', '\\rfloor'], ['\\lceil', '\\rceil'], ['[', ']']
            ][selector];
            const left = variation & 1 ? fences[0] : '.';
            const right = variation & 2 ? fences[1] : '.';
            return `\\left${left}${slots[0] || ''}\\right${right}`;
        }
        if (selector === 10) return variation & 1 ? `\\sqrt[${slots[0] || ''}]{${slots[1] || ''}}` : `\\sqrt{${slots[0] || ''}}`;
        if (selector === 11) return `\\frac{${slots[0] || ''}}{${slots[1] || ''}}`;
        if (selector === 12) return `\\underline{${slots[0] || ''}}`;
        if (selector === 13) return `\\overline{${slots[0] || ''}}`;
        if (selector === 14) return variation & 0x10
            ? `\\overleftarrow{${slots[0] || ''}}`
            : `\\overrightarrow{${slots[0] || ''}}`;
        if (selector === 23) {
            if (/^\\overrightarrow\{\}$/.test(slots[2] || '')) return `\\overrightarrow{${slots[0] || ''}}`;
            if (/^\\overleftarrow\{\}$/.test(slots[2] || '')) return `\\overleftarrow{${slots[0] || ''}}`;
            const lower = slots[1] ? `_{${slots[1]}}` : '';
            const upper = slots[2] ? `^{${slots[2]}}` : '';
            return `${slots[0] || ''}${lower}${upper}`;
        }
        if (selector === 27) return `{${slots[0] || ''}}_{${slots[1] || ''}}`;
        if (selector === 28) return `{${slots[0] || ''}}^{${slots[1] || ''}}`;
        if (selector === 29) return `{${slots[0] || ''}}_{${slots[1] || ''}}^{${slots[2] || ''}}`;
        if (selector === 31) return `\\vec{${slots[0] || ''}}`;
        if (selector === 32) return `\\widetilde{${slots[0] || ''}}`;
        if (selector === 33) return `\\widehat{${slots[0] || ''}}`;
        if (selector === 34) return `\\widehat{${slots[0] || ''}}`;
        return unsupported();
    };

    const readCharacter = (cursor, options) => {
        cursor.nudge(options);
        cursor.signed();
        const mtCode = options & 0x20 ? 0 : cursor.uint16();
        if (options & 0x04) cursor.byte();
        if (options & 0x10) cursor.uint16();
        let latex = charLatex(mtCode);
        if (options & 0x01) {
            const embellishments = readList(cursor).map(row => row.embell);
            if (embellishments.includes(9)) latex = `\\hat{${latex}}`;
            if (embellishments.includes(11)) latex = `\\vec{${latex}}`;
            if (embellishments.includes(17)) latex = `\\bar{${latex}}`;
        }
        return { kind: 'char', latex };
    };

    const readRecord = cursor => {
        const type = cursor.byte();
        if (type === 0) return { kind: 'end', latex: '' };
        if (type >= 100) {
            cursor.index += cursor.unsigned();
            return { kind: 'future', latex: '' };
        }
        if (type >= 10 && type <= 14) return { kind: 'size', latex: '' };
        if (type === 19) { cursor.cString(); return { kind: 'encoding', latex: '' }; }
        if (type === 17) { cursor.unsigned(); cursor.cString(); return { kind: 'font', latex: '' }; }
        if (type === 18) { skipPreferences(cursor); return { kind: 'preferences', latex: '' }; }
        if (type === 15) { cursor.unsigned(); return { kind: 'color', latex: '' }; }
        if (type === 16) {
            const options = cursor.byte();
            cursor.index += (options & 1 ? 8 : 6);
            if (options & 4) cursor.cString();
            return { kind: 'color-definition', latex: '' };
        }
        if (type === 8) { cursor.unsigned(); cursor.byte(); return { kind: 'font-style', latex: '' }; }
        if (type === 9) {
            const kind = cursor.byte();
            cursor.index += kind === 100 || kind === 101 ? 2 : 1;
            return { kind: 'size', latex: '' };
        }

        const options = cursor.byte();
        if (type === 1) {
            cursor.nudge(options);
            if (options & 4) cursor.index += 2;
            if (options & 2) readRecord(cursor);
            if (options & 1) return { kind: 'line', latex: '' };
            return { kind: 'line', latex: visible(readList(cursor)).map(row => row.latex).join('') };
        }
        if (type === 2) return readCharacter(cursor, options);
        if (type === 3) {
            cursor.nudge(options);
            const selector = cursor.unsigned();
            const firstVariation = cursor.byte();
            const variation = firstVariation & 0x80 ? (firstVariation & 0x7f) | (cursor.byte() << 8) : firstVariation;
            cursor.byte();
            return { kind: 'template', latex: templateLatex(selector, variation, readList(cursor), cursor) };
        }
        if (type === 4) {
            cursor.nudge(options);
            cursor.index += 2;
            if (options & 2) readRecord(cursor);
            return { kind: 'pile', latex: visible(readList(cursor)).map(row => row.latex).join('\\\\') };
        }
        if (type === 5) {
            cursor.nudge(options);
            cursor.index += 3;
            const rows = cursor.byte();
            const columns = cursor.byte();
            cursor.index += Math.ceil((rows + 1) / 4) + Math.ceil((columns + 1) / 4);
            const cells = visible(readList(cursor)).filter(row => row.kind === 'line').map(row => row.latex);
            const matrixRows = Array.from({ length: rows }, (_, rowIndex) => (
                Array.from({ length: columns }, (_, columnIndex) => cells[rowIndex * columns + columnIndex] || '').join('&')
            ));
            return { kind: 'matrix', latex: `\\begin{matrix}${matrixRows.join('\\\\')}\\end{matrix}` };
        }
        if (type === 6) { cursor.nudge(options); return { kind: 'embellishment', embell: cursor.byte(), latex: '' }; }
        cursor.diagnostics.push(`unsupported-record-${type}`);
        throw new Error(`Unsupported MTEF record ${type}.`);
    };

    const mtefToLatex = value => {
        const cursor = new Cursor(value);
        try {
            if (cursor.byte() !== 5) throw new Error('Only MTEF version 5 is supported.');
            cursor.index += 4;
            cursor.cString();
            cursor.byte();
            const rows = readList(cursor);
            const latex = visible(rows).map(row => row.latex).join('').replace(/\s+/g, ' ').trim();
            if (!latex || cursor.diagnostics.length) throw new Error(cursor.diagnostics.join(',') || 'MTEF produced empty LaTeX.');
            return { ok: true, code: 'MTEF_LATEX_OK', latex, diagnostics: [] };
        } catch (error) {
            return { ok: false, code: 'MTEF_FALLBACK_FAILED', latex: '', diagnostics: [...cursor.diagnostics, error?.message || String(error)] };
        }
    };

    return { mtefToLatex };
});
