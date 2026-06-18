const { createApp, ref, reactive, watch, onMounted, nextTick, computed, toRaw } = Vue;

        const PRESET_TEMPLATES = {
            quizSheet: {
                name: '测验模板',
                desc: '你提供的测验模板：班别、姓名、评分栏，1-9 题答题表，10-12 题下划线。',
                code: String.raw`\documentclass[11pt,a4paper]{ctexart}

% ========== 页面页边距设置 ==========
\usepackage{geometry}
\geometry{left=2cm, right=2cm, top=2cm, bottom=2cm}

% ========== 常用数学宏包 ==========
\usepackage{amsmath, amssymb, amsthm}
\usepackage{enumitem} 

% ========== 自定义微调命令 ==========
% 选择题括号右对齐
\newcommand{\kuohao}{\hfill (\qquad)}
% 填空题下划线
\newcommand{\blank}[1]{\underline{\hbox to #1{}}}
% 选项平铺：2列布局，更符合复杂公式的展示
\newcommand{\twochoices}[4]{\\[0.15cm] \begin{tabular}{p{7.5cm} p{7.5cm}} A. #1 & B. #2 \\ C. #3 & D. #4 \end{tabular}}
% 选项平铺：4列布局
\newcommand{\fourchoices}[4]{\\[0.15cm] \begin{tabular}{p{3.8cm} p{3.8cm} p{3.8cm} p{3.8cm}} A. #1 & B. #2 & C. #3 & D. #4 \end{tabular}}

\begin{document}
	
	% ========== 1. 卷头大标题 ==========
	\begin{center}
		{\LARGE \textbf{测验模板}}
	\end{center}
	
	\vspace{0.1cm}
	
	% ========== 2. 班别、姓名、评分栏 ==========
	\noindent \textbf{班别}\blank{3.5cm} \qquad \textbf{姓名}\blank{3.5cm} \qquad \textbf{评分}\blank{3.5cm}
	
	\vspace{0.4cm}
	
	% ========== 3. 选择题 1-9 题答案表 ==========
	\begin{center}
		\renewcommand{\arraystretch}{1.6} 
		\begin{tabular}{|c|c|c|c|c|c|c|c|c|c|}
			\hline
			题号 & 1 & 2 & 3 & 4 & 5 & 6 & 7 & 8 & 9 \\
			\hline
			答案 & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} & \hspace{0.6cm} \\
			\hline
		\end{tabular}
	\end{center}
	
	\vspace{0.3cm}
	
	% 4. 10-12题纯手写平铺下划线
	\noindent \textbf{10.} \blank{3.5cm} \qquad\qquad \textbf{11.} \blank{3.5cm} \qquad\qquad \textbf{12.} \blank{3.5cm}
	
	\vspace{0.6cm}
	
	% ========== 5. 正文题目部分 ==========
	{{QUESTIONS}}
	
\end{document}`
            },
            examZh: {
                name: '高考模板',
                desc: '你提供的高考模板：经典左侧装订线、绝密标识、注意事项和标准大题结构。',
                code: String.raw`\documentclass[11pt,a4paper]{ctexart}

% ========== 页面设置 ==========
\usepackage{geometry}
\geometry{left=2cm, right=2cm, top=2.5cm, bottom=2.5cm}

% ========== 常用数学与排版宏包 ==========
\usepackage{amsmath, amssymb, amsthm}
\usepackage{enumitem} % 自定义列表缩进

% ========== 格式微调 ==========
% 选择题括号右对齐命令
\newcommand{\kuohao}{\hfill (\qquad)}
% 填空题下划线
\newcommand{\blank}[1]{\underline{\hbox to #1{}}}

\begin{document}
	
	% ========== 卷头 ==========
	\noindent \textbf{绝密 $\star$ 启用前} 
	
	\begin{center}
		{\LARGE \textbf{2024年普通高等学校招生全国统一考试}}\\[0.6cm]
		{\Huge \textbf{理 科 数 学}}\\[0.5cm]
	\end{center}
	
	\noindent \textbf{注意事项：}
	\begin{enumerate}[label=\arabic*., leftmargin=2em]
		\item 答卷前，考生务必将自己的姓名、准考证号填写在答题卡上。
		\item 回答选择题时，选出每小题答案后，用铅笔把答题卡上对应题目的答案标号涂黑。如需改动，用橡皮擦干净后，再选涂其它答案标号。回答非选择题时，将答案写在答题卡上。写在本试卷上无效。
		\item 考试结束后，将本试卷和答题卡一并交回。
	\end{enumerate}
	
	\vspace{0.2cm} 
	
	% ========== 正文部分 ==========
	{{QUESTIONS}}
	
\end{document}`
            }
        };
        const DEFAULT_PRESET_KEY = 'quizSheet';
        const DEFAULT_TEMPLATE = PRESET_TEMPLATES[DEFAULT_PRESET_KEY].code;
        const EXAM_LAYOUT_PRESETS = {
            quizSheet: {
                name: '测验模板',
                desc: '班别、姓名、评分栏；1-9 题答题表；10-12 题手写下划线。',
                config: { title: '测验模板', subtitle: '', organizer: '', subject: '数学', mode: '普通', paperType: '学生版', paperSize: 'A4', fontSize: '五号', fontFamily: '思源宋体', themeColor: '#111827', showDifficulty: false, showSource: false, showAnswer: false, showSolution: false, answerSpace: true, showNotice: false, showScore: true, showQuestionName: false, includeAnswerSection: false, showHeaderFields: true, showAnswerGrid: true, answerGridCount: 9, answerLineStart: 10, answerLineCount: 3, showCornerMarks: false, compactMode: true }
            },
            examZh: {
                name: '高考模板',
                desc: '左侧装订线、绝密标识、考试标题、注意事项与标准大题结构。',
                config: { title: '2024年普通高等学校招生全国统一考试', subtitle: '理 科 数 学', organizer: '', subject: '理 科 数 学', mode: '普通', paperType: '普通试卷', paperSize: 'A4', fontSize: '小四', fontFamily: '思源宋体', themeColor: '#111827', showDifficulty: false, showSource: false, showAnswer: false, showSolution: false, answerSpace: true, showNotice: true, showScore: true, showQuestionName: false, includeAnswerSection: true, showHeaderFields: false, showAnswerGrid: false, showCornerMarks: false, compactMode: false, showSecretMark: true }
            }
        };
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


