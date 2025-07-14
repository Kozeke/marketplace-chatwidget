import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AgentsPage from "./pages/AgentsPage.jsx";
import AgentChainsPage from "./pages/AgentChainsPage.jsx"; // New page
import "./App.css";
import Dashboard from './pages/AgentChainDashboard.jsx';
import WidgetCustomizerPage from './pages/WidgetCustomizerPage.jsx';
import AgentLiveChat from './pages/AgentLiveChat.jsx';
import { Provider } from './components/ui/provider';

function App() {
  return (
    <Provider>
      <Router>
        <div className="dashboard">
          {/* Sidebar */}
          <div className="sidebar">
            <Link to="/"> <h2>Dashboard</h2></Link>
            <nav>
              <ul>
                <li>
                  <Link to="/agents">Agents</Link>
                </li>
                <li>
                  <Link to="/workflow/:id">Agent Chains</Link>
                </li>
                <li>
                  <Link to="/customize-widget">Customize Widget</Link>
                </li>
                <li>
                  <Link to="/agent-livechat">AgentLiveChat</Link>
                </li>
              </ul>
            </nav>
          </div>
          {/* Main Content */}
          <div className="main-content">
            <Routes>
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/workflow/:id" element={<AgentChainsPage />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/customize-widget" element={<WidgetCustomizerPage />} />
              <Route path="/agent-livechat" element={<AgentLiveChat />} />
            </Routes>
          </div>
        </div>
      </Router>
    </Provider>
  );
}

export default App;