import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatWidget from "./components/ChatwidgetNLP_old.jsx";
import ChatWidgetML from "./components/ChatWidgetNLPML.jsx";
import ChatWidgetTransformer from "./components/ChatWidgetTransformer.jsx";
import ChatWidgetLLMBackend from "./components/ChatWidgetLLMBackend.jsx";
import CustomizableChatWidget from "./components/CustomizableChatWidget.jsx";
import CustomizableChatWidgetNLP from "./components/CustomizableChatWidgetNLP.jsx";

// import OrderConfirmation from "./components/OrderConfirmation";
// import Home from "./components/Home";

const App = () => {
  return (
    <Router>
      <Routes>
        {/* <Route path="/" element={<Home />} />*/}
        {/* <Route path="/llm-selector" element={<ChatWidgetLLMSelector />} />  */}
      </Routes>
      <CustomizableChatWidgetNLP />
      {/* <ChatWidgetLLMBackend successRedirectUrl="/order-confirmation" /> */}
      {/* <ChatWidgetML successRedirectUrl="/order-confirmation" /> */}
      {/* <CustomizableChatWidget successRedirectUrl="/order-confirmation" /> */}
    </Router>
  );
};

export default App;