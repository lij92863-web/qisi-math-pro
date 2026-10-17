const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const source = 'C:/Users/Administrator/.codex/worktrees/desktop-recovery/题库系统', desktop = 'C:/Users/Administrator/Desktop/题库系统', backup = 'E:/备份/题库系统', out = 'C:/Users/Administrator/AppData/Local/Temp/qisi-stage27-stats', evidence = path.join(desktop, 'deliverables/stage27-stats-evidence-2026-10-01');
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
    assert.equal(git(source, 'status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(git(desktop, 'status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(git(backup, 'status', '--porcelain'), '');
    assert.equal(git(backup, 'rev-parse', 'HEAD'), 'ef2ad10c16cf4743573d1f3352a164ed91c9d995');
    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'deployment-manifest.json')));
    const files = manifest.files.map(item => {
        assert.equal(sha(path.join(source, item.name)), item.sourceSha256);
        assert.equal(sha(path.join(desktop, item.name)), item.sourceSha256);
        return { name: item.name, sha256: item.sourceSha256 };
    });
    const reportName = 'ai/DESKTOP_AUDIT_RECHECK_2026-09-30.md', reportSha256 = sha(path.join(source, reportName));
    assert.equal(sha(path.join(desktop, reportName)), reportSha256);
    assert.equal(sha(path.join(desktop, 'deliverables/code-audit-recheck-2026-09-30.md')), reportSha256);
    manifest.ledgers.forEach(item => assert.equal(sha(item.file), item.sha256));
    assert.equal(sha(path.join(desktop, 'deliverables/code-audit-findings-2026-09-28.md')), '4d7924d9a1e4c19c3ef29a6b250b8ae848710332e5a4509fdb8c895109122650');
    for (const log of ['source-verification.log', 'desktop-commit-verification.log', 'desktop-report-commit-verification.log']) {
        const text = fs.readFileSync(path.join(out, log), 'utf8');
        assert.match(text, /tests 1756/); assert.match(text, /pass 1756/); assert.match(text, /fail 0/); assert.match(text, /verify-no-real-ai\] passed/);
        fs.copyFileSync(path.join(out, log), path.join(evidence, log));
    }
    const http = [];
    for (const name of ['main.html', 'app.js', 'qisi-storage-repository.js', 'qisi-draft-persistence-service.js', 'qisi-draft-maintenance-service.js']) {
        const response = await fetch('http://127.0.0.1:3000/' + name + '?v=atomic-batch-stats-01'); assert.equal(response.status, 200);
        const digest = crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'); assert.equal(digest, sha(path.join(desktop, name)));
        http.push({ name, status: response.status, sha256: digest });
    }
    const healthResponse = await fetch('http://127.0.0.1:3000/api/health'); assert.equal(healthResponse.status, 200);
    const roots = [source, desktop, backup].map(root => ({ root, head: git(root, 'rev-parse', 'HEAD'), branch: git(root, 'branch', '--show-current'), trackedStatus: git(root, 'status', '--porcelain', '--untracked-files=no') }));
    const completion = { date: '2026-10-01', roots, program: { source: manifest.sourceCommit, desktop: '26ef211f43136080734c4b1527912907f6c0c219' }, verifiedFiles: files, reportSha256, ledgersUnchanged: true, paidCalls: 0, round2Used: 4, round2Remaining: 16, round2HaltPreserved: true, shenzhenFullPaperAccepted: false, healthStatus: 200, http };
    fs.writeFileSync(path.join(evidence, 'completion.json'), JSON.stringify(completion, null, 2));
    fs.copyFileSync(__filename, path.join(evidence, path.basename(__filename)));
    console.log(JSON.stringify({ roots, reportSha256, verifiedFiles: files.length, servedFiles: http.length, ledgersUnchanged: true, evidence }));
})().catch(error => { console.error(error); process.exitCode = 1; });
