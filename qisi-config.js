const { createApp, ref, reactive, watch, onMounted, nextTick, computed, toRaw } = Vue;

        if (!window.Qisi?.A4ExamTemplate) {
            throw new Error('A4 exam template module is unavailable');
        }

        const {
            PRESET_TEMPLATES,
            EXAM_LAYOUT_PRESETS,
            DEFAULT_PRESET_KEY,
            DEFAULT_TEMPLATE
        } = window.Qisi.A4ExamTemplate;

        const QUESTION_TYPE_LABELS = {
            '单选题': '单选题',
            '多选题': '多选题',
            '填空题': '填空题',
            '解答题': '解答题',
            '证明题': '证明题'
        };
        const DEFAULT_GROUP_CONFIG = {
            '单选题': { title: '单选题', points: 0 },
            '多选题': { title: '多选题', points: 0 },
            '填空题': { title: '填空题', points: 0 },
            '解答题': { title: '解答题', points: 0 },
            '证明题': { title: '证明题', points: 0 }
        };
        const EXAM_TYPE_ORDER = ['单选题', '多选题', '填空题', '解答题', '证明题'];
        const CHINESE_SECTION_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];


