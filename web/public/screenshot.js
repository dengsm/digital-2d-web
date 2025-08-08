// 父页面截图处理器 - 用于index.html
// 监听来自iframe的截图请求并执行完整页面截图

// console.log('父页面截图处理器已加载');

// 动态加载html2canvas库（如果尚未加载）
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        // 检查是否已经加载
        if (window.html2canvas) {
            // console.log('html2canvas已存在，无需重复加载');
            resolve(window.html2canvas);
            return;
        }

        // console.log('开始加载html2canvas库...');
        const script = document.createElement("script");
        script.src =
            "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = () => {
            // console.log('html2canvas库加载成功');
            resolve(window.html2canvas);
        };
        script.onerror = () => {
            // console.error('html2canvas库加载失败');
            reject(new Error("html2canvas库加载失败"));
        };
        document.head.appendChild(script);
    });
}

// 提取并输出当前会话内容的函数
function writelog() {
    // console.log('=== writelog: 开始提取当前位置的会话内容 ===');

    try {
        // 获取当前滚动位置信息
        const scrollInfo = {
            scrollTop: window.pageYOffset || document.documentElement.scrollTop,
            scrollLeft:
                window.pageXOffset || document.documentElement.scrollLeft,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            timestamp: new Date().toLocaleString(),
        };
        // console.log('当前页面滚动位置:', scrollInfo);

        // 获取左侧聊天容器
        const chatContainer = document.getElementById("chatMessages");
        if (!chatContainer) {
            // console.log('writelog: 未找到聊天容器 #chatMessages');
            return;
        }

        // 获取聊天容器的位置和尺寸信息
        const containerRect = chatContainer.getBoundingClientRect();
        const containerScrollTop = chatContainer.scrollTop;
        const containerScrollHeight = chatContainer.scrollHeight;
        const containerClientHeight = chatContainer.clientHeight;

        // console.log('聊天容器信息:', {
        //     containerRect: {
        //         top: containerRect.top,
        //         bottom: containerRect.bottom,
        //         height: containerRect.height
        //     },
        //     scroll: {
        //         scrollTop: containerScrollTop,
        //         scrollHeight: containerScrollHeight,
        //         clientHeight: containerClientHeight
        //     }
        // });

        // 提取所有聊天消息
        const messages = chatContainer.querySelectorAll(".message");
        const chatHistory = [];
        const visibleMessages = [];

        // console.log(`writelog: 找到 ${messages.length} 条消息`);
        // console.log(`writelog: 聊天容器可视区域范围: ${containerRect.top.toFixed(1)} - ${containerRect.bottom.toFixed(1)}`);

        messages.forEach((message, index) => {
            const isUser = message.classList.contains("user");
            const isAssistant = message.classList.contains("assistant");
            const bubble = message.querySelector(".message-bubble");

            if (bubble) {
                const content = bubble.textContent || bubble.innerText || "";
                const role = isUser ? "用户" : isAssistant ? "AI助手" : "未知";

                // 获取消息元素的位置信息（相对于视口）
                const rect = message.getBoundingClientRect();

                // 关键修正：计算消息相对于聊天容器的可见性
                // 检查消息是否在聊天容器的可视区域内
                const messageTopRelativeToContainer =
                    rect.top - containerRect.top;
                const messageBottomRelativeToContainer =
                    rect.bottom - containerRect.top;

                // 计算在聊天容器内的可见部分
                let visibleRatio = 0;
                let visibleHeight = 0;

                // 检查消息是否与聊天容器的可视区域有交集
                if (
                    messageBottomRelativeToContainer > 0 &&
                    messageTopRelativeToContainer < containerRect.height
                ) {
                    const visibleTop = Math.max(
                        0,
                        messageTopRelativeToContainer,
                    );
                    const visibleBottom = Math.min(
                        containerRect.height,
                        messageBottomRelativeToContainer,
                    );
                    visibleHeight = Math.max(0, visibleBottom - visibleTop);
                    visibleRatio =
                        rect.height > 0 ? visibleHeight / rect.height : 0;
                }

                // 更严格的可见性判断：
                // 方案1：基于可见比例（至少可见 50% 才算真正可见，80%肯定可见）
                const minVisibleRatio = 0.5;
                const isVisibleByRatio = visibleRatio >= minVisibleRatio;

                // 方案2：基于阈值（至少可见 40px 才算有效可见）
                const minVisibleHeight = 40;
                const isVisibleByHeight = visibleHeight >= minVisibleHeight;

                // 方案3：边缘检测 - 避免紧贴容器边缘的消息被误判
                const edgeBuffer = 10; // 距离容器边缘的缓冲区
                const isNotTooCloseToTop =
                    messageTopRelativeToContainer >= -edgeBuffer;
                const isNotTooCloseToBottom =
                    messageBottomRelativeToContainer <=
                    containerRect.height + edgeBuffer;
                const isNotAtEdge = isNotTooCloseToTop && isNotTooCloseToBottom;

                // 方案4：完整性检测 - 确保消息的关键部分都在容器内
                const messageCenterRelativeToContainer =
                    messageTopRelativeToContainer + rect.height / 2;
                const isCenterInViewport =
                    messageCenterRelativeToContainer >= 0 &&
                    messageCenterRelativeToContainer <= containerRect.height;

                // 综合判断：分层判断逻辑
                let isVisible = false;

                // 高可见比例消息（80%+）：放宽其他条件
                if (visibleRatio >= 0.8) {
                    // 80%以上可见比例的消息，只需要满足基本的高度要求
                    isVisible = isVisibleByHeight;
                }
                // 中等可见比例消息（50%-80%）：需要满足更多条件
                else if (visibleRatio >= 0.5) {
                    isVisible =
                        isVisibleByRatio && isVisibleByHeight && isNotAtEdge;
                }
                // 低可见比例消息（<50%）：需要满足所有严格条件
                else {
                    isVisible =
                        isVisibleByRatio &&
                        isVisibleByHeight &&
                        isNotAtEdge &&
                        isCenterInViewport;
                }

                // 详细调试信息
                const debugInfo = {
                    messageIndex: index + 1,
                    role: role,
                    viewportRect: `${rect.top.toFixed(1)} - ${rect.bottom.toFixed(1)}`,
                    containerRelativeRect: `${messageTopRelativeToContainer.toFixed(1)} - ${messageBottomRelativeToContainer.toFixed(1)}`,
                    visibleHeight: visibleHeight.toFixed(1),
                    visibleRatio: (visibleRatio * 100).toFixed(1) + "%",
                    messageCenterInContainer:
                        messageCenterRelativeToContainer.toFixed(1),
                    containerHeight: containerRect.height.toFixed(1),
                    checks: {
                        isVisibleByRatio: isVisibleByRatio,
                        isVisibleByHeight: isVisibleByHeight,
                        isNotAtEdge: isNotAtEdge,
                        isCenterInViewport: isCenterInViewport,
                    },
                    finalVisible: isVisible,
                };
                // console.log(`writelog: 消息 ${index + 1} 详细信息:`, debugInfo);

                const messageData = {
                    index: index + 1,
                    role: role,
                    content: content.trim(),
                    timestamp: new Date().toLocaleString(),
                    position: {
                        // 相对于视口的位置
                        viewportTop: rect.top,
                        viewportBottom: rect.bottom,
                        // 相对于聊天容器的位置
                        containerTop: messageTopRelativeToContainer,
                        containerBottom: messageBottomRelativeToContainer,
                        height: rect.height,
                    },
                    visibility: {
                        isVisible: isVisible,
                        visibleRatio: Math.round(visibleRatio * 100) / 100, // 保留两位小数
                        inViewport:
                            rect.bottom > 0 &&
                            rect.top < scrollInfo.viewportHeight,
                    },
                };

                chatHistory.push(messageData);

                // 只记录可见的消息
                if (isVisible) {
                    visibleMessages.push(messageData);
                    // console.log(`writelog: [可见] 消息 ${index + 1} [${role}] 可见比例:${Math.round(visibleRatio * 100)}%`, content.trim());
                } else {
                    let reason = "部分可见";
                    if (messageBottomRelativeToContainer <= 0) {
                        reason = "在容器上方";
                    } else if (
                        messageTopRelativeToContainer >= containerRect.height
                    ) {
                        reason = "在容器下方";
                    } else if (!isVisibleByRatio) {
                        reason = "可见比例不足";
                    } else if (!isVisibleByHeight) {
                        reason = "可见高度不足";
                    } else if (!isNotAtEdge) {
                        reason = "太靠近边缘";
                    } else if (!isCenterInViewport) {
                        reason = "中心不在容器内";
                    }
                    // console.log(`writelog: [不可见] 消息 ${index + 1} [${role}] ${reason} 容器位置:${messageTopRelativeToContainer.toFixed(1)}-${messageBottomRelativeToContainer.toFixed(1)} 可见比例:${Math.round(visibleRatio * 100)}%`);
                }
            }
        });

        // 输出汇总信息
        // console.log('=== writelog: 聊天记录汇总 ===');
        // console.log('writelog: 总消息数:', chatHistory.length);
        // console.log('writelog: 当前可见消息数:', visibleMessages.length);
        // console.log('writelog: 当前可见的聊天内容:', visibleMessages);

        // 如果有可见消息，详细输出
        if (visibleMessages.length > 0) {
            // console.log('=== 当前窗口可见的聊天消息详情 ===');
            visibleMessages.forEach((msg, idx) => {
                // console.log(`消息 ${msg.index}: [${msg.role}] ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
            });
        } else {
            // console.log('writelog: 当前窗口内没有可见的聊天消息');
        }

        // 返回数据供调用者使用
        return {
            chatHistory: chatHistory,
            visibleMessages: visibleMessages,
            scrollInfo: scrollInfo,
            totalMessages: chatHistory.length,
            visibleMessagesCount: visibleMessages.length,
            extractTime: new Date().toISOString(),
        };
    } catch (error) {
        console.error("writelog: 提取会话内容时出错:", error);
        return null;
    }
}

