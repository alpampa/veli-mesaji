@echo off
REM Veli Mesajı Studio — TTS sunucusunu başlatır
REM İlk kullanım: pip install -r server\requirements.txt
cd /d "%~dp0"
echo.
echo  ============================================
echo    VELI MESAJI STUDIO - TTS sunucusu
echo    http://127.0.0.1:8765
echo    (Bu pencereyi kapatmayin)
echo  ============================================
echo.
python server\server.py
echo.
echo  Sunucu kapandi. Kapatmak icin bir tusa basin.
pause >nul
