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

  // テストで使用する記事データを作成
  // 送信済み
  const aCom = 'https://a.com';
  // 未送信
  const bCom = 'https://b.com';
  // 連番記事（上限テスト用）
  const exampleCom = 'https://example.com';
  
  // === 正常系 ===

  /* 観点: 未送信記事のみを返すことができているか */
  it('未送信記事のみを返す', async () => {
    const all = [makeArticle(aCom), makeArticle(bCom)];
    const unsent = [makeArticle(bCom)];
    mockFetchArticles.mockResolvedValue(all);
    mockFilterUnsent.mockResolvedValue(unsent);
    const result = await getNewArticles();
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(bCom);
    // 全記事が渡されていることを検証
    expect(mockFilterUnsent).toHaveBeenCalledWith(all);
  });

  /* 観点: 上限20件を超えた場合は20件のみ返すことができているか */
  it('上限20件を超えた場合は20件のみ返す', async () => {
    const articles = Array.from({ length: 30 }, (_, i) =>
      makeArticle(`${exampleCom}/${i}`)
    );
    mockFetchArticles.mockResolvedValue(articles);
    mockFilterUnsent.mockResolvedValue(articles);
    const result = await getNewArticles();
    expect(result).toHaveLength(20);
  });

  /* 観点: ちょうど20件の場合は全件返すことができているか（境界値） */
  it('ちょうど20件の場合は全件返す（境界値）', async () => {
    const articles = Array.from({ length: 20 }, (_, i) =>
      makeArticle(`${exampleCom}/${i}`)
    );
    mockFetchArticles.mockResolvedValue(articles);
    mockFilterUnsent.mockResolvedValue(articles);
    const result = await getNewArticles();
    expect(result).toHaveLength(20);
  });

  /* 観点: 新着記事が0件の場合は空配列を返すことができているか */
  it('新着0件の場合は空配列を返す', async () => {
    mockFetchArticles.mockResolvedValue([]);
    mockFilterUnsent.mockResolvedValue([]);
    const result = await getNewArticles();
    expect(result).toHaveLength(0);
  });

  /* 観点: 全件送信済みの場合は空配列を返す */
  it('全件送信済みの場合は空配列を返す', async () => {
    const all = [makeArticle(aCom), makeArticle(bCom)];
    mockFetchArticles.mockResolvedValue(all);
    mockFilterUnsent.mockResolvedValue([]); // 全件送信済み
    const result = await getNewArticles();
    expect(result).toHaveLength(0);
    expect(mockFilterUnsent).toHaveBeenCalledWith(all);
  });

  /* 観点: 上限20件を超えた場合、先頭20件が返されることができているか（順序） */
  it('上限20件を超えた場合、先頭20件が返される', async () => {
    const articles = Array.from({ length: 25 }, (_, i) =>
      makeArticle(`${exampleCom}/${i}`)
    );
    mockFetchArticles.mockResolvedValue(articles);
    mockFilterUnsent.mockResolvedValue(articles);
    const result = await getNewArticles();
    expect(result).toHaveLength(20);
    // 先頭から順に取得されていることを確認
    expect(result[0].url).toBe(`${exampleCom}/0`);
    expect(result[19].url).toBe(`${exampleCom}/19`);
  });

  // === 異常系 ===
  /* 観点: RSS取得が失敗した場合にエラーをスローすること */
  const networkError = 'Network Error';
  it('RSS取得が失敗した場合はエラーをスローする', async () => {
    mockFetchArticles.mockRejectedValue(new Error(networkError));
    await expect(getNewArticles()).rejects.toThrow(networkError);
  });

  /* 観点: DynamoDB参照が失敗した場合はエラーをスローする */
  const dynamoDBError = 'DynamoDB Error';
  it('DynamoDB参照が失敗した場合はエラーをスローする', async () => {
    const all = [makeArticle(aCom)];
    mockFetchArticles.mockResolvedValue(all);
    mockFilterUnsent.mockRejectedValue(new Error(dynamoDBError));
    await expect(getNewArticles()).rejects.toThrow(dynamoDBError);
  });
});