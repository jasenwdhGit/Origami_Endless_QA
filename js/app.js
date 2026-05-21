/**
 * QuizMaster - 主应用逻辑
 */

(function() {
    'use strict';

    // 应用状态
    const state = {
        mode: 'home',           // home | quiz | result
        quizMode: 'sequence',   // sequence | random | review
        typeFilter: 'all',      // all | single | multi | judge
        questions: [],
        displayQuestions: [],
        currentIndex: 0,
        selectedAnswer: null,
        selectedAnswers: [],    // 多选题选中答案数组
        answered: false,
        answeredRecords: [],    // 记录每题答题情况 {index: bool}
        userAnswers: [],        // 记录每题用户选择 {index: answer}
        stats: {
            correct: 0,
            wrong: 0
        },
        wrongAnswers: [],
        wrongStreakCount: {},    // 错题连续答对次数 {questionId: count}
        currentBankId: null      // 当前题库ID
    };

    // DOM元素缓存
    const DOM = {};

    /**
     * 初始化应用
     */
    function init() {
        cacheDOM();
        bindEvents();
        loadInitialState();
    }

    /**
     * 缓存DOM元素
     */
    function cacheDOM() {
        // Views
        DOM.homeView = document.getElementById('homeView');
        DOM.quizView = document.getElementById('quizView');
        DOM.resultView = document.getElementById('resultView');
        
        // Header
        DOM.modeTabs = document.getElementById('modeTabs');
        DOM.homeBtn = document.getElementById('homeBtn');
        DOM.wrongCountBadge = document.getElementById('wrongCount');
        DOM.statsMini = document.getElementById('statsMini');
        DOM.correctCountEl = document.getElementById('correctCount');
        DOM.wrongCountMiniEl = document.getElementById('wrongCountMini');
        
        // Home View
        DOM.uploadArea = document.getElementById('uploadArea');
        DOM.fileInput = document.getElementById('fileInput');
        DOM.selectFileBtn = document.getElementById('selectFileBtn');
        DOM.historySection = document.getElementById('historySection');
        DOM.historyList = document.getElementById('historyList');
        DOM.questionBankSection = document.getElementById('questionBankSection');
        DOM.questionBankList = document.getElementById('questionBankList');
        
        // Quiz View
        DOM.progressFill = document.getElementById('progressFill');
        DOM.progressText = document.getElementById('progressText');
        DOM.progressTrack = document.getElementById('progressTrack');
        DOM.progressDots = document.getElementById('progressDots');
        DOM.quizContainer = document.getElementById('quizContainer');
        DOM.questionCard = document.getElementById('questionCard');
        DOM.questionNumber = document.getElementById('questionNumber');
        DOM.questionType = document.getElementById('questionType');
        DOM.questionContent = document.getElementById('questionContent');
        DOM.optionsList = document.getElementById('optionsList');
        DOM.submitBtn = document.getElementById('submitBtn');
        DOM.nextBtn = document.getElementById('nextBtn');
        DOM.prevBtn = document.getElementById('prevBtn');
        DOM.nextQuestionBtn = document.getElementById('nextQuestionBtn');
        DOM.currentIndicator = document.getElementById('currentIndicator');
        
        // Picker
        DOM.pickerTrigger = document.getElementById('pickerTrigger');
        DOM.questionPicker = document.getElementById('questionPicker');
        DOM.pickerGrid = document.getElementById('pickerGrid');

        // Type Filter
        DOM.typeFilter = document.getElementById('typeFilter');
        
        // Result View
        DOM.resultIcon = document.getElementById('resultIcon');
        DOM.resultTitle = document.getElementById('resultTitle');
        DOM.totalQuestionsEl = document.getElementById('totalQuestions');
        DOM.finalCorrectEl = document.getElementById('finalCorrect');
        DOM.finalWrongEl = document.getElementById('finalWrong');
        DOM.accuracyEl = document.getElementById('accuracy');
        DOM.wrongListSection = document.getElementById('wrongList');
        DOM.wrongItemsEl = document.getElementById('wrongItems');
        DOM.reviewWrongBtn = document.getElementById('reviewWrongBtn');
        DOM.restartBtn = document.getElementById('restartBtn');
        
        // Toast
        DOM.toast = document.getElementById('toast');
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        // 文件上传
        DOM.uploadArea.addEventListener('click', () => DOM.fileInput.click());
        DOM.selectFileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            DOM.fileInput.click();
        });
        DOM.fileInput.addEventListener('change', handleFileSelect);
        
        // 拖拽上传
        DOM.uploadArea.addEventListener('dragover', handleDragOver);
        DOM.uploadArea.addEventListener('dragleave', handleDragLeave);
        DOM.uploadArea.addEventListener('drop', handleDrop);
        
        // 模式切换
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', () => switchQuizMode(tab.dataset.mode));
        });
        
        // 首页按钮
        DOM.homeBtn.addEventListener('click', goHome);
        
        // 答题相关
        DOM.submitBtn.addEventListener('click', submitAnswer);
        DOM.nextBtn.addEventListener('click', () => nextQuestionFromNav());
        DOM.prevBtn.addEventListener('click', prevQuestion);
        DOM.nextQuestionBtn.addEventListener('click', () => nextQuestionFromNav());
        
        // 进度条点击
        if (DOM.progressTrack) {
            DOM.progressTrack.addEventListener('click', handleProgressClick);
        }
        
        // 题目选择器
        if (DOM.pickerTrigger) {
            DOM.pickerTrigger.addEventListener('click', togglePicker);
        }
        document.addEventListener('click', handleOutsideClick);
        
        // 题型筛选
        if (DOM.typeFilter) {
            DOM.typeFilter.addEventListener('change', handleTypeFilterChange);
        }
        
        // 结果页按钮
        DOM.restartBtn.addEventListener('click', restartQuiz);
        DOM.reviewWrongBtn.addEventListener('click', reviewWrongAnswers);
        
        // 滑屏手势
        initSwipeGesture();
    }

    /**
     * 加载初始状态
     */
    function loadInitialState() {
        // 加载错题数
        updateWrongCountBadge();
        
        // 加载历史记录
        renderHistory();
        
        // 加载题库列表
        renderQuestionBankList();
    }

    // ==================== 文件上传相关 ====================

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        DOM.uploadArea.classList.add('dragover');
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        DOM.uploadArea.classList.remove('dragover');
    }

    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        DOM.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    }

    async function processFile(file) {
        // 验证文件类型
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        const validExtensions = ['.xlsx', '.xls'];
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!validExtensions.includes(extension)) {
            showToast('请上传 Excel 文件 (.xlsx, .xls)', 'error');
            return;
        }

        try {
            showToast('正在解析文件...', 'info');
            
            const questions = await ExcelParser.parse(file);
            
            // 保存到本地存储
            Storage.saveQuestions(questions);
            
            // 保存题库记录
            const bankName = file.name.replace(/\.(xlsx|xls)$/i, '');
            const savedBank = Storage.saveQuestionBank({
                name: bankName,
                fileName: file.name,
                questionCount: questions.length,
                questionIds: questions.map(q => q.id)
            });
            
            // 获取保存后的题库ID
            const banks = Storage.getQuestionBanks();
            const currentBank = banks.find(b => b.name === bankName);
            state.currentBankId = currentBank ? currentBank.id : null;
            
            // 更新状态
            state.questions = questions;
            
            showToast(`成功加载 ${questions.length} 道题目`, 'success');
            
            // 刷新题库列表
            renderQuestionBankList();
            
            // 开始刷题
            startQuiz('sequence');
            
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // ==================== 模式切换 ====================

    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const viewMap = {
            home: DOM.homeView,
            quiz: DOM.quizView,
            result: DOM.resultView
        };
        
        if (viewMap[viewName]) {
            viewMap[viewName].classList.add('active');
        }
        
        // 更新header显示
        const isQuizMode = viewName === 'quiz';
        DOM.modeTabs.style.display = isQuizMode ? 'flex' : 'none';
        DOM.homeBtn.style.display = isQuizMode ? 'flex' : 'none';
        DOM.statsMini.style.display = isQuizMode ? 'flex' : 'none';
        
        // 题型筛选仅在刷题模式显示
        if (DOM.typeFilter && DOM.typeFilter.parentElement) {
            DOM.typeFilter.parentElement.style.display = isQuizMode ? '' : 'none';
        }
        
        state.mode = viewName;
    }

    function switchQuizMode(mode) {
        if (mode === 'review' && Storage.getWrongAnswers().length === 0) {
            showToast('暂无错题可复习', 'info');
            return;
        }
        
        // 更新tab样式
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        
        // 重新开始刷题
        startQuiz(mode);
    }

    function goHome() {
        state.currentBankId = null;
        switchView('home');
        renderHistory();
        renderQuestionBankList();
    }

    // ==================== 刷题逻辑 ====================

    function startQuiz(mode) {
        state.quizMode = mode;
        state.currentIndex = 0;
        state.selectedAnswer = null;
        state.selectedAnswers = [];
        state.answered = false;
        state.stats = { correct: 0, wrong: 0 };
        state.wrongAnswers = [];
        state.wrongStreakCount = {};  // 重置连续答对计数
        state.answeredRecords = {};
        state.userAnswers = {};
        // 注意：currentBankId 由调用方设置，quiz模式下不清空
        
        // 设置题型筛选默认值
        if (DOM.typeFilter) {
            DOM.typeFilter.value = 'all';
        }
        state.typeFilter = 'all';
        
        // 获取原始题目数组（顺序刷题和随机刷题共用）
        const allQuestions = Storage.getQuestions();
        
        if (mode === 'random') {
            // 随机刷题：打乱顺序，但使用原始题目对象
            state.questions = shuffleArray([...allQuestions]);
        } else if (mode === 'review') {
            const wrongIds = Storage.getWrongAnswers().map(w => w.questionId);
            state.questions = allQuestions.filter(q => wrongIds.includes(q.id));
        } else {
            // 顺序刷题：使用原始顺序
            state.questions = [...allQuestions];
        }
        
        // 应用题型筛选
        applyTypeFilter();
        
        // 检查是否有保存的答题进度
        const savedProgress = Storage.getQuizProgress();
        const questionIds = state.displayQuestions.map(q => q.id).sort().join(',');
        const savedIds = savedProgress?.questionIds?.sort()?.join(',');
        
        if (savedProgress && savedProgress.questionIds && questionIds === savedIds) {
            // 恢复答题进度
            state.currentIndex = savedProgress.currentIndex || 0;
            state.answeredRecords = savedProgress.answeredRecords || {};
            state.userAnswers = savedProgress.userAnswers || {};
            state.stats = savedProgress.stats || { correct: 0, wrong: 0 };
            
            // 重新计算错题列表
            Object.entries(state.answeredRecords).forEach(([qId, result]) => {
                if (result === false) {
                    const question = state.displayQuestions.find(q => q.id === qId);
                    if (question && !state.wrongAnswers.find(w => w.id === qId)) {
                        state.wrongAnswers.push(question);
                    }
                }
            });
            
            // 渲染恢复的题目
            updateStats();
            switchView('quiz');
            renderQuestion();
            
            // 如果当前题目已答题，renderQuestion 会自动恢复显示状态
            
            return;
        }
        
        // 没有保存的进度，从头开始
        // 更新UI
        updateStats();
        switchView('quiz');
        
        // 渲染第一题
        renderQuestion();
    }

    /**
     * 应用题型筛选
     */
    function applyTypeFilter() {
        if (state.typeFilter === 'all') {
            state.displayQuestions = [...state.questions];
        } else {
            state.displayQuestions = state.questions.filter(q => q.type === state.typeFilter);
        }
        // 重置索引
        state.currentIndex = 0;
    }

    /**
     * 题型筛选变更
     */
    function handleTypeFilterChange() {
        if (!DOM.typeFilter) return;
        state.typeFilter = DOM.typeFilter.value;
        
        // 清除进度缓存
        Storage.clearQuizProgress();
        
        // 重置状态
        state.currentIndex = 0;
        state.selectedAnswer = null;
        state.selectedAnswers = [];
        state.answered = false;
        state.stats = { correct: 0, wrong: 0 };
        state.wrongAnswers = [];
        state.wrongStreakCount = {};
        state.answeredRecords = {};
        state.userAnswers = {};
        
        // 重新筛选
        applyTypeFilter();
        
        // 如果没有匹配的题目
        if (state.displayQuestions.length === 0) {
            showToast('该题型暂无题目', 'info');
            return;
        }
        
        // 更新UI
        updateStats();
        renderQuestion();
    }

    function renderQuestion() {
        const question = state.displayQuestions[state.currentIndex];
        if (!question) {
            finishQuiz();
            return;
        }
        
        // 更新进度 - 显示当前题目的原始题号
        const currentOriginalIndex = state.currentIndex + 1;
        const progress = ((state.currentIndex + 1) / state.displayQuestions.length) * 100;
        DOM.progressFill.style.width = `${progress}%`;
        DOM.progressText.textContent = `${currentOriginalIndex} / ${state.displayQuestions.length}`;
        DOM.currentIndicator.textContent = `${currentOriginalIndex} / ${state.displayQuestions.length}`;
        
        // 更新导航按钮
        DOM.prevBtn.disabled = state.currentIndex === 0;
        DOM.nextQuestionBtn.disabled = false;
        
        // 渲染进度点
        renderProgressDots();
        
        // 更新题目 - 显示原始题号
        DOM.questionNumber.textContent = `第 ${currentOriginalIndex} 题`;
        const typeLabels = {
            'single': '单选题',
            'multi': '多选题',
            'judge': '判断题'
        };
        DOM.questionType.textContent = typeLabels[question.type] || '单选题';
        DOM.questionContent.textContent = question.question;
        
        // 渲染选项
        const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        const optionIcons = {
            correct: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>`,
            wrong: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>`
        };
        
        DOM.optionsList.innerHTML = question.options.map((option, index) => `
            <div class="option-item" data-value="${optionLabels[index]}">
                <span class="option-marker">${optionLabels[index]}</span>
                <span class="option-text">${option}</span>
                <span class="option-icon correct-icon">${optionIcons.correct}</span>
                <span class="option-icon wrong-icon">${optionIcons.wrong}</span>
            </div>
        `).join('');
        
        // 绑定选项点击事件
        DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
            item.addEventListener('click', () => selectOption(item));
        });
        
        // 检查是否有之前的作答记录（用原始题目ID查找）
        const prevAnswer = state.userAnswers ? state.userAnswers[question.id] : undefined;
        const prevResult = state.answeredRecords ? state.answeredRecords[question.id] : undefined;
        
        if (prevAnswer !== undefined) {
            // 显示之前的作答
            state.selectedAnswer = prevAnswer;
            
            // 多选题：需要恢复多个选中项
            if (question.type === 'multi') {
                state.selectedAnswers = prevAnswer.split('');
                state.selectedAnswers.forEach(ans => {
                    const optionEl = DOM.optionsList.querySelector(`[data-value="${ans}"]`);
                    if (optionEl) optionEl.classList.add('selected');
                });
            } else {
                state.selectedAnswers = [prevAnswer];
                const optionEl = DOM.optionsList.querySelector(`[data-value="${prevAnswer}"]`);
                if (optionEl) optionEl.classList.add('selected');
            }
            
            // 如果之前已提交，显示对错状态
            if (prevResult !== undefined && prevResult !== null) {
                state.answered = true;
                DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                    item.classList.add('disabled');
                });
                
                // 多选题显示逻辑
                if (question.type === 'multi') {
                    const correctAnswers = question.answer.split('');
                    const userAnswersArr = prevAnswer.split('');
                    
                    DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                        const val = item.dataset.value;
                        const isCorrectAnswer = correctAnswers.includes(val);
                        const isUserAnswer = userAnswersArr.includes(val);
                        
                        if (isCorrectAnswer && isUserAnswer) {
                            item.classList.add('correct');
                            item.querySelector('.correct-icon').style.display = 'block';
                        } else if (isUserAnswer && !isCorrectAnswer) {
                            item.classList.add('wrong');
                            item.querySelector('.wrong-icon').style.display = 'block';
                        } else if (isCorrectAnswer && !isUserAnswer) {
                            // 漏选的正确答案
                            item.classList.add('correct');
                            item.querySelector('.correct-icon').style.display = 'block';
                        }
                    });
                } else {
                    // 单选题显示逻辑
                    DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                        if (item.classList.contains('selected')) {
                            if (prevResult === true) {
                                item.classList.add('correct');
                                item.querySelector('.correct-icon').style.display = 'block';
                            } else {
                                item.classList.add('wrong');
                                item.querySelector('.wrong-icon').style.display = 'block';
                            }
                        }
                        if (item.dataset.value === question.answer && prevResult === false) {
                            item.classList.add('correct');
                            item.querySelector('.correct-icon').style.display = 'block';
                        }
                    });
                }
                
                DOM.submitBtn.style.display = 'none';
                DOM.nextBtn.style.display = 'inline-flex';
            }
            DOM.submitBtn.disabled = prevResult !== undefined && prevResult !== null;
        } else {
            // 重置状态
            state.selectedAnswer = null;
            state.selectedAnswers = [];
            state.answered = false;
            DOM.submitBtn.disabled = true;
            DOM.submitBtn.style.display = 'inline-flex';
            DOM.nextBtn.style.display = 'none';
        }
        
        // 禁用所有选项（如果已答题则不允许修改）
        if (state.answered) {
            DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                item.classList.add('disabled');
            });
        }
        
        // 卡片动画
        DOM.questionCard.style.animation = 'none';
        DOM.questionCard.offsetHeight;
        DOM.questionCard.style.animation = 'slideIn 0.3s ease';
    }

    function selectOption(optionEl) {
        if (state.answered) return;
        
        const question = state.displayQuestions[state.currentIndex];
        const value = optionEl.dataset.value;
        
        // 多选题：可以选中多个
        if (question.type === 'multi') {
            optionEl.classList.toggle('selected');
            optionEl.classList.add('ripple');
            setTimeout(() => optionEl.classList.remove('ripple'), 400);
            
            // 收集所有选中的答案
            const selectedOptions = DOM.optionsList.querySelectorAll('.option-item.selected');
            state.selectedAnswers = Array.from(selectedOptions).map(el => el.dataset.value);
            state.selectedAnswer = state.selectedAnswers.join('');
        } else {
            // 单选题/判断题：只允许选中一个
            DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                item.classList.remove('selected');
            });
            optionEl.classList.add('selected');
            optionEl.classList.add('ripple');
            setTimeout(() => optionEl.classList.remove('ripple'), 400);
            state.selectedAnswer = value;
            state.selectedAnswers = [value];
            
            // 单选题选择后自动提交
            setTimeout(() => {
                if (!state.answered && state.selectedAnswer) {
                    submitAnswer();
                }
            }, 100);
        }
        
        DOM.submitBtn.disabled = !state.selectedAnswer;
    }

    function renderProgressDots() {
        if (!DOM.progressDots) return;
        const total = state.displayQuestions.length;
        if (total <= 20) {
            DOM.progressDots.innerHTML = state.displayQuestions.map((q, i) => {
                let className = 'progress-dot';
                // 获取原始题目ID
                const questionId = q.id;
                // 用原始题目ID查找答题状态
                const answeredResult = state.answeredRecords ? state.answeredRecords[questionId] : undefined;
                
                if (i === state.currentIndex) {
                    className += ' current';
                } else if (answeredResult !== undefined) {
                    className += ' answered';
                    if (answeredResult === true) {
                        className += ' correct';
                    } else if (answeredResult === false) {
                        className += ' wrong';
                    } else {
                        className += ' skipped';
                    }
                }
                const pos = (i / (total - 1)) * 100;
                return `<div class="${className}" data-index="${i}" style="left: ${pos}%"></div>`;
            }).join('');
            
            // 绑定点击事件
            DOM.progressDots.querySelectorAll('.progress-dot').forEach(dot => {
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    jumpToQuestion(parseInt(dot.dataset.index));
                });
            });
        } else {
            DOM.progressDots.innerHTML = '';
        }
    }

    function handleProgressClick(e) {
        if (e.target.classList.contains('progress-dot')) return;
        if (!DOM.progressTrack) return;
        
        const rect = DOM.progressTrack.getBoundingClientRect();
        if (!rect || rect.width === 0 || rect.height === 0) return;
        
        const clickPos = (e.clientX - rect.left) / rect.width;
        const targetIndex = Math.round(clickPos * (state.displayQuestions.length - 1));
        jumpToQuestion(Math.max(0, Math.min(targetIndex, state.displayQuestions.length - 1)));
    }

    function jumpToQuestion(index) {
        if (index === state.currentIndex) return;
        
        const currentQuestion = state.displayQuestions[state.currentIndex];
        
        // 如果未答题，标记为跳过（用原始题目ID）
        if (!state.answered && state.selectedAnswer === null) {
            if (!state.answeredRecords) state.answeredRecords = {};
            state.answeredRecords[currentQuestion.id] = null;
            saveQuizProgress();
        }
        
        state.currentIndex = index;
        state.selectedAnswer = null;
        state.selectedAnswers = [];
        state.answered = false;
        renderQuestion();
    }

    function prevQuestion() {
        if (state.currentIndex > 0) {
            const currentQuestion = state.displayQuestions[state.currentIndex];
            // 如果未答题，标记为跳过（用原始题目ID）
            if (!state.answered && state.selectedAnswer === null) {
                if (!state.answeredRecords) state.answeredRecords = {};
                state.answeredRecords[currentQuestion.id] = null;
                saveQuizProgress();
            }
            state.currentIndex--;
            renderQuestion();
        }
    }

    function nextQuestionFromNav() {
        if (!state.answered) {
            if (state.selectedAnswer) {
                // 有选择但未提交，先提交
                submitAnswer();
            } else {
                // 未选择，标记跳过并下一题（用原始题目ID）
                const currentQuestion = state.displayQuestions[state.currentIndex];
                if (!state.answeredRecords) state.answeredRecords = {};
                state.answeredRecords[currentQuestion.id] = null;
                saveQuizProgress();
            }
        }
        nextQuestion();
    }

    function togglePicker(e) {
        if (!DOM.questionPicker || !DOM.pickerTrigger) return;
        if (e) e.stopPropagation();
        
        const isOpen = DOM.questionPicker.classList.contains('show');
        
        if (isOpen) {
            // 收起
            DOM.questionPicker.classList.remove('show');
            DOM.pickerTrigger.classList.remove('active');
        } else {
            // 展开
            DOM.questionPicker.classList.add('show');
            DOM.pickerTrigger.classList.add('active');
            renderPickerGrid();
        }
    }

    function handleOutsideClick(e) {
        if (!DOM.questionPicker || !DOM.pickerTrigger) return;
        if (!DOM.questionPicker.contains(e.target) && !DOM.pickerTrigger.contains(e.target)) {
            DOM.questionPicker.classList.remove('show');
            DOM.pickerTrigger.classList.remove('active');
        }
    }

    function renderPickerGrid() {
        if (!DOM.pickerGrid) return;
        const total = state.displayQuestions.length;
        DOM.pickerGrid.innerHTML = state.displayQuestions.map((q, i) => {
            let className = 'picker-item';
            // 获取原始题目ID
            const questionId = q.id;
            // 用原始题目ID查找答题状态
            const answeredResult = state.answeredRecords ? state.answeredRecords[questionId] : undefined;
            
            if (i === state.currentIndex) {
                className += ' current';
            } else if (answeredResult !== undefined) {
                if (answeredResult === null) {
                    className += ' skipped';
                } else {
                    className += answeredResult ? ' correct' : ' wrong';
                }
            }
            // 显示原始题号
            return `<div class="${className}" data-index="${i}">${questionId}</div>`;
        }).join('');
        
        // 绑定点击事件
        DOM.pickerGrid.querySelectorAll('.picker-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(item.dataset.index);
                DOM.questionPicker.classList.remove('show');
                DOM.pickerTrigger.classList.remove('active');
                jumpToQuestion(index);
            });
        });
    }

    function initSwipeGesture() {
        if (!DOM.quizContainer) return;
        
        let startX = 0;
        let startY = 0;
        let isSwiping = false;
        const MIN_SWIPE_DISTANCE = 50;

        DOM.quizContainer.addEventListener('touchstart', (e) => {
            if (state.answered) return;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwiping = true;
        }, { passive: true });

        DOM.quizContainer.addEventListener('touchmove', (e) => {
            if (!isSwiping || state.answered) return;
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = startX - currentX;
            const diffY = startY - currentY;
            
            // 如果是水平滑动，阻止默认行为
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                e.preventDefault();
            }
        }, { passive: false });

        DOM.quizContainer.addEventListener('touchend', (e) => {
            if (!isSwiping || state.answered) {
                isSwiping = false;
                return;
            }
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // 判断是否为水平滑动
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > MIN_SWIPE_DISTANCE) {
                if (diffX > 0) {
                    // 左滑 -> 下一题
                    nextQuestion();
                } else {
                    // 右滑 -> 上一题
                    prevQuestion();
                }
            }
            
            isSwiping = false;
        }, { passive: true });
    }

    function submitAnswer() {
        if (!state.selectedAnswer || state.answered) return;
        
        state.answered = true;
        const question = state.displayQuestions[state.currentIndex];
        
        // 初始化记录对象（如果不存在）
        if (!state.userAnswers) state.userAnswers = {};
        if (!state.answeredRecords) state.answeredRecords = {};
        
        // 多选题：答案排序后比较
        const userAnswer = question.type === 'multi' 
            ? state.selectedAnswers.sort().join('')
            : state.selectedAnswer;
        const correctAnswer = question.type === 'multi'
            ? question.answer.split('').sort().join('')
            : question.answer;
        const isCorrect = userAnswer === correctAnswer;
        
        // 用原始题目ID记录用户答案
        state.userAnswers[question.id] = userAnswer;
        // 用原始题目ID记录答题结果
        state.answeredRecords[question.id] = isCorrect;
        
        // 禁用选项点击
        DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
            item.classList.add('disabled');
        });
        
        // 多选题显示逻辑
        if (question.type === 'multi') {
            const correctAnswers = question.answer.split('');
            DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                const val = item.dataset.value;
                const isCorrectAnswer = correctAnswers.includes(val);
                const isUserAnswer = state.selectedAnswers.includes(val);
                
                if (isCorrectAnswer && isUserAnswer) {
                    // 选对了：绿色背景 + 绿色✓
                    item.classList.add('correct');
                    item.querySelector('.correct-icon').style.display = 'block';
                    item.querySelector('.wrong-icon').style.display = 'none';
                } else if (isUserAnswer && !isCorrectAnswer) {
                    // 选错了：红色背景 + 红色×
                    item.classList.add('wrong');
                    item.querySelector('.correct-icon').style.display = 'none';
                    item.querySelector('.wrong-icon').style.display = 'block';
                } else if (isCorrectAnswer && !isUserAnswer) {
                    // 漏选的正确答案：添加missed类，绿色背景 + 红色×
                    item.classList.add('correct', 'missed');
                    item.querySelector('.correct-icon').style.display = 'none';
                    item.querySelector('.wrong-icon').style.display = 'block';
                }
            });
        } else {
            // 单选题显示逻辑
            DOM.optionsList.querySelectorAll('.option-item').forEach(item => {
                // 标记正确答案
                if (item.dataset.value === correctAnswer) {
                    item.classList.add('correct');
                    item.querySelector('.correct-icon').style.display = 'block';
                    item.querySelector('.wrong-icon').style.display = 'none';
                }
                // 标记错误答案
                else if (item.classList.contains('selected')) {
                    item.classList.add('wrong');
                    item.querySelector('.correct-icon').style.display = 'none';
                    item.querySelector('.wrong-icon').style.display = 'block';
                }
            });
        }
        
        // 更新统计
        if (isCorrect) {
            state.stats.correct++;
            
            // 错题复习模式：连续答对3次移除
            if (state.quizMode === 'review') {
                const qId = question.id;
                state.wrongStreakCount[qId] = (state.wrongStreakCount[qId] || 0) + 1;
                
                if (state.wrongStreakCount[qId] >= 3) {
                    // 连续答对3次，从错题记录和错题列表中移除
                    Storage.removeWrongAnswer(qId);
                    state.wrongAnswers = state.wrongAnswers.filter(q => q.id !== qId);
                    updateWrongCountBadge();
                    
                    // 从当前错题列表移除（只针对错题复习模式）
                    state.displayQuestions = state.displayQuestions.filter(q => q.id !== qId);
                    
                    // 如果没有剩余错题，完成练习
                    if (state.displayQuestions.length === 0) {
                        finishQuiz();
                        return;
                    }
                    
                    // 如果当前题被移除，跳到下一题
                    if (state.currentIndex >= state.displayQuestions.length) {
                        state.currentIndex = state.displayQuestions.length - 1;
                    }
                }
            }
        } else {
            state.stats.wrong++;
            // 重置该题的连续答对计数
            state.wrongStreakCount[question.id] = 0;
            // 记录错题
            Storage.addWrongAnswer({
                questionId: question.id,
                question: question.question,
                options: question.options,  // 保存选项数据
                userAnswer: state.selectedAnswer,
                correctAnswer: question.answer,
                bankId: state.currentBankId
            });
            updateWrongCountBadge();
            state.wrongAnswers.push(question);
        }
        
        updateStats();
        renderProgressDots();
        
        // 更新导航按钮
        DOM.nextQuestionBtn.disabled = false;
        DOM.prevBtn.disabled = true;
        
        // 更新按钮
        DOM.submitBtn.style.display = 'none';
        DOM.nextBtn.style.display = 'inline-flex';
        
        // 保存答题进度
        saveQuizProgress();
        
        // 答案正确则自动跳转下一题
        if (isCorrect) {
            setTimeout(() => {
                nextQuestion();
            }, 800);
        }
    }

    function nextQuestion() {
        state.currentIndex++;
        
        if (state.currentIndex >= state.displayQuestions.length) {
            finishQuiz();
        } else {
            renderQuestion();
        }
    }

    function finishQuiz() {
        // 清除答题进度
        Storage.clearQuizProgress();
        
        // 保存历史
        Storage.saveHistory({
            mode: state.quizMode,
            total: state.displayQuestions.length,
            correct: state.stats.correct,
            wrong: state.stats.wrong,
            accuracy: Math.round((state.stats.correct / state.displayQuestions.length) * 100)
        });
        
        // 渲染结果
        renderResult();
        switchView('result');
    }

    function renderResult() {
        const total = state.displayQuestions.length;
        const correct = state.stats.correct;
        const wrong = state.stats.wrong;
        const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        // 更新统计
        DOM.totalQuestionsEl.textContent = total;
        DOM.finalCorrectEl.textContent = correct;
        DOM.finalWrongEl.textContent = wrong;
        DOM.accuracyEl.textContent = `${accuracy}%`;
        
        // 更新图标和标题
        if (accuracy >= 80) {
            DOM.resultIcon.className = 'result-icon success';
            DOM.resultIcon.innerHTML = `
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            `;
            DOM.resultTitle.textContent = '太棒了！';
        } else if (accuracy >= 60) {
            DOM.resultIcon.className = 'result-icon info';
            DOM.resultIcon.innerHTML = `
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
            `;
            DOM.resultTitle.textContent = '还不错！';
        } else {
            DOM.resultIcon.className = 'result-icon info';
            DOM.resultIcon.innerHTML = `
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            `;
            DOM.resultTitle.textContent = '继续加油！';
        }
        
        // 渲染错题列表
        if (state.wrongAnswers.length > 0) {
            DOM.wrongListSection.style.display = 'block';
            DOM.reviewWrongBtn.style.display = 'inline-flex';
            
            DOM.wrongItemsEl.innerHTML = state.wrongAnswers.map(q => {
                const wrongRecord = Storage.getWrongAnswers().find(w => w.questionId === q.id);
                return `
                    <div class="wrong-item">
                        <div class="wrong-item-question">${q.question}</div>
                        <div class="wrong-item-answers">
                            <span class="your">你的答案: ${wrongRecord?.userAnswer || '-'}</span>
                            <span class="correct">正确答案: ${q.answer}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            DOM.wrongListSection.style.display = 'none';
            DOM.reviewWrongBtn.style.display = 'none';
        }
    }

    function restartQuiz() {
        startQuiz(state.quizMode);
    }

    function reviewWrongAnswers() {
        startQuiz('review');
    }

    // ==================== UI更新 ====================

    function updateStats() {
        DOM.correctCountEl.textContent = state.stats.correct;
        DOM.wrongCountMiniEl.textContent = state.stats.wrong;
    }

    /**
     * 保存答题进度到本地缓存
     */
    function saveQuizProgress() {
        // 不保存复习模式
        if (state.quizMode === 'review') return;
        
        Storage.saveQuizProgress({
            currentIndex: state.currentIndex,
            answeredRecords: state.answeredRecords,
            userAnswers: state.userAnswers,
            stats: state.stats,
            bankId: state.currentBankId,
            quizMode: state.quizMode,
            questionIds: state.displayQuestions.map(q => q.id)
        });
    }

    function updateWrongCountBadge() {
        const count = Storage.getWrongAnswers().length;
        DOM.wrongCountBadge.textContent = count;
        DOM.wrongCountBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    function renderHistory() {
        const history = Storage.getHistory();
        
        if (history.length === 0) {
            DOM.historySection.style.display = 'none';
            return;
        }
        
        DOM.historySection.style.display = 'block';
        
        const modeLabels = {
            sequence: '顺序刷题',
            random: '随机刷题',
            review: '错题复习'
        };
        
        DOM.historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-item-info">
                    <span class="history-item-title">${modeLabels[item.mode]}</span>
                    <span class="history-item-meta">${item.total}题 | ${formatTime(item.timestamp)}</span>
                </div>
                <div class="history-item-stats">
                    <div class="history-stat">
                        <span class="history-stat-value correct">${item.correct}</span>
                        <span class="history-stat-label">正确</span>
                    </div>
                    <div class="history-stat">
                        <span class="history-stat-value wrong">${item.wrong}</span>
                        <span class="history-stat-label">错误</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderQuestionBankList() {
        const banks = Storage.getQuestionBanks();
        
        if (banks.length === 0) {
            DOM.questionBankSection.style.display = 'none';
            return;
        }
        
        DOM.questionBankSection.style.display = 'block';
        
        DOM.questionBankList.innerHTML = banks.map(bank => {
            const wrongCount = Storage.getWrongAnswersForBank(bank.id).length;
            return `
                <div class="question-bank-item" data-bank-id="${bank.id}">
                    <div class="question-bank-info">
                        <div class="question-bank-icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                        </div>
                        <div class="question-bank-details">
                            <div class="question-bank-name">${bank.name}</div>
                            <div class="question-bank-meta">${bank.questionCount}题 | ${formatTime(bank.updatedAt)}</div>
                        </div>
                    </div>
                    <div class="question-bank-actions">
                        <button class="question-bank-btn secondary" onclick="loadQuestionBank(${bank.id})" title="继续练习">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            继续
                        </button>
                        ${wrongCount > 0 ? `
                        <button class="question-bank-btn danger" onclick="downloadBankWrongAnswers(${bank.id}, '${bank.name}')" title="下载错题库">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            错题(${wrongCount})
                        </button>
                        ` : ''}
                        <button class="question-bank-btn danger" onclick="deleteQuestionBank(${bank.id})" title="删除记录">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function loadQuestionBank(bankId) {
        const banks = Storage.getQuestionBanks();
        const bank = banks.find(b => b.id === bankId);
        
        if (!bank) {
            showToast('题库记录不存在', 'error');
            return;
        }
        
        const questions = Storage.getQuestions();
        
        if (questions.length === 0 || !bank.questionIds) {
            showToast('题库数据已丢失，请重新上传', 'error');
            return;
        }
        
        // 检查题目ID是否匹配
        const currentIds = questions.map(q => q.id).sort();
        const bankIds = [...bank.questionIds].sort();
        const isMatch = currentIds.length === bankIds.length && currentIds.every((id, i) => id === bankIds[i]);
        
        if (!isMatch) {
            showToast('当前题库与记录不匹配，请重新上传', 'error');
            return;
        }
        
        // 设置当前题库ID
        state.currentBankId = bankId;
        
        showToast(`已加载 "${bank.name}"`, 'success');
        startQuiz('sequence');
    }

    function downloadBankWrongAnswers(bankId, bankName) {
        Storage.downloadWrongAnswers(bankId, bankName);
        showToast('错题库下载成功', 'success');
    }

    function deleteQuestionBank(bankId) {
        if (confirm('确定要删除这条题库记录吗？')) {
            Storage.deleteQuestionBank(bankId);
            renderQuestionBankList();
            showToast('已删除题库记录', 'success');
        }
    }

    // 将函数暴露到全局，以便HTML onclick调用
    window.loadQuestionBank = loadQuestionBank;
    window.downloadBankWrongAnswers = downloadBankWrongAnswers;
    window.deleteQuestionBank = deleteQuestionBank;

    // ==================== 工具函数 ====================

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    function showToast(message, type = 'info') {
        DOM.toast.querySelector('.toast-message').textContent = message;
        DOM.toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            DOM.toast.classList.remove('show');
        }, 2500);
    }

    // ==================== 启动应用 ====================

    document.addEventListener('DOMContentLoaded', init);

})();
