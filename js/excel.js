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
     * 智能检测 Excel 列布局
     * 支持4种题库格式：
     *   1. 答案 | 题目 | 选项A | 选项B | ...（用例题库）
     *   2. 题目 | 答案 | 选项A | 选项B | ...
     *   3. 题目 | 答案（仅2列，无选项）
     *   4. 答案 | 题目（仅2列，无选项）
     * 检测策略：先表头关键词匹配 → 再启发式（列平均文本长度）
     */
    detectColumnLayout(data) {
        const defaults = { answerCol: 0, questionCol: 1, optionStartCol: 2, dataStartRow: 1 };
        if (!data || data.length < 2) return defaults;

        const headerRow = data[0];
        const headerCells = headerRow.map(c => String(this.getCellValue(c) || '').trim());
        const colCount = headerCells.length;

        // Step 1: 表头关键词全匹配
        const answerIdx = headerCells.findIndex(s =>
            /^(答案|正确选项|正确答案|answer|标准答案|正确)$/i.test(s)
        );
        const questionIdx = headerCells.findIndex(s =>
            /^(题目|题干|问题|question|试题|试题内容|题干内容|内容|题面)$/i.test(s)
        );

        if (answerIdx >= 0 && questionIdx >= 0 && answerIdx !== questionIdx) {
            const optionStartCol = Math.max(answerIdx, questionIdx) + 1;
            return { answerCol: answerIdx, questionCol: questionIdx, optionStartCol, dataStartRow: 1 };
        }

        // Step 2: 检查第一行是否像表头（有选项字母标记 A/B/C/D 等）
        const looksLikeHeader = headerCells.some(s =>
            /^(A|B|C|D|E|F|G|H|I|J|选项[A-J]|[A-J]选项)$/i.test(s)
        );

        const startRow = looksLikeHeader ? 1 : 0;
        const sampleRows = data.slice(startRow, Math.min(startRow + 3, data.length));

        if (sampleRows.length === 0) return { ...defaults, dataStartRow: startRow };

        // 计算每列平均文本长度（短=答案，长=题目），忽略空列
        const colAvgs = [];
        for (let c = 0; c < colCount; c++) {
            let totalLen = 0, count = 0;
            for (const row of sampleRows) {
                const val = String(this.getCellValue(row[c]) || '');
                if (val.length > 0) { totalLen += val.length; count++; }
            }
            colAvgs.push({ col: c, avg: count > 0 ? totalLen / count : 0 });
        }

        // 只保留有内容的列
        const nonEmptyCols = colAvgs.filter(c => c.avg > 0);
        if (nonEmptyCols.length < 2) return defaults;
        
        const sortedByAvg = [...nonEmptyCols].sort((a, b) => a.avg - b.avg);

        const effectiveColCount = nonEmptyCols.length;
        if (effectiveColCount === 2) {
            // 仅2列：短列=答案，长列=题目
            return {
                answerCol: sortedByAvg[0].col,
                questionCol: sortedByAvg[1].col,
                optionStartCol: colCount,
                dataStartRow: startRow
            };
        }

        // 3列及以上：最短=答案，最长=题目
        const answerCol = sortedByAvg[0].col;
        const questionCol = sortedByAvg[sortedByAvg.length - 1].col;

        return {
            answerCol,
            questionCol,
            optionStartCol: colCount,
            dataStartRow: startRow
        };
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

        const layout = this.detectColumnLayout(data);
        const questions = [];

        for (let i = layout.dataStartRow; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;

            // 根据检测到的布局读取答案
            const rawAnswer = this.getCellValue(row[layout.answerCol]) || 'A';
            let answer = this.normalizeAnswer(rawAnswer);

            // 根据检测到的布局读取题目
            const questionText = this.getCellValue(row[layout.questionCol]);
            if (!questionText) continue;

            // 读取选项：扫描所有列，跳过答案列和题目列
            const options = [];
            for (let c = 0; c < row.length; c++) {
                if (c === layout.answerCol || c === layout.questionCol) continue;
                const opt = this.getCellValue(row[c]);
                if (opt && opt.trim() !== '') {
                    options.push(opt);
                }
            }

            // 判断题型（根据答案字符数和原始答案格式判断）
            const type = this.detectQuestionType(questionText, options, answer, rawAnswer);

            questions.push(this.normalizeQuestion({
                id: questions.length + 1,
                question: questionText,
                options: options,
                answer: answer,
                type: type
            }));
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
     * "正确"/"对" → "A", "错误"/"错" → "B"
     * 多选题答案保持原样（如"AB"、"ACDE"）
     * 单选题答案转换为单个字母
     */
    normalizeAnswer(answer) {
        if (!answer) return 'A';
        const str = String(answer).toUpperCase().trim();
        // 去掉可能的空格（如 "A,B" 转为 "AB"）
        const cleaned = str.replace(/[,，\s]/g, '');

        // 判断题：中文"正确""对" → A, "错误""错" → B
        if (/^(正确|对|TRUE|YES|√|∨)$/i.test(cleaned)) return 'A';
        if (/^(错误|错|FALSE|NO|×|X)$/i.test(cleaned)) return 'B';

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
     * - 答案多字符 → 多选
     * - 无选项 + 原始答案是"正确/错误/对/错" → 判断
     * - 无选项 + 原始答案是字母 → 单选/多选
     * - 仅2个选项 → 判断
     */
    detectQuestionType(question, options, answer, rawAnswer) {
        // 判断是否为多选题（答案多于一个字符）
        if (answer && answer.length > 1) {
            return 'multi';
        }
        
        // 如果选项为0（用户只填了答案+题目两列）
        if (options.length === 0) {
            const raw = String(rawAnswer || '').trim();
            // 原始答案是"正确/错误/对/错"等判断格式 → 判断
            if (/^(正确|对|TRUE|YES|√|∨|错误|错|FALSE|NO|×|X)$/i.test(raw)) {
                return 'judge';
            }
            // 答案是A/B + 题目以"判断："开头 或 以"错误"/"错"结尾 → 判断
            if (/^[AB]$/i.test(raw)) {
                if (/^判断：/.test(question) || /(错误|错)$/.test(question)) {
                    return 'judge';
                }
            }
            // 原始答案是字母（A/B/C/D等）→ 单选，后续自动补ABCDE空选项
            return 'single';
        }
        
        // 如果选项少于等于2个，判定为判断题
        if (options.length <= 2) {
            return 'judge';
        }
        
        return 'single';
    },

    /**
     * 预处理题目：补全缺失选项
     * - 判断题无选项 → 补充"正确"/"错误"
     * - 单选/多选无选项 → 补充ABCDE空选项
     */
    normalizeQuestion(question) {
        const q = { ...question };
        
        // 判断题：如果没有选项，自动补充"正确"和"错误"
        if (q.type === 'judge' && q.options.length === 0) {
            q.options = ['正确', '错误'];
            if (!/^[AB]$/i.test(q.answer)) {
                q.answer = 'A';
            }
        }
        
        // 判断题：如果只有1个选项，补充另一个
        if (q.type === 'judge' && q.options.length === 1) {
            q.options = ['正确', '错误'];
        }
        
        // 单选/多选：如果0选项（用户只填了答案+题目），提供5个空选项
        if ((q.type === 'single' || q.type === 'multi') && q.options.length === 0) {
            q.options = ['', '', '', '', ''];
        }
        
        return q;
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
