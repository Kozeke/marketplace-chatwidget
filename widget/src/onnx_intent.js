/* global BigInt64Array, BigInt */


import * as ort from 'onnxruntime-web';
import { AutoTokenizer } from '@xenova/transformers';
import { env } from '@xenova/transformers'; 


let session = null;
let tokenizer = null;

// Load the ONNX model once
export const initONNX = async () => {
  if (!session) {
    env.allowLocalModels = true;

    env.localModelPath = '/onnx_intent_model/';

    console.log("initin onnx")
    console.log("env", env)
    session = await ort.InferenceSession.create('/onnx_intent_model/model.onnx');
    console.log('Model loaded successfully');
    console.log('Loading tokenizer...');
    tokenizer = await AutoTokenizer.from_pretrained('tokenizer');
    console.log('Tokenizer loaded successfully');


  }
};

export const detectIntent = async (inputText) => {
  if (!session || !tokenizer) {
    throw new Error('ONNX session or tokenizer not initialized');
  }

  // Tokenize input text
  const inputs = await tokenizer(inputText, {
    padding: true,
    truncation: true,
    max_length: 128, // Match training max_length (adjust if needed)
    return_tensors: false, // Ensure plain arrays
  });

  // Ensure inputs.input_ids and attention_mask are arrays
  const inputIdsArray = Array.isArray(inputs.input_ids)
    ? inputs.input_ids
    : inputs.input_ids.data || Array.from(inputs.input_ids); // Fallback for tensor-like objects
  const attentionMaskArray = Array.isArray(inputs.attention_mask)
    ? inputs.attention_mask
    : inputs.attention_mask.data || Array.from(inputs.attention_mask);

  // Create tensors with BigInt64Array
  const inputIdsData = new BigInt64Array(inputIdsArray.map(BigInt));
  const inputIds = new ort.Tensor('int64', inputIdsData, [1, inputIdsArray.length]);
  const attentionMaskData = new BigInt64Array(attentionMaskArray.map(BigInt));
  const attentionMask = new ort.Tensor('int64', attentionMaskData, [1, attentionMaskArray.length]);

  const feeds = {
    input_ids: inputIds,
    attention_mask: attentionMask,
  };

  // Run inference
  const results = await session.run(feeds);

  // Get logits and compute probabilities
  const logits = Array.from(results.logits.data);
  const expLogits = logits.map((x) => Math.exp(x));
  const sumExpLogits = expLogits.reduce((a, b) => a + b, 0);
  const probabilities = expLogits.map((x) => x / sumExpLogits); // Softmax
  const predictedClass = probabilities.indexOf(Math.max(...probabilities));

  // Map to intent
  const intents = ['search_product', 'place_order'];
  return {
    intent: intents[predictedClass],
    confidence: probabilities[predictedClass],
  };
};
