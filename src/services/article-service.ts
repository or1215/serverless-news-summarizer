/**
 * 記事サービス
 * - getNewArticles: RSSから新着かつ未送信の記事を取得します
 *   - fetchArticles: RSSクライアントから全記事を取得します
 *   - filterUnsentArticles: DynamoDBクライアントを使用して、既に送信済みの記事を除外します
 *   - 上限にフィルタリングして返します（無料枠を考慮）
 */
import { fetchArticles, Article } from '../clients/rss-client';
import { filterUnsentArticles } from '../clients/dynamodb-client';

// 一日の最大記事数
const MAX_ARTICLES_PER_DAY = 20;

/**
 * 新着かつ未送信の記事を最大20件返す
 */
export const getNewArticles = async (): Promise<Article[]> => {
  // RSSから全記事を取得
  const allArticles = await fetchArticles();

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Fetched articles from RSS',
    total: allArticles.length,
    timestamp: new Date().toISOString(),
  }));

  // DynamoDBを参照して送信済みを除外
  const unsentArticles = await filterUnsentArticles(allArticles);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Filtered unsent articles',
    unsent: unsentArticles.length,
    timestamp: new Date().toISOString(),
  }));

  // 上限にフィルタリング
  const articlesToProcess = unsentArticles.slice(0, MAX_ARTICLES_PER_DAY);

  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Articles to process today',
    count: articlesToProcess.length,
    skipped: Math.max(0, unsentArticles.length - MAX_ARTICLES_PER_DAY),
    timestamp: new Date().toISOString(),
  }));

  return articlesToProcess;
};