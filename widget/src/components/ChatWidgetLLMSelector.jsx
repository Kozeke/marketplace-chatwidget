import { useState, useEffect, useRef } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import './ChatWidget.css'; // Optional: Add CSS for styling
import axios from "axios";

function ChatWidget() {
    const [agents, setAgents] = useState([]);
    const [chains, setChains] = useState([]);
    const [query, setQuery] = useState('');
    const [intent, setIntent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [engine, setEngine] = useState(null);
    const [selectedModel, setSelectedModel] = useState('TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC');
    const [downloadStatus, setDownloadStatus] = useState('');
    const websiteId = "site123";
    // Utility to convert snake_case to human-readable
    const toHumanReadable = (snakeCase) => {
        return snakeCase
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Utility to convert human-readable to snake_case
    const toSnakeCase = (humanReadable) => {
        return humanReadable
            .toLowerCase()
            .replace(/\s+/g, '_');
    };
    // Dynamic intent prompt
    const messagesRef = useRef([
        {
            content: (() => {
                // Collect intents with descriptions
                const intentMap = new Map();
                agents.forEach(agent => {
                    if (agent.intent) {
                        const humanReadable = toHumanReadable(agent.intent);
                        intentMap.set(agent.intent, {
                            humanReadable,
                            description: agent.features?.[0]?.description || `Handle ${humanReadable} queries`
                        });
                    }
                });

                // Include intents from chains' agentSequence
                chains.forEach(chain => {
                    chain.agentSequence.forEach(item => {
                        const intent = typeof item === 'string' ? item : item[1]; // Handle tuples [_id, intent]
                        if (intent && !intentMap.has(intent)) {
                            const humanReadable = toHumanReadable(intent);
                            intentMap.set(intent, {
                                humanReadable,
                                description: `Part of chain: ${chain.name}`
                            });
                        }
                    });
                });

                // Generate prompt
                let prompt = `You are an intent detection system for a chat widget. Classify the user's query into one of the following intents. Return only the intent name as shown below (e.g., Search Product).\n`;

                // Add intents with descriptions
                intentMap.forEach(({ humanReadable, description }) => {
                    prompt += `- ${humanReadable}: ${description}\n`;
                });

                // Add Unknown intent
                prompt += `- Unknown: Queries that don’t match any defined intent\n`;

                // Add examples
                prompt += `\nExamples:\n`;
                intentMap.forEach(({ humanReadable, description }, intent) => {
                    // Generate example from description or intent
                    let exampleQuery;
                    if (description.includes('Search products')) {
                        exampleQuery = 'Find products by brand';
                    } else if (description.includes('order status')) {
                        exampleQuery = 'Where is my order?';
                    } else if (intent === 'recommend_product') {
                        exampleQuery = 'Suggest a product for me';
                    } else if (intent === 'place_order') {
                        exampleQuery = 'Place an order for a laptop';
                    } else {
                        // Use description or generic fallback
                        exampleQuery = description.startsWith('Part of chain')
                            ? `Query about ${humanReadable.toLowerCase()}`
                            : description;
                    }
                    prompt += `- "${exampleQuery}" -> ${humanReadable}\n`;
                });
                console.log(prompt)
                return prompt;
            })(),
            role: 'system'
        }
    ]);


    // Available models
    const availableModels = webllm.prebuiltAppConfig.model_list.map((m) => m.model_id);

    // Initialize WebLLM engine
    useEffect(() => {
        const initializeEngine = async () => {
            if (!navigator.gpu) {
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
            } catch (err) {
                console.error('Failed to initialize WebLLM:', err);
                setError(`Failed to load model: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };
        initializeEngine();
    }, [selectedModel]);
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
                // setMessages((prev) => [
                //   ...prev,
                //   { sender: "bot", text: "Error loading agents or chains. Please try again later." },
                // ]);
            }
        };
        fetchData();
    }, []);
    // Detect intent with streaming
    const detectIntent = async (userQuery) => {
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
            // Map human-readable intent to snake_case
            const snakeCaseIntent = toSnakeCase(finalMessage);
            setIntent(snakeCaseIntent);
            messagesRef.current.push({ content: snakeCaseIntent, role: 'assistant' });
        } catch (err) {
            console.error('Intent detection error:', err);
            setError(err.message);
            setIntent(null);
        } finally {
            setLoading(false);
        }
    };

    // Handle model selection
    const handleModelChange = (e) => {
        setSelectedModel(e.target.value);
        setEngine(null);
        setIntent(null);
        setDownloadStatus('');
    };

    // Handle query submission
    const handleSubmit = (e) => {
        if (e.key === 'Enter' && query.trim() && !loading) {
            detectIntent(query);
            setQuery('');
        }
    };

    return (
        <div className="chat-widget">
            <div className="model-selection">
                <label htmlFor="model-selection">Select Model: </label>
                <select id="model-selection" value={selectedModel} onChange={handleModelChange} disabled={loading}>
                    {availableModels.map((modelId) => (
                        <option key={modelId} value={modelId}>
                            {modelId}
                        </option>
                    ))}
                </select>
            </div>
            <div id="download-status" className={downloadStatus ? '' : 'hidden'}>
                {downloadStatus}
            </div>
            {error && <p className="error">{error}</p>}
            {loading && <p>Loading...</p>}
            {intent && (
                <div className="message-container">
                    <div className="message assistant">Detected Intent: {intent}</div>
                </div>
            )}
            <div className="chat-box" id="chat-box">
                {messagesRef.current
                    .filter((msg) => msg.role !== 'system')
                    .map((msg, index) => (
                        <div key={index} className={`message-container ${msg.role}`}>
                            <div className="message">{msg.content}</div>
                        </div>
                    ))}
            </div>
            <input
                id="user-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleSubmit}
                placeholder={loading ? 'Processing...' : 'Enter query (e.g., Where is my order?)'}
                disabled={loading || !engine}
            />
            <button id="send" onClick={() => detectIntent(query)} disabled={loading || !query.trim() || !engine}>
                Send
            </button>
        </div>
    );
}

export default ChatWidget;