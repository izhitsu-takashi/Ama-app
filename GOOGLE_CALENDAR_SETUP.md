# Googleカレンダー連携設定手順

## 📋 概要
このアプリでGoogleカレンダーとの連携機能を使用するための設定手順です。

## 🔧 必要な準備

### 1. Google Cloud Console での設定

#### 1.1 プロジェクトの作成
1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. プロジェクト名を記録しておく

#### 1.2 Google Calendar API の有効化
1. 「APIとサービス」→「ライブラリ」をクリック
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

#### 1.3 OAuth 2.0 クライアントIDの作成
1. 「APIとサービス」→「認証情報」をクリック
2. 「認証情報を作成」→「OAuth 2.0 クライアントID」を選択
3. アプリケーションの種類: 「ウェブアプリケーション」
4. 名前: 任意の名前（例: "AMA App Calendar Integration"）
5. 承認済みのリダイレクトURI: `http://localhost:4200/auth/google/callback`
6. 「作成」をクリック
7. **重要**: 表示されるクライアントIDとクライアントシークレットをコピーして保存

### 2. アプリケーション設定

#### 2.1 設定ファイルの更新
`src/environments/google-calendar.config.ts` ファイルを開き、以下の値を更新：

```typescript
export const GOOGLE_CALENDAR_CONFIG = {
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // ← ここにクライアントIDを設定
  CLIENT_SECRET: 'YOUR_GOOGLE_CLIENT_SECRET', // ← ここにクライアントシークレットを設定
  REDIRECT_URI: 'http://localhost:4200/auth/google/callback',
  SCOPES: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  API_KEY: 'YOUR_GOOGLE_API_KEY' // 必要に応じて
};
```

#### 2.2 本番環境での設定
本番環境で使用する場合は、以下も更新：
- `REDIRECT_URI` を本番ドメインに変更
- Google Cloud Console の承認済みリダイレクトURIにも本番URLを追加

## 🚀 使用方法

### 1. 認証の開始
1. アプリのメインページで「📅 Googleカレンダー連携」ボタンをクリック
2. 「Googleで認証」ボタンをクリック
3. Googleの認証画面でアカウントを選択し、権限を許可

### 2. 同期設定
1. 認証完了後、同期設定画面で以下を設定：
   - **自動同期**: 5分間隔で自動同期を有効/無効
   - **アプリ → Googleカレンダー**: アプリで作成したイベントをGoogleカレンダーに同期
   - **Googleカレンダー → アプリ**: Googleカレンダーのイベントをアプリに同期

### 3. 手動同期
- 「手動同期」ボタンで即座に同期を実行
- 「同期をリセット」ボタンで同期状態をリセット

## 🔄 同期機能

### 自動同期
- 5分間隔で自動的にイベントを同期
- 認証状態を監視し、認証が切れた場合は自動停止

### リアルタイム同期
- アプリでイベントを作成/更新/削除 → Googleカレンダーに反映
- Googleカレンダーでイベントを作成/更新/削除 → アプリに反映

### 同期されるデータ
- イベントタイトル
- 説明
- 開始日時・終了日時
- 場所
- 参加者
- 色（優先度）

## ⚠️ 注意事項

### セキュリティ
- クライアントシークレットは機密情報です。GitHubなどにコミットしないでください
- 本番環境では環境変数を使用することを推奨

### 制限事項
- Google Calendar API には利用制限があります
- 大量のイベントがある場合は同期に時間がかかる場合があります

### トラブルシューティング
- 認証エラー: クライアントIDとシークレットが正しく設定されているか確認
- 同期エラー: ネットワーク接続とGoogle Calendar APIの利用制限を確認
- 権限エラー: 必要なスコープが正しく設定されているか確認

## 📞 サポート
設定で問題が発生した場合は、以下を確認してください：
1. Google Cloud Console の設定
2. アプリケーションの設定ファイル
3. ブラウザのコンソールエラー
4. ネットワーク接続

## 🔗 関連リンク
- [Google Calendar API ドキュメント](https://developers.google.com/calendar/api)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 設定ガイド](https://developers.google.com/identity/protocols/oauth2)

