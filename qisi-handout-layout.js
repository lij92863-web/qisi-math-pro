(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutLayout = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PX_PER_MM = 96 / 25.4;
    const papers = Object.freeze({
        a4: ['A4 竖版', 210, 297], a4h: ['A4 横版', 297, 210],
        a3: ['A3 横版', 420, 297], a3v: ['A3 竖版', 297, 420],
        b4: ['B4 横版', 353, 250], b4v: ['B4 竖版', 250, 353],
        '7:5': ['7:5', 210, 150], '3:2': ['3:2', 210, 140], custom: ['自定义']
    });

    const fonts = Object.freeze({
        song: ['宋体', '"SimSun", "Noto Serif SC", serif'],
        kai: ['楷体', '"KaiTi", "STKaiti", "Noto Serif SC", serif'],
        noto: ['思源宋体', '"Noto Serif SC", "SimSun", serif'],
        latex: ['Noto Serif SC · LaTeX', 'KaTeX_Main, "Noto Serif SC", serif'],
        hei: ['黑体', '"SimHei", "Microsoft YaHei", sans-serif'],
        yahei: ['微软雅黑', '"Microsoft YaHei", sans-serif'],
        times: ['Times New Roman', '"Times New Roman", "SimSun", serif'],
        mono: ['等宽', 'Consolas, "Microsoft YaHei", monospace']
    });

    function limit(raw, min, max, fallback) {
        const n = raw === '' || raw == null ? NaN : Number(raw);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    function color(value, fallback = '#17242d') {
        return /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
    }

    function pageGeometry(settings) {
        const [, paperWidth, paperHeight] = papers[settings.paper] || papers.a4;
        const width = (paperWidth || limit(settings.width, 70, 750, 210)) * PX_PER_MM;
        const height = (paperHeight || limit(settings.height, 70, 750, 297)) * PX_PER_MM;
        const columns = settings.mode === 'double' ? 2 : 1;
        const seal = settings.seal ? limit(settings.sealWidth, 3, 40, 14) * PX_PER_MM : 0;
        const padding = key => limit(settings[`padding${key}`], 0, 64, 0);
        const margin = (key, max) => limit(settings[`margin${key}`], 4, max / PX_PER_MM, 20) * PX_PER_MM;
        const left = margin('Left', (width - seal) / 4) + padding('Left') + (settings.sealSide === 'right' ? 0 : seal);
        const right = margin('Right', (width - seal) / 4) + padding('Right') + (settings.sealSide === 'right' ? seal : 0);
        const top = margin('Top', height / 3) + padding('Top');
        const bottom = margin('Bottom', height / 3) + padding('Bottom');
        const contentWidth = Math.max(24, width - left - right);
        const gap = columns === 2 ? Math.min(contentWidth / 4, limit(settings.columnGap, 0, 40, 8) * PX_PER_MM) : 0;
        return { width, height, left, right, top, bottom, columns, gap, seal,
            columnWidth: (contentWidth - gap) / columns, contentHeight: Math.max(16, height - top - bottom - 1) };
    }

    function paginate(items, { columns, contentHeight }, { mode, perPage, gap }) {
        const pages = [];
        const maximum = mode === 'single' ? Math.trunc(limit(perPage, 0, 100, 0)) : 0;
        const addPage = () => {
            const page = { columns: Array.from({ length: columns }, () => []), count: 0 };
            pages.push(page);
            return page;
        };
        let page = addPage();
        let col = 0;
        let used = 0;
        const advance = (whole = false) => {
            if (whole || col + 1 === columns) {
                page = addPage();
                col = 0;
            } else col++;
            used = 0;
        };
        const place = ({ splitAt, firstHeight, ...row }) => {
            used += (used ? gap : 0) + row.height;
            page.columns[col].push({ ...row, overflow: mode === 'flow' ? 0 : Math.max(0, Math.ceil(row.height - contentHeight)) });
            page.count += Number(row.kind === 'question' && !row.continued);
        };

        for (let index = 0; index < items.length; index++) {
            let item = items[index];
            if (mode === 'flow') {
                place(item);
                continue;
            }
            const next = items[index + 1];
            const isQuestion = item.kind === 'question' && !item.continued;
            const hasPrior = page.count > 0 || col > 0 || used > 0;
            const nextHeight = item.keepNext && next && !next.breakBefore ? (next.firstHeight?.() ?? next.height) : null;
            const keepNext = nextHeight !== null && item.height + gap + nextHeight <= contentHeight;
            const reserve = keepNext ? gap + nextHeight : 0;
            if (hasPrior && (item.breakBefore === 'page' || ((isQuestion || (keepNext && next.kind === 'question' && !next.continued)) && maximum && page.count >= maximum))) advance(true);
            else if (used && item.breakBefore === 'column') advance();

            while (item) {
                const room = contentHeight - (used ? used + gap : 0);
                if (item.height + reserve > room) {
                    const split = !keepNext && item.splitAt?.(room, !used, item.space || 0);
                    if (split) {
                        place(split[0]);
                        item = split[1];
                        if (item) advance();
                        continue;
                    }
                    if (used) {
                        advance();
                        continue;
                    }
                }
                place(item);
                break;
            }
        }
        return pages;
    }

    function pageLabel(settings, index, count) {
        const start = settings.mode === 'single' ? Math.trunc(limit(settings.startPage, 1, 999, 1)) : 1;
        const first = settings.mode === 'single' ? Math.trunc(limit(settings.startNumber, 1, 9999, 1)) : 1;
        const total = settings.mode === 'single' && settings.overrideTotal ? Math.trunc(limit(settings.totalPages, 1, 9999, count)) : Math.max(1, count - start + 1);
        return { current: index + 1 < start ? '' : index + 1 - start + first, total };
    }

    function sourceNumber(question) {
        return question?.questionNumber || question?.meta?.questionNumber || question?.number || question?.sourceTrace?.questionNumber || '';
    }

    function orderQuestions(questions, order) {
        if (order === 'basket') return questions.slice();
        if (order === 'random') {
            const shuffled = questions.slice();
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        if (order === 'directory') return questions.slice().sort((a, b) => {
            const path = q => String(q.knowledge || q.meta?.knowledge || q.systemKnowledge || q.personalKnowledge || '');
            return path(a).localeCompare(path(b), 'zh-Hans-CN');
        });
        const year = order.startsWith('year');
        const value = question => year ? question.year || question.meta?.year : sourceNumber(question);
        const factor = ['ascending', 'yearAsc'].includes(order) ? 1 : -1;
        return questions.slice().sort((a, b) => {
            const x = Number.parseInt(String(value(a) || '').replace(/^第\s*/, ''), 10);
            const y = Number.parseInt(String(value(b) || '').replace(/^第\s*/, ''), 10);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return Number(!Number.isFinite(x)) - Number(!Number.isFinite(y));
            return factor * (x - y);
        });
    }

    return Object.freeze({ PX_PER_MM, papers, fonts, limit, color, pageGeometry, paginate, pageLabel, sourceNumber, orderQuestions });
});
