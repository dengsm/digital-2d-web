const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const loading = document.getElementById("loading");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressTitle = document.getElementById("progressTitle");

// 生成UUID作为session_id
// ========================================
// 通用API请求工具函数
// ========================================

/**
 * 构建API请求的基础URL参数
 * @param {Object} userInfo - 用户信息对象
 * @returns {URLSearchParams} 构建好的URL参数
 */
function buildApiQueryParams(userInfo) {
    const params = new URLSearchParams();
    params.append("app_id", "app_002");
    params.append("session_id", sessionId);
    params.append("user_id", "4");

    // 添加空值检查，防止 TypeError
    const safeUserInfo = userInfo || {};
    params.append("username", safeUserInfo.name || safeUserInfo.userName || "");
    params.append("phone", safeUserInfo.phone || safeUserInfo.userPhone || "");
    params.append(
        "id_card",
        safeUserInfo.idCard || safeUserInfo.userIdCard || "",
    );
    params.append("timestamp", new Date().toISOString());
    return params;
}

/**
 * 创建资源数据结构
 * @param {string} questionId - 问题ID
 * @param {string} value - 值
 * @param {string} classId - 类别ID
 * @param {string} type - 类型，默认为'text'
 * @returns {Object} 资源数据对象
 */
function createResourceData(questionId, value, classId, type = "text") {
    return {
        resources: [
            {
                question_id: questionId,
                value: value,
                class_id: classId,
                type: type,
            },
        ],
    };
}

/**
 * 通用API请求函数（带重试机制）
 * @param {Object} userInfo - 用户信息
 * @param {Object} resourceData - 资源数据
 * @param {number} timeout - 超时时间（毫秒），默认120秒
 * @param {number} maxRetries - 最大重试次数，默认3次
 * @returns {Promise<Response>} fetch响应对象
 */
async function sendApiRequest(
    userInfo,
    resourceData,
    timeout = 120000,
    maxRetries = 2,
) {
    const apiUrl = new URL(
        "https://n8n.ailongma.com/webhook/cc5acfb5-e86d-4e8f-99f7-92252015f231",
    );

    // 构建URL参数
    const queryParams = buildApiQueryParams(userInfo);
    for (const [key, value] of queryParams) {
        apiUrl.searchParams.append(key, value);
    }

    // console.log('🌐 API请求URL:', apiUrl.toString());
    // console.log('📦 请求数据:', resourceData);

    let lastError = null;

    // 重试循环
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🔄 第${attempt}次尝试请求...`);

        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            console.log(`⏰ 第${attempt}次请求超时，已取消`);
        }, timeout);

        try {
            const response = await fetch(apiUrl.toString(), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
                body: JSON.stringify(resourceData),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // 检查响应状态
            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`,
                );
            }

            console.log(`✅ 第${attempt}次请求成功`);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error;

            console.error(`❌ 第${attempt}次请求失败:`, error.message);

            // 如果是最后一次尝试，直接抛出错误
            if (attempt === maxRetries) {
                console.error(`💥 所有${maxRetries}次请求都失败了`);
                throw error;
            }

            // 计算重试延迟（指数退避）
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            console.log(`⏳ ${delay}ms后进行第${attempt + 1}次重试...`);

            // 等待后重试
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // 理论上不会到达这里，但为了类型安全
    throw lastError || new Error("未知的请求错误");
}

/**
 * 统一的API错误处理函数（增强版）
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文描述
 */
function handleApiError(error, context = "请求") {
    console.error(`❌ ${context}时出错:`, error);
    console.error("错误详情:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
    });

    let userMessage = "";
    let errorType = "error";
    let showRetryTip = false;

    // 根据错误类型提供不同的用户提示
    if (error.name === "AbortError") {
        userMessage = "⏰ 请求超时，系统已自动重试多次但仍然失败";
        errorType = "timeout";
        showRetryTip = true;
    } else if (error.message.includes("Failed to fetch")) {
        userMessage = "🌐 网络连接失败，系统已自动重试但仍然无法连接到服务器";
        errorType = "network";
        showRetryTip = true;
    } else if (error.message.includes("HTTP 5")) {
        userMessage = "🔧 服务器内部错误，请稍后再试";
        errorType = "server";
        showRetryTip = true;
    } else if (error.message.includes("HTTP 4")) {
        userMessage = "⚠️ 请求参数错误，请刷新页面后重试";
        errorType = "client";
    } else if (error.message.includes("JSON")) {
        userMessage = "📊 服务器响应格式错误，请稍后重试";
        errorType = "parse";
        showRetryTip = true;
    } else {
        userMessage = `❌ ${context}失败，系统已自动重试但仍然失败`;
        errorType = "general";
        showRetryTip = true;
    }

    // 显示错误消息
    addMessage(userMessage);

    // 根据错误类型提供不同的建议
    if (showRetryTip) {
        setTimeout(() => {
            let tipMessage = "";

            switch (errorType) {
                case "network":
                    tipMessage =
                        "💡 建议检查：\n• 网络连接是否正常\n• 防火墙或代理设置\n• 稍后再次尝试或刷新页面";
                    break;
                case "timeout":
                    tipMessage =
                        "💡 建议检查：\n• 网络速度是否稳定\n• 尝试刷新页面\n• 稍后再次尝试";
                    break;
                case "server":
                    tipMessage = "💡 服务器正在维护或超载，请稍后再试";
                    break;
                default:
                    tipMessage =
                        "💡 您可以：\n• 再次发送消息\n• 刷新页面重试\n• 稍后再次尝试";
            }

            addMessage(tipMessage);
        }, 2000);
    }

    // 记录错误统计（可用于后续分析）
    if (window.errorStats) {
        window.errorStats[errorType] = (window.errorStats[errorType] || 0) + 1;
    } else {
        window.errorStats = { [errorType]: 1 };
    }
}

// ========================================
// 工具函数
// ========================================

function generateUUID() {
    return (
        "session_" +
        "xxxxxxxxxxxxxxxx".replace(/[x]/g, function () {
            return ((Math.random() * 16) | 0).toString(16);
        })
    );
}

// 页面加载时生成session_id（改为可变变量）
let sessionId = generateUUID();
// console.log('Generated session_id:', sessionId);

// 添加全局question_id状态管理
let currentQuestionId = 111; // 默认值
// console.log('Initial question_id:', currentQuestionId);

// 添加全局class_id状态管理
let currentClassId = "1"; // 默认值
// console.log('Initial class_id:', currentClassId);

// 重置后台状态函数 - 模拟页面刷新的效果
function resetBackendState() {
    // 重新生成sessionId
    sessionId = generateUUID();
    // console.log('Reset session_id:', sessionId);

    // 重置question_id到默认值
    currentQuestionId = 111;
    // console.log('Reset question_id:', currentQuestionId);

    // 重置class_id到默认值
    currentClassId = "1";
    // console.log('Reset class_id:', currentClassId);

    // 重置进度条相关变量
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    currentProgress = 0;

    // 清理DOM中的旧题目容器，避免选择器冲突
    const oldQuestionContainers =
        document.querySelectorAll("[data-question-id]");
    oldQuestionContainers.forEach((container) => {
        // 移除被禁用的旧题目容器
        if (
            container.style.pointerEvents === "none" ||
            container.style.opacity === "0.7"
        ) {
            container.remove();
            // console.log('Removed old disabled question container:', container.getAttribute('data-question-id'));
        }
    });

    // console.log('✅ 后台状态已重置，等同于页面刷新效果');
}

// 进度条控制变量
let progressInterval;
let currentProgress = 0;

// 进度条控制函数
function showProgress(isAnswer = false) {
    const container = progressContainer;
    const bar = progressBar;
    const text = progressText;
    const title = progressTitle;

    // 设置标题
    title.textContent = isAnswer ? "正在分析您的回答..." : "回答中...";

    // 显示进度条
    container.style.display = "block";

    // 重置进度
    currentProgress = 0;
    updateProgress(0);

    // 在进度执行时禁用“退出专业测评”按钮
    const toggleBtn = document.getElementById("toggleBtn");
    if (toggleBtn && !isRecommendMode) {
        toggleBtn.disabled = true;
        toggleBtn.style.opacity = "0.5";
        toggleBtn.style.cursor = "not-allowed";
    }

    // 启动进度动画
    startProgressAnimation();
}

function hideProgress() {
    progressContainer.style.display = "none";
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    currentProgress = 0;

    // 重置所有阶段状态
    const stages = document.querySelectorAll(".progress-stage");
    stages.forEach((stage) => {
        stage.classList.remove("active", "completed");
    });

    // 进度取消后重新启用“退出专业测评”按钮（但要考虑互斥状态）
    const toggleBtn = document.getElementById("toggleBtn");
    if (toggleBtn && !isRecommendMode && !isPsychologyMode) {
        toggleBtn.disabled = false;
        toggleBtn.style.opacity = "1";
        toggleBtn.style.cursor = "pointer";
    }
}

function updateProgress(percentage) {
    progressBar.style.width = percentage + "%";
    progressText.textContent = Math.round(percentage) + "%";

    // 更新阶段状态
    updateStages(percentage);
}

