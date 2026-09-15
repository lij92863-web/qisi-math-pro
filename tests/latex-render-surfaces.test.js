const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');

const NAV_LIBRARY = '\u9898\u5e93\u4e0e\u68c0\u7d22';
const NAV_EXAM = '\u667a\u80fd\u7ec4\u5377\u53f0';
const NAV_ENTRY = '\u65b0\u9898\u76ee\u5f55\u5165';
const TAB_STEM = '\u9898\u5e72';
const SEARCH_PLACEHOLDER = '\u641c\u7d22\u9898\u5e72\u3001\u7b54\u6848\u3001\u89e3\u6790';
const REVEAL_ANSWER = '\u89e3\u6790';
const PICK_QUESTION = '\u9009\u9898';
const PRINT_BUTTON = '\u6253\u5370 PDF';

const STEM = [
    '\u8bbe\u96c6\u5408 $A=\\{x\\mid x^2-3x+2\\le 0\\}$\uff0c\u5219',
    '$$\\frac{1330\\sqrt{2}}{3}\\pi$$',
    '\u4e0e $\\left\\{\\begin{array}{l} x+1 \\\\ y-2 \\end{array}\\right.$ \u7684\u5173\u7cfb\u662f\uff08\uff09'
].join('\n');

const OPTIONS = [
    '$x\\in(0,+\\infty)$',
    '$\\frac{1}{2}$',
    '$\\sqrt{3}$',
    '$\\begin{cases} x=1 \\\\ y=2 \\end{cases}$'
];

const ANSWER = '\u9009 B\uff1a$B=\\left\\{x\\mid \\frac{1}{2}<x<2\\right\\}$';
const SOLUTION = [
    '\u7531 $x^2-3x+2\\le 0$ \u5f97 $1\\le x\\le 2$\uff0c\u6545 $A=[1,2]$\u3002',
    '$$\\begin{aligned} B&=\\left(\\frac{1}{2},2\\right) \\\\\\ A\\cap B&=[1,2) \\end{aligned}$$',
    '\u6240\u4ee5\u9009 B\u3002\u6ce8\u610f $\\angle ABC=90^\\circ$ \u65f6 $\\sin\\theta=\\frac{\\sqrt{3}}{2}$\u3002'
].join('\n');

function reserveLoopbackPort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.unref();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const address = probe.address();
            const port = address && typeof address === 'object' ? address.port : 0;
            probe.close(error => error ? reject(error) : resolve(port));
        });
    });
}

async function waitForServer(origin, child) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error('local server exited before startup');
        try {
            const response = await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1_000) });
            if (response.ok) return;
        } catch (_) {
            // bounded readiness loop
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('local server did not become ready');
}

// Raw LaTeX that reached a user-visible text node means the surface showed source code
// instead of a formula. KaTeX's hidden MathML annotation is the one place that keeps the
// original TeX on purpose, so it is excluded.
async function inspectSurface(page, selector) {
    return page.evaluate(rootSelector => {
        const root = document.querySelector(rootSelector);
        if (!root) return { missingRoot: rootSelector };
        const suspect = /\\(?:frac|dfrac|sqrt|sum|prod|int|lim|left|right|begin\{|overline|vec|angle|because|therefore|in\b|notin|subset|cup|cap)|鈭|蟺|\$\$|\\\(|\\\[|\\\)|\\\]/u;
        const leaks = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const parent = node.parentElement;
            if (parent && !parent.closest('.katex-mathml, annotation, script, style, textarea, input')) {
                const value = String(node.nodeValue || '').trim();
                if (value && suspect.test(value)) {
                    leaks.push({
                        text: value.slice(0, 100),
                        className: String(parent.className || '').slice(0, 60)
                    });
                }
            }
            node = walker.nextNode();
        }
        return {
            katex: root.querySelectorAll('.katex').length,
            displayMath: root.querySelectorAll('.katex-display').length,
            katexErrors: root.querySelectorAll('.katex-error').length,
            katexErrorText: [...root.querySelectorAll('.katex-error')]
                .map(element => element.textContent.trim().slice(0, 80)),
            leaks
        };
    }, selector);
}

