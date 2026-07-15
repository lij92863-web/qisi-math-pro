require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');

const ROOT = __dirname;
const TMP_DIR = path.join(ROOT, 'tmp');
const UPLOAD_DIR = path.join(TMP_DIR, 'uploads');
const CONVERTED_DIR = path.join(TMP_DIR, 'converted');
const TOOLS_DIR = path.join(ROOT, 'tools');
const PS_CONVERTER = path.join(TOOLS_DIR, 'convert-docx-to-pdf.ps1');
const PS_MATHTYPE_TRANSLATOR = path.join(TOOLS_DIR, 'translate-mathtype-mtef.ps1');
const PORT = Number(process.env.PORT || 3000);
const CONVERT_TIMEOUT_MS = Number(process.env.DOCX_CONVERT_TIMEOUT_MS || 120000);
const MATHTYPE_TIMEOUT_MS = Number(process.env.MATHTYPE_TRANSLATE_TIMEOUT_MS || 60000);
const CONVERTER_MODE = String(process.env.QISI_DOCX_CONVERTER || 'auto').toLowerCase();
const DASHSCOPE_API_KEY = String(process.env.DASHSCOPE_API_KEY || '').trim();
const AI_BODY_LIMIT = String(process.env.AI_BODY_LIMIT || '60mb');
const AI_REQUEST_TIMEOUT_MS = Math.max(10000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 90000));
const DASHSCOPE_CHAT_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'compatible-mode/v1/' + 'chat/completions';
const DASHSCOPE_OCR_UPSTREAM = 'https://dashscope.aliyuncs.com/' + 'api/v1/services/aigc/' + 'multimodal-generation/' + 'generation';
// Supported modes: auto / libreoffice-first / word-first / libreoffice-only / word-only

for (const dir of [TMP_DIR, UPLOAD_DIR, CONVERTED_DIR, TOOLS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();
const aiJsonParser = express.json({ limit: AI_BODY_LIMIT, type: 'application/json' });

app.use(cors({ origin: true, credentials: false }));

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

function aiRequestBodySize(body) {
  try {
    return Buffer.byteLength(JSON.stringify(body || {}), 'utf8');
  } catch {
    return 0;
  }
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const bodyText = JSON.stringify(req.body);
  const model = validation.model;
  const startedAt = Date.now();

  try {
    console.log('[AI_PROXY][request]', {
      route: routeName,
      model,
      bytes: aiRequestBodySize(req.body)
    });

    const upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: bodyText,
      signal: controller.signal
    });

    const responseBuffer = Buffer.from(await upstream.arrayBuffer());
    const responseText = responseBuffer.toString('utf8');
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    let upstreamErrorSummary = '';

    if (!upstream.ok) {
      try {
        const payload = JSON.parse(responseText);
        upstreamErrorSummary = String(
          payload?.error?.message ||
          payload?.message ||
          payload?.code ||
          ''
        ).slice(0, 800);
      } catch (_) {
        upstreamErrorSummary = responseText.slice(0, 800);
      }
    }

    console.log('[AI_PROXY][response]', {
      route: routeName,
      model,
      status: upstream.status,
      durationMs: Date.now() - startedAt,
      responseBytes: responseBuffer.length,
      upstreamError: upstream.ok ? '' : upstreamErrorSummary
    });

    res.status(upstream.status);
    res.set('content-type', contentType);
    return res.send(responseBuffer);
  } catch (error) {
    const aborted = error?.name === 'AbortError';
    console.error('[AI_PROXY][error]', {
      route: routeName,
      model,
      code: aborted ? 'AI_PROXY_TIMEOUT' : 'AI_PROXY_FETCH_FAILED',
      message: error?.message || String(error)
    });

    return res.status(aborted ? 504 : 502).json({
      ok: false,
      code: aborted ? 'AI_PROXY_TIMEOUT' : 'AI_PROXY_FETCH_FAILED',
      error: aborted
        ? `DashScope upstream request timed out after ${AI_REQUEST_TIMEOUT_MS}ms.`
        : 'DashScope upstream request failed.'
    });
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/ai/chat', aiJsonParser, (req, res) => {
  forwardDashScopeRequest(req, res, 'chat', DASHSCOPE_CHAT_UPSTREAM);
});

app.post('/api/ai/ocr', aiJsonParser, (req, res) => {
  forwardDashScopeRequest(req, res, 'ocr', DASHSCOPE_OCR_UPSTREAM);
});

app.use(express.json({ limit: '2mb' }));
app.use(express.static(ROOT, { extensions: ['html'], maxAge: 0, etag: false }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = sanitizeFilename(file.originalname || 'upload.docx');
    const ext = path.extname(safe) || '.docx';
    const base = path.basename(safe, ext);
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }
});

