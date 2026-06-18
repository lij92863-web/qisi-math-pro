const BASE_URL = String(process.env.QISI_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function readJson(resp) {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

async function postJson(path, body) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await readJson(resp);
  return { resp, data };
}

function assertOk(name, resp, data) {
  if (resp.ok) {
    console.log(`[AI_PROXY_SMOKE] ${name}: HTTP ${resp.status}`);
    return;
  }

  const detail = data?.code || data?.error || data?.message || resp.statusText || 'unknown error';
  throw new Error(`${name} failed: HTTP ${resp.status} ${detail}`);
}

async function main() {
  const healthResp = await fetch(`${BASE_URL}/api/ai/health`);
  const health = await readJson(healthResp);
  assertOk('health', healthResp, health);

  if (!health?.configured) {
    throw new Error('health failed: DASHSCOPE_NOT_CONFIGURED');
  }

  const chat = await postJson('/api/ai/chat', {
    model: 'qwen-plus',
    messages: [{ role: 'user', content: 'Reply with OK only.' }],
    temperature: 0,
    max_tokens: 8
  });
  assertOk('chat', chat.resp, chat.data);

  const ocr = await postJson('/api/ai/ocr', {
    model: 'qwen-vl-ocr-latest',
    input: {
      messages: [{
        role: 'user',
        content: [{ image: TINY_PNG_DATA_URL }]
      }]
    },
    parameters: {
      max_tokens: 64,
      ocr_options: { task: 'advanced_recognition' }
    }
  });
  assertOk('ocr', ocr.resp, ocr.data);

  console.log('[AI_PROXY_SMOKE] success');
}

main().catch(error => {
  console.error('[AI_PROXY_SMOKE] failed:', error?.message || String(error));
  process.exitCode = 1;
});
