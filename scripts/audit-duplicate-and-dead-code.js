// Technical-debt inventory for the repository: duplicate helper names across modules and
// exports that nothing else references. Regex based and deliberately conservative: it reports
// candidates for a human or agent to verify, and never changes code.
//
// Usage: node scripts/audit-duplicate-and-dead-code.js [--json <path>]
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const readArg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const jsonPath = readArg('--json', path.join(ROOT, 'artifacts', 'audit-baseline', 'code-debt-inventory.json'));

const listSourceFiles = () => {
    const files = [];
    const add = dir => {
        for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (['node_modules', '.git', 'vendor', 'tmp', 'artifacts'].includes(entry.name)) continue;
                add(path.join(dir, entry.name));
                continue;
            }
            if (!entry.name.endsWith('.js')) continue;
            files.push(path.join(dir, entry.name).replace(/\\/g, '/'));
        }
    };
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.js')) files.push(entry.name);
    }
    for (const dir of ['scripts', 'tests', 'workers', 'tools']) {
        if (fs.existsSync(path.join(ROOT, dir))) add(dir);
    }
    return files.sort();
};

const files = listSourceFiles();
const sources = new Map(files.map(file => [file, fs.readFileSync(path.join(ROOT, file), 'utf8')]));

const DEFINITION_PATTERNS = [
    /^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_$][\w$]*\s*=>)/gm,
    /^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm
];

// Names that are JavaScript keywords, or that the loose object/array patterns would pick up as
// plain data, are not code duplicates.
const IGNORED_NAMES = new Set([
    'if', 'for', 'while', 'function', 'return', 'switch', 'catch', 'do', 'else', 'try', 'typeof',
    'constructor', 'get', 'set', 'rows', 'table', 'questions', 'expected', 'answers', 'options',
    'item', 'items', 'value', 'values', 'data', 'result', 'results', 'config', 'state'
]);

const definitions = new Map();
for (const [file, source] of sources) {
    const names = new Set();
    for (const pattern of DEFINITION_PATTERNS) {
        pattern.lastIndex = 0;
        let match = pattern.exec(source);
        while (match) {
            if (!IGNORED_NAMES.has(match[1])) names.add(match[1]);
            match = pattern.exec(source);
        }
    }
    for (const name of names) {
        if (!definitions.has(name)) definitions.set(name, []);
        definitions.get(name).push(file);
    }
}

// Names that only exist in one place are not interesting for a duplicate report.
const duplicates = [...definitions]
    .filter(([, owners]) => owners.length > 1)
    .map(([name, owners]) => ({ name, owners }))
    .filter(row => row.owners.some(file => file.startsWith('qisi-') || file === 'app.js'))
    .sort((a, b) => b.owners.length - a.owners.length || a.name.localeCompare(b.name));

const exportedNames = new Map();
for (const [file, source] of sources) {
    if (!/^qisi-.*\.js$/.test(file)) continue;
    const matches = [...source.matchAll(/(?:module\.exports\s*=\s*|\breturn\s*\{)([\s\S]{0,4000}?)\n\s*\}/g)];
    for (const match of matches) {
        for (const entry of match[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*[,:]/gm)) {
            exportedNames.set(entry[1], file);
        }
    }
}

const usageCount = name => {
    let count = 0;
    for (const source of sources.values()) {
        const pattern = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`, 'g');
        count += (source.match(pattern) || []).length;
    }
    return count;
};

const unusedExports = [];
for (const [name, file] of exportedNames) {
    const source = sources.get(file) || '';
    const inOwnFile = (source.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;
    const total = usageCount(name);
    // One definition plus one export line in its own file is the minimum; anything at that level
    // is only used inside the module that defines it.
    if (total - inOwnFile <= 0 && inOwnFile <= 2) {
        unusedExports.push({ name, file, occurrencesInFile: inOwnFile, occurrencesEverywhere: total });
    }
}

const report = {
    generatedAt: new Date().toISOString(),
    filesScanned: files.length,
    duplicateDefinitions: duplicates.slice(0, 60),
    duplicateCount: duplicates.length,
    possiblyUnusedExports: unusedExports.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name)),
    possiblyUnusedExportCount: unusedExports.length
};

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

console.log('[code-debt] files scanned: ' + report.filesScanned);
console.log('[code-debt] names defined in more than one file: ' + report.duplicateCount);
for (const row of report.duplicateDefinitions.slice(0, 25)) {
    console.log(`  ${row.name}: ${row.owners.join(', ')}`);
}
console.log('[code-debt] exported but never referenced elsewhere: ' + report.possiblyUnusedExportCount);
for (const row of report.possiblyUnusedExports.slice(0, 25)) {
    console.log(`  ${row.file}: ${row.name}`);
}
console.log('[code-debt] report written to ' + jsonPath);
