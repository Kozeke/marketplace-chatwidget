import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const [workflows, setWorkflows] = useState([
    { id: '1', name: 'Slack Notification', status: 'Active' },
    { id: '2', name: 'Google Sheets Sync', status: 'Inactive' },
  ]);

  const handleCreate = () => {
    const newWorkflow = {
      id: `${workflows.length + 1}`,
      name: `Workflow ${workflows.length + 1}`,
      status: 'Inactive',
    };
    setWorkflows([...workflows, newWorkflow]);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">Workflows</h2>
      <button
        onClick={handleCreate}
        className="my-4 bg-green-500 text-white p-2 rounded"
      >
        Create Workflow
      </button>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2">Name</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((workflow) => (
            <tr key={workflow.id} className="border-t">
              <td className="p-2">{workflow.name}</td>
              <td className="p-2">{workflow.status}</td>
              <td className="p-2">
                <Link
                  to={`/workflow/${workflow.id}`}
                  className="text-blue-500"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;