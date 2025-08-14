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

### ❌ エラー: "No existing credentials found"
**原因**: VERCEL_TOKENが設定されていない
**解決**: 
1. VercelでTokenを作成
2. GitHub Secretsに`VERCEL_TOKEN`を追加
3. Tokenの値が正しくコピーされているか確認

### ❌ エラー: "Input required and not supplied: vercel-token"  
**原因**: GitHub Actionでトークンが取得できない
**解決**:
1. GitHub Secrets名が`VERCEL_TOKEN`（大文字小文字一致）か確認
2. リポジトリの Settings > Secrets で設定状況確認

### ❌ ビルドが失敗する場合:
**確認項目**:
1. `npm run build`がローカルで成功するか
2. Node.jsバージョンが18以上か
3. package.jsonの依存関係が正しいか

### ✅ デプロイ成功の確認:
1. GitHub Actions のログで緑チェック
2. Vercel DashboardでDeployment Status確認
3. 本番URLでアプリが動作するか確認

### API接続エラーの場合:
1. Serverless Functionが正しくデプロイされているか確認
2. ブラウザのコンソールでエラーログを確認
3. 設定画面から「エラーログを表示」で詳細確認

## 📝 手動デプロイ方法

緊急時の手動デプロイ:
```bash
npx vercel --prod
```