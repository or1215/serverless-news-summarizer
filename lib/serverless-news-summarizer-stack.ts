import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class NewsSummarizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* 関数の作成 */    
    // DynamoDBテーブル（送信済み記事管理）
    const articlesTable = new dynamodb.Table(this, 'ArticlesTable', {
      tableName: 'news-summarizer-articles',
      partitionKey: { name: 'url', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 無料枠内で運用
      timeToLiveAttribute: 'ttl', // 古いレコードを自動削除
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発中のみ。本番はRETAIN推奨
    });
    
    // Lambda関数：Node.js 22環境
    const summarizerFn = new lambda_nodejs.NodejsFunction(this, 'SummarizerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      entry: 'src/handlers/index.ts', // エントリポイントを直接指定
      handler: 'handler',            // 以前と同様
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: this.region,
        ARTICLES_TABLE_NAME: articlesTable.tableName, // 環境変数を確実に渡す
      },
      bundling: {
        minify: true, // コードを軽量化
        sourceMap: true, // エラー時に元のコードの場所を特定しやすくする
      },
    });

    /* 権限設定 */
    // LambdaにDynamoDBへのアクセス権限を付与
    articlesTable.grantReadWriteData(summarizerFn);
    // テーブル名をLambdaの環境変数として渡す
    summarizerFn.addEnvironment('ARTICLES_TABLE_NAME', articlesTable.tableName);

    // SSM Parameter Storeへのアクセス権限
    summarizerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/news-summarizer/*`,
      ],
    }));

    /* イベント設定 */
    // EventBridge：起動するスケジュール設定
    new events.Rule(this, 'DailyTrigger', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(summarizerFn)],
    });
  }

}