"""Piper sağlayıcısı — tamamen yerel/çevrimdışı TTS.

Model dosyaları tarayıcıdan değil, sunucu makinesindeki yerel klasörden yüklenir:
    models/piper/tr/tr_TR-dfki-medium.onnx
    models/piper/tr/tr_TR-dfki-medium.onnx.json
"""

import io
import os
import wave

from .base import TTSProvider, wav_duration

try:
    from piper import PiperVoice
except Exception:
    PiperVoice = None

MODELS_DIR = os.environ.get(
    "VMS_PIPER_MODELS",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "models", "piper", "tr",
    ),
)


def _espeak_data_dir():
    """espeak-ng verisinin yolu. Windows'ta espeak-ng C kütüphanesi ASCII
    olmayan yolları okuyamaz; kullanıcı adında Türkçe karakter varsa kısa
    (8.3) yol kullanılır."""
    try:
        import piper.phonemize_espeak as pe

        p = str(pe.ESPEAK_DATA_DIR)
        if p.isascii():
            return p
        import ctypes

        buf = ctypes.create_unicode_buffer(1024)
        n = ctypes.windll.kernel32.GetShortPathNameW(p, buf, 1024)
        if n:
            return buf.value
    except Exception:
        pass
    return None

# Bilinen ses adı -> cinsiyet (config dosyasında cinsiyet bilgisi yok)
_GENDER_HINT = {"dfki": "Kadın", "fahrettin": "Erkek", "atilla": "Erkek"}


class PiperProvider(TTSProvider):
    id = "piper"
    label = "Piper · Çevrimdışı"
    offline = True

    def available(self):
        if PiperVoice is None:
            return False, "piper-tts paketi kurulu değil (pip install piper-tts)"
        return True, None

    def _models(self):
        found = []
        if not os.path.isdir(MODELS_DIR):
            return found
        for name in sorted(os.listdir(MODELS_DIR)):
            if name.endswith(".onnx"):
                stem = name[: -len(".onnx")]
                cfg = stem + ".onnx.json"
                if os.path.exists(os.path.join(MODELS_DIR, cfg)):
                    found.append((stem, os.path.join(MODELS_DIR, name), os.path.join(MODELS_DIR, cfg)))
        return found

    def get_voices(self):
        ok, err = self.available()
        if not ok:
            return []
        voices = []
        for stem, _, _ in self._models():
            gender = "Belirsiz"
            for key, g in _GENDER_HINT.items():
                if key in stem:
                    gender = g
                    break
            voices.append(
                {
                    "id": self.id + ":" + stem,
                    "provider": self.id,
                    "name": stem,
                    "gender": gender,
                    "lang": "Türkçe",
                    "style": "Çevrimdışı · Yerel",
                    "offline": True,
                }
            )
        return voices

    def generate(self, text, voice_id):
        ok, err = self.available()
        if not ok:
            raise RuntimeError(f"Piper kullanılamıyor: {err}")
        stem = voice_id.split(":", 1)[1]
        models = {s: (m, c) for s, m, c in self._models()}
        if stem not in models:
            raise RuntimeError(f"Türkçe offline ses modeli bulunamadı: {stem}.onnx")
        model_path, _ = models[stem]
        voice = PiperVoice.load(model_path, espeak_data_dir=_espeak_data_dir())

        import numpy as np

        chunks = [c.audio_float_array for c in voice.synthesize(text)]
        audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
        pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(voice.config.sample_rate)
            wav_file.writeframes(pcm.tobytes())
        data = buf.getvalue()
        duration = wav_duration(data)
        if duration is None:
            duration = len(pcm) / voice.config.sample_rate
        return data, duration
