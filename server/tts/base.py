"""TTSProvider tabanı.

Her sağlayıcı:
  id / label / offline
  available(): (bool, hata_mesajı)
  get_voices(): [voice sözlüğü]
  generate(text, voice_id) -> TTSResult

TTSResult:
  wav       : ses baytları (wav/mp3)
  duration  : saniye (float)
  words     : [{"word", "start", "end"}] saniye cinsinden kelime zamanlamaları
              (gerçek ya da yaklaşık; boş liste = yok)
  sentences : [{"text", "start", "end"}]
  timing    : "word" (gerçek kelime sınırı) | "approx" (fonem/oran tabanlı) | None
"""


class TTSResult:
    __slots__ = ("wav", "duration", "words", "sentences", "timing", "content_type")

    def __init__(self, wav, duration, words=None, sentences=None, timing=None, content_type="audio/wav"):
        self.wav = wav
        self.duration = duration
        self.words = words or []
        self.sentences = sentences or []
        self.timing = timing
        self.content_type = content_type

    def to_dict(self):
        return {
            "duration": round(self.duration, 3),
            "words": self.words,
            "sentences": self.sentences,
            "timing": self.timing,
        }


class TTSProvider:
    id = "base"
    label = "TTS"
    offline = False

    def available(self):
        return True, None

    def get_voices(self):
        return []

    def generate(self, text, voice_id):
        raise NotImplementedError


def wav_duration(wav_bytes):
    """RIFF/WAVE başlığından süreyi saniye olarak döndürür."""
    try:
        if wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
            return None
        pos = 12
        byte_rate = None
        while pos + 8 <= len(wav_bytes):
            chunk_id = wav_bytes[pos : pos + 4]
            size = int.from_bytes(wav_bytes[pos + 4 : pos + 8], "little")
            if chunk_id == b"fmt " and size >= 16:
                byte_rate = int.from_bytes(wav_bytes[pos + 16 : pos + 20], "little")
            elif chunk_id == b"data" and byte_rate:
                return size / byte_rate
            pos += 8 + size + (size % 2)
        return None
    except Exception:
        return None


def split_sentences(text):
    """Basit cümle bölmeleme (nokta/ünlem/soru + yeni satır)."""
    import re

    parts = re.split(r"(?<=[.!?…])\s+|\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]
