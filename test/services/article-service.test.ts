import { getNewArticles } from '../../src/services/article-service';
import * as rssClient from '../../src/clients/rss-client';
import * as dynamodbClient from '../../src/clients/dynamodb-client';

jest.mock('../../src/clients/rss-client');
jest.mock('../../src/clients/dynamodb-client');

const mockFetchArticles = rssClient.fetchArticles as jest.MockedFunction<typeof rssClient.fetchArticles>;
const mockFilterUnsent = dynamodbClient.filterUnsentArticles as jest.MockedFunction<typeof dynamodbClient.filterUnsentArticles>;

const makeArticle = (url: string) => ({
  url,
  title: `Title: ${url}`,
  content: 'content',
  publishedAt: new Date().toISOString(),
  sourceName: 'Test Source',
});

/*
 * getNewArticles関数の基本的な動作をテストしています。
 * - 未送信記事のみを返すこと
 * - 上限20件を超えた場合は20件のみ返すこと
 */
describe('getNewArticles', () => {
  it('未送信記事のみを返す', async () => {
    const all = [makeArticle('https://a.com'), makeArticle('https://b.com')];
    const unsent = [makeArticle('https://b.com')];

    mockFetchArticles.mockResolvedValue(all);
    mockFilterUnsent.mockResolvedValue(unsent);

    const result = await getNewArticles();
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://b.com');
  });

  it('上限20件を超えた場合は20件のみ返す', async () => {
    const articles = Array.from({ length: 30 }, (_, i) => makeArticle(`https://example.com/${i}`));
    mockFetchArticles.mockResolvedValue(articles);
    mockFilterUnsent.mockResolvedValue(articles);

    const result = await getNewArticles();
    expect(result).toHaveLength(20);
  });
});