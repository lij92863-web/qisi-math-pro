#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const acorn = require('acorn');
const ROOT = path.resolve(__dirname, '..');
const script = /\.(?:c|m)?js$/i;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function sourcePath(value) {
    const file = String(value).replace(/\\/g, '/');
    if (!file || /^[\/]|^[a-z][\w+.-]*:/i.test(file) || file.split('/').some(part => ['', '.', '..'].includes(part))) {
        throw new Error('INVENTORY_SOURCE_PATH_INVALID');
    }
    return file;
}

function analyzeSources({ sources, targets, productionEntries, diagnosticEntries, declaredRuntime = {} } = {}) {
    const inputs = new Map();
    for (const [name, source] of Object.entries(sources || {})) {
        const file = sourcePath(name);
        if (inputs.has(file)) throw new Error('INVENTORY_SOURCE_PATH_COLLISION');
        inputs.set(file, Buffer.isBuffer(source) ? source : Buffer.from(String(source)));
    }
    const files = [...inputs.keys()].sort();
    const selected = (targets || files.filter(file => !file.includes('/') && script.test(file))).map(sourcePath).sort();
    if (selected.some(file => !inputs.has(file))) throw new Error('INVENTORY_TARGET_MISSING');
    const production = (productionEntries || files.filter(file => !file.includes('/') &&
        (/\.(?:html|cmd|bat|ps1|vbs)$/i.test(file) || file === 'qisi-local-server.js'))).filter(file => inputs.has(file)).sort();
    const diagnostic = (diagnosticEntries || files.filter(file => /^(?:tests|scripts|tools)\//.test(file) || file === 'package.json'))
        .filter(file => inputs.has(file)).sort();
    const edgesByKey = new Map(), unresolved = [];
    const rank = { 'file-reference': 0, 'launcher-reference': 1, require: 2, import: 2, 'html-script': 3 };
    function resolve(from, reference) {
        if (typeof reference !== 'string' || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(reference)) return [];
        const clean = reference.replace(/\\/g, '/').split(/[?#]/)[0];
        const possible = [path.posix.join(path.posix.dirname(from), clean), clean.replace(/^(?:\.\/|\/)/, '')];
        return [...new Set(possible.flatMap(value => {
            const file = path.posix.normalize(value);
            if (file === '..' || file.startsWith('../') || file.startsWith('/')) return [];
            return [file, file + '.js', file + '.cjs', file + '.mjs', file + '/index.js'].filter(candidate => inputs.has(candidate));
        }))];
    }
    const add = (from, to, kind, line) => {
        const key = JSON.stringify([from, to, line]), previous = edgesByKey.get(key);
        if (!previous || rank[kind] > rank[previous.kind]) edgesByKey.set(key, { from, to, kind, line });
    };
    const reference = (from, value, kind, line) => resolve(from, value).forEach(to => add(from, to, kind, line));
    function visit(node, file) {
        if (!node || typeof node !== 'object') return;
        const line = node.loc?.start.line || 1;
        const requireCall = node.type === 'CallExpression' && (node.callee.type === 'Identifier' && node.callee.name === 'require' ||
            node.callee.type === 'MemberExpression' && node.callee.object?.name === 'require' && node.callee.property?.name === 'resolve');
        if (requireCall || node.type === 'ImportExpression') {
            const argument = requireCall ? node.arguments[0] : node.source;
            if (argument?.type === 'Literal' && typeof argument.value === 'string') reference(file, argument.value, requireCall ? 'require' : 'import', line);
            else unresolved.push({ file, kind: 'dynamic-module-load', line });
        }
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
            reference(file, node.source.value, 'import', line);
        }
        if (node.type === 'Literal' && typeof node.value === 'string' && /\.(?:c|m)?js(?:[?#].*)?$/i.test(node.value)) {
            reference(file, node.value, 'file-reference', line);
        }
        for (const [key, value] of Object.entries(node)) {
            if (['loc', 'start', 'end'].includes(key)) continue;
            if (Array.isArray(value)) value.forEach(child => { if (child?.type) visit(child, file); });
            else if (value?.type) visit(value, file);
        }
    }
    for (const file of files) {
        const source = inputs.get(file).toString('utf8');
        if (script.test(file)) {
            const commonJs = !file.endsWith('.mjs') && (file.endsWith('.cjs') || /^(?:scripts|tests|tools)\//.test(file) || declaredRuntime[file] === 'node');
            try { visit(acorn.parse(source, { ecmaVersion: 'latest', sourceType: file.endsWith('.mjs') ? 'module' : 'script', allowReturnOutsideFunction: commonJs, locations: true }), file); }
            catch (error) { unresolved.push({ file, kind: 'parse-error', line: error.loc?.line || 1, column: error.loc?.column || 0 }); }
        } else if (/\.html$/i.test(file)) {
            const html = source.replace(/<!--[\s\S]*?-->/g, value => value.replace(/[^\n]/g, ' '));
            for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
                const src = /\bsrc\s*=\s*(["'])(.*?)\1/i.exec(match[1]);
                if (src) reference(file, src[2], 'html-script', html.slice(0, match.index).split('\n').length);
            }
        } else {
            // Launcher/package references are conservative mentions, never execution proof.
            for (const target of files) {
                const index = Math.max(source.indexOf(target), source.indexOf(target.replace(/\//g, '\\')));
                if (index >= 0) add(file, target, 'launcher-reference', source.slice(0, index).split('\n').length);
            }
        }
    }
    const edges = [...edgesByKey.values()].sort((a, b) => a.from.localeCompare(b.from) || a.line - b.line || a.to.localeCompare(b.to));
    function reachable(roots) {
        const reached = new Set(roots), queue = [...roots];
        for (let i = 0; i < queue.length; i++) for (const edge of edges) {
            if (edge.from === queue[i] && !reached.has(edge.to)) { reached.add(edge.to); queue.push(edge.to); }
        }
        return reached;
    }
    const live = reachable(production), checked = reachable(diagnostic);
    unresolved.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind));
    const modules = selected.map(file => {
        const declared = declaredRuntime[file] || null, issues = [];
        if (['browser', 'node'].includes(declared) && !live.has(file)) issues.push('runtime-declaration-needs-entry-review');
        issues.push(...unresolved.filter(item => item.file === file).map(item => item.kind));
        const classification = live.has(file) ? 'live' : issues.length ? 'uncertain' : checked.has(file) ? 'dormant' :
            unresolved.length ? 'uncertain' : 'dead-candidate';
        return { file, sha256: sha(inputs.get(file)), classification, declaredRuntime: declared,
            productionReachable: live.has(file), diagnosticReachable: checked.has(file),
            inbound: edges.filter(edge => edge.to === file), issues };
    });
    return {
        schema: 'qisi.code-inventory.v1', deletionAuthorized: false, staticAnalysisComplete: unresolved.length === 0,
        roots: { production, diagnostic }, modules, edges, unresolved,
        counts: { sources: files.length, targets: modules.length, edges: edges.length,
            ...Object.fromEntries(['live', 'dormant', 'dead-candidate', 'uncertain'].map(kind => [kind, modules.filter(item => item.classification === kind).length])) },
        limits: 'Static reference graph only. String mentions and conditional requires overestimate use. A browser/node declaration is a platform, not proof of a production entry. Computed DOM loading, eval, alternate entry points and excluded vendor code are not fully modelled. A dead-candidate is not deletion permission; inspect consumers, compatibility, tests and archived evidence first. Source contents are never executed or included.'
    };
}

function collectSources(root = ROOT) {
    const sources = {}, ignored = new Set(['vendor', 'node_modules', 'local-run-artifacts', 'tmp', 'deliverables']);
    function walk(directory, nested) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink() || entry.name.startsWith('.') && entry.name !== '.bm_a4_app_before.js') continue;
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (!ignored.has(entry.name) && (nested || ['tests', 'scripts', 'tools'].includes(entry.name))) walk(full, true);
            } else if (entry.isFile() && (script.test(entry.name) || !nested && (/\.(?:html|cmd|bat|ps1|vbs)$/i.test(entry.name) || entry.name === 'package.json'))) {
                sources[path.relative(root, full).split(path.sep).join('/')] = fs.readFileSync(full);
            }
        }
    }
    walk(root, false); return sources;
}

function writeReport(report, output, { root = ROOT } = {}) {
    const target = path.resolve(root, output), allowed = path.join(path.resolve(root), 'local-run-artifacts');
    if (!target.startsWith(allowed + path.sep) || !target.endsWith('.json')) throw new Error('INVENTORY_OUTPUT_SCOPE_INVALID');
    const markdown = target.replace(/\.json$/, '.md');
    let current = path.resolve(root);
    for (const part of path.relative(root, path.dirname(target)).split(path.sep)) {
        current = path.join(current, part);
        if (fs.existsSync(current)) {
            if (fs.lstatSync(current).isSymbolicLink()) throw new Error('INVENTORY_OUTPUT_LINK_FORBIDDEN');
            if (!fs.statSync(current).isDirectory()) throw new Error('INVENTORY_OUTPUT_SCOPE_INVALID');
        } else fs.mkdirSync(current);
    }
    if (fs.existsSync(target) || fs.existsSync(markdown)) throw new Error('INVENTORY_REPORT_ALREADY_EXISTS');
    const cell = value => String(value ?? '').replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = ['# 文件引用清单', '', '只读静态观察；dead-candidate 仅表示缺少已知可达引用，不能按此直接删除。', '',
        '| 文件 | 分类 | 声明角色 | 疑点 |', '|---|---|---|---|',
        ...report.modules.map(item => '| ' + [item.file, item.classification, item.declaredRuntime, item.issues.join(', ')].map(cell).join(' | ') + ' |'),
        '', report.limits, ''];
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    fs.writeFileSync(markdown, lines.join('\n'), { flag: 'wx' });
    return { json: target, markdown };
}

function run({ root = ROOT, out } = {}) {
    const declaration = JSON.parse(fs.readFileSync(path.join(root, 'architecture/runtime-modules.json'), 'utf8'));
    const manifestCheck = require('../scripts/verify-runtime-modules.js').verify(root);
    const report = { generatedAt: new Date().toISOString(), ...analyzeSources({ sources: collectSources(root),
        declaredRuntime: Object.fromEntries(declaration.modules.map(item => [item.file, item.runtime])) }), manifestCheck };
    const output = out || path.join(root, 'local-run-artifacts/code-inventory', new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid, 'report.json');
    const paths = writeReport(report, output, { root });
    return { report, paths };
}

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        if (args.length && (args.length !== 2 || args[0] !== '--out')) throw new Error('Only optional --out NEW_JSON_PATH is supported. This tool cannot delete files.');
        const result = run({ out: args[1] });
        console.log(JSON.stringify({ ...result.report.counts, manifestValid: result.report.manifestCheck.valid, deletionAuthorized: false, ...result.paths }));
        if (!result.report.manifestCheck.valid) process.exitCode = 1;
    } catch (error) { console.error(String(error.code || error.message)); process.exitCode = 1; }
}
module.exports = { analyzeSources, collectSources, writeReport, run };
