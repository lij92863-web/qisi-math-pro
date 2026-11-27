(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.ArchiveSecurity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const MB = 1024 * 1024;
    const ARCHIVE_EXTENSIONS = new Set(['zip', 'docx', 'xlsx', 'xlsm', 'pptx', 'jar', 'apk']);
    const ZIP_MIMES = [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream'
    ];

    const PROFILES = {
        'question-bank': {
            maxEntries: 60000,
            maxTotalUncompressedBytes: 2048 * MB,
            maxEntryUncompressedBytes: 64 * MB,
            maxCompressionRatio: 100,
            inputExtensions: ['zip'],
            inputMimes: ZIP_MIMES,
            allowedEntry: path =>
                /^(?:manifest\.json|questions(?:-\d+)?\.json|images\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp))$/i.test(path)
        },
        'full-backup': {
            maxEntries: 60000,
            maxTotalUncompressedBytes: 2048 * MB,
            maxEntryUncompressedBytes: 64 * MB,
            maxCompressionRatio: 100,
            inputExtensions: ['zip'],
            inputMimes: [...ZIP_MIMES, 'application/x-zip', 'application/x-compressed', 'application/force-download'],
            allowedEntry: path =>
                /^(?:manifest\.json|tables\/[a-zA-Z0-9._-]+\.json|image-blobs\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp|svg|bmp|bin))$/i.test(path)
        },
        'office-document': {
            maxEntries: 5000,
            maxTotalUncompressedBytes: 256 * MB,
            maxEntryUncompressedBytes: 64 * MB,
            maxCompressionRatio: 200,
            inputExtensions: ['docx', 'xlsx'],
            inputMimes: [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/octet-stream',
                'application/zip',
                'application/x-zip-compressed'
            ],
            allowedEntry: path =>
                /^(?:\[Content_Types\]\.xml|_rels\/\.rels|(?:word|xl|docProps|customXml)\/[a-zA-Z0-9._/-]+\.(?:xml|rels|png|jpe?g|gif|webp|svg|bmp|emf|wmf|bin|vml))$/i.test(path)
        }
    };

    const archiveError = (code, details = {}) => ({ ok: false, code, details });

    const extensionOf = name => {
        const match = String(name || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : '';
    };

    const normalizedMime = value => String(value || '').split(';', 1)[0].trim().toLowerCase();

    const hasTraversal = name => {
        const value = String(name || '').replace(/\\/g, '/');
        if (!value || value.startsWith('/') || /^[a-zA-Z]:\//.test(value)) return true;
        return value.split('/').some(segment => segment === '..' || segment === '.');
    };

    const createArchivePolicy = (profile, overrides = {}) => {
        const base = PROFILES[profile];
        if (!base) throw new Error(`Unknown archive security profile: ${profile}`);
        return { ...base, ...overrides, profile };
    };

    const validateArchive = (zip, policy, input = {}) => {
        if (!zip || !zip.files || !policy) return archiveError('ARCHIVE_INVALID');

        const inputName = String(input?.name || '');
        const inputMime = normalizedMime(input?.type);
        if (inputName && !policy.inputExtensions.includes(extensionOf(inputName))) {
            return archiveError('ARCHIVE_INPUT_EXTENSION_NOT_ALLOWED');
        }
        if (inputMime && !policy.inputMimes.map(normalizedMime).includes(inputMime)) {
            return archiveError('ARCHIVE_INPUT_MIME_NOT_ALLOWED');
        }

        const entries = Object.values(zip.files).filter(item => item && !item.dir);
        if (entries.length > policy.maxEntries) {
            return archiveError('ARCHIVE_ENTRY_COUNT_LIMIT', { entryCount: entries.length });
        }

        let totalUncompressedBytes = 0;
        for (const item of entries) {
            const name = String(item.name || '');
            const originalName = String(item.unsafeOriginalName || name);
            if (hasTraversal(name) || hasTraversal(originalName)) {
                return archiveError('ARCHIVE_PATH_TRAVERSAL');
            }

            const ext = extensionOf(name);
            if (ARCHIVE_EXTENSIONS.has(ext)) {
                return archiveError('ARCHIVE_NESTED_ARCHIVE');
            }
            if (!policy.allowedEntry(name)) {
                return archiveError('ARCHIVE_ENTRY_NOT_ALLOWED');
            }

            const compressed = item.compressedSize ?? item._data?.compressedSize;
            const uncompressed = item.uncompressedSize ?? item._data?.uncompressedSize;
            if (!Number.isFinite(compressed) || compressed < 0 ||
                !Number.isFinite(uncompressed) || uncompressed < 0) {
                return archiveError('ARCHIVE_SIZE_METADATA_REQUIRED');
            }
            if (uncompressed > policy.maxEntryUncompressedBytes) {
                return archiveError('ARCHIVE_ENTRY_SIZE_LIMIT');
            }
            if (uncompressed > 0 && uncompressed / Math.max(1, compressed) > policy.maxCompressionRatio) {
                return archiveError('ARCHIVE_COMPRESSION_RATIO_LIMIT');
            }
            totalUncompressedBytes += uncompressed;
            if (totalUncompressedBytes > policy.maxTotalUncompressedBytes) {
                return archiveError('ARCHIVE_TOTAL_SIZE_LIMIT');
            }
        }

        return {
            ok: true,
            code: 'ARCHIVE_ACCEPTED',
            entryCount: entries.length,
            totalUncompressedBytes
        };
    };

    const assertArchive = (zip, policy, input) => {
        const result = validateArchive(zip, policy, input);
        if (!result.ok) {
            const error = new Error(result.code);
            error.code = result.code;
            throw error;
        }
        return result;
    };

    const load = async (JSZip, source, profile, input = {}, overrides = {}) => {
        if (!JSZip?.loadAsync) {
            const error = new Error('ARCHIVE_READER_REQUIRED');
            error.code = 'ARCHIVE_READER_REQUIRED';
            throw error;
        }
        const policy = createArchivePolicy(profile, overrides);
        const zip = await JSZip.loadAsync(source);
        assertArchive(zip, policy, input);
        return zip;
    };

    const zipLibrary = () => globalThis.zip || (typeof module === 'object' && module.exports
        ? require('./vendor/zip-js/zip.min.js') : null);
    const fail = code => { throw Object.assign(new Error(code), { code }); };
    const openBlob = async (blob, profile, input = {}) => {
        const zip = zipLibrary();
        if (!zip?.ZipReader) fail('ARCHIVE_READER_REQUIRED');
        const policy = createArchivePolicy(profile);
        if (!(blob instanceof Blob)) fail('ARCHIVE_INVALID');
        const overhead = policy.maxEntries * 1024 + MB;
        if (blob.size > policy.maxTotalUncompressedBytes + overhead) fail('ARCHIVE_TOTAL_SIZE_LIMIT');
        class BoundedReader extends zip.BlobReader {
            readUint8Array(offset, length) {
                if (length > policy.maxEntryUncompressedBytes + overhead) fail('ARCHIVE_ENTRY_SIZE_LIMIT');
                return super.readUint8Array(offset, length);
            }
        }
        const reader = new zip.ZipReader(new BoundedReader(blob), { useWebWorkers: false });
        const files = Object.create(null);
        let count = 0;
        try {
            for await (const entry of reader.getEntriesGenerator({ filenameValidation: 'tolerant', normalizeFilename: false })) {
                if (hasTraversal(entry.filename)) fail('ARCHIVE_PATH_TRAVERSAL');
                if (++count > policy.maxEntries + 16) fail('ARCHIVE_ENTRY_COUNT_LIMIT');
                if (entry.directory) continue;
                if (files[entry.filename]) fail('ARCHIVE_DUPLICATE_ENTRY');
                if (entry.encrypted) fail('ARCHIVE_ENTRY_NOT_ALLOWED');
                const file = { name: entry.filename, compressedSize: entry.compressedSize, uncompressedSize: entry.uncompressedSize };
                file.read = async ({ collect = true, type = '' } = {}) => {
                    let size = 0;
                    const chunks = [];
                    try {
                        await entry.getData(new WritableStream({
                            write(chunk) {
                                size += chunk.byteLength;
                                if (size > file.uncompressedSize) fail('ARCHIVE_ENTRY_CORRUPT');
                                if (collect) chunks.push(chunk);
                            }
                        }), { checkCrc32: true, strictness: 'strict' });
                        if (size !== file.uncompressedSize) fail('ARCHIVE_ENTRY_CORRUPT');
                    } catch (_) { fail('ARCHIVE_ENTRY_CORRUPT'); }
                    return collect ? new Blob(chunks, { type }) : size;
                };
                file.async = async format => {
                    const result = await file.read();
                    return format === 'blob' ? result : result.text();
                };
                files[file.name] = file;
            }
        } catch (error) {
            if (error?.code) throw error;
            fail('ARCHIVE_UNREADABLE');
        }
        const archive = { files, file: name => files[name] || null };
        assertArchive(archive, policy, { name: blob.name, type: blob.type, ...input });
        return archive;
    };
    const writeBlob = async (entries, profile, { store = false } = {}) => {
        const zip = zipLibrary();
        if (!zip?.ZipWriter) fail('ARCHIVE_WRITER_REQUIRED');
        const policy = createArchivePolicy(profile);
        const files = Object.create(null);
        for (const { path, source } of entries) {
            if (files[path]) fail('ARCHIVE_DUPLICATE_ENTRY');
            const size = source instanceof Blob ? source.size : source.byteLength;
            files[path] = { name: path, compressedSize: size, uncompressedSize: size };
        }
        assertArchive({ files }, policy);
        const writer = new zip.ZipWriter(new zip.BlobWriter('application/zip'), { useWebWorkers: false, bufferedWrite: false });
        try {
            for (const { path, source } of entries) {
                const blob = source instanceof Blob;
                const alreadyCompressed = blob && /^(?:image\/(?:png|jpe?g|gif|webp)|application\/(?:pdf|zip|vnd\.openxmlformats-officedocument\.[^;]+))$/i.test(source.type);
                const entry = await writer.add(path, blob ? new zip.BlobReader(source) : new zip.Uint8ArrayReader(source),
                    { level: store || alreadyCompressed ? 0 : 6 });
                if (entry.uncompressedSize > policy.maxCompressionRatio * Math.max(1, entry.compressedSize)) fail('ARCHIVE_COMPRESSION_RATIO_LIMIT');
            }
            return await writer.close();
        } catch (error) {
            try { await writer.close(); } catch (_) {}
            throw error;
        }
    };
    const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
        for (let bit = 0; bit < 8; bit++) index = (index >>> 1) ^ (index & 1 ? 0xedb88320 : 0);
        return index;
    });
    // Consume each validated ZIP member once. Central-directory sizes are
    // untrusted until the stream ends, so stop as soon as bytes exceed them.
    const readCheckedEntry = (file, options = {}) => file.read ? file.read(options) : readLegacyEntry(file, options);
    const readLegacyEntry = (file, { collect = true, type = '' } = {}) => new Promise((resolve, reject) => {
        const expectedSize = file._data.uncompressedSize, expectedCrc = file._data.crc32 >>> 0;
        const chunks = [];
        let size = 0, crc = 0xffffffff;
        const stream = file.internalStream('uint8array');
        const corrupt = () => {
            const error = new Error('Invalid ZIP entry size or CRC');
            error.code = 'ARCHIVE_ENTRY_CORRUPT';
            reject(error);
        };
        stream.on('data', bytes => {
            size += bytes.length;
            if (size > expectedSize) { stream.pause(); corrupt(); return; }
            for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
            if (collect) chunks.push(bytes);
        }).on('error', corrupt).on('end', () => {
            if (size !== expectedSize || ((crc ^ 0xffffffff) >>> 0) !== expectedCrc) { corrupt(); return; }
            resolve(collect ? new Blob(chunks, { type }) : size);
        });
        stream.resume();
    });

    return {
        createArchivePolicy,
        validateArchive,
        assertArchive,
        load, openBlob, writeBlob, readCheckedEntry
    };
});