// 父页面截图函数 - 使用DOM截图方案（无需权限弹窗）
async function captureParentPageScreenshot() {
    console.log("=== 开始使用DOM截图方案 ===");

    try {
        // 动态加载html2canvas
        if (!window.html2canvas) {
            console.log("加载html2canvas库...");
            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src =
                    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        // 获取当前滚动位置
        const currentScrollX =
            window.pageXOffset || document.documentElement.scrollLeft;
        const currentScrollY =
            window.pageYOffset || document.documentElement.scrollTop;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        console.log("当前滚动位置:", currentScrollX, "x", currentScrollY);
        console.log("视口尺寸:", viewportWidth, "x", viewportHeight);

        // 使用更简单的方法：直接截取body元素，并设置正确的滚动参数
        const options = {
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            scale: 1,
            logging: false,
            width: viewportWidth,
            height: viewportHeight,
            windowWidth: viewportWidth,
            windowHeight: viewportHeight,
            scrollX: currentScrollX,
            scrollY: currentScrollY,
            x: currentScrollX,
            y: currentScrollY,
            foreignObjectRendering: false, // 禁用以避免问题
            removeContainer: true,
            imageTimeout: 10000,
        };

        console.log("开始执行DOM截图...");

        // 直接截取document.body
        const canvas = await html2canvas(document.body, options);

        console.log("DOM截图成功！");
        console.log("截图尺寸:", canvas.width, "x", canvas.height);

        // 转换为图片数据
        const imageData = canvas.toDataURL("image/png", 0.9);
        const fileSizeKB = Math.round(imageData.length / 1024);
        console.log("截图文件大小:", fileSizeKB, "KB");

        return imageData;
    } catch (error) {
        console.error("父页面截图失败:", error);
        throw error;
    }
}

// 监听来自iframe的消息
window.addEventListener("message", async (event) => {
    // 检查是否是截图请求
    if (event.data && event.data.type === "SCREENSHOT_REQUEST") {
        console.log("收到iframe的截图请求，开始处理...");

        try {
            // 在截图前调用writelog函数提取当前会话内容
            console.log("调用writelog函数提取当前位置的会话内容...");
            const chatData = writelog();

            // 执行截图
            const imageData = await captureParentPageScreenshot();

            // 发送成功响应
            const response = {
                type: "SCREENSHOT_RESPONSE",
                success: true,
                imageData: imageData,
                timestamp: Date.now(),
                originalRequest: event.data,
            };

            console.log("截图完成，发送响应给iframe");
            event.source.postMessage(response, "*");
        } catch (error) {
            console.error("处理截图请求时出错:", error);

            // 发送失败响应
            const response = {
                type: "SCREENSHOT_RESPONSE",
                success: false,
                error: error.message || "截图失败",
                timestamp: Date.now(),
                originalRequest: event.data,
            };

            event.source.postMessage(response, "*");
        }
    }
});

console.log("父页面截图处理器初始化完成，等待iframe截图请求...");
