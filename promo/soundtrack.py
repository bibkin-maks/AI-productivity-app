"""Soundtrack for the promo, arranged to the edit and rendered with real instruments.

Instruments: GeneralUser GS SoundFont (free for commercial music) via TinySoundFont.
Effects/mastering: Spotify's Pedalboard. Tempo 109.09 BPM → two bars = 4.4 s = one scene,
so every cut lands on a downbeat. No noise sweeps: each cut gets its own musical transition,
and the arrangement adds a layer per scene instead of repeating one loop.

Setup (once):  python -m venv out/.audio-venv
               out/.audio-venv/Scripts/python -m pip install numpy tinysoundfont pedalboard
               curl -L -o out/GeneralUser-GS.sf2 https://github.com/mrbumpy409/GeneralUser-GS/raw/main/GeneralUser-GS.sf2
Usage:         out/.audio-venv/Scripts/python soundtrack.py  → out/soundtrack.wav
"""

import numpy as np
import tinysoundfont
from pedalboard import (Pedalboard, Chorus, Compressor, Delay, HighShelfFilter, HighpassFilter,
                        LadderFilter, Limiter, LowpassFilter, Reverb)
from pedalboard.io import AudioFile

SR = 48000
DUR = 30.0
N = int(SR * DUR)
BEAT = 60 / 109.0909
S16 = BEAT / 4
BAR = 4 * BEAT
FIRST_BAR = -0.2                   # bars start at -0.2, 2.0, 4.2, 6.4 …
DROP = 4.2
SCENES = [4.2, 8.6, 13.0, 17.4, 21.8]
OUTRO = 26.2
FINAL = 28.4                       # last bar: final chord rings out
SF2 = "out/GeneralUser-GS.sf2"


def bar_start(k):
    return FIRST_BAR + k * BAR


def bar_index(t):
    return int(np.floor((t - FIRST_BAR) / BAR + 1e-6))


# ---------- harmony ----------
VOICING = {
    "Am": [57, 60, 64, 67], "F": [53, 57, 60, 64], "C": [55, 60, 64, 71], "G": [55, 59, 62, 69],
    "Esus": [52, 57, 59, 64],
}
ROOT = {"Am": 33, "F": 29, "C": 36, "G": 31, "Esus": 28}


def chord_of_bar(k):
    t = bar_start(k)
    if t < DROP - 1e-6:
        return "F" if k == 0 else "Esus"            # intro: lift, then suspense into the drop
    if t >= FINAL - 1e-6:
        return "Am"
    if t >= OUTRO - 1e-6:
        return "G"
    return ["Am", "F", "C", "G"][(bar_index(t) - bar_index(DROP)) % 4]


BARS = list(range(bar_index(0.0), bar_index(DUR) + 1))

# ---------- rendering with the SoundFont ----------
_synth_cache = {}


def render(bank, preset, notes, drums=False, gain_db=0.0, tail=2.5):
    """notes: list of (time_s, dur_s, key, velocity). Returns (N, 2) float32."""
    synth = tinysoundfont.Synth(samplerate=SR, gain=gain_db)
    sfid = synth.sfload(SF2)
    chan = 9 if drums else 0
    synth.program_select(chan, sfid, bank, preset, drums)
    events = []
    for t, d, key, vel in notes:
        events.append((max(t, 0.0), 1, key, int(np.clip(vel, 1, 127))))
        events.append((max(t + d, 0.0), 0, key, 0))
    events.sort(key=lambda e: (e[0], e[1]))
    total = N + int(tail * SR)
    out = np.zeros((total, 2), dtype=np.float32)
    pos = 0
    for t, on, key, vel in events:
        idx = min(int(round(t * SR)), total)
        if idx > pos:
            out[pos:idx] = np.frombuffer(synth.generate(idx - pos), dtype=np.float32).reshape(-1, 2)
            pos = idx
        (synth.noteon(chan, key, vel) if on else synth.noteoff(chan, key))
    if pos < total:
        out[pos:] = np.frombuffer(synth.generate(total - pos), dtype=np.float32).reshape(-1, 2)
    return out[:N]


def fx(audio, *plugins):
    return Pedalboard(list(plugins))(audio.T.copy(), SR).T


