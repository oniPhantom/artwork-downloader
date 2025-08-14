# Vercel自動デプロイ設定ガイド

## 🚀 自動デプロイの設定手順

### 1. Vercelプロジェクトの作成

1. [Vercel](https://vercel.com/)にログイン
2. "New Project"をクリック
3. GitHubリポジトリを選択してインポート
4. Framework Preset: "Vite"を選択
5. Build and Output Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
6. "Deploy"をクリック

### 2. GitHub Secrets の設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を追加：

```
VERCEL_TOKEN: Vercelアカウント設定から取得
VERCEL_ORG_ID: Vercelプロジェクト設定から取得  
VERCEL_PROJECT_ID: Vercelプロジェクト設定から取得
```

#### 各値の取得方法:

**VERCEL_TOKEN:**
1. Vercel Dashboard > Settings > Tokens
2. "Create Token"で新しいトークンを作成

**VERCEL_ORG_ID & VERCEL_PROJECT_ID:**
1. プロジェクトルートで `npx vercel link` 実行
2. `.vercel/project.json`ファイルから値をコピー

### 3. 自動デプロイの確認

- **mainブランチにpush** → 本番環境にデプロイ
- **他のブランチにpush/PR** → プレビュー環境にデプロイ

## 📁 ファイル構成

```
.github/workflows/deploy.yml  # GitHub Actions設定
vercel.json                   # Vercel設定
api/proxy.js                  # Serverless Function
```

## 🔧 設定ファイル説明

### vercel.json
- Serverless Functions設定
- ルーティング設定
- 自動デプロイ有効化

### deploy.yml  
- GitHub Actions ワークフロー
- ビルドとデプロイの自動化
- プレビュー環境対応

## 🔍 トラブルシューティング

### デプロイが失敗する場合:
1. GitHub Secretsが正しく設定されているか確認
2. Vercelプロジェクトの設定を確認
3. ビルドログでエラーメッセージを確認

### API接続エラーの場合:
1. Serverless Functionが正しくデプロイされているか確認
2. ブラウザのコンソールでエラーログを確認
3. 設定画面から「エラーログを表示」で詳細確認

## 📝 手動デプロイ方法

緊急時の手動デプロイ:
```bash
npx vercel --prod
```