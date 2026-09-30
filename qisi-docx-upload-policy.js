'use strict';
const JSZip = require('./vendor/jszip/jszip.min.js');
const archiveSecurity = require('./qisi-archive-security.js');
const MIMES = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream', 'application/zip', 'application/x-zip-compressed']);
function assertDocxUploadType(file) {
    const mime = String(file?.mimetype || '').split(';', 1)[0].trim().toLowerCase();
    if (!/\.docx$/i.test(String(file?.originalname || '')) || (mime && !MIMES.has(mime))) {
        throw Object.assign(new Error('Only DOCX uploads are allowed.'), { code: 'DOCX_UPLOAD_TYPE_INVALID' });
    }
}
async function validateDocxPackage(buffer, file) {
    assertDocxUploadType(file);
    if (!Buffer.isBuffer(buffer) || buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
        throw Object.assign(new Error('DOCX must be an Office ZIP package.'), { code: 'DOCX_UPLOAD_PACKAGE_INVALID' });
    }
    let zip;
    try {
        zip = await archiveSecurity.load(JSZip, buffer, 'office-document',
            { name: file.originalname, type: file.mimetype }, {
                allowedEntry: name => /^(?:\[Content_Types\]\.xml|_rels\/\.rels|(?:word|docProps|customXml)\/[a-zA-Z0-9._/-]+\.(?:xml|rels|png|jpe?g|jfif|gif|webp|svg|bmp|tiff?|emf|wmf|bin|vml|odttf))$/i.test(name)
            });
    } catch (cause) {
        const code = /^ARCHIVE_[A-Z_]+$/.test(cause?.code || '') ? cause.code : 'DOCX_UPLOAD_PACKAGE_INVALID';
        throw Object.assign(new Error('Invalid or unsafe DOCX package.'), { code });
    }
    if (!zip.file('[Content_Types].xml') || !zip.file('word/document.xml') ||
        Object.keys(zip.files).some(name => /(?:^|\/)vbaProject\.bin$/i.test(name))) {
        throw Object.assign(new Error('DOCX package parts are missing or unsafe.'), { code: 'DOCX_UPLOAD_PACKAGE_INVALID' });
    }
    return { ok: true };
}
module.exports = { assertDocxUploadType, validateDocxPackage };
