const { execFileSync } = require('child_process');

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}
function readGitNames(args, cwd = process.cwd()) {
    return execFileSync('git', args, { cwd, encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean).map(normalizePath);
}
function getChangedFiles({ cwd = process.cwd(), base = '' } = {}) {
    const files = new Set();
    const commands = [['diff', '--name-only', '-z'],
        ['diff', '--cached', '--name-only', '-z'], ['ls-files', '--others', '--exclude-standard', '-z']];
    if (base) {
        const revision = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`],
            { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        commands.push(['diff', '--name-only', '-z', revision, 'HEAD', '--']);
    }
    for (const command of commands) for (const file of readGitNames(command, cwd)) files.add(file);
    return [...files].sort();
}
function parseAllowedPatterns(raw = process.env.QISI_ALLOWED_DIFF || '') {
    return raw.split(',').map(part => normalizePath(part.trim())).filter(Boolean);
}
function matchPattern(filePath, pattern) {
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3);
        return filePath === prefix || filePath.startsWith(`${prefix}/`);
    }
    if (pattern.includes('*')) {
        const escaped = pattern.split('*').map(part =>
            part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*');
        return new RegExp(`^${escaped}$`).test(filePath);
    }
    return filePath === pattern;
}
function main() {
    const allowed = parseAllowedPatterns();
    if (!allowed.length) {
        console.log('[verify-diff-scope] failed: QISI_ALLOWED_DIFF is required');
        process.exitCode = 1; return;
    }
    let files;
    try { files = getChangedFiles({ base: process.env.QISI_DIFF_BASE || '' }); }
    catch { console.log('[verify-diff-scope] failed: invalid Git state or base revision');
        process.exitCode = 1; return; }
    const rejected = files.filter(file => !allowed.some(pattern => matchPattern(file, pattern)));
    if (rejected.length) {
        console.log('[verify-diff-scope] failed');
        console.log('Not allowed:'); rejected.forEach(file => console.log(`- ${file}`));
        process.exitCode = 1;
    } else console.log(`[verify-diff-scope] passed${files.length ? '' : ': no changed files'}`);
}
if (require.main === module) main();
module.exports = { getChangedFiles, matchPattern, parseAllowedPatterns };
