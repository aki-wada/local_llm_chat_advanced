# Qwen3-TTS 音声応答機能 操作ガイド

**作成日**: 2026-02-20
**対象**: Local LLM Chat Advanced v2.3

---

## 概要

チャットアプリの TTS（テキスト読み上げ）機能に、Qwen3-TTS バックエンドを統合。
ブラウザ標準の Web Speech API と、Qwen3-TTS の高品質ローカル音声を切り替えて使用可能。

### アーキテクチャ

```
チャットアプリ (index.html)
  ↓ fetch POST /api/v1/tts
FastAPI サーバ (tts_api_server.py :8520)
  ↓ qwen_tts ライブラリ
Qwen3-TTS モデル (0.6B, MPS)
  ↓ WAV 音声
ブラウザで再生 (HTML5 Audio)
```

---

## ファイル構成

| ファイル | 説明 |
|---|---|
| `tts_api_server.py` | 自己完結型 FastAPI サーバ（app.py 依存なし） |
| `run_tts_api.sh` | CLI 起動スクリプト |
| `Start TTS Server.command` | Finder ダブルクリック起動用 |
| `tts-service.sh` | launchd サービス管理スクリプト |
| `com.local.qwen3-tts-api.plist` | macOS launchd 定義ファイル |
| `venv/` | Python 仮想環境（torch, qwen_tts 等、1.4GB） |
| `.hf_cache/` | Hugging Face モデルキャッシュ（11GB） |
| `logs/` | サーバログ出力先（launchd 使用時） |

---

## サーバの起動方法

### 方法 1: Finder ダブルクリック（推奨・手動）

1. Finder で `Start TTS Server.command` をダブルクリック
2. ターミナルが開き、モデルのロード後にサーバが起動
3. 停止: **Ctrl+C** またはターミナルウィンドウを閉じる

### 方法 2: ターミナルから起動

```bash
cd /Users/m4_max/Desktop/wada_work/local_llm_chat_advanced
./run_tts_api.sh
```

### 方法 3: ログイン時に自動起動（バックグラウンド）

```bash
cd /Users/m4_max/Desktop/wada_work/local_llm_chat_advanced

# 初回登録
./tts-service.sh install

# 以降、Mac 起動時に自動的にバックグラウンドで起動される
```

---

## サーバの管理コマンド（launchd）

```bash
./tts-service.sh status      # 状態確認（launchd + API 応答）
./tts-service.sh start       # 手動で今すぐ起動
./tts-service.sh stop        # 一時停止
./tts-service.sh log         # ログ表示
./tts-service.sh uninstall   # 自動起動を完全に解除
```

### ポート競合時の強制停止

```bash
lsof -ti :8520 | xargs kill
```

---

## サーバの API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/v1/status` | サーバ状態・モデル情報 |
| `GET` | `/api/v1/speakers` | 話者一覧 + メタデータ |
| `POST` | `/api/v1/tts` | テキスト → 音声生成（WAV/OGG） |

### テストコマンド

```bash
# ステータス確認
curl http://localhost:8520/api/v1/status

# 音声生成テスト
curl -X POST http://localhost:8520/api/v1/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"こんにちは","speaker":"ono_anna"}' \
  --output test.wav
```

---

## チャットアプリ側の設定

設定 > **音声応答** タブ

### 基本設定
| 設定 | デフォルト | 説明 |
|---|---|---|
| 音声読み上げを有効にする | OFF | TTS 機能の ON/OFF |
| 新しい応答を自動読み上げ | OFF | アシスタント応答完了時に自動再生 |
| LLMで音声用に要約してから読み上げ | OFF | LLM で話し言葉に要約後に読み上げ |

### TTSバックエンド
| 設定 | デフォルト | 説明 |
|---|---|---|
| バックエンド選択 | ブラウザ | 「ブラウザ (Web Speech API)」/「Qwen3-TTS」 |

#### ブラウザ選択時
- 音声: macOS の音声一覧から選択（Kyoko 推奨）
- 読み上げ速度: 0.5〜2.0

#### Qwen3-TTS 選択時
- サーバURL: `http://localhost:8520`
- 話者: 9名から選択
- 接続ステータス: 自動でサーバ接続確認

---

