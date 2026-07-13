const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_ROOT = path.resolve(__dirname, '..');

const normalizeScriptPath = source => {
    const clean = String(source || '').split(/[?#]/)[0].trim();
    if (!clean || /^(?:https?:)?\/\//i.test(clean)) return '';
    return clean.replace(/^\.\//, '').replace(/\\/g, '/');
};

const readText = (rootDir, relativePath, virtualFiles = {}) => {
    if (Object.prototype.hasOwnProperty.call(virtualFiles, relativePath)) {
        const value = virtualFiles[relativePath];
        return value == null ? null : String(value);
    }

    const absolute = path.join(rootDir, relativePath);
    return fs.existsSync(absolute)
        ? fs.readFileSync(absolute, 'utf8')
        : null;
};

const parseScriptSources = html => {
    const sources = [];
    const pattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*><\/script>/gi;
    let match;

    while ((match = pattern.exec(String(html || ''))) !== null) {
        const normalized = normalizeScriptPath(match[1]);
        if (normalized) sources.push(normalized);
    }

    return sources;
};

const collectNamespaceOwners = source => {
    const owners = new Set();
    const pattern = /(?:root|window|globalThis|globalScope)\.Qisi\.([A-Za-z_$][\w$]*)\s*=/g;
    let match;

    while ((match = pattern.exec(String(source || ''))) !== null) {
        owners.add(match[1]);
    }

    return [...owners];
};

const collectWindowNamespaceUses = source => {
    const uses = new Set();
    const pattern = /window\.Qisi\.([A-Za-z_$][\w$]*)\b/g;
    let match;

    while ((match = pattern.exec(String(source || ''))) !== null) {
        uses.add(match[1]);
    }

    return [...uses];
};

const analyzeRuntimeDependencies = ({
    rootDir = DEFAULT_ROOT,
    htmlPath = 'main.html',
    html,
    virtualFiles = {}
} = {}) => {
    const htmlSource =
        html == null
            ? readText(rootDir, htmlPath, virtualFiles)
            : String(html);

    const errors = [];
    const warnings = [];

    if (htmlSource == null) {
        return {
            ok: false,
            scripts: [],
            owners: {},
            uses: [],
            errors: [{
                code: 'runtime-html-missing',
                path: htmlPath
            }],
            warnings
        };
    }

    const scripts = parseScriptSources(htmlSource);
    const localJs = scripts.filter(source => /\.js$/i.test(source));
    const appIndexes = localJs
        .map((source, index) => ({ source, index }))
        .filter(item => /(^|\/)app\.js$/i.test(item.source));

    if (appIndexes.length !== 1) {
        errors.push({
            code: 'runtime-app-script-count',
            count: appIndexes.length
        });
    }

    const appEntry = appIndexes[0] || null;
    if (
        appEntry &&
        appEntry.index !== localJs.length - 1
    ) {
        errors.push({
            code: 'runtime-app-not-last',
            path: appEntry.source,
            index: appEntry.index,
            lastIndex: localJs.length - 1
        });
    }

    const ownersByNamespace = new Map();
    const sourceByScript = new Map();

    localJs.forEach((scriptPath, index) => {
        const source = readText(rootDir, scriptPath, virtualFiles);
        sourceByScript.set(scriptPath, source);

        if (source == null) {
            errors.push({
                code: 'runtime-script-missing',
                path: scriptPath,
                index
            });
            return;
        }

        for (const namespace of collectNamespaceOwners(source)) {
            const owner = {
                path: scriptPath,
                index
            };
            const existing = ownersByNamespace.get(namespace) || [];
            existing.push(owner);
            ownersByNamespace.set(namespace, existing);
        }
    });

    for (const [namespace, owners] of ownersByNamespace.entries()) {
        const distinctPaths = [...new Set(owners.map(owner => owner.path))];
        if (distinctPaths.length > 1) {
            errors.push({
                code: 'runtime-duplicate-owner',
                namespace,
                paths: distinctPaths
            });
        }
    }

    let uses = [];
    if (appEntry) {
        const appSource = sourceByScript.get(appEntry.source);
        if (appSource != null) {
            uses = collectWindowNamespaceUses(appSource);

            for (const namespace of uses) {
                const owners = ownersByNamespace.get(namespace) || [];
                if (!owners.length) {
                    errors.push({
                        code: 'runtime-namespace-undefined',
                        namespace,
                        consumer: appEntry.source
                    });
                    continue;
                }

                if (!owners.some(owner => owner.index < appEntry.index)) {
                    errors.push({
                        code: 'runtime-owner-after-app',
                        namespace,
                        consumer: appEntry.source,
                        ownerPaths: owners.map(owner => owner.path)
                    });
                }
            }
        }
    }

    const owners = {};
    for (const [namespace, entries] of ownersByNamespace.entries()) {
        owners[namespace] = entries.map(entry => entry.path);
    }

    return {
        ok: errors.length === 0,
        scripts: localJs,
        owners,
        uses,
        errors,
        warnings
    };
};

const runCli = () => {
    const result = analyzeRuntimeDependencies({
        rootDir: DEFAULT_ROOT
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
};

if (require.main === module) {
    runCli();
}

module.exports = {
    normalizeScriptPath,
    parseScriptSources,
    collectNamespaceOwners,
    collectWindowNamespaceUses,
    analyzeRuntimeDependencies
};
