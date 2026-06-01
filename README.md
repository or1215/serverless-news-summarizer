# TypeScript & AWS Lambda ニュース要約Bot

本ドキュメントは、TypeScriptとAWS Lambdaを用いた「ニュース要約通知Bot」の開発計画をまとめたものです。

---

##  プロジェクト概要

| 項目 | 内容 |
| :--- | :--- |
| **名称** | Serverless News Summarizer |
| **目的** | 特定のニュースサイトや技術ブログの更新を自動検知し、AIで要約してSlackへ通知する |
| **期間** | 1ヶ月 |

---

##  技術スタック

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

## システムアーキテクチャ

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
         ├─ DynamoDB（送信済みURL管理）
         ├─ SSM Parameter Store（APIキー・Webhook URL）
         └─ CloudWatch Logs（実行ログ・エラーログ）
```

---

## 詳細仕様

### 1. 件数制限仕様

| 項目 | 値 |
| :--- | :--- |
| 1日の要約上限 | **20件** |
| 優先順位 | 取得順（新着順） |
| 上限超過時 | 超過分をスキップし次回以降に処理 |


### 2. エラーハンドリング仕様

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

### 3. Slack通知設計（Block Kit ダイジェスト形式）

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

---

## フォルダ構成

```
SERVERLESS-NEWS-SUMMARIZER
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actionsのデプロイワークフロー
├── bin/                        # CDKのエントリーポイント（アプリの起動定義）
├── cdk.out/                    # CDKの合成（Synth）成果物出力ディレクトリ（自動生成）
├── lib/                        # AWSリソース（Stack）の定義ファイル
├── node_modules/               # 外部モジュール・依存パッケージ（自動生成）
├── src/                        # Lambda関数などのアプリケーションソースコード
│   ├── clients/                # 各種外部サービス（DynamoDB, Gemini, S3, Slack等）のクライアント実装
│   ├── config/                 # 定数やニュース取得元（sources）の設定
│   ├── handlers/               # Lambdaのエントリーポイント（index.ts）
│   └── services/               # ビジネスロジック（記事の取得・集約処理など）
├── test/                       # テストコード配置ディレクトリ
├── .gitignore                  # Git管理対象外の設定
├── .npmignore                  # npmパッケージ対象外の設定
├── cdk.json                    # CDKの動作設定（ツールキットの挙動等）
├── jest.config.ts              # テストフレームワーク（Jest）の設定
├── package.json                # プロジェクトの依存関係・スクリプト定義
├── package-lock.json           # 依存パッケージのバージョンロックファイル
├── README.md                   # プロジェクトの説明書（本ファイル）
├── trust-policy.json           # IAMロールの信頼ポリシー設定ファイル
└── tsconfig.json               # TypeScriptのコンパイル設定

```
---

## テスト仕様書

### モック対象
 
| モジュール | モック対象関数 | 差し替え理由 |
| :--- | :--- | :--- |
| `src/clients/rss-client` | `fetchArticles` | 実際のRSSフィードへのHTTPリクエストを防ぐ |
| `src/clients/dynamodb-client` | `filterUnsentArticles` | 実際のDynamoDBへのアクセスを防ぐ |

### テスト内で使用するURL
 
| URL | 役割 | 補足 |
| :--- | :--- | :--- |
| `https://a.com` | 送信済み記事の代表 | `filterUnsentArticles` の戻り値に含めないことで送信済みを表現 |
| `https://b.com` | 未送信記事の代表 | `filterUnsentArticles` の戻り値に含めることで未送信を表現 |
| `https://example.com/0〜N` | 件数テスト用の連番記事 | 上限制御・境界値テストで大量記事を一括生成するために使用 |

※ すべてテスト専用の架空URLであり、実際のサイトへのアクセスは発生しない。

## テストケース一覧

### 正常系
 
| # | テスト名 | 前提条件 | 期待する結果 |
| :--- | :--- | :--- | :--- |
| 1 | 未送信記事のみを返す | 全記事2件（a.com・b.com）のうちb.comのみ未送信 | 1件（b.com）のみ返る |
| 2 | 上限20件を超えた場合は20件のみ返す | 未送信記事30件 | 20件のみ返る |
| 3 | ちょうど20件の場合は全件返す（境界値） | 未送信記事20件 | 20件すべて返る |
| 4 | 新着0件の場合は空配列を返す | RSSの取得結果が0件 | 空配列が返る |
| 5 | 全件送信済みの場合は空配列を返す | 全記事2件がすべて送信済み | 空配列が返る |
| 6 | 上限超過時は先頭20件が返される | 未送信記事25件 | 先頭から順に20件返る（example.com/0〜19） |

### 異常系
 
| # | テスト名 | 前提条件 | 期待する結果 |
| :--- | :--- | :--- | :--- |
| 7 | RSS取得が失敗した場合はエラーをスローする | `fetchArticles` がNetworkErrorをスロー | エラーがそのままスローされる |
| 8 | DynamoDB参照が失敗した場合はエラーをスローする | `filterUnsentArticles` がDynamoDB Errorをスロー | エラーがそのままスローされる |

## カバレッジ対象
 
| ロジック | カバーするケース |
| :--- | :--- |
| 重複排除（filterUnsentArticles） | ケース1・5 |
| 上限制御（slice 0〜20） | ケース2・3・6 |
| 0件ハンドリング | ケース4・5 |
| エラー伝播 | ケース7・8 |

---
