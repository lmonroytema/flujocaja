"""Une los segmentos .webm grabados en un solo MP4 (H.264 + narración AAC) y genera subtítulos .srt.

Uso: python -I ensamblar_video.py <carpeta video-demo>
Requiere el paquete imageio-ffmpeg (trae su propio ffmpeg).
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
SEG = ROOT / "runtime" / "segmentos"
FF = imageio_ffmpeg.get_ffmpeg_exe()
ORDER = ["00_intro", "01_admin", "02_finanzas", "03_directivo", "04_operaciones", "05_cierre"]
OUT = ROOT / "FlujoCaja_Demo_Perfiles.mp4"
FADE = 0.5


def duration(path):
    err = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    h, m, s = re.search(r"Duration: (\d+):(\d+):([\d.]+)", err).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


files = [SEG / f"{n}.webm" for n in ORDER]
durs = [duration(f) for f in files]

inputs, chains = [], []
for i, (f, d) in enumerate(zip(files, durs)):
    inputs += ["-i", str(f)]
    chains.append(
        f"[{i}:v]fps=30,crop=1600:900:0:0,setsar=1,format=yuv420p,"
        f"fade=t=in:st=0:d={FADE},fade=t=out:st={max(d - FADE, 0):.2f}:d={FADE}[v{i}]"
    )
graph = ";".join(chains) + ";" + "".join(f"[v{i}]" for i in range(len(files))) + f"concat=n={len(files)}:v=1:a=0[out]"
caps = json.loads((ROOT / "runtime" / "captions.json").read_text(encoding="utf-8"))
offsets = dict(zip(ORDER, [sum(durs[:i]) for i in range(len(durs))]))
ends = dict(zip(ORDER, [sum(durs[: i + 1]) for i in range(len(durs))]))



def detect_marks(path, fps=25):
    """Lee la franja inferior (6 px) de cada fotograma: 8 bloques blanco/negro = número de subtítulo.
    Devuelve {número: segundo del video en que aparece por primera vez}."""
    raw = subprocess.run([FF, "-loglevel", "error", "-i", str(path), "-vf", f"fps={fps},crop=1600:2:0:902",
                          "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 2, 1600)[:, 1, :]
    xs = [b * 80 + 20 for b in range(8)]
    found = {}
    for idx, row in enumerate(frames):
        n = sum(1 << b for b, x in enumerate(xs) if row[x] > 128)
        if n and n not in found:
            found[n] = idx / fps
    return found


marks = {name: detect_marks(f) for name, f in zip(ORDER, files)}

# Pista de narración: cada locución se coloca en el instante (del video) en que apareció su subtítulo
RATE = 24000
placed = []  # (segmento, inicio_en_segmento, clip)
shifted = []
track = np.zeros(int((sum(durs) + 1) * RATE), dtype=np.float32)
prev_end = {}
for c in caps:
    if c[0] not in offsets or len(c) < 4 or not c[3]:
        continue
    raw = subprocess.run([FF, "-loglevel", "error", "-i", c[3], "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
                         capture_output=True, check=True).stdout
    clip = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    t = marks[c[0]].get(c[4], c[1]) if len(c) > 4 else c[1]
    if t < prev_end.get(c[0], 0):  # nunca superponer dos locuciones
        shifted.append((c[0], round(prev_end[c[0]] - t, 2), c[2][:40]))
        t = prev_end[c[0]]
    prev_end[c[0]] = t + len(clip) / RATE + 0.2
    c[1] = t  # el .srt usa el mismo tiempo real
    start = int((offsets[c[0]] + t) * RATE)
    clip = clip[: max(len(track) - start, 0)]
    track[start:start + len(clip)] += clip
missing = [(c[0], c[4]) for c in caps if len(c) > 4 and c[4] not in marks.get(c[0], {})]
print("marcas no detectadas:", missing or "ninguna", "| locuciones desplazadas:", shifted or "ninguna")
overrun = {s: round(prev_end[s] - (ends[s] - offsets[s]), 1) for s in prev_end if prev_end[s] > ends[s] - offsets[s]}
print("locuciones que pasan el final del segmento:", overrun or "ninguna")
peak = float(np.abs(track).max() or 1)
wav = ROOT / "runtime" / "narracion.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes((np.clip(track / max(peak, 1.0) * 0.95, -1, 1) * 32767).astype(np.int16).tobytes())

subprocess.run([FF, "-y", "-loglevel", "error", *inputs, "-i", str(wav), "-filter_complex", graph,
                "-map", "[out]", "-map", f"{len(files)}:a", "-c:v", "libx264", "-preset", "medium", "-crf", "22",
                "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-shortest", "-movflags", "+faststart", str(OUT)], check=True)

# Subtítulos .srt a partir de los tiempos registrados durante la grabación
items = sorted(((offsets[c[0]] + c[1], c[0], c[2]) for c in caps if c[0] in offsets), key=lambda x: x[0])


def ts(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


lines = []
for k, (start, seg, txt) in enumerate(items):
    nxt = items[k + 1][0] if k + 1 < len(items) and items[k + 1][1] == seg else ends[seg]
    lines += [str(k + 1), f"{ts(start)} --> {ts(min(nxt, start + 8))}", txt.replace("[Título] ", ""), ""]
OUT.with_suffix(".srt").write_text("\n".join(lines), encoding="utf-8")

total = sum(durs)
print(f"OK {OUT.name}  {int(total // 60)}:{int(total % 60):02d}  segmentos: " +
      ", ".join(f"{n}={d:.0f}s" for n, d in zip(ORDER, durs)))
