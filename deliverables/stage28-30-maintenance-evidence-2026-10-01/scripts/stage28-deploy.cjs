const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', desktop = 'C:/Users/Administrator/Desktop/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage28-maintenance';
const base = 'e522a7098e6fa3373c8fd4cb6c3851d528322d13', desktopBase = '21ac97fb005fd78c215a6fcd916acc4bf61f0493';
const files = JSON.parse(fs.readFileSync(path.join(out, 'allowed.json')));
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(git(desktop, 'rev-parse', 'HEAD'), desktopBase);
assert.equal(git(source, 'status', '--porcelain', '--untracked-files=no'), ''); assert.equal(git(desktop, 'status', '--porcelain', '--untracked-files=no'), '');
const changes = git(source, 'diff', '--name-status', base, 'HEAD').split('\n').map(row => row.split('\t'));
assert.deepEqual(changes.map(row => row[1]).sort(), [...files].sort());
const ledgers = ['round1', 'round2'].map(round => ({ round, file: path.join(desktop, 'deliverables/handoff-evidence-2026-09-30', round, 'ledger.json') }));
const hashes = ['879a8cefe25cd139529149e000f06f22c9da778d60237e2b021d5ad3194b26ec', '2b8489db3273c29423950150af27802cf12f7acc01bb59cca84c37d64ef12779'];
ledgers.forEach((item, index) => { item.sha256 = sha(item.file); assert.equal(item.sha256, hashes[index]); });
const manifest = { date: '2026-10-01', source, desktop, sourceBase: base, sourceCommit: git(source, 'rev-parse', 'HEAD'), desktopBase, paidCalls: 0, ledgers, files: [] };
for (const [status, name] of changes) {
    assert.ok(['M', 'A'].includes(status));
    const target = path.join(desktop, name), backup = path.join(out, 'desktop-before', name);
    let originalBlob = null, beforeSha256 = null;
    if (status === 'A') assert.equal(fs.existsSync(target), false);
    else {
        originalBlob = git(source, 'rev-parse', `${base}:${name}`);
        assert.equal(git(desktop, 'rev-parse', `HEAD:${name}`), originalBlob);
        assert.equal(git(desktop, 'hash-object', '--path=' + name, '--', name), originalBlob);
        beforeSha256 = sha(target); assert.equal(fs.existsSync(backup), false);
    }
    manifest.files.push({ status, name, originalBlob, beforeSha256, sourceSha256: sha(path.join(source, name)), backup: status === 'M' ? backup : null });
}
for (const item of manifest.files) if (item.backup) { fs.mkdirSync(path.dirname(item.backup), { recursive: true }); fs.copyFileSync(path.join(desktop, item.name), item.backup); assert.equal(sha(item.backup), item.beforeSha256); }
fs.writeFileSync(path.join(out, 'deployment-manifest.json'), JSON.stringify(manifest, null, 2));
for (const item of manifest.files) { fs.copyFileSync(path.join(source, item.name), path.join(desktop, item.name)); assert.equal(sha(path.join(desktop, item.name)), item.sourceSha256); }
console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, desktopBase, verifiedFiles: files.length, ledgersUnchanged: true }));
