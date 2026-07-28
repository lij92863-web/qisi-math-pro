(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.StartupGuard = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (root.document && typeof root.addEventListener === 'function') {
        api.install({
            root,
            document: root.document,
            timeoutMs: root.__TEX_STARTUP_TIMEOUT_MS__
        });
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const DEFAULT_TIMEOUT_MS = 15_000;
        const ROOT_ID = 'app';
        const SHELL_ID = 'tex-startup-shell';
        const TITLE_ID = 'tex-startup-title';
        const MESSAGE_ID = 'tex-startup-message';
        const DETAIL_ID = 'tex-startup-detail';
        const RETRY_ID = 'tex-startup-retry';

        let activeController = null;

        const cleanMessage = value => String(value || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);

        const assetNameFromUrl = value => {
            const withoutQuery = String(value || '').split(/[?#]/, 1)[0];
            const parts = withoutQuery.split(/[\\/]/).filter(Boolean);
            return parts.at(-1) || '未知资源';
        };

        const normalizeFailure = (input, metadata = {}) => {
            const source = input && typeof input === 'object'
                ? input
                : { message: input };
            const code = cleanMessage(metadata.code || source.code || 'STARTUP_FAILED');
            const title = cleanMessage(
                metadata.title
                || source.title
                || 'TEX题库启动失败'
            );
            const message = cleanMessage(
                metadata.message
                || source.message
                || '启动过程中发生未知错误。'
            );

            return Object.freeze({
                code,
                title,
                message,
                detail: cleanMessage(metadata.detail || source.detail || '')
            });
        };

        const describeWindowError = event => {
            const target = event?.target;
            const tagName = String(target?.tagName || '').toLowerCase();

            if (tagName === 'script' || tagName === 'link') {
                const assetUrl = target?.src || target?.href || '';
                const assetName = assetNameFromUrl(assetUrl);
                return normalizeFailure({
                    code: 'RESOURCE_LOAD_FAILED',
                    title: 'TEX题库启动资源加载失败',
                    message: `关键文件“${assetName}”未能加载。`,
                    detail: '请确认本地服务已完全启动，然后重新加载页面。'
                });
            }

            return normalizeFailure(event?.error || event?.message, {
                code: 'STARTUP_SCRIPT_ERROR',
                title: 'TEX题库启动脚本异常',
                detail: '错误已被启动守卫截获，页面未继续空白显示。'
            });
        };

        const describeUnhandledRejection = event => normalizeFailure(
            event?.reason,
            {
                code: 'STARTUP_PROMISE_REJECTION',
                title: 'TEX题库启动任务异常',
                detail: '异步启动任务未能完成，请重新加载页面。'
            }
        );

        const setNodeText = (document, id, value) => {
            const node = document.getElementById(id);
            if (node) node.textContent = value;
        };

        const createFallbackShell = document => {
            const mountRoot = document.getElementById(ROOT_ID);
            if (!mountRoot) return null;

            const mountedUi = mountRoot.querySelector('aside.sidebar, main');
            if (mountedUi) return null;

            const shell = document.createElement('section');
            shell.id = SHELL_ID;
            shell.setAttribute('role', 'alert');
            shell.setAttribute('aria-live', 'assertive');
            shell.style.cssText = [
                'min-height:100vh',
                'display:grid',
                'place-items:center',
                'padding:32px',
                'box-sizing:border-box',
                'background:#f6f8fc',
                'font-family:Arial,"Microsoft YaHei",sans-serif',
                'color:#1f2937'
            ].join(';');
            shell.innerHTML = [
                '<div style="width:min(520px,100%);padding:30px;border:1px solid #dbe3ef;border-radius:18px;background:#fff;box-shadow:0 18px 50px rgba(31,41,55,.10)">',
                '<strong id="tex-startup-title" style="display:block;font-size:22px;line-height:1.4">TEX题库启动失败</strong>',
                '<p id="tex-startup-message" style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#475569"></p>',
                '<p id="tex-startup-detail" style="margin:10px 0 0;font-size:13px;line-height:1.7;color:#64748b"></p>',
                '<button id="tex-startup-retry" type="button" style="margin-top:20px;padding:10px 18px;border:0;border-radius:10px;background:#1a73e8;color:#fff;font-size:14px;font-weight:700;cursor:pointer">重新加载</button>',
                '</div>'
            ].join('');
            mountRoot.replaceChildren(shell);
            return shell;
        };

        const renderFailure = (document, root, failure) => {
            const mountRoot = document.getElementById(ROOT_ID);
            if (!mountRoot) return false;

            let shell = document.getElementById(SHELL_ID);
            if (!shell) shell = createFallbackShell(document);
            if (!shell) return false;

            shell.dataset.startupState = 'failed';
            shell.setAttribute('aria-busy', 'false');
            shell.setAttribute('role', 'alert');
            setNodeText(document, TITLE_ID, failure.title);
            setNodeText(document, MESSAGE_ID, failure.message);
            setNodeText(document, DETAIL_ID, failure.detail || `错误代码：${failure.code}`);

            const retry = document.getElementById(RETRY_ID);
            if (retry) {
                retry.hidden = false;
                retry.style.display = 'inline-flex';
                retry.onclick = () => root.location?.reload();
            }

            return true;
        };

        const normalizeTimeout = value => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed < 20) return DEFAULT_TIMEOUT_MS;
            return Math.min(parsed, 120_000);
        };

        const install = ({
            root = globalThis,
            document = root.document,
            timeoutMs = DEFAULT_TIMEOUT_MS
        } = {}) => {
            if (!root || !document) return null;
            if (root.__texStartupGuardController) {
                activeController = root.__texStartupGuardController;
                return activeController;
            }

            let pendingFailure = null;
            let watchdogId = null;
            let disposed = false;

            const flush = () => {
                if (disposed || !pendingFailure) return false;
                return renderFailure(document, root, pendingFailure);
            };

            const fail = (input, metadata = {}) => {
                if (!pendingFailure) {
                    pendingFailure = normalizeFailure(input, metadata);
                }
                flush();
                return true;
            };

            const onError = event => fail(describeWindowError(event));
            const onRejection = event => fail(describeUnhandledRejection(event));
            const armWatchdog = () => {
                flush();
                watchdogId = root.setTimeout(() => {
                    const shell = document.getElementById(SHELL_ID);
                    const mountRoot = document.getElementById(ROOT_ID);
                    const mountedUi = mountRoot?.querySelector('aside.sidebar, main');
                    if (shell || (mountRoot && !mountedUi)) {
                        fail({
                            code: 'STARTUP_TIMEOUT',
                            title: 'TEX题库启动超时',
                            message: '本地服务已打开页面，但应用没有在规定时间内完成启动。',
                            detail: '请关闭重复的题库服务进程后重试；若问题持续，请查看服务日志。'
                        });
                    }
                }, normalizeTimeout(timeoutMs));
            };

            root.addEventListener('error', onError, true);
            root.addEventListener('unhandledrejection', onRejection);
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', armWatchdog, { once: true });
            } else {
                armWatchdog();
            }

            const controller = Object.freeze({
                fail,
                flush,
                dispose() {
                    disposed = true;
                    if (watchdogId !== null) root.clearTimeout(watchdogId);
                    root.removeEventListener('error', onError, true);
                    root.removeEventListener('unhandledrejection', onRejection);
                }
            });

            root.__texStartupGuardController = controller;
            activeController = controller;
            return controller;
        };

        const fail = (input, metadata = {}) => activeController
            ? activeController.fail(input, metadata)
            : false;

        return Object.freeze({
            DEFAULT_TIMEOUT_MS,
            assetNameFromUrl,
            normalizeFailure,
            describeWindowError,
            describeUnhandledRejection,
            install,
            fail
        });
    }
);
