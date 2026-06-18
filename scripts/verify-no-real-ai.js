const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const failMarkers = [
    '/api/ai/chat',
    '/api/ai/ocr',
    'dashscope.aliyuncs.com',
    'DASHSCOPE_API_KEY'
];

const warningMarkers = [
    'qwen-vl-ocr-latest',
    'qwen-vl-max-latest',
    'qwen3-vl-plus',
    'qwen-plus'
];

const allowedFiles = new Set([
    'app.js',
    'qisi-local-server.js',
    'scripts/smoke-ai-proxy.js',
    'scripts/smoke-ai-vision-proxy.js',
    'scripts/verify-no-real-ai.js',
    'tests/batch-smoke-mock.test.js'
]);

function toProjectPath(filePath) {
    return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function listFiles(dir, predicate, results = []) {
    if (!fs.existsSync(dir)) {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            listFiles(fullPath, predicate, results);
            continue;
        }

        if (entry.isFile() && predicate(fullPath)) {
            results.push(fullPath);
        }
    }

    return results;
}

function collectScanFiles() {
    const files = [];

    for (const name of fs.readdirSync(rootDir)) {
        if (/^qisi-.*\.js$/.test(name) || name === 'app.js') {
            files.push(path.join(rootDir, name));
        }
    }

    listFiles(
        path.join(rootDir, 'tests'),
        (filePath) => filePath.endsWith('.js'),
        files
    );

    listFiles(
        path.join(rootDir, 'scripts'),
        (filePath) => filePath.endsWith('.js'),
        files
    );

    return files;
}

function findForbiddenMarkers() {
    const failures = [];

    for (const filePath of collectScanFiles()) {
        const projectPath = toProjectPath(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            for (const marker of failMarkers) {
                if (
                    line.includes(marker) &&
                    !allowedFiles.has(projectPath)
                ) {
                    failures.push({
                        file: projectPath,
                        line: index + 1,
                        marker
                    });
                }
            }

            for (const marker of warningMarkers) {
                if (line.includes(marker)) {
                    // Model names are intentionally warnings only. They are
                    // configuration evidence, not proof of a real call path.
                }
            }
        }
    }

    return failures;
}

const failures = findForbiddenMarkers();

if (failures.length > 0) {
    console.log('[verify-no-real-ai] failed');
    for (const failure of failures) {
        console.log(
            `${failure.file}:${failure.line} contains forbidden real AI/OCR marker: ${failure.marker}`
        );
    }
    process.exitCode = 1;
} else {
    console.log('[verify-no-real-ai] passed');
}