def automate_ladder(audio, cutoff_fn, resonance=0.15):
    """Moog-style low-pass whose cutoff follows cutoff_fn(t)."""
    flt = LadderFilter(mode=LadderFilter.Mode.LPF24, cutoff_hz=1000, resonance=resonance, drive=1.0)
    x = audio.T.copy()
    out = np.zeros_like(x)
    block = 512
    for i in range(0, x.shape[1], block):
        flt.cutoff_hz = float(np.clip(cutoff_fn(i / SR), 60, 18000))
        out[:, i:i + block] = flt.process(x[:, i:i + block], SR, reset=False)
    return out.T


def db(v):
    return 10 ** (v / 20)


# ---------- drums (Dance kit) ----------
KICK, SNARE, CLAP, HAT, OHAT, TOM_L, TOM_M, TOM_H, CRASH, SPLASH, SHAKER = 36, 38, 39, 42, 46, 45, 47, 50, 49, 55, 82
kick, clap, hats, shaker, perc, cymbals = [], [], [], [], [], []
kick_times = []

for k in BARS:
    t0 = bar_start(k)
    if not (DROP - 1e-6 <= t0 < FINAL - 1e-6):
        continue
    scene = next((i for i, s in reversed(list(enumerate(SCENES))) if t0 >= s - 1e-6), 5)
    for b in range(4):
        tb = t0 + b * BEAT
        # one-beat drum break right before the diary scene (17.4)
        if abs((tb + BEAT) - 17.4) < 1e-3:
            continue
        kick.append((tb, 0.2, KICK, 118 if b == 0 else 104))
        kick_times.append(tb)
        if b in (1, 3):
            clap.append((tb, 0.2, CLAP, 92))
            if scene >= 3:
                clap.append((tb, 0.2, SNARE, 58))
        for s in range(4):
            ts = tb + s * S16
            if s == 2:
                hats.append((ts, 0.15, OHAT if scene >= 1 else HAT, 66 if scene >= 1 else 70))
            elif s == 0:
                hats.append((ts, 0.05, HAT, 54))
            elif scene >= 2:
                hats.append((ts, 0.05, HAT, 34))
        if scene >= 2:
            for s in range(4):
                shaker.append((tb + s * S16, 0.05, SHAKER, 42 + 18 * (s % 2)))

# intro build: soft kick on the last intro bar, snare crescendo into the drop
for b in range(4):
    kick.append((2.0 + b * BEAT, 0.2, KICK, 70 + b * 8))
    kick_times.append(2.0 + b * BEAT)
roll_t = 2.0 + 2 * BEAT
while roll_t < DROP - 0.02:
    frac = (roll_t - 3.1) / (DROP - 3.1)
    step = S16 if frac > 0.5 else BEAT / 2
    perc.append((roll_t, 0.1, SNARE, int(40 + 70 * frac)))
    roll_t += step
# tom fill into notes (8.6): last two beats, 8ths descending
for i, key in enumerate([TOM_H, TOM_H, TOM_M, TOM_M]):
    perc.append((8.6 - 2 * BEAT + i * BEAT / 2, 0.2, key, 80 + i * 8))
# snare build into the outro: last bar, 8ths then 16ths
t = OUTRO - BAR
while t < OUTRO - 0.02:
    frac = (t - (OUTRO - BAR)) / BAR
    perc.append((t, 0.1, SNARE, int(45 + 60 * frac)))
    t += S16 if frac > 0.5 else BEAT / 2
# final hit
kick.append((FINAL, 0.3, KICK, 120))
kick_times.append(FINAL)

# cymbals on cuts (splash on the gentler Purr cut)
for t in (DROP, 8.6, 13.0, 17.4, OUTRO, FINAL):
    cymbals.append((t, 1.5, CRASH, 84 if t in (DROP, OUTRO, FINAL) else 70))
cymbals.append((21.8, 1.0, SPLASH, 64))

drum_kit = (128, 26)
st_kick = render(*drum_kit, kick, drums=True)
st_clap = render(*drum_kit, clap, drums=True)
st_hats = render(*drum_kit, hats, drums=True)
st_shaker = render(*drum_kit, shaker, drums=True)
st_perc = render(*drum_kit, perc, drums=True)
st_cym = render(*drum_kit, cymbals, drums=True)

