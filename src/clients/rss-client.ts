/**
 * 記事を取得する共通処理
 */
import Parser from 'rss-parser';
import { RSS_SOURCES, RssSource } from '../config/sources';

export type Article = {
  url: string;
  title: string;
  content: string;
  publishedAt: string;
  sourceName: string;
};

const parser = new Parser();

/**
 * 指定したRSSソースから記事一覧を取得する
 */
export const fetchArticles = async (): Promise<Article[]> => {
  const results: Article[] = [];
  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      const articles = (feed.items ?? [])
        .filter((item: Parser.Item) => item.link && item.title)
        .map((item: Parser.Item) => ({
          url: item.link!,
          title: item.title!,
          content: item.contentSnippet ?? item.content ?? '',
          publishedAt: item.pubDate ?? new Date().toISOString(),
          sourceName: source.name,
        }));
      results.push(...articles);
    } catch (error) {
      console.warn(`Failed to fetch from ${source.name}:`, error);
    }
  }

  return results;
};