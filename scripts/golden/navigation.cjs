'use strict';

// Evidence only: never reloads, evaluates application code, or retries work.
function safeUrl(value) {
    try {
        const url = new URL(value);
        return /^https?:$/.test(url.protocol) ? url.origin + url.pathname : url.protocol;
    } catch { return ''; }
}

function stackTrace(stack, depth = 0) {
    if (!stack || depth > 2) return undefined;
    return {
        callFrames: (stack.callFrames || []).slice(0, 10).map(frame => ({
            functionName: frame.functionName, url: safeUrl(frame.url),
            lineNumber: frame.lineNumber, columnNumber: frame.columnNumber
        })),
        ...(stack.parent && depth < 2 ? { parent: stackTrace(stack.parent, depth + 1) } : {})
    };
}

function createNavigationRecorder(session, { maxEvents = 200, now = Date.now } = {}) {
    if (!Number.isSafeInteger(maxEvents) || maxEvents < 1) throw new Error('NAVIGATION_TRACE_LIMIT_INVALID');
    const events = [], subscriptions = [];
    let sequence = 0, droppedEvents = 0;
    const record = (kind, data) => {
        events.push({ sequence: ++sequence, at: now(), kind, ...data });
        if (events.length > maxEvents) { events.shift(); droppedEvents++; }
    };
    const on = (name, project) => {
        const handler = data => { const result = project(data); if (result) record(name, result); };
        subscriptions.push([name, handler]);
        session.on(name, handler);
    };
    on('Page.frameRequestedNavigation', event => ({ frameId: event.frameId, reason: event.reason, disposition: event.disposition, url: safeUrl(event.url) }));
    on('Page.frameScheduledNavigation', event => ({ frameId: event.frameId, reason: event.reason, delay: event.delay, url: safeUrl(event.url) }));
    on('Page.frameNavigated', ({ frame, type }) => ({ frameId: frame.id, parentId: frame.parentId, loaderId: frame.loaderId, url: safeUrl(frame.url), type }));
    on('Page.navigatedWithinDocument', event => ({ frameId: event.frameId, navigationType: event.navigationType, url: safeUrl(event.url) }));
    for (const name of ['Page.frameStartedLoading', 'Page.frameStoppedLoading']) on(name, event => ({ frameId: event.frameId }));
    on('Runtime.executionContextCreated', ({ context }) => ({ executionContextId: context.id, executionContextUniqueId: context.uniqueId, origin: safeUrl(context.origin), frameId: context.auxData?.frameId, isDefault: context.auxData?.isDefault, type: context.auxData?.type }));
    on('Runtime.executionContextDestroyed', event => ({ executionContextId: event.executionContextId, executionContextUniqueId: event.executionContextUniqueId }));
    on('Runtime.executionContextsCleared', () => ({}));
    on('Inspector.targetCrashed', () => ({}));
    const request = event => {
        if (event.type !== 'Document') return;
        record('Network.documentRequest', {
            requestId: event.requestId, frameId: event.frameId, loaderId: event.loaderId,
            url: safeUrl(event.request.url), method: event.request.method,
            initiator: { type: event.initiator?.type, stack: stackTrace(event.initiator?.stack) }
        });
    };
    session.on('Network.requestWillBeSent', request);
    subscriptions.push(['Network.requestWillBeSent', request]);
    return Object.freeze({
        async start() { await Promise.all(['Page.enable', 'Network.enable', 'Runtime.enable'].map(name => session.send(name))); },
        snapshot() { return JSON.parse(JSON.stringify({ schema: 'qisi.browser-navigation.v1', maxEvents, droppedEvents, events })); },
        // The owning browser context disposes the CDP session. This only removes
        // this recorder's subscriptions and cannot navigate or close the page.
        stop() { for (const [name, handler] of subscriptions.splice(0)) session.off(name, handler); }
    });
}

module.exports = { createNavigationRecorder };
