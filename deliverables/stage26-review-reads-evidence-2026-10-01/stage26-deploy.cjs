const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', desktop = 'C:/Users/Administrator/Desktop/题库系统', evidence = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage26-review-reads';
const base = '64f0c91b0c59a7de47a4bce4288a78c26459c16c', desktopBase = 'f337b9614aee6054358849599c3b3ee506cb954d';
const files = ['app.js', 'main.html', 'qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-review-workflow-service.js', 'docs/architecture/APP_SHELL_RESPONSIBILITY_MATRIX_CORRECTIVE_R1.json', 'tests/storage-repository.test.js', 'tests/draft-persistence-service.test.js', 'tests/review-workflow-service.test.js', 'tests/reviewed-batch-submit-idempotency.test.js'];
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(git(desktop, 'rev-parse', 'HEAD'), desktopBase);
assert.equal(git(source, 'status', '--porcelain', '--untracked-files=no'), '');
assert.equal(git(desktop, 'status', '--porcelain', '--untracked-files=no'), '');
assert.deepEqual(git(source, 'diff', '--name-only', base, 'HEAD').split('\n').sort(), [...files].sort());
const ledgers = ['round1', 'round2'].map(round => ({ round, file: path.join(desktop, 'deliverables/handoff-evidence-2026-09-30', round, 'ledger.json') }));
const expectedLedgerHashes = ['879a8cefe25cd139529149e000f06f22c9da778d60237e2b021d5ad3194b26ec', '2b8489db3273c29423950150af27802cf12f7acc01bb59cca84c37d64ef12779'];
ledgers.forEach((item, index) => { item.sha256 = sha(item.file); assert.equal(item.sha256, expectedLedgerHashes[index]); });
const manifest = { date: '2026-10-01', source, desktop, sourceBase: base, sourceCommit: git(source, 'rev-parse', 'HEAD'), desktopBase, paidCalls: 0, ledgers, files: [] };
for (const name of files) {
    const originalBlob = git(source, 'rev-parse', `${base}:${name}`);
    assert.equal(git(desktop, 'rev-parse', `HEAD:${name}`), originalBlob);
    assert.equal(git(desktop, 'hash-object', '--path=' + name, '--', name), originalBlob);
    const from = path.join(source, name), to = path.join(desktop, name), backup = path.join(evidence, 'desktop-before', name);
    assert.equal(fs.existsSync(backup), false);
    manifest.files.push({ name, originalBlob, sourceSha256: sha(from), desktopBeforeSha256: sha(to), backup });
}
for (const item of manifest.files) {
    fs.mkdirSync(path.dirname(item.backup), { recursive: true });
    fs.copyFileSync(path.join(desktop, item.name), item.backup);
    assert.equal(sha(item.backup), item.desktopBeforeSha256);
}
fs.writeFileSync(path.join(evidence, 'deployment-manifest.json'), JSON.stringify(manifest, null, 2));
for (const item of manifest.files) {
    fs.copyFileSync(path.join(source, item.name), path.join(desktop, item.name));
    assert.equal(sha(path.join(desktop, item.name)), item.sourceSha256);
}
console.log(JSON.stringify({ sourceCommit: manifest.sourceCommit, desktopBase, verifiedFiles: files.length, ledgersUnchanged: true }));
