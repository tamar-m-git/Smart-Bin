// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

const LABELS = ['trash', 'bottle'];

function Trainer({ onModelTrained }) {
  const [trashFiles, setTrashFiles] = useState([]);
  const [bottleFiles, setBottleFiles] = useState([]);
  const [status, setStatus] = useState('');

  const handleFiles = (e, setter) => setter(Array.from(e.target.files));

  const preprocess = async (files, size) => {
    const tensors = await Promise.all(files.map(file => new Promise(res => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () =>
        res(
          tf.browser
            .fromPixels(img)
            .resizeNearestNeighbor(size)
            .toFloat()
            .div(255)
            .expandDims()
        );
    })));
    return tensors.length ? tf.concat(tensors, 0) : tf.tensor4d([], [0, ...size, 3]);
  };

  const train = async () => {
    if (!trashFiles.length || !bottleFiles.length) {
      alert('העלידי לפחות תמונה אחת לכל קטגוריה');
      return;
    }
    setStatus('מכין נתונים...');
    const TRAIN_SIZE = [96, 96];  // אם אתה מעדיף לאמן ב־96×96
    const xsTrash  = await preprocess(trashFiles, TRAIN_SIZE);
    const xsBottle = await preprocess(bottleFiles, TRAIN_SIZE);
    const xs = tf.concat([xsTrash, xsBottle], 0);
    const ys = tf.oneHot(
      tf.tensor1d(
        [...Array(xsTrash.shape[0]).fill(0), ...Array(xsBottle.shape[0]).fill(1)],
        'int32'
      ),
      2
    );

    setStatus('בונה מודל...');
    const model = tf.sequential();
    model.add(tf.layers.conv2d({
      inputShape: [...TRAIN_SIZE, 3], filters: 16, kernelSize: 3, activation: 'relu'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

    setStatus('מתאמן...');
    await model.fit(xs, ys, {
      epochs: 10,
      batchSize: 8,
      callbacks: {
        onEpochEnd: (e, logs) =>
          setStatus(`Epoch ${e+1}: loss=${logs.loss.toFixed(3)}, acc=${(logs.acc*100).toFixed(1)}%`)
      }
    });

    setStatus('שומר מודל ל־IndexedDB...');
    await model.save('indexeddb://smartbin-model');

    setStatus('המודל מוכן!');
    onModelTrained(model);
  };

  return (
    <div className="p-4 bg-gray-50 rounded mb-6 shadow">
      <h2 className="text-lg font-semibold mb-2">אמן מודל מקומית</h2>
      <div className="flex space-x-4">
        <div>
          <label>אשפה:</label>
          <input type="file" multiple accept="image/*" onChange={e => handleFiles(e, setTrashFiles)} />
        </div>
        <div>
          <label>בקבוקים:</label>
          <input type="file" multiple accept="image/*" onChange={e => handleFiles(e, setBottleFiles)} />
        </div>
      </div>
      <button onClick={train} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        התחל אימון
      </button>
      {status && <p className="mt-2">{status}</p>}
    </div>
  );
}

function SmartBin({ externalModel }) {
  const [model, setModel] = useState(null);
  const [inputSize, setInputSize] = useState(null);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState(null);
  const imgRef = useRef();

  useEffect(() => {
    async function load() {
      setStatus('טוען מודל...');
      let m = null;
      // 1. נסה IndexedDB
      try {
        m = await tf.loadLayersModel('indexeddb://smartbin-model');
      } catch (e) {
        // 2. אם אין, קרא מ־public/model/model.json
        if (externalModel) {
          m = externalModel;
        } else {
          try {
            m = await tf.loadGraphModel('/model/model.json');
          } catch {}
        }
      }
      if (m) {
        setModel(m);
        // קרא גודל קלט
        const shape = m.inputs[0].shape; // [null, H, W, C]
        setInputSize([shape[1], shape[2]]);
        setStatus('');
      } else {
        setStatus('אין מודל זמין, נא לאמן או להוריד');
      }
    }
    load();
  }, [externalModel]);

  const classify = async () => {
    if (!model || !inputSize) return;
    setStatus('בודק נתונים...');
    const [H, W] = inputSize;
    const tensor = tf.browser
      .fromPixels(imgRef.current)
      .resizeNearestNeighbor([H, W])
      .toFloat()
      .div(255)
      .expandDims();
    const preds = await model.predict(tensor).data();
    const idx = preds.indexOf(Math.max(...preds));
    setResult(idx);
    setStatus(`זוהה: ${LABELS[idx]}`);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-xl mb-2">פח חשמלי חכם</h2>
      <img
        ref={imgRef}
        src="/test-image.jpg"
        alt="to classify"
        className="w-full h-auto mb-4 rounded border"
      />
      <button
        onClick={classify}
        disabled={!model}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        בדוק תמונה
      </button>
      {status && <p className="mt-2">{status}</p>}
      {result !== null && (
        <p className="mt-1 font-bold">
          {result === 1 ? '🔔 זה בקבוק – פתח פח!' : '📥 אשפה רגילה'}
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [trainedModel, setTrainedModel] = useState(null);

  return (
    <div className="max-w-md mx-auto my-8">
      <Trainer onModelTrained={m => setTrainedModel(m)} />
      <SmartBin externalModel={trainedModel} />
    </div>
  );
}
