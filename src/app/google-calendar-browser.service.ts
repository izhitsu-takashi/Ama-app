import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { GOOGLE_CALENDAR_CONFIG } from '../environments/google-calendar.config';

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  colorId?: string;
  source?: {
    title: string;
    url: string;
  };
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleCalendarBrowserService {
  private auth: any = null;
  private isAuthenticated = new BehaviorSubject<boolean>(false);
  private accessToken = new BehaviorSubject<string | null>(null);
  private refreshToken = new BehaviorSubject<string | null>(null);

  // Google OAuth 2.0 設定
  private readonly CLIENT_ID = GOOGLE_CALENDAR_CONFIG.CLIENT_ID;
  private readonly CLIENT_SECRET = GOOGLE_CALENDAR_CONFIG.CLIENT_SECRET;
  private readonly REDIRECT_URI = GOOGLE_CALENDAR_CONFIG.REDIRECT_URI;
  private readonly SCOPES = GOOGLE_CALENDAR_CONFIG.SCOPES.join(' ');

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth(): void {
    // ローカルストレージからトークンを復元
    const savedAccessToken = localStorage.getItem('google_access_token');
    const savedRefreshToken = localStorage.getItem('google_refresh_token');

    if (savedAccessToken && savedRefreshToken) {
      this.accessToken.next(savedAccessToken);
      this.refreshToken.next(savedRefreshToken);
      this.isAuthenticated.next(true);
    }
  }

  /**
   * Google認証を開始
   */
  startAuth(): void {
    // 現在のURLを保存（認証後に戻るため）
    const currentUrl = window.location.href;
    localStorage.setItem('google_auth_return_url', currentUrl);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${this.CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(this.SCOPES)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${encodeURIComponent(currentUrl)}`;

    console.log('認証URL生成:', {
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      scopes: this.SCOPES,
      auth_url: authUrl
    });

    // 同じウィンドウで認証ページにリダイレクト
    window.location.href = authUrl;
  }

  /**
   * 認証コールバックを処理
   */
  async handleAuthCallback(): Promise<void> {
    try {
      console.log('認証コールバック処理開始');
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const state = urlParams.get('state');

      console.log('URL パラメータ:', { code: code ? 'あり' : 'なし', error, state });

      if (error) {
        console.error('認証エラー:', error);
        alert('認証に失敗しました: ' + error);
        this.redirectToReturnUrl();
        return;
      }

      if (code) {
        console.log('認証コード受信、トークン交換開始');
        const tokens = await this.exchangeCodeForTokens(code);
        
        // トークンをローカルストレージに保存
        localStorage.setItem('google_access_token', tokens.access_token);
        if (tokens.refresh_token) {
          localStorage.setItem('google_refresh_token', tokens.refresh_token);
        }

        this.isAuthenticated.next(true);
        this.accessToken.next(tokens.access_token);
        this.refreshToken.next(tokens.refresh_token || null);

        console.log('認証完了、元のページにリダイレクト');
        // 元のページにリダイレクト
        this.redirectToReturnUrl();
      } else {
        console.log('認証コードが見つかりません');
        this.redirectToReturnUrl();
      }
    } catch (error) {
      console.error('認証エラー:', error);
      alert('認証に失敗しました: ' + (error as Error).message);
      this.redirectToReturnUrl();
    }
  }

  /**
   * 元のページにリダイレクト
   */
  private redirectToReturnUrl(): void {
    const returnUrl = localStorage.getItem('google_auth_return_url') || '/main';
    localStorage.removeItem('google_auth_return_url');
    window.location.href = returnUrl;
  }

  /**
   * 認証コードをトークンに交換
   */
  private async exchangeCodeForTokens(code: string): Promise<any> {
    console.log('トークン交換開始:', { code: code.substring(0, 10) + '...' });
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('トークン交換エラー:', response.status, errorText);
      throw new Error(`トークン交換に失敗しました: ${response.status} ${errorText}`);
    }

    const tokens = await response.json();
    console.log('トークン交換成功:', { 
      access_token: tokens.access_token ? '取得済み' : 'なし',
      refresh_token: tokens.refresh_token ? '取得済み' : 'なし'
    });
    
    return tokens;
  }

  /**
   * 認証状態を取得
   */
  getAuthStatus(): Observable<boolean> {
    return this.isAuthenticated.asObservable();
  }

  /**
   * 認証を解除
   */
  logout(): void {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_refresh_token');
    this.isAuthenticated.next(false);
    this.accessToken.next(null);
    this.refreshToken.next(null);
  }

  /**
   * カレンダー一覧を取得
   */
  getCalendars(): Observable<GoogleCalendar[]> {
    if (!this.isAuthenticated.value) {
      return throwError(() => new Error('Google Calendar API が認証されていません'));
    }

    return from(this.fetchCalendars()).pipe(
      map((response: any) => response.items || []),
      catchError((error) => {
        console.error('カレンダー一覧取得エラー:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * イベント一覧を取得
   */
  getEvents(calendarId: string = 'primary', maxResults: number = 100): Observable<GoogleCalendarEvent[]> {
    if (!this.isAuthenticated.value) {
      return throwError(() => new Error('Google Calendar API が認証されていません'));
    }

    return from(this.fetchEvents(calendarId, maxResults)).pipe(
      map((response: any) => response.items || []),
      catchError((error) => {
        console.error('イベント一覧取得エラー:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * イベントを作成
   */
  createEvent(event: GoogleCalendarEvent, calendarId: string = 'primary'): Observable<GoogleCalendarEvent> {
    if (!this.isAuthenticated.value) {
      return throwError(() => new Error('Google Calendar API が認証されていません'));
    }

    return from(this.createGoogleEvent(event, calendarId)).pipe(
      map((response: any) => response),
      catchError((error) => {
        console.error('イベント作成エラー:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * イベントを更新
   */
  updateEvent(eventId: string, event: GoogleCalendarEvent, calendarId: string = 'primary'): Observable<GoogleCalendarEvent> {
    if (!this.isAuthenticated.value) {
      return throwError(() => new Error('Google Calendar API が認証されていません'));
    }

    return from(this.updateGoogleEvent(eventId, event, calendarId)).pipe(
      map((response: any) => response),
      catchError((error) => {
        console.error('イベント更新エラー:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * イベントを削除
   */
  deleteEvent(eventId: string, calendarId: string = 'primary'): Observable<void> {
    if (!this.isAuthenticated.value) {
      return throwError(() => new Error('Google Calendar API が認証されていません'));
    }

    return from(this.deleteGoogleEvent(eventId, calendarId)).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error('イベント削除エラー:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * カレンダー一覧を取得（内部メソッド）
   */
  private async fetchCalendars(): Promise<any> {
    const accessToken = this.accessToken.value;
    if (!accessToken) {
      throw new Error('アクセストークンがありません');
    }

    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('カレンダー一覧の取得に失敗しました');
    }

    return await response.json();
  }

  /**
   * イベント一覧を取得（内部メソッド）
   */
  private async fetchEvents(calendarId: string, maxResults: number): Promise<any> {
    const accessToken = this.accessToken.value;
    if (!accessToken) {
      throw new Error('アクセストークンがありません');
    }

    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: maxResults.toString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('イベント一覧の取得に失敗しました');
    }

    return await response.json();
  }

  /**
   * Googleイベントを作成（内部メソッド）
   */
  private async createGoogleEvent(event: GoogleCalendarEvent, calendarId: string): Promise<any> {
    const accessToken = this.accessToken.value;
    if (!accessToken) {
      throw new Error('アクセストークンがありません');
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error('イベントの作成に失敗しました');
    }

    return await response.json();
  }

  /**
   * Googleイベントを更新（内部メソッド）
   */
  private async updateGoogleEvent(eventId: string, event: GoogleCalendarEvent, calendarId: string): Promise<any> {
    const accessToken = this.accessToken.value;
    if (!accessToken) {
      throw new Error('アクセストークンがありません');
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error('イベントの更新に失敗しました');
    }

    return await response.json();
  }

  /**
   * Googleイベントを削除（内部メソッド）
   */
  private async deleteGoogleEvent(eventId: string, calendarId: string): Promise<void> {
    const accessToken = this.accessToken.value;
    if (!accessToken) {
      throw new Error('アクセストークンがありません');
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('イベントの削除に失敗しました');
    }
  }

  /**
   * アプリのイベントをGoogleカレンダー形式に変換
   */
  convertToGoogleEvent(appEvent: any): GoogleCalendarEvent {
    return {
      summary: appEvent.title,
      description: appEvent.description || '',
      start: {
        dateTime: appEvent.start,
        date: appEvent.allDay ? appEvent.start.split('T')[0] : undefined
      },
      end: {
        dateTime: appEvent.end,
        date: appEvent.allDay ? appEvent.end.split('T')[0] : undefined
      },
      location: appEvent.location || '',
      colorId: this.getColorId(appEvent.color),
      source: {
        title: 'Ama App',
        url: window.location.origin
      }
    };
  }

  /**
   * Googleカレンダーイベントをアプリ形式に変換
   */
  convertFromGoogleEvent(googleEvent: GoogleCalendarEvent): any {
    return {
      id: googleEvent.id,
      title: googleEvent.summary,
      description: googleEvent.description || '',
      start: googleEvent.start.dateTime || googleEvent.start.date + 'T00:00:00',
      end: googleEvent.end.dateTime || googleEvent.end.date + 'T23:59:59',
      allDay: !googleEvent.start.dateTime,
      location: googleEvent.location || '',
      color: this.getColorFromId(googleEvent.colorId),
      source: 'google',
      attendees: googleEvent.attendees || []
    };
  }

  /**
   * カラーIDを取得
   */
  private getColorId(color: string): string {
    const colorMap: { [key: string]: string } = {
      '#3b82f6': '1', // 青
      '#10b981': '2', // 緑
      '#f59e0b': '3', // オレンジ
      '#ef4444': '4', // 赤
      '#8b5cf6': '5', // 紫
      '#06b6d4': '6', // シアン
      '#84cc16': '7', // ライム
      '#f97316': '8', // オレンジ
      '#ec4899': '9', // ピンク
      '#6b7280': '10' // グレー
    };
    return colorMap[color] || '1';
  }

  /**
   * カラーIDからカラーを取得
   */
  private getColorFromId(colorId?: string): string {
    const colorMap: { [key: string]: string } = {
      '1': '#3b82f6',
      '2': '#10b981',
      '3': '#f59e0b',
      '4': '#ef4444',
      '5': '#8b5cf6',
      '6': '#06b6d4',
      '7': '#84cc16',
      '8': '#f97316',
      '9': '#ec4899',
      '10': '#6b7280'
    };
    return colorMap[colorId || '1'] || '#3b82f6';
  }

  /**
   * 同期状態を取得
   */
  getSyncStatus(): Observable<boolean> {
    return this.isAuthenticated.asObservable();
  }
}
