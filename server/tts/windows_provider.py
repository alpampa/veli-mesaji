"""Windows Speech (SAPI5) sağlayıcısı — internet olmadan sistem sesi (yalnızca Windows).

COM/SAPI thread güvenli olmadığından TÜM işlemler tek, ayrılmış bir STA
çalışan iş parçacığında sırayla yürütülür (RPC_E_CHANGED_MODE gibi
çapraz iş parçacığı COM hataları bu sayede oluşmaz).
"""

import ctypes
import os
import queue
import tempfile
import threading
import time

from .base import TTSProvider, wav_duration

try:
    import pyttsx3
except Exception:
    pyttsx3 = None

COINIT_APARTMENTTHREADED = 0x2


def _co_initialize():
    try:
        ctypes.windll.ole32.CoInitializeEx(None, COINIT_APARTMENTTHREADED)
    except Exception:
        pass


class _Worker:
    def __init__(self):
        self._q = queue.Queue()
        self._t = threading.Thread(target=self._loop, daemon=True, name="vms-windows-tts")
        self._t.start()

    def _loop(self):
        _co_initialize()
        while True:
            fn = self._q.get()
            try:
                fn()
            except Exception as e:
                print(f"[tts] windows worker hatası: {e}")

    def call(self, fn):
        result = {}

        def run():
            try:
                result["value"] = fn()
            except Exception as e:
                result["error"] = e

        self._q.put(run)
        while "value" not in result and "error" not in result:
            time.sleep(0.01)
        if "error" in result:
            raise result["error"]
        return result["value"]


class WindowsProvider(TTSProvider):
    id = "windows"
    label = "Windows Sesi · Sistem"
    offline = True

    def __init__(self):
        self._worker = _Worker() if (pyttsx3 is not None and os.name == "nt") else None

    def available(self):
        if pyttsx3 is None:
            return False, "pyttsx3 paketi kurulu değil (pip install pyttsx3)"
        if os.name != "nt":
            return False, "Windows Speech yalnızca Windows'ta çalışır"
        return True, None

    def get_voices(self):
        ok, err = self.available()
        if not ok or self._worker is None:
            return []
        try:
            return self._worker.call(self._list_voices)
        except Exception as e:
            print(f"[tts] windows ses listesi alınamadı: {e}")
            return []

    def _list_voices(self):
        voices = []
        engine = pyttsx3.init()
        try:
            for v in engine.getProperty("voices"):
                langs = [str(x) for x in (v.languages or [])]
                is_tr = any(
                    "tr" in l.lower() or "trk" in l.lower() or "tur" in l.lower() for l in langs
                ) or "turkish" in (v.name or "").lower()
                if not is_tr:
                    continue
                gender = v.gender if hasattr(v, "gender") else ""
                voices.append(
                    {
                        "id": self.id + ":" + v.name,
                        "provider": self.id,
                        "name": v.name,
                        "gender": "Kadın" if str(gender).lower() == "female" else "Erkek" if str(gender).lower() == "male" else "Belirsiz",
                        "lang": "Türkçe",
                        "style": "Sistem sesi",
                        "offline": True,
                    }
                )
        finally:
            engine.stop()
        return voices

    def generate(self, text, voice_id):
        ok, err = self.available()
        if not ok or self._worker is None:
            raise RuntimeError(f"Windows sesi kullanılamıyor: {err}")
        name = voice_id.split(":", 1)[1]
        return self._worker.call(lambda: self._generate(text, name))

    def _generate(self, text, name):
        engine = pyttsx3.init()
        try:
            target = None
            for v in engine.getProperty("voices"):
                if v.name == name:
                    target = v
                    break
            if target is not None:
                engine.setProperty("voice", target.id)
            engine.setProperty("rate", 170)  # duyuru hızına yakın
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp_path = tmp.name
            tmp.close()
            engine.save_to_file(text, tmp_path)
            engine.runAndWait()
            with open(tmp_path, "rb") as f:
                data = f.read()
            os.unlink(tmp_path)
        finally:
            engine.stop()
        duration = wav_duration(data)
        if duration is None:
            duration = len(data) / 22050.0
        return data, duration
