"""Generate the original level-up UI chimes as small mono Vorbis assets."""
from __future__ import annotations

import math
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "audio"
RATE = 44100


def render(name: str, duration: float, tones: list[tuple[float, float, float, float]]) -> None:
    """Render (frequency, start, length, gain) bell partials into one WAV and encode it."""
    count = round(duration * RATE)
    data = [0.0] * count
    for frequency, start, length, gain in tones:
        first = round(start * RATE)
        last = min(count, round((start + length) * RATE))
        for frame in range(first, last):
            t = (frame - first) / RATE
            attack = min(1.0, t / 0.004)
            envelope = attack * math.exp(-t * 9.5)
            fundamental = math.sin(2 * math.pi * frequency * t)
            overtone = 0.30 * math.sin(2 * math.pi * frequency * 2.01 * t + 0.12)
            shimmer = 0.10 * math.sin(2 * math.pi * frequency * 3.96 * t + 0.31)
            data[frame] += gain * envelope * (fundamental + overtone + shimmer)

    peak = max((abs(sample) for sample in data), default=1.0)
    if peak > 0:
        data = [sample * (0.76 / peak) for sample in data]

    with tempfile.TemporaryDirectory(prefix="upgrade-sfx-") as temp:
        wav_path = Path(temp) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(b"".join(struct.pack("<h", round(sample * 32767)) for sample in data))
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav_path),
            "-c:a", "libvorbis", "-q:a", "4", str(OUT / f"{name}.ogg"),
        ], check=True)


def main() -> None:
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required to encode the generated UI cues")
    OUT.mkdir(parents=True, exist_ok=True)
    # A three-note rise tracks the cards' left-to-right staggered entrance.
    render("ui-upgrade-appear", 0.43, [
        (659.25, 0.000, 0.34, 0.58),
        (880.00, 0.075, 0.31, 0.50),
        (1174.66, 0.150, 0.27, 0.44),
    ])
    # A short, soft pluck; repeated focus changes are separately rate-limited in the game.
    render("ui-upgrade-focus", 0.095, [
        (1046.50, 0.000, 0.080, 0.60),
        (2093.00, 0.000, 0.055, 0.18),
    ])
    # A warm D-major confirmation with a small high sparkle.
    render("ui-upgrade-confirm", 0.39, [
        (587.33, 0.000, 0.34, 0.43),
        (739.99, 0.012, 0.32, 0.40),
        (880.00, 0.026, 0.30, 0.36),
        (1760.00, 0.045, 0.23, 0.20),
    ])
    # A gentle downward release marks the end of the card's exit animation.
    render("ui-upgrade-dismiss", 0.30, [
        (1174.66, 0.000, 0.24, 0.40),
        (880.00, 0.055, 0.22, 0.35),
        (587.33, 0.110, 0.17, 0.32),
    ])
    print("Generated four level-up UI sound cues in", OUT)


if __name__ == "__main__":
    main()
