import * as ort from "onnxruntime-web/wasm";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { INPUT, letterbox, decodeOutput, finalize, needsTableTiles, tileRects } from "./yolo.js";

// 모델은 mobile 앱과 동일한 파일(SHA-256 고정)을 사용한다. 자체 호스팅 시 MODEL_URL만 바꾸면 된다.
export const MODEL_URL = import.meta.env.VITE_MODEL_URL
  || "https://huggingface.co/Kalray/yolov8/resolve/9e0af089be9c2f172e4fd9b724805f8b6514854e/yolov8s.onnx";
export const MODEL_HASH = "1bd2afeed7a85188e295875b3936a6f08df5a7671457ece9077f3b9b8daee6d6";
const MAX_BYTES = 55 * 1024 * 1024;
const CACHE = "atchacha-models-v1";
const CACHE_KEY = "/__models__/photo-yolov8s-v1.onnx";

// 런타임(.mjs/.wasm)은 Vite가 해시 파일로 내보내도록 ?url로 가져온다(public 폴더의 .mjs는 dev 서버가 거부한다).
ort.env.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl };
ort.env.wasm.numThreads = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
  ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;

let session = null;

async function sha256(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function modelReady() {
  if (!("caches" in globalThis)) return false;
  return !!(await (await caches.open(CACHE)).match(CACHE_KEY));
}

export async function downloadModel(onProgress) {
  if (!("caches" in globalThis)) throw new Error("이 브라우저는 모델 저장을 지원하지 않습니다. 보안 연결(HTTPS)과 최신 브라우저가 필요합니다.");
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`모델 다운로드에 실패했습니다 (${response.status}).`);
  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > MAX_BYTES) throw new Error("모델 크기 제한을 초과했습니다.");
    chunks.push(value);
    onProgress?.(received, total);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if ((await sha256(bytes.buffer)) !== MODEL_HASH) throw new Error("모델 무결성 검증에 실패했습니다.");
  await (await caches.open(CACHE)).put(CACHE_KEY, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
}

export async function removeModel() {
  session = null;
  if ("caches" in globalThis) await (await caches.open(CACHE)).delete(CACHE_KEY);
}

async function getSession() {
  if (session) return session;
  const cached = await (await caches.open(CACHE)).match(CACHE_KEY);
  if (!cached) throw new Error("사진 분석 모델을 먼저 다운로드해 주세요.");
  const bytes = new Uint8Array(await cached.arrayBuffer());
  if ((await sha256(bytes.buffer)) !== MODEL_HASH) { await removeModel(); throw new Error("저장된 모델이 손상되어 삭제했습니다. 다시 다운로드해 주세요."); }
  session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
  return session;
}

function preprocess(bitmap, rect) {
  const sw = rect.right - rect.left, sh = rect.bottom - rect.top;
  const lb = letterbox(sw, sh);
  const canvas = document.createElement("canvas");
  canvas.width = INPUT; canvas.height = INPUT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, INPUT, INPUT);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, rect.left, rect.top, sw, sh, lb.px, lb.py, lb.rw, lb.rh);
  const rgba = ctx.getImageData(0, 0, INPUT, INPUT).data;
  const plane = INPUT * INPUT;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = rgba[i * 4] / 255;
    input[plane + i] = rgba[i * 4 + 1] / 255;
    input[2 * plane + i] = rgba[i * 4 + 2] / 255;
  }
  return input;
}

async function infer(sess, bitmap, rect, tilesOnly, image) {
  const input = new ort.Tensor("float32", preprocess(bitmap, rect), [1, 3, INPUT, INPUT]);
  const results = await sess.run({ [sess.inputNames[0]]: input });
  const output = results[sess.outputNames[0]];
  if (output.dims.join("x") !== "1x84x8400") throw new Error("지원하지 않는 모델 출력입니다.");
  return decodeOutput(output.data, rect, image, tilesOnly);
}

// url: 사용자가 고른 사진의 object/data URL. 사진은 브라우저 밖으로 전송되지 않는다.
export async function detectPhoto(url) {
  const sess = await getSession();
  const blob = await (await fetch(url)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const image = { width: bitmap.width, height: bitmap.height };
    const candidates = await infer(sess, bitmap, { left: 0, top: 0, right: image.width, bottom: image.height }, false, image);
    if (needsTableTiles(candidates)) {
      for (const rect of tileRects(image.width, image.height)) candidates.push(...await infer(sess, bitmap, rect, true, image));
    }
    return finalize(candidates);
  } finally { bitmap.close(); }
}
