"""Download the Kokoro voice model used for the interviewer's speech.

Run once after installing requirements:

    python scripts/fetch_tts_model.py

The files land in `models/` (gitignored, about 340 MB in total). Without them the
app still runs and the frontend falls back to the browser's built-in voices.
"""

import sys
import urllib.request
from pathlib import Path

RELEASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
FILES = {
    "kokoro-v1.0.onnx": f"{RELEASE}/kokoro-v1.0.onnx",
    "voices-v1.0.bin": f"{RELEASE}/voices-v1.0.bin",
}


def main() -> int:
    models = Path(__file__).resolve().parent.parent / "models"
    models.mkdir(exist_ok=True)

    for name, url in FILES.items():
        target = models / name
        if target.is_file():
            print(f"{name} already present, skipping.")
            continue
        print(f"Downloading {name}...", flush=True)
        try:
            urllib.request.urlretrieve(url, target)
        except Exception as exc:
            print(f"Could not download {name}: {exc}")
            return 1
        print(f"  saved to {target} ({target.stat().st_size / 1_000_000:.0f} MB)")

    print("Voice model ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
