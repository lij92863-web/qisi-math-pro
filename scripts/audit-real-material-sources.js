const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const JSZip = require('../vendor/jszip/3.10.1/jszip.min.js');
const docxRichContent = require('../qisi-docx-rich-content.js');
const docxSupportContent = require('../qisi-docx-support-content.js');

const DEFAULT_ROOT = 'C:\\Users\\Administrator\\Desktop\\题目与答案';
const SUPPORTED_EXTENSIONS = new Set(['.docx', '.pdf']);

const countMatches = (source, expression) => (String(source || '').match(expression) || []).length;

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

const buildBatchImporterProbe = () => {
    const window = {
        Qisi: {
            DocxRichContent: docxRichContent,
            DocxSupportContent: docxSupportContent
        }
    };
    const context = vm.createContext({
        window,
        console: {
            log() {},
            warn() {},
            error() {},
            groupCollapsed() {},
            groupEnd() {},
            table() {}
        },
        fetch: async () => {
            throw new Error('network is forbidden in source material audit');
        }
    });
    const source = fs.readFileSync(path.resolve(__dirname, '../qisi-batch-importer.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'qisi-batch-importer.js' });
    return window.QisiBatchImporter;
};

const batchImporter = buildBatchImporterProbe();

const readZipText = async (zip, entryName) => {
    const entry = zip.file(entryName);
    return entry ? entry.async('text') : '';
};

const listZipEntries = (zip, prefix) => Object.keys(zip.files)
    .filter(name => !zip.files[name].dir && name.startsWith(prefix));

const auditDocxBuffer = async buffer => {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await readZipText(zip, 'word/document.xml');
    const numberingXml = await readZipText(zip, 'word/numbering.xml');
    if (!documentXml) throw new Error('DOCX is missing word/document.xml');

    const skeleton = batchImporter.buildDocxQuestionSkeletonFromXml(documentXml, numberingXml);
    const mediaEntries = listZipEntries(zip, 'word/media/');
    const embeddingEntries = listZipEntries(zip, 'word/embeddings/');

    return {
        packageEntryCount: Object.keys(zip.files).length,
        paragraphCount: countMatches(documentXml, /<w:p\b/g),
        tableCount: countMatches(documentXml, /<w:tbl\b/g),
        tableRowCount: countMatches(documentXml, /<w:tr\b/g),
        drawingCount: countMatches(documentXml, /<w:drawing\b/g),
        legacyObjectCount: countMatches(documentXml, /<w:object\b/g),
        oleObjectCount: countMatches(documentXml, /<o:OLEObject\b/g),
        ommlCount: countMatches(documentXml, /<m:oMath(?:Para)?\b/g),
        numberedParagraphCount: countMatches(documentXml, /<w:numPr\b/g),
        mediaCount: mediaEntries.length,
        mediaExtensions: [...new Set(mediaEntries.map(name => path.extname(name).toLowerCase()))].sort(),
        embeddingCount: embeddingEntries.length,
        embeddingExtensions: [...new Set(embeddingEntries.map(name => path.extname(name).toLowerCase()))].sort(),
        skeleton: {
            authoritative: Boolean(skeleton?.authoritative),
            questionNumbers: Array.from(skeleton?.questionNumbers || []).map(String),
            diagnostics: skeleton?.diagnostics || null
        }
    };
};

const findPdfInfoBinary = () => {
    const candidates = [
        process.env.QISI_PDFINFO_BIN,
        process.env.USERPROFILE && path.join(
            process.env.USERPROFILE,
            '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdfinfo.exe'
        ),
        'pdfinfo'
    ].filter(Boolean);
    return candidates.find(candidate => candidate === 'pdfinfo' || fs.existsSync(candidate)) || 'pdfinfo';
};

const parsePdfInfo = source => {
    const fields = {};
    String(source || '').split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) fields[match[1].trim()] = match[2].trim();
    });
    const pageSize = fields['Page size'] || '';
    const sizeMatch = pageSize.match(/([0-9.]+)\s+x\s+([0-9.]+)\s+pts/i);
    return {
        pageCount: Number(fields.Pages || 0),
        encrypted: /^yes\b/i.test(fields.Encrypted || ''),
        tagged: /^yes\b/i.test(fields.Tagged || ''),
        pageSize,
        widthPoints: sizeMatch ? Number(sizeMatch[1]) : null,
        heightPoints: sizeMatch ? Number(sizeMatch[2]) : null,
        pdfVersion: fields['PDF version'] || '',
        fileSizeBytes: Number(String(fields['File size'] || '').match(/\d+/)?.[0] || 0)
    };
};

const auditPdfFile = filePath => {
    const output = execFileSync(findPdfInfoBinary(), [filePath], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30_000
    });
    return parsePdfInfo(output);
};

const auditMaterialFile = async filePath => {
    const startedAt = process.hrtime.bigint();
    const buffer = fs.readFileSync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const base = {
        fileName: path.basename(filePath),
        extension,
        byteLength: buffer.length,
        sha256: sha256(buffer)
    };
    try {
        const structure = extension === '.docx'
            ? await auditDocxBuffer(buffer)
            : auditPdfFile(filePath);
        return {
            ...base,
            ok: true,
            durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
            structure
        };
    } catch (error) {
        return {
            ...base,
            ok: false,
            durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
            error: error?.message || String(error)
        };
    }
};

const auditMaterialDirectory = async root => {
    const absoluteRoot = path.resolve(root || DEFAULT_ROOT);
    const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true })
        .filter(entry => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => path.join(absoluteRoot, entry.name))
        .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    const files = [];
    for (const filePath of entries) files.push(await auditMaterialFile(filePath));
    return {
        root: absoluteRoot,
        generatedAt: new Date().toISOString(),
        fileCount: files.length,
        docxCount: files.filter(file => file.extension === '.docx').length,
        pdfCount: files.filter(file => file.extension === '.pdf').length,
        failureCount: files.filter(file => !file.ok).length,
        totalDurationMs: files.reduce((sum, file) => sum + file.durationMs, 0),
        files
    };
};

const parseCli = argv => {
    const args = [...argv];
    const outIndex = args.indexOf('--out');
    const outPath = outIndex >= 0 ? args[outIndex + 1] : '';
    if (outIndex >= 0) args.splice(outIndex, 2);
    return { root: args[0] || process.env.QISI_REAL_MATERIAL_ROOT || DEFAULT_ROOT, outPath };
};

const main = async argv => {
    const { root, outPath } = parseCli(argv);
    const result = await auditMaterialDirectory(root);
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (outPath) {
        fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
        fs.writeFileSync(path.resolve(outPath), json, 'utf8');
    }
    process.stdout.write(JSON.stringify({
        root: result.root,
        fileCount: result.fileCount,
        docxCount: result.docxCount,
        pdfCount: result.pdfCount,
        failureCount: result.failureCount,
        totalDurationMs: Math.round(result.totalDurationMs),
        outPath: outPath ? path.resolve(outPath) : ''
    }));
    process.stdout.write('\n');
    if (result.failureCount) process.exitCode = 1;
};

if (require.main === module) {
    main(process.argv.slice(2)).catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = {
    auditDocxBuffer,
    auditMaterialDirectory,
    auditMaterialFile,
    parsePdfInfo
};
