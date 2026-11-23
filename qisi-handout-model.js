(function initHandoutModel(root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutModel = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // 讲义文档的数据模型。
    //
    // 设计取舍：讲义 = 「题目引用」+「老师自己写的文字」，不是一份另存为的试卷。
    // 所以文档里只存 questionId，绝不复制题干；题目改了，讲义跟着改。
    //
    // 题号是「锁定」的：createDoc 按区块出现顺序写死 1..n。老师拖拽改了顺序之后，
    // 必须显式调用 renumber 重新编号。这样 validate 能发现「改了顺序忘了重编号」，
    // 而不是悄悄替老师重排（安静改数据比报错更危险）。

    const SCHEMA_VERSION = 1;
    const BLOCK_TYPES = Object.freeze(['heading', 'note', 'question', 'divider']);

    function toText(value) {
        return value == null ? '' : String(value);
    }

    function normalizeBlock(block) {
        if (!block || typeof block !== 'object') return null;

        const type = toText(block.type);
        const normalized = normalizeTypedBlock(block, type);
        if (!normalized) return null;

        // 区块 id 留给界面做 v-for / 拖拽的 key，模型不解释它，但不能弄丢。
        if (block.id != null) normalized.id = block.id;
        return normalized;
    }

    function normalizeTypedBlock(block, type) {
        if (type === 'heading' || type === 'note') {
            return { type, text: toText(block.text) };
        }

        if (type === 'divider') {
            return block.pageBreak ? { type, pageBreak: true } : { type };
        }

        if (type === 'question') {
            // questionId 保留原始类型：题库里既有字符串 id 也有数字 id。
            // 比较时统一 String()，但不要在这里做转换，否则调用方写回时会对不上。
            const question = {
                type,
                questionId: block.questionId == null ? '' : block.questionId,
                questionNo: Number.isInteger(block.questionNo) ? block.questionNo : null
            };
            // 单题留白覆盖：0 是合法值（表示这题不留白），所以只判 null。
            if (block.answerSpaceMm != null) question.answerSpaceMm = block.answerSpaceMm;
            return question;
        }

        // 不认识的类型原样留着，交给 validate 报 unknown-block。
        // 直接丢掉会让老师「明明加了东西却不见了」。
        return { type, text: toText(block.text) };
    }

    /**
     * 按区块出现顺序重排题号，返回新文档（不修改入参）。
     * 老师拖拽后必须调用它，否则 validate 会报 number-sequence。
     */
    function renumber(doc) {
        const source = doc && typeof doc === 'object' ? doc : {};
        const blocks = Array.isArray(source.blocks) ? source.blocks : [];
        let no = 0;

        const next = blocks.map(block => {
            if (!block || typeof block !== 'object') return block;
            if (block.type !== 'question') return Object.assign({}, block);
            no += 1;
            return Object.assign({}, block, { questionNo: no });
        });

        return Object.assign({}, source, { blocks: next });
    }

    /**
     * 新建一份讲义文档。题号在这里生成并锁定。
     * @param {{ title?, subtitle?, className?, showAnswer?, showSolution?, blocks? }} input
     */
    function createDoc(input) {
        const source = input && typeof input === 'object' ? input : {};
        const blocks = (Array.isArray(source.blocks) ? source.blocks : [])
            .map(normalizeBlock)
            .filter(Boolean);

        return renumber({
            schemaVersion: SCHEMA_VERSION,
            title: toText(source.title),
            subtitle: toText(source.subtitle),
            className: toText(source.className),
            showAnswer: Boolean(source.showAnswer),
            showSolution: Boolean(source.showSolution),
            blocks
        });
    }

    function describeValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        return String(value);
    }

    function checkNumbering(questionBlocks, issues) {
        const numbers = [];
        let broken = false;

        questionBlocks.forEach((block, index) => {
            const no = block.questionNo;
            if (!Number.isInteger(no) || no < 1) {
                issues.push({
                    code: 'number-invalid',
                    detail: '第 ' + (index + 1) + ' 个题目区块没有有效题号（当前：' + describeValue(no) + '），请重新编号。'
                });
                broken = true;
                return;
            }
            numbers.push(no);
        });

        if (broken) return;

        const seen = new Set();
        const duplicates = [];
        numbers.forEach(no => {
            if (seen.has(no)) duplicates.push(no);
            seen.add(no);
        });

        if (duplicates.length) {
            issues.push({
                code: 'number-duplicate',
                detail: '题号重复：' + [...new Set(duplicates)].join('、') + '。每道题必须有自己的题号。'
            });
            return;
        }

        const sorted = numbers.slice().sort((a, b) => a - b);
        const gap = sorted.some((no, index) => no !== index + 1);
        if (gap) {
            const expected = numbers.map((_, index) => index + 1);
            const missing = expected.filter(no => !seen.has(no));
            issues.push({
                code: 'number-gap',
                detail: '题号不连续，应为 1 到 ' + numbers.length + '，实际是 ' + numbers.join('、') +
                    (missing.length ? '（缺少 ' + missing.join('、') + '）' : '') + '。'
            });
            return;
        }

        const outOfOrder = numbers.some((no, index) => no !== index + 1);
        if (outOfOrder) {
            issues.push({
                code: 'number-sequence',
                detail: '题号顺序和实际出现顺序不一致（当前是 ' + numbers.join('、') +
                    '）。调整过题目顺序后需要重新编号，否则印出来会跳号。'
            });
        }
    }

    /**
     * 校验文档。
     * @param {object} doc createDoc 的产物（或同结构对象）
     * @param {Array} questions 题库里的题目，形如 [{ id, stem, options, answer, solution, images }]
     * @param {{ allowDuplicates?: boolean }} [options] 老师确实想让同一道题出现两次时传 allowDuplicates:true
     * @returns {{ valid: boolean, issues: Array<{ code: string, detail: string }>, doc: object }}
     */
    function validate(doc, questions, options) {
        const settings = options && typeof options === 'object' ? options : {};
        const allowDuplicates = settings.allowDuplicates === true;
        const issues = [];

        const blocks = doc && Array.isArray(doc.blocks) ? doc.blocks : [];
        const questionList = Array.isArray(questions) ? questions : [];

        const byId = new Map();
        questionList.forEach(question => {
            if (!question || question.id == null) return;
            const key = String(question.id);
            if (!byId.has(key)) byId.set(key, question);
        });

        const questionBlocks = blocks.filter(block => block && block.type === 'question');

        if (!questionBlocks.length) {
            issues.push({
                code: 'empty-doc',
                detail: blocks.length
                    ? '讲义里还没有题目，只有文字区块。学生拿到手没题可做。'
                    : '讲义是空的，先往里面加题或加一段文字。'
            });
        }

        blocks.forEach((block, index) => {
            const type = block && block.type;
            if (!BLOCK_TYPES.includes(type)) {
                issues.push({
                    code: 'unknown-block',
                    detail: '第 ' + (index + 1) + ' 个区块的类型「' + describeValue(type) + '」不认识，已跳过。'
                });
            }
        });

        checkNumbering(questionBlocks, issues);

        const seenIds = new Set();
        questionBlocks.forEach((block, index) => {
            const no = Number.isInteger(block.questionNo) && block.questionNo > 0 ? block.questionNo : index + 1;
            const key = block.questionId == null ? '' : String(block.questionId);

            if (!key || !byId.has(key)) {
                issues.push({
                    code: 'missing-question',
                    detail: '第 ' + no + ' 题引用的题目不存在（questionId：' + (key || '空') + '）。可能这道题已被删除。'
                });
                return;
            }

            if (seenIds.has(key)) {
                if (!allowDuplicates) {
                    issues.push({
                        code: 'duplicate-question',
                        detail: '第 ' + no + ' 题重复引用了同一道题（questionId：' + key + '）。' +
                            '如果确实要印两次，请改用 allowDuplicates。'
                    });
                }
                return;
            }

            seenIds.add(key);
        });

        return {
            valid: issues.length === 0,
            issues,
            doc
        };
    }

    return Object.freeze({
        SCHEMA_VERSION,
        BLOCK_TYPES,
        createDoc,
        validate,
        renumber,
        normalizeBlock
    });
});
