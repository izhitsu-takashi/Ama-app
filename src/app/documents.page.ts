import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { Group } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="documents-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>📄 資料作成</h1>
        </div>
        <div class="header-right">
          <span class="user-info">{{ getUserDisplayName() }}</span>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- 資料作成メニュー -->
        <div class="document-menu">
          <h2>資料作成メニュー</h2>
          <p class="description">パワーポイントのようなスライド形式で資料を作成できます</p>
          
          <div class="menu-grid">
            <button class="menu-card morning-card" (click)="createMorningReport()">
              <div class="menu-icon">🌅</div>
              <h3>朝会用資料作成</h3>
              <p>今日の予定、迫っている課題の期限などをスライド形式で表示</p>
              <div class="features">
                <span class="feature-tag">📅 今日の予定</span>
                <span class="feature-tag">⏰ 課題期限</span>
                <span class="feature-tag">📊 進捗状況</span>
              </div>
            </button>
            
            <button class="menu-card group-card" (click)="createGroupReport()">
              <div class="menu-icon">👥</div>
              <h3>グループ資料作成</h3>
              <p>グループ全体の進捗度、保有タスク、期限管理状況を表示</p>
              <div class="features">
                <span class="feature-tag">📈 進捗度</span>
                <span class="feature-tag">📋 保有タスク</span>
                <span class="feature-tag">⏱️ 期限管理</span>
              </div>
            </button>
          </div>
        </div>

        <!-- 最近作成した資料 -->
        <div class="recent-documents" *ngIf="false">
          <h2>最近作成した資料</h2>
          <div class="document-list">
            <p class="empty-state">まだ資料が作成されていません</p>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .documents-container {
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

    .user-info {
      font-weight: 600;
      color: #4b5563;
    }

    .main-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .document-menu {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .document-menu h2 {
      margin: 0 0 0.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .description {
      margin: 0 0 2rem 0;
      color: #6b7280;
      font-size: 1rem;
      line-height: 1.5;
    }

    .menu-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 2rem;
    }

    .menu-card {
      background: #f9fafb;
      border: 2px solid #e5e7eb;
      border-radius: 16px;
      padding: 2rem;
      cursor: pointer;
      transition: all 0.3s ease;
      text-align: left;
      position: relative;
      overflow: hidden;
    }

    .menu-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .menu-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #667eea, #764ba2);
    }

    .morning-card::before {
      background: linear-gradient(90deg, #f59e0b, #d97706);
    }

    .group-card::before {
      background: linear-gradient(90deg, #10b981, #059669);
    }

    .menu-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
      display: block;
    }

    .menu-card h3 {
      margin: 0 0 1rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .menu-card p {
      margin: 0 0 1.5rem 0;
      color: #6b7280;
      font-size: 1rem;
      line-height: 1.6;
    }

    .features {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .feature-tag {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .morning-card .feature-tag {
      background: rgba(245, 158, 11, 0.1);
      color: #d97706;
    }

    .group-card .feature-tag {
      background: rgba(16, 185, 129, 0.1);
      color: #059669;
    }

    .recent-documents {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .recent-documents h2 {
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

    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .documents-container {
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

      .menu-grid {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .menu-card {
        padding: 1.5rem;
      }

      .menu-card h3 {
        font-size: 1.25rem;
      }
    }
  `]
})
export class DocumentsPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  userGroups$: Observable<Group[]> = of([]);

  ngOnInit() {
    this.loadUserGroups();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserGroups() {
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.userGroups$ = this.groupService.getUserGroups(currentUser.uid);
    }
  }

  getUserDisplayName(): string {
    const currentUser = this.authService.currentUser;
    if (!currentUser) return '';
    return currentUser.displayName || currentUser.email || 'ユーザー';
  }

  createMorningReport() {
    this.router.navigate(['/documents/morning-report']);
  }

  createGroupReport() {
    this.router.navigate(['/documents/group-report']);
  }

  goBack() {
    this.router.navigate(['/main']);
  }
}
