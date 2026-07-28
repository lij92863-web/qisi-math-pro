import { WORKER_MESSAGE } from './runtime-contract.mjs';

const DEFAULT_TIMEOUT_MS = 120_000;

export class CompilerClient {
    constructor(workerUrl, { timeoutMs = DEFAULT_TIMEOUT_MS, onProgress = () => {} } = {}) {
        this.worker = new Worker(workerUrl, { type: 'module', name: 'tex-h1-typst-compiler' });
        this.timeoutMs = timeoutMs;
        this.onProgress = onProgress;
        this.pending = new Map();
        this.worker.addEventListener('message', event => this.handleMessage(event.data));
        this.worker.addEventListener('error', event => this.failAll(
            new Error(event.message || 'Typst Worker 启动失败')
        ));
    }

    compile(request) {
        if (this.pending.has(request.requestId)) {
            return Promise.reject(new Error(`重复的编译请求：${request.requestId}`));
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(request.requestId);
                reject(new Error(`Typst 编译超过 ${this.timeoutMs}ms，已停止等待。`));
            }, this.timeoutMs);

            this.pending.set(request.requestId, { resolve, reject, timer });
            this.worker.postMessage({
                type: WORKER_MESSAGE.compile,
                ...request
            });
        });
    }

    handleMessage(message) {
        if (message?.type === WORKER_MESSAGE.progress) {
            this.onProgress(message);
            return;
        }

        const pending = this.pending.get(message?.requestId);
        if (!pending) return;

        clearTimeout(pending.timer);
        this.pending.delete(message.requestId);
        if (message.type === WORKER_MESSAGE.compiled) {
            pending.resolve(message);
            return;
        }

        const error = new Error(message?.error || 'Typst 编译失败');
        error.diagnostics = Array.isArray(message?.diagnostics)
            ? message.diagnostics
            : [];
        pending.reject(error);
    }

    failAll(error) {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
    }

    dispose() {
        this.failAll(new Error('Typst Worker 已关闭'));
        this.worker.terminate();
    }
}
