import React from "react";
import { createRoot } from "react-dom/client";
import ChatWidget from "./App";

const container = document.getElementById("chat-widget-root");
if (container) {
  const root = createRoot(container);
  root.render(<ChatWidget />);
} else {
  console.error("Target container 'chat-widget-root' not found in the DOM");
}