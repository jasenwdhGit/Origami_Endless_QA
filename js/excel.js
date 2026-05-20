/**
 * Excel Parser Module - Excel文件解析
 */

const ExcelParser = {
    /**
     * 解析Excel文件
     * @param {File} file - Excel文件
     * @returns {Promise<Array>} 题目数组
     */
    async parse(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    
                    // 获取第一个工作表
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // 转换为JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // 解析题目
                    const questions = this.parseQuestions(jsonData);
                    
                    if (questions.length === 0) {
                        reject(new Error('未找到有效的题目数据'));
                        return;
                    }
                    
                    resolve(questions);
                } catch (error) {
                    reject(new Error('解析Excel文件失败: ' + error.message));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * 解析题目数据
     * @param {Array} data - Excel数据（二维数组）
     * @returns {Array} 题目数组
     */
    parseQuestions(data) {
        if (!data || data.length < 2) {
            return [];
        }

        // 跳过表头，从第二行开始
        const questions = [];
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;
            
            // 获取正确答案（A列，第1列）
            let answer = this.getCellValue(row[0]) || 'A';
            answer = this.normalizeAnswer(answer);
            
            // 获取题目内容（B列，第2列）
            const questionText = this.getCellValue(row[1]);
            if (!questionText) continue;
            
            // 获取选项（C-L列，第3-12列，支持A-J共10个选项）
            const options = [
                this.getCellValue(row[2]) || '',
                this.getCellValue(row[3]) || '',
                this.getCellValue(row[4]) || '',
                this.getCellValue(row[5]) || '',
                this.getCellValue(row[6]) || '',
                this.getCellValue(row[7]) || '',
                this.getCellValue(row[8]) || '',
                this.getCellValue(row[9]) || '',
                this.getCellValue(row[10]) || '',
                this.getCellValue(row[11]) || ''
            ].filter(opt => opt.trim() !== '');
            
            // 判断题型（根据答案字符数自动判断）
            const type = this.detectQuestionType(questionText, options, answer);
            
            questions.push({
                id: questions.length + 1,
                question: questionText,
                options: options,
                answer: answer,
                type: type
            });
        }
        
        return questions;
    },

    /**
     * 获取单元格值
     */
    getCellValue(cell) {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'string') return cell.trim();
        if (typeof cell === 'number') return String(cell);
        if (typeof cell === 'object' && cell.v !== undefined) {
            return String(cell.v).trim();
        }
        return String(cell);
    },

    /**
     * 标准化答案格式
     * 多选题答案保持原样（如"AB"、"ACDE"）
     * 单选题答案转换为单个字母
     */
    normalizeAnswer(answer) {
        if (!answer) return 'A';
        const str = String(answer).toUpperCase().trim();
        // 去掉可能的空格（如 "A,B" 转为 "AB"）
        const cleaned = str.replace(/[,，\s]/g, '');
        
        // 如果是单个字母（A-J），直接返回
        if (/^[A-J]$/.test(cleaned)) return cleaned;
        
        // 如果是单个数字（1-10），转换为字母
        const num = parseInt(cleaned);
        if (cleaned.length === 1 && num >= 1 && num <= 10) {
            return String.fromCharCode(64 + num);
        }
        
        // 否则保持原样（可能是多选题答案如"AB"、"ACDE"）
        return cleaned;
    },

    /**
     * 检测题型
     * 根据答案自动判断：单字符=单选题/判断题，多字符=多选题
     */
    detectQuestionType(question, options, answer) {
        // 判断是否为多选题（答案多于一个字符）
        if (answer && answer.length > 1) {
            return 'multi';
        }
        
        // 如果选项少于等于2个，判定为判断题
        if (options.length <= 2) {
            return 'judge';
        }
        
        // 如果题目包含"判断"字样
        if (/判断/.test(question)) {
            return 'judge';
        }
        
        return 'single';
    },

    /**
     * 生成示例Excel文件数据
     */
    generateSampleData() {
        return [
            ['正确答案', '题目内容', '选项A', '选项B', '选项C', '选项D'],
            ['B', '中国的首都是哪个城市？', '上海', '北京', '广州', '深圳'],
            ['B', '地球的直径约为多少公里？', '6371', '12742', '40075', '51000'],
            ['B', '以下哪个是编程语言？', 'Photoshop', 'JavaScript', 'PowerPoint', 'Excel'],
            ['A', '水的化学式是什么？', 'H2O', 'CO2', 'NaCl', 'O2'],
            ['C', '一年有多少个月？', '10', '11', '12', '13'],
            ['C', '太阳系中最大的行星是？', '地球', '火星', '木星', '土星'],
            ['B', '下列哪个是正确的URL格式？', 'http:\\\\example.com', 'http://example.com', 'http//example.com', 'https:example.com'],
            ['B', 'JavaScript是什么类型的语言？', '标记语言', '编程语言', '样式语言', '数据库语言'],
            ['A', 'HTML的中文含义是？', '超文本标记语言', '超链接标记语言', '高级文本语言', '网页样式表'],
            ['B', 'CSS用于做什么？', '添加交互', '控制样式', '处理数据', '存储数据'],
            ['A', '数组的长度可以用什么属性获取？', 'length', 'size', 'count', 'index'],
            ['C', '以下哪个是JavaScript的数据类型？', 'int', 'float', 'string', 'double'],
            ['B', 'console.log()用于做什么？', '输入', '输出', '存储', '删除'],
            ['A', '函数的定义关键字是？', 'function', 'func', 'def', 'functiondef']
        ];
    },

    /**
     * 创建示例Excel文件并下载
     */
    downloadSample() {
        const data = this.generateSampleData();
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '题目');
        XLSX.writeFile(wb, '刷题示例.xlsx');
    }
};

// 导出
window.ExcelParser = ExcelParser;