function updateStages(percentage) {
    const stages = document.querySelectorAll(".progress-stage");
    stages.forEach((stage) => {
        stage.classList.remove("active", "completed");
    });

    if (percentage >= 0 && percentage < 25) {
        document.getElementById("stage1").classList.add("active");
    } else if (percentage >= 25 && percentage < 50) {
        document.getElementById("stage1").classList.add("completed");
        document.getElementById("stage2").classList.add("active");
    } else if (percentage >= 50 && percentage < 75) {
        document.getElementById("stage1").classList.add("completed");
        document.getElementById("stage2").classList.add("completed");
        document.getElementById("stage3").classList.add("active");
    } else if (percentage >= 75 && percentage < 100) {
        document.getElementById("stage1").classList.add("completed");
        document.getElementById("stage2").classList.add("completed");
        document.getElementById("stage3").classList.add("completed");
        document.getElementById("stage4").classList.add("active");
    } else if (percentage >= 100) {
        document.getElementById("stage1").classList.add("completed");
        document.getElementById("stage2").classList.add("completed");
        document.getElementById("stage3").classList.add("completed");
        document.getElementById("stage4").classList.add("completed");
    }
}

function startProgressAnimation() {
    // 清除之前的定时器
    if (progressInterval) {
        clearInterval(progressInterval);
    }

    // 模拟进度增长
    progressInterval = setInterval(() => {
        if (currentProgress < 90) {
            // 前90%比较快
            currentProgress += Math.random() * 8 + 2;
            if (currentProgress > 90) currentProgress = 90;
            updateProgress(currentProgress);
        } else {
            // 最后10%比较慢，等待实际响应
            currentProgress += Math.random() * 2 + 0.5;
            if (currentProgress > 98) currentProgress = 98;
            updateProgress(currentProgress);
        }
    }, 200);
}

function completeProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }

    // 快速完成到100%
    currentProgress = 100;
    updateProgress(100);

    // 短暂延迟后隐藏
    setTimeout(() => {
        hideProgress();
    }, 800);
}

// 获取用户信息的函数
function getUserInfo() {
    const userName = document.getElementById("userName").value.trim();
    const userPhone = document.getElementById("userPhone").value.trim();
    const userIdCard = document.getElementById("userIdCard").value.trim();
    return { userName, userPhone, userIdCard };
}

/**
 * 向聊天界面添加消息
 * @param {string|Object} content - 消息内容，可以是字符串或题目对象
 * @param {boolean} isUser - 是否为用户消息，默认false
 * @param {boolean} isQuestion - 是否为题目消息，默认false
 * @description 在聊天界面中添加新消息，支持用户消息、系统消息和题目消息的不同样式
 */
