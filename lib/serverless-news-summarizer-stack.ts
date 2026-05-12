import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class NewsSummarizerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda関数：Node.js 22環境
    const summarizerFn = new lambda.Function(this, 'SummarizerFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('src/handlers'), 
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        REGION: this.region,
      },
    });

    // SSM Parameter Storeへのアクセス権限
    summarizerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/news-summarizer/*`,
      ],
    }));

    // EventBridge：起動するスケジュール設定
    new events.Rule(this, 'DailyTrigger', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0' }),
      targets: [new targets.LambdaFunction(summarizerFn)],
    });
  }
}