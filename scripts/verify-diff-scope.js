const { execFileSync } = require('child_process');

function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function readGitNames(args) {
    const output = execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });

    return output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(normalizePath);
}

function getChangedFiles() {
    const files = new Set();

    for (const file of readGitNames(['diff', '--name-only'])) {
        files.add(file);
    }

    for (const file of readGitNames(['diff', '--cached', '--name-only'])) {
        files.add(file);
    }

    return [...files].sort();
}

function parseAllowedPatterns() {
    const raw = process.env.QISI_ALLOWED_DIFF || '';
    return raw
        .split(',')
        .map((part) => normalizePath(part.trim()))
        .filter(Boolean);
}

function matchPattern(filePath, pattern) {
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3);
        return filePath === prefix || filePath.startsWith(`${prefix}/`);
    }

    if (pattern.includes('*')) {
        const escaped = pattern
            .split('*')
            .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('[^/]*');
        return new RegExp(`^${escaped}$`).test(filePath);
    }

    return filePath === pattern;
}

const allowedPatterns = parseAllowedPatterns();

if (allowedPatterns.length === 0) {
    console.log('[verify-diff-scope] failed: QISI_ALLOWED_DIFF is required');
    process.exitCode = 1;
    return;
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
    console.log('[verify-diff-scope] passed: no changed files');
    return;
}

const notAllowed = changedFiles.filter(
    (filePath) => !allowedPatterns.some((pattern) => matchPattern(filePath, pattern))
);

if (notAllowed.length > 0) {
    console.log('[verify-diff-scope] failed');
    console.log('Not allowed:');
    for (const filePath of notAllowed) {
        console.log(`- ${filePath}`);
    }
    console.log('Allowed patterns:');
    for (const pattern of allowedPatterns) {
        console.log(`- ${pattern}`);
    }
    process.exitCode = 1;
} else {
    console.log('[verify-diff-scope] passed');
}
