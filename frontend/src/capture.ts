// Capture a spoken answer: always records audio (for server-side transcription),
// and when the webcam is on, also samples the video with MediaPipe to collect
// nonverbal signals. Only audio and derived numbers leave the browser; the video
// is used in memory and its tracks are released on stop.
//
// The webcam analysis is best-effort: if MediaPipe cannot load (for example the
// models were not fetched), the camera and recording keep working, just without
// nonverbal metrics. Frames are sampled from the visible preview element, which
// decodes reliably across browsers (an offscreen element often does not on macOS).

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

export async function startCapture(opts: {
  video: boolean;
  sampleVideo?: HTMLVideoElement | null;
}): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: opts.video });

  const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const samples: NonverbalSample[] = [];
  let timer: number | undefined;
  let ownVideo: HTMLVideoElement | undefined; // created only if no preview was provided

  if (opts.video) {
    // Prefer the caller's visible preview element for sampling; fall back to an
    // offscreen element sized large enough to decode if none was provided.
    let sampleVideo = opts.sampleVideo ?? undefined;
    if (!sampleVideo) {
      ownVideo = document.createElement("video");
      ownVideo.style.cssText = "position:fixed;left:-9999px;top:0;width:64px;height:48px;";
      document.body.appendChild(ownVideo);
      sampleVideo = ownVideo;
    }
    sampleVideo.muted = true;
    sampleVideo.playsInline = true;
    sampleVideo.srcObject = stream;
    await sampleVideo.play().catch(() => undefined);

    // Best-effort: if MediaPipe is unavailable, keep the camera and recording going.
    try {
      const vision = await import("./vision");
      await vision.loadVision();
      const target = sampleVideo;
      timer = window.setInterval(() => {
        const sample = vision.extractSample(target, performance.now());
        if (sample) samples.push(sample);
      }, SAMPLE_INTERVAL_MS);
    } catch (err) {
      console.warn("Nonverbal analysis is unavailable; continuing without it.", err);
    }
  }

  const release = () => {
    if (timer !== undefined) window.clearInterval(timer);
    if (ownVideo) {
      ownVideo.srcObject = null;
      ownVideo.remove();
      ownVideo = undefined;
    } else if (opts.sampleVideo) {
      opts.sampleVideo.srcObject = null;
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
