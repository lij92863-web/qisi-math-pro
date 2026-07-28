import { CompilerClient } from './compiler-client.mjs';
import { buildProofDocument } from './proof-document.mjs';

const elements = {
    compileButton: document.querySelector('[data-action="compile-proof"]'),
    invalidButton: document.querySelector('[data-action="compile-invalid"]'),
    downloadButton: document.querySelector('[data-action="download"]'),
    state: document.querySelector('[data-role="state"]'),
    detail: document.querySelector('[data-role="detail"]'),
    metrics: document.querySelector('[data-role="metrics"]'),
    diagnostics: document.querySelector('[data-role="diagnostics"]'),
    preview: document.querySelector('[data-role="preview"]')
};

let sequence = 0;
let activePdfUrl = '';
let activePdfBytes = null;

const workerUrl = new URL('./compiler-worker.mjs', import.meta.url);
const client = new CompilerClient(workerUrl, {
    onProgress(message) {
        elements.detail.textContent = message.detail;
    }
});

const setBusy = busy => {
    elements.compileButton.disabled = busy;
    elements.invalidButton.disabled = busy;
    document.body.dataset.busy = busy ? 'true' : 'false';
};

const clearPdf = () => {
    if (activePdfUrl) URL.revokeObjectURL(activePdfUrl);
    activePdfUrl = '';
    activePdfBytes = null;
    elements.preview.removeAttribute('src');
    elements.downloadButton.disabled = true;
};

const renderDiagnostics = diagnostics => {
    elements.diagnostics.replaceChildren();
    if (!diagnostics?.length) {
        const item = document.createElement('li');
        item.className = 'diagnostic diagnostic--ok';
        item.textContent = '无编译错误。';
        elements.diagnostics.appendChild(item);
        return;
    }
    for (const diagnostic of diagnostics) {
        const item = document.createElement('li');
        item.className = `diagnostic diagnostic--${diagnostic.severity}`;
        item.textContent = diagnostic.display;
        elements.diagnostics.appendChild(item);
    }
};

const renderMetrics = metrics => {
    const sizeKb = Math.round((metrics.pdfBytes || 0) / 1024);
    elements.metrics.textContent = [
        `初始化 ${metrics.initMs || 0}ms`,
        `编译 ${metrics.compileMs || 0}ms`,
        `PDF ${sizeKb}KB`
    ].join(' · ');
};

async function runCompile({ invalidFormula }) {
    setBusy(true);
    clearPdf();
    renderDiagnostics([]);
    elements.state.dataset.state = 'working';
    elements.state.textContent = invalidFormula ? '验证失败关闭策略' : '正在编译';
    elements.detail.textContent = '正在建立受控文档模型';
    elements.metrics.textContent = '';

    const proof = buildProofDocument({ invalidFormula });
    const requestId = `h1-${++sequence}`;

    try {
        const response = await client.compile({
            requestId,
            source: proof.source,
            lineMap: proof.lineMap
        });
        const pdfBytes = new Uint8Array(response.pdfBytes);
        activePdfBytes = pdfBytes;
        activePdfUrl = URL.createObjectURL(new Blob([pdfBytes], {
            type: 'application/pdf'
        }));
        elements.preview.src = `${activePdfUrl}#view=FitH`;
        elements.downloadButton.disabled = false;
        elements.state.dataset.state = 'ready';
        elements.state.textContent = '编译成功';
        elements.detail.textContent = '正式预览与下载共享同一份 PDF 字节';
        renderMetrics(response.metrics);
        renderDiagnostics(response.diagnostics);
    } catch (error) {
        clearPdf();
        elements.state.dataset.state = 'failed';
        elements.state.textContent = '编译已阻止';
        elements.detail.textContent = error.message;
        renderDiagnostics(error.diagnostics);
    } finally {
        setBusy(false);
    }
}

elements.compileButton.addEventListener('click', () => runCompile({
    invalidFormula: false
}));
elements.invalidButton.addEventListener('click', () => runCompile({
    invalidFormula: true
}));
elements.downloadButton.addEventListener('click', () => {
    if (!activePdfUrl || !activePdfBytes) return;
    const link = document.createElement('a');
    link.href = activePdfUrl;
    link.download = 'TEX题库-H1-Typst验证.pdf';
    link.click();
});

window.addEventListener('beforeunload', () => {
    clearPdf();
    client.dispose();
}, { once: true });

window.__TEX_H1_PROOF__ = Object.freeze({
    compileValid: () => runCompile({ invalidFormula: false }),
    compileInvalid: () => runCompile({ invalidFormula: true }),
    hasPdf: () => Boolean(activePdfBytes),
    pdfByteLength: () => activePdfBytes?.byteLength || 0,
    copyPdfBytes: () => activePdfBytes?.slice() || new Uint8Array()
});

runCompile({ invalidFormula: false });
