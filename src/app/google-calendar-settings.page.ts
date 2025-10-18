import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GoogleCalendarBrowserService, GoogleCalendar, GoogleCalendarEvent } from './google-calendar-browser.service';
import { CalendarSyncService, SyncStatus } from './calendar-sync.service';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-google-calendar-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>📅 Googleカレンダー連携</h1>
        <p>Googleカレンダーとの同期設定を行います</p>
      </div>

      <div class="content">
        <!-- 認証セクション -->
        <div class="card">
          <div class="card-header">
            <h2>🔐 認証設定</h2>
          </div>
          <div class="card-content">
            <div *ngIf="!isAuthenticated" class="auth-section">
              <p>Googleカレンダーと連携するには、まず認証が必要です。</p>
              <button class="btn primary" (click)="startAuth()" [disabled]="loading">
                <span *ngIf="loading">認証中...</span>
                <span *ngIf="!loading">Googleで認証</span>
              </button>
            </div>
            
            <div *ngIf="isAuthenticated" class="auth-section">
              <div class="auth-success">
                <span class="success-icon">✅</span>
                <span>Googleカレンダーに認証済み</span>
              </div>
              <button class="btn secondary" (click)="logout()">
                認証を解除
              </button>
            </div>
          </div>
        </div>

        <!-- 同期設定セクション -->
        <div class="card" *ngIf="isAuthenticated">
          <div class="card-header">
            <h2>🔄 同期設定</h2>
          </div>
          <div class="card-content">
            <div class="sync-status">
              <div class="status-item">
                <span class="label">同期状態:</span>
                <span class="status" [class.syncing]="syncStatus.isSyncing" [class.error]="syncStatus.syncError">
                  <span *ngIf="syncStatus.isSyncing">🔄 同期中...</span>
                  <span *ngIf="!syncStatus.isSyncing && !syncStatus.syncError">✅ 同期済み</span>
                  <span *ngIf="syncStatus.syncError">❌ エラー</span>
                </span>
              </div>
              
              <div class="status-item" *ngIf="syncStatus.lastSyncTime">
                <span class="label">最終同期:</span>
                <span class="value">{{ syncStatus.lastSyncTime | date:'yyyy/MM/dd HH:mm' }}</span>
              </div>
              
              <div class="status-item">
                <span class="label">同期イベント数:</span>
                <span class="value">{{ syncStatus.syncedEvents }} / {{ syncStatus.totalEvents }}</span>
              </div>
              
              <div class="status-item" *ngIf="syncStatus.syncError">
                <span class="label">エラー:</span>
                <span class="error-message">{{ syncStatus.syncError }}</span>
              </div>
            </div>

            <div class="sync-actions">
              <button class="btn primary" (click)="performManualSync()" [disabled]="syncStatus.isSyncing">
                <span *ngIf="syncStatus.isSyncing">同期中...</span>
                <span *ngIf="!syncStatus.isSyncing">手動同期</span>
              </button>
              
              <button class="btn secondary" (click)="resetSync()">
                同期をリセット
              </button>
            </div>
          </div>
        </div>

        <!-- カレンダー一覧セクション -->
        <div class="card" *ngIf="isAuthenticated">
          <div class="card-header">
            <h2>📋 連携カレンダー</h2>
          </div>
          <div class="card-content">
            <div *ngIf="loading" class="loading">
              <span>カレンダーを読み込み中...</span>
            </div>
            
            <div *ngIf="!loading && calendars.length === 0" class="empty-state">
              <span>カレンダーが見つかりません</span>
            </div>
            
            <div *ngIf="!loading && calendars.length > 0" class="calendars-list">
              <div *ngFor="let calendar of calendars" class="calendar-item">
                <div class="calendar-info">
                  <h3>{{ calendar.summary }}</h3>
                  <p *ngIf="calendar.description">{{ calendar.description }}</p>
                  <div class="calendar-meta">
                    <span class="badge" [class.primary]="calendar.primary">
                      {{ calendar.primary ? 'メイン' : 'サブ' }}
                    </span>
                    <span class="access-role">{{ calendar.accessRole }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- イベント一覧セクション -->
        <div class="card" *ngIf="isAuthenticated">
          <div class="card-header">
            <h2>📅 同期イベント</h2>
            <button class="btn small" (click)="loadEvents()" [disabled]="loading">
              更新
            </button>
          </div>
          <div class="card-content">
            <div *ngIf="loading" class="loading">
              <span>イベントを読み込み中...</span>
            </div>
            
            <div *ngIf="!loading && events.length === 0" class="empty-state">
              <span>イベントが見つかりません</span>
            </div>
            
            <div *ngIf="!loading && events.length > 0" class="events-list">
              <div *ngFor="let event of events" class="event-item">
                <div class="event-info">
                  <h4>{{ event.summary }}</h4>
                  <p *ngIf="event.description">{{ event.description }}</p>
                  <div class="event-meta">
                    <span class="date">
                      {{ formatEventDate(event.start) }} - {{ formatEventDate(event.end) }}
                    </span>
                    <span *ngIf="event.location" class="location">📍 {{ event.location }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 設定セクション -->
        <div class="card" *ngIf="isAuthenticated">
          <div class="card-header">
            <h2>⚙️ 同期設定</h2>
          </div>
          <div class="card-content">
            <div class="settings-grid">
              <div class="setting-item">
                <label>
                  <input type="checkbox" [(ngModel)]="autoSyncEnabled" (change)="toggleAutoSync()">
                  自動同期を有効にする
                </label>
                <p class="setting-description">5分間隔で自動的に同期を行います</p>
              </div>
              
              <div class="setting-item">
                <label>
                  <input type="checkbox" [(ngModel)]="syncAppToGoogle" (change)="updateSyncSettings()">
                  アプリ → Googleカレンダー
                </label>
                <p class="setting-description">アプリで作成したイベントをGoogleカレンダーに同期</p>
              </div>
              
              <div class="setting-item">
                <label>
                  <input type="checkbox" [(ngModel)]="syncGoogleToApp" (change)="updateSyncSettings()">
                  Googleカレンダー → アプリ
                </label>
                <p class="setting-description">Googleカレンダーのイベントをアプリに同期</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      box-sizing: border-box;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
      color: white;
      position: relative;
    }

    .back-btn {
      position: absolute;
      left: 2rem;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-50%) scale(1.05);
    }

    .header h1 {
      font-size: 2.5rem;
      margin: 0 0 0.5rem 0;
      font-weight: 700;
    }

    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin: 0;
    }

    .content {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      gap: 2rem;
    }

    .card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .card-header {
      background: rgba(102, 126, 234, 0.1);
      padding: 1.5rem;
      border-bottom: 1px solid rgba(102, 126, 234, 0.2);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h2 {
      margin: 0;
      color: #667eea;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .card-content {
      padding: 1.5rem;
    }

    .auth-section {
      text-align: center;
    }

    .auth-section p {
      margin-bottom: 1.5rem;
      color: #666;
      font-size: 1.1rem;
    }

    .auth-success {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      color: #10b981;
      font-weight: 500;
    }

    .success-icon {
      font-size: 1.2rem;
    }

    .sync-status {
      display: grid;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(102, 126, 234, 0.05);
      border-radius: 8px;
    }

    .label {
      font-weight: 500;
      color: #374151;
    }

    .status {
      font-weight: 500;
    }

    .status.syncing {
      color: #f59e0b;
    }

    .status.error {
      color: #ef4444;
    }

    .value {
      color: #6b7280;
    }

    .error-message {
      color: #ef4444;
      font-size: 0.9rem;
    }

    .sync-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .calendars-list, .events-list {
      display: grid;
      gap: 1rem;
    }

    .calendar-item, .event-item {
      padding: 1rem;
      background: rgba(102, 126, 234, 0.05);
      border-radius: 8px;
      border: 1px solid rgba(102, 126, 234, 0.1);
    }

    .calendar-info h3, .event-info h4 {
      margin: 0 0 0.5rem 0;
      color: #374151;
      font-size: 1.1rem;
    }

    .calendar-info p, .event-info p {
      margin: 0 0 0.75rem 0;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .calendar-meta, .event-meta {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: #e5e7eb;
      color: #374151;
    }

    .badge.primary {
      background: #dbeafe;
      color: #1e40af;
    }

    .access-role {
      font-size: 0.8rem;
      color: #6b7280;
    }

    .date, .location {
      font-size: 0.9rem;
      color: #6b7280;
    }

    .settings-grid {
      display: grid;
      gap: 1.5rem;
    }

    .setting-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .setting-item label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }

    .setting-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: #667eea;
    }

    .setting-description {
      margin: 0;
      font-size: 0.9rem;
      color: #6b7280;
      margin-left: 1.5rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn.primary {
      background: #667eea;
      color: white;
    }

    .btn.primary:hover:not(:disabled) {
      background: #5a67d8;
      transform: translateY(-1px);
    }

    .btn.secondary {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
      border: 2px solid rgba(102, 126, 234, 0.3);
    }

    .btn.secondary:hover:not(:disabled) {
      background: rgba(102, 126, 234, 0.2);
      transform: translateY(-1px);
    }

    .btn.small {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .loading, .empty-state {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      .header h1 {
        font-size: 2rem;
      }

      .back-btn {
        left: 1rem;
        padding: 6px 12px;
        font-size: 12px;
      }

      .card-header {
        padding: 1rem;
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
      }

      .card-content {
        padding: 1rem;
      }

      .sync-actions {
        flex-direction: column;
      }

      .status-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  `]
})
export class GoogleCalendarSettingsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isAuthenticated = false;
  loading = false;
  syncStatus: SyncStatus = {
    isSyncing: false,
    totalEvents: 0,
    syncedEvents: 0
  };
  calendars: GoogleCalendar[] = [];
  events: GoogleCalendarEvent[] = [];
  
  // 設定
  autoSyncEnabled = true;
  syncAppToGoogle = true;
  syncGoogleToApp = true;

  constructor(
    private googleCalendarService: GoogleCalendarBrowserService,
    private calendarSyncService: CalendarSyncService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // 認証状態を監視
    this.googleCalendarService.getAuthStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAuthenticated => {
        this.isAuthenticated = isAuthenticated;
        if (isAuthenticated) {
          this.loadCalendars();
          this.loadEvents();
        }
      });

    // 同期状態を監視
    this.calendarSyncService.getSyncStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.syncStatus = status;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/main']);
  }

  async startAuth(): Promise<void> {
    this.loading = true;
    try {
      console.log('Google認証開始');
      this.googleCalendarService.startAuth();
    } catch (error) {
      console.error('認証エラー:', error);
      alert('認証に失敗しました: ' + (error as Error).message);
    } finally {
      this.loading = false;
    }
  }

  logout(): void {
    this.googleCalendarService.logout();
    this.calendars = [];
    this.events = [];
  }

  async loadCalendars(): Promise<void> {
    this.loading = true;
    try {
      this.calendars = await firstValueFrom(this.googleCalendarService.getCalendars()) || [];
    } catch (error) {
      console.error('カレンダー取得エラー:', error);
      alert('カレンダーの取得に失敗しました: ' + (error as Error).message);
    } finally {
      this.loading = false;
    }
  }

  async loadEvents(): Promise<void> {
    this.loading = true;
    try {
      this.events = await firstValueFrom(this.googleCalendarService.getEvents()) || [];
    } catch (error) {
      console.error('イベント取得エラー:', error);
      alert('イベントの取得に失敗しました: ' + (error as Error).message);
    } finally {
      this.loading = false;
    }
  }

  async performManualSync(): Promise<void> {
    try {
      await this.calendarSyncService.performManualSync();
    } catch (error) {
      console.error('手動同期エラー:', error);
      alert('同期に失敗しました: ' + (error as Error).message);
    }
  }

  async resetSync(): Promise<void> {
    if (confirm('同期をリセットしますか？この操作は取り消せません。')) {
      try {
        await this.calendarSyncService.resetSync();
        this.calendars = [];
        this.events = [];
      } catch (error) {
        console.error('同期リセットエラー:', error);
        alert('同期のリセットに失敗しました: ' + (error as Error).message);
      }
    }
  }

  toggleAutoSync(): void {
    // 自動同期の有効/無効を切り替え
    if (this.autoSyncEnabled) {
      // 自動同期を開始
      console.log('自動同期を有効にしました');
    } else {
      // 自動同期を停止
      console.log('自動同期を無効にしました');
    }
  }

  updateSyncSettings(): void {
    // 同期設定を更新
    console.log('同期設定を更新:', {
      syncAppToGoogle: this.syncAppToGoogle,
      syncGoogleToApp: this.syncGoogleToApp
    });
  }

  formatEventDate(date: any): string {
    if (!date) return '';
    
    const dateStr = date.dateTime || date.date;
    if (!dateStr) return '';
    
    const eventDate = new Date(dateStr);
    return eventDate.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
