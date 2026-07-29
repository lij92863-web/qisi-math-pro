(function (root, factory) {
    const model = root.Qisi?.HandoutModel
        || (
            typeof require === 'function'
                ? require('./qisi-handout-model.js')
                : null
        );
    const questionInstance = root.Qisi?.HandoutQuestionInstance
        || (
            typeof require === 'function'
                ? require('./qisi-handout-question-instance.js')
                : null
        );
    const preview = root.Qisi?.HandoutPreview
        || (
            typeof require === 'function'
                ? require('./qisi-handout-preview.js')
                : null
        );
    const api = factory(model, questionInstance, preview);

    root.Qisi = root.Qisi || {};
    root.Qisi.HandoutEditionPolicy = api;

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
    function (model, questionInstance, preview) {
        'use strict';

        if (!model || !questionInstance || !preview) {
            throw new Error('handout edition policy dependencies are unavailable');
        }

        const EDITIONS = Object.freeze([
            'student',
            'teacher'
        ]);
        const VISIBILITY_FIELDS = Object.freeze([
            'showKnowledgePoints',
            'showSource',
            'showTags'
        ]);
        const PLACEMENT_FIELDS = Object.freeze([
            'answerPlacement',
            'analysisPlacement',
            'solutionPlacement'
        ]);
        const PROTECTED_FIELDS = Object.freeze([
            'answer',
            'analysis',
            'solution',
            'teacherNote'
        ]);
        const FORBIDDEN_STUDENT_KEYS = Object.freeze([
            ...PROTECTED_FIELDS,
            'snapshot',
            'contentOverrides',
            'sourceTrace',
            'meta',
            'endSections'
        ]);
        const ALIGNMENTS = Object.freeze([
            'left',
            'center',
            'right'
        ]);
        const BUILTIN_QUESTION_DEFAULTS = Object.freeze({
            student: Object.freeze({
                showKnowledgePoints: false,
                showSource: false,
                showTags: false,
                answerPlacement: 'hidden',
                analysisPlacement: 'hidden',
                solutionPlacement: 'hidden'
            }),
            teacher: Object.freeze({
                showKnowledgePoints: false,
                showSource: false,
                showTags: false,
                answerPlacement: 'end',
                analysisPlacement: 'after-question',
                solutionPlacement: 'end'
            })
        });
        const DEFAULT_PAGE_SETTINGS = Object.freeze({
            paper: 'a4',
            margin: Object.freeze({
                leftMm: 20,
                rightMm: 20,
                topMm: 20,
                bottomMm: 18
            }),
            bodyFontPt: 10.5,
            lineHeightEm: 0.82
        });
        const DEFAULT_SLOT_SETTINGS = Object.freeze({
            enabled: false,
            text: '',
            alignment: 'center',
            fontSizePt: 8.5
        });

        const isPlainObject = value =>
            Boolean(value)
            && typeof value === 'object'
            && !Array.isArray(value)
            && Object.getPrototypeOf(value) === Object.prototype;

        const assertEdition = edition => {
            if (!EDITIONS.includes(edition)) {
                throw new TypeError(`unsupported handout edition: ${edition}`);
            }
            return edition;
        };

        const readBoolean = (value, fallback, label) => {
            if (value == null || value === 'inherit') return fallback;
            if (typeof value !== 'boolean') {
                throw new TypeError(`${label} must be a boolean or inherit`);
            }
            return value;
        };

        const readPlacement = (value, fallback, label) => {
            if (value == null || value === 'inherit') return fallback;
            if (
                ![
                    'hidden',
                    'inline',
                    'after-question',
                    'end'
                ].includes(value)
            ) {
                throw new TypeError(`${label} has an invalid placement`);
            }
            return value;
        };

        const boundedNumber = (
            value,
            fallback,
            {
                label,
                minimum,
                maximum
            }
        ) => {
            if (value == null || value === '') return fallback;
            const number = Number(value);
            if (
                !Number.isFinite(number)
                || number < minimum
                || number > maximum
            ) {
                throw new RangeError(
                    `${label} must be from ${minimum} to ${maximum}`
                );
            }
            return number;
        };

        const normalizeQuestionDefaults = (
            value,
            fallback,
            label
        ) => {
            const source = isPlainObject(value) ? value : {};
            const resolved = {};

            for (const field of VISIBILITY_FIELDS) {
                resolved[field] = readBoolean(
                    source[field],
                    fallback[field],
                    `${label}.${field}`
                );
            }
            for (const field of PLACEMENT_FIELDS) {
                resolved[field] = readPlacement(
                    source[field],
                    fallback[field],
                    `${label}.${field}`
                );
            }

            return resolved;
        };

        const normalizePageSettings = value => {
            const source = isPlainObject(value) ? value : {};
            const margin = isPlainObject(source.margin)
                ? source.margin
                : {};

            if (
                source.paper != null
                && String(source.paper).toLowerCase() !== 'a4'
            ) {
                throw new TypeError('handout page paper must be A4');
            }

            return {
                paper: 'a4',
                margin: {
                    leftMm: boundedNumber(
                        margin.leftMm,
                        DEFAULT_PAGE_SETTINGS.margin.leftMm,
                        {
                            label: 'page.margin.leftMm',
                            minimum: 5,
                            maximum: 40
                        }
                    ),
                    rightMm: boundedNumber(
                        margin.rightMm,
                        DEFAULT_PAGE_SETTINGS.margin.rightMm,
                        {
                            label: 'page.margin.rightMm',
                            minimum: 5,
                            maximum: 40
                        }
                    ),
                    topMm: boundedNumber(
                        margin.topMm,
                        DEFAULT_PAGE_SETTINGS.margin.topMm,
                        {
                            label: 'page.margin.topMm',
                            minimum: 5,
                            maximum: 40
                        }
                    ),
                    bottomMm: boundedNumber(
                        margin.bottomMm,
                        DEFAULT_PAGE_SETTINGS.margin.bottomMm,
                        {
                            label: 'page.margin.bottomMm',
                            minimum: 5,
                            maximum: 40
                        }
                    )
                },
                bodyFontPt: boundedNumber(
                    source.bodyFontPt,
                    DEFAULT_PAGE_SETTINGS.bodyFontPt,
                    {
                        label: 'page.bodyFontPt',
                        minimum: 8,
                        maximum: 16
                    }
                ),
                lineHeightEm: boundedNumber(
                    source.lineHeightEm,
                    DEFAULT_PAGE_SETTINGS.lineHeightEm,
                    {
                        label: 'page.lineHeightEm',
                        minimum: 0.65,
                        maximum: 1.8
                    }
                )
            };
        };

        const normalizeSlotSettings = (value, label) => {
            const source = typeof value === 'string'
                ? {
                    enabled: Boolean(value),
                    text: value
                }
                : (isPlainObject(value) ? value : {});
            const alignment = source.alignment
                ?? DEFAULT_SLOT_SETTINGS.alignment;

            if (!ALIGNMENTS.includes(alignment)) {
                throw new TypeError(`${label}.alignment is invalid`);
            }

            return {
                enabled: source.enabled == null
                    ? Boolean(source.text)
                    : readBoolean(
                        source.enabled,
                        DEFAULT_SLOT_SETTINGS.enabled,
                        `${label}.enabled`
                    ),
                text: String(source.text || ''),
                alignment,
                fontSizePt: boundedNumber(
                    source.fontSizePt,
                    DEFAULT_SLOT_SETTINGS.fontSizePt,
                    {
                        label: `${label}.fontSizePt`,
                        minimum: 6,
                        maximum: 14
                    }
                )
            };
        };

        const mergeSlot = (base, override) => {
            if (override == null) return normalizeSlotSettings(base, 'slot');
            const merged = {
                ...(typeof base === 'string' ? { text: base } : base || {}),
                ...(typeof override === 'string'
                    ? {
                        enabled: Boolean(override),
                        text: override
                    }
                    : override)
            };
            return normalizeSlotSettings(merged, 'slot');
        };

        const resolveEditionSettings = (settingsValue, editionValue) => {
            const edition = assertEdition(editionValue);
            const settings = isPlainObject(settingsValue)
                ? settingsValue
                : {};
            const editions = isPlainObject(settings.editions)
                ? settings.editions
                : {};
            const editionSettings = isPlainObject(editions[edition])
                ? editions[edition]
                : {};
            const commonDefaults = normalizeQuestionDefaults(
                settings.questionDefaults,
                BUILTIN_QUESTION_DEFAULTS[edition],
                'settings.questionDefaults'
            );
            const questionDefaults = normalizeQuestionDefaults(
                editionSettings.questionDefaults,
                commonDefaults,
                `settings.editions.${edition}.questionDefaults`
            );

            if (edition === 'student') {
                for (const field of PLACEMENT_FIELDS) {
                    questionDefaults[field] = 'hidden';
                }
            }

            return {
                edition,
                questionDefaults,
                page: normalizePageSettings({
                    ...(isPlainObject(settings.page) ? settings.page : {}),
                    ...(isPlainObject(editionSettings.page)
                        ? editionSettings.page
                        : {})
                }),
                header: mergeSlot(
                    settings.header,
                    editionSettings.header
                ),
                footer: mergeSlot(
                    settings.footer,
                    editionSettings.footer
                ),
                documentDate: String(
                    editionSettings.documentDate
                    ?? settings.documentDate
                    ?? ''
                )
            };
        };

        const resolveQuestionDisplay = (
            displayValue,
            defaults,
            editionValue
        ) => {
            const edition = assertEdition(editionValue);
            const display = isPlainObject(displayValue)
                ? displayValue
                : {};
            const resolved = {
                showQuestionNumber: display.showQuestionNumber !== false,
                showOptions: display.showOptions !== false,
                answerSpaceLines: Number.isInteger(display.answerSpaceLines)
                    ? display.answerSpaceLines
                    : 0
            };

            for (const field of VISIBILITY_FIELDS) {
                resolved[field] = readBoolean(
                    display[field],
                    defaults[field],
                    `question.display.${field}`
                );
            }
            for (const field of PLACEMENT_FIELDS) {
                resolved[field] = edition === 'student'
                    ? 'hidden'
                    : readPlacement(
                        display[field],
                        defaults[field],
                        `question.display.${field}`
                    );
            }

            return resolved;
        };

        const resolveHandoutForEdition = (
            handoutValue,
            editionValue
        ) => {
            const edition = assertEdition(editionValue);
            const handout = model.assertValidHandout(handoutValue);
            const editionSettings = resolveEditionSettings(
                handout.settings,
                edition
            );
            const resolvedHandout = {
                ...handout,
                blocks: handout.blocks.map(block =>
                    block.type === 'question'
                        ? {
                            ...block,
                            display: resolveQuestionDisplay(
                                block.display,
                                editionSettings.questionDefaults,
                                edition
                            )
                        }
                        : block
                )
            };
            const projection = preview.projectHandoutForPreview(
                resolvedHandout,
                edition
            );
            const resolvedBlocksById = new Map(
                resolvedHandout.blocks.map(block => [
                    block.id,
                    block
                ])
            );

            projection.settings = editionSettings;
            projection.blocks = projection.blocks.map(block => {
                if (block.type !== 'question') return block;
                const sourceBlock = resolvedBlocksById.get(block.id);
                return {
                    ...block,
                    question: {
                        ...block.question,
                        latexNormalization: model.cloneValue(
                            sourceBlock?.latexNormalization || {}
                        )
                    }
                };
            });
            if (edition === 'student') {
                delete projection.endSections;
            }
            return projection;
        };

        const collectProtectedNeedles = handoutValue => {
            const handout = model.assertValidHandout(handoutValue);
            const values = [];

            for (const block of handout.blocks) {
                if (
                    block.type === 'callout'
                    && block.variant === 'teacher'
                ) {
                    values.push(block.title, block.content);
                    continue;
                }
                if (block.type !== 'question') continue;

                const question = questionInstance.applyQuestionOverrides(
                    block.snapshot,
                    block.contentOverrides || {}
                );
                for (const field of PROTECTED_FIELDS) {
                    values.push(question[field]);
                }
            }

            return [
                ...new Set(
                    values
                        .map(value => String(value || '').trim())
                        .filter(value => value.length >= 4)
                )
            ];
        };

        const scanStudentProjection = (
            projection,
            {
                protectedNeedles = []
            } = {}
        ) => {
            const findings = [];
            const visit = (value, path) => {
                if (Array.isArray(value)) {
                    value.forEach((item, index) =>
                        visit(item, `${path}[${index}]`)
                    );
                    return;
                }
                if (!isPlainObject(value)) return;

                for (const [key, item] of Object.entries(value)) {
                    const itemPath = path
                        ? `${path}.${key}`
                        : key;
                    if (FORBIDDEN_STUDENT_KEYS.includes(key)) {
                        findings.push({
                            code: 'forbidden-student-field',
                            path: itemPath
                        });
                    }
                    visit(item, itemPath);
                }
            };

            if (projection?.edition !== 'student') {
                findings.push({
                    code: 'wrong-edition',
                    path: 'edition'
                });
            }
            visit(projection, '');

            const serialized = JSON.stringify(projection);
            for (const needle of protectedNeedles) {
                const text = String(needle || '');
                if (text && serialized.includes(text)) {
                    findings.push({
                        code: 'protected-content',
                        path: '',
                        value: text
                    });
                }
            }

            return {
                ok: findings.length === 0,
                findings
            };
        };

        const assertStudentProjectionSafe = (
            projection,
            options
        ) => {
            const report = scanStudentProjection(
                projection,
                options
            );
            if (!report.ok) {
                const error = new Error(
                    `student projection leakage: ${report.findings
                        .map(item => `${item.code}@${item.path || '<root>'}`)
                        .join(', ')}`
                );
                error.code = 'HANDOUT_STUDENT_LEAKAGE';
                error.findings = report.findings;
                throw error;
            }
            return projection;
        };

        return {
            EDITIONS,
            VISIBILITY_FIELDS,
            PLACEMENT_FIELDS,
            PROTECTED_FIELDS,
            FORBIDDEN_STUDENT_KEYS,
            BUILTIN_QUESTION_DEFAULTS,
            DEFAULT_PAGE_SETTINGS,
            resolveEditionSettings,
            resolveQuestionDisplay,
            resolveHandoutForEdition,
            collectProtectedNeedles,
            scanStudentProjection,
            assertStudentProjectionSafe
        };
    }
);
