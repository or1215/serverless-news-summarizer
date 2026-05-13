import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const client = new SSMClient({ region: process.env.REGION });

const getParameter = async (name: string): Promise<string> => {
  const { Parameter } = await client.send(
    new GetParameterCommand({ Name: name, WithDecryption: true })
  );

  if (!Parameter?.Value) {
    throw new Error(`SSM parameter not found: ${name}`);
  }

  return Parameter.Value;
};

export type Secrets = {
  geminiApiKey: string;
  slackWebhookUrl: string;
};

export const getSecrets = async (): Promise<Secrets> => {
  const [geminiApiKey, slackWebhookUrl] = await Promise.all([
    getParameter('/news-summarizer/gemini-api-key'),
    getParameter('/news-summarizer/slack-webhook-url'),
  ]);

  return { geminiApiKey, slackWebhookUrl };
};