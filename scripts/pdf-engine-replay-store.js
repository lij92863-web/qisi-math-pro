const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const stableJson = value => {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

const collectPromptText = requestBody => {
    const messages = requestBody?.messages || requestBody?.input?.messages || [];
    return messages.flatMap(message => {
        const content = message?.content;
        if (typeof content === 'string') return [content];
        return (Array.isArray(content) ? content : []).map(part =>
            typeof part === 'string' ? part : String(part?.text || part?.content || '')
        );
    }).filter(Boolean).join('\n');
};

const collectImagePayloads = requestBody => {
    const messages = requestBody?.messages || requestBody?.input?.messages || [];
    const values = [];
    messages.forEach(message => {
        const content = Array.isArray(message?.content) ? message.content : [];
        content.forEach(part => {
            const value = part?.image_url?.url || part?.image || '';
            if (value) values.push(String(value));
        });
    });
    return values;
};

const redactRequestBody = requestBody => {
    const clone = JSON.parse(JSON.stringify(requestBody || {}));
    const messages = clone.messages || clone.input?.messages || [];
    messages.forEach(message => {
        if (!Array.isArray(message?.content)) return;
        message.content.forEach(part => {
            if (part?.image_url?.url) {
                const value = String(part.image_url.url);
                part.image_url.url = `[redacted-image sha256=${sha256(value)} bytes=${Buffer.byteLength(value)}]`;
            }
            if (part?.image) {
                const value = String(part.image);
                part.image = `[redacted-image sha256=${sha256(value)} bytes=${Buffer.byteLength(value)}]`;
            }
        });
    });
    return clone;
};

const buildReplayMetadata = ({
    requestBody,
    sourceFileSha256,
    page,
    renderDpi = 144,
    promptVersion = 'pdf-math-region-r1',
    requestSchemaVersion = 'qisi-ai-proxy-r1',
    endpoint = ''
} = {}) => {
    const prompt = collectPromptText(requestBody);
    const imagePayloads = collectImagePayloads(requestBody);
    const model = String(requestBody?.model || '');
    const fingerprint = {
        sourceFileSha256: String(sourceFileSha256 || ''),
        page: Math.max(0, Number(page) || 0),
        renderDpi: Number(renderDpi) || 144,
        model,
        promptVersion,
        promptSha256: sha256(prompt),
        imageSha256: imagePayloads.map(sha256),
        requestSchemaVersion,
        endpoint
    };
    return {
        cacheKey: sha256(stableJson(fingerprint)),
        ...fingerprint,
        request: redactRequestBody(requestBody)
    };
};

const rebuildReplayCacheKey = metadataValue => {
    const metadata = metadataValue || {};
    const fingerprint = {
        sourceFileSha256: String(metadata.sourceFileSha256 || ''),
        page: Math.max(0, Number(metadata.page) || 0),
        renderDpi: Number(metadata.renderDpi) || 144,
        model: String(metadata.model || ''),
        promptVersion: String(metadata.promptVersion || ''),
        promptSha256: String(metadata.promptSha256 || ''),
        imageSha256: Array.isArray(metadata.imageSha256) ? metadata.imageSha256.map(String) : [],
        requestSchemaVersion: String(metadata.requestSchemaVersion || ''),
        endpoint: String(metadata.endpoint || '')
    };
    return sha256(stableJson(fingerprint));
};

const saveReplayEntry = ({ directory, metadata, responseBody, capturedAt = new Date().toISOString() }) => {
    if (!directory || !metadata?.cacheKey) throw new Error('Replay directory and cacheKey are required');
    fs.mkdirSync(directory, { recursive: true });
    const responseText = typeof responseBody === 'string'
        ? responseBody
        : JSON.stringify(responseBody);
    const payload = {
        schemaVersion: 'pdf-engine-replay-r1',
        capturedAt,
        metadata,
        responseSha256: sha256(responseText),
        response: JSON.parse(responseText)
    };
    const outputPath = path.join(directory, `${metadata.cacheKey}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return outputPath;
};

const loadReplayEntries = directory => {
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
        .filter(name => name.endsWith('.json'))
        .map(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));
};

module.exports = {
    buildReplayMetadata,
    collectImagePayloads,
    collectPromptText,
    loadReplayEntries,
    rebuildReplayCacheKey,
    redactRequestBody,
    saveReplayEntry,
    sha256,
    stableJson
};
