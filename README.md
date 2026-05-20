# QuizMaster - 智能刷题系统

一个功能完整的网页刷题工具，支持 Excel 导入、多种刷题模式。

## 功能特性

- **Excel 导入**：支持 .xlsx 和 .xls 格式的题目文件
- **顺序刷题**：按题目顺序依次作答
- **随机刷题**：随机打乱题目顺序
- **错题复习**：专门复习之前答错的题目
- **进度追踪**：实时显示正确/错误数量和正确率
- **本地存储**：题目和历史记录保存在浏览器本地
- **响应式设计**：支持桌面端和移动端

## Excel 文件格式

题目文件需要包含以下列（第一行为表头）：

| 正确答案 | 题目内容 | 选项A | 选项B | 选项C | 选项D |
|---------|---------|-------|-------|-------|-------|
| B | 中国的首都是？ | 上海 | 北京 | 广州 | 深圳 |

**说明**：
- 第一列：正确答案（A/B/C/D 或 1/2/3/4）
- 第二列：题目内容
- 第3-6列：选项（如果只有3列则为判断题）
- 支持下载示例文件测试

## 快速开始

### 方法一：直接打开

直接用浏览器打开 `index.html` 文件即可使用。

```bash
# Windows
start index.html

# macOS
open index.html

# Linux
xdg-open index.html
```

### 方法二：本地服务器（推荐）

使用任意本地服务器工具启动：

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080
```

然后访问 `http://localhost:8080`

## 文件结构

```
quizmaster/
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 主应用逻辑
│   ├── excel.js        # Excel 解析模块
│   └── storage.js      # 本地存储模块
├── SPEC.md             # 规格说明书
└── README.md           # 使用说明
```

## 技术栈

- **HTML5 + CSS3 + JavaScript**（原生实现，无需框架）
- **SheetJS (xlsx.js)**：Excel 文件解析
- **LocalStorage**：数据持久化

## 使用说明

1. 打开网页后，点击上传区域或拖拽 Excel 文件
2. 等待解析完成后，选择刷题模式
3. 点击选项作答，点击"确认答案"查看结果
4. 答错的题目会自动记录，可点击"错题复习"重新练习

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## License

MIT
