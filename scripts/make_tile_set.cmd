@echo off
REM ============================================================
REM  Obal na make_tile_set.py - funguje v cmd i v PowerShellu.
REM  Neni potreba nic nastavovat, vse si to udela samo:
REM   - prepne konzoli na UTF-8 (aby cestina nekreslila zpet na error)
REM   - najde Python s pillow a numpy (venv ComfyUI)
REM   - preda vsechny argumenty dal
REM
REM  Priklady:
REM    scripts\make_tile_set.cmd --name kronika-tex --style kronika-tex
REM    scripts\make_tile_set.cmd --name zkouska --only grass,water --variants 1
REM    scripts\make_tile_set.cmd --help
REM ============================================================
setlocal
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set "PY=D:\ComfyUI\venv-comfy\Scripts\python.exe"
if not exist "%PY%" (
  echo CHYBA: nenasel jsem "%PY%"
  echo Tenhle Python ma pillow a numpy. Kdyz je ComfyUI jinde, uprav radek "set PY=" v tomhle souboru.
  exit /b 1
)
"%PY%" "%~dp0make_tile_set.py" %*
exit /b %ERRORLEVEL%
