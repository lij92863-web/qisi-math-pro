const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const sha256 = source => crypto.createHash('sha256')
    .update(source.replace(/\r\n/g, '\n')).digest('hex');

function verifyFrozenPdfFiles(files, baseline, readSource = file =>
    fs.readFileSync(path.join(ROOT, file), 'utf8')) {
    const register = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/pdf-freeze-approved-repairs.json'), 'utf8'
    ));
    if (register.schemaVersion !== 'qisi.pdf-freeze-approved-repairs.v1') {
        throw new Error('Invalid PDF freeze approval register');
    }
    const retiredRegister = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/pdf-v1-retired-files.json'), 'utf8'
    ));
    if (retiredRegister.schemaVersion !== 'qisi.pdf-v1-retired-files.v1') {
        throw new Error('Invalid PDF retirement register');
    }
    const retired = new Map(retiredRegister.files.map(item => [item.file, item]));
    const activeFiles = files.filter(file => !retired.has(file));
    const unapproved = activeFiles.filter(file => !Object.hasOwn(register.approvedFiles, file));
    const failures = unapproved.length ? execFileSync('git', [
        'diff', '--name-only', baseline, '--', ...unapproved
    ], { cwd: ROOT, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean) : [];
    for (const file of files.filter(file => retired.has(file))) {
        const record = retired.get(file);
        if (!record.reason || !/^[a-f0-9]{64}$/.test(record.beforeSha256) ||
            !retiredRegister.authorization ||
            !fs.existsSync(path.join(ROOT, retiredRegister.authorization)) ||
            fs.existsSync(path.join(ROOT, file))) failures.push(file);
    }
    for (const file of activeFiles.filter(file => !unapproved.includes(file))) {
        const approval = register.approvedFiles[file];
        if (!approval.authorizedAt || !approval.reason || !approval.evidence ||
            sha256(readSource(file)) !== approval.contentSha256) failures.push(file);
    }
    return failures;
}

module.exports = { verifyFrozenPdfFiles };
