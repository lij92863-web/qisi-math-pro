// The project .env is this machine's explicit configuration and must win over a
// stale machine-wide variable of the same name: an inherited key silently
// shadowed a corrected .env and produced a misleading invalid_api_key.
require('dotenv').config({ override: true });

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { randomUUID } = require('node:crypto');
const { spawn } = require('child_process');
const { createTempJobManager } = require('./qisi-temp-job-manager');
const { createSecureLogger } = require('./qisi-secure-logger');
const { instanceIdFor } = require('./qisi-local-instance');
const { createAiRequestLimiter, networkFailureCode } = require('./qisi-local-ai-request-policy');
const { assertDocxUploadType, validateDocxPackage } = require('./qisi-docx-upload-policy');
const { postDashScope, closeDashScopeConnections } = require('./qisi-local-https-transport');
const { isAllowedLocalHost, isAllowedLocalOrigin, publicRootAssets, isPublicAsset } = require('./qisi-local-http-boundary');
const { createMineruClient } = require('./qisi-mineru-client');

createSecureLogger(console).install();

const ROOT = __dirname;
const TMP_DIR = path.join(ROOT, 'tmp');
const UPLOAD_DIR = path.join(TMP_DIR, 'uploads');
const CONVERTED_DIR = path.join(TMP_DIR, 'converted');
const TOOLS_DIR = path.join(ROOT, 'tools');
const PS_CONVERTER = path.join(TOOLS_DIR, 'convert-docx-to-pdf.ps1');
const { validateEquations, createNativeTranslator } = require('./qisi-mathtype-local-service');
const translateLocalMtef = createNativeTranslator(ROOT);
const PORT = Number(process.env.PORT || 3000);
const HOST = '127.0.0.1';
const CONVERT_TIMEOUT_MS = Number(process.env.DOCX_CONVERT_TIMEOUT_MS || 120000);
const CONVERTER_MODE = String(process.env.QISI_DOCX_CONVERTER || 'auto').toLowerCase();
const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || '').trim();
const AI_BODY_LIMIT = String(process.env.AI_BODY_LIMIT || '60mb');
const AI_REQUEST_TIMEOUT_MS = Math.max(10000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 180000));
const TEMP_JOB_MAX_AGE_MS = Math.max(60000, Number(process.env.QISI_TEMP_JOB_MAX_AGE_MS || 24 * 60 * 60 * 1000));
// MinerU 精准解析：token 只在服务端 .env 读取，浏览器永远拿不到。
const MINERU_TOKEN = String(process.env.MINERU_TOKEN || '').trim();
const MINERU_MAX_PDF_BYTES = 200 * 1024 * 1024;
const MINERU_MAX_PAGES = 200;
const DASHSCOPE_CHAT_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'compatible-mode/v1/' + 'chat/completions';
const DASHSCOPE_OCR_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'api/v1/services/aigc/' + 'multimodal-generation/' + 'generation';
// Supported modes: auto / libreoffice-first / word-first / libreoffice-only / word-only

for (const dir of [TMP_DIR, UPLOAD_DIR, CONVERTED_DIR, TOOLS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const tempJobManager = createTempJobManager({
  roots: [UPLOAD_DIR, CONVERTED_DIR],
  rootBoundary: ROOT,
  maxAgeMs: TEMP_JOB_MAX_AGE_MS
});

function trackIncomingUpload(req, filename, callback) {
  const release = tempJobManager.track({ uploadPath: path.join(UPLOAD_DIR, filename) });
  req.res.once('finish', release);
  req.res.once('close', release);
  callback(null, filename);
}

const app = express();
app.disable('x-powered-by');
// The pipeline legitimately issues page-parallel requests (a 21-page paper opens
// up to 12 in flight). The old fixed cap of 4 turned that into AI_PROXY_BUSY,
// which is a local rejection and looks like a provider failure to the caller.
const aiRequestLimiter = createAiRequestLimiter({
    maxConcurrent: Math.max(1, Number(process.env.AI_MAX_CONCURRENT || 16) | 0),
    capacity: Math.max(1, Number(process.env.AI_RATE_CAPACITY || 600) | 0)
});
const aiJsonParser = express.json({ limit: AI_BODY_LIMIT, type: 'application/json' });

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  if (!isAllowedLocalHost(req.get('host'), PORT)) return res.sendStatus(403);
  const origin = req.get('origin');
  res.vary('Origin');
  if (!isAllowedLocalOrigin(origin, PORT)) return res.sendStatus(403);
  if (req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'no-store');
    if (req.get('sec-fetch-site') === 'cross-site') return res.sendStatus(403);
  }
  if (origin) res.set('Access-Control-Allow-Origin', origin);
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
    return res.sendStatus(204);
  }
  next();
});

