/**
 * RSSフィードのソースを定義するファイル
 * 参照するニュースサイトを追加する際は、ここに新しいエントリーを追加してください
 */
export type RssSource = {
  name: string;
  url: string;
};

export const RSS_SOURCES: RssSource[] = [
  {
    name: 'Zenn トレンド',
    url: 'https://zenn.dev/feed',
  },
  {
    name: 'dev.to',
    url: 'https://dev.to/feed',
  },
];