# reversed crash swelling into the drop (the only "riser")
rev = render(*drum_kit, [(0.0, 3.0, CRASH, 110)], drums=True)[: int(2.6 * SR)][::-1].copy()
rev = fx(rev, LowpassFilter(7000), Reverb(room_size=0.6, wet_level=0.3, dry_level=0.8))
rev *= np.linspace(0, 1, len(rev))[:, None] ** 2
st_rev = np.zeros((N, 2), np.float32)
i0 = int(DROP * SR) - len(rev)
st_rev[i0:int(DROP * SR)] = rev

# ---------- sidechain envelope from the kick ----------
duck = np.ones(N)
for t in kick_times:
    i = int(t * SR)
    n = min(N - i, int(0.3 * SR))
    if n > 0:
        duck[i:i + n] = np.minimum(duck[i:i + n], 1 - np.exp(-np.arange(n) / SR / 0.075) * 0.9)
duck = np.convolve(duck, np.ones(96) / 96, mode="same")      # soften the edge
side = lambda depth: (1 - depth + depth * duck)[:, None]

# ---------- bass: syncopated 8ths, octave bounce ----------
bass = []
for k in BARS:
    t0 = bar_start(k)
    if not (DROP - 1e-6 <= t0 < FINAL - 1e-6):
        continue
    r = ROOT[chord_of_bar(k)] + 12
    scene = next((i for i, s in reversed(list(enumerate(SCENES))) if t0 >= s - 1e-6), 5)
    pattern = [0, 0, 12, 0, 0, 12, 0, 7] if scene >= 2 else [0, 0, 12, 0, 0, 0, 12, 0]
    for e, iv in enumerate(pattern):
        tb = t0 + e * BEAT / 2
        if abs(tb + BEAT - 17.4) < BEAT / 2 + 1e-3 and tb < 17.4:   # bass sits out the drum break too
            continue
        bass.append((tb, BEAT / 2 * 0.8, r + iv, 100 if e % 2 == 0 else 84))
bass.append((FINAL, 1.6, ROOT["Am"] + 12, 105))
st_bass = render(0, 38, bass)
st_bass = fx(st_bass, HighpassFilter(35), LowpassFilter(1800), Compressor(threshold_db=-18, ratio=4, attack_ms=5, release_ms=80))

# ---------- pad: warm chords every bar, choir joins for Purr ----------
pad, choir = [], []
for k in BARS:
    t0 = max(bar_start(k), 0.0)
    ch = VOICING[chord_of_bar(k)]
    length = (DUR - t0) if bar_start(k) >= FINAL - 1e-6 else BAR - 0.02 - (t0 - bar_start(k))
    for key in ch:
        pad.append((t0, length, key, 70 if t0 < DROP else 64))
    if 21.8 - 1e-6 <= bar_start(k) < OUTRO - 1e-6 or bar_start(k) >= FINAL - 1e-6:
        for key in ch[:3]:
            choir.append((t0, length, key + 12, 60))
st_pad = render(0, 89, pad)                                   # Warm Pad
st_pad = automate_ladder(st_pad, lambda t: 500 + 5500 * np.clip(t / DROP, 0, 1) ** 2 if t < DROP else
                         (1500 if 12.45 <= t < 13.0 else 6000))
st_pad = fx(st_pad, HighpassFilter(140), Chorus(rate_hz=0.4, depth=0.3, mix=0.4),
            Reverb(room_size=0.85, damping=0.5, wet_level=0.35, dry_level=0.75, width=1.0))
st_choir = fx(render(0, 52, choir), HighpassFilter(200), LowpassFilter(6000),
              Reverb(room_size=0.9, wet_level=0.45, dry_level=0.6))

# reversed pad swell into the Purr scene
swell_src = render(0, 89, [(0.0, 1.6, key, 90) for key in VOICING["Am"]])[: int(2.2 * SR)]
swell = fx(swell_src, Reverb(room_size=0.95, wet_level=1.0, dry_level=0.0))[::-1].copy()
swell = swell[-int(1.6 * SR):] * np.linspace(0, 1, int(1.6 * SR))[:, None] ** 1.5
st_swell = np.zeros((N, 2), np.float32)
st_swell[int(21.8 * SR) - len(swell):int(21.8 * SR)] = swell

