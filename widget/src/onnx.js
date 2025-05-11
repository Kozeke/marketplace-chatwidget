import * as ort from 'onnxruntime-web';

let session = null;

// Load the ONNX model once
export const initONNX = async () => {
  if (!session) {
    session = await ort.InferenceSession.create('/model.onnx');
  }
};

// Run inference
export const detectIntent = async (inputText) => {
  if (!session) throw new Error("ONNX session not initialized");

  const tensor = new ort.Tensor('string', [inputText], [1]);
  const feeds = { input: tensor };

  const results = await session.run(feeds);
  const output = results[Object.keys(results)[0]];

  return output.data[0];
};
