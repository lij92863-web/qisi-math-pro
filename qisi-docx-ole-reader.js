(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DocxOleReader = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const END_OF_CHAIN = 0xfffffffe;
    const FREE_SECTOR = 0xffffffff;

    const toBytes = value => {
        if (value instanceof Uint8Array) return value;
        if (value instanceof ArrayBuffer) return new Uint8Array(value);
        if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        return new Uint8Array(value || []);
    };

    const viewOf = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const decodeUtf16 = bytes => {
        if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-16le').decode(bytes);
        let value = '';
        for (let index = 0; index + 1 < bytes.length; index += 2) value += String.fromCharCode(bytes[index] | (bytes[index + 1] << 8));
        return value;
    };

    const concat = chunks => {
        const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    };

    const sectorSlice = (bytes, sectorId, sectorSize) => {
        const offset = (sectorId + 1) * sectorSize;
        if (sectorId < 0 || offset + sectorSize > bytes.length) return new Uint8Array();
        return bytes.slice(offset, offset + sectorSize);
    };

    const readSectorIds = (start, table, maximum) => {
        const ids = [];
        const seen = new Set();
        let current = start >>> 0;
        while (current !== END_OF_CHAIN && current !== FREE_SECTOR && current < 0xfffffffa && ids.length < maximum) {
            if (seen.has(current) || current >= table.length) break;
            seen.add(current);
            ids.push(current);
            current = table[current] >>> 0;
        }
        return ids;
    };

    const uint32Rows = bytes => {
        const view = viewOf(bytes);
        const rows = [];
        for (let offset = 0; offset + 4 <= bytes.length; offset += 4) rows.push(view.getUint32(offset, true));
        return rows;
    };

    const readFat = (bytes, header, sectorSize) => {
        const view = viewOf(bytes);
        const ids = [];
        for (let index = 0; index < 109 && ids.length < header.fatCount; index += 1) {
            const id = view.getUint32(76 + index * 4, true);
            if (id !== FREE_SECTOR) ids.push(id);
        }
        if (ids.length < header.fatCount) throw new Error('Extended CFB DIFAT is unsupported for this DOCX object.');
        return ids.flatMap(id => uint32Rows(sectorSlice(bytes, id, sectorSize)));
    };

    const readRegularStream = (bytes, start, size, sectorSize, fat) => {
        const maximum = Math.ceil(Math.max(size, 1) / sectorSize) + 2;
        const chunks = readSectorIds(start, fat, maximum).map(id => sectorSlice(bytes, id, sectorSize));
        return concat(chunks).slice(0, size);
    };

    const readDirectory = (bytes, header, sectorSize, fat) => {
        const ids = readSectorIds(header.firstDirectory, fat, Math.ceil(bytes.length / sectorSize));
        const directory = concat(ids.map(id => sectorSlice(bytes, id, sectorSize)));
        const entries = [];
        for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
            const row = directory.slice(offset, offset + 128);
            const view = viewOf(row);
            const nameLength = Math.min(view.getUint16(64, true), 64);
            const name = decodeUtf16(row.slice(0, Math.max(0, nameLength - 2)));
            const size = view.getUint32(120, true) + (view.getUint32(124, true) * 0x100000000);
            entries.push({ name, type: row[66], start: view.getUint32(116, true), size });
        }
        return entries;
    };

    const parseHeader = bytes => {
        const view = viewOf(bytes);
        const magic = Array.from(bytes.slice(0, 8)).map(value => value.toString(16).padStart(2, '0')).join('');
        if (magic !== 'd0cf11e0a1b11ae1' || bytes.length < 512) throw new Error('Invalid CFB/OLE container.');
        return {
            sectorSize: 1 << view.getUint16(30, true),
            miniSectorSize: 1 << view.getUint16(32, true),
            fatCount: view.getUint32(44, true),
            firstDirectory: view.getUint32(48, true),
            miniCutoff: view.getUint32(56, true),
            firstMiniFat: view.getUint32(60, true),
            miniFatCount: view.getUint32(64, true)
        };
    };

    const extractOleStream = (value, streamName) => {
        const bytes = toBytes(value);
        const header = parseHeader(bytes);
        const fat = readFat(bytes, header, header.sectorSize);
        const entries = readDirectory(bytes, header, header.sectorSize, fat);
        const stream = entries.find(entry => entry.type === 2 && entry.name.toLowerCase() === String(streamName).toLowerCase());
        if (!stream) return new Uint8Array();
        if (stream.size >= header.miniCutoff) return readRegularStream(bytes, stream.start, stream.size, header.sectorSize, fat);

        const root = entries.find(entry => entry.type === 5);
        if (!root) return new Uint8Array();
        const miniStream = readRegularStream(bytes, root.start, root.size, header.sectorSize, fat);
        const miniFatBytes = readRegularStream(bytes, header.firstMiniFat, header.miniFatCount * header.sectorSize, header.sectorSize, fat);
        const miniFat = uint32Rows(miniFatBytes);
        const ids = readSectorIds(stream.start, miniFat, Math.ceil(stream.size / header.miniSectorSize) + 2);
        return concat(ids.map(id => miniStream.slice(id * header.miniSectorSize, (id + 1) * header.miniSectorSize))).slice(0, stream.size);
    };

    const extractEquationNative = value => extractOleStream(value, 'Equation Native');

    const extractMtefFromOle = value => {
        const equation = extractEquationNative(value);
        if (equation.length < 6) return new Uint8Array();
        const headerSize = viewOf(equation).getUint16(0, true);
        const candidates = [headerSize, 28, 0].filter((offset, index, all) => offset < equation.length && all.indexOf(offset) === index);
        const start = candidates.find(offset => equation[offset] === 5);
        return start === undefined ? new Uint8Array() : equation.slice(start);
    };

    return { extractEquationNative, extractMtefFromOle, extractOleStream };
});
