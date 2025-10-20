// Google Calendar API 設定
// 実際の値は Google Cloud Console で取得してください

export const GOOGLE_CALENDAR_CONFIG = {
  // Google Cloud Console で作成した OAuth 2.0 クライアントID
  CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  
  // Google Cloud Console で作成した OAuth 2.0 クライアントシークレット
  CLIENT_SECRET: 'YOUR_GOOGLE_CLIENT_SECRET',
  
  // リダイレクトURI（Google Cloud Console で設定したものと一致させる）
  REDIRECT_URI: 'http://localhost:4200/auth/google/callback',
  
  // 必要なスコープ
  SCOPES: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  
  // API キー（必要に応じて）
  API_KEY: 'YOUR_GOOGLE_API_KEY'
};

// 設定手順:
// 1. Google Cloud Console (https://console.cloud.google.com/) にアクセス
// 2. 新しいプロジェクトを作成または既存のプロジェクトを選択
// 3. 「APIとサービス」→「ライブラリ」で「Google Calendar API」を有効化
// 4. 「APIとサービス」→「認証情報」で「OAuth 2.0 クライアントID」を作成
// 5. アプリケーションの種類: 「ウェブアプリケーション」
// 6. 承認済みのリダイレクトURI: http://localhost:4200/auth/google/callback
// 7. 作成されたクライアントIDとクライアントシークレットを上記の値に設定

