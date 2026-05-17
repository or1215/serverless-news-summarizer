import { SummarizedArticle } from './gemini-client'; // 既存の型定義をインポート
import systemStyles from './style.css';

/**
 * 要約記事一覧からHTMLページを生成する
 */
export const generateHtml = (articles: SummarizedArticle[]): string => {
  // 日本時間の現在時刻を取得して「最終更新日時」とする
  const updatedAt = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });


  // 記事データを一つずつHTMLのカード形式に変換する
  const cards = articles.map((article, index) => renderArticleCard(article, index)).join('');

  // 骨組みとなる全体のHTMLテンプレート
  return renderHtmlUtils(articles, systemStyles, updatedAt, cards);
};

/**
 * 記事1件分のカードHTMLを生成するコンポーネント関数。
 */
const renderArticleCard = (article: SummarizedArticle, index: number): string => {
  return `
    <article class="card" style="animation-delay: ${index * 0.05}s">
      <div class="card-meta">
        <span class="source">${escapeHtml(article.sourceName)}</span>
        <span class="date">${formatDate(article.publishedAt)}</span>
      </div>
      <h2 class="card-title">
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(article.title)}
        </a>
      </h2>
      <p class="card-summary">${escapeHtml(article.summary)}</p>
      <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="card-link">
        元記事を読む →
      </a>
    </article>
  `;
};

/**
 * HTMLページの内容を生成するためのユーティリティ関数群
 */
const renderHtmlUtils = (articles: SummarizedArticle[], systemStyles: string, updatedAt: string, cards: string): string => {
    return `<!DOCTYPE html>
    <html lang="ja">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="技術ニュースをAIが毎日要約して届けます">
    <title>Tech News Digest</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
    <style>
        ${systemStyles}
    </style>
    </head>
    <body>

    <header>
    <div class="header-inner">
        <div class="site-title">Tech News Digest</div>
        <div class="updated-at">更新: ${updatedAt}</div>
    </div>
    </header>

    <section class="hero">
    <div class="hero-badge">AI POWERED • DAILY UPDATE</div>
    <h1>今日の技術ニュース</h1>
    <p class="hero-desc">技術ブログの新着記事をAIが毎日要約してお届けします</p>
    <div class="article-count">本日の記事数: <span>${articles.length}</span> 件</div>
    </section>

    <main class="grid">
    ${articles.length > 0 ? cards : `
        <div class="empty">
        <div class="empty-icon">📭</div>
        <p>本日の新着記事はありません</p>
        </div>
    `}
    </main>

    <footer>
    <p>Powered by <a href="https://github.com" target="_blank">Serverless News Summarizer</a> | AWS Lambda + Gemini API</p>
    </footer>

    </body>
    </html>`
};

/**
 * 外部データ埋め込み時のXSS（クロスサイトスクリプティング）対策エスケープ処理
 * ポートフォリオとしての安全性を担保する重要ポイントです
 */
const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * 日付のフォーマットを読みやすく整える
 */
const formatDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Tokyo',
    });
  } catch {
    return '';
  }
};