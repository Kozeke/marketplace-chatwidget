import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Field,
  Fieldset,
  Input,
  NativeSelect,
  Stack,
  Text,
  Heading,
  Alert,
  Icon,
  IconButton,
  Collapsible,
  Grid,
  Dialog,
  Table,
  For,
} from '@chakra-ui/react';
import { FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaExclamationCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import '../assets/agentPage.css';

const AgentsPage = () => {
  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agent, setAgent] = useState({
    websiteId: 'site123',
    name: '',
    intent: '',
    features: [{ route: '', method: 'GET', parameters: '', description: '' }],
  });
  const [editAgentId, setEditAgentId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, agentId: null });
  const [showSessionInfo, setShowSessionInfo] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const response = await axios.get('http://localhost:8000/agents', {
          params: { websiteId: 'site123' },
        });
        setAgents(Array.isArray(response.data.agents) ? response.data.agents : []);
        setError('');
      } catch (error) {
        console.error('Error fetching agents:', error);
        setError('Failed to load agents. Please try again.');
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const addFeature = () => {
    setAgent({
      ...agent,
      features: [...agent.features, { route: '', method: 'GET', parameters: '', description: '' }],
    });
  };

  const updateFeature = (index, field, value) => {
    const newFeatures = [...agent.features];
    newFeatures[index][field] = value;
    setAgent({ ...agent, features: newFeatures });
  };

  const removeFeature = (index) => {
    setAgent({
      ...agent,
      features: agent.features.filter((_, i) => i !== index),
    });
  };

  const isFormValid = () => {
    return (
      agent.name.trim() &&
      agent.intent.trim() &&
      agent.features.every(
        (f) => f.route.trim() && f.method && f.description.trim()
      )
    );
  };

  const saveAgent = async () => {
    if (!isFormValid()) {
      setError('Please fill all required fields.');
      return;
    }
    try {
      const payload = {
        ...agent,
        features: agent.features.map((f) => ({
          ...f,
          parameters: f.parameters ? f.parameters.split(',').map((p) => p.trim()).filter(Boolean) : [],
        })),
      };
      if (editAgentId) {
        await axios.post('http://localhost:8000/agents', { ...payload, agentId: editAgentId });
      } else {
        await axios.post('http://localhost:8000/agents', payload);
      }
      setError('');
      setAgent({
        websiteId: 'site123',
        name: '',
        intent: '',
        features: [{ route: '', method: 'GET', parameters: '', description: '' }],
      });
      setShowForm(false);
      setEditAgentId(null);
      const response = await axios.get('http://localhost:8000/agents', {
        params: { websiteId: 'site123' },
      });
      setAgents(Array.isArray(response.data.agents) ? response.data.agents : []);
    } catch (error) {
      console.error('Error saving agent:', error);
      setError('Failed to save agent. Please try again.');
    }
  };

  const editAgent = (agentData) => {
    setAgent({
      ...agentData,
      features: agentData.features.map((f) => ({
        ...f,
        parameters: f.parameters ? f.parameters.join(', ') : '',
      })),
    });
    setEditAgentId(agentData.agentId || agentData.intent);
    setShowForm(true);
  };

  const deleteAgent = async () => {
    try {
      await axios.delete(`http://localhost:8000/agents/${deleteDialog.agentId}`);
      setAgents(agents.filter((a) => (a.agentId || a.intent) !== deleteDialog.agentId));
      setDeleteDialog({ open: false, agentId: null });
      setError('');
    } catch (error) {
      console.error('Error deleting agent:', error);
      setError('Failed to delete agent. Please try again.');
    }
  };

  return (
    <Box p={4} maxW="1200px" mx="auto" bg="gray.50" minH="100vh">
      <Heading as="h1" size="xl" mb={4}>
        Agents Management
      </Heading>

      <Stack direction="row" mb={3} spacing={2}>
        <Button
          leftIcon={<Icon as={FaPlus} />}
          colorScheme="teal"
          onClick={() => {
            setShowForm(!showForm);
            setAgent({
              websiteId: 'site123',
              name: '',
              intent: '',
              features: [{ route: '', method: 'GET', parameters: '', description: '' }],
            });
            setEditAgentId(null);
          }}
        >
          {showForm ? 'Cancel' : 'Create Agent'}
        </Button>
        <Collapsible.Root unmountOnExit open={showSessionInfo} onOpenChange={() => setShowSessionInfo(!showSessionInfo)}>
          <Collapsible.Trigger asChild>
            <Button
              colorScheme="blue"
              rightIcon={<Icon as={showSessionInfo ? FaChevronUp : FaChevronDown} />}
              py={3}
            >
              {showSessionInfo ? 'Hide Session Info' : 'Show Session Info'}
            </Button>
          </Collapsible.Trigger>
          <Collapsible.Content>
            <Box bg="#f9f9f9" p={4} borderWidth="0" borderRadius="md" mb={3} w="100%">
              <Text fontSize="sm" color="gray.600">
                The Average Sessions Per User widget calculates the average number of sessions per customer for a specific agent over the last two weeks. A session is defined as a group of messages within a 30-minute window. Messages are filtered by agent ID and sender status, grouped by customer, and sorted by timestamp to identify sessions. The total number of sessions is divided by the number of unique customers to compute the average, displayed with two decimal places.
              </Text>
            </Box>
          </Collapsible.Content>
        </Collapsible.Root>
      </Stack>

      <Collapsible.Root open={showForm} onOpenChange={() => setShowForm(!showForm)}>
        <Collapsible.Content>
          <Fieldset.Root size="lg" maxW="100%" bg="white" p={4} rounded="md" shadow="md" mb={4}>
            <Stack>
              <Fieldset.Legend as="h2" fontSize="md">
                {editAgentId ? 'Edit Agent' : 'Create Agent'}
              </Fieldset.Legend>
            </Stack>
            {error && (
              <Alert status="error" mb={4}>
                <Icon as={FaExclamationCircle} color="red.500" mr={2} />
                {error}
              </Alert>
            )}
            <Fieldset.Content>
              <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
                <Field.Root invalid={!agent.name.trim()}>
                  <Field.Label>Agent Name</Field.Label>
                  <Input
                    name="name"
                    value={agent.name}
                    onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                    placeholder="e.g., Search Agent"
                  />
                  {!agent.name.trim() && <Text color="red.500" fontSize="sm">Name is required</Text>}
                </Field.Root>
                <Field.Root invalid={!agent.intent.trim()}>
                  <Field.Label>Intent</Field.Label>
                  <Input
                    name="intent"
                    value={agent.intent}
                    onChange={(e) => setAgent({ ...agent, intent: e.target.value })}
                    placeholder="e.g., search_product"
                  />
                  {!agent.intent.trim() && <Text color="red.500" fontSize="sm">Intent is required</Text>}
                </Field.Root>
                <Box gridColumn="1 / -1">
                  <Text fontWeight="medium" mb={2}>Features</Text>
                  <For each={agent.features}>
                    {(feature, index) => (
                      <Box key={index} bg="gray.50" p={3} rounded="md" mb={3}>
                        <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr 0.2fr' }} gap={3} alignItems="center">
                          <Field.Root invalid={!feature.route.trim()}>
                            <Field.Label>Route</Field.Label>
                            <Input
                              name={`route-${index}`}
                              value={feature.route}
                              onChange={(e) => updateFeature(index, 'route', e.target.value)}
                              placeholder="e.g., /products"
                            />
                            {!feature.route.trim() && <Text color="red.500" fontSize="sm">Route is required</Text>}
                          </Field.Root>
                          <Field.Root>
                            <Field.Label>Method</Field.Label>
                            <NativeSelect.Root>
                              <NativeSelect.Field
                                name={`method-${index}`}
                                value={feature.method}
                                onChange={(e) => updateFeature(index, 'method', e.target.value)}
                              >
                                <option value="" disabled>Select method</option>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                              </NativeSelect.Field>
                              <NativeSelect.Indicator />
                            </NativeSelect.Root>
                          </Field.Root>
                          <IconButton
                            icon={<Icon as={FaTrash} />}
                            colorScheme="red"
                            onClick={() => removeFeature(index)}
                            isDisabled={agent.features.length === 1}
                            alignSelf="center"
                          />
                          <Field.Root>
                            <Field.Label>Parameters (comma-separated)</Field.Label>
                            <Input
                              name={`parameters-${index}`}
                              value={feature.parameters}
                              onChange={(e) => updateFeature(index, 'parameters', e.target.value)}
                              placeholder="e.g., brand,category,sort"
                            />
                          </Field.Root>
                          <Field.Root invalid={!feature.description.trim()}>
                            <Field.Label>Description</Field.Label>
                            <Input
                              name={`description-${index}`}
                              value={feature.description}
                              onChange={(e) => updateFeature(index, 'description', e.target.value)}
                              placeholder="e.g., Search products by brand"
                            />
                            {!feature.description.trim() && <Text color="red.500" fontSize="sm">Description is required</Text>}
                          </Field.Root>
                        </Grid>
                      </Box>
                    )}
                  </For>
                  <Button leftIcon={<Icon as={FaPlus} />} colorScheme="teal" onClick={addFeature} mt={2}>
                    Add Feature
                  </Button>
                </Box>
              </Grid>
            </Fieldset.Content>
            <Button
              leftIcon={<Icon as={FaCheck} />}
              colorScheme="teal"
              onClick={saveAgent}
              isDisabled={!isFormValid()}
              alignSelf="flex-start"
              mt={4}
            >
              {editAgentId ? 'Update Agent' : 'Save Agent'}
            </Button>
          </Fieldset.Root>
        </Collapsible.Content>
      </Collapsible.Root>

      <Heading as="h2" size="lg" mb={4}>
        Created Agents
      </Heading>
      {loading ? (
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
      ) : error ? (
        <Alert status="error" mb={4}>
          <Icon as={FaExclamationCircle} color="red.500" mr={2} />
          {error}
        </Alert>
      ) : (
        <Box bg="white" rounded="md" shadow="md" overflowX="auto">
          <Table.Root aria-label="Agents list" size="md">
            <Table.Header bg="gray.100">
              <Table.Row>
                <Table.ColumnHeader p={2}>Name</Table.ColumnHeader>
                <Table.ColumnHeader p={2}>Intent</Table.ColumnHeader>
                <Table.ColumnHeader p={2}>Features</Table.ColumnHeader>
                <Table.ColumnHeader p={2}>Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <For each={agents.map((a, i) => ({ id: i, ...a }))}>
                {(row) => (
                  <Table.Row key={row.id}>
                    <Table.Cell p={2}>{row.name}</Table.Cell>
                    <Table.Cell p={2}>{row.intent}</Table.Cell>
                    <Table.Cell p={2}>
                      {row.features && row.features.length > 0 ? (
                        <Stack direction="column" align="start" spacing={1}>
                          <For each={row.features}>
                            {(f) => (
                              <Text key={f.route} fontSize="sm">
                                {f.route} ({f.method}): {f.description}
                              </Text>
                            )}
                          </For>
                        </Stack>
                      ) : (
                        <Text fontSize="sm">No features defined</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell p={2}>
                      <Stack direction="row" spacing={2}>
                        <IconButton
                          icon={<Icon as={FaEdit} />}
                          colorScheme="blue"
                          onClick={() => editAgent(row)}
                          aria-label="Edit agent"
                        />
                        <IconButton
                          icon={<Icon as={FaTrash} />}
                          colorScheme="red"
                          onClick={() => setDeleteDialog({ open: true, agentId: row.agentId || row.intent })}
                          aria-label="Delete agent"
                        />
                      </Stack>
                    </Table.Cell>
                  </Table.Row>
                )}
              </For>
            </Table.Body>
          </Table.Root>
        </Box>
      )}

      <Dialog.Root open={deleteDialog.open} onOpenChange={(e) => setDeleteDialog({ open: e.open, agentId: deleteDialog.agentId })}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger asChild>
              <IconButton
                icon={<Icon as={FaTimes} />}
                position="absolute"
                top={2}
                right={2}
                variant="ghost"
                aria-label="Close dialog"
              />
            </Dialog.CloseTrigger>
            
            <Dialog.Header>
              <Dialog.Title>Confirm Deletion</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>Are you sure you want to delete this agent?</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                mr={3}
                leftIcon={<Icon as={FaTimes} />}
                onClick={() => setDeleteDialog({ open: false, agentId: null })}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                leftIcon={<Icon as={FaTrash} />}
                onClick={deleteAgent}
              >
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Box>
  );
};

export default AgentsPage;