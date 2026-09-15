// Write-safety audit for app.js: async handlers that await a database write but never guard it
// with try/catch, so a rejected write is silent and the page keeps showing optimistic state.
// Read-only report.
//
// Usage: node scripts/audit-app-write-safety.js [--json <path>]
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const readArg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const jsonPath = readArg('--json', path.join(ROOT, 'artifacts', 'audit-baseline', 'app-write-safety.json'));
const source = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

const findBlock = (startIndex, openBrace) => {
    let depth = 0;
    for (let index = openBrace; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return { start: startIndex, end: index + 1, body: source.slice(openBrace, index + 1) };
        }
    }
    return null;
};

const handlers = [];
const definition = /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*async\s*\(/gm;
let match = definition.exec(source);
while (match) {
    const braceIndex = source.indexOf('{', match.index + match[0].length);
    if (braceIndex < 0) break;
    const block = findBlock(match.index, braceIndex);
    if (!block) break;
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    const writes = (block.body.match(/await\s+db\.[\w.]*\.(?:put|update|delete|bulkPut|bulkDelete|add)\(/g) || []).length;
    const otherWrites = (block.body.match(/await\s+[\w.]+\.(?:put|update|delete|bulkPut|bulkDelete)\(/g) || []).length;
    const guarded = /try\s*\{/.test(block.body);
    const savesState = /await\s+loadData\(\)/.test(block.body);
    if (writes + otherWrites > 0) {
        handlers.push({
            name: match[1],
            line,
            directDbWrites: writes,
            moduleWrites: otherWrites,
            guarded,
            reloadsAfterWrite: savesState,
            bytes: block.body.length
        });
    }
    definition.lastIndex = block.end;
    match = definition.exec(source);
}

const unguarded = handlers.filter(row => !row.guarded).sort((a, b) => b.directDbWrites - a.directDbWrites);
const report = {
    generatedAt: new Date().toISOString(),
    totalWriteHandlers: handlers.length,
    unguardedCount: unguarded.length,
    unguarded,
    guarded: handlers.filter(row => row.guarded).map(row => row.name)
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

console.log('[app-write-safety] async handlers that write: ' + handlers.length);
console.log('[app-write-safety] without try/catch: ' + unguarded.length);
for (const row of unguarded) {
    console.log(`  line ${row.line} ${row.name}: db writes ${row.directDbWrites},`
        + ` through modules ${row.moduleWrites}, reloads after ${row.reloadsAfterWrite}`);
}
console.log('[app-write-safety] report written to ' + jsonPath);
