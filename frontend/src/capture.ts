// Capture a spoken answer: always records audio (for server-side transcription),
// and when the webcam is on, also samples the video with MediaPipe to collect
// nonverbal signals. When the candidate opts in to saving the interview, a separate
// recorder also keeps a replay of the answer (video and audio when the camera is on,
// audio alone otherwise) which the app uploads for the length of the session so it
// can be reviewed and downloaded. Only audio and derived numbers leave the browser
// otherwise; the video is used in memory and its tracks are released on stop.
//
// The webcam analysis is best-effort: if MediaPipe cannot load (for example the
// models were not fetched), the camera and recording keep working, just without
// nonverbal metrics. Frames are sampled from the visible preview element, which
// decodes reliably across browsers (an offscreen element often does not on macOS).

import type { NonverbalSample } from "./api";

const SAMPLE_INTERVAL_MS = 125; // ~8 samples per second
const REPLAY_VIDEO_BITRATE = 1_100_000; // ~480p; keeps a full interview a modest download

export interface CaptureOptions {
  video: boolean;
  sampleVideo?: HTMLVideoElement | null;
  record?: boolean; // keep a replay the candidate can review and download
}

export interface Replay {
  blob: Blob;
  hasVideo: boolean;
}

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickVideoType(): string | undefined {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

function stopRecorder(recorder: MediaRecorder, chunks: BlobPart[], fallbackType: string): Promise<Blob> {
  return new Promise((resolve) => {
    const finish = () => resolve(new Blob(chunks, { type: recorder.mimeType || fallbackType }));
    if (recorder.state === "inactive") {
      finish();
      return;
    }
    recorder.onstop = finish;
    recorder.stop();
  });
}

export interface Capture {
  /** Live stream, for a webcam preview (empty of video when camera is off). */
  stream: MediaStream;
  /** Stop and resolve the recorded audio, any collected samples, and the replay. */
  stop: () => Promise<{ audioBlob: Blob; samples: NonverbalSample[]; replay: Replay | null }>;
  /** Abandon capture and release the microphone and camera. */
  cancel: () => void;
}

export async function startCapture(opts: CaptureOptions): Promise<Capture> {
  // Cap the camera to roughly 480p so a saved answer stays a reasonable size.
  const video = opts.video ? { width: { ideal: 640 }, height: { ideal: 480 } } : false;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
  try {
    return await setup(stream, opts);
  } catch (err) {
    // If any setup step fails after the stream is live (for example MediaRecorder is
    // unsupported), release the camera and microphone rather than leaking them.
    stream.getTracks().forEach((track) => track.stop());
    throw err;
  }
}

async function setup(stream: MediaStream, opts: CaptureOptions): Promise<Capture> {
  // The audio-only recorder always runs: it feeds transcription and, when the camera
  // is off, doubles as the replay.
  const recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();
  const startedAt = performance.now(); // to time nonverbal samples against the recording

  // When saving with the camera on, a second recorder keeps the video+audio replay.
  let videoRecorder: MediaRecorder | undefined;
  const videoChunks: BlobPart[] = [];
  if (opts.record && opts.video) {
    const type = pickVideoType();
    try {
      videoRecorder = new MediaRecorder(
        stream,
        type ? { mimeType: type, videoBitsPerSecond: REPLAY_VIDEO_BITRATE } : { videoBitsPerSecond: REPLAY_VIDEO_BITRATE },
      );
      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) videoChunks.push(event.data);
      };
      videoRecorder.start();
    } catch {
      videoRecorder = undefined; // fall back to an audio-only replay
    }
  }

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
        const now = performance.now();
        const sample = vision.extractSample(target, now);
        if (sample) {
          sample.t = (now - startedAt) / 1000; // seconds into the recording
          samples.push(sample);
        }
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
    stop: async () => {
      const audioBlob = await stopRecorder(recorder, chunks, "audio/webm");
      let replay: Replay | null = null;
      if (opts.record) {
        if (videoRecorder) {
          const blob = await stopRecorder(videoRecorder, videoChunks, "video/webm");
          replay = { blob, hasVideo: true };
        } else {
          replay = { blob: audioBlob, hasVideo: false };
        }
      }
      release();
      return { audioBlob, samples, replay };
    },
    cancel: () => {
      for (const rec of [recorder, videoRecorder]) {
        try {
          if (rec && rec.state !== "inactive") rec.stop();
        } catch {
          // already stopped
        }
      }
      release();
    },
  };
}
