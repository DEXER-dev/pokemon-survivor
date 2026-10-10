"""Original deterministic wind/water synthesis; no sampled third-party recordings."""
import math
import random
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parents[1] / 'assets/audio/lugia-boss'


def render(name, duration, seed, kind):
    rng = random.Random(seed)
    low = band = phase = 0.0
    samples = []
    for i in range(round(RATE * duration)):
        t = i / RATE
        p = t / duration
        noise = rng.uniform(-1, 1)
        low += 0.045 * (noise - low)
        band += 0.24 * (noise - band)
        air = band - low
        attack = min(1, t / 0.022)
        fade = min(1, (duration - t) / 0.09)
        if kind == 'charge':
            env = math.sin(math.pi * p) ** 0.8
            freq = 130 + 230 * p
            signal = air * (0.45 + p) + low * 0.8
        elif kind == 'blast':
            env = attack * math.exp(-p * 3.4)
            freq = 180 - 115 * p
            signal = low * 3 + air * 0.8
        elif kind == 'tide':
            env = attack * math.sin(math.pi * p) ** 0.7
            freq = 72 + math.sin(p * math.pi) * 40
            bubbles = math.sin(2 * math.pi * (640 * t + 90 * t * t)) * math.exp(-p * 6)
            signal = low * 2.2 + air * 0.5 + bubbles * 0.13
        elif kind == 'sweep':
            env = attack * math.exp(-p * 5)
            freq = 760 - 580 * p
            signal = air * 1.3 + low * 0.5
        elif kind == 'cross':
            env = attack * math.exp(-p * 4)
            freq = 330 - 180 * p
            signal = air + low * 1.4 + math.sin(2 * math.pi * 510 * t) * 0.1
        else:
            env = attack * math.exp(-p * 4.5)
            freq = 480 - 320 * p
            signal = air + low * 0.9
        phase += 2 * math.pi * freq / RATE
        samples.append((signal + math.sin(phase) * 0.18) * env * fade)
    peak = max(abs(v) for v in samples)
    data = b''.join(struct.pack('<h', round(v / peak * 0.7 * 32767)) for v in samples)
    with tempfile.TemporaryDirectory(prefix='lugia-sfx-') as temp:
        source = Path(temp) / 'source.wav'
        with wave.open(str(source), 'wb') as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(RATE)
            wav.writeframes(data)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-c:a', 'libvorbis', '-q:a', '4', str(OUT / f'{name}.ogg')], check=True)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (name, duration, kind) in enumerate([
        ('charge', 0.75, 'charge'), ('aeroblast', 0.68, 'blast'),
        ('wing-gust', 0.32, 'gust'), ('tidal-ring', 1.1, 'tide'),
        ('wing-sweep', 0.20, 'sweep'), ('cross-current', 0.42, 'cross'),
        ('cross-reply', 0.36, 'gust'),
    ]):
        render(name, duration, 24900 + index, kind)
