/** this file is used to embed the sentio in a website
 * the sentioConfig should be defined in the html file before this script is included
 * the sentioConfig should contain the token of the chatbot
 * the token can be found in the chatbot settings page
 */

// attention: This JavaScript script must be placed after the <body> element. Otherwise, the script will not work.

(function () {
  // Constants for DOM element IDs and configuration key
  const configKey = "sentioConfig";
  const buttonId = "sentio-bubble-button";
  const iframeId = "sentio-bubble-window";
  const config = window[configKey];

  // SVG icons for open and close states
  const svgIcons = {
    open: `<svg id="openIcon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 14c-.83 0-1.5-.67-1.5-1.5S5.67 11 6.5 11h.05c.25-1.25 1.25-2.25 2.45-2.25.5 0 .95.15 1.35.4C10.85 8.45 11.85 8 13 8c1.65 0 3 1.35 3 3h1.5c.83 0 1.5.67 1.5 1.5S18.33 14 17.5 14H6.5z" fill="#ffffff" stroke="#ffffff" stroke-width="1"/>
      <circle cx="8" cy="12" r="1.5" fill="#ffffff"/>
      <circle cx="16" cy="11.5" r="1.2" fill="#ffffff"/>
      <circle cx="12" cy="10.5" r="1" fill="#ffffff"/>
    </svg>`,
    close: `<svg id="closeIcon" width="24" height="24" viewBox="0 0 24 24" fill="none" >
      <path d="M18 18L6 6M6 18L18 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  };

  // Main function to embed the chatbot
  async function embedChatbot() {
    if (!config || !config.baseUrl || !config.appId) {
      console.error(`${configKey} is empty or token is not provided`);
      return;
    }

    // pre-check the length of the URL
    const iframeUrl = `${config.baseUrl}/sentio/${config.appId}`;

    // Function to create the iframe for the chatbot
    function createIframe() {
      const iframe = document.createElement("iframe");
      iframe.allow = "fullscreen;microphone";
      iframe.title = "sentio bubble window";
      iframe.id = iframeId;
      iframe.src = iframeUrl;
      iframe.style.cssText = `
        position: fixed;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        left: unset;
        right: 0;
        bottom: 0;
        width: 24rem;
        max-width: calc(100vw - 1rem);
        height: 43.75rem;
        max-height: calc(100vh - 1rem);
        border: none;
        outline: none;
        box-shadow: none;
        background: transparent;
        z-index: 2147483640;
        overflow: hidden;
        user-select: none;
      `;

      return iframe;
    }

    // Function to reset the iframe position
    function resetIframePosition() {
      if (window.innerWidth <= 640)
        return

      const targetIframe = document.getElementById(iframeId);
      const targetButton = document.getElementById(buttonId);
      if (targetIframe && targetButton) {
        const buttonRect = targetButton.getBoundingClientRect();

        const buttonInBottom = buttonRect.top - 5 > targetIframe.clientHeight

        if (buttonInBottom) {
          targetIframe.style.bottom = '0px';
          targetIframe.style.top = 'unset';
        }
        else {
          targetIframe.style.bottom = 'unset';
          targetIframe.style.top = '0px';
        }

        const buttonInRight = buttonRect.right > targetIframe.clientWidth;

        if (buttonInRight) {
          targetIframe.style.right = '0';
          targetIframe.style.left = 'unset';
        }
        else {
          targetIframe.style.right = 'unset';
          targetIframe.style.left = 0;
        }
      }
    }

    // Function to create the chat button
    function createButton() {
      const containerDiv = document.createElement("div");
      // Apply custom properties from config
      Object.entries(config.containerProps || {}).forEach(([key, value]) => {
        if (key === "className") {
          containerDiv.classList.add(...value.split(" "));
        } else if (key === "style") {
          if (typeof value === "object") {
            Object.assign(containerDiv.style, value);
          } else {
            containerDiv.style.cssText = value;
          }
        } else if (typeof value === "function") {
          containerDiv.addEventListener(
            key.replace(/^on/, "").toLowerCase(),
            value
          );
        } else {
          containerDiv[key] = value;
        }
      });

      containerDiv.id = buttonId;

      // Add styles for the button
      const styleSheet = document.createElement("style");
      document.head.appendChild(styleSheet);
      styleSheet.sheet.insertRule(`
        #${containerDiv.id} {
          position: fixed;
          bottom: var(--${containerDiv.id}-bottom, 1rem);
          right: var(--${containerDiv.id}-right, 1rem);
          left: var(--${containerDiv.id}-left, unset);
          top: var(--${containerDiv.id}-top, unset);
          width: var(--${containerDiv.id}-width, 48px);
          height: var(--${containerDiv.id}-height, 48px);
          border-radius: var(--${containerDiv.id}-border-radius, 25px);
          background-color: var(--${containerDiv.id}-bg-color, #155EEF);
          box-shadow: var(--${containerDiv.id}-box-shadow, rgba(0, 0, 0, 0.2) 0px 4px 8px 0px);
          cursor: pointer;
          z-index: 2147483647;
        }
      `);

      // Create display div for the button icon
      const displayDiv = document.createElement("div");
      displayDiv.style.cssText =
        "position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; z-index: 2147483647;";
      displayDiv.innerHTML = svgIcons.open;
      containerDiv.appendChild(displayDiv);
      document.body.appendChild(containerDiv);

      // Add click event listener to toggle chatbot
      containerDiv.addEventListener("click", function () {
        const targetIframe = document.getElementById(iframeId);
        if (!targetIframe) {
          containerDiv.prepend(createIframe());
          resetIframePosition();
          this.title = "Exit (ESC)";
          displayDiv.innerHTML = svgIcons.close;
          document.addEventListener('keydown', handleEscKey);
          return;
        }
        targetIframe.style.display = targetIframe.style.display === "none" ? "block" : "none";
        displayDiv.innerHTML = targetIframe.style.display === "none" ? svgIcons.open : svgIcons.close;

        if (targetIframe.style.display === "none") {
          document.removeEventListener('keydown', handleEscKey);
        } else {
          document.addEventListener('keydown', handleEscKey);
        }


        resetIframePosition();
      });

      // Enable dragging if specified in config
      if (config.draggable) {
        enableDragging(containerDiv, config.dragAxis || "both");
      }
    }

    // Function to enable dragging of the chat button
    function enableDragging(element, axis) {
      let isDragging = false;
      let startX, startY;

      element.addEventListener("mousedown", startDragging);
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", stopDragging);

      function startDragging(e) {
        isDragging = true;
        startX = e.clientX - element.offsetLeft;
        startY = e.clientY - element.offsetTop;
      }

      function drag(e) {
        if (!isDragging) return;

        element.style.transition = "none";
        element.style.cursor = "grabbing";

        // Hide iframe while dragging
        const targetIframe = document.getElementById(iframeId);
        if (targetIframe) {
          targetIframe.style.display = "none";
          element.querySelector("div").innerHTML = svgIcons.open;
        }

        const newLeft = e.clientX - startX;
        const newBottom = window.innerHeight - e.clientY - startY;

        const elementRect = element.getBoundingClientRect();
        const maxX = window.innerWidth - elementRect.width;
        const maxY = window.innerHeight - elementRect.height;

        // Update position based on drag axis
        if (axis === "x" || axis === "both") {
          element.style.setProperty(
            `--${buttonId}-left`,
            `${Math.max(0, Math.min(newLeft, maxX))}px`
          );
        }

        if (axis === "y" || axis === "both") {
          element.style.setProperty(
            `--${buttonId}-bottom`,
            `${Math.max(0, Math.min(newBottom, maxY))}px`
          );
        }
      }

      function stopDragging() {
        isDragging = false;
        element.style.transition = "";
        element.style.cursor = "pointer";
      }
    }

    // Create the chat button if it doesn't exist
    if (!document.getElementById(buttonId)) {
      createButton();
    }
  }

  // Add esc Exit keyboard event triggered
  function handleEscKey(event) {
    if (event.key === 'Escape') {
      const targetIframe = document.getElementById(iframeId);
      const button = document.getElementById(buttonId);
      if (targetIframe && targetIframe.style.display !== 'none') {
        targetIframe.style.display = 'none';
        button.querySelector('div').innerHTML = svgIcons.open;
      }
    }
  }
  document.addEventListener('keydown', handleEscKey);

  // Set the embedChatbot function to run when the body is loaded,Avoid infinite nesting
  if (config?.dynamicScript) {
    embedChatbot();
  } else {
    document.body.onload = embedChatbot;
  }
})();