import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemText,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    IconButton,
    Badge,
    Divider,
    Chip,
    Alert,
    CircularProgress,
} from '@mui/material';
import { Send, PowerSettingsNew, Menu } from '@mui/icons-material';
import '../assets/agentLiveChat.css';

const AgentDashboard = ({ agentId = 'agent_001', clientId = 'client_123' }) => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [message, setMessage] = useState('');
    const [ws, setWs] = useState(null);
    const [agentStatus, setAgentStatus] = useState('offline');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Fetch active sessions
    useEffect(() => {
        const fetchSessions = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`http://localhost:8000/chat/session`, {
                    params: { agentId, clientId },
                });
                setSessions(response.data.sessions || []);
                setError('');
            } catch (error) {
                console.error('Error fetching sessions:', error);
                setError('Failed to load sessions. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
        const interval = setInterval(fetchSessions, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [agentId, clientId]);

    // Initialize WebSocket and manage agent status
    useEffect(() => {
        const websocket = new WebSocket(`ws://localhost:8000/ws/agent/${agentId}`);
        setWs(websocket);

        websocket.onopen = async () => {
            console.log('Agent WebSocket connected');
            try {
                await axios.post('http://localhost:8000/human-agents/status', {
                    agentId,
                    status: 'online',
                });
                setAgentStatus('online');
                setError('');
            } catch (error) {
                console.error('Error setting agent online:', error);
                setError('Failed to set online status.');
            }
        };

        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("data", data);
            if (data.sessionId && data.message) {
                console.log("data.sessionId", data.sessionId, data.message);
                setSessions((prev) =>
                    prev.map((session) =>
                        session.sessionId === data.sessionId
                            ? { ...session, messages: [...session.messages, data.message] }
                            : session
                    )
                );
                // Use functional update to access current selectedSession
                setSelectedSession((prev) => {
                    console.log("Current selectedSession:", prev, "Message sessionId:", data.sessionId);
                    if (prev?.sessionId === data.sessionId) {
                        return {
                            ...prev,
                            messages: [...prev.messages, data.message],
                        };
                    }
                    return prev;
                });
            } else if (data.error) {
                setError(data.error);
            }
        };

        websocket.onclose = async () => {
            console.log('Agent WebSocket disconnected');
            try {
                await axios.post('http://localhost:8000/human-agents/status', {
                    agentId,
                    status: 'offline',
                });
                setAgentStatus('offline');
            } catch (error) {
                console.error('Error setting agent offline:', error);
                setError('Failed to set offline status.');
            }
        };

        return () => {
            websocket.close();
        };
    }, [agentId]); // Removed selectedSession from dependencies

    // Close chat session
    const closeChat = async () => {
        if (!selectedSession) return;
        try {
            await axios.post('http://localhost:8000/chat/session/close', {
                session_id: selectedSession.sessionId,
            });
            // Update sessions to remove the closed session
            setSessions((prev) => prev.filter((session) => session.sessionId !== selectedSession.sessionId));
            // Clear selectedSession
            setSelectedSession(null);
            setError('');
        } catch (error) {
            console.error('Error closing chat:', error);
            setError('Failed to close chat. Please try again.');
        }
    };
    // Send message
    const sendMessage = () => {
        if (!message.trim() || !ws || !selectedSession) return;
        const newMessage = { sender: 'agent', text: message.trim(), timestamp: new Date().toISOString() };
        console.log("new message", newMessage);
        try {
            ws.send(JSON.stringify({ sessionId: selectedSession.sessionId, message: newMessage }));
            setSelectedSession((prev) => ({
                ...prev,
                messages: [...prev.messages, newMessage],
            }));
            console.log("selectedSessionSet", selectedSession)
            setMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            setError('Failed to send message.');
        }
    };

    // Toggle agent status
    const toggleStatus = async () => {
        const newStatus = agentStatus === 'online' ? 'offline' : 'online';
        try {
            await axios.post('http://localhost:8000/human-agents/status', {
                agentId,
                status: newStatus,
            });
            setAgentStatus(newStatus);
            setError('');
        } catch (error) {
            console.error('Error toggling status:', error);
            setError(`Failed to set ${newStatus} status.`);
        }
    };

    // Toggle mobile drawer
    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    // Format timestamp
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleSelectSession = (session) => {
        setSelectedSession(session);
        setMobileOpen(false);
        console.log("selectedSession", selectedSession)
        // Optional: mark messages as read, focus message input, etc.
    };


    // Drawer content
    const drawerContent = (
        <Box sx={{ width: 250, p: 2, right: 0}}>
            <Typography variant="h6" gutterBottom>
                Active Chats
            </Typography>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : sessions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    No active chats
                </Typography>
            ) : (
                <List>
                    {sessions.map((session) => (
                        <ListItem
                            key={session.sessionId}
                            button
                            selected={selectedSession?.sessionId === session.sessionId}
                            onClick={() => handleSelectSession(session)}
                        >
                            <ListItemText
                                primary={`Chat ${session.sessionId.slice(0, 8)}...`}
                                secondary={`User: ${session.userId.slice(0, 8)}...`}
                            />
                            <Badge
                                badgeContent={session.messages.filter((m) => m.sender === 'user').length}
                                color="primary"
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5',right: 0 }}>
            {/* Mobile Drawer */}
            <Drawer
                anchor="right" // Set anchor to right
                variant="temporary"
                open={mobileOpen}
                onClose={handleDrawerToggle}
                ModalProps={{ keepMounted: true }}
                sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: 250 }, right: 0 }}
            >
                {drawerContent}
            </Drawer>

            {/* Permanent Drawer for Desktop */}
            <Drawer
                variant="permanent"
                anchor="right" // Set anchor to right
                sx={{
                    right:"0",
                    display: { xs: 'none', sm: 'block' },
                    '& .MuiDrawer-paper': { width: 250, boxSizing: 'border-box' },
                }}
                open
            >
                {drawerContent}
            </Drawer>

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, p: 3, maxWidth: { sm: 'calc(100% - 250px)' } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ display: { sm: 'none' } }}
                        >
                            <Menu />
                        </IconButton>
                        <Typography variant="h5" fontWeight="bold">
                            Agent Dashboard
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            label={agentStatus}
                            color={agentStatus === 'online' ? 'success' : 'default'}
                            size="small"
                        />
                        <IconButton onClick={toggleStatus} color={agentStatus === 'online' ? 'error' : 'success'}>
                            <PowerSettingsNew />
                        </IconButton>
                    </Box>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {selectedSession ? (
                    <Card sx={{ maxWidth: 800, mx: 'auto', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1, overflowY: 'auto' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6" gutterBottom>
                                    Chat {selectedSession.sessionId.slice(0, 8)}...
                                </Typography>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    onClick={closeChat}
                                    sx={{ mb: 1 }}
                                >
                                    Close Chat
                                </Button>
                            </Box>
                            <Divider sx={{ mb: 2 }} />
                            <Box className="messages">
                                {selectedSession.messages.map((msg, index) => (
                                    <Box
                                        key={index}
                                        className={`message ${msg.sender}`}
                                        sx={{
                                            mb: 2,
                                            p: 2,
                                            borderRadius: 2,
                                            bgcolor: msg.sender === 'agent' ? '#e3f2fd' : '#f1f5f9',
                                            alignSelf: msg.sender === 'agent' ? 'flex-end' : 'flex-start',
                                            maxWidth: '70%',
                                        }}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            {msg.sender === 'agent' ? 'You' : 'User'} • {formatTimestamp(msg.timestamp)}
                                        </Typography>
                                        <Typography variant="body1">{msg.text}</Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderTop: '1px solid #e0e0e0' }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    placeholder="Type your message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                    size="small"
                                />
                                <Button
                                    variant="contained"
                                    endIcon={<Send />}
                                    onClick={sendMessage}
                                    disabled={!message.trim() || !ws}
                                    sx={{ bgcolor: '#1976d2' }}
                                >
                                    Send
                                </Button>
                            </Box>
                        </Box>
                    </Card>
                ) : (
                    <Typography variant="body1" color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
                        Select a chat session to start messaging.
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default AgentDashboard;