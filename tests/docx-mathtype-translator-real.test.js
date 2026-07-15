const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rich = require('../qisi-docx-rich-content.js');

const enabled = process.env.QISI_REAL_DOCX === '1';
const fixtureRoot = process.env.QISI_BATCH_FIXTURE_ROOT || 'C:\\Users\\Administrator\\Desktop\\题目与答案';

test('real MathType WMF MTEF translates deterministically to LaTeX', {
    skip: !enabled,
    timeout: 60_000
}, () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-mathtype-real-'));
    const extracted = path.join(tempRoot, 'docx');
    const inputPath = path.join(tempRoot, 'input.json');
    const outputPath = path.join(tempRoot, 'output.json');

    try {
        fs.mkdirSync(extracted);
        const unpack = spawnSync('tar', [
            '-xf',
            path.join(fixtureRoot, '简略版题目（只有一页）.docx'),
            '-C',
            extracted
        ], { encoding: 'utf8' });
        assert.equal(unpack.status, 0, unpack.stderr);

        const wmf = fs.readFileSync(path.join(extracted, 'word', 'media', 'image1.wmf'));
        const mtef = rich.extractMtefFromWmf(wmf);
        assert.ok(mtef.length > 0);
        fs.writeFileSync(inputPath, JSON.stringify({
            equations: [{ id: 'image1', mtefBase64: Buffer.from(mtef).toString('base64') }]
        }));

        const translated = spawnSync('powershell.exe', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', path.join(__dirname, '..', 'tools', 'translate-mathtype-mtef.ps1'),
            '-InputPath', inputPath,
            '-OutputPath', outputPath
        ], { encoding: 'utf8', timeout: 45_000 });

        assert.equal(translated.status, 0, translated.stderr || translated.stdout);
        const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        assert.equal(output.ok, true);
        assert.equal(output.equations[0].ok, true);

        const normalized = rich.normalizeLatexFragment(output.equations[0].latex);
        assert.equal(normalized.ok, true);
        assert.match(normalized.latex, /\\sin/);
        assert.match(normalized.latex, /\\frac/);
        assert.match(normalized.latex, /\\mathbb\{Z\}/);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
