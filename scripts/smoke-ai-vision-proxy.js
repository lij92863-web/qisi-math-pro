'use strict';

const BASE_URL = String(
  process.env.QISI_BASE_URL ||
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

const MODEL = String(
  process.env.QISI_VISION_MODEL ||
  'qwen-vl-ocr-latest'
);

const TEST_IMAGE =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQ' +
  'CAYAAAAf8/9hAAAAFklEQVR4nGP4TyFg' +
  'GDVg1IBRA4aLAQBdePwur/3haQAAAABJ' +
  'RU5ErkJggg==';

async function main() {
  const response = await fetch(
    `${BASE_URL}/api/ai/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: TEST_IMAGE
                }
              },
              {
                type: 'text',
                text: '只回复 OK'
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 8
      })
    }
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `视觉代理失败：HTTP ${response.status} ` +
      `${text.slice(0, 1000)}`
    );
  }

  console.log(
    '[AI_VISION_PROXY_SMOKE][passed]',
    {
      model: MODEL,
      status: response.status,
      preview: text.slice(0, 300)
    }
  );
}

main().catch(error => {
  console.error(
    '[AI_VISION_PROXY_SMOKE][failed]',
    error
  );

  process.exitCode = 1;
});
