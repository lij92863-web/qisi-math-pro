'use strict';

// Builds the smallest valid OLE/CFB container that holds one named stream, so the DOCX MathType
// path can be tested against a real container instead of a stub. The stream is kept above the mini
// stream cutoff, which is how Word stores an equation's "Equation Native" stream.
const SECTOR = 512;
const END_OF_CHAIN = 0xfffffffe;
const FREE_SECTOR = 0xffffffff;
const FAT_SECTOR = 0xfffffffd;

const directoryEntry = ({ name, type, start, size }) => {
    const entry = Buffer.alloc(128, 0);
    const nameBytes = Buffer.from(`${name}\0`, 'utf16le');
    nameBytes.copy(entry, 0);
    entry.writeUInt16LE(nameBytes.length, 64);
    entry.writeUInt8(type, 66);
    entry.writeUInt32LE(start >>> 0, 116);
    entry.writeUInt32LE(size % 0x100000000, 120);
    entry.writeUInt32LE(Math.floor(size / 0x100000000), 124);
    return entry;
};

const buildOleContainer = (streamName, payload) => {
    const streamSize = Math.max(payload.length, 4096);
    const streamSectors = Math.ceil(streamSize / SECTOR);
    const totalSectors = 2 + streamSectors; // 0 = FAT, 1 = directory, 2.. = stream
    const container = Buffer.alloc(SECTOR + totalSectors * SECTOR, 0);

    Buffer.from('d0cf11e0a1b11ae1', 'hex').copy(container, 0);
    container.writeUInt16LE(0x003e, 24);
    container.writeUInt16LE(0x0003, 26);
    container.writeUInt16LE(0xfffe, 28);
    container.writeUInt16LE(9, 30);   // 512 byte sectors
    container.writeUInt16LE(6, 32);   // 64 byte mini sectors
    container.writeUInt32LE(1, 44);   // one FAT sector
    container.writeUInt32LE(1, 48);   // directory lives in sector 1
    container.writeUInt32LE(4096, 56);
    container.writeUInt32LE(END_OF_CHAIN, 60);
    container.writeUInt32LE(0, 64);
    container.writeUInt32LE(END_OF_CHAIN, 68);
    container.writeUInt32LE(0, 72);
    for (let index = 0; index < 109; index += 1) {
        container.writeUInt32LE(index === 0 ? 0 : FREE_SECTOR, 76 + index * 4);
    }

    const fatOffset = SECTOR;
    for (let sector = 0; sector < totalSectors; sector += 1) {
        let value = FREE_SECTOR;
        if (sector === 0) value = FAT_SECTOR;
        else if (sector === 1) value = END_OF_CHAIN;
        else if (sector < totalSectors - 1) value = sector + 1;
        else value = END_OF_CHAIN;
        container.writeUInt32LE(value >>> 0, fatOffset + sector * 4);
    }

    const directoryOffset = 2 * SECTOR;
    directoryEntry({ name: 'Root Entry', type: 5, start: END_OF_CHAIN, size: 0 })
        .copy(container, directoryOffset);
    // The recorded size matches what is written, including the padding that keeps the stream in the
    // regular FAT rather than the mini stream.
    directoryEntry({ name: streamName, type: 2, start: 2, size: streamSize })
        .copy(container, directoryOffset + 128);

    // Sector N starts at (N + 1) * SECTOR because the 512 byte header precedes sector 0.
    payload.copy(container, 3 * SECTOR);
    return new Uint8Array(container);
};

// A MathType "Equation Native" stream: a small header, then the MTEF bytes. MTEF always begins with
// its version byte (5).
const equationNativeStream = mtef => {
    const header = Buffer.alloc(28, 0);
    header.writeUInt16LE(28, 0); // header size, which is also where the MTEF block starts
    return Buffer.concat([header, Buffer.from(mtef)]);
};

module.exports = { buildOleContainer, equationNativeStream, SECTOR };