function addMessage(content, isUser = false, isQuestion = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isUser ? "user" : "assistant"}`;

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";

    if (isQuestion && content.question) {
        // 更新当前的question_id
        if (content.question_id) {
            currentQuestionId = content.question_id;
            // console.log('Updated question_id to:', currentQuestionId);
        }
        // 更新当前的class_id
        if (content.class_id) {
            currentClassId = content.class_id;
            // console.log('Updated class_id to:', currentClassId);
        }
        // 显示选择题
        bubbleDiv.innerHTML = renderQuestion(content);
    } else {
        // 显示普通文本消息 - 通过parseMarkdown处理格式
        bubbleDiv.innerHTML = parseMarkdown(content);
    }

    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);

    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function parseMarkdown_new(text) {
    // 如果是纯文本，只处理换行
    if (!/[\*\_\~\`\#\-\+\=\{\}\[\]\(\)\\\>]/.test(text)) {
        return text
            .replace(/\n\n+/g, "</p><p>")
            .replace(/\n/g, "<br>")
            .replace(/<p><\/p>/g, "");
    }
    // 首先处理换行，确保段落之间的换行被保留
    text = text.replace(/\n\n+/g, "</p><p>");
    text = text.replace(/\n/g, "<br>");
    text = text.replace(/<p><\/p>/g, ""); // 移除空段落

    // 处理推荐专业标题和适配率
    text = text.replace(
        /\*\*\s*(🥇|🥈|🥉)\s*推荐专业([一二三])：(.*?)\s*（适配率：(\d+%)\s*）\s*\*\*/g,
        (match, medal, number, major, rate) => {
            // 移除前后的 </p><p> 标签，避免产生额外换行
            return `<div style="font-size: large; font-weight: bold; margin: 10px 0 5px 0;">${medal} 推荐专业${number}：${major} <span class="compatibility-rate" style="font-size: large;">适配率：${rate}</span></div>`;
        },
    );

    // 处理列表项
    text = text.replace(/^\s*[\*\-]\s(.*$)/gm, "<li>$1</li>");
    text = text.replace(/^\s*\d+\.\s(.*$)/gm, "<li>$1</li>");

    // 包装列表
    text = text.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
        if (match.match(/\d+\./)) {
            return `<ol>${match}</ol>`;
        } else {
            return `<ul>${match}</ul>`;
        }
    });

    // 标题
    text = text.replace(/^# (.*$)/gm, "<h1>$1</h1>");
    text = text.replace(/^## (.*$)/gm, "<h2>$1</h2>");
    text = text.replace(/^### (.*$)/gm, "<h3>$1</h3>");

    // 加粗和斜体
    text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*(.*?)\*/g, "<em>$1</em>");
    text = text.replace(/__(.*?)__/g, "<strong>$1</strong>");
    text = text.replace(/_(.*?)_/g, "<em>$1</em>");

    // 删除线
    text = text.replace(/~~(.*?)~~/g, "<del>$1</del>");

    // 链接和图片
    text = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // 引用
    text = text.replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>");

    // 水平线
    text = text.replace(/^\-\-\-$/gm, "<hr>");

    // 清理多余的段落标签
    text = text.replace(/<p><\/p>/g, "");
    text = text.replace(/<p><br><\/p>/g, "");

    // 确保内容被包裹在段落中
    if (
        !text.startsWith("<h") &&
        !text.startsWith("<p>") &&
        !text.startsWith("<ul>") &&
        !text.startsWith("<ol>")
    ) {
        text = "<p>" + text;
    }
    if (
        !text.endsWith("</p>") &&
        !text.endsWith("</h1>") &&
        !text.endsWith("</h2>") &&
        !text.endsWith("</h3>") &&
        !text.endsWith("</ul>") &&
        !text.endsWith("</ol>") &&
        !text.endsWith("</blockquote>")
    ) {
        text = text + "</p>";
    }
    text = text.replace(/(推荐专业[一二三]：.*?<\/div>)\s*<br>\s*/g, "$1");

    return text;
}
// 处理Markdown格式的函数
function parseMarkdown(text) {
    if (!text) return "";

    let html = text;

    // 清理换行符
    html = html.replace(/\n/g, "<br>").replace(/\\n/g, "<br>");

    // 处理推荐专业 - 统一的处理逻辑
    html = processMajorRecommendations(html);

    // 处理其他格式
    html = processOtherFormats(html);

    // 处理列表项
    html = processListItems(html);

    // 清理多余的空行
    html = html.replace(/(<br>\s*){2,}/g, "<br>");

    // console.log('parseMarkdown output: ', html);
    return html;
}

// 处理推荐专业的函数
function processMajorRecommendations(html) {
    //console.log('processMajorRecommendations input: ', html);
    // 首先清理干扰内容，确保推荐专业前面没有其他**内容
    // let cleanedHtml = html
    //     // 先处理非推荐专业的**内容，避免干扰正则匹配
    //     .replace(/\*\*(优势：[^*]*?)\*\*/g, '<span class="strength">$1</span>')
    //     .replace(/\*\*(弱势：[^*]*?)\*\*/g, '<span class="weakness">$1</span>')
    //     .replace(/\*\*(劣势：[^*]*?)\*\*/g, '<span class="weakness">$1</span>')
    //     // 处理其他非推荐专业的**内容
    //     .replace(/\*\*(?!🥇|🥈|🥉)([^*]*?)\*\*/g, '<strong>$1</strong>');
    // 新的处理方式
    let cleanedHtml = html
        // 处理优势标签
        .replace(
            /\*\*(优势：[^*]*?)(?:\*\*|$)/g,
            '<span class="strength">$1</span>',
        )
        // 处理弱势/劣势标签及后面的内容，确保移除所有**标记
        .replace(
            /\*\*(弱势：)([^*]*?)(?:\*\*|$)/g,
            '<span class="weakness">$1$2</span>',
        )
        .replace(
            /\*\*(劣势：)([^*]*?)(?:\*\*|$)/g,
            '<span class="weakness">$1$2</span>',
        )
        // 处理其他非推荐专业的**内容，但要排除推荐专业开头的**
        .replace(/\*\*(?!🥇|🥈|🥉)([^*]*?)(?:\*\*|$)/g, "<strong>$1</strong>")
        // 移除所有剩余的**标记
        .replace(/\*\*/g, "");

    // 处理带有**包围的专业推荐格式
    //    const majorPatternWithStars = /(\*\*)?\s*(🥇|🥈|🥉)\s*推荐专业([一二三])：(.*?)（适配率：(\d+%)）(\*\*)?([\s\S]*?)(?=\*\*\s*(?:🥇|🥈|🥉)|$)/g;

    // 处理带有**包围的专业推荐格式
    // 修正正则：使用非贪婪匹配找到最后一个（适配率：
    const majorPatternWithStars =
        /\*\*\s*(🥇|🥈|🥉)\s*推荐专业([一二三])：(.*?)（适配率：(\d+%)）\*\*([\s\S]*?)(?=\*\*\s*(?:🥇|🥈|🥉)|$)/g;

    let result = cleanedHtml.replace(
        majorPatternWithStars,
        (match, medal, number, major, rate, content) => {
            //console.log(` 匹配到推荐专业${number}:`, { medal, number, major: major.trim(), rate });
            //console.log(` 专业${number}内容:`, content.substring(0, 200) + '...');

            // 处理专业内容
            let processedContent = content
                .replace(/\*\*/g, "") // 移除所有**标记
                .replace(
                    /(优势：[^\n]*)/g,
                    '<div class="major-content advantage">$1</div>',
                )
                .replace(
                    /(劣势：[^\n]*)/g,
                    '<div class="major-content disadvantage">$1</div>',
                )
                .replace(
                    /(弱势：[^\n]*)/g,
                    '<div class="major-content disadvantage">$1</div>',
                );

            return `<br><br><div class="major-section">
        <div class="major-title">${medal} 推荐专业${number}：${major.trim()}<span class="compatibility-rate">适配率：${rate}</span></div>
        <div class="major-content">${processedContent}</div>
    </div>`;
        },
    );

    // 如果没有匹配到带**的格式，尝试普通格式
    if (!result.includes('<div class="major-section">')) {
        // 修正普通格式正则：支持专业名称中包含括号
        const majorPattern =
            /(🥇|🥈|🥉)\s*推荐专业([一二三])：(.*?)（适配率：(\d+%)）([\s\S]*?)(?=🥇|🥈|🥉|$)/g;

        result = html.replace(
            majorPattern,
            (match, medal, number, major, rate, content) => {
                let processedContent = content
                    .replace(
                        /(优势：[^\n]*)/g,
                        '<div class="major-content advantage">$1</div>',
                    )
                    .replace(
                        /(劣势：[^\n]*)/g,
                        '<div class="major-content disadvantage">$1</div>',
                    )
                    .replace(
                        /(弱势：[^\n]*)/g,
                        '<div class="major-content disadvantage">$1</div>',
                    );

                return `<br><br><div class="major-section">
            <div class="major-title">${medal} 推荐专业${number}：${major.trim()}<span class="compatibility-rate">适配率：${rate}</span></div>
            <div class="major-content">${processedContent}</div>
        </div>`;
            },
        );
    }

    // 如果仍然没有匹配到，使用最简单的匹配方式
    if (!result.includes('<div class="major-section">')) {
        // 匹配任何包含推荐专业的行
        result = html.replace(
            /(🥇|🥈|🥉)[^\n]*推荐专业[一二三][^\n]*/g,
            (match) => {
                return `<br><br><div class="major-section">
            <div class="major-title">${match.replace(/\*\*/g, "")}</div>
            <div class="major-content"></div>
        </div>`;
            },
        );

        // 将后续内容添加到对应的major-section中
        const lines = result.split("<br>");
        let processedLines = [];
        let currentSection = null;

        for (let line of lines) {
            if (line.includes('<div class="major-section">')) {
                if (currentSection) {
                    processedLines.push(currentSection + "</div>");
                }
                currentSection = line;
            } else if (currentSection && line.trim()) {
                currentSection += "<br>" + line;
            } else {
                if (currentSection) {
                    processedLines.push(currentSection + "</div>");
                    currentSection = null;
                }
                processedLines.push(line);
            }
        }

        if (currentSection) {
            processedLines.push(currentSection + "</div>");
        }

        result = processedLines.join("<br>");
    }

    return result;
}

// 处理其他格式的函数
function processOtherFormats(html) {
    return (
        html
            // 处理粗体文本
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            // 处理MBTI类型
            //.replace(/ENFJ-"([^"]+)"/g, '<span class="mbti-type">ENFJ-"$1"</span>')
            //.replace(/ENFJ型/g, '<span class="mbti-type">ENFJ型</span>')
            // 处理推荐理由
            .replace(
                /推荐理由：/g,
                '<h4 class="recommendation-reason">💡 推荐理由：</h4>',
            )
            // 处理优势/弱势标签
            .replace(/优势：/g, '<br><span class="strength">优势：</span>')
            .replace(/弱势：/g, '<br><span class="weakness">弱势：</span>')
            .replace(/劣势：/g, '<br><span class="weakness">劣势：</span>')
            // 处理其他标签
            .replace(/性格匹配：/g, "<strong>性格匹配：</strong>")
            .replace(/兴趣契合：/g, "<strong>兴趣契合：</strong>")
            .replace(/优势发挥：/g, "<strong>优势发挥：</strong>")
            .replace(/发展前景：/g, "<strong>发展前景：</strong>")
            // 处理其他标题
            .replace(/\*\*([^*]+)：\*\*/g, "<h3>$1：</h3>")
    );
}

// 处理列表项的函数
function processListItems(html) {
    const lines = html.split("<br>");
    let inList = false;
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("- ")) {
            if (!inList) {
                processedLines.push("<ul>");
                inList = true;
            }
            processedLines.push(`<li>${line.substring(2)}</li>`);
        } else {
            if (inList) {
                processedLines.push("</ul>");
                inList = false;
            }
            if (line) {
                processedLines.push(line);
            }
        }
    }

    if (inList) {
        processedLines.push("</ul>");
    }

    return processedLines.join("<br>");
}

/**
 * 渲染题目组件
 * @param {Object} data - 题目数据对象
 * @param {number} data.question_id - 题目ID
 * @param {string} data.question - 题目文本
 * @param {Array} data.options - 选项数组，每个元素包含{label, value}
 * @param {string} data.option_type - 选项类型，默认为'radio'
 * @returns {string} 生成的HTML字符串
 * @description 根据题目数据生成对应的HTML结构，包括特殊题目的处理（如测评完成、专业推荐等）
 */
function renderQuestion(data) {
    // console.log('Rendering question with data:', data);
    const questionId = data.question_id;
    const question = data.question;
    const options = data.options || [];
    const optionType = data.option_type || "radio";

    // console.log('Extracted question_id:', questionId);

    // 如果 question_id 为 0，表示测评完成，只显示结果文本
    if (questionId === 0) {
        const formattedContent = parseMarkdown_new(question);

        // 根据当前模式显示不同的结果标题
        const resultTitle = isPsychologyMode
            ? "🎉 多元智能测评结果 🎉"
            : "🎉 AI智能专业推荐结果 🎉";

        let html = `
        <div class="result-container" data-question-id="${questionId}">
            <div class="result-title">
                ${resultTitle}
            </div>
            <div class="result-content">
                ${formattedContent}
            </div>
            <div class="result-disclaimer">
                答案由 AI 模型生成,仅供参考
            </div>
        </div>
    `;

        // 答题完成后根据当前模式自动退出（延长时间，给用户查看结果）
        setTimeout(() => {
            if (isPsychologyMode) {
                console.log("🔄 多元智能测评完成，3秒后自动退出");
                autoExitPsychology();
            } else {
                console.log("🔄 专业推荐完成，3秒后自动退出");
                autoExitRecommendation();
            }
        }, 3000); // 3秒后自动退出

        return html;
    }
    // 如果 question_id 为 -1，终止测评，只显示结果文本
    if (questionId === -1) {
        const formattedContent = parseMarkdown(question);
        let html = `
        <div class="question-container" data-question-id="${questionId}">
            <div style="background: white;  border-radius: 8px; line-height: 1.6; color: #333;">
                ${question}
            </div>
        </div>
    `;

        // 根据当前模式调用相应的自动退出函数
        if (isPsychologyMode) {
            console.log("⚠️ 多元智能测评终止，立即退出");
            autoExitPsychology();
        } else {
            console.log("⚠️ 专业推荐终止，立即退出");
            autoExitRecommendation();
        }

        return html;
    }

    // 如果 question_id 为 88，只显示回答内容，不显示提交按钮
    if (questionId === 88) {
        let html = `
        <div class="question-container" data-question-id="${questionId}">
            <div style="background: white; border-radius: 8px; line-height: 1.6; color: #333;">
                ${question}
            </div>
        </div>
    `;
        return html;
    }

    // 正常的选择题渲染
    let html = `
    <div class="question-container" data-question-id="${questionId}">
        <div class="question-title">${question}</div>
        <div class="question-options">
`;

    options.forEach((option, index) => {
        html += `
        <div class="option-item" onclick="selectOption(${questionId}, '${option.value}', this)">
            <input type="${optionType}" name="question_${questionId}" value="${option.value}" class="option-radio" />
            <span class="option-label">${option.label}</span>
        </div>
    `;
    });

    html += `
        </div>
        <button class="submit-answer" onclick="submitAnswer(${questionId})" disabled>点我提交</button>
    </div>
