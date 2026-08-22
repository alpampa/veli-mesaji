#!/usr/bin/env python3
"""Veli Mesajı Studio — TTS mikro servisi (yalnızca standart kütüphane).

Kullanım:
    pip install -r server/requirements.txt
    python server/server.py                 # http://127.0.0.1:8765
    python server/server.py --port 9000     # farklı port

Uç noktalar:
    GET  /api/health        sağlayıcı durumu
    GET  /api/voices        kullanılabilir sesler (alias: /api/tts/voices)
    POST /api/tts           metni seslendirir
                            → JSON: { wavBase64, duration, words[], sentences[], timing }
    /                       istenirse ön yüzü de sunar (tek servis / aynı kaynak)

Güvenlik (env):
    VMS_ALLOWED_ORIGINS    virgülle ayrılmış izinli kökenler (boşsa "*")
                           ör: VMS_ALLOWED_ORIGINS=https://alpampa.github.io
    VMS_API_KEY            belirlenirse tüm /api isteklerinde X-API-Key zorunlu
    VMS_PIPER_MODELS       Piper model klasörü (varsayılan: models/piper/tr)

Production (HTTPS): arkasına Caddy/Cloudflare/Nginx proxy koyun; ön yüz
GitHub Pages'te kalır, bu servis ayrı HTTPS adresinde çalışır. API anahtarı
yalnızca sunucuda tanımlanır, frontend JavaScript'ine gömülmez.
"""

import argparse
import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tts.service import generate, get_voices, health  # noqa: E402

STATIC_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # proje kökü
MAX_BODY = 4 * 1024 * 1024

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("VMS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
API_KEY = os.environ.get("VMS_API_KEY", "").strip()


class Handler(BaseHTTPRequestHandler):
    server_version = "VeliMesajiTTS/2.0"

    # ---------- yardımcılar ----------
    def _origin_allowed(self):
        origin = self.headers.get("Origin", "")
        if not ALLOWED_ORIGINS:
            return "*"
        return origin if origin in ALLOWED_ORIGINS else ""

    def _cors(self):
        allow = self._origin_allowed()
        if allow:
            self.send_header("Access-Control-Allow-Origin", allow)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        # Private Network Access: https'teki ön yüzün http://127.0.0.1'e
        # istek atabilmesi için preflight yanıtında gerekli (Chrome 130+)
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Vary", "Origin")

    def _check_api_key(self):
        if not API_KEY:
            return True
        return self.headers.get("X-API-Key", "") == API_KEY

    def _json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _error(self, message, status=500, code=None):
        self._json({"error": message, "code": code or "unknown"}, status=status)

    def log_message(self, fmt, *args):
        print(f"[http] {self.address_string()} {fmt % args}")

    # ---------- rotalar ----------
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if not self._check_api_key():
            return self._error("Erişim reddedildi: X-API-Key gerekli", 401, "unauthorized")
        path = urlparse(self.path).path
        if path == "/api/health":
            return self._json(health())
        if path in ("/api/tts/voices", "/api/voices"):
            try:
                return self._json({"voices": get_voices()})
            except Exception as e:
                return self._error(str(e), 500, "voices_failed")
        return self._serve_static(path)

    def do_POST(self):
        if not self._check_api_key():
            return self._error("Erişim reddedildi: X-API-Key gerekli", 401, "unauthorized")
        path = urlparse(self.path).path
        if path != "/api/tts":
            return self._error("Bulunamadı", 404, "not_found")
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length > MAX_BODY:
                return self._error("İstek çok büyük", 413, "too_large")
            body = json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        except Exception:
            return self._error("Geçersiz JSON gövdesi", 400, "bad_json")

        text = str(body.get("text") or "").strip()
        voice = str(body.get("voice") or "").strip()
        if not text:
            return self._error("text alanı boş", 400, "no_text")
        if not voice:
            return self._error("voice alanı boş", 400, "no_voice")

        print(f"[tts] istek: voice={voice} kelime={len(text.split())}")
        try:
            result = generate(text, voice)
        except KeyError as e:
            return self._error(str(e), 404, "voice_not_found")
        except RuntimeError as e:
            print(f"[tts] HATA voice={voice}: {e}")
            return self._error(str(e), 502, "provider_failed")
        except Exception as e:
            import traceback

            traceback.print_exc()
            return self._error(f"Beklenmeyen hata: {e}", 500, "internal")

        payload = result.to_dict()
        payload["provider"] = voice.split(":", 1)[0]
        payload["contentType"] = result.content_type
        payload["wavBase64"] = base64.b64encode(result.wav).decode("ascii")
        self._json(payload)
        print(f"[tts] tamam: {result.duration:.1f} sn, {len(result.wav) / 1024:.0f} KB, "
              f"kelime={len(result.words)}, timing={result.timing}")

    # ---------- statik ----------
    def _serve_static(self, path):
        if not path or path == "/":
            path = "/index.html"
        rel = os.path.normpath(path.lstrip("/"))
        full = os.path.realpath(os.path.join(STATIC_ROOT, rel))
        if not full.startswith(os.path.realpath(STATIC_ROOT)) or not os.path.isfile(full):
            return self._error("Bulunamadı", 404, "not_found")
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".mjs": "text/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".webp": "image/webp",
            ".mp4": "video/mp4",
            ".wav": "audio/wav",
            ".onnx": "application/octet-stream",
        }.get(os.path.splitext(full)[1].lower(), "application/octet-stream")
        try:
            with open(full, "rb") as f:
                data = f.read()
        except OSError:
            return self._error("Okunamadı", 500, "read_failed")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)


def main():
    # Windows konsolunda emoji/Türkçe çıktı için UTF-8 + satır tamponlama
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="Veli Mesajı Studio TTS servisi")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    print("=" * 60)
    print("  🎬 VELİ MESAJI STUDIO — TTS servisi (v2, word timestamps)")
    print(f"  http://{args.host}:{args.port}")
    print("  Statik ön yüz:", STATIC_ROOT)
    print("  CORS:", ", ".join(ALLOWED_ORIGINS) if ALLOWED_ORIGINS else "* (herkese açık)")
    print("  API anahtarı:", "tanımlı ✓" if API_KEY else "tanımlı değil")
    print("=" * 60)
    for p in health()["providers"]:
        mark = "✓" if p["available"] else "✗"
        print(f"  [{mark}] {p['label']}" + ("" if p["available"] else f" — {p['error']}"))
    print("=" * 60)

    srv = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nKapatılıyor…")
        srv.shutdown()


if __name__ == "__main__":
    main()
