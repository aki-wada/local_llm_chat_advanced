# Local LLM Chat Advanced v2.2

LM Studio と連携して使う、ローカル推論向けのWebチャットアプリです。  
`index.html` をブラウザで開くだけで利用できます（ビルド不要）。

## 前提
- macOS / Windows / Linux のモダンブラウザ
- [LM Studio](https://lmstudio.ai/)（OpenAI互換API有効）
- 推奨APIエンドポイント: `http://localhost:1234/v1`

## すぐに使う
1. LM Studioを起動し、使用するモデルをロード
2. LM Studioのローカルサーバーを有効化（OpenAI互換）
3. `index.html` をブラウザで開く
4. 上部の `モデル更新` を押してモデル一覧を取得
5. モデルを選択してチャット開始

## 主な機能
- 通常チャット（ストリーミング応答 / 停止）
- 比較モード（Model A / Model B の2カラム比較）
- 添付（画像・テキスト・PDF）
- 会話ログ管理
  - 会話を自動保存
  - 日時+内容要約タイトルでログ化
  - 一覧から `再開` / `削除`
- メモリー機能（ユーザー情報の抽出・再利用）
- 医学用語チェック
- 応答中断時の `再開` ボタン
- プリセット管理（通常プリセット / System Promptプリセット）
- ヘルプモード / 深掘りモード
- モデル表示フィルタ（候補モデルを選別）
- 思考プロセス表示（Thinking model 対応: Qwen3, DeepSeek R1, nemotron-3-nano 等）
- Reasoning Effort 設定（gpt-oss-120B 等の reasoning API 対応）
- メッセージブックマーク（星マーク + 一覧モーダル）
- 会話タイトル自動生成（LLMによる要約タイトル）
- TTS音声読み上げ（Web Speech API、手動 + 自動モード）
- 設定の自動保存

## 設定のポイント
- `送信キー` はデフォルトで `Enterで改行 / Shift+Enterで送信`
- `新規チャットでLLMから呼びかけ` は、`新規チャット` 実行時に呼びかけを開始
- `メモリー機能` ONで会話文脈に応じた記憶を利用

## ディレクトリ構成
- `index.html`: UI骨格
- `assets/app.css`: スタイル
- `js/app.js`: アプリロジック
- `docs/`: 仕様書・マニュアル
- `scripts/sync-manual-embed.mjs`: マニュアル埋め込み更新

## マニュアル同期
`docs/MANUAL.md` を更新したら、以下を実行してアプリ内ヘルプを同期します。

```bash
node scripts/sync-manual-embed.mjs
```

## ライセンス
[MIT](./LICENSE)
