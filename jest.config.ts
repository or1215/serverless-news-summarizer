import type { Config } from 'jest';

/**
 * テストの対象となる記事の型
 */
const config: Config = {
  // TypeScriptファイルを直接実行
  preset: 'ts-jest',

  // 実行環境
  testEnvironment: 'node',

  // テストファイルの場所を指定
  testMatch: ['**/test/**/*.test.ts'],

  // 各テストの実行前にモックの状態をリセットする設定
  clearMocks: true,

  //カバレッジの出力先などを指定したい場合
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
};

export default config;