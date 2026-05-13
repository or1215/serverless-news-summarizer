import { getNewArticles } from '../services/article-service';

export const handler = async (): Promise<void> => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Lambda invoked',
    timestamp: new Date().toISOString(),
  }));

  try {
    // 新着記事を取得（重複排除・件数制限済み）
    const articles = await getNewArticles();

    if (articles.length === 0) {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'No new articles found. Skipping.',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // 取得した記事をログ出力
    console.log(JSON.stringify({
      level: 'INFO',
      message: 'New articles ready for processing',
      articles: articles.map((a) => ({ title: a.title, url: a.url })),
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    console.log(JSON.stringify({
      level: 'ERROR',
      message: 'Unexpected error in handler',
      error: String(error),
      timestamp: new Date().toISOString(),
    }));
    throw error; 
  }
};