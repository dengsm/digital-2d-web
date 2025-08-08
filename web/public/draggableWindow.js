// 窗口状态管理
class DraggableWindow {
    constructor(element) {
        this.element = element;
        this.isDragging = false;
        this.isResizing = false;
        this.resizeDirection = "";

        // 位置和尺寸
        this.x = 0;
        this.y = 0;
        this.width = 400;
        this.height = 600;

        // 鼠标和窗口起始状态
        this.startMouseX = 0;
        this.startMouseY = 0;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;

        this.init();
    }

    init() {
        const header = this.element.querySelector("#window-header");
        const minimizeBtn = this.element.querySelector("#minimizeBtn");
        const resizeHandles = this.element.querySelectorAll(".resize-handle");

        // 拖动事件
        header.addEventListener("mousedown", (e) => this.startDrag(e));

        // 调整大小事件
        resizeHandles.forEach((handle) => {
            handle.addEventListener("mousedown", (e) => this.startResize(e));
        });

        // 全局事件
        document.addEventListener("mousemove", (e) => this.handleMouseMove(e));
        document.addEventListener("mouseup", (e) => this.handleMouseUp(e));

        // 最小化按钮
        minimizeBtn.addEventListener("click", () => {
            this.element.classList.toggle("minimized");
        });

        // 初始化位置
        this.updatePosition();
    }

    startDrag(e) {
        if (e.target.classList.contains("resize-handle")) return;
        if (e.target.id === "minimizeBtn") return;

        this.isDragging = true;
        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;
        this.startX = this.x;
        this.startY = this.y;

        this.element.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        e.preventDefault();
    }

    startResize(e) {
        this.isResizing = true;
        this.resizeDirection = e.target.getAttribute("data-direction");

        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;
        this.startX = this.x;
        this.startY = this.y;
        this.startWidth = this.width;
        this.startHeight = this.height;

        document.body.style.userSelect = "none";
        document.body.style.cursor = e.target.style.cursor;
        this.element.classList.add("resizing");

        e.preventDefault();
        e.stopPropagation();
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            this.drag(e);
        } else if (this.isResizing) {
            this.resize(e);
        }
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            this.endDrag();
        } else if (this.isResizing) {
            this.endResize();
        }
    }

    drag(e) {
        const deltaX = e.clientX - this.startMouseX;
        const deltaY = e.clientY - this.startMouseY;

        this.x = this.startX + deltaX;
        this.y = this.startY + deltaY;

        this.updatePosition();
    }

    resize(e) {
        const deltaX = e.clientX - this.startMouseX;
        const deltaY = e.clientY - this.startMouseY;

        let newX = this.startX;
        let newY = this.startY;
        let newWidth = this.startWidth;
        let newHeight = this.startHeight;

        // 根据方向调整
        if (this.resizeDirection.includes("e")) {
            newWidth = Math.max(300, this.startWidth + deltaX);
        }
        if (this.resizeDirection.includes("w")) {
            newWidth = Math.max(300, this.startWidth - deltaX);
            newX = this.startX + (this.startWidth - newWidth);
        }
        if (this.resizeDirection.includes("s")) {
            newHeight = Math.max(200, this.startHeight + deltaY);
        }
        if (this.resizeDirection.includes("n")) {
            newHeight = Math.max(200, this.startHeight - deltaY);
            newY = this.startY + (this.startHeight - newHeight);
        }

        this.x = newX;
        this.y = newY;
        this.width = newWidth;
        this.height = newHeight;

        this.updatePosition();
        this.updateSize();
    }

    endDrag() {
        this.isDragging = false;
        this.element.style.cursor = "default";
        document.body.style.userSelect = "";
    }

    endResize() {
        this.isResizing = false;
        this.resizeDirection = "";
        this.element.classList.remove("resizing");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
    }

    updatePosition() {
        this.element.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    }

    updateSize() {
        this.element.style.width = this.width + "px";
        this.element.style.height = this.height + "px";
    }
}

// 初始化窗口
let draggableWindow;

// 页面加载完成后初始化
window.addEventListener("load", function () {
    const windowElement = document.getElementById("draggable-window");
    draggableWindow = new DraggableWindow(windowElement);

    // 显示窗口
    setTimeout(function () {
        windowElement.style.opacity = "1";
    }, 500);
});
