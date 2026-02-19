#!/bin/bash
# Qwen3-TTS API Server — launchd サービス管理
# Usage:
#   ./tts-service.sh install   — ログイン時に自動起動を登録
#   ./tts-service.sh uninstall — 自動起動を解除
#   ./tts-service.sh start     — 今すぐ起動
#   ./tts-service.sh stop      — 停止
#   ./tts-service.sh status    — 状態確認
#   ./tts-service.sh log       — ログを表示

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.local.qwen3-tts-api"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME.plist"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$SCRIPT_DIR/logs"

mkdir -p "$LOG_DIR"

case "$1" in
    install)
        cp "$PLIST_SRC" "$PLIST_DST"
        launchctl load "$PLIST_DST"
        echo "Installed and loaded: $PLIST_NAME"
        echo "TTS server will start automatically on login."
        ;;
    uninstall)
        launchctl unload "$PLIST_DST" 2>/dev/null
        rm -f "$PLIST_DST"
        echo "Uninstalled: $PLIST_NAME"
        ;;
    start)
        if [ ! -f "$PLIST_DST" ]; then
            echo "Not installed. Run: ./tts-service.sh install"
            exit 1
        fi
        launchctl start "$PLIST_NAME"
        echo "Started: $PLIST_NAME"
        sleep 2
        curl -s http://localhost:8520/api/v1/status 2>/dev/null && echo "" || echo "Note: Server may still be loading the model..."
        ;;
    stop)
        launchctl stop "$PLIST_NAME" 2>/dev/null
        echo "Stopped: $PLIST_NAME"
        ;;
    status)
        echo "=== launchd status ==="
        launchctl list | grep "$PLIST_NAME" || echo "(not running)"
        echo ""
        echo "=== API status ==="
        curl -s http://localhost:8520/api/v1/status 2>/dev/null || echo "Server not responding"
        echo ""
        ;;
    log)
        echo "=== Recent logs ==="
        tail -30 "$LOG_DIR/tts-api.log" 2>/dev/null
        echo ""
        echo "=== Recent errors ==="
        tail -10 "$LOG_DIR/tts-api-error.log" 2>/dev/null
        ;;
    *)
        echo "Usage: $0 {install|uninstall|start|stop|status|log}"
        exit 1
        ;;
esac
