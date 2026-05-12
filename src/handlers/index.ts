export const handler = async (): Promise<void> => {
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Hello World - Serverless News Summarizer',
    timestamp: new Date().toISOString(),
  }));
};