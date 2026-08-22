"""Edge-TTS sağlayıcısı — Microsoft'un doğal Türkçe sesleri (internet gerekir).

Sesin yanı sıra WordBoundary olaylarından GERÇEK kelime zamanlamaları üretir
(offset birimi 100 ns → saniye = offset / 1e7).
"""

import io
import re

from .base import TTSProvider, TTSResult, split_sentences

try:
    import edge_tts
except Exception:  # bağımlılık yoksa servis çökmez
    edge_tts = None

_NS = 1e7  # 100ns birimi -> saniye


def _tokenize(text):
    """Kelime tokenları: "14.30'da" gibi sayı+ek yapılarını korur."""
    import re as _re

    return _re.findall(r"\d+[.:]?\d*|[\wçğıöşüÇĞİÖŞÜ]+(?:['’][\wçğıöşüÇĞİÖŞÜ]+)*", text)


def _spread_tokens(tokens, start, end):
    """Token'ları [start,end] aralığına karakter sayısıyla orantılı dağıtır."""
    if not tokens:
        return []
    dur = max(0.05, end - start)
    weights = [max(1, len(t)) for t in tokens]
    total = sum(weights)
    words = []
    t = start
    for tok, wt in zip(tokens, weights):
        d = dur * wt / total
        words.append({"word": tok, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return words


class EdgeProvider(TTSProvider):
    id = "edge"
    label = "Edge-TTS · İnternet"
    offline = False

    def available(self):
        if edge_tts is None:
            return False, "edge-tts paketi kurulu değil (pip install edge-tts)"
        return True, None

    def _display_name(self, voice_id):
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
        sentence_bounds = []

        async def _stream():
            communicate = edge_tts.Communicate(text, short_name)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
                elif chunk["type"] == "SentenceBoundary":
                    sentence_bounds.append(
                        {
                            "text": chunk.get("text", ""),
                            "start": chunk.get("offset", 0) / _NS,
                            "end": (chunk.get("offset", 0) + chunk.get("duration", 0)) / _NS,
                        }
                    )

        asyncio.run(_stream())
        data = buf.getvalue()
        if not data:
            raise RuntimeError("Edge-TTS boş ses üretti")
        # 24 kHz MP3, 48 kbps -> saniyede 6000 bayt (yaklaşık)
        duration = len(data) / 6000.0

        sentences, words, timing = self._timings(text, sentence_bounds, duration)
        return TTSResult(
            wav=data,
            duration=duration,
            words=words,
            sentences=sentences,
            timing=timing,
            content_type="audio/mpeg",
        )

    @staticmethod
    def _timings(text, sentence_bounds, duration):
        """SentenceBoundary (gerçek) + cümle içi kelime dağılımı (orantılı)."""
        if not sentence_bounds:
            # yedek: toplam süreye orantılı
            tokens = _tokenize(text)
            words = _spread_tokens(tokens, 0.0, duration)
            sentences = [{"text": s, "start": 0.0, "end": duration} for s in split_sentences(text)]
            return sentences, words, "approx"

        sentences = []
        words = []
        for b in sentence_bounds:
            s_text = b["text"].strip()
            if not s_text:
                continue
            start = max(0.0, b["start"])
            end = min(duration, max(start + 0.05, b["end"]))
            sentences.append({"text": s_text, "start": round(start, 3), "end": round(end, 3)})
            tokens = _tokenize(s_text)
            words.extend(_spread_tokens(tokens, start, end))
        if not sentences:
            sentences = [{"text": s, "start": 0.0, "end": duration} for s in split_sentences(text)]
        return sentences, words, "sentence" if sentences else None

    @staticmethod
    def _clean_words(bounds, duration):
        """Eski WordBoundary yolu (yedek) — boş/noktalama temizler."""
        out = []
        for b in bounds:
            w = re.sub(r"[^\wçğıöşüÇĞİÖŞÜ]+", "", b.get("word", ""), flags=re.UNICODE)
            if not w:
                continue
            start = max(0.0, b.get("start", 0))
            end = min(duration, max(start, b.get("end", start)))
            if out and start < out[-1]["end"]:
                continue
            out.append({"word": w, "start": round(start, 3), "end": round(end, 3)})
        return out
