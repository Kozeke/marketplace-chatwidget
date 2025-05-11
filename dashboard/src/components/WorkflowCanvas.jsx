import React, { useState, useCallback } from 'react';
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

// Simple custom node components
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
  
  

// Register node components
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
    websiteId: 'site123',  // or dynamically set
    chainId: '',
    name: '',
    agentSequence: [],
  });
  const [showForm, setShowForm] = useState(false); // toggle for form
  const saveChain = async () => {
    if (!chain.chainId || !chain.name || chain.agentSequence.some((intent) => !intent)) {
      alert("Please fill all fields and select agents.");
      return;
    }
  
    // Validate agent features
    for (const intent of chain.agentSequence) {
      const agent = agents.find((a) => a.intent === intent);
      if (!agent || !agent.features || agent.features.length === 0) {
        alert(`Agent ${intent} has no valid features.`);
        return;
      }
    }
  
    try {
      await axios.post("http://localhost:8000/chains", chain);
      alert("Chain saved!");
      setChain({
        websiteId: "site123",
        chainId: "",
        name: "",
        agentSequence: [],
      });
      setShowForm(false);
    } catch (err) {
      console.error("Error saving chain:", err);
      alert("Failed to save chain.");
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
    <div className="flex">
      <div className="w-64 bg-gray-200 p-4">
      <h2 className="text-lg font-bold mt-6">Agents</h2>
        {agents.map((agent, index) => (
        <div
            key={`agent-${index}`}
            className="p-2 my-2 bg-white rounded cursor-move shadow"
            draggable
            onDragStart={(event) => {
            event.dataTransfer.setData(
                'application/reactflow',
                JSON.stringify({ type: 'agent', agent })
            );
            }}
        >
            {agent.name ?? agent.intent}
        </div>
        ))}
      </div>

      <div
        className="flex-1"
        style={{ height: '80vh' }}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
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
      </div>
     {/* Right Sidebar: Config Panel and Save Chain Form */}
<div className="w-80 bg-white p-4 shadow-lg flex flex-col">
  <NodeConfigPanel selectedNode={selectedNode} onSave={onSaveConfig} />

  <div className="mt-4">
    <button
      className="w-full bg-green-500 text-white p-2 rounded mb-2"
      onClick={() => {
        setChain({ ...chain, agentSequence: extractAgentSequence() });
        setShowForm(true);
      }}
    >
      Save Current Chain
    </button>

    {showForm && (
      <div className="flex flex-col gap-2 mt-2">
        <input
          type="text"
          placeholder="Chain ID"
          value={chain.chainId}
          onChange={(e) => setChain({ ...chain, chainId: e.target.value })}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="Chain Name"
          value={chain.name}
          onChange={(e) => setChain({ ...chain, name: e.target.value })}
          className="w-full p-2 border rounded"
        />
        <button
          className="w-full bg-blue-600 text-white p-2 rounded"
          onClick={saveChain}
        >
          Save Chain
        </button>
        <button
          className="w-full bg-gray-300 text-black p-2 rounded"
          onClick={() => setShowForm(false)}
        >
          Cancel
        </button>
      </div>
    )}
  </div>
</div>

    </div>
  );
};

export default WorkflowCanvas;
