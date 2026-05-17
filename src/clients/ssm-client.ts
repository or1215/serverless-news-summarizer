/**
 * AWS Systems Manager (SSM) Parameter Store から
 * アプリケーションの秘匿情報を取得するためのクライアントモジュール。
 */
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: process.env.REGION });

/**
 * 指定されたパラメータ名に対応する値を SSM Parameter Store から取得する
 */
const getParameter = async (name: string): Promise<string> => {
  // SSMからパラメータを取得
  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );

  if (!Parameter?.Value) {
    throw new Error(`SSM parameter not found: ${name}`);
  }

  return Parameter.Value;
};

/**
 * 外部へ公開する秘密情報のオブジェクト型定義
 */
export type Secrets = {
  geminiApiKey: string;
  slackWebhookUrl: string;
};

/**
 * 外部モジュールから呼び出される一括取得
 */
export const getSecrets = async (): Promise<Secrets> => {
  // I/Oのブロッキングを防止するため、Promise.all を用いて並列（同時）リクエストを実行
  const [geminiApiKey, slackWebhookUrl] = await Promise.all([
    getParameter('/news-summarizer/gemini-api-key'),
    getParameter('/news-summarizer/slack-webhook-url'),
  ]);

  return { geminiApiKey, slackWebhookUrl };
};