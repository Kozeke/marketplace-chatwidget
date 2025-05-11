import React, { useState } from 'react';

const NodeConfigPanel = ({ selectedNode, onSave }) => {
  const [config, setConfig] = useState({
    apiKey: selectedNode?.data?.apiKey || '',
    params: selectedNode?.data?.params || '',
  });

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...selectedNode, data: { ...selectedNode.data, ...config } });
  };

  if (!selectedNode) return <div className="p-4">Select a node to configure</div>

  return (
    <div className="w-80 bg-white p-4 shadow-lg">
      <h2 className="text-lg font-bold">Configure {selectedNode.data.label}</h2>
      <form onSubmit={handleSubmit}>
        <div className="my-2">
          <label className="block text-sm">API Key</label>
          <input
            type="text"
            name="apiKey"
            value={config.apiKey}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div className="my-2">
          <label className="block text-sm">Parameters</label>
          <textarea
            name="params"
            value={config.params}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded">
          Save
        </button>
      </form>
    </div>
  );
};

export default NodeConfigPanel;