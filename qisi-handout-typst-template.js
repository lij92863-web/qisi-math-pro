(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutTypstTemplate = api;

    if (
        typeof module !== 'undefined'
        && module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const TEMPLATE_ID = 'tex-handout-a4-default';
        const TEMPLATE_VERSION = 1;
        const MAIN_FILE_PATH = '/main.typ';

        const finite = (value, label) => {
            const number = Number(value);
            if (!Number.isFinite(number)) {
                throw new TypeError(`${label} must be finite`);
            }
            return number;
        };

        const assertTrustedSource = (value, label) => {
            if (
                !value
                || value.kind !== 'trusted-typst-source'
                || typeof value.source !== 'string'
            ) {
                throw new TypeError(`${label} must be trusted Typst source`);
            }
            return value.source;
        };

        const trustedSource = source => Object.freeze({
            kind: 'trusted-typst-source',
            source: String(source || '')
        });

        const renderDefaultA4Template = ({
            title,
            edition,
            page,
            header,
            footer,
            body,
            endSections
        }) => {
            if (!['student', 'teacher'].includes(edition)) {
                throw new TypeError('template edition is invalid');
            }

            const titleSource = assertTrustedSource(title, 'template title');
            const headerSource = assertTrustedSource(header, 'template header');
            const footerSource = assertTrustedSource(footer, 'template footer');
            const bodySource = assertTrustedSource(body, 'template body');
            const endSource = assertTrustedSource(
                endSections,
                'template end sections'
            );
            const margin = page?.margin || {};
            const leftMm = finite(margin.leftMm, 'left margin');
            const rightMm = finite(margin.rightMm, 'right margin');
            const topMm = finite(margin.topMm, 'top margin');
            const bottomMm = finite(margin.bottomMm, 'bottom margin');
            const bodyFontPt = finite(page?.bodyFontPt, 'body font');
            const lineHeightEm = finite(
                page?.lineHeightEm,
                'line height'
            );
            const lines = [
                `// ${TEMPLATE_ID}@${TEMPLATE_VERSION}`,
                '#import "/mitex/lib.typ": mi, mitex',
                '',
                '#set page(',
                '  paper: "a4",',
                `  margin: (left: ${leftMm}mm, right: ${rightMm}mm, top: ${topMm}mm, bottom: ${bottomMm}mm),`,
                `  header: context ${headerSource},`,
                `  footer: context ${footerSource},`,
                ')',
                `#set text(font: ("New Computer Modern", "Noto Serif CJK SC"), size: ${bodyFontPt}pt, lang: "zh")`,
                `#set par(justify: true, leading: ${lineHeightEm}em)`,
                '#set heading(numbering: none)',
                '#show link: underline',
                '',
                '#align(center)[',
                `  #text(size: 18pt, weight: "semibold", fill: rgb("#111827"))[${titleSource}]`,
                ']',
                '#v(8pt)',
                '',
                '// TEX-HANDOUT-BODY-BEGIN',
                bodySource,
                '// TEX-HANDOUT-BODY-END',
                ''
            ];

            if (endSource.trim()) {
                lines.push(
                    '#pagebreak(weak: true)',
                    '// TEX-HANDOUT-END-SECTIONS-BEGIN',
                    endSource,
                    '// TEX-HANDOUT-END-SECTIONS-END',
                    ''
                );
            }

            return Object.freeze({
                templateId: TEMPLATE_ID,
                templateVersion: TEMPLATE_VERSION,
                mainFilePath: MAIN_FILE_PATH,
                source: `${lines.join('\n')}\n`
            });
        };

        return {
            TEMPLATE_ID,
            TEMPLATE_VERSION,
            MAIN_FILE_PATH,
            trustedSource,
            renderDefaultA4Template
        };
    }
);
