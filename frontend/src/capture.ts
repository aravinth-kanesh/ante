// Capture a spoken answer: always records audio (for server-side transcription),
// and when the webcam is on, also samples the video with MediaPipe to collect
// nonverbal signals. Only audio and derived numbers leave the browser; the video
// is used in memory and its tracks are released on stop.

import type { NonverbalSample } from "./api";

const SAMPLE_INTERVAL_MS = 125; // ~8 samples per second

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export interface Capture {
  /** Live stream, for a webcam preview (empty of video when camera is off). */
  stream: MediaStream;
  /** Stop and resolve the recorded audio plus any collected samples. */
  stop: () => Promise<{ audioBlob: Blob; samples: NonverbalSample[] }>;
  /** Abandon capture and release the microphone and camera. */
  cancel: () => void;
}

export async function startCapture(opts: { video: boolean }): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: opts.video });

  const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const samples: NonverbalSample[] = [];
  let timer: number | undefined;
  let video: HTMLVideoElement | undefined;

  if (opts.video) {
    // Load MediaPipe only when the camera is actually used, so it is code-split
    // out of the initial bundle.
    let vision: typeof import("./vision");
    try {
      vision = await import("./vision");
      await vision.loadVision();
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop());
      throw err;
    }
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    timer = window.setInterval(() => {
      if (!video) return;
      const sample = vision.extractSample(video, performance.now());
      if (sample) samples.push(sample);
    }, SAMPLE_INTERVAL_MS);
  }

  const release = () => {
    if (timer !== undefined) window.clearInterval(timer);
    if (video) {
      video.srcObject = null;
      video = undefined;
    }
    stream.getTracks().forEach((track) => track.stop());
  };

  return {
    stream,
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          release();
          resolve({
            audioBlob: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }),
            samples,
          });
        };
        recorder.stop();
      }),
    cancel: () => {
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // recorder already stopped
      }
      release();
    },
  };
}
