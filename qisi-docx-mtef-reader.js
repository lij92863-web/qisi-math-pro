/**
 * Deterministic MathType (Equation.DSMT4) reading for DOCX import.
 *
 * A MathType equation is stored twice inside one MTEF stream: the structural rows that draw the
 * equation, and - when the equation was authored from TeX - a "future" record holding the original
 * TeX source. They are two representations of the *same* equation, so exactly one of them may be
 * consumed. Consuming both was the `-1` -> `-1-1` defect.
 *
 * Order of preference, per the import contract:
 *   1. one OLE/MTEF object produces at most one formula;
 *   2. TeX source and typeset line are never both consumed;
 *   3. a reliable TeX source wins, because it is the author's own text;
 *   4. only without one is a deterministic reconstruction used;
 *   5. anything that cannot be determined is `unresolved` - never guessed.
 *
 * `readFormulaFromOle` is the entry point used by the DOCX pipeline. It never reads
 * `<o:LockedField>` or any other control field as text: those live in the container, not here.
 */
(function (root, factory) {
    const api = factory(
        (typeof module !== 'undefined' && module.exports)
            ? require('./qisi-docx-ole-reader.js')
            : root?.Qisi?.DocxOleReader
    );
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxMtefReader = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (oleReader) {
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
        [0x2286, '\\subseteq '], [0x22c5, '\\cdot '], [0x25b3, '\\triangle '],
        // MathType's MT Extra fallback encoding uses these private-use codes when the native
        // LaTeX translator rejects an otherwise readable row.
        [0xec07, ''], [0xec08, ''], [0xe98f, '\\cdot '], [0xef0a, '']
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

        skip(count) {
            if (this.index + count > this.bytes.length) throw new Error('Truncated MTEF record.');
            this.index += count;
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
                if (!value) return String.fromCharCode(...values);
                values.push(value);
            }
            throw new Error('Unterminated MTEF string.');
        }

        nudge(options) {
            if (!(options & 0x08)) return;
            const x = this.byte();
            const y = this.byte();
            if (x === 128 && y === 128) this.skip(4);
        }
    }

    const skipDimensions = cursor => {
        const count = cursor.byte();
        let completed = 0;
        let high = true;
        while (completed < count) {
            if (cursor.index >= cursor.bytes.length) throw new Error('Truncated MTEF dimensions.');
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
        if (code >= 0xe000 && code <= 0xf8ff) {
            throw new Error(`Unsupported MTEF private-use character U+${code.toString(16).toUpperCase()}.`);
        }
        if (code <= 0x10ffff) return String.fromCodePoint(code);
        return '';
    };

    const readList = cursor => {
        const rows = [];
        while (cursor.index < cursor.bytes.length) {
            if (cursor.bytes[cursor.index] === 0) {
                cursor.index += 1;
                return rows;
            }
            rows.push(readRecord(cursor));
        }
        throw new Error('Unterminated MTEF record list.');
    };

    const structural = rows => rows.filter(
        row => row?.kind !== 'future' && (row?.latex || row?.kind === 'line')
    );
    const texSourceRows = rows => rows.filter(row => row?.kind === 'future');

    const decodeFutureLatex = (type, payload) => {
        if (type !== 102 || !payload?.length) return '';
        const parts = String.fromCharCode(...payload).split('\0');
        if (parts[0] !== 'TeX Input Language') return '';
        return String(parts[1] || '').trim();
    };

    const templateLatex = (selector, variation, rows, cursor) => {
        const slots = structural(rows).filter(row => row.kind === 'line').map(row => row.latex);
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
        if (selector === 9) {
            const fences = ['(', ')', '[', ']'];
            const left = fences[variation & 0x03];
            const right = fences[(variation >> 4) & 0x03];
            return `\\left${left}${slots[0] || ''}\\right${right}`;
        }
        if (selector === 10) {
            return variation & 1
                ? `\\sqrt[${slots[0] || ''}]{${slots[1] || ''}}`
                : `\\sqrt{${slots[0] || ''}}`;
        }
        if (selector === 11) return `\\frac{${slots[0] || ''}}{${slots[1] || ''}}`;
        if (selector === 12) return `\\underline{${slots[0] || ''}}`;
        if (selector === 13) return `\\overline{${slots[0] || ''}}`;
        if (selector === 14) {
            return variation & 0x10
                ? `\\overleftarrow{${slots[0] || ''}}`
                : `\\overrightarrow{${slots[0] || ''}}`;
        }
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
            if (embellishments.some(value => ![9, 11, 17].includes(value))) {
                throw new Error('Unsupported MTEF embellishment.');
            }
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
            const length = cursor.unsigned();
            const payload = cursor.bytes.slice(cursor.index, cursor.index + length);
            cursor.skip(length);
            return { kind: 'future', latex: decodeFutureLatex(type, payload) };
        }
        if (type >= 10 && type <= 14) return { kind: 'size', latex: '' };
        if (type === 19) { cursor.cString(); return { kind: 'encoding', latex: '' }; }
        if (type === 17) { cursor.unsigned(); cursor.cString(); return { kind: 'font', latex: '' }; }
        if (type === 18) { skipPreferences(cursor); return { kind: 'preferences', latex: '' }; }
        if (type === 15) { cursor.unsigned(); return { kind: 'color', latex: '' }; }
        if (type === 16) {
            const options = cursor.byte();
            cursor.skip(options & 1 ? 8 : 6);
            if (options & 4) cursor.cString();
            return { kind: 'color-definition', latex: '' };
        }
        if (type === 8) { cursor.unsigned(); cursor.byte(); return { kind: 'font-style', latex: '' }; }
        if (type === 9) {
            const kind = cursor.byte();
            cursor.skip(kind === 100 || kind === 101 ? 2 : 1);
            return { kind: 'size', latex: '' };
        }

        const options = cursor.byte();
        if (type === 1) {
            cursor.nudge(options);
            if (options & 4) cursor.skip(2);
            if (options & 2) readRecord(cursor);
            if (options & 1) return { kind: 'line', latex: '' };
            return {
                kind: 'line',
                latex: structural(readList(cursor)).map(row => row.latex).join('')
            };
        }
        if (type === 2) return readCharacter(cursor, options);
        if (type === 3) {
            cursor.nudge(options);
            const selector = cursor.unsigned();
            const firstVariation = cursor.byte();
            const variation = firstVariation & 0x80
                ? (firstVariation & 0x7f) | (cursor.byte() << 8)
                : firstVariation;
            cursor.byte();
            return {
                kind: 'template',
                latex: templateLatex(selector, variation, readList(cursor), cursor)
            };
        }
        if (type === 4) {
            cursor.nudge(options);
            cursor.skip(2);
            if (options & 2) readRecord(cursor);
            return {
                kind: 'pile',
                latex: structural(readList(cursor)).map(row => row.latex).join('\\\\')
            };
        }
        if (type === 5) {
            cursor.nudge(options);
            cursor.skip(3);
            const rows = cursor.byte();
            const columns = cursor.byte();
            cursor.skip(Math.ceil((rows + 1) / 4) + Math.ceil((columns + 1) / 4));
            const cells = structural(readList(cursor))
                .filter(row => row.kind === 'line')
                .map(row => row.latex);
            if (cells.length !== rows * columns) throw new Error('Incomplete MTEF matrix.');
            const matrixRows = Array.from({ length: rows }, (_, rowIndex) => (
                Array.from({ length: columns }, (_, columnIndex) =>
                    cells[rowIndex * columns + columnIndex] || '').join('&')
            ));
            return { kind: 'matrix', latex: `\\begin{matrix}${matrixRows.join('\\\\')}\\end{matrix}` };
        }
        if (type === 6) {
            cursor.nudge(options);
            return { kind: 'embellishment', embell: cursor.byte(), latex: '' };
        }
        cursor.diagnostics.push(`unsupported-record-${type}`);
        throw new Error(`Unsupported MTEF record ${type}.`);
    };

    // A TeX source is only trusted when it is a plausible single-line fragment: it is the author's
    // own text, so it must be complete rather than truncated or carrying control bytes.
    const isReliableTexSource = value => {
        const source = String(value || '').trim();
        if (!source || source.length > 300) return false;
        if (/[\u0000-\u001f]/.test(source)) return false;
        let depth = 0;
        for (const character of source) {
            if (character === '{') depth += 1;
            else if (character === '}') {
                depth -= 1;
                if (depth < 0) return false;
            }
        }
        return depth === 0;
    };

    // Reads the MTEF stream once and reports the two representations separately, so a caller can
    // never consume both by accident.
    const parseMtef = value => {
        const cursor = new Cursor(value);
        try {
            if (cursor.byte() !== 5) throw new Error('Only MTEF version 5 is supported.');
            cursor.skip(4);
            cursor.cString();
            cursor.byte();
            let rows = readList(cursor);

            // A stream may carry more than one section. An equation written this way leaves its
            // content in a later section, and stopping at the first terminator reported the equation
            // as empty even though the bytes were right there. Reading on is only a *continuation*:
            // the second section is used only when the first one produced no content at all, so a
            // formula that already resolved can never change, and a section that fails to walk still
            // leaves the object unresolved instead of guessed.
            if (!structural(rows).some(row => row.latex)) {
                const start = cursor.index;

                while (cursor.index < cursor.bytes.length && cursor.bytes[cursor.index] === 0) {
                    cursor.index += 1;
                }

                if (cursor.index < cursor.bytes.length) {
                    const extra = readList(cursor);
                    if (structural(extra).some(row => row.latex)) rows = [...rows, ...extra];
                } else {
                    cursor.index = start;
                }
            }
            return {
                ok: true,
                texSource: texSourceRows(rows)
                    .map(row => row.latex || '')
                    .join('')
                    .replace(/\s+/g, ' ')
                    .trim(),
                structuralLatex: structural(rows)
                    .map(row => row.latex)
                    .join('')
                    .replace(/\s+/g, ' ')
                    .trim(),
                diagnostics: [...cursor.diagnostics]
            };
        } catch (error) {
            return {
                ok: false,
                texSource: '',
                structuralLatex: '',
                diagnostics: [...cursor.diagnostics, error?.message || String(error)]
            };
        }
    };

    const unresolved = (code, diagnostics = []) => ({
        status: 'unresolved',
        origin: '',
        latex: '',
        code,
        diagnostics,
        provenance: { status: 'unresolved', source: 'docx-mtef', reasonCode: code }
    });

    // Rules 1-5 in one place: at most one formula per object, exactly one representation, TeX source
    // preferred, reconstruction only as a fallback, and no guessing.
    const classifyMtef = value => {
        const parsed = parseMtef(value);
        if (!parsed.ok) return unresolved('MTEF_UNREADABLE', parsed.diagnostics);

        if (parsed.texSource && isReliableTexSource(parsed.texSource) && !parsed.diagnostics.length) {
            return {
                status: 'extracted',
                origin: 'tex-source',
                latex: parsed.texSource,
                code: 'MTEF_TEX_SOURCE_OK',
                diagnostics: [],
                provenance: {
                    status: 'deterministic-source',
                    source: 'docx-mtef',
                    origin: 'tex-source'
                }
            };
        }

        if (parsed.structuralLatex && !parsed.diagnostics.length) {
            return {
                status: 'extracted',
                origin: 'reconstruction',
                latex: parsed.structuralLatex,
                code: 'MTEF_RECONSTRUCTED_OK',
                diagnostics: [],
                provenance: {
                    status: 'deterministic-source',
                    source: 'docx-mtef',
                    origin: 'reconstruction'
                }
            };
        }

        return unresolved(
            parsed.diagnostics.length ? 'MTEF_UNSUPPORTED_STRUCTURE' : 'MTEF_EMPTY_EQUATION',
            parsed.diagnostics
        );
    };

    const mtefToLatex = value => {
        const result = classifyMtef(value);
        return {
            ok: result.status === 'extracted',
            code: result.code,
            latex: result.latex,
            origin: result.origin,
            diagnostics: result.diagnostics
        };
    };

    // Entry point for the DOCX pipeline: an OLE object in, at most one formula out.
    const readFormulaFromOle = value => {
        if (!oleReader?.extractMtefFromOle) {
            return unresolved('MTEF_OLE_READER_UNAVAILABLE');
        }
        let mtef;
        try {
            mtef = oleReader.extractMtefFromOle(value);
        } catch (error) {
            return unresolved('MTEF_CONTAINER_INVALID', [error?.message || String(error)]);
        }
        if (!mtef?.length) return unresolved('MTEF_MISSING_PAYLOAD');
        return classifyMtef(mtef);
    };

    return {
        readFormulaFromOle,
        classifyMtef,
        parseMtef,
        mtefToLatex,
        isReliableTexSource
    };
});
