"""TTS servisi — sağlayıcı kaydı, ses listesi ve üretim.

UI hiçbir zaman belirli bir sağlayıcıya bağımlı değildir; sesler ve üretim
buradaki provider listesi üzerinden yürür.
"""

from .base import TTSProvider
from .edge_provider import EdgeProvider
from .piper_provider import PiperProvider
from .windows_provider import WindowsProvider

PROVIDERS = [EdgeProvider(), PiperProvider(), WindowsProvider()]


def health():
    result = []
    for p in PROVIDERS:
        ok, err = p.available()
        result.append(
            {
                "id": p.id,
                "label": p.label,
                "offline": p.offline,
                "available": ok,
                "error": err if not ok else None,
            }
        )
    return {"ok": True, "providers": result}


def get_voices():
    voices = []
    for p in PROVIDERS:
        try:
            voices.extend(p.get_voices())
        except Exception as e:  # bir sağlayıcı bozulsa bile diğerleri çalışsın
            print(f"[tts] {p.id} ses listesi alınamadı: {e}")
    return voices


def generate(text, voice_id):
    """voice_id: 'provider:shortname' biçimindedir. TTSResult döner."""
    provider_part = voice_id.split(":", 1)[0]
    for p in PROVIDERS:
        if p.id == provider_part:
            ok, err = p.available()
            if not ok:
                raise RuntimeError(f"{p.label} kullanılamıyor: {err}")
            return p.generate(text, voice_id)
    raise KeyError(f"Bilinmeyen ses: {voice_id}")