app.post('/api/maintenance/temp-files/cleanup', async (req, res) => {
  if (req.get('origin') !== `http://${req.get('host')}` || req.get('x-qisi-temp-cleanup') !== '1') return res.sendStatus(403);
  return res.json(await tempJobManager.cleanupInactive());
});

app.get('/api/ai/health', (req, res) => {
  res.json({
    ok: true,
    configured: Boolean(DASHSCOPE_API_KEY)
  });
});

function safeAiModelName(body) {
  const model = String(body?.model || '').trim();
  if (!model || !/^qwen[-_.a-z0-9]+$/i.test(model)) return '';
  return model;
}

function validateAiRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, code: 'INVALID_AI_BODY', error: 'AI request body must be a JSON object.' };
  }

  const model = safeAiModelName(body);
  if (!model) {
    return { ok: false, status: 400, code: 'INVALID_AI_MODEL', error: 'AI request model is missing or invalid.' };
  }

  return { ok: true, model };
}

async function forwardDashScopeRequest(req, res, routeName, upstreamUrl) {
  if (!DASHSCOPE_API_KEY) {
    return res.status(503).json({
      ok: false,
      code: 'DASHSCOPE_NOT_CONFIGURED',
      error: 'DashScope API Key is not configured on the local server.'
    });
  }

  const validation = validateAiRequestBody(req.body);
  if (!validation.ok) {
    return res.status(validation.status).json({
      ok: false,
      code: validation.code,
      error: validation.error
    });
  }

  const lease = aiRequestLimiter.acquire();
  if (!lease.ok) {
    res.set('Retry-After', String(lease.retryAfter));
    return res.status(429).json({ ok: false, code: lease.code,
      error: 'Local AI request limit reached. Please retry later.' });
  }
  const controller = new AbortController();
  let abortReason = null;
  const abort = reason => {
    if (!controller.signal.aborted) { abortReason = reason; controller.abort(); }
  };
  const abortOnClose = () => { if (!res.writableEnded) abort('client_disconnected'); };
  res.once('close', abortOnClose);
  const timer = setTimeout(() => abort('deadline'), AI_REQUEST_TIMEOUT_MS);
  const bodyText = JSON.stringify(req.body);
  const model = validation.model;
  const startedAt = Date.now();
  const requestId = String(req.get('x-request-id') || `req-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
    .slice(0, 80) || `req-${Date.now()}`;

  try {
    console.log('[AI_PROXY][request]', {
      requestId,
      stage: `${routeName}.request`,
      engine: model
    });

    const upstream = await postDashScope({
      url: upstreamUrl,
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: bodyText,
      signal: controller.signal,
      onPhase: event => console.log('[AI_PROXY][transport]', {
        requestId,
        stage: `${routeName}.transport.${event.stage}`,
        durationMs: event.elapsedMs,
        code: event.reusedSocket ? 'SOCKET_REUSED' : 'SOCKET_FRESH'
      })
    });
    const responseBuffer = upstream.buffer;
    const contentType = upstream.contentType;

    console.log('[AI_PROXY][response]', {
      requestId,
      stage: `${routeName}.response`,
      engine: model,
      durationMs: Date.now() - startedAt,
      code: upstream.ok ? 'AI_PROXY_OK' : `AI_PROXY_HTTP_${upstream.status}`
    });

    if (res.destroyed || res.writableEnded) return;
    res.status(upstream.status);
    res.set('content-type', contentType);
    return res.send(responseBuffer);
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    const timedOut = aborted && abortReason === 'deadline';
    const cancelled = aborted && !timedOut;
    const causeCode = aborted ? 'REQUEST_ABORTED' : networkFailureCode(error);
    const code = timedOut ? 'AI_PROXY_TIMEOUT' : cancelled ? 'AI_PROXY_CANCELLED' : 'AI_PROXY_FETCH_FAILED';
    console.error('[AI_PROXY][error]', {
      requestId,
      stage: `${routeName}.error`,
      engine: model,
      durationMs: Date.now() - startedAt,
      code: aborted ? code : `AI_PROXY_FETCH_FAILED:${causeCode}`
    });

    if (res.destroyed || res.writableEnded || abortReason === 'client_disconnected') return;
    return res.status(timedOut ? 504 : cancelled ? 499 : 502).json({
      ok: false,
      code,
      causeCode,
      ...(error.transportDiagnostic ? { transportDiagnostic: error.transportDiagnostic } : {}),
      ...(abortReason ? { abortReason } : {}),
      error: timedOut
        ? `DashScope upstream request timed out after ${AI_REQUEST_TIMEOUT_MS}ms.`
        : cancelled ? 'DashScope upstream request cancelled.'
        : `DashScope upstream connection failed (${causeCode}).`
    });
  } finally {
    clearTimeout(timer);
    res.removeListener('close', abortOnClose);
    lease.release();
  }
}

app.post('/api/ai/chat', aiJsonParser, (req, res) => {
  forwardDashScopeRequest(req, res, 'chat', DASHSCOPE_CHAT_UPSTREAM);
});

app.post('/api/ai/ocr', aiJsonParser, (req, res) => {
  forwardDashScopeRequest(req, res, 'ocr', DASHSCOPE_OCR_UPSTREAM);
});

const MAIN_HTML_PATH = path.join(ROOT, 'main.html');
// The served file allow-list follows main.html on disk. A server started before a
// new <script> tag existed must not keep answering 404 for it, because a single
// missing module leaves the page blank with no visible error.
let rootAssetSnapshot = { mtimeMs: -1, assets: null };
const currentRootAssets = () => {
  const { mtimeMs } = fs.statSync(MAIN_HTML_PATH);
  if (mtimeMs !== rootAssetSnapshot.mtimeMs) {
    rootAssetSnapshot = {
      mtimeMs,
      assets: publicRootAssets(fs.readFileSync(MAIN_HTML_PATH, 'utf8'))
    };
  }
  return rootAssetSnapshot.assets;
};
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!isPublicAsset(req.path, currentRootAssets())) return res.sendStatus(404);
  next();
});
app.use(express.static(ROOT, { extensions: ['html'], maxAge: 0, etag: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname || 'upload.docx');
    const ext = path.extname(safe) || '.docx';
    const base = path.basename(safe, ext);
    trackIncomingUpload(req, `${Date.now()}_${randomUUID()}_${base}${ext}`, cb);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    try { assertDocxUploadType(file); callback(null, true); }
    catch (error) { callback(error); }
  },
  limits: { fileSize: 80 * 1024 * 1024, files: 1, fields: 0 }
});

function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 160);
}

// multipart 的 filename 按 latin1 解码，中文名会变成乱码，这里还原成 UTF-8。
function decodeMultipartFilename(name) {
  const value = String(name || '');
  if (!value || !/[\u0080-\u00ff]/.test(value)) return value;
  try {
    const decoded = Buffer.from(value, 'latin1').toString('utf8');
    return decoded.includes('\ufffd') ? value : decoded;
  } catch {
    return value;
  }
}

function killProcessTree(child) {
  if (!child?.pid) return;

  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
    return;
  }

  child.kill('SIGKILL');
}

function runProcess(command, args, options = {}, timeoutMs = 180000) {
  return new Promise((resolve) => {
    const spawnOptions = { ...options };
    const effectiveTimeoutMs = Number(spawnOptions.timeoutMs || timeoutMs || 0);
    delete spawnOptions.timeoutMs;

    const child = spawn(command, args, {
      windowsHide: true,
      ...spawnOptions
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer = null;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(payload);
    };

    if (effectiveTimeoutMs > 0) {
      timer = setTimeout(() => {
        stderr += `\n${command} timed out after ${Math.round(effectiveTimeoutMs / 1000)} seconds.`;
        killProcessTree(child);
        finish({
          ok: false,
          code: -2,
          stdout,
          stderr,
          error: new Error(`${command} timed out after ${Math.round(effectiveTimeoutMs / 1000)} seconds`)
        });
      }, effectiveTimeoutMs);
    }

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', error => {
      finish({ ok: false, code: -1, stdout, stderr, error });
    });

    child.on('close', code => {
      finish({ ok: code === 0, code, stdout, stderr, error: null });
    });
  });
}

function parseLastJson(stdout) {
  const text = String(stdout || '').trim();
  const match = text.match(/\{[\s\S]*\}\s*$/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function convertWithWordCom(inputPath, outputDir) {
  if (process.platform !== 'win32') {
    throw new Error('Word COM only supports Windows.');
  }

  await fsp.mkdir(outputDir, { recursive: true });

  const result = await runProcess('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    PS_CONVERTER,
    '-InputPath',
    inputPath,
    '-OutputDir',
    outputDir
  ], { cwd: ROOT }, CONVERT_TIMEOUT_MS);

  const json = parseLastJson(result.stdout);

  if (!result.ok || !json?.ok) {
    const detail = json?.error || result.stderr || result.stdout || result.error?.message || 'Word COM conversion failed.';
    throw new Error(detail);
  }

  if (!json.pdfPath || !fs.existsSync(json.pdfPath)) {
    throw new Error(`Word COM reported success, but PDF does not exist: ${json.pdfPath || '(empty path)'}`);
  }

  return json.pdfPath;
}

function uniqueExistingCandidates(items) {
  const seen = new Set();
  const out = [];

  for (const item of items || []) {
    if (!item) continue;
    const value = String(item).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function findLibreOfficeExecutable() {
  const candidates = [];

  const envCandidates = [
    process.env.QISI_SOFFICE_PATH,
    process.env.SOFFICE_PATH,
    process.env.LIBREOFFICE_PATH
  ].filter(Boolean);

  for (const item of envCandidates) {
    const p = String(item || '').trim();
    if (!p) continue;

    if (/soffice(\.(com|exe))?$/i.test(p)) {
      candidates.push(p);
    } else {
      if (process.platform === 'win32') {
        candidates.push(path.join(p, 'program', 'soffice.com'));
        candidates.push(path.join(p, 'program', 'soffice.exe'));
        candidates.push(path.join(p, 'soffice.com'));
        candidates.push(path.join(p, 'soffice.exe'));
      } else {
        candidates.push(path.join(p, 'program', 'soffice'));
        candidates.push(path.join(p, 'soffice'));
      }
    }
  }

  if (process.platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pfx86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env.LOCALAPPDATA || '';

    candidates.push(
      path.join(pf, 'LibreOffice', 'program', 'soffice.com'),
      path.join(pf, 'LibreOffice', 'program', 'soffice.exe'),
      path.join(pfx86, 'LibreOffice', 'program', 'soffice.com'),
      path.join(pfx86, 'LibreOffice', 'program', 'soffice.exe'),
      path.join(local, 'Programs', 'LibreOffice', 'program', 'soffice.com'),
      path.join(local, 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
      'soffice.com',
      'soffice.exe'
    );
  } else {
    candidates.push(
      '/usr/bin/soffice',
      '/usr/bin/libreoffice',
      '/usr/local/bin/soffice',
      '/usr/local/bin/libreoffice',
      'soffice',
      'libreoffice'
    );
  }

  return uniqueExistingCandidates(candidates);
}

function toLibreOfficeFileUrl(inputPath) {
  const resolved = path.resolve(inputPath).replace(/\\/g, '/');
  return `file:///${encodeURI(resolved)}`;
}

async function convertWithLibreOffice(inputPath, outputDir) {
  await fsp.mkdir(outputDir, { recursive: true });
  const profileDir = path.join(outputDir, 'lo-profile');
  await fsp.mkdir(profileDir, { recursive: true });
  const errors = [];

  for (const exe of findLibreOfficeExecutable()) {
    const result = await runProcess(exe, [
      '--headless',
      '--invisible',
      '--nologo',
      '--nodefault',
      '--nofirststartwizard',
      '--nolockcheck',
      `-env:UserInstallation=${toLibreOfficeFileUrl(profileDir)}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outputDir,
      inputPath
    ], { cwd: ROOT }, CONVERT_TIMEOUT_MS);

    if (result.ok) {
      const base = path.basename(inputPath).replace(/\.[^.]+$/, '');
      const pdfPath = path.join(outputDir, `${base}.pdf`);

      if (fs.existsSync(pdfPath)) return pdfPath;

      const files = await fsp.readdir(outputDir);
      const pdf = files.find(f => f.toLowerCase().endsWith('.pdf'));
      if (pdf) return path.join(outputDir, pdf);
    }

    errors.push(`${exe}: ${result.stderr || result.stdout || result.error?.message || `exit ${result.code}`}`);
  }

  throw new Error(`LibreOffice conversion failed: ${errors.join(' | ')}`);
}

async function convertDocxToPdf(inputPath, job = {}) {
  const jobId = `${Date.now()}_${randomUUID()}`;
  const outDir = path.join(CONVERTED_DIR, jobId);
  const errors = [];

  job.outputDir = outDir;

  await fsp.mkdir(outDir, { recursive: true });

  const tryWord = async () => {
    if (process.platform !== 'win32') {
      throw new Error('Word COM only available on Windows.');
    }
    return await convertWithWordCom(inputPath, outDir);
  };

  const tryLibre = async () => await convertWithLibreOffice(inputPath, outDir);

  const mode = CONVERTER_MODE;

  if (mode === 'libreoffice-only') {
    try {
      return await tryLibre();
    } catch (error) {
      errors.push(`LibreOffice: ${error.message || String(error)}`);
      throw new Error(errors.join('\n'));
    }
  }

  if (mode === 'word-only') {
    try {
      return await tryWord();
    } catch (error) {
      errors.push(`Word COM: ${error.message || String(error)}`);
      throw new Error(errors.join('\n'));
    }
  }

  const order = mode === 'word-first'
    ? ['word', 'libre']
    : ['libre', 'word'];

  for (const item of order) {
    if (item === 'libre') {
      try {
        return await tryLibre();
      } catch (error) {
        errors.push(`LibreOffice: ${error.message || String(error)}`);
      }
    }

    if (item === 'word' && process.platform === 'win32') {
      try {
        return await tryWord();
      } catch (error) {
        errors.push(`Word COM: ${error.message || String(error)}`);
      }
    }
  }

  throw new Error(errors.join('\n'));
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'qisi-local-server',
    instanceId: instanceIdFor(ROOT),
    platform: process.platform,
    port: PORT
  });
});

app.get('/api/convert/self-test', async (req, res) => {
  const result = {
    ok: true,
    platform: process.platform,
    node: process.version,
    converterMode: CONVERTER_MODE,
    libreOfficeCandidates: findLibreOfficeExecutable(),
    checks: {
      powershell: null,
      wordCom: null,
      libreOffice: null
    },
    errors: []
  };

  try {
    if (process.platform === 'win32') {
      const ps = await runProcess('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '$PSVersionTable.PSVersion.ToString()'
      ], { cwd: ROOT }, 30000);

      result.checks.powershell = {
        ok: ps.ok,
        code: ps.code,
        stdout: ps.stdout.trim(),
        stderr: ps.stderr.trim(),
        error: ps.error?.message || ''
      };

      if (!ps.ok) {
        result.ok = false;
        result.errors.push(`PowerShell unavailable: ${ps.stderr || ps.stdout || ps.error?.message || ps.code}`);
      }

      const wordCheck = await runProcess('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `
        $ErrorActionPreference = "Stop";
        $word = $null;
        try {
          $word = New-Object -ComObject Word.Application;
          $version = $word.Version;
          $word.Quit();
          Write-Output "WORD_OK:$version";
        } catch {
          Write-Output ("WORD_ERROR:" + $_.Exception.Message);
          exit 2;
        } finally {
          if ($word -ne $null) {
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) } catch {}
          }
          [GC]::Collect();
          [GC]::WaitForPendingFinalizers();
        }
        `
      ], { cwd: ROOT }, 60000);

      result.checks.wordCom = {
        ok: wordCheck.ok && /WORD_OK/.test(wordCheck.stdout),
        code: wordCheck.code,
        stdout: wordCheck.stdout.trim(),
        stderr: wordCheck.stderr.trim(),
        error: wordCheck.error?.message || ''
      };

      if (!result.checks.wordCom.ok) {
        result.errors.push(`Word COM unavailable: ${wordCheck.stdout || wordCheck.stderr || wordCheck.error?.message || wordCheck.code}`);
      }
    }

    const libreResults = [];

    for (const exe of findLibreOfficeExecutable()) {
      const r = await runProcess(exe, ['--version'], { cwd: ROOT }, 30000);
      libreResults.push({
        exe,
        ok: r.ok,
        code: r.code,
        stdout: r.stdout.trim(),
        stderr: r.stderr.trim(),
        error: r.error?.message || ''
      });
      if (r.ok) break;
    }

    result.checks.libreOffice = {
      ok: libreResults.some(x => x.ok),
      attempts: libreResults
    };

    if (!result.checks.wordCom?.ok && !result.checks.libreOffice.ok) {
      result.ok = false;
      result.errors.push('Neither Word COM nor LibreOffice is available; DOCX cannot be converted to PDF automatically.');
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || String(error),
      result
    });
  }
});

// Local structured formula conversion only; no AI transport is involved.
app.post('/api/convert/mathtype-mtef', express.json({ limit: '8mb' }), async (req, res) => {
  if (!validateEquations(req.body)) return res.status(400).json({ ok: false, code: 'MTEF_BATCH_INVALID', equations: [] });
  try { return res.json(await translateLocalMtef(req.body.equations)); }
  catch { return res.status(503).json({ ok: false, code: 'MATHTYPE_NATIVE_UNAVAILABLE', equations: [] }); }
});

app.post('/api/convert/docx-to-pdf', upload.single('file'), async (req, res) => {
  const uploaded = req.file;
  const cleanupJob = { uploadPath: uploaded?.path || '', outputDir: '' };
  const releaseTempJob = tempJobManager.track(cleanupJob);

  try {
    if (!uploaded) {
      return res.status(400).json({
        ok: false,
        error: 'No DOCX file was received. The form field name must be file.'
      });
    }

    const ext = path.extname(uploaded.originalname || uploaded.filename || '').toLowerCase();

    if (ext !== '.docx') {
      return res.status(400).json({
        ok: false,
        error: `Only .docx is supported. Current file type: ${ext || 'unknown'}.`
      });
    }

    await validateDocxPackage(await fsp.readFile(uploaded.path), uploaded);
    const pdfPath = await convertDocxToPdf(uploaded.path, cleanupJob);
    const pdfBuffer = await fsp.readFile(pdfPath);
    const pdfHeader = pdfBuffer.slice(0, 5).toString('latin1');
    const looksLikePdf = pdfHeader === '%PDF-';

    if (!looksLikePdf) {
      return res.status(500).json({
        ok: false,
        error: 'DOCX 转换产物不是有效 PDF',
        pdfHeader,
        looksLikePdf,
        actualPdfFilename: path.basename(pdfPath)
      });
    }

    res.json({
      ok: true,
      originalFilename: uploaded.originalname,
      pdfFilename: `${path.basename(uploaded.originalname, ext)}.pdf`,
      pdfHeader,
      looksLikePdf,
      actualPdfFilename: path.basename(pdfPath),
      pdfBytes: pdfBuffer.length,
      pdfDataUrl: `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
    });
  } catch (error) {
    console.error('[DOCX_CONVERT_ERROR]', {
      stage: 'docx.convert',
      code: error?.code || 'DOCX_CONVERT_FAILED'
    });

    const unsafeInput = /^DOCX_UPLOAD_|^ARCHIVE_/.test(error?.code || '');
    res.status(unsafeInput ? 400 : 500).json({
      ok: false,
      error: unsafeInput ? 'DOCX文件格式或安全校验未通过。' : error.message || String(error),
      code: error?.code || 'DOCX_CONVERT_FAILED',
      detail: {
        file: uploaded?.originalname || '',
        server: 'qisi-local-server',
        platform: process.platform,
        cwd: ROOT,
        hint: [
          'Confirm npm start is running.',
          'Confirm the browser is opened at http://localhost:3000/main.html.',
          'On Windows, confirm Microsoft Word is installed and can open this DOCX normally.',
          'Install LibreOffice as a fallback converter if Word COM is unavailable.',
          'If Word shows first-run, activation, privacy, protected-view, or add-in dialogs, open Word manually and finish those prompts first.'
        ]
      }
    });
  } finally {
    await tempJobManager.cleanupRequest(cleanupJob);
    releaseTempJob();
  }
});