function sanitizeFilename(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 160);
}

function validateMtefBatch(body) {
  const equations = Array.isArray(body?.equations) ? body.equations : null;
  if (!equations || equations.length < 1 || equations.length > 512) {
    return { ok: false, code: 'INVALID_MTEF_BATCH', equations: [] };
  }

  const normalized = [];
  for (const row of equations) {
    const id = String(row?.id || '').trim();
    const mtefBase64 = String(row?.mtefBase64 || '').trim();
    if (!id || id.length > 160 || !/^[A-Za-z0-9_.:-]+$/.test(id)) {
      return { ok: false, code: 'INVALID_MTEF_ID', equations: [] };
    }
    if (!mtefBase64 || mtefBase64.length > 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(mtefBase64)) {
      return { ok: false, code: 'INVALID_MTEF_PAYLOAD', equations: [] };
    }
    const bytes = Buffer.from(mtefBase64, 'base64');
    if (!bytes.length || bytes[0] !== 5) {
      return { ok: false, code: 'INVALID_MTEF_HEADER', equations: [] };
    }
    normalized.push({ id, mtefBase64 });
  }

  return { ok: true, code: 'MTEF_BATCH_OK', equations: normalized };
}

async function translateMtefBatch(equations) {
  const jobDir = await fsp.mkdtemp(path.join(TMP_DIR, 'mathtype-'));
  const inputPath = path.join(jobDir, 'input.json');
  const outputPath = path.join(jobDir, 'output.json');

  try {
    await fsp.writeFile(inputPath, JSON.stringify({ equations }), 'utf8');
    const result = await runProcess('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', PS_MATHTYPE_TRANSLATOR,
      '-InputPath', inputPath,
      '-OutputPath', outputPath
    ], {
      cwd: ROOT,
      windowsHide: true,
      timeoutMs: MATHTYPE_TIMEOUT_MS
    });

    if (!result.ok) {
      throw new Error(
        `MathType helper failed (${result.code}): ${String(result.stderr || result.stdout || '').trim()}`
      );
    }

    const payload = JSON.parse(await fsp.readFile(outputPath, 'utf8'));
    if (!Array.isArray(payload?.equations)) {
      const code = payload?.code || 'MATHTYPE_INVALID_RESPONSE';
      throw new Error(`MathType helper returned ${code}.`);
    }
    return payload;
  } finally {
    await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => {});
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

async function convertDocxToPdf(inputPath) {
  const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outDir = path.join(CONVERTED_DIR, jobId);
  const errors = [];

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

app.post('/api/convert/mathtype-mtef', async (req, res) => {
  const validation = validateMtefBatch(req.body);
  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      code: validation.code,
      equations: []
    });
  }

  try {
    const result = await translateMtefBatch(validation.equations);
    console.log('[MATHTYPE_TRANSLATE][complete]', {
      requested: validation.equations.length,
      translated: result.equations.filter(row => row.ok).length
    });
    return res.json(result);
  } catch (error) {
    console.error('[MATHTYPE_TRANSLATE][error]', {
      requested: validation.equations.length,
      message: error?.message || String(error)
    });
    return res.status(500).json({
      ok: false,
      code: 'MATHTYPE_TRANSLATION_FAILED',
      error: error?.message || String(error),
      equations: []
    });
  }
});

app.post('/api/convert/docx-to-pdf', upload.single('file'), async (req, res) => {
  const uploaded = req.file;

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

    const pdfPath = await convertDocxToPdf(uploaded.path);
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
      message: error?.message || String(error),
      stack: error?.stack,
      file: uploaded?.originalname,
      path: uploaded?.path
    });

    res.status(500).json({
      ok: false,
      error: error.message || String(error),
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
    if (uploaded?.path) {
      fsp.unlink(uploaded.path).catch(() => {});
    }
  }
});

app.listen(PORT, () => {
  console.log(`[qisi-local-server] running at http://localhost:${PORT}`);
  console.log(`[qisi-local-server] open http://localhost:${PORT}/main.html`);
  console.log(`[qisi-local-server] health check: http://localhost:${PORT}/api/health`);
  console.log(`[qisi-local-server] converter self-test: http://localhost:${PORT}/api/convert/self-test`);
  console.log(`[qisi-local-server] converter mode: ${CONVERTER_MODE}`);
  console.log('[qisi-local-server] LibreOffice candidates:');
  findLibreOfficeExecutable().forEach(p => console.log(`  - ${p}`));
});
