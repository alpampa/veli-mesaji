"""Veli Mesajı Studio — TTS servisi testleri.

Çalıştırma:  python tests/server_test.py
Sağlayıcı bağımlılıkları kurulu değilse bile servis mantığı test edilir.
edge/piper canlı testleri: ses üretimi + GERÇEK kelime zamanlaması.
"""

import base64
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "server"))

from tts.base import wav_duration, TTSResult, split_sentences  # noqa: E402
from tts.service import health, get_voices, generate  # noqa: E402

TEST_TEXT = "Sayın velilerimiz, 25 Eylül Perşembe günü saat 14.30'da okulumuzda veli toplantısı yapılacaktır."


def make_wav(seconds=1.0, rate=22050):
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
        self.assertAlmostEqual(dur, 2.0, delta=0.05)

    def test_invalid_bytes(self):
        self.assertIsNone(wav_duration(b"not a wav at all"))


class TestBase(unittest.TestCase):
    def test_split_sentences(self):
        self.assertEqual(len(split_sentences("Bir. İki! Üç?")), 3)

    def test_ttsresult_shape(self):
        r = TTSResult(b"x", 1.5, words=[{"word": "a", "start": 0, "end": 0.5}], timing="word")
        d = r.to_dict()
        self.assertEqual(d["timing"], "word")
        self.assertEqual(len(d["words"]), 1)


class TestService(unittest.TestCase):
    def test_health_shape(self):
        h = health()
        self.assertTrue(h["ok"])
        ids = [p["id"] for p in h["providers"]]
        self.assertIn("edge", ids)
        self.assertIn("piper", ids)
        self.assertIn("windows", ids)

    def test_voices_never_crashes(self):
        voices = get_voices()
        for v in voices:
            self.assertTrue(v["id"].startswith(v["provider"] + ":"))

    def test_generate_unknown_voice(self):
        with self.assertRaises(KeyError):
            generate("test", "yok:boyle-bir-ses")


class TestLiveProviders(unittest.TestCase):
    """Gerçek sağlayıcılarla canlı testler (bağımlılık/model varsa)."""

    def _find_voice(self, provider):
        for v in get_voices():
            if v["provider"] == provider:
                return v
        return None

    def test_edge_sentence_timestamps(self):
        v = self._find_voice("edge")
        if not v:
            self.skipTest("edge-tts yok")
        result = generate(TEST_TEXT, v["id"])
        self.assertTrue(result.wav, "ses üretilmeli")
        self.assertEqual(result.timing, "sentence", "edge GERÇEK cümle zamanlaması vermeli")
        self.assertGreaterEqual(len(result.sentences), 1, "cümle sınırı olmalı")
        words = result.words
        self.assertGreater(len(words), 8, "kelime sayısı yeterli")
        joined = " ".join(w["word"].lower() for w in words)
        for key in ["sayın", "velilerimiz", "eylül", "perşembe", "toplantısı"]:
            self.assertIn(key, joined, f"{key} kelimesi zamanlamada olmalı")
        for i in range(1, len(words)):
            self.assertGreaterEqual(words[i]["start"], words[i - 1]["end"] - 0.05)
        self.assertLess(words[-1]["end"], result.duration + 1.0)
        # cümle sınırları gerçek: sıralı ve süre içinde
        for i in range(1, len(result.sentences)):
            self.assertGreaterEqual(result.sentences[i]["start"], result.sentences[i - 1]["end"] - 0.1)
        print(f"  edge: {len(words)} kelime, {len(result.sentences)} cümle, {result.duration:.1f} sn — timing={result.timing}")

    def test_piper_approx_words(self):
        v = self._find_voice("piper")
        if not v:
            self.skipTest("piper modeli yok")
        result = generate(TEST_TEXT, v["id"])
        self.assertTrue(result.wav[:4] == b"RIFF", "piper WAV üretmeli")
        self.assertEqual(result.timing, "approx")
        self.assertGreater(len(result.words), 5)
        joined = " ".join(w["word"].lower() for w in result.words)
        self.assertIn("toplantısı", joined)
        print(f"  piper: {len(result.words)} kelime, {result.duration:.1f} sn — timing={result.timing}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
