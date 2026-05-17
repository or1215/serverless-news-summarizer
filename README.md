# TypeScript & AWS Lambda ニュース要約Bot

本ドキュメントは、TypeScriptとAWS Lambdaを用いた「ニュース要約通知Bot」の開発計画をまとめたものです。

---

## 1. プロジェクト概要

| 項目 | 内容 |
| :--- | :--- |
| **名称** | Serverless News Summarizer |
| **目的** | 特定のニュースサイトや技術ブログの更新を自動検知し、AIで要約してSlackへ通知する |
| **期間** | 1ヶ月 |
| **予算** | 0円（AWS無料枠 ＋ 各種API無料枠） |

---

## 2. 技術スタック

| カテゴリ | 選定技術 | 選定理由 |
| :--- | :--- | :--- |
| **言語** | TypeScript | 型安全な開発と、エンジニアとしての基礎スキルの証明 |
| **実行環境** | AWS Lambda (Node.js 22+) | サーバーレスで運用コストを最小化 |
| **インフラ管理** | AWS CDK | Infrastructure as Code (IaC) の実践 |
| **データベース** | Amazon DynamoDB | 重複通知防止のためのステータス管理（無料枠内） |
| **AI要約** | Google Gemini API (Flash) | 高性能かつ無料枠が広く、コスト0でのAI連携が可能 |
| **シークレット管理** | AWS SSM Parameter Store | Gemini APIキー・Slack Webhook URLをSecureStringで管理 |
| **CI/CD** | GitHub Actions | OIDCを用いたセキュアな自動デプロイの実践 |

---

## 3. システムアーキテクチャ

```
EventBridge (毎日09:00 JST)
    │
    ▼
AWS Lambda (メイン処理)
    ├─ 1. RSS/HTMLから新着記事を取得
    ├─ 2. DynamoDBで未送信記事を抽出（重複排除）
    ├─ 3. 上限20件にフィルタリング
    ├─ 4. Gemini APIで各記事を要約（逐次 or 並列）
    ├─ 5. Slack Block Kit形式でダイジェスト通知（1日1回）
    └─ 6. 送信済みURLをDynamoDBに書き込み
         │
         ├─ DynamoDB（送信済みURL管理）
         ├─ SSM Parameter Store（APIキー・Webhook URL）
         └─ CloudWatch Logs（実行ログ・エラーログ）
```

---

## 4. 詳細仕様

### 4-1. 件数制限仕様

| 項目 | 値 |
| :--- | :--- |
| 1日の要約上限 | **20件** |
| 優先順位 | 取得順（新着順） |
| 上限超過時 | 超過分をスキップし次回以降に処理 |


### 4-2. エラーハンドリング仕様

すべてのエラーはCloudWatch Logsへ出力する。致命的エラーの場合はSlackへアラート通知する。

#### エラー分類と対応方針

| エラー種別 | 具体例 | 対応 | Slack通知 |
| :--- | :--- | :--- | :--- |
| **RSS取得失敗** | タイムアウト・404 | 該当ソースをスキップし処理継続 | なし（ログのみ） |
| **Gemini API失敗** | レートリミット・500 | 最大3回リトライ（指数バックオフ）、失敗時はその記事をスキップ | なし（ログのみ） |
| **DynamoDB失敗** | 書き込みエラー | 最大3回リトライ、失敗時はLambda全体をエラー終了 | ✅ アラート送信 |
| **Slack通知失敗** | Webhook URL無効 | 最大3回リトライ、失敗時はエラーログを出力 | — （通知自体の失敗のため） |
| **Lambda全体クラッシュ** | 予期しない例外 | EventBridgeの再試行は行わない（冪等性の担保が難しいため） | ✅ アラート送信 |

#### リトライ設定

```typescript
// 指数バックオフの基本設定
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,  // 1秒 → 2秒 → 4秒
};
```

#### エラーログフォーマット

```json
{
  "level": "ERROR",
  "timestamp": "2025-01-01T09:00:00.000Z",
  "source": "gemini-client",
  "message": "API request failed",
  "articleUrl": "https://example.com/article",
  "attempt": 2,
  "error": "Rate limit exceeded"
}
```

### 4-3. Slack通知設計（Block Kit ダイジェスト形式）

**方針：** 1日1回、その日の新着記事をまとめて1メッセージで通知する。

#### メッセージ構成イメージ

```
━━━━━━━━━━━━━━━━━━━━━
📰 Tech News Digest｜2025年1月1日
新着 5件 / 取得上限 20件
━━━━━━━━━━━━━━━━━━━━━

1️⃣ [記事タイトル]
   📝 AIによる要約テキスト（100〜150文字）
   🔗 元記事を読む  ｜ 📅 2025-01-01

2️⃣ [記事タイトル]
   📝 AIによる要約テキスト（100〜150文字）
   🔗 元記事を読む  ｜ 📅 2025-01-01

─────────────────────
✅ 本日の配信完了｜次回配信: 明日 09:00
```

#### Block Kit構成

| Block種別 | 用途 |
| :--- | :--- |
| `header` | 日付・件数ヘッダー |
| `section` (×N件) | 記事タイトル＋要約テキスト |
| `actions` | 「元記事を読む」ボタン |
| `divider` | 記事間の区切り |
| `context` | フッター（次回配信時刻） |

#### 通知なし時の処理

新着記事が0件の場合は**Slackへの通知をスキップ**する（不要なノイズを防ぐ）。

#### Geminiへの要約プロンプト設計

```
以下の記事を日本語で100〜150文字で要約してください。
技術的な内容はそのまま残し、体言止めで簡潔にまとめてください。

タイトル: {title}
本文: {content}
```

### 4-4. シークレット管理仕様

| シークレット | SSMパス | 種別 |
| :--- | :--- | :--- |
| Gemini APIキー | `/news-summarizer/gemini-api-key` | SecureString |
| Slack Webhook URL | `/news-summarizer/slack-webhook-url` | SecureString |

---

## 5. 実績としてアピールするポイント

1. **セキュリティ意識：** GitHub SecretsにAPIキーを直接置かず、OIDCによる一時認証とSSM SecureStringを組み合わせたシークレット管理を採用
2. **IaCの実践：** 手動設定を排除し、すべてAWS CDKによるコード管理を実施
3. **実用的な設計：** 単なる通知にとどまらず、DBによる重複排除・上限制御・AIによる情報加工・リトライ処理を実装
4. **UXへの配慮：** Slack Block KitによるリッチなUIと、不要通知ゼロ件時のスキップ処理
5. **保守性：** TypeScriptによる厳密な型定義・構造化ログ・自動テストの導入

---
