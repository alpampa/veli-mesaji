"""TTSProvider tabanı.

Her sağlayıcı:
  id        : benzersiz sağlayıcı adı
  label     : UI'da gösterilen ad
  offline   : internet olmadan çalışıyor mu
  available(): (bool, hata_mesajı)
  get_voices(): [voice sözlüğü]
  generate(text, voice_id): (wav_bytes, süre_sn)
"""


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
