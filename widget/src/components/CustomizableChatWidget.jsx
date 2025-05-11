import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ChatWidgetCustom.css'; // Assume you have a CSS file for styles
import CryptoJS from "crypto-js";
import { db, auth, doc, setDoc, getDoc } from "../firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
// import "../App.css";
// import './ChatWidget.css'; // Optional: Add CSS for styling
import { initONNX, detectIntent } from '../onnx_intent';
import { useNavigate } from "react-router-dom";

const ChatWidget = ({ clientId = "client_123", successRedirectUrl = "/order-confirmation" }) => {
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
    const [error, setError] = useState(null);
    const [intent, setIntent] = useState(null);
    const [readyQuestions] = useState([
        { label: "Cheapest Sony headphones", query: "cheapest Sony headphones" },
        { label: "Check order status", query: "order status" },
        { label: "Place an order", query: "place order" },
        { label: "Recommend a product", query: "recommend product" },
    ]);
    const [sessionId, setSessionId] = useState(null);
    const [ws, setWs] = useState(null);
    const [isLiveChat, setIsLiveChat] = useState(false);
    // State for customization settings
    const [settings, setSettings] = useState({
        primaryColor: '#3b82f6',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        logoUrl: '/img/logo/logo.jpg',
        font: 'Arial',
        fontSize: '16px',
        position: 'bottom-right',
        isCollapsed: true,
        welcomeMessage: 'Welcome to our support chat!',
        readyQuestions: [
            { label: 'Cheapest headphones', query: 'cheapest headphones' },
            { label: 'Order status', query: 'order status' },
        ],
        showClearChat: true,
        showAddToCart: true,
        defaultWidth: 400,
        defaultHeight: 500,
        title: 'Zipper Bot',
        enableLiveChat: true,
        liveChatHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
    });
    // Initialize ONNX model and tokenizer
    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            try {
                await initONNX();
                console.log('ONNX and tokenizer initialized successfully');
            } catch (err) {
                console.error('Initialization error:', err);
                setError(`Failed to initialize ONNX: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        initialize();
    }, []);


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
    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(`http://localhost:8000/widget/${clientId}`);
                setSettings(response.data.widgetSettings);
                setIsCollapsed(response.data.isCollapsed);
                setSize({
                    width: response.data.defaultWidth,
                    height: response.data.defaultHeight,
                });
                console.log("Fetched settings:", response.data.widgetSettings); // 👈 log it
                console.log("new settings", settings)
                // Add welcome message if messages are empty
                if (messages.length === 0 && response.data.welcomeMessage) {
                    setMessages([{ sender: 'bot', text: response.data.welcomeMessage }]);
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            }
        };
        const createSession = async () => {
            if (!userId) return;
            try {
                const response = await axios.post('http://localhost:8000/chat/session', {
                    sessionId: `session_${userId}_${Date.now()}`,
                    clientId,
                    userId,
                    status: 'pending',
                    messages: [],
                });
                setSessionId(response.data.sessionId);
            } catch (error) {
                console.error('Error creating session:', error);
            }
        };

        fetchSettings();
        if (userId) createSession();
    }, [clientId, userId]);

    // Initialize WebSocket
    useEffect(() => {
        if (!sessionId || !userId) return;

        const websocket = new WebSocket(`ws://localhost:8000/ws/chat/${clientId}/${userId}`);
        setWs(websocket);

        websocket.onopen = () => {
            console.log('WebSocket connected');
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data); // Debug log
            if (data.message) {
                setMessages((prev) => [...prev, data.message]);
                if (data.message.text === 'Live chat ended.') {
                    setIsLiveChat(false);
                    setSessionId(null);
                }
            } else if (data.error) {
                setMessages((prev) => [...prev, { sender: 'bot', text: data.error }]);
            } else if (data.agentAssigned) {
                setIsLiveChat(true);
                setMessages((prev) => {
                    const hasConnectedMessage = prev.some((msg) => msg.text === 'You are now connected to a specialist.');
                    if (!hasConnectedMessage) {
                        return [...prev, { sender: 'bot', text: 'You are now connected to a specialist.' }];
                    }
                    return prev;
                });
            }
        };

        websocket.onclose = () => {
            console.log('WebSocket disconnected');
        };

        return () => {
            websocket.close();
        };
    }, [sessionId, userId]);

    // Request specialist
    const requestSpecialist = async () => {
        if (!ws || !sessionId || isLiveChat) return;
        setLoading(true);
        try {
            ws.send(JSON.stringify({ sessionId, message: { sender: 'user', text: 'human_assistance', timestamp: new Date().toISOString() } }));
            setMessages((prev) => [...prev, { sender: 'bot', text: 'Connecting you to a specialist...' }]);
        } catch (error) {
            console.error('Error requesting specialist:', error);
            setMessages((prev) => [...prev, { sender: 'bot', text: 'Error connecting to specialist.' }]);
        }
        setLoading(false);
    };

    // Check if live chat is available based on hours
    const isLiveChatAvailable = () => {
        if (!settings.enableLiveChat) return false;
        const { start, end, timezone } = settings.liveChatHours;
        const now = new Date();
        const tzNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        const startTime = new Date(tzNow).setHours(startHour, startMinute, 0, 0);
        const endTime = new Date(tzNow).setHours(endHour, endMinute, 0, 0);
        console.log("live chat checking ", tzNow.getTime() >= startTime && tzNow.getTime() <= endTime)
        return true
        // return tzNow.getTime() >= startTime && tzNow.getTime() <= endTime;
    };
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
        console.log("Loading agents and chains")
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
        if (loading) {
            setError('Model is still initializing, please wait.');
            return null;
        }
        setLoading(true);
        setError(null);
        setIntent('');

        try {
            const result = await detectIntent(userQuery);
            console.log('Intent:', result);
            setIntent(result.intent);
            return result;
        } catch (err) {
            console.error('Inference error:', err);
            setError(`Inference error: ${err.message}`);
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
            console.log("feature.route",feature.route, requestConfig)
            const response = await axios[httpMethod](`${marketplaceApiUrl}${feature.route}`, requestConfig);
            console.log("API response:", response.data);
            if (response.data.message) {
                return { result: response.data.message, params: response.data };
            } else if (response.data.products?.length) {
                // Return all products instead of just the first one
                const productCount = response.data.products.length;
                const result = `${productCount} product${productCount > 1 ? 's' : ''} found`;
                return { result, params: { products: response.data.products } }; // Return all products
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

        const newMessage = { sender: 'user', text: input, timestamp: new Date().toISOString() };
        let newMessages = [newMessage];
        if (isLiveChat) {
            // Send message directly to WebSocket for live chat
            if (!ws || !sessionId) {
                newMessages.push({ sender: 'bot', text: 'Not connected to a specialist.' });
                setMessages((prev) => [...prev, ...newMessages]);
                setInput('');
                return;
            }
            try {
                ws.send(JSON.stringify({ sessionId, message: newMessage }));
                setMessages((prev) => [...prev, newMessage]);
            } catch (error) {
                console.error('Error sending live chat message:', error);
                newMessages.push({ sender: 'bot', text: 'Error sending message to specialist.' });
                setMessages((prev) => [...prev, ...newMessages]);
            }
            setInput('');
            return;
        }
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
            const result = await processQuery(input);
            if (!result) return; // guard for errors

            const { intent, params } = result;
            console.log("intent", intent);
            const chain = chains.find((c) => c.agentSequence[0] === intent);
            console.log("chain", chain)
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
                    console.log("pushing message", result)
                    newMessages.push({ sender: "bot", text: result });
                    currentParams = newParams;
                }
            } else {
                const agent = agents.find((a) => a.intent === intent);
                if (!agent) {
                    newMessages.push({ sender: "bot", text: "No agent found for this query." });
                } else {
                    const { result, error, params: responseParams } = await executeAgent(agent, params, intent);
                    console.log("execute agent", result, responseParams)
                    // Handle response
                    if (error) {
                        newMessages.push({ sender: 'bot', text: error });
                    } else if (responseParams?.products?.length) {
                        console.log("responseParams.products", responseParams.products)
                        // Push message with result and products for product cards
                        newMessages.push({ sender: 'bot', result, products: responseParams.products });
                        console.log("newMessages", newMessages)

                    } else if (responseParams?.order_id) {
                        // Order details
                        newMessages.push({ sender: 'bot', order_details: responseParams });
                    } else if (responseParams?.estimated_delivery) {
                        // Order confirmation
                        newMessages.push({ sender: 'bot', order_confirmation: responseParams });
                    } else {
                        // Fallback to text message
                        newMessages.push({ sender: 'bot', text: result });
                    }

                }
            }

            setMessages((prev) => [...prev, ...newMessages]);
            console.log("newmsg", messages)
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

    const handleAddToCart = async (productId, productName) => {
        const newMessages = [];
        setLoading(true);

        try {
            // Find the add_to_cart agent
            const intent = 'add_to_cart';
            const agent = agents.find((a) => a.intent === intent);
            if (!agent) {
                newMessages.push({ sender: 'bot', text: 'No agent found for adding to cart.' });
            } else {
                // Prepare params for adding to cart
                const params = {
                    product_id: productId,
                    quantity: 1, // Default quantity; adjust as needed
                };

                // Call executeAgent
                const { result, error, params: responseParams } = await executeAgent(agent, params, intent);
                console.log('execute agent (add_to_cart)', result, responseParams);

                // Handle response
                if (error) {
                    newMessages.push({ sender: 'bot', text: error });
                } else {
                    newMessages.push({
                        sender: 'bot',
                        text: `Added ${productName} to cart.`,
                    });
                }
            }
        } catch (error) {
            newMessages.push({ sender: 'bot', text: 'Error adding product to cart. Please try again.' });
        }

        // Append new messages to existing messages
        setMessages((prev) => [...prev, ...newMessages]);
        setLoading(false);
    };
    return (
        <div
            className="chat-widget-container"
            style={{
                position: 'fixed',
                [settings.position.includes('right') ? 'right' : 'left']: '20px',
                bottom: '20px',
                fontFamily: settings.font,
                fontSize: settings.fontSize,
                color: settings.textColor,
            }}
        >
            {isCollapsed ? (
                <button
                    className="chat-toggle-button"
                    onClick={toggleCollapse}
                    style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                >
                    {settings.title}
                </button>
            ) : (
                <div
                    className="chat-widget"
                    ref={widgetRef}
                    style={{
                        width: `${size.width}px`,
                        height: `${size.height}px`,
                        backgroundColor: settings.backgroundColor,
                    }}
                >
                    <div
                        className="chat-header"
                        style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                    >
                        <img src={settings.logoUrl} alt={`${settings.title} Logo`} className="chat-logo" />
                        <span>{settings.title}</span>
                        {settings.showClearChat && (
                            <button className="clear-button" onClick={clearChat}>
                                Clear Chat
                            </button>
                        )}
                        {settings.enableLiveChat && isLiveChatAvailable() && (
                            <button
                                className="specialist-button"
                                onClick={requestSpecialist}
                                disabled={isLiveChat || loading}
                            >
                                Chat with Specialist
                            </button>
                        )}
                        <button className="collapse-button" onClick={toggleCollapse}>
                            ✕
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.sender}`}>
                                {msg.sender === 'bot' || msg.sender === 'agent' ? (
                                    <div className="flex items-center gap-2">
                                        <img
                                            src={settings.logoUrl}
                                            alt="Bot Logo"
                                            className="bot-message-logo w-8 h-8 rounded-full"
                                        />
                                        <span className="text-sm font-medium" style={{ color: settings.textColor }}>
                                            {msg.sender === 'agent' ? 'Specialist' : settings.title}
                                        </span>
                                    </div>
                                ) : null}
                                {msg.products ? (
                                    <div className="product-message">
                                        {msg.result && <div className="message-text">{msg.result}</div>}
                                        <table className="product-table" aria-label="Product list">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Image</th>
                                                    <th scope="col">Name</th>
                                                    <th scope="col">Brand</th>
                                                    <th scope="col">Price</th>
                                                    <th scope="col">Category</th>
                                                    {settings.showAddToCart && <th scope="col">Action</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {msg.products.map((product) => (
                                                    <tr key={product.id}>
                                                        <td>
                                                            <img
                                                                src={product.image_url}
                                                                alt={product.name}
                                                                className="product-image"
                                                                onError={(e) => {
                                                                    e.target.src = 'https://via.placeholder.com/150';
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="product-name">{product.name}</td>
                                                        <td className="product-brand">{product.brand}</td>
                                                        <td className="product-price">${product.price}</td>
                                                        <td className="product-category">{product.category}</td>
                                                        {settings.showAddToCart && (
                                                            <td>
                                                                <button
                                                                    className="add-to-cart-button"
                                                                    onClick={() => handleAddToCart(product.id, product.name)}
                                                                    aria-label={`Add ${product.name} to cart`}
                                                                    style={{ backgroundColor: settings.primaryColor }}
                                                                >
                                                                    Add to Cart
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : msg.order_details ? (
                                    <div className="order-details">
                                        <h3>Order #{msg.order_details.order_id}</h3>
                                        <p>
                                            <strong>Status:</strong> {msg.order_details.status}
                                        </p>
                                        <p>
                                            <strong>Total:</strong> ${msg.order_details.total}
                                        </p>
                                        <div className="order-items">
                                            <h4>Items:</h4>
                                            <ul>
                                                {msg.order_details.items.map((item, i) => (
                                                    <li key={i}>
                                                        {item.name} - ${item.price} (Qty: {item.quantity})
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ) : msg.order_confirmation ? (
                                    <div className="order-confirmation">
                                        <h3>Order Placed Successfully!</h3>
                                        <p>
                                            <strong>Order ID:</strong> {msg.order_confirmation.order_id}
                                        </p>
                                        <p>
                                            <strong>Estimated Delivery:</strong> {msg.order_confirmation.estimated_delivery}
                                        </p>
                                        <p>Thank you for your order!</p>
                                    </div>
                                ) : (
                                    <div className="message-text">{msg.text}</div>
                                )}
                            </div>
                        ))}
                        {loading && (
                            <div className="message bot loading">
                                <img src={settings.logoUrl} alt="Bot Logo" className="bot-message-logo" />
                                <span className="loading-spinner"></span> Loading...
                            </div>
                        )}
                    </div>
                    <div className="chat-input">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your query (e.g., cheapest Sony headphones, order status, place order)"
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            disabled={loading}
                            style={{ color: settings.textColor }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading}
                            style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                    <div className="ready-questions">
                        <p>Try these questions:</p>
                        {settings.readyQuestions.map((question, index) => (
                            <button
                                key={index}
                                className="ready-question-button"
                                onClick={() => {
                                    setInput(question.query);
                                    sendMessage();
                                }}
                                disabled={loading}
                                style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                            >
                                {question.label}
                            </button>
                        ))}
                    </div>
                    <div className="resize-handle" ref={resizeRef}></div>
                </div>
            )}
        </div>
    );
};

export default ChatWidget;