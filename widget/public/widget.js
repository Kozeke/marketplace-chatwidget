(function () {
    function loadWidget() {
      // Create container
      let container = document.getElementById("chat-widget-root");
      if (!container) {
        container = document.createElement("div");
        container.id = "chat-widget-root";
        document.body.appendChild(container);
      }
  
      // Load CSS (if separate CSS file exists)
      const cssLink = document.createElement("link");
      cssLink.href = "http://localhost:5000/static/css/main.f53e415f.css"; // Replace <css-hash> with actual hash
      cssLink.rel = "stylesheet";
      cssLink.onerror = () => console.error("Failed to load widget CSS");
      cssLink.onload = () => console.log("Widget CSS loaded");
      document.head.appendChild(cssLink);
  
      // Load React bundle
      const script = document.createElement("script");
      script.src = "http://localhost:5000/static/js/main.4dca37fe.js"; // Replace <js-hash> with actual hash
      script.async = false;
      script.onerror = () => console.error("Failed to load widget bundle");
      script.onload = () => console.log("Widget bundle loaded");
      document.body.appendChild(script);
    }
  
    // Wait for DOM
    if (document.readyState === "complete" || document.readyState === "interactive") {
      loadWidget();
    } else {
      document.addEventListener("DOMContentLoaded", loadWidget);
    }
  })();