# ---------- arpeggio: 16th plucks, filter opens through the intro ----------
arp = []
for k in BARS:
    t0 = bar_start(k)
    ch = VOICING[chord_of_bar(k)]
    shape = [ch[0], ch[1], ch[2], ch[3], ch[2] + 12, ch[3], ch[1] + 12, ch[2]]
    for s in range(16):
        ts = t0 + s * S16
        if ts < 2.0 - 1e-6 or ts >= FINAL - 1e-6:
            continue
        arp.append((ts, S16 * 0.9, shape[s % 8] + 12, 88 if s % 4 == 0 else 66))
st_arp = render(0, 90, arp)                                   # Polysynth pluck
st_arp = automate_ladder(st_arp, lambda t: (300 * (18 ** np.clip((t - 2.0) / (DROP - 2.0), 0, 1))) if t < DROP else
                         (900 if 12.45 <= t < 13.0 else 5400), resonance=0.3)
st_arp = fx(st_arp, HighpassFilter(250), Delay(delay_seconds=BEAT * 0.75, feedback=0.28, mix=0.22),
            Reverb(room_size=0.5, wet_level=0.18, dry_level=0.9, width=0.9))

# ---------- lead hook (from the notes scene), vibraphone for Purr ----------
HOOK = {   # (8th step, midi, length in 8ths) — sung over each chord
    "Am": [(0, 76, 2), (3, 74, 1), (4, 72, 2), (6, 69, 2)],
    "F": [(0, 72, 2), (3, 74, 1), (4, 76, 3), (7, 72, 1)],
    "C": [(0, 79, 2), (3, 76, 1), (4, 74, 2), (6, 72, 2)],
    "G": [(0, 74, 3), (3, 71, 1), (4, 74, 2), (6, 76, 2)],
}
lead, vibes = [], []
for k in BARS:
    t0 = bar_start(k)
    if not (8.6 - 1e-6 <= t0 < FINAL - 1e-6):
        continue
    target = vibes if 21.8 - 1e-6 <= t0 < OUTRO - 1e-6 else lead
    for step, key, ln in HOOK[chord_of_bar(k)]:
        target.append((t0 + step * BEAT / 2, ln * BEAT / 2 * 0.95, key, 96 if step == 0 else 84))
lead.append((FINAL, 1.8, 81, 100))
st_lead = render(0, 81, lead)                                 # Saw Lead, tamed below
st_lead = fx(st_lead, HighpassFilter(300), LowpassFilter(4200), Chorus(rate_hz=0.8, depth=0.2, mix=0.3),
             Delay(delay_seconds=BEAT, feedback=0.25, mix=0.18), Reverb(room_size=0.6, wet_level=0.25, dry_level=0.85))
st_vibes = fx(render(0, 11, vibes), Delay(delay_seconds=BEAT * 0.75, feedback=0.3, mix=0.25),
              Reverb(room_size=0.7, wet_level=0.3, dry_level=0.85))

# strings lift the diary scene and the outro
strings = []
for k in BARS:
    t0 = bar_start(k)
    if 17.4 - 1e-6 <= t0 < 21.8 - 1e-6 or t0 >= OUTRO - 1e-6:
        length = (DUR - t0) if t0 >= FINAL - 1e-6 else BAR - 0.02
        for key in VOICING[chord_of_bar(k)]:
            strings.append((t0, length, key + 12 if key < 60 else key, 72))
st_strings = fx(render(0, 49, strings), HighpassFilter(220), Reverb(room_size=0.8, wet_level=0.3, dry_level=0.8))

# ---------- accents on the animations: soft mallets in key ----------
accents = []
# intro headline lines, lead line
for t, key in ((0.45, 76), (0.77, 79), (1.09, 81)):
    accents.append((t, 0.8, key, 76))
