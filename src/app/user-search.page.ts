import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { TaskService } from './task.service';
import { User, CalendarEvent } from './models';
import { Subject, takeUntil } from 'rxjs';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-user-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>🔍 ユーザー検索</h1>
        <p>アプリに登録されているユーザーを検索・表示します</p>
      </div>

      <div class="content">
        <!-- 検索セクション -->
        <div class="card">
          <div class="card-header">
            <h2>🔍 検索</h2>
          </div>
          <div class="card-content">
            <div class="search-section">
              <div class="search-input-group">
                <input 
                  type="text" 
                  [(ngModel)]="searchTerm" 
                  (input)="onSearch()"
                  placeholder="ユーザー名またはメールアドレスで検索..."
                  class="search-input"
                >
                <button class="search-btn" (click)="onSearch()">
                  🔍
                </button>
              </div>
              
            </div>
          </div>
        </div>

        <!-- ユーザー一覧セクション -->
        <div class="card">
          <div class="card-header">
            <h2>👤 ユーザー一覧</h2>
            <div class="user-count">
              {{ filteredUsers.length }} / {{ allUsers.length }} ユーザー
            </div>
          </div>
          <div class="card-content">
            <div *ngIf="loading" class="loading">
              <div class="spinner"></div>
              <span>ユーザーを読み込み中...</span>
            </div>
            
            <div *ngIf="!loading && filteredUsers.length === 0" class="empty-state">
              <div *ngIf="searchTerm; else noUsers">
                <span>「{{ searchTerm }}」に一致するユーザーが見つかりません</span>
                <button class="clear-search-btn" (click)="clearSearch()">
                  検索をクリア
                </button>
              </div>
              <ng-template #noUsers>
                <span>ユーザーが見つかりません</span>
              </ng-template>
            </div>
            
            <div *ngIf="!loading && filteredUsers.length > 0" class="users-list">
              <div *ngFor="let user of filteredUsers" class="user-item">
                <div class="user-avatar">
                  <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || 'ユーザー'">
                  <div *ngIf="!user.photoURL" class="default-avatar">
                    {{ getUserInitials(user) }}
                  </div>
                </div>
                
                <div class="user-info">
                  <div class="user-name-row">
                    <h3 class="user-name">{{ user.displayName || '名前未設定' }}</h3>
                    <span class="busy-status" [class]="'status-' + getUserBusyStatus(user.id)">
                      {{ getBusyStatusText(user.id) }}
                    </span>
                  </div>
                  <p class="user-email">{{ user.email }}</p>
                  <div class="user-meta">
                    <span class="user-role" [class]="'role-' + user.role">
                      {{ getRoleLabel(user.role) }}
                    </span>
                    <span class="user-joined">
                      登録日: {{ formatDate(user.createdAt) }}
                    </span>
                  </div>
                  
                  <!-- ユーザーの現在の予定 -->
                  <div class="user-schedule">
                    <div class="schedule-item" *ngIf="getUserCurrentEvent(user.id); else noSchedule">
                      <span class="schedule-icon">📅</span>
                      <span class="schedule-text">{{ getUserCurrentEvent(user.id)?.title }}</span>
                    </div>
                    <ng-template #noSchedule>
                      <div class="schedule-item no-schedule">
                        <span class="schedule-icon">📅</span>
                        <span class="schedule-text">予定がありません</span>
                      </div>
                    </ng-template>
                  </div>
                  
                  <!-- 直近3日のタスク数 -->
                  <div class="user-tasks">
                    <div class="task-count">
                      <span class="task-icon">📋</span>
                      <span class="task-text">直近3日: {{ getUserRecentTaskCount(user.id) }}件のタスク</span>
                    </div>
                  </div>
                </div>
                
                <div class="user-actions">
                  <button class="action-btn secondary" (click)="sendMessage(user)">
                    メッセージ
                  </button>
                </div>
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

    .user-count {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
    }

    .card-content {
      padding: 1.5rem;
    }

    .search-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .search-input-group {
      display: flex;
      gap: 0.5rem;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s ease;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .search-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s ease;
    }

    .search-btn:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }


    .users-list {
      display: grid;
      gap: 1rem;
    }

    .user-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: rgba(102, 126, 234, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(102, 126, 234, 0.1);
      transition: all 0.2s ease;
    }

    .user-item:hover {
      background: rgba(102, 126, 234, 0.1);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    .user-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-avatar {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .user-name {
      margin: 0;
      color: #374151;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .busy-status {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      white-space: nowrap;
    }

    .status-busy {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .status-working {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
      border: 1px solid rgba(245, 158, 11, 0.2);
    }

    .status-free {
      background: rgba(34, 197, 94, 0.1);
      color: #16a34a;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .user-email {
      margin: 0 0 0.5rem 0;
      color: #6b7280;
      font-size: 0.9rem;
    }

    .user-meta {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .user-role {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .role-admin {
      background: #fef3c7;
      color: #92400e;
    }

    .role-user {
      background: #dbeafe;
      color: #1e40af;
    }

    .user-joined {
      font-size: 0.8rem;
      color: #6b7280;
    }

    .user-schedule {
      margin-top: 0.5rem;
    }

    .schedule-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 6px;
      border-left: 3px solid #10b981;
    }

    .schedule-icon {
      font-size: 0.9rem;
    }

    .schedule-text {
      font-size: 0.85rem;
      color: #059669;
      font-weight: 500;
    }

    .schedule-item.no-schedule {
      background: rgba(107, 114, 128, 0.1);
      border-left-color: #6b7280;
    }

    .schedule-item.no-schedule .schedule-text {
      color: #6b7280;
    }

    .user-tasks {
      margin-top: 0.5rem;
    }

    .task-count {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }

    .task-icon {
      font-size: 0.9rem;
    }

    .task-text {
      font-size: 0.85rem;
      color: #2563eb;
      font-weight: 500;
    }

    .user-actions {
      display: flex;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .action-btn.primary {
      background: #667eea;
      color: white;
    }

    .action-btn.primary:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }

    .action-btn.secondary {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
      border: 1px solid rgba(102, 126, 234, 0.3);
    }

    .action-btn.secondary:hover {
      background: rgba(102, 126, 234, 0.2);
      transform: translateY(-1px);
    }


    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem;
      color: #6b7280;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
    }

    .clear-search-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      margin-top: 1rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .clear-search-btn:hover {
      background: #5a67d8;
      transform: translateY(-1px);
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

      .user-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .user-actions {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class UserSearchPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  allUsers: User[] = [];
  filteredUsers: User[] = [];
  searchTerm = '';
  loading = false;
  userCurrentEvents: Map<string, CalendarEvent> = new Map();
  userRecentTaskCounts: Map<string, number> = new Map();

  constructor(
    private userService: UserService,
    private taskService: TaskService,
    private router: Router,
    private firestore: Firestore
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/main']);
  }

  loadUsers(): void {
    this.loading = true;
    this.userService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.allUsers = users;
        this.filteredUsers = [...this.allUsers];
        this.loadUserData();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('ユーザー取得エラー:', error);
        alert('ユーザーの取得に失敗しました: ' + (error as Error).message);
        this.loading = false;
      }
    });
  }

  private loadUserData(): void {
    // 各ユーザーの現在の予定とタスク数を取得
    this.allUsers.forEach(user => {
      this.loadUserCurrentEvent(user.id);
      this.loadUserRecentTaskCount(user.id);
    });
  }

  private loadUserCurrentEvent(userId: string): void {
    // 現在時刻の予定を取得
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // 分単位で現在時刻を計算
    
    // Firestoreから今日の予定を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const eventsQuery = query(
      collection(this.firestore, 'calendarEvents'),
      where('userId', '==', userId)
    );
    
    getDocs(eventsQuery).then(snapshot => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
      
      // 今日の予定をフィルタリング
      const todayEvents = events.filter(event => {
        if (!event.startDate) return false;
        const startDate = event.startDate.toDate ? event.startDate.toDate() : new Date(event.startDate);
        const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate || event.startDate);
        
        // 今日の日付かチェック
        const isToday = startDate.toDateString() === now.toDateString();
        if (!isToday) return false;
        
        // 現在時刻が予定の時間内かチェック
        const startTime = startDate.getHours() * 60 + startDate.getMinutes();
        const endTime = endDate.getHours() * 60 + endDate.getMinutes();
        
        return currentTime >= startTime && currentTime <= endTime;
      });
      
      // 現在進行中の予定があれば設定
      if (todayEvents.length > 0) {
        this.userCurrentEvents.set(userId, todayEvents[0]);
      }
    }).catch(error => {
      console.error('予定取得エラー:', error);
    });
  }

  private loadUserRecentTaskCount(userId: string): void {
    // 直近3日のタスク数を取得
    this.taskService.getUserTasks(userId).subscribe({
      next: (tasks) => {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        const recentTasks = tasks.filter(task => {
          const taskDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          return taskDate >= threeDaysAgo;
        });
        
        this.userRecentTaskCounts.set(userId, recentTasks.length);
      },
      error: (error) => {
        console.error('タスク取得エラー:', error);
        this.userRecentTaskCounts.set(userId, 0);
      }
    });
  }

  onSearch(): void {
    this.filterUsers();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filterUsers();
  }

  private filterUsers(): void {
    let users = [...this.allUsers];

    // 検索条件でフィルタリング
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      users = users.filter(user => 
        (user.displayName && user.displayName.toLowerCase().includes(term)) ||
        user.email.toLowerCase().includes(term)
      );
    }


    this.filteredUsers = users;
  }

  getUserInitials(user: User): string {
    if (user.displayName) {
      return user.displayName.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email[0].toUpperCase();
  }

  getRoleLabel(role: string): string {
    return role === 'admin' ? '管理者' : 'ユーザー';
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '不明';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }



  getUserCurrentEvent(userId: string): CalendarEvent | undefined {
    return this.userCurrentEvents.get(userId);
  }

  getUserRecentTaskCount(userId: string): number {
    return this.userRecentTaskCounts.get(userId) || 0;
  }

  getUserBusyStatus(userId: string): string {
    const hasCurrentEvent = this.getUserCurrentEvent(userId) !== undefined;
    const hasRecentTasks = this.getUserRecentTaskCount(userId) > 0;

    if (hasCurrentEvent) {
      return 'busy'; // 予定あり
    } else if (hasRecentTasks) {
      return 'working'; // タスク消化中
    } else {
      return 'free'; // 予定なし
    }
  }

  getBusyStatusText(userId: string): string {
    const status = this.getUserBusyStatus(userId);
    
    switch (status) {
      case 'busy':
        return '予定あり';
      case 'working':
        return 'タスク消化中';
      case 'free':
        return '予定なし';
      default:
        return '予定なし';
    }
  }

  sendMessage(user: User): void {
    // メッセージ送信ページに遷移
    this.router.navigate(['/messages/compose'], {
      queryParams: { to: user.id }
    });
  }
}
