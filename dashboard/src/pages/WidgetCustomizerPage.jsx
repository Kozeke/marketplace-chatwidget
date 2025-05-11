import { useState, useEffect } from 'react';
import axios from 'axios';
import '../assets/WidgetCustomizer.css';

const WidgetCustomizer = ({ clientId = 'client_123' }) => {
  const [settings, setSettings] = useState({
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    logoUrl: '/img/logo/logo.jpg',
    font: 'Arial',
    fontSize: '16px',
    position: 'bottom-right',
    isCollapsed: true,
    welcomeMessage: 'Welcome to our support chat!',
    readyQuestions: [
      { label: 'Cheapest headphones', query: 'cheapest headphones' },
      { label: 'Order status', query: 'order status' },
    ],
    showClearChat: true,
    showAddToCart: true,
    defaultWidth: 400,
    defaultHeight: 500,
    title: 'Zipper Bot',
    enableLiveChat: true,
    liveChatHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
  });
  const [message, setMessage] = useState({ text: '', type: '' }); // Success/error message
  const [isValid, setIsValid] = useState(true); // Form validation

  // Fetch existing settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/widget/${clientId}`);
        setSettings(response.data.widgetSettings);
      } catch (error) {
        console.error('Error fetching settings:', error);
        setMessage({ text: 'Failed to load settings.', type: 'error' });
      }
    };
    fetchSettings();
  }, [clientId]);

  // Handle input changes
  const handleChange = (key, value) => {
    setSettings({ ...settings, [key]: value });
    validateForm({ ...settings, [key]: value });
  };

  // Handle ready question changes
  const handleQuestionChange = (index, field, value) => {
    const updatedQuestions = [...settings.readyQuestions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setSettings({ ...settings, readyQuestions: updatedQuestions });
    validateForm({ ...settings, readyQuestions: updatedQuestions });
  };

  // Add a new ready question
  const addQuestion = () => {
    setSettings({
      ...settings,
      readyQuestions: [...settings.readyQuestions, { label: '', query: '' }],
    });
  };

  // Remove a ready question
  const removeQuestion = (index) => {
    const updatedQuestions = settings.readyQuestions.filter((_, i) => i !== index);
    setSettings({ ...settings, readyQuestions: updatedQuestions });
    validateForm({ ...settings, readyQuestions: updatedQuestions });
  };

  // Validate form inputs
  const validateForm = (updatedSettings) => {
    const { logoUrl, readyQuestions, defaultWidth, defaultHeight } = updatedSettings;
    const isValidUrl =
      logoUrl === '' || logoUrl.startsWith('http://') || logoUrl.startsWith('https://') || logoUrl.startsWith('/');
    const areQuestionsValid = readyQuestions.every(
      (q) => q.label.trim() !== '' && q.query.trim() !== ''
    );
    const isWidthValid = defaultWidth >= 200 && defaultWidth <= 800;
    const isHeightValid = defaultHeight >= 300 && defaultHeight <= 1000;
    setIsValid(isValidUrl && areQuestionsValid && isWidthValid && isHeightValid);
  };

  // Save settings
  const saveSettings = async () => {
    if (!isValid) {
      setMessage({ text: 'Please fix invalid inputs before saving.', type: 'error' });
      return;
    }
    try {
      await axios.post(`http://localhost:8000/widget/${clientId}`, settings);
      setMessage({ text: 'Settings saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'Failed to save settings.', type: 'error' });
    }
    setTimeout(() => setMessage({ text: '', type: '' }), 3000); // Clear message after 3s
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Customize Chat Widget</h2>
      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">General Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Primary Color</label>
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="mt-1 w-full h-10 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Background Color</label>
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                className="mt-1 w-full h-10 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Text Color</label>
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                className="mt-1 w-full h-10 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Logo URL</label>
              <input
                type="text"
                value={settings.logoUrl}
                onChange={(e) => handleChange('logoUrl', e.target.value)}
                className="mt-1 w-full p-2 border rounded-md"
                placeholder="e.g., https://example.com/logo.png"
              />
              {!settings.logoUrl.startsWith('http://') &&
                !settings.logoUrl.startsWith('https://') &&
                settings.logoUrl !== '' &&
                !settings.logoUrl.startsWith('/') && (
                  <p className="text-red-500 text-sm mt-1">Invalid URL (must start with http://, https://, or /)</p>
                )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Font</label>
              <select
                value={settings.font}
                onChange={(e) => handleChange('font', e.target.value)}
                className="mt-1 w-full p-2 border rounded-md"
              >
                <option value="Arial">Arial</option>
                <option value="Roboto">Roboto</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Inter">Inter</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Font Size (px)</label>
              <input
                type="number"
                value={parseInt(settings.fontSize)}
                onChange={(e) => handleChange('fontSize', `${e.target.value}px`)}
                className="mt-1 w-full p-2 border rounded-md"
                min="12"
                max="24"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Position</label>
              <select
                value={settings.position}
                onChange={(e) => handleChange('position', e.target.value)}
                className="mt-1 w-full p-2 border rounded-md"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.isCollapsed}
                onChange={(e) => handleChange('isCollapsed', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">Initially Collapsed</label>
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-700">Content Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Welcome Message</label>
              <input
                type="text"
                value={settings.welcomeMessage}
                onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                className="mt-1 w-full p-2 border rounded-md"
                placeholder="e.g., Welcome to our support chat!"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Widget Title</label>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="mt-1 w-full p-2 border rounded-md"
                placeholder="e.g., Zipper Bot"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showClearChat}
                onChange={(e) => handleChange('showClearChat', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">Show Clear Chat Button</label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showAddToCart}
                onChange={(e) => handleChange('showAddToCart', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">Show Add to Cart Button</label>
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-700">Dimensions</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Width (px)</label>
              <input
                type="number"
                value={settings.defaultWidth}
                onChange={(e) => handleChange('defaultWidth', parseInt(e.target.value))}
                className="mt-1 w-full p-2 border rounded-md"
                min="200"
                max="800"
              />
              {settings.defaultWidth < 200 || settings.defaultWidth > 800 ? (
                <p className="text-red-500 text-sm mt-1">Width must be between 200 and 800 px</p>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Default Height (px)</label>
              <input
                type="number"
                value={settings.defaultHeight}
                onChange={(e) => handleChange('defaultHeight', parseInt(e.target.value))}
                className="mt-1 w-full p-2 border rounded-md"
                min="300"
                max="1000"
              />
              {settings.defaultHeight < 300 || settings.defaultHeight > 1000 ? (
                <p className="text-red-500 text-sm mt-1">Height must be between 300 and 1000 px</p>
              ) : null}
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-700">Live Chat Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableLiveChat}
                onChange={(e) => handleChange('enableLiveChat', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded"
              />
              <label className="ml-2 text-sm font-medium text-gray-700">Enable Live Chat</label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Live Chat Hours (Start)</label>
              <input
                type="time"
                value={settings.liveChatHours.start}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, start: e.target.value })
                }
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Live Chat Hours (End)</label>
              <input
                type="time"
                value={settings.liveChatHours.end}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, end: e.target.value })
                }
                className="mt-1 w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Timezone</label>
              <input
                type="text"
                value={settings.liveChatHours.timezone}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, timezone: e.target.value })
                }
                className="mt-1 w-full p-2 border rounded-md"
                placeholder="e.g., UTC"
              />
            </div>
          </div>

          <h3 className="text-lg font-semibold mt-6 mb-4 text-gray-700">Ready Questions</h3>
          <div className="space-y-4">
            {settings.readyQuestions.map((question, index) => (
              <div key={index} className="flex gap-4 items-center">
                <input
                  type="text"
                  value={question.label}
                  onChange={(e) => handleQuestionChange(index, 'label', e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Question Label"
                />
                <input
                  type="text"
                  value={question.query}
                  onChange={(e) => handleQuestionChange(index, 'query', e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Query"
                />
                <button
                  onClick={() => removeQuestion(index)}
                  className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                >
                  Remove
                </button>
              </div>
            ))}
            {settings.readyQuestions.some((q) => q.label.trim() === '' || q.query.trim() === '') && (
              <p className="text-red-500 text-sm">All questions must have a label and query</p>
            )}
            <button
              onClick={addQuestion}
              className="mt-2 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Add Question
            </button>
          </div>

          <button
            onClick={saveSettings}
            disabled={!isValid}
            className={`mt-6 w-full p-3 rounded-md text-white ${
              isValid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Save Changes
          </button>
        </div>

        {/* Preview Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Widget Preview</h3>
          <div
            className="border rounded-md p-4"
            style={{
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
              fontFamily: settings.font,
              fontSize: settings.fontSize,
              width: `${settings.defaultWidth / 2}px`,
              height: `${settings.defaultHeight / 2}px`,
              overflow: 'auto',
            }}
          >
            <div
              className="p-2 mb-2"
              style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
            >
              <img
                src={settings.logoUrl}
                alt="Logo"
                className="inline-block w-6 h-6 mr-2"
                onError={(e) => (e.target.src = '#')}
              />
              {settings.title}
            </div>
            <div className="p-2">
              <p>{settings.welcomeMessage}</p>
              <div className="mt-2">
                {settings.readyQuestions.map((q, i) => (
                  <button
                    key={i}
                    className="m-1 p-1 rounded"
                    style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetCustomizer;