'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function validateEquations(body) {
    const rows = body?.equations;
    if (!Array.isArray(rows) || !rows.length || rows.length > 512) return false;
    const ids = new Set();
    return rows.every(row => {
        if (!/^[\w./:-]{1,180}$/.test(row?.id || '') || ids.has(row.id) ||
            typeof row.mtefBase64 !== 'string' || row.mtefBase64.length > 350000 ||
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(row.mtefBase64)) return false;
        ids.add(row.id);
        const bytes = Buffer.from(row.mtefBase64, 'base64');
        return bytes.length >= 6 && bytes[0] === 5;
    });
}

function createNativeTranslator(root) {
    let tail = Promise.resolve();
    let unavailable = '';
    const failed = (rows, code) => ({ ok: false, code,
        equations: rows.map(row => ({ id: row.id, ok: false, code, latex: '' })) });

    async function invoke(rows) {
        if (unavailable) return failed(rows, unavailable);
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-mtef-'));
        const input = path.join(dir, 'input.json'), output = path.join(dir, 'output.json');
        try {
            await fs.writeFile(input, JSON.stringify({ equations: rows }));
            const status = await new Promise(resolve => {
                const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive',
                    '-ExecutionPolicy', 'Bypass', '-File',
                    path.join(root, 'tools/translate-mathtype-mtef.ps1'),
                    '-InputPath', input, '-OutputPath', output],
                { cwd: root, windowsHide: true, stdio: 'ignore' });
                const timer = setTimeout(() => { child.kill(); resolve('MATHTYPE_NATIVE_TIMEOUT'); }, 20000);
                child.once('error', () => { clearTimeout(timer); resolve('MATHTYPE_NATIVE_UNAVAILABLE'); });
                child.once('exit', code => { clearTimeout(timer); resolve(code === 0 ? '' : 'MATHTYPE_NATIVE_FAILED'); });
            });
            let payload;
            try { payload = JSON.parse(await fs.readFile(output, 'utf8')); }
            catch { payload = { equations: [] }; }
            const byId = new Map(), expected = new Set(rows.map(row => row.id));
            for (const row of payload.equations || []) {
                if (!expected.has(row.id) || byId.has(row.id)) return failed(rows, 'MATHTYPE_RESPONSE_ID_MISMATCH');
                byId.set(row.id, row);
            }
            if (status) unavailable = status;
            const equations = rows.map(row => {
                const result = byId.get(row.id);
                return result?.ok === true && typeof result.latex === 'string'
                    ? { id: row.id, ok: true, code: 'MATHTYPE_LATEX_OK', latex: result.latex }
                    : { id: row.id, ok: false, code: status || 'MATHTYPE_TRANSLATION_FAILED', latex: '' };
            });
            return { ok: equations.every(row => row.ok), equations };
        } finally {
            // Only the two exact files created for this invocation are removed.
            await fs.unlink(input).catch(() => {});
            await fs.unlink(output).catch(() => {});
            await fs.rmdir(dir).catch(() => {});
        }
    }
    return rows => {
        const pending = tail.then(() => invoke(rows));
        tail = pending.catch(() => {});
        return pending;
    };
}

module.exports = { validateEquations, createNativeTranslator };
