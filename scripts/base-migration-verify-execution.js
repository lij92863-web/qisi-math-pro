const fs = require('fs');
const path = require('path');

/**
 * Classify a migration as REAL_MIGRATION, PARTIAL_MIGRATION, SCAFFOLD_ONLY, or INVALID.
 *
 * Usage:
 *   node scripts/base-migration-verify-execution.js \
 *     --before .bm_app_before.js \
 *     --after app.js \
 *     --module qisi-review-draft-state.js \
 *     --old-names helper1,helper2
 */

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--before') args.before = argv[++i];
        else if (argv[i] === '--after') args.after = argv[++i];
        else if (argv[i] === '--module') args.module = argv[++i];
        else if (argv[i] === '--old-names') args.oldNames = argv[++i];
    }
    return args;
}

function readLines(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    return fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
}

function countLines(filePath) {
    const lines = readLines(filePath);
    return lines ? lines.length : null;
}

function containsNameInFile(filePath, names) {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const name of names) {
        // Look for function definition patterns with this name
        const patterns = [
            new RegExp(`const\\s+${name}\\s*=\\s*\\(`),
            new RegExp(`const\\s+${name}\\s*=\\s*function`),
            new RegExp(`const\\s+${name}\\s*=\\s*async`),
            new RegExp(`function\\s+${name}\\s*\\(`)
        ];
        if (patterns.some(p => p.test(content))) {
            return true;
        }
    }
    return false;
}

function appCallsModule(appPath, moduleName) {
    if (!fs.existsSync(appPath)) return false;
    const content = fs.readFileSync(appPath, 'utf8');
    const baseName = moduleName.replace(/\.js$/, '');

    // Check for window.Qisi.ModuleName references
    const moduleRef = baseName.replace(/^qisi-/, '');
    const camelRef = moduleRef
        .split('-')
        .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
        .join('');

    const patterns = [
        new RegExp(`window\\.Qisi\\.${camelRef.charAt(0).toUpperCase() + camelRef.slice(1)}`),
        new RegExp(`window\\.Qisi\\.${camelRef}`),
        new RegExp(`require\\(['"].*${baseName}`)
    ];

    return patterns.some(p => p.test(content));
}

function moduleExportsFunctions(modulePath, names) {
    if (!fs.existsSync(modulePath)) return false;
    const content = fs.readFileSync(modulePath, 'utf8');

    for (const name of names) {
        const patterns = [
            new RegExp(`const\\s+${name}\\s*=\\s*\\(`),
            new RegExp(`const\\s+${name}\\s*=\\s*function`),
            new RegExp(`function\\s+${name}\\s*\\(`)
        ];
        if (!patterns.some(p => p.test(content))) {
            return false;
        }
    }
    return true;
}

function checkControlledWriteModified(beforePath, afterPath) {
    // This is a safety check: controlled-write should never be in the diff
    return false; // Handled externally by verify:diff-scope
}

function checkRouteBIntegrated(appPath) {
    if (!fs.existsSync(appPath)) return false;
    const content = fs.readFileSync(appPath, 'utf8');
    return content.includes('route-b') || content.includes('Route B');
}

function classify(argv) {
    const args = parseArgs(argv);
    const rootDir = path.resolve(__dirname, '..');

    const beforePath = args.before ? path.resolve(rootDir, args.before) : null;
    const afterPath = args.after ? path.resolve(rootDir, args.after) : path.join(rootDir, 'app.js');
    const moduleName = args.module || '';
    const modulePath = moduleName ? path.resolve(rootDir, moduleName) : null;
    const oldNames = args.oldNames ? args.oldNames.split(',').map(n => n.trim()).filter(Boolean) : [];

    const beforeLines = beforePath ? countLines(beforePath) : null;
    const afterLines = countLines(afterPath);
    const delta = beforeLines !== null ? afterLines - beforeLines : null;

    const oldDefinitionsStillPresent = oldNames.length > 0
        ? containsNameInFile(afterPath, oldNames)
        : false;

    const appCallsNewModule = moduleName ? appCallsModule(afterPath, moduleName) : false;
    const moduleHasFunctions = modulePath ? moduleExportsFunctions(modulePath, oldNames) : false;
    const routeBIntegrated = checkRouteBIntegrated(afterPath);

    const reasons = [];

    let classification = 'SCAFFOLD_ONLY';

    // Check INVALID first
    if (routeBIntegrated) {
        classification = 'INVALID';
        reasons.push('Route B is integrated — forbidden');
    }

    // REAL_MIGRATION requires an explicit app.js reference to the target module.
    // Do not accept global-scope-only migration where functions are merely removed
    // from app.js and present in a loaded script.
    if (classification === 'SCAFFOLD_ONLY') {
        if (
            delta !== null &&
            delta <= -10 &&
            !oldDefinitionsStillPresent &&
            appCallsNewModule &&
            moduleHasFunctions
        ) {
            classification = 'REAL_MIGRATION';
            reasons.push('app.js delta <= -10, old definitions removed, app explicitly calls new module, module exports moved functions');
        }
    }

    // Check PARTIAL_MIGRATION
    if (classification === 'SCAFFOLD_ONLY') {
        if (appCallsNewModule && (delta === null || delta > -10)) {
            classification = 'PARTIAL_MIGRATION';
            reasons.push('app calls new module but app.js delta > -10 or unknown');
        } else if (appCallsNewModule && oldDefinitionsStillPresent) {
            classification = 'PARTIAL_MIGRATION';
            reasons.push('app calls new module but old definitions still present');
        }
    }

    // Check SCAFFOLD_ONLY (default)
    if (classification === 'SCAFFOLD_ONLY') {
        if (delta === 0 || delta === null) {
            reasons.push('app.js unchanged or new module not called by app.js');
        } else if (!appCallsNewModule) {
            reasons.push('new module not called by app.js');
        } else {
            reasons.push('does not meet REAL or PARTIAL criteria');
        }
    }

    return {
        beforeLines,
        afterLines,
        delta,
        oldDefinitionsStillPresent,
        appCallsNewModule,
        moduleExportsMovedFunctions: moduleHasFunctions,
        classification,
        reasons
    };
}

if (require.main === module) {
    const result = classify(process.argv);
    console.log(JSON.stringify(result, null, 2));

    if (result.classification === 'INVALID') {
        process.exit(1);
    }
}

module.exports = { classify, parseArgs, containsNameInFile, appCallsModule, moduleExportsFunctions };
