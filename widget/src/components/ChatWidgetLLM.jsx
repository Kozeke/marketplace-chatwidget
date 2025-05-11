import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import nlp from "compromise";
import CryptoJS from "crypto-js";
import { db, auth, doc, setDoc, getDoc } from "../firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import "../App.css";
import * as webllm from '@mlc-ai/web-llm';
import './ChatWidget.css'; // Optional: Add CSS for styling

const ChatWidget = ({ successRedirectUrl = "/order-confirmation" }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [agents, setAgents] = useState([]);
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [userDetails, setUserDetails] = useState({ customer_name: "", address: "" });
  const [userId, setUserId] = useState(null);
  const websiteId = "site123";
  const marketplaceApiUrl = "http://localhost:8082";
  const widgetRef = useRef(null);
  const resizeRef = useRef(null);
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(true); // New state for auth loading
  const [ready, setReady] = useState(false);
  const [engine, setEngine] = useState(null);
  const [error, setError] = useState(null);
  const [selectedModel, setSelectedModel] = useState('Llama-2-7b-chat-hf-q4f32_1-MLC');
  const [downloadStatus, setDownloadStatus] = useState('');
  const [intent, setIntent] = useState(null);

  const messagesRef = useRef([
    {
      content: `
      You are an intent detection system for a chat widget. Classify the user's query into one of the following intents. Return only the intent name.
      - Order Status: Questions about order tracking, delivery, or status.
      - Product Inquiry: Questions about product details, specifications, or availability.
      - Payments: Questions about payment methods, billing, or transactions.
      - Unknown: Queries that don’t match any defined intent.

      Examples:
      - "Where is my order?" -> Order Status
      - "Tell me about your laptops" -> Product Inquiry
      - "Can I pay with PayPal?" -> Payments
            `,
            role: 'system'
          }
  ]);

  // Encryption key (store securely in production)
  const secretKey = "your-secret-key";

  const encryptMessages = (messages) => {
    return CryptoJS.AES.encrypt(JSON.stringify(messages), secretKey).toString();
  };

  const decryptMessages = (data) => {
    try {
      const bytes = CryptoJS.AES.decrypt(data, secretKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch {
      return [];
    }
  };

  // Initialize WebLLM engine
  useEffect(() => {
    const initializeEngine = async () => {
      if (!navigator.gpu) {
        console.log("WebGPU is not supported. Please use Chrome 113+ or Edge.")
        setError('WebGPU is not supported. Please use Chrome 113+ or Edge.');
        return;
      }
      setLoading(true);
      setDownloadStatus('Initializing engine...');
      try {
        const engineInstance = new webllm.MLCEngine();
        engineInstance.setInitProgressCallback((report) => {
          setDownloadStatus(report.text);
        });
        const config = {
          temperature: 0.3, // Low for consistent intent detection
          top_p: 1
        };
        await engineInstance.reload(selectedModel, config);
        setEngine(engineInstance);
        setDownloadStatus('Model loaded successfully');
        console.log("Model loaded successfully")
      } catch (err) {
        console.error('Failed to initialize WebLLM:', err);
        setError(`Failed to load model: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    initializeEngine();
  }, [selectedModel]);

  // Sign in anonymously
  useEffect(() => {
    setAuthLoading(true);
    // Check for existing user or stored userId
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Existing user found (session persists)
        setUserId(user.uid);
        console.log("Reusing existing userId:", user.uid);
        setAuthLoading(false);
      } else {
        // Check localStorage for a stored userId
        const storedUserId = localStorage.getItem("anonymousUserId");
        if (storedUserId) {
          setUserId(storedUserId);
          console.log("Using stored userId:", storedUserId);
          setAuthLoading(false);
        } else {
          // No existing user or stored userId; create new anonymous user
          signInAnonymously(auth)
            .then((userCredential) => {
              const newUserId = userCredential.user.uid;
              setUserId(newUserId);
              localStorage.setItem("anonymousUserId", newUserId); // Store userId
              console.log("Signed in anonymously with new userId:", newUserId);
            })
            .catch((error) => {
              console.error("Anonymous auth error:", {
                code: error.code,
                message: error.message,
                details: error,
              });
              let errorMessage = "Failed to authenticate. Please try again later.";
              if (error.code === "auth/configuration-not-found") {
                errorMessage =
                  "Anonymous authentication is not enabled in the Firebase project. Please contact the administrator.";
              }
              setMessages((prev) => [
                ...prev,
                { sender: "bot", text: errorMessage },
              ]);
            })
            .finally(() => {
              setAuthLoading(false);
            });
        }
      }
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // Load messages and user details from Firestore
  useEffect(() => {
    if (!userId) return;
    const loadData = async () => {
      try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("Loaded Firestore data:", data);
          setMessages(data.messages ? decryptMessages(data.messages) : []);
          setUserDetails({
            customer_name: data.customer_name || "",
            address: data.address || "",
          });
        } else {
          console.log("No Firestore document found for userId:", userId);
        }
      } catch (error) {
        console.error("Error loading Firestore data:", error.code, error.message);
      }
    };
    loadData();
  }, [userId]);

  // Save messages and user details to Firestore
  useEffect(() => {
    if (!userId || (!messages.length && !userDetails.customer_name && !userDetails.address)) return;
    const saveData = async () => {
      try {
        const docRef = doc(db, "users", userId);
        const data = {
          userId,
          messages: encryptMessages(messages),
          customer_name: userDetails.customer_name,
          address: userDetails.address,
        };
        console.log("Saving to Firestore:", data);
        await setDoc(docRef, data, { merge: true });
      } catch (error) {
        console.error("Error saving Firestore data:", error.code, error.message);
      }
    };
    saveData();
  }, [messages, userDetails, userId]);

  // Fetch agents and chains
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResponse, chainsResponse] = await Promise.all([
          axios.get("http://localhost:8000/agents", { params: { websiteId } }),
          axios.get("http://localhost:8000/chains", { params: { websiteId } }),
        ]);
        setAgents(Array.isArray(agentsResponse.data.agents) ? agentsResponse.data.agents : []);
        setChains(Array.isArray(chainsResponse.data.chains) ? chainsResponse.data.chains : []);
      } catch (error) {
        console.error("Error fetching data:", error);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", text: "Error loading agents or chains. Please try again later." },
        ]);
      }
    };
    fetchData();
  }, []);

  // Handle resizing
  useEffect(() => {
    const handleMouseDown = (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = size.width;
      const startHeight = size.height;

      const handleMouseMove = (moveEvent) => {
        const newWidth = startWidth - (moveEvent.clientX - startX);
        const newHeight = startHeight - (moveEvent.clientY - startY);
        setSize({
          width: Math.max(300, Math.min(800, newWidth)),
          height: Math.max(400, Math.min(1000, newHeight)),
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    };

    const resizeHandle = resizeRef.current;
    if (resizeHandle) {
      resizeHandle.addEventListener("mousedown", handleMouseDown);
    }

    return () => {
      if (resizeHandle) {
        resizeHandle.removeEventListener("mousedown", handleMouseDown);
      }
    };
  }, [size]);

  // Async version of processQuery using WebLLM
  const processQuery = async (userQuery) => {
    if (!engine) {
      setError('Model not loaded');
      return;
  }
  setLoading(true);
  setError(null);
  try {
      const userMessage = { content: userQuery, role: 'user' };
      messagesRef.current.push(userMessage);
      setIntent('Detecting...');

      let curMessage = '';
      const completion = await engine.chat.completions.create({
          stream: true,
          messages: messagesRef.current,
          max_tokens: 10
      });
      for await (const chunk of completion) {
          const curDelta = chunk.choices[0].delta.content;
          if (curDelta) {
              curMessage += curDelta;
              setIntent(curMessage);
          }
      }
      const finalMessage = await engine.getMessage();
      console.log("final message",finalMessage)
      // Map human-readable intent to snake_case
      // const snakeCaseIntent = toSnakeCase(finalMessage);
      // setIntent(snakeCaseIntent);
      // messagesRef.current.push({ content: snakeCaseIntent, role: 'assistant' });
  } catch (err) {
      console.error('Intent detection error:', err);
      setError(err.message);
      setIntent(null);
  } finally {
      setLoading(false);
  }
};

  // Execute a single agent
  const executeAgent = async (agent, params, intent) => {
    const normalizedIntent = intent.replace(/^[a-z]+_/, '');
    let feature = agent.features.find((f) => f.route.toLowerCase().includes(normalizedIntent.toLowerCase()));
    feature = feature || agent.features[0];
    if (!feature) {
      console.error("No feature found for agent:", agent, "intent:", intent);
      return { error: "No route found for this agent." };
    }
    console.log("Executing agent:", agent.intent, "with params:", params, "route:", feature.route);
    try {
      const httpMethod = (feature.method || 'GET').toLowerCase();
      const requestConfig = httpMethod === 'get' ? { params } : params;
      const response = await axios[httpMethod](`${marketplaceApiUrl}${feature.route}`, requestConfig);
      console.log("API response:", response.data);
      if (response.data.message) {
        return { result: response.data.message, params: response.data };
      } else if (response.data.products?.length) {
        const product = response.data.products[0].name || "No products found";
        return { result: product, params: response.data.products[0] };
      } else {
        return { result: "Action completed successfully", params: response.data };
      }
    } catch (error) {
      console.error("Error calling API:", error);
      return { error: error.response?.data?.detail?.[0]?.msg || "Sorry, something went wrong." };
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim()) {
      setMessages((prev) => [...prev, { sender: "bot", text: "Please enter a query." }]);
      return;
    }

    let newMessages = [{ sender: "user", text: input }];

    if (pendingOrder) {
      if (!pendingOrder.customer_name && !userDetails.customer_name) {
        if (input.toLowerCase() === "cancel") {
          setPendingOrder(null);
          newMessages.push({ sender: "bot", text: "Order cancelled." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        if (input.trim() === "") {
          newMessages.push({ sender: "bot", text: "Please enter a valid name." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        setUserDetails((prev) => ({ ...prev, customer_name: input }));
        setPendingOrder({ ...pendingOrder, customer_name: input });
        if (userDetails.address) {
          setPendingOrder((prev) => ({ ...prev, address: userDetails.address }));
          newMessages.push({ sender: "bot", text: "Please enter the quantity." });
        } else {
          newMessages.push({ sender: "bot", text: "Please enter your address." });
        }
        setMessages((prev) => [...prev, ...newMessages]);
        setInput("");
        return;
      } else if (!pendingOrder.address && !userDetails.address) {
        if (input.toLowerCase() === "cancel") {
          setPendingOrder(null);
          newMessages.push({ sender: "bot", text: "Order cancelled." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        if (input.trim() === "") {
          newMessages.push({ sender: "bot", text: "Please enter a valid address." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        setUserDetails((prev) => ({ ...prev, address: input }));
        setPendingOrder({ ...pendingOrder, address: input });
        newMessages.push({ sender: "bot", text: "Please enter the quantity." });
        setMessages((prev) => [...prev, ...newMessages]);
        setInput("");
        return;
      } else if (!pendingOrder.quantity) {
        if (input.toLowerCase() === "cancel") {
          setPendingOrder(null);
          newMessages.push({ sender: "bot", text: "Order cancelled." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        const quantity = parseInt(input);
        if (isNaN(quantity) || quantity <= 0) {
          newMessages.push({ sender: "bot", text: "Please enter a valid quantity." });
          setMessages((prev) => [...prev, ...newMessages]);
          setInput("");
          return;
        }
        const updatedOrder = {
          ...pendingOrder,
          quantity,
          customer_name: pendingOrder.customer_name || userDetails.customer_name,
          address: pendingOrder.address || userDetails.address,
        };
        setPendingOrder(updatedOrder);
        const agent = agents.find((a) => a.intent === "place_order");
        if (!agent) {
          newMessages.push({ sender: "bot", text: "No agent found for placing order." });
        } else {
          setLoading(true);
          try {
            console.log("Sending order payload:", updatedOrder);
            const { result, error, params } = await executeAgent(agent, updatedOrder, "place_order");
            if (error) {
              newMessages.push({ sender: "bot", text: error });
            } else {
              newMessages.push({ sender: "bot", text: result });
              // Redirect on success
              window.location.href = successRedirectUrl;

              if (successRedirectUrl) {
                if (successRedirectUrl.startsWith("http")) {
                  window.location.href = successRedirectUrl;
                } else {
                  navigate(successRedirectUrl, { state: { order: params?.order } });
                }
              }
            }
            setPendingOrder(null);
          } catch (error) {
            console.error("Error executing place_order:", error.response?.data || error);
            const errorMsg = error.response?.data?.detail?.[0]?.msg || "Sorry, something went wrong.";
            newMessages.push({ sender: "bot", text: errorMsg });
          } finally {
            setLoading(false);
          }
        }
        setMessages((prev) => [...prev, ...newMessages]);
        setInput("");
        return;
      }
    }

    setLoading(true);
    try {
      const { intent, params } = processQuery(input);
      const chain = chains.find((c) => c.agentSequence[0] === intent);

      if (chain) {
        console.log("running chain")
        let currentParams = { ...params };
        for (const agentIntent of chain.agentSequence) {
          const agent = agents.find((a) => a.intent === agentIntent);
          if (!agent) {
            newMessages.push({ sender: "bot", text: `No agent found for intent: ${agentIntent}` });
            break;
          }
          let mappedParams = { ...currentParams };
          if (agentIntent === "recommend_product") {
            mappedParams = { product: currentParams.id };
          } else if (agentIntent === "place_order") {
            const newPendingOrder = { product_id: currentParams.id };
            if (userDetails.customer_name) {
              newPendingOrder.customer_name = userDetails.customer_name;
            }
            if (userDetails.address) {
              newPendingOrder.address = userDetails.address;
            }
            setPendingOrder(newPendingOrder);
            if (!userDetails.customer_name) {
              newMessages.push({ sender: "bot", text: "Please enter your name." });
            } else if (!userDetails.address) {
              newMessages.push({ sender: "bot", text: "Please enter your address." });
            } else {
              newMessages.push({ sender: "bot", text: "Please enter the quantity." });
            }
            setMessages((prev) => [...prev, ...newMessages]);
            setInput("");
            setLoading(false);
            return;
          }
          const { result, error, params: newParams } = await executeAgent(agent, mappedParams, agentIntent);
          if (error) {
            newMessages.push({ sender: "bot", text: error });
            break;
          }
          newMessages.push({ sender: "bot", text: result });
          currentParams = newParams;
        }
      } else {
        const agent = agents.find((a) => a.intent === intent);
        if (!agent) {
          newMessages.push({ sender: "bot", text: "No agent found for this query." });
        } else {
          const { result, error } = await executeAgent(agent, params, intent);
          newMessages.push({ sender: "bot", text: error || result });
        }
      }

      setMessages((prev) => [...prev, ...newMessages]);
    } catch (error) {
      console.error("Error processing query:", error);
      setMessages((prev) => [
        ...prev,
        ...newMessages,
        { sender: "bot", text: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  // Toggle collapse/expand
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Clear chat history
  const clearChat = () => {
    setMessages([]);
    setUserDetails({ customer_name: "", address: "" });
    setPendingOrder(null);
    if (userId) {
      const docRef = doc(db, "users", userId);
      setDoc(docRef, { messages: [], customer_name: "", address: "", userId }, { merge: true });
    }
  };

  return (
    <div className="chat-widget-container">
      {isCollapsed ? (
        <button className="chat-toggle-button" onClick={toggleCollapse}>
          Chat
        </button>
      ) : (
        <div
          className="chat-widget"
          ref={widgetRef}
          style={{ width: `${size.width}px`, height: `${size.height}px` }}
        >
          <div className="chat-header">
            <span>Chat</span>
            <button className="clear-button" onClick={clearChat}>
              Clear Chat
            </button>
            <button className="collapse-button" onClick={toggleCollapse}>
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="message bot loading">
                <span className="loading-spinner"></span> Loading...
              </div>
            )}
          </div>
          <div className="chat-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your query (e.g., cheapest Sony headphones)"
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
          <div className="resize-handle" ref={resizeRef}></div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;