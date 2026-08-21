"""Edge-TTS sağlayıcısı — Microsoft'un doğal Türkçe sesleri (internet gerekir)."""

import io

from .base import TTSProvider

try:
    import edge_tts
except Exception:  # bağımlılık yoksa servis çökmez
    edge_tts = None


class EdgeProvider(TTSProvider):
    id = "edge"
    label = "Edge-TTS · İnternet"
    offline = False

    def available(self):
        if edge_tts is None:
            return False, "edge-tts paketi kurulu değil (pip install edge-tts)"
        return True, None

    def _display_name(self, voice_id):
        # tr-TR-EmelNeural -> "Emel"
        for part in voice_id.split("-"):
            if part.endswith("Neural"):
                return part[: -len("Neural")]
        return voice_id

    def get_voices(self):
        ok, err = self.available()
        if not ok:
            return []
        voices = []
        try:
            import asyncio

            raw = asyncio.run(edge_tts.list_voices())
            for v in raw:
                if not v.get("Locale", "").lower().startswith("tr"):
                    continue
                gender = v.get("Gender", "")
                voices.append(
                    {
                        "id": self.id + ":" + v["ShortName"],
                        "provider": self.id,
                        "name": self._display_name(v["ShortName"]),
                        "gender": "Kadın" if gender == "Female" else "Erkek" if gender == "Male" else "Belirsiz",
                        "lang": "Türkçe",
                        "style": "Doğal · Yapay zeka",
                        "offline": False,
                    }
                )
        except Exception:
            voices = []
        return voices

    def generate(self, text, voice_id):
        ok, err = self.available()
        if not ok:
            raise RuntimeError(f"Edge-TTS kullanılamıyor: {err}")
        import asyncio

        short_name = voice_id.split(":", 1)[1]
        buf = io.BytesIO()
        communicate = edge_tts.Communicate(text, short_name)
        asyncio.run(self._stream(communicate, buf))
        data = buf.getvalue()
        if not data:
            raise RuntimeError("Edge-TTS boş ses üretti")
        # 24 kHz MP3, 48 kbps -> saniyede 6000 bayt (yaklaşık)
        duration = len(data) / 6000.0
        return data, duration

    async def _stream(self, communicate, buf):
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