// ---- MinerU 精准解析（契约 ai/MINERU_BLOCK_PROTOCOL.md §4） ----
const mineruClient = createMineruClient({ token: MINERU_TOKEN,
  store: require('./qisi-mineru-task-store').createMineruTaskStore(path.join(ROOT, 'local-run-artifacts', 'mineru-extractions-v2')) });

app.get('/api/mineru/status', (req, res) => res.json({ configured: Boolean(MINERU_TOKEN), pageSelection: true }));

const mineruUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safe = sanitizeFilename(decodeMultipartFilename(file.originalname) || 'upload.pdf');
      const ext = path.extname(safe) || '.pdf';
      const base = path.basename(safe, ext);
      trackIncomingUpload(req, `mineru_${Date.now()}_${randomUUID()}_${base}${ext}`, cb);
    }
  }),
  fileFilter: (req, file, callback) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.pdf' || (file.mimetype && file.mimetype !== 'application/pdf' && file.mimetype !== 'application/octet-stream')) {
      return callback(Object.assign(new Error('Only .pdf is supported.'), { code: 'MINERU_UPLOAD_TYPE_INVALID' }));
    }
    callback(null, true);
  },
  limits: { fileSize: MINERU_MAX_PDF_BYTES, files: 1, fields: 0 }
});

