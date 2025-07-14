import { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Heading, Text, Alert, Stack } from '@chakra-ui/react';
import WorkflowCanvas from '../components/WorkflowCanvas';
import '../App.css';

function AgentChainsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
    <Box p={4} maxW="1200px" mx="auto" bg="gray.50" minH="100vh">
      <Heading as="h1" size="xl" mb={4}>
        Workflow Automation
      </Heading>
      {loading && (
        <Stack direction="row" justify="center" py={4}>
          <Box
            w={6}
            h={6}
            borderRadius="full"
            border="2px solid"
            borderColor="teal.500"
            borderTopColor="transparent"
            animate={{ rotate: 360 }}
            transition="1s linear infinite"
          />
        </Stack>
      )}
      {error && (
        <Alert status="error" mb={4}>
          <Text>{error}</Text>
        </Alert>
      )}
      {!loading && !error && <WorkflowCanvas agents={agents} />}
    </Box>
  );
}

export default AgentChainsPage;