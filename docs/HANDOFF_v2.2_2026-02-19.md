# Handoff Note - Local LLM Chat Advanced v2.2 (2026-02-19)

## 目的
v2.1 → v2.2 の変更内容と、次回再開のための記録。

## 対象
- アプリ名: `Local LLM Chat Advanced`
- バージョン: `v2.2`

## 今回の実装サマリ

### 1. メッセージブックマーク機能

#### データモデル
- `normalizeHistory()` に `bookmarked: toBool(item.bookmarked, false)` 追加
- `cloneHistory()` に同フィールド追加

#### UI
- SVGアイコン `i-star`（outline）/ `i-star-filled`（塗り潰し）追加
- `appendMessage()` 内、copyBtn の前にブックマーク切替ボタン挿入（user + assistant 両方）
- クリックで `bookmarked` トグル → `persistHistory()` → アイコン切替
- ブックマーク済みメッセージに `.bookmarked` CSSクラス → 金色左ボーダー（user は右ボーダー）

#### ブックマーク一覧モーダル
- `bookmarkModal` オーバーレイ（index.html）
- `renderBookmarkList()` — 全セッション横断でブックマーク済みメッセージを収集・表示
- `toggleBookmarkModal()` — モーダル開閉
- クリックでセッション切替 + メッセージにスクロール

#### キーボードショートカット
- `Cmd/Ctrl + Shift + B` → `toggleBookmarkModal()`

### 2. 会話タイトル自動生成

#### 設定
- `DEFAULT_SETTINGS` に `autoTitleEnabled: true` 追加
- `normalizeSettings()` に正規化追加
- 設定UI: `autoTitleInput` チェックボックス（基本タブ、autoUnload の後）

#### セッション管理
- `normalizeSessions()` に `autoTitled` フラグ追加
  - `undefined`: 未処理（自動タイトル候補）
  - `true`: 自動生成済み（再生成しない）
  - `false`: 手動リネーム済み（上書きしない）
- `upsertCurrentSessionFromHistory()`: `autoTitled === true` or `false` 時に `buildSessionTitle()` をスキップ
- `beginSessionRename()`: 手動リネーム確定時に `autoTitled = false` 設定

#### LLM呼び出し
- `maybeAutoGenerateTitle(modelId)` — fire-and-forget 非同期関数
  - 条件: `autoTitleEnabled` ON、セッションに user 1 + assistant 1 のみ、`autoTitled !== false`
  - API: `stream: false`, `temperature: 0.3`, `max_tokens: 60`
  - プロンプト: 「15〜25文字の日本語タイトルを1行だけ出力」
  - 成功時: `session.title` 更新、`autoTitled = true`、`persistSessionStore()` + `renderSessionList()`
- 呼び出し箇所: `sendMessage()` の `persistHistory()` 後（メモリー抽出と並列）

### 3. TTS 音声読み上げ

#### 設定
- `DEFAULT_SETTINGS`: `ttsEnabled: false`, `ttsAutoRead: false`, `ttsVoice: ""`, `ttsRate: 1.0`
- `state.featureFlags.ttsAutoRead` 追加
- `state.runtime`: `ttsCurrentUtterance: null`, `ttsSpeaking: false`
- `syncFeatureFlagsFromSettings()`: `ttsAutoRead = ttsEnabled && ttsAutoRead`

#### UI
- SVGアイコン `i-speaker` / `i-speaker-off` 追加
- 設定パネル「音声」セクション: enabled, autoRead, voice select, rate slider
- `ttsAutoBtn` モードボタン（input-subactions、webSearchBtn の後）
- アシスタントメッセージに「読み上げ」ボタン（meta 内、termBtn の前）

#### コア関数
- `getTtsVoices()` / `getJapaneseVoices()` — ブラウザのボイスリスト取得
- `populateTtsVoiceSelect()` — ドロップダウン構築（日本語音声優先、推奨: Kyoko）
- `stripMarkdownForTts(text)` — Markdown/HTML除去
- `speakText(text)` — SpeechSynthesisUtterance 生成・再生
- `stopSpeaking()` — 発話キャンセル
- `toggleSpeakMessage(index)` — 個別メッセージ読み上げ/停止
- `setTtsAutoReadEnabled(enabled, options)` — Web検索と同じトグルパターン

#### トリガー
- 手動: メッセージの「読み上げ」ボタンクリック
- 自動: `sendMessage()` 完了後、`ttsAutoRead` ON の場合
- 停止: `sendMessage()` 冒頭で `stopSpeaking()` 呼び出し

#### キーボードショートカット
- `Cmd/Ctrl + Shift + T` → `setTtsAutoReadEnabled()` トグル

### 4. マニュアル更新
- バージョンを v2.2 に更新
- セクション14: ブックマーク機能
- セクション15: タイトル自動生成
- セクション16: 音声読み上げ（TTS）
- 既存セクション14-19 → 17-22 にリナンバリング
- ショートカット表に2項目追加
- `node scripts/sync-manual-embed.mjs` 実行済み

## 主な更新ファイル

| ファイル | 変更内容 |
|---------|---------|
| `index.html` | SVGアイコン4種追加、bookmarkModal、TTS設定UI、autoTitleInput、ttsAutoBtn、ショートカット表更新、キャッシュバスティング v2.7 |
| `js/app.js` | ブックマーク機能、自動タイトル生成、TTS読み上げ、設定・状態・イベント全般 |
| `assets/app.css` | `.message.bookmarked` スタイル（ライト/ダークモード） |
| `docs/MANUAL.md` | 3機能追加、セクションリナンバリング |
| `js/manual-content.js` | sync-manual-embed.mjs で自動生成 |

## 再開時の手順

1. マニュアル同期（変更がある場合）:
   ```bash
   node scripts/sync-manual-embed.mjs
   ```
2. ブラウザでハードリロード（Cmd+Shift+R）
3. 回帰確認:
   - メッセージに星ボタンが表示され、クリックで金色に変化
   - `Cmd+Shift+B` でブックマーク一覧モーダルが開く
   - ブックマーク状態がリロード後も保持
   - 新規チャットで1往復後、セッションタイトルがLLM生成に更新
   - 手動リネーム後は自動上書きされない
   - アシスタントメッセージに「読み上げ」ボタン表示
   - 読み上げボタンで Kyoko 音声で再生
   - `Cmd+Shift+T` で自動読み上げトグル
   - 既存機能（思考プロセス、比較モード、Web検索等）に回帰がないこと

## 既知の注意点

- **TTS音声**: macOS では Kyoko が最も自然な日本語音声。Eddy/Flo 等のSiri系ノベルティ音声は不向き
- **Git**: セッション終了時点で git オブジェクトの破損あり（`fatal: bad object HEAD`）。コミットが必要な場合は修復が必要

## 次回の優先候補
1. Git リポジトリの修復・コミット
2. ブックマーク一覧のセッション名表示改善
3. TTS の言語自動検出（日本語/英語切替）
4. 非ストリーミングモードでの `message.reasoning` フィールド処理
5. reasoning 内容の Markdown エクスポート対応