const mineruUploadSingle = (req, res, next) => {
  mineruUpload.single('file')(req, res, error => {
    if (!error) return next();
    const code = error.code === 'LIMIT_FILE_SIZE' ? 'MINERU_UPLOAD_SIZE_LIMIT' : 'MINERU_UPLOAD_TYPE_INVALID';
    return res.status(code === 'MINERU_UPLOAD_SIZE_LIMIT' ? 413 : 400).json({
      ok: false,
      code,
      error: code === 'MINERU_UPLOAD_SIZE_LIMIT'
        ? `PDF 超过 ${Math.round(MINERU_MAX_PDF_BYTES / 1024 / 1024)}MB 上限。`
        : '只接受 .pdf 文件，表单字段名必须是 file。'
    });
  });
};

// Read the page tree, including compressed object streams, before any upload.
async function estimatePdfPageCount(buffer) {
  const pdfjs = require('./vendor/pdfjs/pdf.min.js');
  pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('./vendor/pdfjs/pdf.worker.min.js');
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true });
  try { return (await task.promise).numPages; }
  catch { throw Object.assign(new Error('MINERU_INPUT_INVALID'), { code: 'MINERU_INPUT_INVALID' }); }
  finally { await task.destroy(); }
}

async function selectMineruPdf(buffer, range, totalPages) {
  const { validatePageRange, expandPageRange } = require('./qisi-utils.js');
  if (typeof range !== 'string' || !range || range.length > 1024 || !validatePageRange(range) ||
      [...range.matchAll(/\d+/g)].some(([number]) => Number(number) > totalPages)) {
    throw Object.assign(new Error(`页码范围无效。原 PDF 共 ${totalPages} 页，示例：1-3,5,7-9。`), { code: 'MINERU_PAGE_RANGE_INVALID' });
  }
  const pages = expandPageRange(range, totalPages);
  if (pages.length > MINERU_MAX_PAGES) throw Object.assign(new Error(`一次最多识别 ${MINERU_MAX_PAGES} 页。`), { code: 'MINERU_PAGE_LIMIT' });
  const { PDFDocument, PDFName } = require('pdf-lib');
  let selected;
  try {
    const original = await PDFDocument.load(buffer, { updateMetadata: false });
    selected = await PDFDocument.create({ updateMetadata: false });
    const indices = pages.map(page => page - 1);
    // Drop annotations and page-level actions before copying their object graphs.
    for (const index of indices) for (const key of ['Annots', 'AA', 'Metadata', 'PieceInfo', 'B']) {
      original.getPage(index).node.delete(PDFName.of(key));
    }
    for (const page of await selected.copyPages(original, indices)) selected.addPage(page);
  } catch {
    throw Object.assign(new Error('无法安全提取所选页面。请检查 PDF 是否加密或损坏。'), { code: 'MINERU_PAGE_RANGE_INVALID' });
  }
  const bytes = Buffer.from(await selected.save({ updateFieldAppearances: false }));
  if (bytes.length > MINERU_MAX_PDF_BYTES) throw Object.assign(new Error('所选页面的 PDF 超过 200MB 上限。'), { code: 'MINERU_UPLOAD_SIZE_LIMIT' });
  return { bytes, originalSource: { sha256: require('node:crypto').createHash('sha256').update(buffer).digest('hex'), pages, totalPages } };
}

