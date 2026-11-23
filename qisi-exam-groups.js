(function initExamGroups(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ExamGroups = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Exam state, pure grouping, fixed paper snapshots and explicitly injected drag lifecycle.

    const own = (record, key) => Object.hasOwn(record, key) ? record[key] : undefined;
    const groupQuestions = ({ questions, groupConfig = {}, questionMeta = {}, typeOrder = [], defaultGroupConfig = {}, typeLabels = {} } = {}) => {
        const grouped = Object.create(null);
        (Array.isArray(questions) ? questions : []).forEach(question => {
            const type = question.type || '其他题型';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(question);
        });
        return Object.entries(grouped).sort(([a], [b]) => {
            const ia = typeOrder.includes(a) ? typeOrder.indexOf(a) : 999;
            const ib = typeOrder.includes(b) ? typeOrder.indexOf(b) : 999;
            return ia - ib || a.localeCompare(b, 'zh-Hans-CN');
        }).map(([type, items]) => {
            const config = own(groupConfig, type) || own(defaultGroupConfig, type) ||
                { title: own(typeLabels, type) || type, points: 0 };
            const points = Number(config.points || 0);
            const total = items.reduce((sum, question) => sum + Number(own(questionMeta, question.id)?.points ?? points), 0);
            const generatedText = `${config.title || type}：本大题共 ${items.length} 小题，每小题 ${points} 分，共计 ${total} 分。`;
            return {
                type,
                items,
                count: items.length,
                points,
                total,
                title: config.title || type,
                text: config.text || generatedText
            };
        });
    };

    const reorderWithinType = ({ sourceId, targetIndex, cart = [], questions = [] } = {}) => {
        const byId = new Map(questions.filter(Boolean).map(question => [question.id, question]));
        const findQuestion = id => byId.get(id);
        const source = findQuestion(sourceId);
        if (!source) return { cart, changed: false };
        const type = source.type || '其他题型';
        const typeIds = cart.filter(id => {
            const question = findQuestion(id);
            return question && (question.type || '其他题型') === type;
        });
        const currentIndex = typeIds.indexOf(sourceId);
        if (currentIndex < 0 || !Number.isFinite(targetIndex) || !Number.isInteger(targetIndex)) return { cart, changed: false };
        const withoutSource = typeIds.filter(id => id !== sourceId);
        const nextIndex = Math.max(0, Math.min(targetIndex, withoutSource.length));
        if (currentIndex === nextIndex) return { cart, changed: false };
        withoutSource.splice(nextIndex, 0, sourceId);
        let position = 0;
        return {
            cart: cart.map(id => {
                const question = findQuestion(id);
                return question && (question.type || '其他题型') === type ? withoutSource[position++] : id;
            }),
            changed: true
        };
    };

    const clonePaperValue = value => {
        if (Array.isArray(value)) return value.map(clonePaperValue);
        if (value && typeof value === 'object') {
            if (value instanceof Date) return new Date(value);
            if (typeof Blob !== 'undefined' && value instanceof Blob) return value;
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePaperValue(item)]));
        }
        return value;
    };
    const freezePaperValue = value => {
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            Object.values(value).forEach(freezePaperValue); Object.freeze(value);
        }
        return value;
    };
    const createState = ({ ref, reactive, preferences }) => Object.freeze({
        cart: ref([]), questionMeta: reactive(Object.create(null)), groupConfig: reactive(Object.create(null)), dragging: ref(''), dragOver: ref(''),
        title: ref('高中数学期末模拟测试'), mode: ref(preferences.get('qisi_export_mode', 'questions') || 'questions')
    });
    const createWorkspace = ({ state, getQuestions, getQuestion, getLayout, preferences, typeOrder, defaultGroupConfig, typeLabels,
        confirm, notify, onOpen = () => {}, observeCart = () => () => {}, observeMeta = () => () => {},
        observeGroups = () => () => {}, observeQuestions = () => () => {}, observeMode = () => () => {}, observeNavigation = () => () => {} } = {}) => {
        let disposed = false, guarding = 0, pointer = null, restored = false;
        const guarded = work => { guarding++; try { return work(); } finally { guarding--; } };
        const questions = () => getQuestions() || [];
        const lookup = getQuestion || (id => questions().find(question => question?.id === id));
        const ordered = () => state.cart.value.map(lookup).filter(Boolean);
        const missing = () => state.cart.value.filter(id => !lookup(id));
        const groups = (source = ordered(), paper = null) => groupQuestions({ questions: source,
            groupConfig: paper?.groupConfig || state.groupConfig, questionMeta: paper?.questionMeta || state.questionMeta,
            typeOrder, defaultGroupConfig, typeLabels });
        const groupSummary = group => group.text || `${group.title}：本大题共 ${group.count} 小题，每小题 ${Number(group.points || 0)} 分，共计 ${group.total} 分。`;
        const groupConfig = type => {
            if (!state.groupConfig[type]) state.groupConfig[type] = clonePaperValue(own(defaultGroupConfig, type) || { title: own(typeLabels, type) || type || '其他题型', points: 0 });
            return state.groupConfig[type];
        };
        const persist = () => {
            if (disposed || !restored) return;
            const results = [preferences.setJson('qisi_exam_cart', clonePaperValue(state.cart.value)),
                preferences.setJson('qisi_exam_question_meta', clonePaperValue(state.questionMeta)),
                preferences.setJson('qisi_exam_group_config', clonePaperValue(state.groupConfig))];
            if (results.includes(false)) notify('试卷篮偏好保存失败，当前页面内容仍保留。');
        };
        const syncMeta = () => {
            if (disposed) return;
            guarded(() => {
                const selected = new Set(state.cart.value);
                for (const id of Object.keys(state.questionMeta)) if (!selected.has(id)) delete state.questionMeta[id];
                ordered().forEach((question,index) => {
                    const config = groupConfig(question.type);
                    if (!state.questionMeta[question.id]) state.questionMeta[question.id] = { name: question.type || `第 ${index+1} 题`,
                        points: Number(config.points || 0), source: question.knowledge || question.meta?.knowledge || '', note: '' };
                    else if (state.questionMeta[question.id].points === undefined || state.questionMeta[question.id].points === null) state.questionMeta[question.id].points = Number(config.points || 0);
                });
            });
            persist();
        };
        const syncGroups = () => {
            if (disposed) return;
            syncMeta();
            guarded(() => { groups().forEach(group => { const config = groupConfig(group.type); if (!config.text) config.text = groupSummary(group); }); });
            persist();
        };
        const cancel = () => { pointer?.cancel(); state.dragging.value = ''; state.dragOver.value = ''; };
        const restore = () => {
            if (disposed || restored) return;
            guarded(() => {
                const saved = preferences.json('qisi_exam_cart', []);
                state.cart.value = Array.isArray(saved) ? [...new Set(saved.filter(id => typeof id === 'string' && id))] : [];
                Object.assign(state.questionMeta, preferences.json('qisi_exam_question_meta', {}) || {});
                Object.assign(state.groupConfig, preferences.json('qisi_exam_group_config', {}) || {});
                restored = true;
            });
            syncGroups();
        };
        const remove = id => { if (disposed) return false; cancel(); guarded(() => { state.cart.value = state.cart.value.filter(item => item !== id); delete state.questionMeta[id]; }); syncMeta(); return true; };
        const toggle = id => {
            if (disposed) return false;
            if (!restored) restore();
            if (state.cart.value.includes(id)) return remove(id);
            if (!lookup(id)) { notify('题目已不存在，请刷新题库后重新选择。'); return false; }
            cancel(); guarded(() => { state.cart.value = [...state.cart.value,id]; }); syncMeta(); return true;
        };
        const typeIds = id => {
            const source = lookup(id); if (!source) return [];
            return state.cart.value.filter(cartId => { const question = lookup(cartId); return question && (question.type || '其他题型') === (source.type || '其他题型'); });
        };
        const reorder = (id,index,expectedIds) => {
            if (disposed || (expectedIds && JSON.stringify(typeIds(id)) !== JSON.stringify(expectedIds))) return false;
            const result = reorderWithinType({ sourceId:id,targetIndex:index,cart:state.cart.value,questions:ordered() });
            if (result.changed) { guarded(() => { state.cart.value = result.cart; }); persist(); } return result.changed;
        };
        const move = (id,direction) => { if (![1,-1].includes(direction)) return false; const ids = typeIds(id),index = ids.indexOf(id),next = index+direction; if(index<0||next<0||next>=ids.length)return false;cancel();return reorder(id,next); };
        const displayIndex = id => { let index=1;for(const group of groups()){for(const question of group.items){if(question.id===id)return index;index++;}}return index; };
        const drop = targetId => {
            const sourceId=state.dragging.value;cancel();if(!sourceId||sourceId===targetId)return false;
            const ids=typeIds(sourceId);if(!ids.includes(targetId))return false;
            return reorder(sourceId,ids.filter(id=>id!==sourceId).indexOf(targetId));
        };
        const reset = () => { if(disposed)return;cancel();guarded(()=>{state.cart.value=[...state.cart.value].sort((a,b)=>String(a).localeCompare(String(b)));});persist(); };
        const clear = () => { if(disposed||!confirm('确定清空试卷篮吗？'))return false;cancel();guarded(()=>{state.cart.value=[];for(const id of Object.keys(state.questionMeta))delete state.questionMeta[id];});persist();return true; };
        const snapshot = () => {
            if (disposed) throw new Error('组卷工作区已关闭。');
            if (!restored) restore();
            if (!state.cart.value.length) throw new Error('请先从题库中挑选试题放入试卷篮！');
            if (missing().length || new Set(state.cart.value).size !== state.cart.value.length) throw new Error('试卷车有题目已不存在或重复，请核对后再打印。');
            syncMeta();
            for(const question of ordered()){
                const points=Number(state.questionMeta[question.id]?.points);
                if(!Number.isFinite(points)||points<0)throw new Error('题目分值无效，请核对后再打印。');
            }
            const layout=clonePaperValue(getLayout());
            const paper={...layout,cart:[...state.cart.value],questionMeta:clonePaperValue(state.questionMeta),groupConfig:clonePaperValue(state.groupConfig)};
            const orderedGroups=groups(clonePaperValue(ordered()),paper);
            paper.questions=orderedGroups.flatMap(group=>group.items);
            return freezePaperValue(paper);
        };
        const stops=[observeCart(()=>{if(!disposed&&restored&&!guarding){cancel();syncMeta();}}),observeMeta(()=>{if(!disposed&&restored&&!guarding)persist();}),
            observeGroups(()=>{if(!disposed&&restored&&!guarding)persist();}),observeQuestions(()=>{if(!disposed&&restored){cancel();syncMeta();}}),
            observeMode(value=>{if(!disposed)preferences.set('qisi_export_mode',value);}),observeNavigation(cancel)];
        const attachPointer = port => { pointer?.dispose();pointer=port; };
        const startPointer = (id,event) => { if(!disposed&&state.cart.value.includes(id)&&lookup(id))pointer?.start(id,event); };
        const open = () => { if(!disposed){if(!restored)restore();syncGroups();onOpen();} };
        const dispose = () => { if(disposed)return;disposed=true;pointer?.dispose();stops.forEach(stop=>stop?.());state.dragging.value='';state.dragOver.value=''; };
        return Object.freeze({state,questions,lookup,ordered,missing,groups,groupConfig,groupSummary,syncMeta,syncGroups,restore,toggle,remove,typeIds,reorder,move,displayIndex,drop,reset,clear,snapshot,attachPointer,startPointer,open,dispose});
    };

    const createPointerDragPort = ({ document, window, raf, caf, later, cancelLater, afterRender, workspace }) => {
        let disposed = false, epoch = 0, examDragCleanup = null, expectedTypeIds = [], baselineSelect = '';
        const cart = workspace.state.cart;
        const draggingExamQuestionId = workspace.state.dragging, dragOverExamQuestionId = workspace.state.dragOver;
        const frames = new Set(), timers = new Set(), styles = new Map();
        const restoreStyles = () => { for (const [element, original] of styles) Object.assign(element.style, original); styles.clear(); document.body.classList.remove('exam-drag-active'); };
        const requestAnimationFrame = callback => { const requestEpoch = epoch; const id = raf(() => { frames.delete(id); if (!disposed && requestEpoch === epoch) callback(); }); frames.add(id); return id; };
        const cancelAnimationFrame = id => { frames.delete(id); caf(id); };
        const setTimeout = (callback,delay) => { const requestEpoch = epoch; const id = later(() => { timers.delete(id); if (!disposed && requestEpoch === epoch) { callback(); if (!examDragCleanup) restoreStyles(); } },delay); timers.add(id); return id; };
        const nextTick = callback => { const requestEpoch = epoch; afterRender(() => { if (!disposed && requestEpoch === epoch) callback(); }); };
        const reorderQuestionWithinType = (id,index) => workspace.reorder(id,index,expectedTypeIds);
        const startExamPointerDrag = (id, e) => {
                    if (e?.button !== undefined && e.button !== 0) return;
                    if (e?.target?.closest?.('button,input,select,textarea,a')) return;
                    const card = e?.currentTarget?.classList?.contains('exam-edit-card') ? e.currentTarget : e?.currentTarget?.closest?.('.exam-edit-card');
                    if (!card) return;
                    const section = card.closest('.exam-group-block');
                    if (!section) return;
                    e.preventDefault?.();

                    if (examDragCleanup) examDragCleanup(true);

                    const startY = e.clientY;
                    let started = false;
                    let targetIndex = 0;
                    let sourceIndex = 0;
                    let rects = [];
                    const previousSelect = document.body.style.userSelect;
                    try { card.setPointerCapture?.(e.pointerId); } catch (_) { /* synthetic or already released pointer */ }

                    let lastY = startY;
                    let frame = 0;
                    const cardsInSection = () => [...section.querySelectorAll('.exam-edit-card[data-exam-qid]')]
                        .filter(el => el.dataset.examQid);
                    const typeIndexOf = () => {
                        const sourceQ = workspace.lookup(id);
                        const type = sourceQ?.type || '其他题型';
                        return cart.value.filter(cartId => {
                            const q = workspace.lookup(cartId);
                            return q && (q.type || '其他题型') === type;
                        }).indexOf(id);
                    };
                    const beginDrag = () => {
                        if (started) return;
                        started = true;
                        sourceIndex = typeIndexOf();
                        targetIndex = sourceIndex;
                        rects = cardsInSection().map(el => {
                            const box = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return { el, top: box.top, height: box.height, gap: parseFloat(style.marginBottom) || 0 };
                        });
                        rects.forEach(item => {
                            item.el.style.transition = 'transform .18s ease-out, box-shadow .18s ease, border-color .18s ease';
                            item.el.style.willChange = 'transform';
                        });
                        card.style.transition = 'box-shadow .18s ease, border-color .18s ease';
                        card.style.zIndex = '8';
                        document.body.style.userSelect = 'none';
                        document.body.classList.add('exam-drag-active');
                        draggingExamQuestionId.value = id;
                        dragOverExamQuestionId.value = '';
                    };
                    const paintDrag = () => {
                        frame = 0;
                        const sourceItem = rects.find(item => item.el === card);
                        if (!sourceItem) return;
                        const sourceStep = sourceItem.height + sourceItem.gap;
                        const dragOffset = lastY - startY;
                        const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
                        rects.forEach((item, index) => {
                            if (item.el === card) return;
                            let offset = 0;
                            if (dragOffset > 0 && index > sourceIndex) {
                                const delay = Math.max(0, item.top - sourceItem.top - sourceStep);
                                offset = -clamp(dragOffset - delay, 0, sourceStep);
                            }
                            if (dragOffset < 0 && index < sourceIndex) {
                                const delay = Math.max(0, sourceItem.top - item.top - sourceStep);
                                offset = clamp(-dragOffset - delay, 0, sourceStep);
                            }
                            item.el.style.transform = offset ? `translate3d(0, ${offset}px, 0)` : '';
                        });
                        card.style.transform = `translate3d(0, ${dragOffset}px, 0)`;
                    };
                    const updateTarget = (clientY) => {
                        let nextIndex = rects.length - 1;
                        for (let i = 0; i < rects.length; i += 1) {
                            const center = rects[i].top + rects[i].height / 2;
                            if (clientY < center) {
                                nextIndex = i;
                                break;
                            }
                        }
                        targetIndex = Math.max(0, Math.min(nextIndex, rects.length - 1));
                        dragOverExamQuestionId.value = '';
                    };
                    const onMove = (ev) => {
                        if (ev.pointerId !== e.pointerId) return;
                        lastY = ev.clientY;
                        if (!started && Math.abs(lastY - startY) < 6) return;
                        beginDrag();
                        ev.preventDefault();
                        updateTarget(lastY);
                        if (!frame) frame = requestAnimationFrame(paintDrag);
                    };
                    const cleanup = (immediate = false) => {
                        document.removeEventListener('pointermove', onMove);
                        document.removeEventListener('pointerup', onEnd);
                        document.removeEventListener('pointercancel', onEnd);
                        window.removeEventListener('blur', onBlur);
                        document.removeEventListener('keydown', onKey);
                        try { card.releasePointerCapture?.(e.pointerId); } catch (_) { /* pointercancel may release capture first */ }
                        document.body.style.userSelect = previousSelect;
                        if (frame) cancelAnimationFrame(frame);
                        draggingExamQuestionId.value = '';
                        dragOverExamQuestionId.value = '';
                        const shouldAnimateReorder = started && !immediate && targetIndex !== sourceIndex;
                        if (!shouldAnimateReorder) document.body.classList.remove('exam-drag-active');
                        const clearStyles = () => {
                            rects.forEach(item => {
                                item.el.style.transform = '';
                                item.el.style.transition = '';
                                item.el.style.willChange = '';
                                item.el.style.zIndex = '';
                            });
                        };
                        if (shouldAnimateReorder) {
                            const visualTopById = new Map(rects.map(item => [item.el.dataset.examQid, item.el.getBoundingClientRect().top]));
                            rects.forEach(item => {
                                item.el.style.transition = 'none';
                                item.el.style.transform = '';
                                item.el.style.zIndex = '';
                            });
                            reorderQuestionWithinType(id, targetIndex);
                            nextTick(() => {
                                const freshCards = cardsInSection();
                                freshCards.forEach(el => {
                                    const firstTop = visualTopById.get(el.dataset.examQid);
                                    if (firstTop === undefined) return;
                                    const delta = firstTop - el.getBoundingClientRect().top;
                                    if (Math.abs(delta) > 1) {
                                        el.style.transition = 'none';
                                        el.style.transform = `translate3d(0, ${delta}px, 0)`;
                                        el.style.willChange = 'transform';
                                    }
                                });
                                requestAnimationFrame(() => {
                                    freshCards.forEach(el => {
                                        el.style.transition = 'transform .18s ease-out';
                                        el.style.transform = '';
                                    });
                                    setTimeout(() => {
                                        freshCards.forEach(el => {
                                            el.style.transition = '';
                                            el.style.willChange = '';
                                            el.style.zIndex = '';
                                        });
                                        document.body.classList.remove('exam-drag-active');
                                    }, 200);
                                });
                            });
                        } else {
                            clearStyles();
                        }
                        if (examDragCleanup === cleanup) examDragCleanup = null;
                    };
                    const onEnd = (ev) => {
                        if (ev.pointerId !== e.pointerId) return;
                        cleanup(ev.type === 'pointercancel');
                    };

                    const onBlur = () => cleanup(true);
                    const onKey = event => { if (event.key === 'Escape') cleanup(true); };
                    window.addEventListener('blur', onBlur);
                    document.addEventListener('keydown', onKey);
                    examDragCleanup = cleanup;
                    document.addEventListener('pointermove', onMove, { passive: false });
                    document.addEventListener('pointerup', onEnd);
                    document.addEventListener('pointercancel', onEnd);
                };
        const cancel = () => {
            epoch++; if (examDragCleanup) examDragCleanup(true);
            for(const id of frames)caf(id);frames.clear();for(const id of timers)cancelLater(id);timers.clear();
            if(styles.size)document.body.style.userSelect=baselineSelect;restoreStyles();
            draggingExamQuestionId.value='';dragOverExamQuestionId.value='';
        };
        const start = (id,event) => {
            if(disposed)return;cancel();expectedTypeIds=workspace.typeIds(id);if(!expectedTypeIds.includes(id))return;
            baselineSelect=document.body.style.userSelect;
            const card=event?.currentTarget?.closest?.('.exam-edit-card');
            for(const element of card?.closest('.exam-group-block')?.querySelectorAll('.exam-edit-card')||[])styles.set(element,{transform:element.style.transform,transition:element.style.transition,willChange:element.style.willChange,zIndex:element.style.zIndex});
            startExamPointerDrag(id,event);
        };
        const dispose = () => { if(disposed)return;cancel();disposed=true; };
        return Object.freeze({start,cancel,dispose});
    };
    return Object.freeze({ groupQuestions, reorderWithinType, createState, createWorkspace, createPointerDragPort });
});