accents.append((1.9, 1.2, 69, 60))
# feature chips pop at s+1.75 / s+2.05 → nearest 16ths (13th and 15th)
CHIP_NOTES = [(76, 81), (79, 84), (76, 81), (79, 83), (81, 88)]
for s, (a, b) in zip(SCENES, CHIP_NOTES):
    accents.append((s + 13 * S16, 0.5, a, 70))
    accents.append((s + 15 * S16, 0.6, b, 74))
st_marimba = fx(render(0, 12, accents), Reverb(room_size=0.5, wet_level=0.25, dry_level=0.9))

# ASCII logo decodes outward (26.3–27.1): arpeggio rising with the wave
outro_notes = [(26.3 + i * 0.12, 0.9, key, 60 + i * 4) for i, key in enumerate((69, 72, 76, 79, 81, 84, 88))]
# wordmark: first and last letters lock in; final hit types the prompt; stack line; eye blink
outro_notes += [(27.5, 0.8, 76, 62), (27.5, 0.8, 81, 56), (27.92, 1.0, 88, 60),
                (28.4, 1.6, 81, 80), (28.4, 1.6, 88, 60), (29.05, 1.0, 93, 44)]
st_blink = render(0, 12, [(29.42, 0.3, 96, 46)])
st_outro = fx(render(0, 11, outro_notes), Delay(delay_seconds=BEAT * 0.5, feedback=0.25, mix=0.2),
              Reverb(room_size=0.85, wet_level=0.35, dry_level=0.8))

# ---------- mix ----------
def level(stem, target_dbfs):
    """Scale a stem so its loudness *while playing* hits target_dbfs (RMS)."""
    mono = np.abs(stem).mean(axis=1)
    win = int(0.05 * SR)
    env_ = np.convolve(mono, np.ones(win) / win, mode="same")
    active = env_ > env_.max() * 0.05
    if not active.any():
        return stem
    rms = np.sqrt((stem[active] ** 2).mean())
    return stem * (db(target_dbfs) / max(rms, 1e-9))


drum_bus = (level(st_kick, -13) + level(st_clap, -20) + level(st_hats, -29) + level(st_shaker, -32)
            + level(st_perc, -22) + level(st_cym, -28) + level(st_rev, -24))
drum_bus = fx(drum_bus, LowpassFilter(10500), HighShelfFilter(cutoff_frequency_hz=6000, gain_db=-3.0),
              Compressor(threshold_db=-14, ratio=2.5, attack_ms=8, release_ms=120))

music = (level(st_bass, -16) * side(0.75)
         + level(st_pad, -24) * side(0.55)
         + level(st_choir, -27) * side(0.4)
         + level(st_swell, -24)
         + level(st_arp, -25) * side(0.4)
         + level(st_lead, -21) * side(0.25)
         + level(st_vibes, -22)
         + level(st_strings, -26) * side(0.35)
         + level(st_marimba, -23)
         + level(st_outro, -21)
         + level(st_blink, -30))

mix = (drum_bus + music).astype(np.float32)
mix *= np.minimum(1, (N - np.arange(N)) / (0.9 * SR))[:, None] ** 1.5      # tail fade
mix = fx(mix, HighpassFilter(28), HighShelfFilter(cutoff_frequency_hz=9000, gain_db=-2.0),
         Compressor(threshold_db=-16, ratio=2.0, attack_ms=15, release_ms=150),
         Limiter(threshold_db=-2.0, release_ms=120))
mix *= db(-1.0) / max(1e-9, np.max(np.abs(mix)))

with AudioFile("out/soundtrack.wav", "w", SR, 2) as f:
    f.write(mix.T.astype(np.float32))
print("wrote out/soundtrack.wav")
if __import__("os").environ.get("STEMS"):
    for name, st in [("kick", st_kick), ("clap", st_clap), ("hats", st_hats), ("shaker", st_shaker), ("perc", st_perc),
                     ("cymbals", st_cym), ("rev crash", st_rev), ("bass", st_bass), ("pad", st_pad), ("choir", st_choir),
                     ("swell", st_swell), ("arp", st_arp), ("lead", st_lead), ("vibes", st_vibes), ("strings", st_strings),
                     ("marimba", st_marimba), ("outro", st_outro)]:
        print(f"  {name:10s} peak {20*np.log10(np.max(np.abs(st))+1e-12):6.1f} dB")