function mineruErrorStatus(error) {
  const code = String(error?.code || '');
  if (code === 'MINERU_NOT_CONFIGURED') return 503;
  if (code === 'MINERU_INPUT_INVALID' || code === 'MINERU_UPLOAD_TYPE_INVALID' || code === 'MINERU_IMAGE_NAME_INVALID') return 400;
  if (code === 'MINERU_PAGE_RANGE_INVALID') return 400;
  if (code === 'MINERU_PAGE_LIMIT' || code === 'MINERU_UPLOAD_SIZE_LIMIT') return 413;
  if (code === 'MINERU_PARSE_TIMEOUT') return 504;
  if (code === 'MINERU_IMAGE_NOT_FOUND' || code === 'MINERU_JOB_NOT_FOUND') return 404;
  if (code.startsWith('MINERU_')) return 502;
  return 500;
}

app.post('/api/mineru/parse', mineruUploadSingle, async (req, res) => {
  const uploaded = req.file;
  if (!uploaded) {
    return res.status(400).json({ ok: false, code: 'MINERU_FILE_MISSING', error: '未收到 PDF，表单字段名必须是 file。' });
  }

  const controller = new AbortController();
  const abortOnClose = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', abortOnClose);
  const startedAt = Date.now();
  const cleanupJob = { uploadPath: uploaded.path };
  const releaseTempJob = tempJobManager.track(cleanupJob);

  try {
    const buffer = await fsp.readFile(uploaded.path);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return res.status(400).json({ ok: false, code: 'MINERU_FILE_INVALID', error: '上传内容不是有效的 PDF。' });
    }
    if (buffer.length > MINERU_MAX_PDF_BYTES) {
      return res.status(413).json({ ok: false, code: 'MINERU_UPLOAD_SIZE_LIMIT', error: 'PDF 超过 200MB 上限。' });
    }
    const estimatedPages = await estimatePdfPageCount(buffer);
    const range = req.query?.pages;
    const selection = range === undefined ? null : await selectMineruPdf(buffer, range, estimatedPages);
    if (!selection && estimatedPages > MINERU_MAX_PAGES) {
      return res.status(413).json({
        ok: false, code: 'MINERU_PAGE_LIMIT',
        error: `PDF 共 ${estimatedPages} 页，超过 ${MINERU_MAX_PAGES} 页上限。`
      });
    }

    const result = await mineruClient.parse(selection?.bytes || buffer, {
      filename: decodeMultipartFilename(uploaded.originalname) || path.basename(uploaded.path),
      signal: controller.signal
    });

    console.log('[MINERU_PARSE]', {
      stage: 'mineru.parse',
      code: 'MINERU_PARSE_OK',
      durationMs: Date.now() - startedAt,
      pages: result.source.pages,
      blocks: result.pages.reduce((sum, page) => sum + page.blocks.length, 0),
      answerTable: result.answerTable ? 'parsed' : 'null',
      submitMs: result.timings?.submitMs,
      uploadMs: result.timings?.uploadMs,
      pollMs: result.timings?.pollMs,
      fetchZipMs: result.timings?.fetchZipMs
    });

    if (res.destroyed || res.writableEnded) return;
    return res.json(selection ? { ...result, originalSource: selection.originalSource } : result);
  } catch (error) {
    const aborted = error?.name === 'AbortError' || controller.signal.aborted;
    const code = aborted ? 'MINERU_CANCELLED' : (error?.code || 'MINERU_PARSE_FAILED');
    console.error('[MINERU_PARSE][error]', {
      stage: error?.stage || 'mineru.parse',
      code,
      durationMs: Date.now() - startedAt,
      mineruCode: error?.mineruCode ?? null
    });
    if (res.destroyed || res.writableEnded) return;
    return res.status(aborted ? 499 : mineruErrorStatus(error)).json({
      ok: false,
      code,
      error: code,
      ...(error?.stage ? { stage: error.stage } : {}),
      ...(error?.httpStatus ? { httpStatus: error.httpStatus } : {}),
      ...(error?.mineruCode !== undefined ? { mineruCode: error.mineruCode } : {})
    });
  } finally {
    res.removeListener('close', abortOnClose);
    await tempJobManager.cleanupRequest(cleanupJob);
    releaseTempJob();
  }
});

