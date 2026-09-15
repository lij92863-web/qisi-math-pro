// Resource-handle audit: timers, object URLs and child processes that are created without a
// matching release in the same module. Read-only; it reports candidates with counts, it does not
// change code.
//
// Usage: node scripts/audit-resource-handles.js [--json <path>]
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const readArg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const jsonPath = readArg('--json', path.join(ROOT, 'artifacts', 'audit-baseline', 'resource-handles.json'));

const countMatches = (source, pattern) => (source.match(pattern) || []).length;

const files = [
    ...fs.readdirSync(ROOT).filter(name => name.endsWith('.js')),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter(name => name.endsWith('.js')).map(name => path.join('scripts', name)),
    ...fs.readdirSync(path.join(ROOT, 'workers')).filter(name => name.endsWith('.mjs')).map(name => path.join('workers', name))
];

const rows = [];
for (const file of files.sort()) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const source = fs.readFileSync(full, 'utf8');

    const entry = {
        file,
        setInterval: countMatches(source, /setInterval\(/g),
        clearInterval: countMatches(source, /clearInterval\(/g),
        setTimeout: countMatches(source, /setTimeout\(/g),
        clearTimeout: countMatches(source, /clearTimeout\(/g),
        createObjectURL: countMatches(source, /URL\.createObjectURL\(/g),
        revokeObjectURL: countMatches(source, /URL\.revokeObjectURL\(/g),
        addEventListener: countMatches(source, /addEventListener\(/g),
        removeEventListener: countMatches(source, /removeEventListener\(/g),
        spawn: countMatches(source, /\bspawn\(/g),
        kill: countMatches(source, /\.kill\(|Stop-Process|taskkill/g),
        terminate: countMatches(source, /\.terminate\(/g),
        close: countMatches(source, /\.close\(/g)
    };

    entry.flags = [];
    if (entry.setInterval > 0 && entry.clearInterval === 0) entry.flags.push('interval-without-clear');
    if (entry.createObjectURL > 0 && entry.revokeObjectURL === 0) entry.flags.push('object-url-without-revoke');
    if (entry.addEventListener > 0 && entry.removeEventListener === 0 && !/addEventListener\([^)]*\{\s*(?:once|signal)/.test(source)) {
        entry.flags.push('listener-without-removal');
    }
    if (entry.spawn > 0 && entry.kill === 0 && entry.terminate === 0) entry.flags.push('child-process-without-kill');

    if (entry.flags.length) rows.push(entry);
}

const report = {
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    flagged: rows
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

console.log('[resource-handles] files scanned: ' + report.filesScanned);
console.log('[resource-handles] flagged files: ' + rows.length);
for (const row of rows) {
    console.log(`  ${row.file}: ${row.flags.join(', ')}`
        + ` (interval ${row.setInterval}/${row.clearInterval}, objectURL ${row.createObjectURL}/${row.revokeObjectURL},`
        + ` listener ${row.addEventListener}/${row.removeEventListener}, spawn ${row.spawn}/${row.kill + row.terminate})`);
}
console.log('[resource-handles] report written to ' + jsonPath);
