        // --- 全新详尽的教研级 3 级知识树大纲 ---
        const MATH_KNOWLEDGE_TREE = [
            { id: 'k1', name: '集合与常用逻辑用语', children: [{id:'k1-1', name:'集合', children:[{id:'k1-1-1',name:'集合的概念与表示'},{id:'k1-1-2',name:'集合间的基本关系'},{id:'k1-1-3',name:'集合的基本运算'}]}, {id:'k1-2', name:'常用逻辑用语', children:[{id:'k1-2-1',name:'命题与量词'},{id:'k1-2-2',name:'充分条件与必要条件'},{id:'k1-2-3',name:'逻辑联结词'}]}] },
            { id: 'k2', name: '一元二次函数、方程和不等式', children: [{id:'k2-1', name:'等式与不等式', children:[{id:'k2-1-1',name:'等式性质与不等式性质'},{id:'k2-1-2',name:'基本不等式'}]}, {id:'k2-2', name:'一元二次函数与方程', children:[{id:'k2-2-1',name:'二次函数与一元二次方程、不等式'}]}] },
            { id: 'k3', name: '函数的概念与性质', children: [{id:'k3-1', name:'函数', children:[{id:'k3-1-1',name:'函数的概念及其表示'},{id:'k3-1-2',name:'函数的定义域与值域'}]}, {id:'k3-2', name:'函数的性质', children:[{id:'k3-2-1',name:'单调性与最值'},{id:'k3-2-2',name:'奇偶性'},{id:'k3-2-3',name:'周期性'}]}, {id:'k3-3', name:'幂函数', children:[{id:'k3-3-1',name:'幂函数'}]}] },
            { id: 'k4', name: '指数函数与对数函数', children: [{id:'k4-1', name:'指数与指数函数', children:[{id:'k4-1-1',name:'实数指数幂及其运算'},{id:'k4-1-2',name:'指数函数'}]}, {id:'k4-2', name:'对数与对数函数', children:[{id:'k4-2-1',name:'对数的概念及其运算'},{id:'k4-2-2',name:'对数函数'}]}] },
            { id: 'k5', name: '三角函数', children: [{id:'k5-1', name:'任意角和弧度制', children:[{id:'k5-1-1',name:'任意角'},{id:'k5-1-2',name:'弧度制'}]}, {id:'k5-2', name:'三角函数的概念', children:[{id:'k5-2-1',name:'三角函数的概念'},{id:'k5-2-2',name:'同角三角函数的基本关系'},{id:'k5-2-3',name:'诱导公式'}]}, {id:'k5-3', name:'三角函数的图象与性质', children:[{id:'k5-3-1',name:'正弦函数的图象与性质'},{id:'k5-3-2',name:'余弦、正切函数的图象与性质'}]}, {id:'k5-4', name:'三角恒等变换', children:[{id:'k5-4-1',name:'两角和与差的三角公式'},{id:'k5-4-2',name:'二倍角公式'}]}] },
            { id: 'k6', name: '解三角形', children: [{id:'k6-1', name:'正余弦定理', children:[{id:'k6-1-1',name:'正弦定理'},{id:'k6-1-2',name:'余弦定理'}]}, {id:'k6-2', name:'应用举例', children:[{id:'k6-2-1',name:'解三角形应用举例'}]}] },
            { id: 'k7', name: '平面向量', children: [{id:'k7-1', name:'平面向量及其运算', children:[{id:'k7-1-1',name:'平面向量概念'},{id:'k7-1-2',name:'平面向量线性运算'}]}, {id:'k7-2', name:'基本定理与坐标表示', children:[{id:'k7-2-1',name:'平面向量基本定理'},{id:'k7-2-2',name:'平面向量坐标表示'}]}, {id:'k7-3', name:'数量积与应用', children:[{id:'k7-3-1',name:'平面向量的数量积'},{id:'k7-3-2',name:'夹角与距离'}]}] },
            { id: 'k8', name: '数列', children: [{id:'k8-1', name:'数列的概念', children:[{id:'k8-1-1',name:'数列的概念及简单表示法'}]}, {id:'k8-2', name:'等差数列', children:[{id:'k8-2-1',name:'等差数列'},{id:'k8-2-2',name:'等差数列的前n项和'}]}, {id:'k8-3', name:'等比数列', children:[{id:'k8-3-1',name:'等比数列'},{id:'k8-3-2',name:'等比数列的前n项和'}]}, {id:'k8-4', name:'数列的综合应用', children:[{id:'k8-4-1',name:'递推公式与求和'}]}] },
            { id: 'k9', name: '立体几何初步', children: [{id:'k9-1', name:'空间几何体', children:[{id:'k9-1-1',name:'柱、锥、台、球'},{id:'k9-1-2',name:'直观图与三视图'}]}, {id:'k9-2', name:'点、线、面的位置关系', children:[{id:'k9-2-1',name:'平面的基本事实'},{id:'k9-2-2',name:'平行关系'},{id:'k9-2-3',name:'垂直关系'}]}] },
            { id: 'k10', name: '空间向量与立体几何', children: [{id:'k10-1', name:'空间向量及其运算', children:[{id:'k10-1-1',name:'空间向量概念'},{id:'k10-1-2',name:'空间向量线性运算'}]}, {id:'k10-2', name:'空间向量的应用', children:[{id:'k10-2-1',name:'证明平行与垂直'},{id:'k10-2-2',name:'求空间角与距离'}]}] },
            { id: 'k11', name: '直线和圆的方程', children: [{id:'k11-1', name:'直线与方程', children:[{id:'k11-1-1',name:'倾斜角与斜率'},{id:'k11-1-2',name:'直线的方程'},{id:'k11-1-3',name:'距离公式'}]}, {id:'k11-2', name:'圆与方程', children:[{id:'k11-2-1',name:'圆的方程'},{id:'k11-2-2',name:'直线与圆的位置关系'}]}] },
            { id: 'k12', name: '圆锥曲线的方程', children: [{id:'k12-1', name:'椭圆', children:[{id:'k12-1-1',name:'椭圆定义与标准方程'},{id:'k12-1-2',name:'椭圆简单几何性质'}]}, {id:'k12-2', name:'双曲线', children:[{id:'k12-2-1',name:'双曲线定义与标准方程'},{id:'k12-2-2',name:'双曲线简单几何性质'}]}, {id:'k12-3', name:'抛物线', children:[{id:'k12-3-1',name:'抛物线定义与标准方程'},{id:'k12-3-2',name:'抛物线简单几何性质'}]}, {id:'k12-4', name:'直线与圆锥曲线', children:[{id:'k12-4-1',name:'位置关系'},{id:'k12-4-2',name:'弦长与面积'}]}] },
            { id: 'k13', name: '导数及其应用', children: [{id:'k13-1', name:'导数的概念及计算', children:[{id:'k13-1-1',name:'导数的概念'},{id:'k13-1-2',name:'导数的运算'}]}, {id:'k13-2', name:'导数在研究函数中的应用', children:[{id:'k13-2-1',name:'单调性'},{id:'k13-2-2',name:'极值与最值'}]}, {id:'k13-3', name:'导数的综合应用', children:[{id:'k13-3-1',name:'零点问题'},{id:'k13-3-2',name:'不等式证明'}]}] },
            { id: 'k14', name: '概率与统计', children: [{id:'k14-1', name:'概率', children:[{id:'k14-1-1',name:'随机事件与概率'},{id:'k14-1-2',name:'古典概型'},{id:'k14-1-3',name:'条件概率与全概率公式'}]}, {id:'k14-2', name:'统计', children:[{id:'k14-2-1',name:'抽样方法'},{id:'k14-2-2',name:'统计图表'},{id:'k14-2-3',name:'用样本估计总体'}]}, {id:'k14-3', name:'离散型随机变量', children:[{id:'k14-3-1',name:'分布列'},{id:'k14-3-2',name:'期望与方差'},{id:'k14-3-3',name:'二项分布'},{id:'k14-3-4',name:'正态分布'}]}, {id:'k14-4', name:'统计案例', children:[{id:'k14-4-1',name:'一元线性回归'},{id:'k14-4-2',name:'独立性检验'}]}] },
            { id: 'k15', name: '计数原理', children: [{id:'k15-1', name:'排列与组合', children:[{id:'k15-1-1',name:'两个基本原理'},{id:'k15-1-2',name:'排列'},{id:'k15-1-3',name:'组合'}]}, {id:'k15-2', name:'二项式定理', children:[{id:'k15-2-1',name:'二项式定理及性质'}]}] },
            { id: 'k16', name: '复数', children: [{id:'k16-1', name:'复数的概念', children:[{id:'k16-1-1',name:'复数的概念与几何意义'}]}, {id:'k16-2', name:'复数的运算', children:[{id:'k16-2-1',name:'复数的四则运算'}]}] }
        ];

        const db = new Dexie('QisiMathVueDB');
        db.version(2).stores({ questions: 'id, grade, type, diff, createdAt', images: 'id, createdAt', customTemplates: 'id, name, createdAt' });
        db.version(3).stores({ questions: 'id, grade, type, diff, knowledge, createdAt', images: 'id, createdAt', customTemplates: 'id, name, createdAt' }).upgrade(tx => {
            return tx.questions.toCollection().modify(q => {
                if(!q.knowledge) q.knowledge = '';
                if(!q.options) q.options = ['', '', '', ''];
            });
        });
        db.version(4).stores({ questions: 'id, grade, type, diff, knowledge, createdAt', images: 'id, createdAt', customTemplates: 'id, name, createdAt' }).upgrade(tx => {
            return tx.questions.toCollection().modify(q => {
                q.grade = q.grade || q.meta?.grade || '高一';
                q.diff = q.diff || q.meta?.diff || '中等';
                q.knowledge = q.knowledge || q.meta?.knowledge || '';
                if(!q.options) q.options = ['', '', '', ''];
            });
        });
        db.version(5).stores({ questions: 'id, grade, type, diff, knowledge, knowledgeType, createdAt', images: 'id, createdAt', customTemplates: 'id, name, createdAt', personalKnowledge: 'id, updatedAt' }).upgrade(tx => {
            return tx.questions.toCollection().modify(q => {
                q.knowledgeType = q.knowledgeType || q.meta?.knowledgeType || 'system';
                if(!q.meta) q.meta = {};
                q.meta.knowledgeType = q.knowledgeType;
            });
        });
        db.version(6).stores({
            questions: 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt',
            images: 'id, createdAt',
            customTemplates: 'id, name, createdAt',
            personalKnowledge: 'id, updatedAt',
            externalQuestions: 'id, batchId, sourceTeacher, importedAt, importOrder, processStatus',
            importBatches: 'id, sourceTeacher, importedAt'
        }).upgrade(tx => {
            return tx.questions.toCollection().modify(q => {
                if (!q.meta) q.meta = {};

                const oldKnowledge = q.meta?.knowledge || q.knowledge || '';
                const oldType = q.meta?.knowledgeType || q.knowledgeType || 'system';

                if (!q.systemKnowledge) {
                    q.systemKnowledge = oldType === 'system' ? oldKnowledge : '';
                }
                if (!q.personalKnowledge) {
                    q.personalKnowledge = oldType === 'personal' ? oldKnowledge : '';
                }

                q.meta.systemKnowledge = q.systemKnowledge || q.meta.systemKnowledge || '';
                q.meta.personalKnowledge = q.personalKnowledge || q.meta.personalKnowledge || '';

                if (!q.knowledge) q.knowledge = oldKnowledge;
                if (!q.knowledgeType) q.knowledgeType = oldType;
            });
        });
        db.version(7).stores({
            questions: 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt',
            images: 'id, createdAt',
            customTemplates: 'id, name, createdAt',
            personalKnowledge: 'id, updatedAt',
            externalQuestions: 'id, batchId, sourceTeacher, importedAt, importOrder, processStatus, detectedStatus',
            importBatches: 'id, sourceTeacher, importedAt, importStatus',
            mergeBatches: 'id, createdAt, revertedAt'
        }).upgrade(tx => {
            return tx.importBatches.toCollection().modify(batch => {
                if (!batch.importStatus) batch.importStatus = 'success';
            });
        });

        db.version(8).stores({
            questions: 'id, grade, type, diff, knowledge, knowledgeType, systemKnowledge, personalKnowledge, createdAt',
            images: 'id, createdAt',
            customTemplates: 'id, name, createdAt',
            personalKnowledge: 'id, updatedAt',
            externalQuestions: 'id, batchId, sourceTeacher, importedAt, importOrder, processStatus, detectedStatus',
            importBatches: 'id, sourceTeacher, importedAt, importStatus',
            mergeBatches: 'id, createdAt, revertedAt',
            draftImportBatches: 'id, status, createdAt, updatedAt',
            draftImportFiles: 'id, batchId, role, fileType, parseStatus, createdAt',
            draftQuestions: 'id, batchId, order, questionNumber, status, duplicateStatus, selected, createdAt',
            draftImages: 'id, batchId, questionId, status, createdAt'
        });

        const getQuestionKnowledge = (q, type) => {
            if (!q) return '';

            if (type === 'system') {
                return q.meta?.systemKnowledge || q.systemKnowledge ||
                    ((q.meta?.knowledgeType || q.knowledgeType) === 'system'
                        ? (q.meta?.knowledge || q.knowledge || '')
                        : '');
            }

            if (type === 'personal') {
                return q.meta?.personalKnowledge || q.personalKnowledge ||
                    ((q.meta?.knowledgeType || q.knowledgeType) === 'personal'
                        ? (q.meta?.knowledge || q.knowledge || '')
                        : '');
            }

            return q.meta?.knowledge || q.knowledge || '';
        };

        const normalizeCompareText = (text) => String(text || '')
            .replace(/\\left|\\right/g, '')
            .replace(/\s+/g, '')
            .replace(/[，。；：、,.．]/g, '')
            .replace(/[（）]/g, match => match === '（' ? '(' : ')')
            .replace(/[Ａ-Ｄ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 65248))
            .toLowerCase();

        const normalizeOptionsForCompare = (options) => {
            if (!Array.isArray(options)) return '';
            return options.map(opt => normalizeCompareText(opt)).join('|');
        };

        const questionCoreFingerprint = (q) => {
            const stem = normalizeCompareText(q?.stem || '');
            const options = normalizeOptionsForCompare(q?.options || []);
            return `${stem}__${options}`;
        };

        const questionStemFingerprint = (q) => normalizeCompareText(q?.stem || '');
        const hasText = (text) => String(text || '').trim().length > 0;
        const sameTextLoose = (a, b) => normalizeCompareText(a) === normalizeCompareText(b);

        const externalStatusLabel = (status) => ({
            new: '新题',
            fillable: '可补全',
            existing: '已存在',
            similar: '疑似同题',
            answerConflict: '答案冲突'
        }[status] || '新题');

        const externalStatusClass = (status) => ({
            new: 'chip-blue',
            fillable: 'chip-green',
            existing: 'chip-gray',
            similar: 'chip-yellow',
            answerConflict: 'chip-red'
        }[status] || 'chip-blue');

        const externalStatusReason = (status) => ({
            new: '个人题库中未发现相同题目',
            fillable: '个人题库已有此题，但可补全答案、解析或知识点',
            existing: '个人题库已有完整相同题目',
            similar: '题干相同或高度相似，但选项或结构不同，需要人工确认',
            answerConflict: '疑似同题但答案不一致'
        }[status] || '个人题库中未发现相同题目');

        const defaultActionForExternalStatus = (status) => {
            if (status === 'new') return 'add';
            if (status === 'fillable') return 'fill';
            return 'skip';
        };

        const actionLabel = (action) => ({
            add: '加入为新题',
            fill: '补全已有题',
            skip: '跳过此题'
        }[action] || '跳过此题');

        const externalProcessStatusLabel = (status) => ({
            added: '已加入',
            filled: '已补全',
            skipped: '已跳过',
            unprocessed: '未处理'
        }[status] || '');

        const makeSafeFileName = (name) => String(name || '题库数据')
            .replace(/[\\/:*?"<>|]/g, '_')
            .replace(/\s+/g, '_')
            .slice(0, 60);

        const downloadBlob = (blob, filename) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        };