app.get('/api/mineru/image', async (req, res) => {
  try {
    const { bytes, name } = await mineruClient.readImage(req.query?.name, { job: req.query?.job, sourceId: req.query?.sourceId });
    const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.set('Content-Type', types[path.extname(name).toLowerCase()] || 'application/octet-stream');
    res.set('Cache-Control', 'no-store');
    return res.send(Buffer.from(bytes));
  } catch (error) {
    if (res.writableEnded) return;
    return res.status(mineruErrorStatus(error)).json({
      ok: false,
      code: error?.code || 'MINERU_IMAGE_FAILED',
      error: error?.message || String(error)
    });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const code = error?.code === 'LIMIT_FILE_SIZE' || error?.type === 'entity.too.large' ? 'UPLOAD_SIZE_LIMIT'
    : error?.code === 'DOCX_UPLOAD_TYPE_INVALID' ? error.code
      : error instanceof SyntaxError ? 'INVALID_JSON_BODY' : 'LOCAL_SERVICE_FAILURE';
  res.status(code === 'UPLOAD_SIZE_LIMIT' ? 413 : code === 'LOCAL_SERVICE_FAILURE' ? 500 : 400)
    .json({ ok: false, code, error: 'Local request validation failed.' });
});

async function startServer() {
  await tempJobManager.cleanupExpired();
  const server = app.listen(PORT, HOST, () => {
    console.log(`[qisi-local-server] running at http://localhost:${PORT}`);
    console.log(`[qisi-local-server] open http://localhost:${PORT}/main.html`);
    console.log(`[qisi-local-server] health check: http://localhost:${PORT}/api/health`);
    console.log(`[qisi-local-server] converter self-test: http://localhost:${PORT}/api/convert/self-test`);
    console.log(`[qisi-local-server] converter mode: ${CONVERTER_MODE}`);
    console.log('[qisi-local-server] LibreOffice candidates:');
    findLibreOfficeExecutable().forEach(p => console.log(`  - ${p}`));
  });
  const expiredJobs = setInterval(() => void tempJobManager.cleanupExpired(), 60 * 60 * 1000);
  expiredJobs.unref();
  server.once('close', () => { clearInterval(expiredJobs); closeDashScopeConnections(); });
}

startServer().catch(error => {
  console.error('[SERVER_START_ERROR]', { code: error?.code || 'SERVER_START_FAILED' });
});
