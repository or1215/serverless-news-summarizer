import { getNewArticles, sendAlert } from '../services/article-service';
import { getSecrets } from '../clients/ssm-client';
import { summarizeArticles } from '../clients/gemini-client';
import { sendDigest } from '../clients/slack-client';
import { markArticlesAsSent } from '../clients/dynamodb-client';

export const handler = async (): Promise<void> => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Lambda invoked',
    timestamp: new Date().toISOString(),
  }));

  let slackUrl = '';

  try {
    // 1. シークレット取得
    const secrets = await getSecrets();
    slackUrl = secrets.slackWebhookUrl;

    // 2. 未送信記事の取得
    const articles = await getNewArticles();

    if (articles.length === 0) {
      console.log(JSON.stringify({
        level: 'INFO',
        message: 'No new articles. Skipping notification.',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // 3. Gemini APIで要約
    const summarized = await summarizeArticles(articles, secrets.geminiApiKey);

    if (summarized.length === 0) {
      console.log(JSON.stringify({
        level: 'WARN',
        message: 'All articles failed to summarize. Skipping notification.',
        timestamp: new Date().toISOString(),
      }));
      return;
    }

    // 4. Slackへダイジェスト通知
    await sendDigest(summarized, secrets.slackWebhookUrl);

    // 5. 送信済みをDynamoDBに記録（通知成功後に実行）
    await markArticlesAsSent(summarized);

    console.log(JSON.stringify({
      level: 'INFO',
      message: 'Digest sent successfully',
      count: summarized.length,
      timestamp: new Date().toISOString(),
    }));

  } catch (error) {
    console.log(JSON.stringify({
      level: 'ERROR',
      message: 'Unexpected error in handler',
      error: String(error),
      timestamp: new Date().toISOString(),
    }));

    // 致命的エラーはSlackへアラート送信
    if (slackUrl) {
      await sendAlert(error, slackUrl);
    }
    throw error;
  }
};