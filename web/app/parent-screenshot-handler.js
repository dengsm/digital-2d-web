// 父页面截图处理器 - 用于index.html
// 监听来自iframe的截图请求并执行完整页面截图

console.log('父页面截图处理器已加载');

// 动态加载html2canvas库（如果尚未加载）
function loadHtml2Canvas() {
    return new Promise((resolve, reject) => {
        // 检查是否已经加载
        if (window.html2canvas) {
            console.log('html2canvas已存在，无需重复加载');
            resolve(window.html2canvas);
            return;
        }
        
        console.log('开始加载html2canvas库...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => {
            console.log('html2canvas库加载成功');
            resolve(window.html2canvas);
        };
        script.onerror = () => {
            console.error('html2canvas库加载失败');
            reject(new Error('html2canvas库加载失败'));
        };
        document.head.appendChild(script);
    });
}

// 执行父页面截图的函数
async function captureParentPageScreenshot() {
    console.log('=== 开始执行父页面完整截图 ===');
    
    try {
        // 确保html2canvas已加载
        const html2canvas = await loadHtml2Canvas();
        
        // 获取完整页面尺寸
        const fullWidth = Math.max(
            document.documentElement.scrollWidth,
            document.documentElement.offsetWidth,
            document.documentElement.clientWidth,
            window.innerWidth
        );
        
        const fullHeight = Math.max(
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight,
            document.documentElement.clientHeight,
            window.innerHeight
        );
        
        console.log('父页面完整尺寸:', fullWidth, 'x', fullHeight);
        console.log('当前窗口尺寸:', window.innerWidth, 'x', window.innerHeight);
        
        // html2canvas配置
        const options = {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null, // 保持原始背景
            scale: 1,
            logging: true,
            width: fullWidth,
            height: fullHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            x: 0,
            y: 0,
            foreignObjectRendering: true,
            removeContainer: false,
            imageTimeout: 20000, // 20秒超时
            onclone: (clonedDoc) => {
                console.log('正在克隆父页面文档用于截图...');
                
                // 确保iframe在克隆文档中也被正确处理
                const iframes = clonedDoc.querySelectorAll('iframe');
                iframes.forEach((iframe, index) => {
                    console.log(`处理iframe ${index + 1}:`, iframe.src);
                    // 保持iframe的可见性
                    iframe.style.visibility = 'visible';
                    iframe.style.display = 'block';
                });
                
                // 确保浮窗元素可见
                const draggableWindows = clonedDoc.querySelectorAll('.draggable-window');
                draggableWindows.forEach((window, index) => {
                    console.log(`处理浮窗 ${index + 1}`);
                    window.style.visibility = 'visible';
                    window.style.display = 'block';
                });
                
                return clonedDoc;
            }
        };
        
        console.log('开始执行html2canvas截图...');
        const canvas = await html2canvas(document.documentElement, options);
        
        console.log('父页面截图成功！');
        console.log('截图尺寸:', canvas.width, 'x', canvas.height);
        
        const imageData = canvas.toDataURL('image/png', 1.0);
        const fileSizeKB = Math.round(imageData.length / 1024);
        console.log('截图文件大小:', fileSizeKB, 'KB');
        
        return imageData;
        
    } catch (error) {
        console.error('父页面截图失败:', error);
        throw error;
    }
}

// 监听来自iframe的消息
window.addEventListener('message', async (event) => {
    console.log('父页面收到消息:', event.data);
    
    // 检查是否是截图请求
    if (event.data && event.data.type === 'SCREENSHOT_REQUEST') {
        console.log('收到iframe的截图请求，开始处理...');
        
        try {
            // 执行截图
            const imageData = await captureParentPageScreenshot();
            
            // 发送成功响应
            const response = {
                type: 'SCREENSHOT_RESPONSE',
                success: true,
                imageData: imageData,
                timestamp: Date.now(),
                originalRequest: event.data
            };
            
            console.log('截图完成，发送响应给iframe');
            event.source.postMessage(response, '*');
            
        } catch (error) {
            console.error('处理截图请求时出错:', error);
            
            // 发送失败响应
            const response = {
                type: 'SCREENSHOT_RESPONSE',
                success: false,
                error: error.message || '截图失败',
                timestamp: Date.now(),
                originalRequest: event.data
            };
            
            event.source.postMessage(response, '*');
        }
    }
});

console.log('父页面截图处理器初始化完成，等待iframe截图请求...');
