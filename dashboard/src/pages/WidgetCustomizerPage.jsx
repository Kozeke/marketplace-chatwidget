import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Heading,
  Button,
  Input,
  Checkbox,
  FormControl,
  FormLabel,
  Select,
  Stack,
  Grid,
  Text,
  Collapse,
  IconButton,
  Image,
} from '@chakra-ui/react';
import { FaPlus, FaTrash } from 'react-icons/fa';

const WidgetCustomizer = ({ clientId = 'client_1' }) => {
  const [settings, setSettings] = useState({
    primaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    logoUri: '/img/logo/logo.jpg',
    fontFamily: 'Arial',
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
    title: 'Zipper',
    enableLiveChat: true,
    liveChatHours: { start: '09:00', end: '17:00', timezone: 'UTC' },
  });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isValid, setIsValid] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:8000/agents/${clientId}`);
        setSettings(response.data.widgetSettings || settings);
        validateFormChanged(response.data.widgetSettings || settings);
      } catch (error) {
        console.error('Error loading settings:', error);
        setMessage({ text: 'Failed to load settings.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [clientId]);

  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    validateFormChanged(newSettings);
  };

  const handleQuestionChange = (index, field, value) => {
    const newQuestions = [...settings.readyQuestions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    const newSettings = { ...settings, readyQuestions: newQuestions };
    setSettings(newSettings);
    validateFormChanged(newSettings);
  };

  const addQuestion = () => {
    const newQuestions = [...settings.readyQuestions, { label: '', query: '' }];
    setSettings({ ...settings, readyQuestions: newQuestions });
  };

  const removeQuestion = (index) => {
    const newQuestions = settings.readyQuestions.filter((_, i) => i !== index);
    const newSettings = { ...settings, readyQuestions: newQuestions };
    setSettings(newSettings);
    validateFormChanged(newSettings);
  };

  const validateForm = (updatedSettings) => {
    const { logoUri, readyQuestions, defaultWidth, defaultHeight } = updatedSettings;
    const isValidUri =
      logoUri === '' ||
      logoUri.startsWith('http://') ||
      logoUri.startsWith('https://') ||
      logoUri.startsWith('/');
    const areQuestionsValid = readyQuestions.every(
      (q) => qq.label.trim() && qq.query.trim()
    );
    const isWidthValid = defaultWidth >= 200 && defaultWidth <= 800;
    const isHeightValid = defaultHeight >= 300 && defaultHeight <= 600;
    setIsValid(isValidUri && areQuestionsValid && isWidthValid && isHeightValid);
  };

  const saveSettings = async () => {
    if (!isValid) {
      setMessage({ text: 'Please fix invalid fields.', type: 'error' });
      return;
    }
    try {
      await axios.post(`http://localhost:8000/agents/${clientId}`, settings);
      setMessage({ text: 'Settings saved!', type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ text: 'Failed to save settings.', type: 'error' });
    }
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  return (
    <Box p={6} maxW="4xl" mx="auto" bg="gray.50" minH="100vh">
      <Heading as="h2" size="xl" mb={6}>
        Customize Chat Widget
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

      {message.text && (
        <Alert status={message.type === 'success' ? 'success' : 'error'} mb={4}>
          <AlertIcon />
          <Text>{message.text}</Text>
        </Alert>
      )}

      <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6}>
        {/* Settings Form */}
        <Box bg="white" p={6} rounded="lg" shadow="md">
          <Heading as="h3" size="md" mb={4}>
            General Settings
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Primary Color</FormLabel>
              <Input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                h={10}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Background Color</FormLabel>
              <Input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => handleChange('backgroundColor', e.target.value)}
                h={10}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Text Color</FormLabel>
              <Input
                type="color"
                value={settings.textColor}
                onChange={(e) => handleChange('textColor', e.target.value)}
                h={10}
              />
            </FormControl>
            <FormControl isInvalid={settings.logoUri && !settings.logoUri.match(/^(http(s)?:\/\/|\/)/)}>
              <FormLabel>Logo URL</FormLabel>
              <Input
                type="text"
                value={settings.logoUri}
                onChange={(e) => handleChange('logoUri', e.target.value)}
                placeholder="e.g., https://example.com/logo.png"
              />
              {settings.logoUri && !settings.logoUri.match(/^(http(s)?:\/\/|\/)/) && (
                <Text color="red.500" fontSize="sm">
                  Invalid URL (must start with http://, https://, or /)
                </Text>
              )}
            </FormControl>
            <FormControl>
              <FormLabel>Font</FormLabel>
              <Select
                value={settings.fontFamily}
                onChange={(e) => handleChange('fontFamily', e.target.value)}
              >
                <option value="Arial">Arial</option>
                <option value="Roboto">Roboto</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Inter">Inter</option>
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Font Size (px)</FormLabel>
              <Input
                type="number"
                value={parseInt(settings.fontSize)}
                onChange={(e) => handleChange('fontSize', `${e.target.value}px`)}
                min="12"
                max="24"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Position</FormLabel>
              <Select
                value={settings.position}
                onChange={(e) => handleChange('position', e.target.value)}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </Select>
            </FormControl>
            <Checkbox
              isChecked={settings.isCollapsed}
              onChange={(e) => handleChange('isCollapsed', e.target.checked)}
            >
              Initially Collapsed
            </Checkbox>
          </Stack>

          <Heading as="h3" size="md" mt={6} mb={4}>
            Content Settings
          </Heading>
          <Stack spacing={4}>
            <FormControl>
              <FormLabel>Welcome Message</FormLabel>
              <Input
                type="text"
                value={settings.welcomeMessage}
                onChange={(e) => handleChange('welcomeMessage', e.target.value)}
                placeholder="e.g., Welcome to our support chat!"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Widget Title</FormLabel>
              <Input
                type="text"
                value={settings.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Zipper Bot"
              />
            </FormControl>
            <Checkbox
              isChecked={settings.showClearChat}
              onChange={(e) => handleChange('showClearChat', e.target.checked)}
            >
              Show Clear Chat Button
            </Checkbox>
            <Checkbox
              isChecked={settings.showAddToCart}
              onChange={(e) => handleChange('showAddToCart', e.target.checked)}
            >
              Show Add to Cart Button
            </Checkbox>
          </Stack>

          <Heading as="h3" size="md" mt={6} mb={4}>
            Dimensions
          </Heading>
          <Stack spacing={4}>
            <FormControl isInvalid={settings.defaultWidth < 200 || settings.defaultWidth > 800}>
              <FormLabel>Default Width (px)</FormLabel>
              <Input
                type="number"
                value={settings.defaultWidth}
                onChange={(e) => handleChange('defaultWidth', parseInt(e.target.value))}
                min="200"
                max="800"
              />
              {(settings.defaultWidth < 200 || settings.defaultWidth > 800) && (
                <Text color="red.500" fontSize="sm">
                  Width must be between 200 and 800 px
                </Text>
              )}
            </FormControl>
            <FormControl isInvalid={settings.defaultHeight < 300 || settings.defaultHeight > 600}>
              <FormLabel>Default Height (px)</FormLabel>
              <Input
                type="number"
                value={settings.defaultHeight}
                onChange={(e) => handleChange('defaultHeight', parseInt(e.target.value))}
                min="300"
                max="600"
              />
              {(settings.defaultHeight < 300 || settings.defaultHeight > 600) && (
                <Text color="red.500" fontSize="sm">
                  Height must be between 300 and 600 px
                </Text>
              )}
            </FormControl>
          </Stack>

          <Heading as="h3" size="md" mt={6} mb={4}>
            Live Chat Settings
          </Heading>
          <Stack spacing={4}>
            <Checkbox
              isChecked={settings.enableLiveChat}
              onChange={(e) => handleChange('enableLiveChat', e.target.checked)}
            >
              Enable Live Chat
            </Checkbox>
            <FormControl>
              <FormLabel>Live Chat Hours (Start)</FormLabel>
              <Input
                type="time"
                value={settings.liveChatHours.start}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, start: e.target.value })
                }
              />
            </FormControl>
            <FormControl>
              <FormLabel>Live Chat Hours (End)</FormLabel>
              <Input
                type="time"
                value={settings.liveChatHours.end}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, end: e.target.value })
                }
              />
            </FormControl>
            <FormControl>
              <FormLabel>Timezone</FormLabel>
              <Input
                type="text"
                value={settings.liveChatHours.timezone}
                onChange={(e) =>
                  handleChange('liveChatHours', { ...settings.liveChatHours, timezone: e.target.value })
                }
                placeholder="e.g., UTC"
              />
            </FormControl>
          </Stack>

          <Collapse in={true}>
            <Heading as="h3" size="md" mt={6} mb={4}>
              Ready Questions
            </Heading>
            <Stack spacing={4}>
              {settings.readyQuestions.map((question, index) => (
                <Grid
                  key={index}
                  templateColumns={{ base: '1fr', sm: '1fr 1fr 0.2fr' }}
                  gap={3}
                  alignItems="center"
                >
                  <FormControl isInvalid={!question.label.trim()}>
                    <FormLabel>Question Label</FormLabel>
                    <Input
                      value={question.label}
                      onChange={(e) => handleQuestionChange(index, 'label', e.target.value)}
                      placeholder="Question Label"
                    />
                    {!question.label.trim() && (
                      <Text color="red.500" fontSize="sm">
                        Label is required
                      </Text>
                    )}
                  </FormControl>
                  <FormControl isInvalid={!question.query.trim()}>
                    <FormLabel>Query</FormLabel>
                    <Input
                      value={question.query}
                      onChange={(e) => handleQuestionChange(index, 'query', e.target.value)}
                      placeholder="Query"
                    />
                    {!question.query.trim() && (
                      <Text color="red.500" fontSize="sm">
                        Query is required
                      </Text>
                    )}
                  </FormControl>
                  <IconButton
                    icon={<FaTrash />}
                    colorScheme="red"
                    onClick={() => removeQuestion(index)}
                    isDisabled={settings.readyQuestions.length === 1}
                    alignSelf="center"
                  />
                </Grid>
              ))}
              {settings.readyQuestions.some((q) => !q.label.trim() || !q.query.trim()) && (
                <Text color="red.500" fontSize="sm">
                  All questions must have a label and query
                </Text>
              )}
              <Button
                colorScheme="teal"
                leftIcon={<FaPlus />}
                onClick={addQuestion}
                mt={2}
              >
                Add Question
              </Button>
            </Stack>
          </Collapse>

          <Button
            colorScheme="blue"
            leftIcon={<FaCheck />}
            onClick={saveSettings}
            isDisabled={!isValid}
            mt={6}
            w="full"
          >
            Save Changes
          </Button>
        </Box>

        {/* Preview Section */}
        <Box bg="white" p={6} rounded="lg" shadow="md">
          <Heading as="h3" size="md" mb={4}>
            Widget Preview
          </Heading>
          <Box
            borderWidth={1}
            rounded="md"
            p={4}
            style={{
              backgroundColor: settings.backgroundColor,
              color: settings.textColor,
              fontFamily: settings.fontFamily,
              fontSize: settings.fontSize,
              width: `${settings.defaultWidth / 2}px`,
              height: `${settings.defaultHeight / 2}px`,
              overflow: 'auto',
            }}
          >
            <Box
              p={2}
              mb={2}
              style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
            >
              <Image
                src={settings.logoUri}
                alt="Logo"
                display="inline-block"
                w="24px"
                h="24px"
                mr="8px"
                fallbackSrc="#"
              />
              {settings.title}
            </Box>
            <Box p={2}>
              <Text>{settings.welcomeMessage}</Text>
              <Stack direction="row" wrap="wrap" mt={2}>
                {settings.readyQuestions.map((q, index) => (
                  <Button
                    key={index}
                    m={1}
                    p={1}
                    rounded="md"
                    style={{ backgroundColor: settings.primaryColor, color: settings.textColor }}
                  >
                    {q.label}
                  </Button>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
};

export default WidgetCustomizer;