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
            maxEntries: 10002,
            maxTotalUncompressedBytes: 256 * MB,
            maxEntryUncompressedBytes: 32 * MB,
            maxCompressionRatio: 100,
            inputExtensions: ['zip'],
            inputMimes: ZIP_MIMES,
            allowedEntry: path =>
                /^(?:manifest\.json|questions\.json|images\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|gif|webp))$/i.test(path)
        },
        'full-backup': {
            maxEntries: 20002,
            maxTotalUncompressedBytes: 512 * MB,
            maxEntryUncompressedBytes: 64 * MB,
            maxCompressionRatio: 100,
            inputExtensions: ['zip'],
            inputMimes: ZIP_MIMES,
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
                /^(?:\[Content_Types\]\.xml|_rels\/\.rels|(?:word|xl|docProps)\/[a-zA-Z0-9._/-]+\.(?:xml|rels|png|jpe?g|gif|webp|svg|bmp|emf|wmf|bin|vml))$/i.test(path)
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

            const compressed = Number(item?._data?.compressedSize);
            const uncompressed = Number(item?._data?.uncompressedSize);
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
        const zip = await JSZip.loadAsync(source);
        assertArchive(zip, createArchivePolicy(profile, overrides), input);
        return zip;
    };

    return {
        createArchivePolicy,
        validateArchive,
        assertArchive,
        load
    };
});
