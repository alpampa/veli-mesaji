"""Veli Mesajı Studio — TTS servisi testleri.

Çalıştırma:  python tests/server_test.py
Not: Sağlayıcı bağımlılıkları (edge-tts, piper-tts, pyttsx3) kurulu değilse
bile servis mantığı (health, ses listesi, hata yolları) test edilir.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server"))

from tts.base import wav_duration  # noqa: E402
from tts.service import health, get_voices, generate  # noqa: E402


def make_wav(seconds=1.0, rate=22050):
    """Basit tek tonlu WAV üretir (test için)."""
    import math
    import struct

    n = int(seconds * rate)
    data = b"".join(struct.pack("<h", int(math.sin(2 * math.pi * 440 * i / rate) * 8000)) for i in range(n))
    byte_rate = rate * 2
    header = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, byte_rate, 2, 16)
    header += b"data" + struct.pack("<I", len(data))
    return header + data


class TestWavDuration(unittest.TestCase):
    def test_synthetic_wav(self):
        wav = make_wav(seconds=2.0, rate=22050)
        dur = wav_duration(wav)
        self.assertIsNotNone(dur)
        self.assertAlmostEqual(dur, 2.0, delta=0.05)

    def test_invalid_bytes(self):
        self.assertIsNone(wav_duration(b"not a wav at all"))


class TestService(unittest.TestCase):
    def test_health_shape(self):
        h = health()
        self.assertTrue(h["ok"])
        self.assertIsInstance(h["providers"], list)
        ids = [p["id"] for p in h["providers"]]
        self.assertIn("edge", ids)
        self.assertIn("piper", ids)
        self.assertIn("windows", ids)
        for p in h["providers"]:
            self.assertIn("available", p)
            self.assertIn("offline", p)
            self.assertIn("label", p)

    def test_get_voices_never_crashes(self):
        voices = get_voices()  # bağımlılıklar kurulu olmasa da liste döner
        self.assertIsInstance(voices, list)
        for v in voices:
            for key in ("id", "provider", "name", "gender", "lang", "style", "offline"):
                self.assertIn(key, v)
            self.assertTrue(v["id"].startswith(v["provider"] + ":"))

    def test_generate_unknown_voice(self):
        with self.assertRaises(KeyError):
            generate("test", "yok:boyle-bir-ses")

    def test_generate_empty_text(self):
        with self.assertRaises(Exception):
            generate("", "edge:tr-TR-EmelNeural")


if __name__ == "__main__":
    unittest.main(verbosity=2)
