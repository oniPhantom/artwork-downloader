# Vercel自動デプロイ設定ガイド

## 🚀 自動デプロイの設定手順

### 1. VERCEL_TOKEN の取得

#### 手順:
1. [Vercel](https://vercel.com/)にGitHubアカウントでログイン
2. 右上のアカウントアイコン → **"Settings"**
3. 左サイドバーの **"Tokens"** をクリック
4. **"Create Token"** をクリック
5. Token name: `GitHub Actions` (任意の名前)
6. Scope: **"Full Account"** を選択
7. **"Create"** をクリック
8. 表示されたトークンをコピー（⚠️ 一度しか表示されません）

### 2. GitHub Secrets の設定

#### 手順:
1. GitHubリポジトリの **Settings** タブ
2. **"Secrets and variables"** > **"Actions"**
3. **"New repository secret"** をクリック
4. 以下のSecretを追加:

| Name | Value | 取得方法 |
|------|-------|----------|
| `VERCEL_TOKEN` | `vercel_xxxxxxxxx...` | 上記で作成したトークン |

**⚠️ 重要**: `VERCEL_ORG_ID`と`VERCEL_PROJECT_ID`は不要です（`.vercel/project.json`から自動取得）

### 3. プロジェクトがVercelにリンクされていることを確認

リポジトリには既に `.vercel/project.json` が含まれているので設定完了です:
```json
{
  "projectId": "prj_bnKhiahR7EwKzxI77WEe6J4RaGGZ",
  "orgId": "team_KSObQtbqOAdmfU90wdKYBeAQ", 
  "projectName": "artwork-downloader"
}
```

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