#!/bin/bash
# Qwen3-TTS API Server — ダブルクリックで起動
# ターミナルウィンドウが開き、サーバが起動します。
# 停止するには Ctrl+C またはウィンドウを閉じてください。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$SCRIPT_DIR/venv/bin/python" ]; then
    echo "Error: venv not found at $SCRIPT_DIR/venv"
    echo "Press any key to close..."
    read -n 1
    exit 1
fi

PYTHON="$SCRIPT_DIR/venv/bin/python"
PIP="$SCRIPT_DIR/venv/bin/pip"

export PYTORCH_ENABLE_MPS_FALLBACK=1
export HF_HOME="$SCRIPT_DIR/.hf_cache"
export QWEN_TTS_MODEL="${QWEN_TTS_MODEL:-Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice}"
export QWEN_TTS_API_PORT="${QWEN_TTS_API_PORT:-8520}"

"$PYTHON" -c "import fastapi" 2>/dev/null || "$PIP" install fastapi "uvicorn[standard]"

echo "========================================="
echo "Qwen3-TTS API Server"
echo "  URL:   http://localhost:${QWEN_TTS_API_PORT}"
echo "  Model: ${QWEN_TTS_MODEL}"
echo ""
echo "  停止: Ctrl+C またはこのウィンドウを閉じる"
echo "========================================="

"$PYTHON" "$SCRIPT_DIR/tts_api_server.py"

echo ""
echo "サーバが停止しました。Press any key to close..."
read -n 1
