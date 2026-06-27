const fs = require('fs');
const { HELPERS } = require('./bm-a4-helper-extract');

function hasModuleExport(source, helper) {
    const apiBlock = /const\s+api\s*=\s*\{([\s\S]*?)\};/.exec(source);
    return Boolean(apiBlock && new RegExp(`\\b${helper}\\b`).test(apiBlock[1]));
}

function findWrapperLines(appSource, helper) {
    const lines = appSource.split(/\r?\n/);
    return lines
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => new RegExp(`\\bconst\\s+${helper}\\s*=`).test(line) || new RegExp(`\\bfunction\\s+${helper}\\s*\\(`).test(line));
}

function wrapperDelegates(appSource, helper) {
    const re = new RegExp(`(?:const\\s+${helper}\\s*=|function\\s+${helper}\\s*\\()[\\s\\S]{0,240}?window\\.Qisi\\.Utils\\.${helper}`, 'm');
    return re.test(appSource);
}

function nakedCalls(appSource, helper) {
    const lines = appSource.split(/\r?\n/);
    const results = [];
    lines.forEach((line, index) => {
        if (!line.includes(`${helper}`)) return;
        if (line.includes(`window.Qisi.Utils.${helper}`)) return;
        if (new RegExp(`\\bconst\\s+${helper}\\s*=`).test(line)) return;
        if (new RegExp(`\\bfunction\\s+${helper}\\s*\\(`).test(line)) return;
        if (new RegExp(`\\b${helper}\\s*\\(`).test(line)) {
            results.push({ line: index + 1, text: line.trim() });
        }
    });
    return results;
}

function analyzeFiles({ beforePath = '.bm_a4_app_before.js', afterPath = 'app.js', modulePath = 'qisi-utils.js' } = {}) {
    const before = fs.existsSync(beforePath) ? fs.readFileSync(beforePath, 'utf8') : '';
    const after = fs.readFileSync(afterPath, 'utf8');
    const moduleSource = fs.readFileSync(modulePath, 'utf8');
    return analyzeSources({ before, after, moduleSource });
}

function analyzeSources({ before = '', after = '', moduleSource = '' }) {
    const exports = {};
    const wrappers = {};
    const wrapperDelegation = {};
    const naked = {};
    for (const helper of HELPERS) {
        exports[helper] = hasModuleExport(moduleSource, helper);
        wrappers[helper] = findWrapperLines(after, helper);
        wrapperDelegation[helper] = wrapperDelegates(after, helper);
        naked[helper] = nakedCalls(after, helper);
    }
    const exportsAll = Object.values(exports).every(Boolean);
    const wrappersAny = Object.values(wrappers).some((items) => items.length > 0);
    const wrappersAllDelegate = HELPERS.every((helper) => wrappers[helper].length > 0 && wrapperDelegation[helper]);
    const nakedCount = Object.values(naked).reduce((sum, items) => sum + items.length, 0);
    const explicitCount = HELPERS.reduce((sum, helper) => {
        return sum + (after.match(new RegExp(`window\\.Qisi\\.Utils\\.${helper}\\s*\\(`, 'g')) || []).length;
    }, 0);
    const beforeLines = before ? before.split(/\r?\n/).length : 0;
    const afterLines = after.split(/\r?\n/).length;

    let classification = 'TOOLING_ONLY';
    if (exportsAll && !wrappersAny && nakedCount > 0) classification = 'BLOCKED';
    else if (exportsAll && !wrappersAny && explicitCount > 0) classification = 'STAGED_MIGRATION_COMPLETE';
    else if (exportsAll && wrappersAllDelegate && explicitCount === HELPERS.length) classification = 'WRAPPER_ADAPTER';
    else if (exportsAll && wrappersAny && nakedCount === 0 && explicitCount > HELPERS.length) classification = 'CALLSITE_COMPLETE_WITH_WRAPPERS';
    else if (exportsAll && wrappersAny && explicitCount > HELPERS.length) classification = 'CALLSITE_PARTIAL';
    else if (exportsAll && wrappersAllDelegate) classification = 'WRAPPER_ADAPTER';
    else if (exportsAll) classification = 'QISI_UTILS_IMPL';

    return {
        ok: classification !== 'BLOCKED',
        classification,
        beforeLines,
        afterLines,
        delta: afterLines - beforeLines,
        exports,
        wrappers: Object.fromEntries(Object.entries(wrappers).map(([key, value]) => [key, value.map((item) => item.number)])),
        wrapperDelegation,
        naked,
        explicitCount
    };
}

function main(argv = process.argv.slice(2)) {
    const args = {};
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--before') args.beforePath = argv[i + 1];
        if (argv[i] === '--after') args.afterPath = argv[i + 1];
        if (argv[i] === '--module') args.modulePath = argv[i + 1];
    }
    const result = analyzeFiles(args);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = {
    analyzeSources,
    analyzeFiles,
    hasModuleExport,
    nakedCalls
};
