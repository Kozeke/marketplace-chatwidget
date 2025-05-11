import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Collapse,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Delete, Edit, Close, Save } from '@mui/icons-material';
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
  const [editAgentId, setEditAgentId] = useState(null); // Track agent being edited
  const [deleteDialog, setDeleteDialog] = useState({ open: false, agentId: null });

  // Fetch agents
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

  // Add new feature
  const addFeature = () => {
    setAgent({
      ...agent,
      features: [...agent.features, { route: '', method: 'GET', parameters: '', description: '' }],
    });
  };

  // Update feature
  const updateFeature = (index, field, value) => {
    const newFeatures = [...agent.features];
    newFeatures[index][field] = value;
    setAgent({ ...agent, features: newFeatures });
  };

  // Remove feature
  const removeFeature = (index) => {
    setAgent({
      ...agent,
      features: agent.features.filter((_, i) => i !== index),
    });
  };

  // Validate form
  const isFormValid = () => {
    return (
      agent.name.trim() &&
      agent.intent.trim() &&
      agent.features.every(
        (f) => f.route.trim() && f.method && f.description.trim() && (f.parameters.trim() || true)
      )
    );
  };

  // Save or update agent
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
        // Update existing agent (assuming backend supports updates via POST with agentId)
        await axios.post('http://localhost:8000/agents', { ...payload, agentId: editAgentId });
      } else {
        // Create new agent
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
      // Refresh agents
      const response = await axios.get('http://localhost:8000/agents', {
        params: { websiteId: 'site123' },
      });
      setAgents(Array.isArray(response.data.agents) ? response.data.agents : []);
    } catch (error) {
      console.error('Error saving agent:', error);
      setError('Failed to save agent. Please try again.');
    }
  };

  // Edit agent
  const editAgent = (agentData) => {
    setAgent({
      ...agentData,
      features: agentData.features.map((f) => ({
        ...f,
        parameters: f.parameters ? f.parameters.join(', ') : '',
      })),
    });
    setEditAgentId(agentData.agentId || agentData.intent); // Use intent as fallback if agentId not set
    setShowForm(true);
  };

  // Delete agent
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

  const columns = [
    { field: 'name', headerName: 'Name', width: 200 },
    { field: 'intent', headerName: 'Intent', width: 200 },
    {
      field: 'features',
      headerName: 'Features',
      width: 400,
      renderCell: (params) =>
        params.value && params.value.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 1 }}>
            {params.value.map((f, i) => (
              <Typography key={i} variant="body2">
                {f.route} ({f.method}): {f.description}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2">No features defined</Typography> // Wrap text in Typography for consistency
        ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => editAgent(params.row)} color="primary">
            <Edit />
          </IconButton>
          <IconButton
            onClick={() => setDeleteDialog({ open: true, agentId: params.row.agentId || params.row.intent })}
            color="error"
          >
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Agents Management
      </Typography>

      <Button
        variant="contained"
        startIcon={<Add />}
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
        sx={{ mb: 3 }}
      >
        {showForm ? 'Cancel' : 'Create Agent'}
      </Button>

      <Collapse in={showForm}>
        <Card sx={{ mb: 4, p: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {editAgentId ? 'Edit Agent' : 'Create Agent'}
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Agent Name"
                  value={agent.name}
                  onChange={(e) => setAgent({ ...agent, name: e.target.value })}
                  placeholder="e.g., Search Agent"
                  variant="outlined"
                  error={!agent.name.trim()}
                  helperText={!agent.name.trim() ? 'Name is required' : ''}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Intent"
                  value={agent.intent}
                  onChange={(e) => setAgent({ ...agent, intent: e.target.value })}
                  placeholder="e.g., search_product"
                  variant="outlined"
                  error={!agent.intent.trim()}
                  helperText={!agent.intent.trim() ? 'Intent is required' : ''}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                  Features
                </Typography>
                {agent.features.map((feature, index) => (
                  <Card key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Route"
                          value={feature.route}
                          onChange={(e) => updateFeature(index, 'route', e.target.value)}
                          placeholder="e.g., /products"
                          variant="outlined"
                          error={!feature.route.trim()}
                          helperText={!feature.route.trim() ? 'Route is required' : ''}
                        />
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth variant="outlined">
                          <InputLabel>Method</InputLabel>
                          <Select
                            value={feature.method}
                            onChange={(e) => updateFeature(index, 'method', e.target.value)}
                            label="Method"
                          >
                            <MenuItem value="GET">GET</MenuItem>
                            <MenuItem value="POST">POST</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <IconButton
                          color="error"
                          onClick={() => removeFeature(index)}
                          disabled={agent.features.length === 1}
                        >
                          <Delete />
                        </IconButton>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Parameters (comma-separated)"
                          value={feature.parameters}
                          onChange={(e) => updateFeature(index, 'parameters', e.target.value)}
                          placeholder="e.g., brand,category,sort"
                          variant="outlined"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Description"
                          value={feature.description}
                          onChange={(e) => updateFeature(index, 'description', e.target.value)}
                          placeholder="e.g., Search products by brand"
                          variant="outlined"
                          error={!feature.description.trim()}
                          helperText={!feature.description.trim() ? 'Description is required' : ''}
                        />
                      </Grid>
                    </Grid>
                  </Card>
                ))}
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={addFeature}
                  sx={{ mt: 2 }}
                >
                  Add Feature
                </Button>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={saveAgent}
                  disabled={!isFormValid()}
                  fullWidth
                >
                  {editAgentId ? 'Update Agent' : 'Save Agent'}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Collapse>

      <Typography variant="h5" fontWeight="medium" gutterBottom>
        Created Agents
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <Box sx={{ height: 400, bgcolor: '#fff', borderRadius: 2, overflow: 'hidden' }}>
  <DataGrid
    rows={agents.map((a, i) => ({ id: i, ...a }))}
    columns={columns}
    pageSize={5}
    rowsPerPageOptions={[5, 10, 20]}
    disableSelectionOnClick
    autoHeight
    sx={{
      '& .MuiDataGrid-cell': {
        py: 2,
        display: 'flex',
        alignItems: 'center', // Vertically center cell content
      },
      '& .MuiDataGrid-columnHeader': {
        display: 'flex',
        alignItems: 'center', // Vertically center header content
      },
    }}
  />
</Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, agentId: null })}
      >
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this agent?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, agentId: null })}>Cancel</Button>
          <Button onClick={deleteAgent} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AgentsPage;