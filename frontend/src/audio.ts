// Record a spoken answer with MediaRecorder. The recorded audio is uploaded to
// the backend, which transcribes it and measures delivery (pace, pauses,
// fillers). Recording is feature-detected; callers fall back to typing.

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export interface Recorder {
  /** Stop recording and resolve the captured audio, releasing the microphone. */
  stop: () => Promise<Blob>;
  /** Abandon recording and release the microphone without producing audio. */
  cancel: () => void;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.start();

  const release = () => stream.getTracks().forEach((track) => track.stop());

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          release();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
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
