import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { User, Group } from './models';
import { Observable, Subscription, combineLatest, of, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>👑 管理者ダッシュボード</h1>
        </div>
        <div class="header-right">
          <span class="admin-badge">管理者</span>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- 統計カード -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <h3>総ユーザー数</h3>
              <p class="stat-number">{{ totalUsers }}</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">👑</div>
            <div class="stat-content">
              <h3>管理者数</h3>
              <p class="stat-number">{{ adminUsers }}</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-content">
              <h3>総グループ数</h3>
              <p class="stat-number">{{ totalGroups }}</p>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-content">
              <h3>今月登録</h3>
              <p class="stat-number">{{ monthlyRegistrations }}</p>
            </div>
          </div>
        </div>

        <!-- 管理メニュー -->
        <div class="admin-menu">
          <h2>管理機能</h2>
          <div class="menu-grid">
            <button class="menu-card" (click)="navigateToUserManagement()">
              <div class="menu-icon">👥</div>
              <h3>ユーザー管理</h3>
              <p>ユーザーの権限変更、削除等</p>
            </button>
            
            <button class="menu-card" (click)="navigateToGroupManagement()">
              <div class="menu-icon">📋</div>
              <h3>グループ管理</h3>
              <p>グループの管理、削除等</p>
            </button>
          </div>
        </div>

        <!-- 最近のアクティビティ -->
        <div class="activity-section">
          <h2>最近のアクティビティ</h2>
          <div class="activity-list">
            <div *ngIf="recentUsers.length === 0" class="empty-state">
              <p>最近のアクティビティはありません</p>
            </div>
            <div *ngFor="let user of recentUsers" class="activity-item">
              <div class="activity-avatar">
                <div class="avatar-circle">
                  {{ getUserInitials(user) }}
                </div>
              </div>
              <div class="activity-content">
                <h4>{{ user.displayName || user.email }}</h4>
                <p>{{ user.email }}</p>
                <span class="activity-time">{{ formatDate(user.createdAt) }}</span>
              </div>
              <div class="activity-role">
                <span class="role-badge" [class.admin]="user.role === 'admin'">
                  {{ user.role === 'admin' ? '管理者' : 'ユーザー' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.95);
      padding: 1rem 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-btn {
      background: #6b7280;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s ease;
    }

    .back-btn:hover {
      background: #4b5563;
    }

    .header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #374151;
      margin: 0;
    }

    .admin-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .main-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.95);
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      gap: 1rem;
      transition: transform 0.2s ease;
    }

    .stat-card:hover {
      transform: translateY(-2px);
    }

    .stat-icon {
      font-size: 2.5rem;
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border-radius: 12px;
    }

    .stat-content h3 {
      margin: 0 0 0.5rem 0;
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .stat-number {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      color: #374151;
    }

    .admin-menu {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .admin-menu h2 {
      margin: 0 0 1.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .menu-card {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .menu-card:hover {
      background: #f3f4f6;
      border-color: #667eea;
      transform: translateY(-2px);
    }

    .menu-icon {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .menu-card h3 {
      margin: 0 0 0.5rem 0;
      color: #374151;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .menu-card p {
      margin: 0;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .activity-section {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .activity-section h2 {
      margin: 0 0 1.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-style: italic;
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .activity-avatar {
      flex-shrink: 0;
    }

    .avatar-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .activity-content {
      flex: 1;
    }

    .activity-content h4 {
      margin: 0 0 0.25rem 0;
      color: #374151;
      font-size: 1rem;
      font-weight: 600;
    }

    .activity-content p {
      margin: 0 0 0.25rem 0;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .activity-time {
      color: #9ca3af;
      font-size: 0.75rem;
    }

    .activity-role {
      flex-shrink: 0;
    }

    .role-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #e5e7eb;
      color: #374151;
    }

    .role-badge.admin {
      background: #fef3c7;
      color: #92400e;
    }

    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .admin-container {
        padding: 1rem;
      }

      .header {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }

      .header h1 {
        font-size: 1.5rem;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .menu-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // 統計データ
  totalUsers = 0;
  adminUsers = 0;
  totalGroups = 0;
  monthlyRegistrations = 0;

  // 最近のユーザー
  recentUsers: User[] = [];

  ngOnInit() {
    this.loadStatistics();
    this.loadRecentUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadStatistics() {
    // ユーザー統計を取得
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe((users: User[]) => {
      this.totalUsers = users.length;
      this.adminUsers = users.filter((user: User) => user.role === 'admin').length;
      
      // 今月の登録数を計算
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.monthlyRegistrations = users.filter((user: User) => {
        const createdAt = user.createdAt?.toDate ? user.createdAt.toDate() : new Date(user.createdAt);
        return createdAt >= startOfMonth;
      }).length;
    });

    // グループ統計を取得
    this.groupService.getAllGroups().pipe(
      takeUntil(this.destroy$)
    ).subscribe(groups => {
      this.totalGroups = groups.length;
    });
  }

  private loadRecentUsers() {
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe((users: User[]) => {
      // 最近登録されたユーザーを最大5件取得
      this.recentUsers = users
        .sort((a: User, b: User) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5);
    });
  }

  getUserInitials(user: User): string {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  navigateToUserManagement() {
    this.router.navigate(['/admin/users']);
  }

  navigateToGroupManagement() {
    this.router.navigate(['/admin/groups']);
  }


  goBack() {
    this.router.navigate(['/main']);
  }
}
