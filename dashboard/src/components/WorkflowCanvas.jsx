import { useState, useCallback } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodeConfigPanel from './NodeConfigPanel';
import { Handle, Position } from 'reactflow';
import axios from 'axios';
import {
  Box,
  Button,
  Flex,
  Heading,
  Field,
  Fieldset,
  Input,
  Stack,
  Text,
  Dialog,
  Icon,
} from '@chakra-ui/react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { Collapsible } from '@chakra-ui/react';

// Custom node components (unchanged)
const TriggerNode = ({ data }) => (
  <div className="p-4 rounded shadow" style={{ background: '#ffcc00' }}>
    <Handle type="source" position={Position.Bottom} />
    {data.label}
    <Handle type="target" position={Position.Top} />
  </div>
);

const ActionNode = ({ data }) => (
  <div className="p-4 rounded shadow" style={{ background: '#00ccff' }}>
    <Handle type="source" position={Position.Bottom} />
    {data.label}
    <Handle type="target" position={Position.Top} />
  </div>
);

const AgentNode = ({ data }) => (
  <div className="p-4 rounded shadow text-sm relative" style={{ background: '#bada55' }}>
    <Handle
      type="source"
      position={Position.Bottom}
      className="w-3 h-3 bg-black rounded-full border-2 border-white"
    />
    <div className="font-bold">{data.label}</div>
    <div className="italic text-xs">Intent: {data.intent}</div>
    <Handle
      type="target"
      position={Position.Top}
      className="w-3 h-3 bg-black rounded-full border-2 border-white"
    />
  </div>
);

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  agent: AgentNode,
};

const WorkflowCanvas = ({ agents = [] }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeId, setNodeId] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const [chain, setChain] = useState({
    websiteId: 'site123',
    chainId: '',
    name: '',
    agentSequence: [],
  });
  const [showForm, setShowForm] = useState(false);
  const [dialog, setDialog] = useState({ open: false, message: '', status: 'info' });

  const saveChain = async () => {
    if (!chain.chainId || !chain.name || chain.agentSequence.some((intent) => !intent)) {
      setDialog({
        open: true,
        message: 'Please fill all fields and select agents.',
        status: 'error',
      });
      return;
    }

    for (const intent of chain.agentSequence) {
      const agent = agents.find((a) => a.intent === intent);
      if (!agent || !agent.features || agent.features.length === 0) {
        setDialog({
          open: true,
          message: `Agent ${intent} has no valid features.`,
          status: 'error',
        });
        return;
      }
    }

    try {
      await axios.post('http://localhost:8000/chains', chain);
      setDialog({
        open: true,
        message: 'Chain saved!',
        status: 'success',
      });
      setChain({
        websiteId: 'site123',
        chainId: '',
        name: '',
        agentSequence: [],
      });
      setShowForm(false);
    } catch (err) {
      console.error('Error saving chain:', err);
      setDialog({
        open: true,
        message: 'Failed to save chain.',
        status: 'error',
      });
    }
  };

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  const onSaveConfig = (updatedNode) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === updatedNode.id ? updatedNode : n))
    );
    setSelectedNode(null);
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const extractAgentSequence = () => {
    return nodes
      .filter((node) => node.type === 'agent')
      .map((node) => node.data.intent);
  };

  const onDrop = (event) => {
    event.preventDefault();
    const itemData = event.dataTransfer.getData('application/reactflow');
    if (!itemData) return;

    const bounds = event.target.getBoundingClientRect();
    const position = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };

    let parsed;
    try {
      parsed = JSON.parse(itemData);
    } catch {
      parsed = { type: itemData };
    }

    const nodeIdStr = `${nodeId}`;

    const newNode = {
      id: nodeIdStr,
      type: parsed.type,
      position,
      data:
        parsed.type === 'agent'
          ? {
              label: parsed.agent.name ?? `Agent ${nodeId}`,
              intent: parsed.agent.intent,
              features: parsed.agent.features,
              websiteId: parsed.agent.websiteId,
            }
          : {
              label:
                parsed.label ??
                `${parsed.type.charAt(0).toUpperCase() + parsed.type.slice(1)} ${nodeId}`,
            },
    };

    setNodes((nds) => nds.concat(newNode));
    setNodeId((id) => id + 1);
  };

  return (
    <Flex w="100%" h="80vh" bg="gray.100">
      {/* Left Sidebar: Agents List */}
      <Box w={{ base: '100%', md: '16rem' }} bg="gray.200" p={4} overflowY="auto">
        <Heading as="h2" size="md" mb={6}>
          Agents
        </Heading>
        <Stack spacing={2}>
          {agents.map((agent, index) => (
            <Box
              key={`agent-${index}`}
              p={2}
              bg="white"
              rounded="md"
              shadow="sm"
              cursor="move"
              _hover={{ bg: 'gray.50' }}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  'application/reactflow',
                  JSON.stringify({ type: 'agent', agent })
                );
              }}
            >
              <Text fontSize="sm">{agent.name ?? agent.intent}</Text>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Main Canvas */}
      <Box flex={1} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={onNodeClick}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </Box>

      {/* Right Sidebar: Config Panel and Chain Form */}
      <Box w={{ base: '100%', md: '20rem' }} bg="white" p={4} shadow="lg" overflowY="auto">
        <NodeConfigPanel selectedNode={selectedNode} onSave={onSaveConfig} />
        <Stack spacing={4} mt={4}>
          <Button
            colorScheme="teal"
            leftIcon={<Icon as={FaCheck} />}
            onClick={() => {
              setChain({ ...chain, agentSequence: extractAgentSequence() });
              setShowForm(true);
            }}
          >
            Save Current Chain
          </Button>
          <Collapsible.Root open={showForm} onOpenChange={() => setShowForm(!showForm)}>
            <Collapsible.Content>
              <Fieldset.Root size="lg" maxW="100%">
                <Fieldset.Content>
                  <Field.Root>
                    <Field.Label>Chain ID</Field.Label>
                    <Input
                      name="chainId"
                      value={chain.chainId}
                      onChange={(e) => setChain({ ...chain, chainId: e.target.value })}
                      placeholder="Enter chain ID"
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Chain Name</Field.Label>
                    <Input
                      name="name"
                      value={chain.name}
                      onChange={(e) => setChain({ ...chain, name: e.target.value })}
                      placeholder="Enter chain name"
                    />
                  </Field.Root>
                </Fieldset.Content>
                <Stack direction="row" mt={4} spacing={2}>
                  <Button
                    colorScheme="blue"
                    leftIcon={<Icon as={FaCheck} />}
                    onClick={saveChain}
                  >
                    Save Chain
                  </Button>
                  <Button
                    variant="outline"
                    leftIcon={<Icon as={FaTimes} />}
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Fieldset.Root>
            </Collapsible.Content>
          </Collapsible.Root>
        </Stack>
      </Box>

      {/* Dialog for Save Feedback */}
      <Dialog.Root
        open={dialog.open}
        onOpenChange={(e) => setDialog({ ...dialog, open: e.open })}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger asChild>
              <Button
                position="absolute"
                top={2}
                right={2}
                variant="ghost"
                leftIcon={<Icon as={FaTimes} />}
              >
                Close
              </Button>
            </Dialog.CloseTrigger>
            <Dialog.Header>
              <Dialog.Title>
                {dialog.status === 'success' ? 'Success' : 'Error'}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{dialog.message}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                colorScheme="blue"
                onClick={() => setDialog({ ...dialog, open: false })}
              >
                OK
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Flex>
  );
};

export default WorkflowCanvas;