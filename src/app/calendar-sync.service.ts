import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, orderBy, Timestamp } from '@angular/fire/firestore';
import { GoogleCalendarBrowserService, GoogleCalendarEvent } from './google-calendar-browser.service';
import { BehaviorSubject, Observable, interval, from, throwError, firstValueFrom } from 'rxjs';
import { switchMap, catchError, map, takeUntil } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { CalendarEvent } from './models';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: Date;
  syncError?: string;
  totalEvents: number;
  syncedEvents: number;
}

@Injectable({
  providedIn: 'root'
})
export class CalendarSyncService {
  private firestore = inject(Firestore);
  private googleCalendarService = inject(GoogleCalendarBrowserService);
  private authService = inject(AuthService);

  private syncStatus = new BehaviorSubject<SyncStatus>({
    isSyncing: false,
    totalEvents: 0,
    syncedEvents: 0
  });

  private syncInterval: any = null;
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5分間隔

  constructor() {
    this.initializeSync();
  }

  /**
   * 同期状態を取得
   */
  getSyncStatus(): Observable<SyncStatus> {
    return this.syncStatus.asObservable();
  }

  /**
   * 初期同期を実行
   */
  async performInitialSync(): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    this.updateSyncStatus({ isSyncing: true, syncError: undefined });

    try {
      // Googleカレンダーからイベントを取得
      const googleEvents = await firstValueFrom(this.googleCalendarService.getEvents());
      
      // アプリのカレンダーイベントを取得
      const appEvents = await this.getAppCalendarEvents(currentUser.uid);

      // 同期処理
      await this.syncEvents(googleEvents || [], appEvents);

      this.updateSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        totalEvents: (googleEvents?.length || 0) + appEvents.length,
        syncedEvents: (googleEvents?.length || 0) + appEvents.length
      });

    } catch (error) {
      console.error('初期同期エラー:', error);
      this.updateSyncStatus({
        isSyncing: false,
        syncError: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * リアルタイム同期を開始
   */
  startRealtimeSync(): void {
    if (this.syncInterval) {
      return; // 既に開始済み
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.performIncrementalSync();
      } catch (error) {
        console.error('リアルタイム同期エラー:', error);
      }
    }, this.SYNC_INTERVAL);

    console.log('リアルタイム同期を開始しました');
  }

  /**
   * リアルタイム同期を停止
   */
  stopRealtimeSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('リアルタイム同期を停止しました');
    }
  }

  /**
   * 増分同期を実行
   */
  private async performIncrementalSync(): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return;
    }

    try {
      // 最後の同期時刻以降の変更を取得
      const lastSyncTime = this.syncStatus.value.lastSyncTime;
      const since = lastSyncTime || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間前

      // Googleカレンダーから更新されたイベントを取得
      const googleEvents = await this.getGoogleEventsSince(since);
      
      // アプリのカレンダーイベントから更新されたものを取得
      const appEvents = await this.getAppEventsSince(currentUser.uid, since);

      // 同期処理
      await this.syncEvents(googleEvents, appEvents);

      this.updateSyncStatus({
        isSyncing: false,
        lastSyncTime: new Date(),
        totalEvents: this.syncStatus.value.totalEvents + googleEvents.length + appEvents.length,
        syncedEvents: this.syncStatus.value.syncedEvents + googleEvents.length + appEvents.length
      });

    } catch (error) {
      console.error('増分同期エラー:', error);
      this.updateSyncStatus({
        isSyncing: false,
        syncError: (error as Error).message
      });
    }
  }

  /**
   * イベント同期処理
   */
  private async syncEvents(googleEvents: GoogleCalendarEvent[], appEvents: CalendarEvent[]): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return;
    }

    // Googleカレンダーのイベントをアプリに同期
    for (const googleEvent of googleEvents) {
      await this.syncGoogleEventToApp(googleEvent, currentUser.uid);
    }

    // アプリのイベントをGoogleカレンダーに同期
    for (const appEvent of appEvents) {
      await this.syncAppEventToGoogle(appEvent);
    }
  }

  /**
   * Googleカレンダーイベントをアプリに同期
   */
  private async syncGoogleEventToApp(googleEvent: GoogleCalendarEvent, userId: string): Promise<void> {
    try {
      // 既存のイベントをチェック
      const existingEvent = await this.findAppEventByGoogleId(googleEvent.id!, userId);
      
      if (existingEvent) {
        // 更新
        const appEvent = this.googleCalendarService.convertFromGoogleEvent(googleEvent);
        await this.updateAppCalendarEvent(existingEvent.id, appEvent);
      } else {
        // 新規作成
        const appEvent = this.googleCalendarService.convertFromGoogleEvent(googleEvent);
        appEvent.userId = userId;
        appEvent.googleEventId = googleEvent.id;
        await this.createAppCalendarEvent(appEvent);
      }
    } catch (error) {
      console.error('Googleイベント同期エラー:', error);
    }
  }

  /**
   * アプリイベントをGoogleカレンダーに同期
   */
  private async syncAppEventToGoogle(appEvent: CalendarEvent): Promise<void> {
    try {
      if (appEvent.googleEventId) {
        // 既存のGoogleイベントを更新
        const googleEvent = this.googleCalendarService.convertToGoogleEvent(appEvent);
        await firstValueFrom(this.googleCalendarService.updateEvent(appEvent.googleEventId, googleEvent));
      } else {
        // 新規Googleイベントを作成
        const googleEvent = this.googleCalendarService.convertToGoogleEvent(appEvent);
        const createdEvent = await firstValueFrom(this.googleCalendarService.createEvent(googleEvent));
        
        // アプリイベントにGoogleイベントIDを保存
        if (createdEvent && createdEvent.id) {
          await this.updateAppCalendarEvent(appEvent.id, { googleEventId: createdEvent.id });
        }
      }
    } catch (error) {
      console.error('アプリイベント同期エラー:', error);
    }
  }

  /**
   * 指定時刻以降のGoogleイベントを取得
   */
  private async getGoogleEventsSince(since: Date): Promise<GoogleCalendarEvent[]> {
    try {
      // 注意: Google Calendar APIのtimeMinパラメータを使用
      // 実際の実装では、GoogleCalendarServiceを拡張してtimeMinパラメータを追加する必要があります
      const events = await firstValueFrom(this.googleCalendarService.getEvents());
      return (events || []).filter(event => {
        const eventTime = new Date(event.start.dateTime || event.start.date!);
        return eventTime >= since;
      });
    } catch (error) {
      console.error('Googleイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * 指定時刻以降のアプリイベントを取得
   */
  private async getAppEventsSince(userId: string, since: Date): Promise<CalendarEvent[]> {
    try {
      const eventsRef = collection(this.firestore, 'calendarEvents');
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        where('updatedAt', '>=', Timestamp.fromDate(since)),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CalendarEvent));
    } catch (error) {
      console.error('アプリイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * アプリのカレンダーイベントを取得
   */
  private async getAppCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    try {
      const eventsRef = collection(this.firestore, 'calendarEvents');
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        orderBy('start', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CalendarEvent));
    } catch (error) {
      console.error('アプリカレンダーイベント取得エラー:', error);
      return [];
    }
  }

  /**
   * GoogleイベントIDでアプリイベントを検索
   */
  private async findAppEventByGoogleId(googleEventId: string, userId: string): Promise<CalendarEvent | null> {
    try {
      const eventsRef = collection(this.firestore, 'calendarEvents');
      const q = query(
        eventsRef,
        where('userId', '==', userId),
        where('googleEventId', '==', googleEventId)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      } as CalendarEvent;
    } catch (error) {
      console.error('GoogleイベントID検索エラー:', error);
      return null;
    }
  }

  /**
   * アプリカレンダーイベントを作成
   */
  private async createAppCalendarEvent(event: any): Promise<void> {
    try {
      const eventsRef = collection(this.firestore, 'calendarEvents');
      await addDoc(eventsRef, {
        ...event,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('アプリイベント作成エラー:', error);
      throw error;
    }
  }

  /**
   * アプリカレンダーイベントを更新
   */
  private async updateAppCalendarEvent(eventId: string, updates: any): Promise<void> {
    try {
      const eventRef = doc(this.firestore, 'calendarEvents', eventId);
      await updateDoc(eventRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('アプリイベント更新エラー:', error);
      throw error;
    }
  }

  /**
   * 同期状態を更新
   */
  private updateSyncStatus(updates: Partial<SyncStatus>): void {
    const currentStatus = this.syncStatus.value;
    this.syncStatus.next({ ...currentStatus, ...updates });
  }

  /**
   * 初期化処理
   */
  private initializeSync(): void {
    // Google認証状態を監視
    this.googleCalendarService.getAuthStatus().subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.startRealtimeSync();
      } else {
        this.stopRealtimeSync();
      }
    });
  }

  /**
   * 手動同期を実行
   */
  async performManualSync(): Promise<void> {
    await this.performInitialSync();
  }

  /**
   * 同期をリセット
   */
  async resetSync(): Promise<void> {
    this.stopRealtimeSync();
    this.updateSyncStatus({
      isSyncing: false,
      lastSyncTime: undefined,
      syncError: undefined,
      totalEvents: 0,
      syncedEvents: 0
    });
  }
}
