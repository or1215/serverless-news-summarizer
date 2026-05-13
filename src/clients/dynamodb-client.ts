/**
 * DynamoDBクライアント
 * 送信済み記事の管理に使用します
 * - filterUnsentArticles: 送信前に重複を排除するため、既に送信済みの記事をフィルタリングします
 * - markArticlesAsSent: 記事を送信済みとしてDynamoDBに記録します（TTL付きで古いレコードは自動削除されます）
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { Article } from './rss-client';

const TABLE_NAME = process.env.ARTICLES_TABLE_NAME!; // CDKで環境変数として渡されるテーブル名
const TTL_DAYS = 30; // 自動削除までの日数

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * 送信済みでない記事のみを返す（重複排除）
 */
export const filterUnsentArticles = async (articles: Article[]): Promise<Article[]> => {
    if (articles.length === 0) return [];

    // 最大100件ずつチェック（DynamoDBのBatchGet制限）
    const keys = articles.map((a) => ({ url: a.url }));
    const { Responses } = await docClient.send(
    new BatchGetCommand({
        RequestItems: {
        [TABLE_NAME]: { Keys: keys },
        },
    })
    );

    const sentUrls = new Set(
    (Responses?.[TABLE_NAME] ?? []).map((item) => item.url as string)
    );

    return articles.filter((a) => !sentUrls.has(a.url));
};

/**
 * 記事を送信済みとして記録する
 */
export const markArticlesAsSent = async (articles: Article[]): Promise<void> => {

    // TTLを設定して、古いレコードは自動的削除
    const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60; // 現在のUnix時間 + 30日分の秒数

    for (const article of articles) {
    await docClient.send(
        new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            url: article.url,
            title: article.title,
            sentAt: new Date().toISOString(),
            ttl,
        },
        })
    );
    }
};