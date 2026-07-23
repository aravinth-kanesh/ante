// MediaPipe wrapper for in-browser nonverbal analysis. Loads the face and pose
// landmarkers from same-origin assets (fetched by `npm run setup`) and extracts a
// compact NonverbalSample per sampled frame. No image data leaves the browser;
// only these derived numbers are sent to the backend for aggregation.

import {
  FaceLandmarker,
  FilesetResolver,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { NonverbalSample } from "./api";

let faceLandmarker: FaceLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let loading: Promise<void> | null = null;

/** Webcam capture is available (the MediaPipe models load lazily on first use). */
export function visionSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Load the landmarkers once. Rejects if the assets are missing (setup not run). */
export function loadVision(): Promise<void> {
  if (faceLandmarker && poseLandmarker) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      faceLandmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task" },
        runningMode: "VIDEO",
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
      });
      poseLandmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

const RAD2DEG = 180 / Math.PI;

function headAngles(face: FaceLandmarkerResult): { yaw: number; pitch: number; roll: number } | null {
  const m = face.facialTransformationMatrixes?.[0]?.data;
  if (!m) return null;
  // Column-major 4x4 rotation; r[row][col] = m[col*4 + row]. YXZ Tait-Bryan
  // extraction: identity (facing the camera) gives 0/0/0, turning away grows it.
  return {
    yaw: Math.atan2(m[8], m[10]) * RAD2DEG,
    pitch: Math.atan2(-m[9], Math.hypot(m[8], m[10])) * RAD2DEG,
    roll: Math.atan2(m[1], m[5]) * RAD2DEG,
  };
}

function blendshapes(face: FaceLandmarkerResult): Record<string, number> {
  const map: Record<string, number> = {};
  for (const category of face.faceBlendshapes?.[0]?.categories ?? []) {
    map[category.categoryName] = category.score;
  }
  return map;
}

function shoulderTilt(pose: PoseLandmarkerResult): number | null {
  const landmarks = pose.landmarks?.[0];
  const left = landmarks?.[11];
  const right = landmarks?.[12];
  if (!left || !right || (left.visibility ?? 0) < 0.5 || (right.visibility ?? 0) < 0.5) {
    return null;
  }
  return Math.atan2(right.y - left.y, right.x - left.x) * RAD2DEG;
}

/** Run both landmarkers on the current frame and derive one sample, or null. */
export function extractSample(video: HTMLVideoElement, timestampMs: number): NonverbalSample | null {
  if (!faceLandmarker || !poseLandmarker) return null;
  if (video.readyState < 2 || video.videoWidth === 0) return null;

  const face = faceLandmarker.detectForVideo(video, timestampMs);
  const pose = poseLandmarker.detectForVideo(video, timestampMs);

  const angles = headAngles(face);
  const shapes = angles ? blendshapes(face) : {};
  const blink = ((shapes["eyeBlinkLeft"] ?? 0) + (shapes["eyeBlinkRight"] ?? 0)) / 2;
  const smile = ((shapes["mouthSmileLeft"] ?? 0) + (shapes["mouthSmileRight"] ?? 0)) / 2;
  const tilt = shoulderTilt(pose);

  return {
    face_detected: angles !== null,
    yaw: angles?.yaw ?? 0,
    pitch: angles?.pitch ?? 0,
    roll: angles?.roll ?? 0,
    eyes_open: blink < 0.5,
    smile,
    pose_detected: tilt !== null,
    shoulder_tilt: tilt,
  };
}
