import { GoogleGenerativeAI } from '@google/generative-ai';
import { Article } from './rss-client';

/* Gemini APIのリトライ設定 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000, 
};

/* 要約プロンプトのテンプレート */
const SUMMARY_PROMPT = (title: string, content: string) => `
    以下の記事を日本語で100〜150文字で要約してください。
    技術的な内容はそのまま残し、体言止めで簡潔にまとめてください。
    余分な前置きや説明は不要です。要約文のみ返してください。

    タイトル: ${title}
    本文: ${content}
    `.trim();

/* 要約された記事の型 */
export type SummarizedArticle = Article & { summary: string };

/**
 * 記事一覧をGemini APIで要約する
 */
export const summarizeArticles = async (
    articles: Article[],
    apiKey: string
): Promise<SummarizedArticle[]> => {
    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-1.5-flash を使用
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const results: SummarizedArticle[] = [];

    for (const article of articles) {
        try {
            const summary = await summarizeWithRetry(model, article);
            results.push({ ...article, summary });
        } catch (error) {
            // 特定の記事で失敗してもスキップして続行
            console.log(JSON.stringify({
                level: 'WARN',
                message: 'Gemini summarization failed, skipping article',
                articleUrl: article.url,
                error: String(error),
                timestamp: new Date().toISOString(),
            }));
        }
    }

  return results;
};

/**
 * 指数バックオフでリトライする内部関数
 */
const summarizeWithRetry = async (
    model: any,
    article: Article
): Promise<string> => {
  let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            // Gemini APIにプロンプトを送信して要約を取得
            const prompt = SUMMARY_PROMPT(article.title, article.content);
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            lastError = error;
            if (attempt < RETRY_CONFIG.maxRetries) {
                const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    throw lastError;
};