import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode as decodeJpeg } from 'jpeg-js';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import { CameraFrameInput, PoseDetector, PoseFrame } from './poseTypes';
import { moveNetToMediaPipeFrame } from './moveNetAdapter';

/**
 * Implementação mobile (iOS/Android) do `PoseDetector` usando MoveNet
 * Lightning (INT8) via `react-native-fast-tflite`, conforme README.md
 * ("Stack" / detector mobile). O modelo (~2.9MB) vem do TF Hub oficial
 * (`tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4`)
 * e está em `app/assets/models/movenet_lightning_int8.tflite`.
 */
const MODEL_INPUT_SIZE = 192;
const KEYPOINT_COUNT = 17;

export class PlatformPoseDetector implements PoseDetector {
  private model: TensorflowModel | null = null;

  async load(): Promise<void> {
    this.model = await loadTensorflowModel(require('../../assets/models/movenet_lightning_int8.tflite'));
  }

  /**
   * `frame` vem de `expo-camera`'s `takePictureAsync` (uri de arquivo
   * local em iOS/Android). Recorta para um quadrado central, redimensiona
   * para 192x192 e converte os pixels RGB num tensor uint8 antes de rodar
   * o modelo.
   */
  async detect(timestampMs: number, frame?: CameraFrameInput): Promise<PoseFrame | null> {
    if (!this.model || !frame) return null;

    const inputTensor = await frameToInputTensor(frame);
    const outputs = await this.model.run([inputTensor]);

    const output = outputs[0];
    if (!(output instanceof Float32Array) || output.length < KEYPOINT_COUNT * 3) {
      return null;
    }

    return moveNetToMediaPipeFrame(timestampMs, parseKeypoints(output));
  }

  dispose(): void {
    this.model = null;
  }
}

async function frameToInputTensor(frame: CameraFrameInput): Promise<Uint8Array> {
  const squareSize = Math.min(frame.width, frame.height);
  const originX = Math.floor((frame.width - squareSize) / 2);
  const originY = Math.floor((frame.height - squareSize) / 2);

  const manipulated = await manipulateAsync(
    frame.uri,
    [
      { crop: { originX, originY, width: squareSize, height: squareSize } },
      { resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } },
    ],
    { base64: true, format: SaveFormat.JPEG, compress: 1 }
  );

  void FileSystem.deleteAsync(manipulated.uri, { idempotent: true }).catch(() => {});

  if (!manipulated.base64) {
    throw new Error('expo-image-manipulator não retornou os dados da imagem em base64.');
  }

  const { data } = decodeJpeg(base64ToUint8Array(manipulated.base64), { useTArray: true });

  const rgb = new Uint8Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
  for (let pixel = 0, channel = 0; pixel < MODEL_INPUT_SIZE * MODEL_INPUT_SIZE; pixel++) {
    rgb[channel++] = data[pixel * 4];
    rgb[channel++] = data[pixel * 4 + 1];
    rgb[channel++] = data[pixel * 4 + 2];
  }
  return rgb;
}

/**
 * MoveNet Lightning (INT8) retorna um tensor float32 de 51 valores
 * (`[1, 1, 17, 3]`): para cada um dos 17 keypoints (ordem COCO), os
 * valores são `(y, x, score)` normalizados em [0, 1] — note a ordem
 * y, x, invertida em relação ao `{x, y, score}` esperado por
 * `moveNetToMediaPipeFrame` (ver model card oficial no TF Hub).
 */
function parseKeypoints(output: Float32Array): Array<{ x: number; y: number; score: number }> {
  const keypoints: Array<{ x: number; y: number; score: number }> = [];
  for (let i = 0; i < KEYPOINT_COUNT; i++) {
    const offset = i * 3;
    keypoints.push({ x: output[offset + 1], y: output[offset], score: output[offset + 2] });
  }
  return keypoints;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (() => {
  const lookup = new Uint8Array(256);
  for (let i = 0; i < BASE64_CHARS.length; i++) lookup[BASE64_CHARS.charCodeAt(i)] = i;
  return lookup;
})();

/** Decodifica base64 → bytes sem depender de `atob`/`Buffer` (indisponíveis no Hermes). */
function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 6) / 8));

  let buffer = 0;
  let bits = 0;
  let byteIndex = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | BASE64_LOOKUP[clean.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}
