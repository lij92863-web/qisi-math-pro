'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'tests', 'fixtures', 'true-import');
const UTF8_FLAG = 0x0800;
const DOS_TIME = 0;
const DOS_DATE = 0x5021;

fs.mkdirSync(TARGET, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    return crc >>> 0;
});

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        const body = Buffer.from(entry.body, 'utf8');
        const checksum = crc32(body);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(UTF8_FLAG, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(DOS_TIME, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(body.length, 18);
        local.writeUInt32LE(body.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, body);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(UTF8_FLAG, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(DOS_TIME, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(body.length, 20);
        central.writeUInt32LE(body.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, name);
        offset += local.length + name.length + body.length;
    }
    const centralBody = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBody.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, centralBody, end]);
}

const escapeXml = value => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

function makeDocx(lines) {
    const paragraphs = lines.map(line =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    ).join('');
    return zipStore([
        {
            name: '[Content_Types].xml',
            body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
                '</Types>'
        },
        {
            name: '_rels/.rels',
            body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
                '</Relationships>'
        },
        {
            name: 'word/document.xml',
            body: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
                `<w:body>${paragraphs}<w:sectPr/></w:body></w:document>`
        }
    ]);
}

const escapePdf = value => String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');

function makePdf(lines, pageCount = 1) {
    const objectCount = 3 + (pageCount * 2);
    const objects = new Map();
    const pageIds = Array.from({ length: pageCount }, (_, index) => 4 + (index * 2));
    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objects.set(2, `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageCount} >>`);
    objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    for (let index = 0; index < pageCount; index += 1) {
        const pageId = pageIds[index];
        const contentId = pageId + 1;
        const pageLines = Array.isArray(lines[0])
            ? (lines[index] || [])
            : index === 0
                ? lines
                : [`Cancellation fixture page ${index + 1}.`];
        const commands = pageLines.map((line, lineIndex) =>
            `${lineIndex === 0 ? '50 760 Td' : '0 -20 Td'} (${escapePdf(line)}) Tj`
        ).join('\n');
        const stream = `BT\n/F1 12 Tf\n${commands}\nET\n`;
        objects.set(pageId,
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`
        );
        objects.set(contentId,
            `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`
        );
    }

    const parts = [Buffer.from('%PDF-1.4\n%QISI\n', 'ascii')];
    const offsets = [0];
    let offset = parts[0].length;
    for (let id = 1; id <= objectCount; id += 1) {
        offsets[id] = offset;
        const body = Buffer.from(`${id} 0 obj\n${objects.get(id)}\nendobj\n`, 'ascii');
        parts.push(body);
        offset += body.length;
    }
    const xrefOffset = offset;
    const xref = [
        `xref\n0 ${objectCount + 1}\n`,
        '0000000000 65535 f \n',
        ...offsets.slice(1).map(value =>
            `${String(value).padStart(10, '0')} 00000 n \n`
        ),
        `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    ].join('');
    parts.push(Buffer.from(xref, 'ascii'));
    return Buffer.concat(parts);
}

const docxFixtures = {
    'docx-question.docx': [
        '1. Which statement is correct?',
        'A. First', 'B. Second', 'C. Third', 'D. Fourth'
    ],
    'docx-question-2.docx': [
        '2. Which second statement is correct?',
        'A. One', 'B. Two', 'C. Three', 'D. Four'
    ],
    'docx-answer.docx': ['1. 【答案】A'],
    'docx-solution.docx': [
        '1. 【解析】First is the declared stable answer.'
    ],
    'docx-vision.docx': [
        '1. Which vision statement is correct?',
        'A. First', 'B. Second', 'C. Third', 'D. Fourth'
    ]
};

const pdfFixtures = {
    'pdf-question.pdf': [
        '1. Prove the PDF production statement.',
        'A. Alpha', 'B. Beta', 'C. Gamma', 'D. Delta'
    ],
    'pdf-answer.pdf': ['1. Answer: A'],
    'pdf-solution.pdf': [
        '1. Solution: Alpha is correct by the supplied evidence.'
    ],
    'formula-rich.pdf': [
        '1. Preserve the integral and square-root formula evidence.'
    ],
    'known-bad-ownership.pdf': [
        '2. Answer: B. This does not belong to question 1.'
    ],
    'conflict.pdf': ['1. Answer: A', '1. Answer: B'],
    'ambiguity.pdf': ['1. Deliberately ambiguous support.'],
    'raw-json-response.pdf': ['1. The engine response is malformed.']
};

for (const [name, lines] of Object.entries(docxFixtures)) {
    fs.writeFileSync(path.join(TARGET, name), makeDocx(lines));
}
for (const [name, lines] of Object.entries(pdfFixtures)) {
    fs.writeFileSync(path.join(TARGET, name), makePdf(lines));
}
fs.writeFileSync(
    path.join(TARGET, 'pdf-safe-partial-question.pdf'),
    makePdf([
        [
            '1. First safe-partial question.',
            'A. First', 'B. Second', 'C. Third', 'D. Fourth'
        ],
        [
            '2. Second safe-partial question.',
            'A. One', 'B. Two', 'C. Three', 'D. Four'
        ]
    ], 2)
);
fs.writeFileSync(
    path.join(TARGET, 'cancellation-large.pdf'),
    makePdf(['1. Cancellation discards late engine output.'], 12)
);

for (const name of [
    ...Object.keys(docxFixtures),
    ...Object.keys(pdfFixtures),
    'pdf-safe-partial-question.pdf',
    'cancellation-large.pdf'
]) {
    const file = path.join(TARGET, name);
    process.stdout.write(`${name}\t${fs.statSync(file).size}\n`);
}