## 話者一覧

| ID | 名前 | 言語 |
|---|---|---|
| `ono_anna` | Ono Anna | 日本語女性 |
| `aiden` | Aiden | 英語男性 |
| `dylan` | Dylan | 英語男性 |
| `eric` | Eric | 英語男性 |
| `ryan` | Ryan | 英語男性 |
| `serena` | Serena | 英語女性 |
| `sohee` | Sohee | 韓国語女性 |
| `uncle_fu` | Uncle Fu | 中国語男性 |
| `vivian` | Vivian | 中国語女性 |

**注意**: 話者IDは全て小文字（モデルが返す実際のID）

---

## 音声パイプラインの動作フロー

### 通常の読み上げ（要約 OFF）

```
読み上げボタン クリック
  → stripMarkdownForTts() — マークダウン記号除去
  → dispatchTts()
    → speakTextWithQwen3() — POST /api/v1/tts → WAV → Audio.play()
    → 失敗時: speakTextWithBrowser() にフォールバック
```

### 要約付き読み上げ（要約 ON）

```
読み上げボタン クリック
  → stripMarkdownForTts() — マークダウン記号除去
  → 「要約中…」表示
  → summarizeForSpeech() — LLM に音声用要約を依頼 (non-streaming)
  → showTtsSummary() — メッセージ下に折りたたみ要約表示
  → 「音声生成中…」表示
  → speakTextWithQwen3() — POST /api/v1/tts → WAV
  → 「再生中…」表示
  → Audio.play()
  → 完了時: ステータス消去
```

### エラー時のフォールバック

| シナリオ | 処理 |
|---|---|
| API サーバ未起動 | fetch 失敗 → ブラウザ TTS にフォールバック |
| モデル未ロード (503) | → ブラウザ TTS |
| 生成タイムアウト (>30s) | AbortController → ブラウザ TTS |
| 不正な話者 (400) | → ブラウザ TTS |
| 音声再生エラー | audio.onerror → ブラウザ TTS |
| 要約失敗 | 元のテキストをそのまま読み上げ |

---

## 技術メモ

### 関連設定キー（DEFAULT_SETTINGS）
- `ttsBackend`: `"browser"` | `"qwen3"`
- `qwen3TtsUrl`: `"http://localhost:8520"`
- `qwen3TtsSpeaker`: `"ono_anna"`
- `ttsSummarize`: `false`

### 関連 JS 関数
- `speakText(text, messageIndex)` — ディスパッチャー
- `dispatchTts(text, messageIndex)` — バックエンド分岐
- `speakTextWithBrowser(plainText)` — Web Speech API
- `speakTextWithQwen3(plainText, messageIndex)` — Qwen3-TTS API
- `summarizeForSpeech(text)` — LLM に要約依頼
- `showTtsSummary(messageIndex, summary)` — 要約テキスト表示
- `setTtsStatus(messageIndex, status)` — ステータスバッジ表示
- `updateTtsBackendVisibility()` — UI 切替
- `checkQwen3TtsStatus()` — サーバ接続確認
- `stopSpeaking()` — 再生停止（Audio + speechSynthesis 両方）

### DOM セレクタ
- メッセージ要素: `article[data-index="N"]`（`el.chatContainer` 内）
- ステータスバッジ: `.tts-status-badge`
- 要約コンテナ: `.tts-summary-container`

### モデル情報
- モデル: `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`（軽量版）
- デバイス: MPS (Apple Silicon) / CUDA / CPU
- サンプルレート: 24000 Hz
- 出力: PCM 16bit mono WAV
- 初回ロード: MPS で約30秒
- 生成時間: テキスト長に依存（短文で数秒〜長文で十数秒）

### 環境変数
| 変数 | デフォルト | 説明 |
|---|---|---|
| `QWEN_TTS_MODEL` | `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` | 使用モデル |
| `QWEN_TTS_API_PORT` | `8520` | API サーバポート |
| `QWEN_TTS_PRELOAD` | `1` | 起動時にモデルをプリロード |
| `PYTORCH_ENABLE_MPS_FALLBACK` | `1` | MPS 非対応演算のCPUフォールバック |
| `HF_HOME` | `.hf_cache` | モデルキャッシュ保存先 |
