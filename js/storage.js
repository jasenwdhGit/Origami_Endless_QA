/**
 * Storage Module - 本地存储管理
 */

const Storage = {
    KEYS: {
        QUESTIONS: 'quizmaster_questions',
        WRONG_ANSWERS: 'quizmaster_wrong',
        HISTORY: 'quizmaster_history',
        SETTINGS: 'quizmaster_settings',
        QUESTION_BANKS: 'quizmaster_question_banks'
    },

    /**
     * 保存题目
     */
    saveQuestions(questions) {
        try {
            localStorage.setItem(this.KEYS.QUESTIONS, JSON.stringify(questions));
            return true;
        } catch (e) {
            console.error('保存题目失败:', e);
            return false;
        }
    },

    /**
     * 读取题目
     */
    getQuestions() {
        try {
            const data = localStorage.getItem(this.KEYS.QUESTIONS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取题目失败:', e);
            return [];
        }
    },

    /**
     * 保存错题
     */
    saveWrongAnswers(wrongAnswers) {
        try {
            localStorage.setItem(this.KEYS.WRONG_ANSWERS, JSON.stringify(wrongAnswers));
            return true;
        } catch (e) {
            console.error('保存错题失败:', e);
            return false;
        }
    },

    /**
     * 读取错题
     */
    getWrongAnswers() {
        try {
            const data = localStorage.getItem(this.KEYS.WRONG_ANSWERS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取错题失败:', e);
            return [];
        }
    },

    /**
     * 添加错题记录
     */
    addWrongAnswer(record) {
        const wrongAnswers = this.getWrongAnswers();
        // 检查是否已存在相同记录
        const existsIndex = wrongAnswers.findIndex(w => w.questionId === record.questionId);
        if (existsIndex >= 0) {
            // 更新已存在的记录
            wrongAnswers[existsIndex] = {
                ...wrongAnswers[existsIndex],
                ...record,
                timestamp: Date.now()
            };
        } else {
            wrongAnswers.push({
                ...record,
                timestamp: Date.now()
            });
        }
        this.saveWrongAnswers(wrongAnswers);
        return wrongAnswers;
    },

    /**
     * 移除错题记录
     */
    removeWrongAnswer(questionId) {
        const wrongAnswers = this.getWrongAnswers();
        const filtered = wrongAnswers.filter(w => w.questionId !== questionId);
        this.saveWrongAnswers(filtered);
        return filtered;
    },

    /**
     * 清空错题
     */
    clearWrongAnswers() {
        localStorage.removeItem(this.KEYS.WRONG_ANSWERS);
    },

    /**
     * 保存刷题历史
     */
    saveHistory(history) {
        try {
            const histories = this.getHistory();
            histories.unshift({
                ...history,
                id: Date.now(),
                timestamp: Date.now()
            });
            // 只保留最近10条记录
            const trimmed = histories.slice(0, 10);
            localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(trimmed));
            return true;
        } catch (e) {
            console.error('保存历史失败:', e);
            return false;
        }
    },

    /**
     * 读取历史记录
     */
    getHistory() {
        try {
            const data = localStorage.getItem(this.KEYS.HISTORY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取历史失败:', e);
            return [];
        }
    },

    /**
     * 清空所有数据
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    },

    /**
     * 保存题库记录
     */
    saveQuestionBank(record) {
        try {
            const banks = this.getQuestionBanks();
            // 检查是否已存在同名题库
            const existsIndex = banks.findIndex(b => b.name === record.name);
            if (existsIndex >= 0) {
                // 更新已存在的记录
                banks[existsIndex] = {
                    ...banks[existsIndex],
                    ...record,
                    updatedAt: Date.now()
                };
            } else {
                // 添加新记录
                banks.unshift({
                    ...record,
                    id: Date.now(),
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            }
            // 只保留最近10条记录
            const trimmed = banks.slice(0, 10);
            localStorage.setItem(this.KEYS.QUESTION_BANKS, JSON.stringify(trimmed));
            return true;
        } catch (e) {
            console.error('保存题库记录失败:', e);
            return false;
        }
    },

    /**
     * 读取题库记录列表
     */
    getQuestionBanks() {
        try {
            const data = localStorage.getItem(this.KEYS.QUESTION_BANKS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取题库记录失败:', e);
            return [];
        }
    },

    /**
     * 删除题库记录
     */
    deleteQuestionBank(bankId) {
        const banks = this.getQuestionBanks();
        const filtered = banks.filter(b => b.id !== bankId);
        localStorage.setItem(this.KEYS.QUESTION_BANKS, JSON.stringify(filtered));
        return filtered;
    },

    /**
     * 获取指定题库的错题
     */
    getWrongAnswersForBank(bankId) {
        const wrongAnswers = this.getWrongAnswers();
        return wrongAnswers.filter(w => w.bankId === bankId);
    },

    /**
     * 下载错题为Excel文件（与题库导入格式一致）
     */
    downloadWrongAnswers(bankId, bankName) {
        const wrongAnswers = bankId ? this.getWrongAnswersForBank(bankId) : this.getWrongAnswers();
        
        if (wrongAnswers.length === 0) {
            return;
        }
        
        // 构建Excel数据（与题库导入格式一致）
        // 列顺序：正确答案, 题目, 选项A, 选项B, ..., 选项J, 你的答案
        const wsData = [
            ['正确答案', '题目', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '选项G', '选项H', '选项I', '选项J', '你的答案']
        ];
        
        wrongAnswers.forEach((item) => {
            // 如果有完整的选项数据
            if (item.options && Array.isArray(item.options)) {
                const row = [
                    item.correctAnswer || '',
                    item.question || ''
                ];
                // 添加10个选项
                for (let i = 0; i < 10; i++) {
                    row.push(item.options[i] || '');
                }
                // 最后添加用户答案
                row.push(item.userAnswer || '');
                wsData.push(row);
            } else {
                // 简化格式
                wsData.push([
                    item.correctAnswer || '',
                    item.question || '',
                    '', '', '', '', '', '', '', '', '',
                    item.userAnswer || ''
                ]);
            }
        });
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // 设置列宽
        ws['!cols'] = [
            { wch: 10 },  // 正确答案
            { wch: 50 },  // 题目
            { wch: 30 },  // 选项A
            { wch: 30 },  // 选项B
            { wch: 30 },  // 选项C
            { wch: 30 },  // 选项D
            { wch: 30 },  // 选项E
            { wch: 30 },  // 选项F
            { wch: 30 },  // 选项G
            { wch: 30 },  // 选项H
            { wch: 30 },  // 选项I
            { wch: 30 },  // 选项J
            { wch: 10 }   // 你的答案
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, '错题列表');
        
        // 下载文件
        const fileName = `错题库_${bankName || '全部'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    }
};

// 导出
window.Storage = Storage;