`;

    return html;
}

/**
 * 选择题目选项
 * @param {number} questionId - 题目ID
 * @param {string} value - 选项值
 * @param {HTMLElement} element - 被点击的选项元素
 * @description 处理用户点击选项的交互，更新UI状态并启用提交按钮
 */
function selectOption(questionId, value, element) {
    // 移除同一题目下其他选项的选中状态
    const container = element.closest(".question-container");
    const allOptions = container.querySelectorAll(".option-item");
    allOptions.forEach((option) => option.classList.remove("selected"));

    // 选中当前选项
    element.classList.add("selected");
    element.querySelector("input").checked = true;

    // 启用提交按钮
    const submitButton = container.querySelector(".submit-answer");
    submitButton.disabled = false;
}

/**
 * 提交题目答案到后端
 * @param {number} questionId - 题目 ID
 * @description 处理用户选择的答案，发送到后端并处理响应
 */
async function submitAnswer(questionId) {
    // 查找所有匹配的容器，选择最后一个活跃的容器
    const containers = document.querySelectorAll(
        `[data-question-id="${questionId}"]`,
    );
    let container = null;

    // 从后向前查找，选择最新的活跃容器
    for (let i = containers.length - 1; i >= 0; i--) {
        const currentContainer = containers[i];
        if (
            currentContainer.style.pointerEvents !== "none" &&
            currentContainer.style.opacity !== "0.7"
        ) {
            container = currentContainer;
            break;
        }
    }

    if (!container) {
        // console.error('No active container found for question_id:', questionId);
        alert("题目容器未找到，请刷新页面重试");
        return;
    }

    const selectedOption = container.querySelector("input:checked");

    if (!selectedOption) {
        // console.log('No option selected in container:', container);
        // console.log('Available inputs:', container.querySelectorAll('input'));
        alert("请选择一个答案");
        return;
    }

    const selectedValue = selectedOption.value;
    const selectedLabel = selectedOption
        .closest(".option-item")
        .querySelector(".option-label").textContent;

    // 显示用户选择
    addMessage(`我选择：${selectedLabel}`, true);

    // 禁用题目
    container.style.opacity = "0.7";
    container.style.pointerEvents = "none";

    // 只有question_id为87时才显示进度条
    showLoading(currentQuestionId === 87);

    try {
        // console.log('Submitting answer with question_id:', currentQuestionId, 'class_id:', currentClassId);

        // 获取用户信息
        const userInfo = getCurrentUserInfo();

        // 创建资源数据
        const resourceData = createResourceData(
            currentQuestionId,
            selectedValue,
            currentClassId,
        );

        // 发送API请求
        const response = await sendApiRequest(userInfo, resourceData);

        // 检查响应状态
        if (!response.ok) {
            const errorText = await response
                .text()
                .catch(() => "无法获取错误详情");
            throw new Error(
                `服务器响应错误 (${response.status}): ${errorText}`,
            );
        }

        // 解析响应数据
        const data = await response.json();
        console.log("✅ 收到题目提交响应:", data);

        // 处理响应数据
        if (data.output) {
            if (data.output.question) {
                // 如果返回的是新题目
                //console.log('📝 处理新题目数据:', data.output);
                addMessage(data.output, false, true);
            } else {
                // 如果返回的是普通文本
                // console.log('💬 处理文本响应:', data.output);
                addMessage(data.output || "感谢您的回答！");
            }
        } else {
            //console.warn('⚠️ 响应中没有找到output字段:', data);
            addMessage("❌ 抱歉，响应中没有找到output字段");
        }
    } catch (error) {
        handleApiError(error, "提交题目答案");
    } finally {
        hideLoading();
    }
}

function showLoading(isAnswer = false) {
    if (isAnswer) {
        // 如果是分析回答，显示进度条
        showProgress(true);
    } else {
        // 显示简单的loading提示
        loading.style.display = "block";
        const loadingText = "回答中...";
        loading.querySelector(".loading-dots").textContent = loadingText;
    }

    // 禁用发送按钮
    sendButton.disabled = true;
    const buttonText = isAnswer ? "分析中..." : "处理中...";
    sendButton.textContent = buttonText;
}

function hideLoading() {
    // 隐藏loading元素
    loading.style.display = "none";

    // 完成并隐藏进度条
    completeProgress();

    // 恢复发送按钮
    sendButton.disabled = false;
    sendButton.textContent = "发送";
}

/**
 * 发送聊天消息
 */
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // 添加用户消息到界面
    addMessage(message, true);
    chatInput.value = "";
    showLoading(false);

    try {
        console.log("📤 正在发送消息:", message);

        // 获取用户信息
        const userInfo = getCurrentUserInfo();

        // 创建资源数据
        const resourceData = createResourceData(
            currentQuestionId || "",
            message,
            currentClassId || "chat",
        );

        // 发送API请求（15秒超时）
        const response = await sendApiRequest(userInfo, resourceData, 15000);

        let data;
        const contentType = response.headers.get("content-type");

        try {
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                //console.log('Non-JSON response:', text);
                data = { output: text };
            }

            if (!response.ok) {
                throw new Error(
                    data.message || `HTTP error! status: ${response.status}`,
                );
            }

            if (data.output) {
                if (data.output.question) {
                    // 如果返回的是选择题
                    // console.log('Processing question data (sendMessage):', data.output);
                    addMessage(data.output, false, true);
                } else {
                    // 如果返回的是普通文本
                    // console.log('Processing text response (sendMessage):', data.output);
                    addMessage(data.output || "收到您的消息");
                }
            } else {
                //console.log('Response data:', data);
                addMessage(`❌ 抱歉，响应中没有找到output字段`);
            }
        } catch (parseError) {
            //console.warn('解析响应数据失赅:', parseError);
            // 如果解析失败，但响应成功，就显示默认消息
            addMessage("收到您的消息，请稍后...");
        }
    } catch (error) {
        handleApiError(error, "发送消息");
    } finally {
        hideLoading();
    }
}

// 事件监听器
sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendMessage();
    }
});

// 页面加载时聚焦输入框
window.addEventListener("load", () => {
    chatInput.focus();
});

// 插入文本到输入框的函数
function insertText(text) {
    const chatInput = document.getElementById("chatInput");
    chatInput.value = text;
    chatInput.focus();

    // 可选：自动发送消息
    // sendMessage();
}

// 禁用聊天输入框和发送按钮（答题时）
function disableChatInput() {
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton");

    if (chatInput && sendButton) {
        chatInput.disabled = true;
        chatInput.placeholder =
            "🚫 答题模式：聊天输入已禁用，退出测评答题才可以聊天哦...";
        chatInput.style.backgroundColor = "#f5f5f5";
        chatInput.style.color = "#999";

        sendButton.disabled = true;
        sendButton.style.backgroundColor = "#ccc";
        sendButton.style.cursor = "not-allowed";

        // console.log('🚫 答题模式：聊天输入已禁用');
    }
}

// 启用聊天输入框和发送按钮（退出答题后）
function enableChatInput() {
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton");

    if (chatInput && sendButton) {
        chatInput.disabled = false;
        chatInput.placeholder = "请输入您的问题...";
        chatInput.style.backgroundColor = "";
        chatInput.style.color = "";

        sendButton.disabled = false;
        sendButton.style.backgroundColor = "";
        sendButton.style.cursor = "";

        // console.log('✅ 退出答题：聊天输入已启用');
    }
}

// 重置后台状态但保留历史对话的函数（用于自动退出）
function resetBackendStateKeepHistory() {
    // 重新生成sessionId
    sessionId = generateUUID();
    // console.log('Reset session_id:', sessionId);

    // 重置question_id到默认值
    currentQuestionId = 111;
    // console.log('Reset question_id:', currentQuestionId);

    // 重置class_id到默认值
    currentClassId = "1";
    // console.log('Reset class_id:', currentClassId);

    // 重置进度条相关变量
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    currentProgress = 0;

    // ⚠️ 注意：这里不清理DOM中的历史对话，保留用户的问答记录
    // console.log('✅ 后台状态已重置，历史对话已保留');
}

// 退出专业推荐确认弹窗函数
function showExitConfirmDialog() {
    let countdown = 5;
    let countdownTimer;

    // 创建弹窗HTML
    const dialogHTML = `
    <div id="exitConfirmDialog" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: center;
        ">
            <div style="
                font-size: 18px;
                color: #333;
                margin-bottom: 20px;
                line-height: 1.5;
            ">本次测题将清除，退出本次测题推荐？</div>

            <div id="countdownText" style="
                font-size: 14px;
                color: #666;
                margin-bottom: 25px;
            ">将在 <span id="countdownNumber" style="color: #ff6b6b; font-weight: bold;">${countdown}</span> 秒后自动退出</div>

            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="continueBtn" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">继续</button>

                <button id="exitBtn" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s;
                    font-weight: bold;
                " onmouseover="this.style.background='#da190b'" onmouseout="this.style.background='#f44336'">退出</button>
            </div>
        </div>
    </div>
`;

    // 插入弹窗到页面
    document.body.insertAdjacentHTML("beforeend", dialogHTML);

    const dialog = document.getElementById("exitConfirmDialog");
    const countdownElement = document.getElementById("countdownNumber");
    const continueBtn = document.getElementById("continueBtn");
    const exitBtn = document.getElementById("exitBtn");

    // 倒计时函数
    function updateCountdown() {
        countdown--;
        countdownElement.textContent = countdown;

        if (countdown <= 0) {
            clearInterval(countdownTimer);
            executeExit();
        }
    }

    // 开始倒计时
    countdownTimer = setInterval(updateCountdown, 1000);

    // 执行退出操作
    function executeExit() {
        // 清理弹窗
        if (dialog) {
            dialog.remove();
        }
        clearInterval(countdownTimer);

        // 执行退出逻辑 - 回到初始状态
        const toggleBtn = document.getElementById("toggleBtn");
        const chatInput = document.getElementById("chatInput");
        const sendButton = document.getElementById("sendButton");

        // 重置按钮到初始状态
        toggleBtn.classList.remove("pressed");
        toggleBtn.innerHTML =
            '<span class="btn-text">开始专业推荐</span> <span class="click-hint">👆</span>';

        // 重置状态为初始状态（非推荐模式）
        isRecommendMode = false;
        currentQuestionId = null;
        currentClassId = null;

        // 同步更新清除按钮状态（非答题模式启用）
        updateClearButtonState();

        // 更新按钮互斥状态（恢复所有按钮正常状态）
        updateButtonMutualExclusion();
        // 启用聊天输入框
        enableChatInput();
        // 发送退出消息到后端
        // 修改专业推荐的退出逻辑
        setTimeout(() => {
            const chatInput = document.getElementById("chatInput");
            const sendButton = document.getElementById("sendButton");
            if (
                chatInput &&
                sendButton &&
                !chatInput.disabled &&
                !sendButton.disabled
            ) {
                chatInput.value = "退出专业推荐";
                // sendButton.click();
                console.log(
                    "✅ 用户手动退出：已发送退出专业推荐消息，回到初始状态",
                );
                sendMessage();
                // 等待消息发送完成后再重置状态
                setTimeout(() => {
                    chatInput.value = "";
                    // 重置所有后台状态变量
                    resetBackendStateKeepHistory();

                    // 清除用户信息变量
                    clearUserInfoVariables();
                }, 200);
            }
        }, 500);
    }

    // 继续按钮事件 - 关闭对话框，继续答题
    continueBtn.addEventListener("click", () => {
        clearInterval(countdownTimer);
        dialog.remove();
        console.log("✅ 用户选择继续答题，关闭退出确认对话框");
    });

    // 退出按钮事件
    exitBtn.addEventListener("click", () => {
        clearInterval(countdownTimer);
        executeExit();
    });

    // 点击背景关闭弹窗（继续）
    dialog.addEventListener("click", (e) => {
        if (e.target === dialog) {
            clearInterval(countdownTimer);
            dialog.remove();
        }
    });
}

// 心理测评专用的退出确认弹窗函数
function showPsychologyExitConfirmDialog() {
    let countdown = 5;
    let countdownTimer;

    // 创建弹窗HTML
    const dialogHTML = `
    <div id="psychologyExitConfirmDialog" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
        <div style="
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 400px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            text-align: center;
        ">
            <div style="
                font-size: 18px;
                color: #333;
                margin-bottom: 20px;
                line-height: 1.5;
            ">本次多元智能测评将清除，退出本次测评？</div>

            <div id="psychologyCountdownText" style="
                font-size: 14px;
                color: #666;
                margin-bottom: 25px;
            ">将在 <span id="psychologyCountdownNumber" style="color: #ff6b6b; font-weight: bold;">${countdown}</span> 秒后自动退出</div>

            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="psychologyContinueBtn" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s;
                " onmouseover="this.style.background='#45a049'" onmouseout="this.style.background='#4CAF50'">继续</button>

                <button id="psychologyExitBtn" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s;
                    font-weight: bold;
                " onmouseover="this.style.background='#da190b'" onmouseout="this.style.background='#f44336'">退出</button>
            </div>
        </div>
    </div>
