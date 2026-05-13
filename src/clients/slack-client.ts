import { SummarizedArticle } from './gemini-client';

/* Slack通知のリトライ設定 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
};

/* 数字を絵文字に変換するマッピング */
const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣',
                       '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/**
 * Slack Block Kit形式でダイジェスト通知を送信する
 */
export const sendDigest = async (
    articles: SummarizedArticle[],
    webhookUrl: string
): Promise<void> => {
    if (articles.length === 0) return;

    // Block Kitのブロック配列を構築
    const blocks = buildBlocks(articles);
    await postWithRetry(webhookUrl, { blocks });
};

/**
 * Block Kitのブロック配列を構築する
 */
const buildBlocks = (articles: SummarizedArticle[]): object[] => {
    const today = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
        timeZone: 'Asia/Tokyo',
    });

    // ヘッダーと概要セクション
    const blocks: object[] = [
        {
        type: 'header',
        text: { type: 'plain_text', text: '📰 Tech News Digest', emoji: true },
        },
        {
        type: 'section',
        text: {
            type: 'mrkdwn',
            text: `*${today}*　｜　新着 *${articles.length}* 件`,
        },
        },
        { type: 'divider' },
    ];

    // 記事ごとにセクションブロックを追加
    articles.forEach((article, index) => {
        const emoji = NUMBER_EMOJIS[index] ?? `${index + 1}.`;

        blocks.push(
            {
                type: 'section',
                text: {
                type: 'mrkdwn',
                text: `${emoji}  *${article.title}*\n📝 ${article.summary}`,
                },
                accessory: {
                type: 'button',
                text: { type: 'plain_text', text: '元記事を読む', emoji: true },
                url: article.url,
                },
            },
            { type: 'divider' }
        );
    });

    // 最後に配信完了のコンテキストを追加
    blocks.push({
        type: 'context',
        elements: [
            {
                type: 'mrkdwn',
                text: '✅ 本日の配信完了　｜　次回配信: 明日 09:00',
            },
        ],
    });

  return blocks;
};

/**
 * 指数バックオフでリトライしながらWebhookへPOSTする
 */
const postWithRetry = async (
    webhookUrl: string,
    body: object
): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            // WebhookへPOSTリクエストを送信
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(`Slack responded with status: ${res.status}`); return;
        } catch (error) {
            lastError = error;
            // リトライ前に指数バックオフで待機
            if (attempt < RETRY_CONFIG.maxRetries) {
                const delayMs = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    // 全てのリトライが失敗した場合はエラーログを出力
    console.log(JSON.stringify({
        level: 'ERROR',
        message: 'Slack notification failed after all retries',
        error: String(lastError),
        timestamp: new Date().toISOString(),
    }));
};