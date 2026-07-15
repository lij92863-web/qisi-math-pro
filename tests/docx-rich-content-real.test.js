const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const rich = require('../qisi-docx-rich-content.js');
const mtefReader = require('../qisi-docx-mtef-reader.js');
const truth = require('./fixtures/docx-golden/brief-docx-truth.json');

const enabled = process.env.QISI_REAL_DOCX === '1';
const defaultDocx = 'C:\\Users\\Administrator\\Desktop\\题目与答案\\简略版题目（只有一页）.docx';

const mimeFor = ext => ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    wmf: 'image/wmf', emf: 'image/emf', bin: 'application/octet-stream'
}[ext] || 'application/octet-stream');

const parseRelationships = (xml, root) => {
    const mediaMap = new Map();
    String(xml || '').replace(/<Relationship\b([^>]+?)\/>/g, (_, attrs) => {
        const rid = attrs.match(/\bId=["']([^"']+)["']/)?.[1] || '';
        const target = attrs.match(/\bTarget=["']([^"']+)["']/)?.[1] || '';
        const type = attrs.match(/\bType=["']([^"']+)["']/)?.[1] || '';
        const normalized = target.startsWith('/') ? target.slice(1) : `word/${target.replace(/^(\.\.\/)+/, '')}`;
        const absolute = path.join(root, ...normalized.split('/'));
        if (!rid || !fs.existsSync(absolute)) return '';
        const ext = path.extname(absolute).slice(1).toLowerCase();
        const bytes = fs.readFileSync(absolute);
        mediaMap.set(rid, {
            rid, target: normalized, type, ext, mime: mimeFor(ext),
            displayable: /^(png|jpe?g|gif|webp|svg)$/i.test(ext),
            url: `data:${mimeFor(ext)};base64,${bytes.toString('base64')}`
        });
        return '';
    });
    return mediaMap;
};

const translateMathType = (mediaMap, documentXml, tempRoot) => {
    const objectLinks = rich.collectMathTypeObjectLinks(documentXml);
    const collected = rich.collectMathTypeMtef(mediaMap, { objectLinks });
    const input = path.join(tempRoot, 'mathtype-input.json');
    const output = path.join(tempRoot, 'mathtype-output.json');
    fs.writeFileSync(input, JSON.stringify({ equations: collected.equations }), 'utf8');
    execFileSync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
        path.resolve(__dirname, '../tools/translate-mathtype-mtef.ps1'),
        '-InputPath', input, '-OutputPath', output
    ], { stdio: 'pipe' });
    const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
    const sourceById = new Map(collected.equations.map(row => [String(row.id), row]));
    return new Map(payload.equations.map(row => {
        const fallback = row.ok ? null : mtefReader.mtefToLatex(Buffer.from(sourceById.get(String(row.id)).mtefBase64, 'base64'));
        const normalized = rich.normalizeLatexFragment(row.ok ? row.latex : fallback.latex);
        assert.equal((row.ok || fallback.ok) && normalized.ok, true, `${row.id}:${row.code || normalized.code}`);
        return [String(row.id), normalized.latex];
    }));
};

const loadRealDocx = filePath => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-docx-real-'));
    execFileSync('tar.exe', ['-xf', filePath, '-C', tempRoot], { stdio: 'pipe' });
    const documentXml = fs.readFileSync(path.join(tempRoot, 'word/document.xml'), 'utf8');
    const relsXml = fs.readFileSync(path.join(tempRoot, 'word/_rels/document.xml.rels'), 'utf8');
    const mediaMap = parseRelationships(relsXml, tempRoot);
    const mathByRid = translateMathType(mediaMap, documentXml, tempRoot);
    return { tempRoot, documentXml, mediaMap, mathByRid };
};

test('real brief DOCX preserves six manually verified rich questions', { skip: !enabled }, () => {
    const filePath = process.env.QISI_BRIEF_DOCX || defaultDocx;
    assert.equal(fs.existsSync(filePath), true, `Missing real fixture: ${filePath}`);
    const fixture = loadRealDocx(filePath);
    try {
        const blocks = rich.extractDocxRichBlocks(fixture.documentXml, {
            fileId: 'brief-real', mediaMap: fixture.mediaMap, mathByRid: fixture.mathByRid
        });
        const result = rich.parseQuestionRichBlocks(blocks);
        assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
        assert.deepEqual(result.questions.map(row => row.questionKey), truth.questions.map(row => row.questionKey));
        assert.deepEqual(result.questions.map(row => row.sourceParagraphRange), truth.questions.map(row => row.sourceQuestionParagraphRange));
        assert.deepEqual(result.questions.map(row => row.options.length), [4, 4, 4, 4, 4, 4]);
        assert.equal(result.questions[3].assets.length, truth.questions[3].stemImageCount);
        assert.equal(result.questions.flatMap(row => row.diagnostics).length, 0);
        assert.equal(result.questions.some(row => /公式需要人工复核|\[\[IMAGE:[^\]]*wmf/i.test(`${row.stem}\n${row.options.join('\n')}`)), false);
        assert.equal(result.questions.flatMap(row => row.richBlocks).flatMap(row => row.runs).filter(run => run.kind === 'math').every(run => Boolean(run.latex)), true);
    } finally {
        fs.rmSync(fixture.tempRoot, { recursive: true, force: true });
    }
});
