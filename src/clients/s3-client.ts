/**
 * 生成された静的コンテンツ（HTML）を
 * 対象の Amazon S3 バケットへ転送・配置するためのクライアントモジュール。
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// S3クライアントの初期化。AWS環境（Lambda実行環境等）からリージョンを取得。
const client = new S3Client({ region: process.env.REGION });

/**
 * 生成されたHTML文字列を、環境変数で指定されたS3バケットへアップロードする。
 */
export const uploadHtml = async (html: string): Promise<void> => {
  // 環境変数の存在検証（SITE_BUCKET_NAMEが未定義の場合は処理を中断）
  if (!process.env.SITE_BUCKET_NAME) {
    throw new Error('Environment variable SITE_BUCKET_NAME is not defined.');
  }

  // PutObjectCommand を用いて、S3へファイルをアップロード
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.SITE_BUCKET_NAME,
      Key: 'index.html',                     // 公開されるメインファイル名
      Body: html,                            // HTMLソース本体
      ContentType: 'text/html; charset=utf-8', // ブラウザで正しくレンダリングさせるためのMIMEタイプ
      CacheControl: 'no-cache, no-store, must-revalidate', // 毎日更新されるニュースのため、キャッシュを強制的に無効化
    })
  );

  // 監査ログ：アップロード完了および関連メタデータの記録
  console.log(JSON.stringify({
    level: 'INFO',
    message: 'Site HTML uploaded to S3 successfully',
    url: process.env.CLOUDFRONT_URL,
    timestamp: new Date().toISOString(),
  }));
};