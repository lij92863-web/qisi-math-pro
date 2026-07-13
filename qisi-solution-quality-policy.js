(function initSolutionQualityPolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.SolutionQualityPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const extractNumberTokens = (text) => [...new Set((root.Qisi.Utils.cleanRecognizedText(text).match(/(?<![A-Za-z])\d+(?:\.\d+)?(?![A-Za-z])/g) || []).slice(0, 12))];

    const extractAnchorTokens = (text) => {
        const source = root.Qisi.Utils.cleanRecognizedText(text)
            .replace(/[Ａ-Ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248));
        const anchors = [];
        (source.match(/\b[A-Z]{2,5}\b/g) || []).forEach(token => {
            if (token !== 'ABC') anchors.push(token);
        });
        (source.match(/\\(?:vec|overrightarrow)\s*\{?\s*[A-Z]{1,2}\s*\}?/g) || []).forEach(token => anchors.push(token.replace(/\s+/g, '')));
        (source.match(/[\u4e00-\u9fa5]{2,6}/g) || []).forEach(token => {
            if (/复数|向量|圆台|棱台|棱锥|四边形|终边|表面积|侧棱|面积|最大值|最小值|共线|点积|数量积|外接圆|内切圆/.test(token)) anchors.push(token);
        });
        return [...new Set(anchors)];
    };

    const mathDomainTags = (text) => {
        const source = root.Qisi.Utils.cleanRecognizedText(text);
        const tags = new Set();
        if (/复数|虚部|实部|共轭|(?:^|[^a-zA-Z])i(?:$|[^a-zA-Z])/.test(source)) tags.add('complex');
        if (/向量|\\vec|\\overrightarrow|\\cdot|·|点积|数量积|共线|线性表示/.test(source)) tags.add('vector');
        if (/圆台|棱台|棱锥|棱柱|表面积|侧棱|侧面积|体积|正四棱台|三棱锥/.test(source)) tags.add('solid');
        if (/终边|象限|sin\\?alpha|cos\\?alpha|\\alpha|点P\s*[\(（]/.test(source)) tags.add('terminal-trig');
        if (/四边形|ABCD|平行四边形|梯形/.test(source)) tags.add('quadrilateral');
        if (/正弦定理|余弦定理|外接圆|内切圆|\\triangle|三角形|△ABC|边长[度]?分别为/.test(source)) tags.add('triangle-trig');
        if (/函数|导数|单调|极值|零点/.test(source)) tags.add('function');
        if (/数列|等差|等比|通项|前n项/.test(source)) tags.add('sequence');
        return tags;
    };

    const solutionLooksBroken = (solution) => {
        const source = root.Qisi.Utils.cleanRecognizedText(solution);
        if (!source) return false;
        if (/[，,、；;]\s*[，,、；;]/.test(source)) return true;
        if (/(因为|由于|即|则|所以|解得|可得)\s*[，,、；;]\s*(?=(且|则|所以|解得|故|$))/.test(source)) return true;
        const mathCueCount = (source.match(/因为|由于|所以|即|则|解得|可得|故|定理/g) || []).length;
        const concreteCount = (source.match(/\\[a-zA-Z]+|[A-Z]{2,5}|[a-zA-Z]\s*=|\d|=|>|</g) || []).length;
        return source.length > 28 && mathCueCount >= 3 && concreteCount < 2;
    };

    const solutionQualityIssue = (stem, options, solution) => {
        const cleanSolution = root.Qisi.Utils.cleanRecognizedText(solution);
        if (!cleanSolution) return '';
        if (solutionLooksBroken(cleanSolution)) return '解析内容缺少关键公式或结论，疑似 OCR 残缺。';
        return solutionMatchesQuestionContext(stem, options, cleanSolution) ? '' : '解析与题干关键词差异较大，请核对是否串题。';
    };

    const solutionMatchesQuestionContext = (stem, options, solution) => {
        const cleanSolution = root.Qisi.Utils.cleanRecognizedText(solution);
        if (!cleanSolution || cleanSolution.length < 18) return true;
        const context = [stem, ...(Array.isArray(options) ? options : [])].map(cleanRecognizedText).join('\n');
        if (!context.trim()) return true;
        const contextTags = mathDomainTags(context);
        const solutionTags = mathDomainTags(cleanSolution);
        const strongTags = [...contextTags].filter(tag => tag !== 'triangle-trig' || contextTags.size === 1);
        const hasStrongContextMismatch = strongTags.length && !strongTags.some(tag => solutionTags.has(tag));
        const hasDifferentStrongSolution = [...solutionTags].some(tag => tag !== 'triangle-trig' && strongTags.length && !contextTags.has(tag));
        if (hasStrongContextMismatch || hasDifferentStrongSolution) return false;
        const contextAnchors = extractAnchorTokens(context);
        const solutionAnchors = new Set(extractAnchorTokens(cleanSolution));
        const sharedAnchors = contextAnchors.filter(token => solutionAnchors.has(token));
        const contextTokens = root.Qisi.Utils.extractRelevanceTokens(context);
        const solutionTokens = new Set(root.Qisi.Utils.extractRelevanceTokens(cleanSolution));
        const sharedTokens = contextTokens.filter(token => solutionTokens.has(token));
        const contextNumbers = extractNumberTokens(context);
        const solutionNumbers = new Set(extractNumberTokens(cleanSolution));
        const sharedNumbers = contextNumbers.filter(num => solutionNumbers.has(num));
        if (contextTokens.length < 3 && contextNumbers.length < 2) return true;
        if (contextAnchors.length >= 2 && !sharedAnchors.length && sharedNumbers.length < 2) return false;
        if (sharedAnchors.length >= 1 && (sharedTokens.length >= 1 || sharedNumbers.length >= 1)) return true;
        if (sharedTokens.length >= 2) return true;
        if (sharedTokens.length >= 1 && sharedNumbers.length >= 1) return true;
        if (contextNumbers.length >= 2 && sharedNumbers.length >= 2) return true;
        const domainWords = ['复数', '函数', '导数', '数列', '向量', '圆锥', '圆台', '棱台', '棱锥', '几何', '概率', '椭圆', '双曲线', '抛物线', '三角', '正弦', '余弦', '单调', '极值', '面积', '体积'];
        const hasDomainSignal = domainWords.some(word => context.includes(word) || cleanSolution.includes(word));
        if (hasDomainSignal && !sharedTokens.length && !sharedNumbers.length) return false;
        return contextTokens.length ? sharedTokens.length / contextTokens.length >= 0.18 : true;
    };


    return Object.freeze({
        solutionLooksBroken,
        solutionQualityIssue,
        solutionMatchesQuestionContext
    });
});
