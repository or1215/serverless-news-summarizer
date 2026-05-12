#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NewsSummarizerStack } from '../lib/serverless-news-summarizer-stack';

const app = new cdk.App();
new NewsSummarizerStack(app, 'NewsSummarizerStack', {
  env: { 
    account: '370442296498', // 先ほど確認したあなたのアカウントID
    region: 'ap-northeast-1', 
  },
});