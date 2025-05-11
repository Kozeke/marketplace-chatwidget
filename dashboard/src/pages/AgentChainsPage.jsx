import { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css';
import WorkflowCanvas from '../components/WorkflowCanvas';

function AgentChainsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/agents', {
          params: { websiteId: 'site123' },
        });
        setAgents(Array.isArray(response.data.agents) ? response.data.agents : []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching agents:', error);
        setError('Failed to load agents. Please try again.');
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  return (
    <div className="agent-chains-page">
      <h1>Workflow Automation</h1>
      {loading && <p>Loading agents...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && (
        <WorkflowCanvas agents={agents} />
      )}
    </div>
  );
}

export default AgentChainsPage;