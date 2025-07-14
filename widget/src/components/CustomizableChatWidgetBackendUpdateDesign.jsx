import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './ChatWidgetCustom.css'; // Assume you have a CSS file for styles
import CryptoJS from "crypto-js";
import { db, auth, doc, setDoc, getDoc } from "../firebase";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
// import "../App.css";
// import './ChatWidget.css'; // Optional: Add CSS for styling
import { useNavigate } from "react-router-dom";
import nlp from "compromise";
import Cookies from 'js-cookie';
import { BACKEND_HOST, WS_HOST } from '../config';
import { Box, Flex, Image, Text, Table, For, Button, Input } from '@chakra-ui/react';

const ChatWidget = ({ clientId = "client_123", successRedirectUrl = "/api/order-confirmation/1/" }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [agents, setAgents] = useState([]);
    const [chains, setChains] = useState([]);
    const [loading, setLoading] = useState(false);
    const [size, setSize] = useState({ width: 600, height: 600 });
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [userDetails, setUserDetails] = useState({ customer_name: "", address: "" });
    const [userId, setUserId] = useState(null);
    const websiteId = "site123";
    const marketplaceApiUrl = "http://localhost:8083";
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
            { label: 'Cheapest headphone', query: 'cheapest headphone' },
            { label: 'Order status', query: 'order status' },
        ],
        showClearChat: true,
        showAddToCart: true,
        defaultWidth: 700,
        defaultHeight: 600,
        title: 'Zipper Bot',
        enableLiveChat: true,
        liveChatHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
    });



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
    useEffect(() => {
        const fetchIntent = async () => {
            try {
                const response = await fetch(`${BACKEND_HOST}/classify-intent`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        text: "I want to book a flight", // Replace with any input text
                    }),
                });

                const data = await response.json();
                console.log("Intent classification result:", data);
            } catch (error) {
                console.error("Error fetching intent classification:", error);
            }
        };

        fetchIntent();
    }, []);
    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get(`${BACKEND_HOST}/widget/${clientId}`);
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
                const response = await axios.post(`${BACKEND_HOST}/chat/session`, {
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
    axios.defaults.withCredentials = true;

    // Initialize WebSocket
    useEffect(() => {
        if (!sessionId || !userId) return;

        const websocket = new WebSocket(`${WS_HOST}/ws/chat/${clientId}/${userId}`);
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
                    axios.get(`${BACKEND_HOST}/agents`, { params: { websiteId } }),
                    axios.get(`${BACKEND_HOST}/chains`, { params: { websiteId } }),
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
        const resizeHandle = resizeRef.current;
        if (!resizeHandle) return;

        const handleMouseDown = (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = size.width;
            const startHeight = size.height;

            const handleMouseMove = (moveEvent) => {
                // Calculate new dimensions based on bottom-right corner
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

        resizeHandle.addEventListener("mousedown", handleMouseDown);

        return () => {
            resizeHandle.removeEventListener("mousedown", handleMouseDown);
        };
    }, []); // Empty dependency array to ensure stable event listeners
    // Async version of processQuery using WebLLM
    const processQuery = async (query) => {
        try {
            const response = await fetch(`${BACKEND_HOST}/classify-intent`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: query,
                }),
            });

            const data = await response.json();
            console.log("Intent classification result:", data);
            return data; // Returns { intents: [{intent, confidence}], params: { brand, category, sort } }
        } catch (error) {
            console.error("Error fetching intent classification:", error);
            return {
                intents: [{ intent: "search_product", confidence: 1.0 }],
                params: {
                    brand: "Sony",
                    category: "headphone",
                    sort: "price_desc"
                }
            }; // Fallback
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

        // Construct the route and handle category parameter
        let route = feature.route;
        let queryParams = { ...params };
        if (queryParams.category) {
            route = `${route.replace(/\/$/, '')}/${queryParams.category.toLowerCase()}/`;
            delete queryParams.category;
        }

        console.log("Executing agent:", agent.intent, "with params:", queryParams, "route:", route);

        try {
            const httpMethod = (feature.method || 'GET').toLowerCase();
            const csrfToken = Cookies.get('csrftoken'); // Get CSRF token from cookie

            const requestConfig = {
                withCredentials: true,
                headers: {},
            };

            if (httpMethod !== 'get') {
                requestConfig.headers['X-CSRFToken'] = csrfToken;
            }

            let response;
            if (httpMethod === 'get') {
                requestConfig.params = queryParams;
                response = await axios.get(`${marketplaceApiUrl}${route}`, requestConfig);
            } else {
                response = await axios[httpMethod](`${marketplaceApiUrl}${route}`, queryParams, requestConfig);
            }

            console.log("API response:", response.data);

            if (response.data.message) {
                return { result: response.data.message, params: response.data };
            } else if (Array.isArray(response.data) && response.data.length) {
                const productCount = response.data.length;
                const result = `${productCount} product${productCount > 1 ? 's' : ''} found`;
                return { result, params: { products: response.data } };
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
                            // window.location.href = successRedirectUrl;
                            window.location.href = "http://localhost:8082/api/order-confirmation/1/";

                            // if (successRedirectUrl) {
                            //     if (successRedirectUrl.startsWith("http")) {
                            //         window.location.href = successRedirectUrl;
                            //     } else {
                            //         navigate(successRedirectUrl, { state: { order: 1 } });
                            //     }
                            // }
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
            if (!result || !result.intents || result.intents.length === 0) {
                console.error("No intents returned");
                return;
            }

            const { intents, params } = result;
            console.log("Detected intents:", intents);

            // Find a chain that matches the first intent (or adapt to handle multiple intents)
            const primaryIntent = intents[0].intent; // Use the highest-confidence intent
            const chain = chains.find((c) => c.agentSequence.includes(primaryIntent));
            console.log("Selected chain:", chain);

            if (chain) {
                console.log("Running chain for intents:", intents);
                let currentParams = { ...params };
                let newMessages = [];

                for (const agentIntent of chain.agentSequence) {
                    // Only process intents present in the detected intents
                    if (!intents.some(i => i.intent === agentIntent)) {
                        continue; // Skip if intent not detected
                    }

                    const agent = agents.find((a) => a.intent === agentIntent);
                    if (!agent) {
                        newMessages.push({ sender: "bot", text: `No agent found for intent: ${agentIntent}` });
                        break;
                    }

                    let mappedParams = { ...currentParams };
                    if (agentIntent === "recommend_product") {
                        mappedParams = { product: currentParams.id || currentParams.category };
                    } else if (agentIntent === "place_order") {
                        const newPendingOrder = { product_id: currentParams.id || currentParams.category };
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
                    } else if (agentIntent === "track_order") {
                        mappedParams = { order_id: currentParams.order_id || "unknown" };
                    }

                    const { result, error, params: newParams } = await executeAgent(agent, mappedParams, agentIntent);
                    if (error) {
                        newMessages.push({ sender: "bot", text: error });
                        break;
                    }
                    console.log("Pushing message:", result);
                    newMessages.push({ sender: "bot", text: result });
                    currentParams = newParams;
                }
                setMessages((prev) => [...prev, ...newMessages]);
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
            sx={{
                position: 'fixed',
                [settings.position.includes('right') ? 'right' : 'left']: '20px',
                bottom: '20px',
                fontFamily: 'body',
                fontSize: 'md',
                color: 'gray.800',
            }}
        >
            {isCollapsed ? (
                <Button
                    className="chat-toggle-button"
                    onClick={toggleCollapse}
                    bg="teal.500"
                    color="white"
                    borderRadius="md"
                    px={4}
                    py={2}
                    boxShadow="sm"
                    _hover={{ bg: 'teal.600' }}
                >
                    {settings.title}
                </Button>
            ) : (
                <Box
                    className="chat-widget"
                    ref={widgetRef}
                    w={`${size.width}px`}
                    h={`${size.height}px`}
                    bg="gray.50"
                    borderRadius="md"
                    boxShadow="lg"
                    display="flex"
                    flexDirection="column"
                >
                    <Flex
                        className="chat-header"
                        bg="teal.600"
                        color="white"
                        p={3}
                        borderTopRadius="md"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Flex alignItems="center" gap={2}>
                            <Image
                                src={settings.logoUrl}
                                alt={`${settings.title} Logo`}
                                w={6}
                                h={6}
                                borderRadius="full"
                            />
                            <Text>{settings.title}</Text>
                        </Flex>
                        <Flex gap={2}>
                            {settings.showClearChat && (
                                <Button
                                    className="clear-button"
                                    onClick={clearChat}
                                    variant="ghost"
                                    color="white"
                                    _hover={{ opacity: 0.8 }}
                                >
                                    Clear Chat
                                </Button>
                            )}
                            {settings.enableLiveChat && isLiveChatAvailable() && (
                                <Button
                                    className="specialist-button"
                                    onClick={requestSpecialist}
                                    isDisabled={isLiveChat || loading}
                                    variant="outline"
                                    borderColor="white"
                                    color="white"
                                    borderRadius="sm"
                                    px={2}
                                    py={1}
                                >
                                    Chat with Specialist
                                </Button>
                            )}
                            <Button
                                className="collapse-button"
                                onClick={toggleCollapse}
                                variant="ghost"
                                color="white"
                            >
                                ✕
                            </Button>
                        </Flex>
                    </Flex>


                    <Box
                        className="chat-messages"
                        p={2}
                        overflowY="auto"
                        flex={1}
                        bg="gray.50"
                    >
                        {messages.map((msg, index) => (
                            <Box
                                key={index}
                                className={`message ${msg.sender}`}
                                mb={2}
                                p={msg.sender === 'user' ? 1 : 0}
                                borderRadius="md"
                                maxW="80%"
                                ml={msg.sender === 'user' ? 2 : 2}
                                mr={msg.sender === 'user' ? 2 : 'auto'}
                                bg={msg.sender === 'user' ? 'teal.100' : 'transparent'}
                                fontSize="14px"
                            >
                                {/* Header for all messages (bot, agent, or user) */}
                                <Flex
                                    alignItems="center"
                                    gap={1}
                                    p={1}
                                    fontSize="12px"
                                    fontWeight="medium"
                                    bg={msg.sender === 'user' ? 'teal.100' : msg.sender === 'bot' ? 'blue.100' : 'teal.100'}
                                    borderTopRadius="md"
                                >
                                    {msg.sender === 'user' ? (
                                        <Text>You</Text>
                                    ) : (
                                        <>
                                            <Image
                                                src={settings.logoUrl}
                                                alt="Bot Logo"
                                                w={4}
                                                h={4}
                                                borderRadius="full"
                                                objectFit="cover"
                                            />
                                            <Text>{msg.sender === 'agent' ? 'Specialist' : settings.title}</Text>
                                        </>
                                    )}
                                </Flex>

                                <Box
                                    p={1}
                                    pl={0} // Start message from left border
                                    borderRadius={msg.sender === 'user' ? 'md' : '0 md md md'}
                                    bg={msg.sender === 'user' ? 'transparent' : 'gray.100'}
                                    w="100%"
                                >
                                    {/* HR for all messages */}
                                    <Box as="hr" borderColor="gray.200" mb={1} />
                                    {msg.products ? (
                                        <Box className="product-message">
                                            {msg.result && (
                                                <Text mb={2} fontWeight="medium">
                                                    {msg.result}
                                                </Text>
                                            )}
                                            <Box overflowX="auto">
                                                <Table.Root
                                                    className="product-table"
                                                    aria-label="Product list"
                                                    bg="gray.50"
                                                    size="sm"
                                                >
                                                    <Table.Header bg="teal.50">
                                                        <Table.Row>
                                                            <Table.ColumnHeader p={1} fontSize="12px">
                                                                Image
                                                            </Table.ColumnHeader>
                                                            <Table.ColumnHeader p={1} fontSize="12px">
                                                                Name
                                                            </Table.ColumnHeader>
                                                            <Table.ColumnHeader p={1} fontSize="12px">
                                                                Price
                                                            </Table.ColumnHeader>
                                                            <Table.ColumnHeader p={1} fontSize="12px">
                                                                Category
                                                            </Table.ColumnHeader>
                                                            {settings.showAddToCart && (
                                                                <Table.ColumnHeader p={1} fontSize="12px">
                                                                    Action
                                                                </Table.ColumnHeader>
                                                            )}
                                                        </Table.Row>
                                                    </Table.Header>
                                                    <Table.Body>
                                                        <For each={msg.products}>
                                                            {(product) => (
                                                                <Table.Row key={product.id} borderBottom="1px solid" borderColor="gray.200">
                                                                    <Table.Cell p={1}>
                                                                        <Image
                                                                            src={
                                                                                product.images?.[0]?.image
                                                                                    ? `${marketplaceApiUrl}${product.images[0].image}`
                                                                                    : 'https://via.placeholder.com/150'
                                                                            }
                                                                            alt={product.item_name}
                                                                            w={10}
                                                                            h={10}
                                                                            objectFit="cover"
                                                                            borderRadius="sm"
                                                                            onError={(e) => (e.target.src = 'https://via.placeholder.com/150')}
                                                                        />
                                                                    </Table.Cell>
                                                                    <Table.Cell p={1}>{product.item_name}</Table.Cell>
                                                                    <Table.Cell p={1}>${product.item_price}</Table.Cell>
                                                                    <Table.Cell p={1}>{product.item_category_name}</Table.Cell>
                                                                    {settings.showAddToCart && (
                                                                        <Table.Cell p={1}>
                                                                            <Button
                                                                                className="add-to-cart-button"
                                                                                onClick={() => handleAddToCart(product.id, product.item_name)}
                                                                                aria-label={`Add ${product.item_name} to cart`}
                                                                                bg="teal.500"
                                                                                color="white"
                                                                                px={2}
                                                                                py={1}
                                                                                borderRadius="sm"
                                                                                fontSize="12px"
                                                                            >
                                                                                Add to Cart
                                                                            </Button>
                                                                        </Table.Cell>
                                                                    )}
                                                                </Table.Row>
                                                            )}
                                                        </For>
                                                    </Table.Body>
                                                </Table.Root>
                                            </Box>
                                        </Box>
                                    ) : msg.order_details ? (
                                        <Box
                                            className="order-details"
                                            p={2}
                                            bg="gray.100"
                                        >
                                            <Text fontSize="14px" mb={1}>
                                                Order #{msg.order_details.order_id}
                                            </Text>
                                            <Text mb={1}>
                                                <strong>Status:</strong> {msg.order_details.status}
                                            </Text>
                                            <Text mb={1}>
                                                <strong>Total:</strong> ${msg.order_details.total}
                                            </Text>
                                            <Box>
                                                <Text fontSize="12px" mb={1}>Items:</Text>
                                                <Box as="ul" pl={4} m={0}>
                                                    {msg.order_details.items.map((item, i) => (
                                                        <Box as="li" key={i} mb={1}>
                                                            {item.name} - ${item.price} (Qty: {item.quantity})
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        </Box>
                                    ) : msg.order_confirmation ? (
                                        <Box
                                            className="order-confirmation"
                                            p={2}
                                            bg="gray.100"
                                        >
                                            <Text fontSize="14px" mb={1}>Order Placed Successfully!</Text>
                                            <Text mb={1}>
                                                <strong>Order ID:</strong> {msg.order_confirmation.order_id}
                                            </Text>
                                            <Text mb={1}>
                                                <strong>Estimated Delivery:</strong> {msg.order_confirmation.estimated_delivery}
                                            </Text>
                                            <Text mb={1}>Thank you for your order!</Text>
                                        </Box>
                                    ) : (
                                        <Text className="message-text">{msg.text}</Text>
                                    )}
                                </Box>
                            </Box>
                        ))}
                        {loading && (
                            <Flex
                                className="message bot loading"
                                alignItems="center"
                                gap={1}
                                p={1}
                                borderRadius="md"
                                bg="gray.100"
                                m={2}
                            >
                                <Image
                                    src={settings.logoUrl}
                                    alt="Bot Logo"
                                    w={4}
                                    h={4}
                                    borderRadius="full"
                                />
                                <Text>Loading...</Text>
                            </Flex>
                        )}
                    </Box>      <Flex
                        className="chat-input"
                        p={3}
                        borderTop="1px solid"
                        borderColor="gray.200"
                        gap={2}
                    >
                        <Input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your query (e.g., cheapest Sony headphones, order status, place order)"
                            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            isDisabled={loading}
                            flex={1}
                            p={2}
                            borderRadius="sm"
                            borderColor="gray.300"
                            bg="white"
                            color="gray.800"
                        />
                        <Button
                            onClick={sendMessage}
                            isDisabled={loading}
                            bg="teal.500"
                            color="white"
                            px={4}
                            py={2}
                            borderRadius="sm"
                        >
                            {loading ? 'Sending...' : 'Send'}
                        </Button>
                    </Flex>
                    <Box
                        className="ready-questions"
                        p={3}
                        borderTop="1px solid"
                        borderColor="gray.200"
                    >
                        <Text mb={2} fontSize="sm">Try these questions:</Text>
                        <Flex flexWrap="wrap" gap={2}>
                            {settings.readyQuestions.map((question, index) => (
                                <Button
                                    key={index}
                                    className="ready-question-button"
                                    onClick={() => {
                                        setInput(question.query);
                                        sendMessage();
                                    }}
                                    isDisabled={loading}
                                    bg="teal.100"
                                    color="gray.800"
                                    px={3}
                                    py={2}
                                    borderRadius="sm"
                                    fontSize="sm"
                                >
                                    {question.label}
                                </Button>
                            ))}
                        </Flex>
                    </Box>
                    <Box
                        className="resize-handle"
                        ref={resizeRef}
                        position="absolute"
                        bottom={0}
                        right={0}
                        w={4}
                        h={4}
                        bg="teal.500"
                        cursor="se-resize"
                    />
                </Box>
            )}
        </div>
    );
};

export default ChatWidget;