`;

    // 插入弹窗到页面
    document.body.insertAdjacentHTML("beforeend", dialogHTML);

    const dialog = document.getElementById("psychologyExitConfirmDialog");
    const countdownElement = document.getElementById(
        "psychologyCountdownNumber",
    );
    const continueBtn = document.getElementById("psychologyContinueBtn");
    const exitBtn = document.getElementById("psychologyExitBtn");

    // 倒计时函数
    function updateCountdown() {
        countdown--;
        countdownElement.textContent = countdown;

        if (countdown <= 0) {
            clearInterval(countdownTimer);
            executePsychologyExit();
        }
    }

    // 开始倒计时
    countdownTimer = setInterval(updateCountdown, 1000);

    // 执行心理测评退出操作
    function executePsychologyExit() {
        // 清理弹窗
        if (dialog) {
            dialog.remove();
        }
        clearInterval(countdownTimer);

        // 执行退出逻辑 - 回到初始状态
        const psychologyBtn = document.getElementById("psychologyBtn");
        const chatInput = document.getElementById("chatInput");
        const sendButton = document.getElementById("sendButton");

        // 重置按钮到初始状态
        if (psychologyBtn) {
            psychologyBtn.classList.remove("pressed");
            psychologyBtn.innerHTML =
                '<span class="btn-text">多元智能测评</span> <span class="click-hint">👆</span>';
        }

        // 重置状态为初始状态（非心理测评模式）
        isPsychologyMode = false;
        currentQuestionId = null;
        currentClassId = null;

        // 同步更新清除按钮状态（非答题模式启用）
        updateClearButtonState();

        // 更新按钮互斥状态（恢复所有按钮正常状态）
        updateButtonMutualExclusion();

        // 启用聊天输入框
        enableChatInput();

        // 发送退出消息到后端
        setTimeout(() => {
            const chatInput = document.getElementById("chatInput");
            const sendButton = document.getElementById("sendButton");

            if (
                chatInput &&
                sendButton &&
                !chatInput.disabled &&
                !sendButton.disabled
            ) {
                chatInput.value = "退出多元智能测评";
                sendButton.click();
                console.log(
                    "✅ 用户手动退出：已发送退出多元智能测评XLCP_TAIWAN消息，回到初始状态",
                );

                // 清空输入框
                setTimeout(() => {
                    chatInput.value = "";

                    // 重置所有后台状态变量
                    resetBackendStateKeepHistory();
                    // 清除用户信息变量
                    clearUserInfoVariables();
                }, 200);
            }
        }, 500);

        console.log("✅ 已退出多元智能测评模式");
    }

    // 继续按钮点击事件
    continueBtn.addEventListener("click", function () {
        clearInterval(countdownTimer);
        dialog.remove();
        console.log("🔄 用户选择继续多元智能测评");
    });

    // 退出按钮点击事件
    exitBtn.addEventListener("click", function () {
        clearInterval(countdownTimer);
        executePsychologyExit();
    });

    // 点击背景关闭弹窗（继续测评）
    dialog.addEventListener("click", function (e) {
        if (e.target === dialog) {
            clearInterval(countdownTimer);
            dialog.remove();
            console.log("🔄 用户点击背景继续多元智能测评");
        }
    });
}

// 防止表单自动填充
function preventFormAutofill() {
    // 设置输入框的autocomplete属性为off
    document.getElementById("userName").setAttribute("autocomplete", "off");
    document.getElementById("userPhone").setAttribute("autocomplete", "off");
    document.getElementById("userIdCard").setAttribute("autocomplete", "off");

    // 清除输入框的值
    clearUserInfoVariables();

    // 监听页面刷新事件
    window.addEventListener("beforeunload", function () {
        clearUserInfoVariables();
    });
}

// 页面加载后初始化
window.addEventListener("load", () => {
    // 防止表单自动填充
    preventFormAutofill();
    // 为热门专业添加点击事件
    const majorItems = document.querySelectorAll(".major-item");
    majorItems.forEach((item) => {
        item.addEventListener("click", () => {
            const majorValue = item.getAttribute("data-value");
            insertText(majorValue);
        });
    });
});

// 切换按钮处理函数
let isRecommendMode = false; // 跟踪当前状态，初始为false（未在推荐模式）
let isPsychologyMode = false; // 跟踪心理测评状态，初始为false（未在心理测评模式）
let currentModalType = ""; // 标记当前模态框类型：'recommend' 或 'psychology'

// 按钮互斥管理函数
function updateButtonMutualExclusion() {
    const toggleBtn = document.getElementById("toggleBtn");
    const psychologyBtn = document.getElementById("psychologyBtn");

    console.log(
        "🔄 updateButtonMutualExclusion 被调用，当前状态：isRecommendMode =",
        isRecommendMode,
        ", isPsychologyMode =",
        isPsychologyMode,
    );

    if (!toggleBtn || !psychologyBtn) {
        console.warn("⚠️ 按钮元素未找到，跳过互斥状态更新");
        return;
    }

    // 当专业推荐进行中时，禁用多元智能测评按钮
    if (isRecommendMode) {
        psychologyBtn.disabled = true;
        psychologyBtn.style.opacity = "0.5";
        psychologyBtn.style.cursor = "not-allowed";
        psychologyBtn.title = "专业推荐进行中，请先退出后再使用多元智能测评";
        console.log("🚫 专业推荐进行中，已禁用多元智能测评按钮");
    }
    // 当多元智能测评进行中时，禁用专业推荐按钮
    else if (isPsychologyMode) {
        toggleBtn.disabled = true;
        toggleBtn.style.opacity = "0.5";
        toggleBtn.style.cursor = "not-allowed";
        toggleBtn.title = "多元智能测评进行中，请先退出后再使用专业推荐";
        console.log("🚫 多元智能测评进行中，已禁用专业推荐按钮");
    }
    // 都未进行时，恢复所有按钮正常状态
    else {
        // 恢复专业推荐按钮
        toggleBtn.disabled = false;
        toggleBtn.style.opacity = "1";
        toggleBtn.style.cursor = "pointer";
        toggleBtn.title = "";

        toggleBtn.onclick = handleToggleClick;

        // 恢复多元智能测评按钮
        psychologyBtn.disabled = false;
        psychologyBtn.style.opacity = "1";
        psychologyBtn.style.cursor = "pointer";
        psychologyBtn.title = "";

        console.log("✅ 所有按钮已恢复正常状态");
    }
}

// 手动测试按钮互斥状态的函数（仅用于调试）
function testButtonMutualExclusion() {
    console.log("🧪 手动测试按钮互斥状态:");
    console.log("  - isRecommendMode:", isRecommendMode);
    console.log("  - isPsychologyMode:", isPsychologyMode);

    const toggleBtn = document.getElementById("toggleBtn");
    const psychologyBtn = document.getElementById("psychologyBtn");

    if (toggleBtn) {
        console.log(
            "  - 专业推荐按钮 disabled:",
            toggleBtn.disabled,
            ", opacity:",
            toggleBtn.style.opacity,
        );
    }
    if (psychologyBtn) {
        console.log(
            "  - 多元智能测评按钮 disabled:",
            psychologyBtn.disabled,
            ", opacity:",
            psychologyBtn.style.opacity,
        );
    }

    // 手动调用一次互斥管理函数
    updateButtonMutualExclusion();
}

// 全局用户信息变量（在推荐流程中使用）
let currentUserInfo = {
    name: "",
    phone: "",
    idCard: "",
};

function handleToggleClick() {
    const toggleBtn = document.getElementById("toggleBtn");

    // 检查按钮是否被禁用（多元智能测评进行中）
    if (toggleBtn.disabled) {
        console.log("🚫 专业推荐按钮被禁用，多元智能测评进行中");
        addMessage(
            "⚠️ 多元智能测评进行中，请先退出后再使用专业推荐功能",
            false,
        );
        return;
    }

    console.log("👆 按钮被点击，当前isRecommendMode:", isRecommendMode);

    if (!isRecommendMode) {
        // 当前不在推荐模式（初始状态或答题完成后），点击开始新一轮推荐
        console.log("🎆 开始新一轮专业推荐，显示用户信息弹窗");
        showUserInfoModal();
    } else {
        // 当前在推荐模式中（答题过程中），点击退出
        console.log("🚪 用户在答题过程中点击退出，显示确认弹窗");
        showExitConfirmDialog();
    }
}

function handlePsychologyBtnClick() {
    const psychologyBtn = document.getElementById("psychologyBtn");

    // 检查按钮是否被禁用（专业推荐进行中）
    if (psychologyBtn.disabled) {
        console.log("🚫 多元智能测评按钮被禁用，专业推荐进行中");
        addMessage(
            "⚠️ 专业推荐进行中，请先退出后再使用多元智能测评功能",
            false,
        );
        return;
    }

    console.log(
        "👆 心理测评按钮被点击，当前isPsychologyMode:",
        isPsychologyMode,
    );

    if (!isPsychologyMode) {
        // 当前不在心理测评模式（初始状态或测评完成后），点击开始新一轮心理测评
        console.log("🎆 开始新一轮心理测评，显示用户信息弹窗");
        showPsychologyUserInfoModal();
    } else {
        // 当前在心理测评模式中（测评过程中），点击退出
        console.log("🚪 用户在心理测评过程中点击退出，显示确认弹窗");
        showPsychologyExitConfirmDialog();
    }
}

// 用户信息模态框控制函数
// 处理键盘事件，防止ESC键关闭模态框
function handleKeyDown(e) {
    if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function showUserInfoModal() {
    const modal = document.getElementById("userInfoModal");
    modal.style.display = "flex";
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    // 禁用页面滚动并防止背景内容滚动
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    // 标记当前是专业推荐模式
    currentModalType = "recommend";

    // 清空用户信息变量
    clearUserInfoVariables();

    // 添加键盘事件监听
    document.addEventListener("keydown", handleKeyDown, true);

    // 清空所有输入框
    document.getElementById("userName").value = "";
    document.getElementById("userPhone").value = "";
    document.getElementById("userIdCard").value = "";

    // 清空错误信息
    clearErrorMessages();

    // 移除已提交标记
    modal.removeAttribute("data-submitted");

    // 重置按钮状态（确保每次打开弹窗时按钮都处于正确的初始状态）
    const continueBtn = modal.querySelector(".continue-btn");
    const cancelBtn = modal.querySelector(".cancel-btn");

    if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.textContent = "开始测评";
        continueBtn.classList.remove("loading");
        continueBtn.style.display = "inline-flex";
        continueBtn.style.visibility = "visible";
        continueBtn.style.opacity = "1";
    }

    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = "我不填了";
        cancelBtn.style.display = "inline-flex";
        cancelBtn.style.visibility = "visible";
        cancelBtn.style.opacity = "1";
    }
}

function showPsychologyUserInfoModal() {
    const modal = document.getElementById("userInfoModal");
    modal.style.display = "flex";
    modal.classList.add("active");
    document.body.classList.add("modal-open");

    // 禁用页面滚动并防止背景内容滚动
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    // 标记当前是心理测评模式
    currentModalType = "psychology";

    // 添加键盘事件监听
    document.addEventListener("keydown", handleKeyDown, true);

    // 清空所有输入框
    document.getElementById("userName").value = "";
    document.getElementById("userPhone").value = "";
    document.getElementById("userIdCard").value = "";

    // 清空错误信息
    clearErrorMessages();

    // 重置按钮状态（确保每次打开弹窗时按钮都处于正确的初始状态）
    const continueBtn = modal.querySelector(".continue-btn");
    const cancelBtn = modal.querySelector(".cancel-btn");

    if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.textContent = "开始测评";
        continueBtn.classList.remove("loading");
        continueBtn.style.display = "inline-flex";
        continueBtn.style.visibility = "visible";
        continueBtn.style.opacity = "1";
    }

    if (cancelBtn) {
        cancelBtn.disabled = false;
        cancelBtn.textContent = "我不填了";
        cancelBtn.style.display = "inline-flex";
        cancelBtn.style.visibility = "visible";
        cancelBtn.style.opacity = "1";
    }

    console.log("✅ 心理测评用户信息弹窗已打开，按钮状态已重置为初始状态");

    // 设置焦点到第一个输入框
    setTimeout(() => {
        const firstInput = modal.querySelector("input");
        if (firstInput) {
            firstInput.focus();
        }
    }, 100);
}

function closeUserInfoModal() {
    const modal = document.getElementById("userInfoModal");
    modal.style.display = "none";
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");

    // 恢复页面滚动和定位
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";

    // 移除键盘事件监听
    document.removeEventListener("keydown", handleKeyDown, true);

    // 清空错误信息
    clearErrorMessages();

    // 如果是通过取消按钮关闭的，清除用户信息
    //  if (!modal.getAttribute('data-submitted')) {

    //      clearUserInfoVariables();
    //  }
}

function clearErrorMessages() {
    // 清空所有错误信息
    document.querySelectorAll(".error-message").forEach((el) => {
        el.textContent = "";
    });
}

// 用户信息模态框控制函数
// 处理键盘事件，防止ESC键关闭模态框
function handleKeyDown(e) {
    if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function validateUserInfo() {
    let isValid = true;
    const name = document.getElementById("userName").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    const idCard = document.getElementById("userIdCard").value.trim();

    // 清空之前的错误信息
    clearErrorMessages();

    // 验证姓名（非空，至少2个字符）
    if (!name) {
        const nameError = document.getElementById("nameError");
        if (nameError) nameError.textContent = "请输入您的姓名";
        isValid = false;
    } else if (name.length < 2) {
        const nameError = document.getElementById("nameError");
        if (nameError) nameError.textContent = "姓名至少需要2个字符";
        isValid = false;
    }

    // 验证手机号（11位数字）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) {
        const phoneError = document.getElementById("phoneError");
        if (phoneError) phoneError.textContent = "请输入您的手机号";
        isValid = false;
    } else if (!phoneRegex.test(phone)) {
        const phoneError = document.getElementById("phoneError");
        if (phoneError) phoneError.textContent = "请输入正确的11位手机号";
        isValid = false;
    }

    // 验证身份证号（15位或18位）
    const idCardRegex = /^(\d{15}|\d{17}[\dXx])$/;
    if (!idCard) {
        const idCardError = document.getElementById("idCardError");
        if (idCardError) idCardError.textContent = "请输入您的身份证号";
        isValid = false;
    } else if (!idCardRegex.test(idCard)) {
        const idCardError = document.getElementById("idCardError");
        if (idCardError)
            idCardError.textContent = "请输入正确的15位或18位身份证号";
        isValid = false;
    }

    return isValid;
}

async function validateAndContinue() {
    console.log("🚀 开始验证用户信息并继续...");

    // 先进行表单验证
    if (!validateUserInfo()) {
        console.log("❌ 用户信息验证未通过");

        // 恢复按钮状态（防止按钮被禁用或文本被修改）
        const continueBtn = document.querySelector(".continue-btn");
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = "开始推荐";
            continueBtn.classList.remove("loading");
        }

        // 添加错误提示动画
        const form = document.getElementById("userInfoForm");
        if (form) {
            form.classList.add("shake-error");
            setTimeout(() => {
                form.classList.remove("shake-error");
            }, 600);
        }
        return; // 验证不通过，直接返回
    }

    // 显示加载状态
    const continueBtn = document.querySelector(".continue-btn");
    const originalBtnText = continueBtn ? continueBtn.textContent : "开始推荐";

    if (continueBtn) {
        continueBtn.disabled = true;
        continueBtn.textContent = "🔄 正在初始化...";
        continueBtn.classList.add("loading");
    }

    try {
        // 保存用户信息到全局变量
        currentUserInfo = {
            name: document.getElementById("userName").value.trim(),
            phone: document.getElementById("userPhone").value.trim(),
            idCard: document.getElementById("userIdCard").value.trim(),
        };
        // console.log(currentUserInfo);
        console.log("✅ 用户信息验证通过，准备进入聊天界面");

        // 关闭用户信息模态框
        closeUserInfoModal();
        //console.log('closeUserInfoModal',currentUserInfo);
        // 显示欢迎消息
        setTimeout(() => {
            addMessage(
                `👋 您好 ${currentUserInfo.name}！完成以下选择题后，系统为您智能推荐专业分析结果！`,
                false,
            );
        }, 300);

        // 发送用户信息到后端
        const userInfoSent = await sendUserInfoToBackend();
        if (!userInfoSent) {
            console.error("❌ 用户信息发送失败，无法继续推荐流程");
            if (continueBtn) {
                continueBtn.disabled = false;
                continueBtn.textContent = originalBtnText;
                continueBtn.classList.remove("loading");
            }
            addMessage("❌ 用户信息发送失败，请重试", false);
            return;
        }

        // 更新按钮状态 - 进入推荐模式
        const toggleBtn = document.getElementById("toggleBtn");
        if (toggleBtn) {
            toggleBtn.textContent = "退出推荐";
            toggleBtn.onclick = showExitConfirmDialog;
            toggleBtn.classList.add("pressed");
            toggleBtn.innerHTML =
                '<span class="btn-text">退出专业推荐</span> <span class="click-hint">❌</span>';
        }

        // 静默发送"开始专业推荐"到后端（不显示在聊天窗口）
        const chatInput = document.getElementById("chatInput");
        const sendButton = document.getElementById("sendButton");

        if (chatInput && sendButton) {
            // 临时保存当前输入框的值
            const originalValue = chatInput.value;

            // 设置要发送的消息
            chatInput.value = "开始专业推荐MTBI";

            // 临时隐藏消息显示，避免在聊天窗口显示"开始专业推荐"
            const originalAddMessage = window.addMessage;
            let skipNextMessage = true;

            window.addMessage = function (message, isUser) {
                if (
                    skipNextMessage &&
                    isUser &&
                    message === "开始专业推荐MTBI"
                ) {
                    skipNextMessage = false;
                    return; // 跳过显示这条消息
                }
                return originalAddMessage.call(this, message, isUser);
            };

            // 发送消息
            sendButton.click();

            // 恢复原始的addMessage函数
            setTimeout(() => {
                window.addMessage = originalAddMessage;
            }, 100);

            // 恢复输入框原始值并禁用
            setTimeout(() => {
                chatInput.value = originalValue;
                disableChatInput();
                console.log("✅ 专业推荐流程已启动，输入框已禁用");
            }, 200);
        }

        // 更新状态 - 进入推荐模式
        isRecommendMode = true;

        // 同步更新清除按钮状态（答题模式禁用）
        updateClearButtonState();

        // 更新按钮互斥状态（禁用多元智能测评按钮）
        updateButtonMutualExclusion();
    } catch (error) {
        console.error("❌ 初始化过程中出错:", error);

        // 恢复按钮状态
        if (continueBtn) {
            continueBtn.disabled = false;
            continueBtn.textContent = originalBtnText;
            continueBtn.classList.remove("loading");
        }

        // 显示错误消息
        addMessage("❌ 初始化失败，请重试", false);
    }
}

// 心理测评专用的验证和继续函数
async function validateAndContinuePsychology() {
    console.log("🚀 开始验证用户信息并继续心理测评...");

    if (validateUserInfo()) {
        // 显示加载状态
        const continueBtn = document.querySelector(".continue-btn");
        const originalBtnText = continueBtn
            ? continueBtn.textContent
            : "开始测评";

        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.textContent = "🔄 正在初始化...";
            continueBtn.classList.add("loading");
        }

        try {
            // 保存用户信息到全局变量
            currentUserInfo = {
                name: document.getElementById("userName").value.trim(),
                phone: document.getElementById("userPhone").value.trim(),
                idCard: document.getElementById("userIdCard").value.trim(),
            };

            console.log("✅ 用户信息验证通过，准备进入心理测评界面");

            // 关闭用户信息模态框
            closeUserInfoModal();

            // 显示欢迎消息
            setTimeout(() => {
                addMessage(
                    `👋 您好 ${currentUserInfo.name}！完成以下选择题后，系统为您智能分析心理测评结果！`,
                    false,
                );
            }, 300);

            // 直接启动心理测评流程（不显示多余消息）
            setTimeout(async () => {
                try {
                    const psychologyBtn =
                        document.getElementById("psychologyBtn");
                    const chatInput = document.getElementById("chatInput");
                    const sendButton = document.getElementById("sendButton");

                    // 更新按钮状态 - 进入心理测评模式，显示退出按钮
                    if (psychologyBtn) {
                        psychologyBtn.classList.add("pressed");
                        psychologyBtn.innerHTML =
                            '<span class="btn-text">退出心理测评</span> <span class="click-hint">❌</span>';
                    }

                    // 静默发送"多元智能测评XLCP_TAIWAN"到后端（不显示在聊天窗口）
                    if (chatInput && sendButton) {
                        // 临时保存当前输入框的值
                        const originalValue = chatInput.value;

                        // 设置要发送的消息
                        chatInput.value = "多元智能测评XLCP_TAIWAN";

                        // 临时隐藏消息显示，避免在聊天窗口显示"多元智能测评XLCP_TAIWAN"
                        const originalAddMessage = window.addMessage;
                        let skipNextMessage = true;

                        window.addMessage = function (message, isUser) {
                            if (
                                skipNextMessage &&
                                isUser &&
                                message === "多元智能测评XLCP_TAIWAN"
                            ) {
                                skipNextMessage = false;
                                return; // 跳过显示这条消息
                            }
                            return originalAddMessage.call(
                                this,
                                message,
                                isUser,
                            );
                        };

                        // 发送消息
                        sendButton.click();

                        // 恢复原始的addMessage函数
                        setTimeout(() => {
                            window.addMessage = originalAddMessage;
                        }, 100);

                        // 恢复输入框原始值并禁用
                        setTimeout(() => {
                            chatInput.value = originalValue;
                            disableChatInput();
                            console.log("✅ 心理测评流程已启动，输入框已禁用");
                        }, 200);
                    }

                    // 更新状态 - 进入心理测评模式
                    isPsychologyMode = true;
                    console.log(
                        "🔄 心理测评状态已设置：isPsychologyMode =",
                        isPsychologyMode,
                    );

                    // 同步更新清除按钮状态（答题模式禁用）
                    updateClearButtonState();

                    // 更新按钮互斥状态（禁用专业推荐按钮）
                    console.log(
                        "🔄 即将调用 updateButtonMutualExclusion，当前 isPsychologyMode:",
                        isPsychologyMode,
                    );
                    updateButtonMutualExclusion();
                } catch (error) {
                    console.error("❌ 心理测评流程启动失败:", error);

                    // 恢复按钮状态
                    if (continueBtn) {
                        continueBtn.disabled = false;
                        continueBtn.textContent = originalBtnText;
                        continueBtn.classList.remove("loading");
                    }

                    // 显示错误提示
                    addMessage(
                        "抱歉，心理测评系统初始化失败，请稍后重试。",
                        false,
                    );
                }
            }, 500);
        } catch (error) {
            console.error("❌ 心理测评流程启动失败:", error);

            // 恢复按钮状态
            if (continueBtn) {
                continueBtn.disabled = false;
                continueBtn.textContent = originalBtnText;
                continueBtn.classList.remove("loading");
            }

            // 显示错误提示
            addMessage("抱歉，心理测评系统初始化失败，请稍后重试。", false);
        }
    } else {
        console.log("❌ 用户信息验证失败，请检查输入");
    }
}

// 统一处理模态框继续按钮点击事件
function handleContinueClick() {
    console.log("👆 模态框继续按钮被点击，当前模态框类型:", currentModalType);

    if (currentModalType === "psychology") {
        // 心理测评模式
        validateAndContinuePsychology();
    } else {
        // 默认为专业推荐模式
        validateAndContinue();
    }
}

function getUserInfo() {
    // 直接返回全局用户信息变量，如果不存在则返回空对象
    return currentUserInfo || { name: "", phone: "", idCard: "" };
}

// 清除用户信息变量（退出或完成推荐后调用）
function clearUserInfoVariables() {
    currentUserInfo = {
        name: "",
        phone: "",
        idCard: "",
    };

    // 清空表单
    const modal = document.getElementById("userInfoModal");
    if (modal) {
        const inputs = modal.querySelectorAll("input");
        inputs.forEach((input) => {
            input.value = "";
        });
        // 清空错误信息
        const errorMessages = modal.querySelectorAll(".error-message");
        errorMessages.forEach((error) => {
            error.textContent = "";
        });
    }

    console.log("🗑️ 用户信息变量和表单已重置");
}

// 获取当前推荐流程中的用户信息
function getCurrentUserInfo() {
    return currentUserInfo;
}

// 发送用户信息到后端API
/**
 * 发送用户信息到后端
 * @returns {Promise<boolean>} 成功返回true，失败返回false
 */
async function sendUserInfoToBackend() {
    // 设置默认值
    const currentQuestionId = window.currentQuestionId || "";
    // 根据当前模式确定消息类型
    let selectedValue = "开始专业推荐"; // 默认为专业推荐
    if (isPsychologyMode) {
        selectedValue = "多元智能测评XLCP_TAIWAN";
    }
    const currentClassId = "chat";

    try {
        // 验证用户信息
        const userInfo = getCurrentUserInfo();
        if (
            !userInfo ||
            !userInfo.name ||
            !userInfo.phone ||
            !userInfo.idCard
        ) {
            console.error("用户信息不完整，无法发送到后端");
            addMessage("❌ 用户信息不完整，请重新填写");
            return false;
        }

        console.log("📤 正在发送用户信息到后端...");

        // 创建资源数据
        const resourceData = createResourceData(
            currentQuestionId,
            selectedValue,
            currentClassId,
        );

        // 发送API请求
        const response = await sendApiRequest(userInfo, resourceData);

        // 检查响应状态
        if (!response.ok) {
            const errorText = await response
                .text()
                .catch(() => "无法获取错误详情");
            throw new Error(
                `服务器响应错误 (${response.status}): ${errorText}`,
            );
        }

        // 解析响应数据
        let data;
        const contentType = response.headers.get("content-type");

        try {
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                console.log("收到非JSON响应:", text);
                data = { success: true, message: text };
            }
        } catch (parseError) {
            console.warn("解析响应数据失败:", parseError);
            data = { success: true, message: "请求已发送" };
        }

        //console.log('✅ 用户信息已成功发送到后端', data);

        // 更新全局状态变量
        if (data && data.question_id) {
            window.currentQuestionId = data.question_id;
            console.log("🔄 已更新question_id:", data.question_id);
        }
        if (data && data.class_id) {
            window.currentClassId = data.class_id;
            console.log("🔄 已更新class_id:", data.class_id);
        }

        return true;
    } catch (error) {
        handleApiError(error, "发送用户信息");
        return false;
    }
}

async function proceedWithRecommendation() {
    const toggleBtn = document.getElementById("toggleBtn");
    const chatInput = document.getElementById("chatInput");
    const sendButton = document.getElementById("sendButton");

    // 先发送用户信息到后端
    const userInfoSent = await sendUserInfoToBackend();
    if (!userInfoSent) {
        addMessage("❌ 发送用户信息失败，请稍后重试");
        return;
    }

    // 执行原来的专业推荐逻辑
    toggleBtn.classList.add("pressed");
    toggleBtn.textContent = "退出专业推荐";

    // 先发送"专业推荐"消息，然后再禁用输入框
    setTimeout(() => {
        chatInput.value = "开始专业推荐";
        sendButton.click();

        // 发送完成后禁用聊天输入框，进入答题模式
        setTimeout(() => {
            disableChatInput();
            // console.log('🚫 专业推荐消息已发送，输入框已禁用');
        }, 100); // 等待发送完成后再禁用
    }, 300);
    // 更新状态 - 进入推荐模式
    isRecommendMode = true;
}

// 自动退出专业推荐函数（答题完成后调用）
function autoExitRecommendation() {
    const toggleBtn = document.getElementById("toggleBtn");
    if (!toggleBtn) return;

    console.log("🎉 专业推荐完成，准备重置按钮状态");

    // 重置按钮到初始状态（开始专业推荐）
    toggleBtn.classList.remove("pressed");
    toggleBtn.innerHTML =
        '<span class="btn-text">开始专业推荐</span> <span class="click-hint">👆</span>';

    // 重置模式状态为非推荐模式（可以重新开始）
    isRecommendMode = false;
    currentQuestionId = null;
    currentClassId = null;

    // 同步更新清除按钮状态（非答题模式启用）
    updateClearButtonState();

    // 更新按钮互斥状态（恢复所有按钮正常状态）
    updateButtonMutualExclusion();

    // 清除用户信息，为下一次推荐做准备
    currentUserInfo = null;

    // 清除表单输入框的值
    const userNameInput = document.getElementById("userName");
    const userPhoneInput = document.getElementById("userPhone");
    const userIdCardInput = document.getElementById("userIdCard");

    if (userNameInput) userNameInput.value = "";
    if (userPhoneInput) userPhoneInput.value = "";
    if (userIdCardInput) userIdCardInput.value = "";

    // 启用聊天输入框，允许用户继续聊天或重新开始推荐
    enableChatInput();

    // 重置后台状态但保留历史对话
    resetBackendStateKeepHistory();

    // 生成新的session_id为下一次推荐做准备
    sessionId = generateUUID();

    console.log("✅ 专业推荐流程已重置，用户可以重新开始新一轮推荐或继续聊天");
    console.log("🆔 新session_id:", sessionId);
}

// 自动退出心理测评函数（答题完成后调用）
function autoExitPsychology() {
    const psychologyBtn = document.getElementById("psychologyBtn");
    if (!psychologyBtn) return;

    console.log("🎉 多元智能测评完成，准备重置按钮状态");

    // 重置按钮到初始状态（多元智能测评）
    psychologyBtn.classList.remove("pressed");
    psychologyBtn.innerHTML =
        '<span class="btn-text">多元智能测评</span> <span class="click-hint">👆</span>';

    // 重置模式状态为非心理测评模式（可以重新开始）
    isPsychologyMode = false;
    currentQuestionId = null;
    currentClassId = null;

    // 同步更新清除按钮状态（非答题模式启用）
    updateClearButtonState();

    // 更新按钮互斥状态（恢复所有按钮正常状态）
    updateButtonMutualExclusion();

    // 清除用户信息，为下一次测评做准备
    currentUserInfo = null;

    // 清除表单输入框的值
    const userNameInput = document.getElementById("userName");
    const userPhoneInput = document.getElementById("userPhone");
    const userIdCardInput = document.getElementById("userIdCard");

    if (userNameInput) userNameInput.value = "";
    if (userPhoneInput) userPhoneInput.value = "";
    if (userIdCardInput) userIdCardInput.value = "";

    // 启用聊天输入框
    enableChatInput();

    // 重置后台状态但保留历史对话
    resetBackendStateKeepHistory();

    // 生成新的session_id为下一次测评做准备
    sessionId = generateUUID();

    console.log("✅ 多元智能测评已重置完成，可以开始新一轮测评");
    console.log("🆔 新session_id:", sessionId);
}

// 点击模态框外部关闭模态框
window.onclick = function (event) {
    const modal = document.getElementById("userInfoModal");
    if (event.target === modal) {
        closeUserInfoModal();
    }
};

// 清除聊天记录相关功能
let clearChatTimer = null;
let clearChatCountdown = 60;

// 添加常驻清除聊天按钮（固定在chat-messages区域右下角）
function addPermanentClearChatButton() {
    // 先移除已存在的按钮，避免重复
    const existingBtn = document.getElementById("clearChatBtn");
    if (existingBtn) {
        existingBtn.remove();
    }

    // 创建新的清除按钮
    const clearBtn = document.createElement("button");
    clearBtn.id = "clearChatBtn";
    clearBtn.className = "clear-chat-button";
    clearBtn.textContent = "清除记录";
    clearBtn.title = "清除聊天记录，保留欢迎消息";
    clearBtn.onclick = clearChatHistory;

    // 根据当前推荐模式状态设置按钮状态
    updateClearButtonState(clearBtn);

    // 添加按钮到body，但使用动态定位到chat-messages区域右下角
    document.body.appendChild(clearBtn);

    // 动态计算并设置按钮位置
    positionClearButton();

    // 监听窗口大小变化，重新定位按钮
    window.addEventListener("resize", positionClearButton);

    // 监听页面内容变化，重新定位按钮
    const observer = new MutationObserver(positionClearButton);
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
        observer.observe(chatMessages, {
            childList: true,
            subtree: true,
        });
    }

    console.log("✅ 常驻清除按钮已添加并定位到chat-messages区域右下角");
}

// 动态定位清除按钮到chat-messages区域右下角
function positionClearButton() {
    const clearBtn = document.getElementById("clearChatBtn");
    const chatMessages = document.getElementById("chatMessages");

    if (!clearBtn || !chatMessages) return;

    // 获取chat-messages区域的位置和尺寸
    const rect = chatMessages.getBoundingClientRect();

    // 计算按钮位置（相对于视口）
    const buttonRight = window.innerWidth - rect.right + 20; // 距离右边界20px
    const buttonBottom = window.innerHeight - rect.bottom + 20; // 距离底部20px

    // 应用位置
    clearBtn.style.right = buttonRight + "px";
    clearBtn.style.bottom = buttonBottom + "px";
}

// 更新清除按钮状态（与推荐按钮同步）
function updateClearButtonState(clearBtn) {
    if (!clearBtn) {
        clearBtn = document.getElementById("clearChatBtn");
    }
    if (!clearBtn) return;

    if (isRecommendMode || isPsychologyMode) {
        // 答题模式时禁用清除按钮（专业推荐或心理测评）
        clearBtn.disabled = true;
        const modeText = isRecommendMode ? "专业推荐" : "多元智能测评";
        clearBtn.title = `${modeText}答题过程中无法清除记录`;
        console.log(`🚫 ${modeText}模式：清除按钮已禁用`);
    } else {
        // 非答题模式时启用清除按钮
        clearBtn.disabled = false;
        clearBtn.title = "清除聊天记录，保留欢迎消息";
        console.log("✅ 非答题模式：清除按钮已启用");
    }
}

// 清除聊天记录（仅清除聊天内容，不影响其他功能）
function clearChatHistory() {
    console.log("🧹 开始清除聊天记录...");

    // 清除聊天消息但保留开场白
    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) {
        // 清空所有消息 DOM 节点
        while (chatMessages.firstChild) {
            chatMessages.removeChild(chatMessages.firstChild);
        }

        // 重新添加开场白
        const welcomeMessageDiv = document.createElement("div");
        welcomeMessageDiv.className = "message assistant";

        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = "message-bubble";
        bubbleDiv.innerHTML = `
         🎓 欢迎使用鸿源技术学校智能推荐系统！<br><br>
            🎯 <strong>产品介绍：</strong><br>
            • 专业智能推荐：通过答题分析，为职业学生推荐最适合的专业方向<br>
            • 智能咨询对话：可咨询专业信息、学校情况等问题<br>
            • 语音交互体验：右侧数字人支持语音对话交流<br><br>
            📝 <strong>使用说明：</strong><br>
            1️⃣ 点击左侧“开始专业推荐”按钮，填写个人信息后开始答题<br>
            2️⃣ 答题完成后，系统将生成个性化的专业推荐报告<br>
            3️⃣ 也可直接在下方输入框发送消息，进行自由咨询<br><br>
            现在就开始体验吧！🚀
    `;

        welcomeMessageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(welcomeMessageDiv);

        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;

        console.log("✅ 聊天记录已彻底清除，开场白已恢复");
    }

    // 重新添加常驻清除按钮
    setTimeout(() => {
        addPermanentClearChatButton();
    }, 100);

    console.log("✅ 聊天记录清除完成，专业推荐功能保持正常");
}

// 页面加载完成后初始化常驻清除按钮
document.addEventListener("DOMContentLoaded", function () {
    console.log("📄 页面加载完成，初始化常驻清除按钮");

    // 等待DOM完全渲染后添加常驻清除按钮
    setTimeout(() => {
        addPermanentClearChatButton();
    }, 500);
});