test('every main-page surface renders math instead of showing LaTeX source', {
    timeout: 120_000
}, async () => {
    const port = await reserveLoopbackPort();
    const origin = 'http://127.0.0.1:' + port;
    const serverOutput = [];
    const server = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
    });
    server.stdout.on('data', chunk => serverOutput.push(chunk.toString()));
    server.stderr.on('data', chunk => serverOutput.push(chunk.toString()));

    let browser;
    try {
        await waitForServer(origin, server);
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (['http:', 'https:'].includes(url.protocol) && url.origin !== origin) {
                return route.abort('blockedbyclient');
            }
            return route.continue();
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));

        await page.goto(origin + '/main.html', { waitUntil: 'domcontentloaded' });
        const navigation = page.locator('aside.sidebar nav');
        await navigation.waitFor({ state: 'visible' });

        await page.evaluate(async fixture => {
            const database = window.Qisi.Database.getDatabase();
            await database.questions.clear();
            const stamp = Date.now();
            await database.questions.put({
                id: 'latex-surface-question',
                createdAt: stamp,
                updatedAt: stamp,
                grade: '\u9ad8\u4e8c',
                type: '\u5355\u9009\u9898',
                diff: '\u4e2d\u7b49',
                systemKnowledge: '\u96c6\u5408',
                knowledge: '\u96c6\u5408',
                personalKnowledge: '',
                stem: fixture.stem,
                options: fixture.options,
                answer: fixture.answer,
                solution: fixture.solution,
                images: []
            });
        }, { stem: STEM, options: OPTIONS, answer: ANSWER, solution: SOLUTION });

        await page.reload({ waitUntil: 'domcontentloaded' });
        await navigation.waitFor({ state: 'visible' });

        // Surface 0: the entry page's live "complete layout preview".
        await navigation.getByRole('button', { name: NAV_ENTRY, exact: true }).click();
        const entryRoot = page.locator('.entry-layout');
        await entryRoot.waitFor({ state: 'visible' });
        await entryRoot.getByRole('button', { name: TAB_STEM, exact: true }).click();
        await entryRoot.locator('textarea.textarea-code').fill(STEM);
        await entryRoot.locator('.entry-question-preview .katex').first()
            .waitFor({ state: 'attached', timeout: 20_000 });
        const entryReport = await inspectSurface(page, '.entry-question-preview');

        // Surface 1: library question card, including the revealed answer and solution.
        await navigation.getByRole('button', { name: NAV_LIBRARY, exact: true }).click();
        const libraryRoot = page.locator('.library-layout');
        await libraryRoot.waitFor({ state: 'visible' });
        await libraryRoot.getByPlaceholder(SEARCH_PLACEHOLDER, { exact: true }).fill('x^2-3x+2');
        const card = libraryRoot.locator('.question-card').first();
        await card.waitFor({ state: 'visible', timeout: 20_000 });
        await card.getByRole('button', { name: REVEAL_ANSWER, exact: true }).click();
        await card.locator('.katex').first().waitFor({ state: 'attached', timeout: 20_000 });
        const libraryReport = await inspectSurface(page, '.library-layout');

        // Surface 2: exam builder after the question is added to the cart.
        await card.getByRole('button', { name: PICK_QUESTION, exact: true }).click();
        await navigation.getByRole('button', { name: NAV_EXAM, exact: true }).click();
        const examRoot = page.locator('.exam-builder');
        await examRoot.waitFor({ state: 'visible' });
        await examRoot.locator('.katex').first().waitFor({ state: 'attached', timeout: 20_000 });
        const examReport = await inspectSurface(page, '.exam-builder');

        // Surface 3: the print document. It is produced by a second renderer
        // (renderLatexForPrint + A4ExamTemplate), so it is checked separately from the
        // in-page preview surfaces.
        await page.evaluate(() => {
            window.__qisiPrintHtml = [];
            const original = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => {
                try {
                    if (String(blob?.type || '').includes('html')) {
                        blob.text().then(text => window.__qisiPrintHtml.push(text));
                    }
                } catch (_) {
                    // capture is best effort
                }
                return original(blob);
            };
        });
        await page.locator('.exam-builder')
            .getByRole('button', { name: PRINT_BUTTON, exact: true }).click();
        await page.waitForFunction(
            () => (window.__qisiPrintHtml || []).some(text => /<html|<!DOCTYPE/i.test(text)),
            null,
            { timeout: 30_000 }
        );
        const printReport = await page.evaluate(() => {
            const html = (window.__qisiPrintHtml || []).find(text => /<html|<!DOCTYPE/i.test(text)) || '';
            const document_ = new DOMParser().parseFromString(html, 'text/html');
            document_.querySelectorAll('.katex-mathml, annotation').forEach(node => node.remove());
            const suspect = /\\(?:frac|sqrt|left|right|begin\{|\$)|鈭|蟺|\$\$/u;
            const leaks = [];
            const walker = document_.createTreeWalker(document_.body, NodeFilter.SHOW_TEXT);
            let node = walker.nextNode();
            while (node) {
                const value = String(node.nodeValue || '').trim();
                if (value && suspect.test(value)) leaks.push(value.slice(0, 100));
                node = walker.nextNode();
            }
            return {
                katex: document_.querySelectorAll('.katex').length,
                displayMath: document_.querySelectorAll('.katex-display').length,
                katexErrors: document_.querySelectorAll('.katex-error').length,
                leaks,
                bytes: html.length
            };
        });

        // Control: the detector must be able to see raw LaTeX, otherwise a passing result
        // would prove nothing.
        await page.evaluate(() => {
            const control = document.createElement('div');
            control.className = 'detector-control';
            control.textContent = 'RAW \\frac{1}{2} and $$x$$';
            document.querySelector('.library-layout').appendChild(control);
        });
        const controlReport = await inspectSurface(page, '.library-layout');
        await page.evaluate(() => document.querySelector('.detector-control')?.remove());
        assert.ok(
            (controlReport.leaks || []).length >= 1,
            'the raw-LaTeX detector cannot see raw LaTeX: ' + JSON.stringify(controlReport)
        );

        const report = {
            entry: entryReport,
            library: libraryReport,
            exam: examReport,
            print: printReport,
            pageErrors
        };
        const problems = [];
        for (const [name, surface] of Object.entries({
            entry: entryReport,
            library: libraryReport,
            exam: examReport,
            print: printReport
        })) {
            if (surface.missingRoot) problems.push(`${name}: surface missing`);
            if (!surface.katex) problems.push(`${name}: no formula was rendered at all`);
            if (surface.katexErrors) problems.push(`${name}: ${surface.katexErrors} formula error(s) ${JSON.stringify(surface.katexErrorText)}`);
            if (surface.leaks?.length) problems.push(`${name}: raw LaTeX visible ${JSON.stringify(surface.leaks)}`);
        }
        // The stem, four options, answer and solution each carry formulas. Fewer islands than
        // that means content silently stopped rendering; the display islands prove `$$…$$`
        // did not collapse back to inline math.
        if ((libraryReport.katex || 0) < 6) {
            problems.push(`library: only ${libraryReport.katex} formula(s) rendered, the seeded content has more`);
        }
        if ((libraryReport.displayMath || 0) < 1) {
            problems.push('library: display math did not render as display math');
        }
        if ((entryReport.katex || 0) < 3) {
            problems.push(`entry preview: only ${entryReport.katex} formula(s) rendered`);
        }
        if ((entryReport.displayMath || 0) < 1) {
            problems.push('entry preview: display math did not render as display math');
        }
        if ((printReport.katex || 0) < 4) {
            problems.push(`print document: only ${printReport.katex} formula(s) rendered`);
        }
        if ((printReport.displayMath || 0) < 1) {
            problems.push('print document: display math did not render as display math');
        }

        assert.deepEqual(problems, [], JSON.stringify(report, null, 2));
        assert.deepEqual(pageErrors, []);
    } finally {
        if (browser) await browser.close();
        server.kill();
    }
});
