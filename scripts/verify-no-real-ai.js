const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

const failMarkers = [
    '/api/ai/chat',
    '/api/ai/ocr',
    'dashscope.aliyuncs.com',
    'DASHSCOPE_API_KEY',
    // MinerU 云端解析：同样属于真实外部 AI 服务，浏览器侧不得直连。
    // 只有服务端装配点和显式 opt-in 的离线探针可以出现，见 allowedFiles / reviewedProductionLines。
    'mineru.net',
    'MINERU_TOKEN'
];

// 与 AI/OCR 相关的目录都要扫，避免新目录绕开门禁；不存在的目录自动跳过。
const scanDirectories = ['tests', 'scripts', 'tools', 'local-ocr', 'benchmarks'];
const scanExtensions = ['.js', '.cjs'];
const skippedDirectoryNames = new Set(['node_modules', 'vendor']);

const warningMarkers = [
    'qwen-vl-ocr-latest',
    'qwen-vl-max-latest',
    'qwen3-vl-plus',
    'qwen-plus'
];

const allowedFiles = new Set([
    'qisi-local-server.js',
    // Production transport validates the fixed host; default tests inject a mock request.
    'qisi-local-https-transport.js',
    // MinerU 云接口装配点：端点常量与 Bearer 透传都在客户端模块里，token 由服务端注入。
    'qisi-mineru-task-service.js',
    'tests/local-https-transport.test.js',
    'scripts/pdf-master-browser-runner.js', // Explicit opt-in real-run; reviewed env-name declaration only.
    'scripts/mineru-probe.cjs', // Explicit opt-in real-run probe; never part of verify:safe or npm test.
    'scripts/smoke-ai-proxy.js',
    'scripts/smoke-ai-vision-proxy.js',
    'scripts/verify-no-real-ai.js',
    'tests/batch-smoke-mock.test.js',
    // The crop UI test intercepts this same-origin route with a fixture response;
    // the browser harness aborts any request that escapes the explicit mock.
    'tests/e2e/video-workspace.test.js'
]);

// Only these already reviewed production transport lines may contain real endpoint markers.
const reviewedProductionLines = {
    "qisi-local-server.js": [
        "const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || '').trim();",
        "const MINERU_TOKEN = String(process.env.MINERU_TOKEN || '').trim();",
        "const mineruClient = createMineruClient({ token: MINERU_TOKEN,",
        "app.get('/api/mineru/status', (req, res) => res.json({ configured: Boolean(MINERU_TOKEN), pageSelection: true }));",
        "const DASHSCOPE_CHAT_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'compatible-mode/v1/' + 'chat/completions';",
        "const DASHSCOPE_OCR_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'api/v1/services/aigc/' + 'multimodal-generation/' + 'generation';",
        "configured: Boolean(DASHSCOPE_API_KEY)",
        "if (!DASHSCOPE_API_KEY) {",
        "Authorization: `Bearer ${DASHSCOPE_API_KEY}`,",
        "app.post('/api/ai/chat', aiJsonParser, (req, res) => {",
        "app.post('/api/ai/ocr', aiJsonParser, (req, res) => {"
    ],
    "qisi-mineru-task-service.js": [
        "projectZip, baseUrl = 'https://mineru.net', pollIntervalMs = 800, timeoutMs = 300000 } = {}) {"
    ],
    "scripts/mineru-probe.cjs": [
        "const TOKEN = String(process.env.MINERU_TOKEN || '').trim();",
        "const BASE = 'https://mineru.net';",
        "if (!TOKEN) throw new Error('MINERU_TOKEN 未配置');"
    ],
    "scripts/pdf-master-browser-runner.js": [
        "const API_KEY_ENV_NAME = 'DASH' + 'SCOPE_API_KEY';"
    ],
    "qisi-local-https-transport.js": [
        "if (parsed.protocol !== 'https:' || parsed.hostname !== 'dashscope.aliyuncs.com' ||"
    ]
};

function toProjectPath(filePath) {
    return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

function isScannableFile(filePath) {
    return scanExtensions.some(extension => filePath.endsWith(extension));
}

function listFiles(dir, predicate, results = []) {
    if (!fs.existsSync(dir)) {
        return results;
    }

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && skippedDirectoryNames.has(entry.name)) {
            continue;
        }

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
        if (isScannableFile(name) && (/^qisi-.*\.(js|cjs)$/.test(name) || name === 'app.js')) {
            files.push(path.join(rootDir, name));
        }
    }

    for (const dirname of scanDirectories) {
        listFiles(path.join(rootDir, dirname), isScannableFile, files);
    }

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
            const folded = line.replace(/['"]\s*\+\s*['"]/g, '');
            for (const marker of failMarkers) {
                if (
                    folded.includes(marker) &&
                    (!allowedFiles.has(projectPath) || (reviewedProductionLines[projectPath] &&
                        !reviewedProductionLines[projectPath].includes(line.trim())))
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
