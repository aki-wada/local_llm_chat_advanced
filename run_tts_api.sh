#!/bin/bash
# Qwen3-TTS API Server Startup (self-contained)
# Usage: ./run_tts_api.sh
#
# All dependencies (venv, .hf_cache) are inside this directory.
# No external references to qwen3_tts_app.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check local venv
if [ ! -f "$SCRIPT_DIR/venv/bin/python" ]; then
    echo "Error: venv not found at $SCRIPT_DIR/venv"
    echo "Please ensure venv/ directory exists with required ML packages."
    exit 1
fi

PYTHON="$SCRIPT_DIR/venv/bin/python"
PIP="$SCRIPT_DIR/venv/bin/pip"

# Environment
export PYTORCH_ENABLE_MPS_FALLBACK=1
export HF_HOME="$SCRIPT_DIR/.hf_cache"
export QWEN_TTS_MODEL="${QWEN_TTS_MODEL:-Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice}"
export QWEN_TTS_API_PORT="${QWEN_TTS_API_PORT:-8520}"

# Install API dependencies if needed
"$PYTHON" -c "import fastapi" 2>/dev/null || "$PIP" install fastapi "uvicorn[standard]"

echo "========================================="
echo "Qwen3-TTS API Server"
echo "  URL:   http://localhost:${QWEN_TTS_API_PORT}"
echo "  Model: ${QWEN_TTS_MODEL}"
echo "========================================="

exec "$PYTHON" "$SCRIPT_DIR/tts_api_server.py"
