import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { UserService } from './user.service';
import { Group, User } from './models';
import { Observable, Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="admin-groups-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>📋 グループ管理</h1>
        </div>
        <div class="header-right">
          <span class="admin-badge">管理者</span>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- 検索・フィルター -->
        <div class="search-section">
          <div class="search-input-group">
            <input 
              type="text" 
              [(ngModel)]="searchTerm" 
              (input)="filterGroups()"
              placeholder="グループ名で検索..."
              class="search-input"
            >
            <button class="search-btn" (click)="filterGroups()">
              🔍
            </button>
          </div>
          
          <div class="filter-group">
            <label for="visibility-filter">公開設定:</label>
            <select id="visibility-filter" [(ngModel)]="selectedVisibility" (change)="filterGroups()">
              <option value="">全て</option>
              <option value="true">公開</option>
              <option value="false">非公開</option>
            </select>
          </div>
        </div>

        <!-- グループ一覧 -->
        <div class="groups-section">
          <div class="section-header">
            <h2>グループ一覧 ({{ filteredGroups.length }}件)</h2>
          </div>
          
          <div *ngIf="loading" class="loading-state">
            <p>読み込み中...</p>
          </div>
          
          <div *ngIf="!loading && filteredGroups.length === 0" class="empty-state">
            <p>グループが見つかりません</p>
          </div>
          
          <div *ngIf="!loading && filteredGroups.length > 0" class="groups-grid">
            <div *ngFor="let group of filteredGroups" class="group-card">
              <div class="group-header">
                <div class="group-info">
                  <h3>{{ group.name }}</h3>
                  <p *ngIf="group.description">{{ group.description }}</p>
                  <div class="group-meta">
                    <span class="visibility-badge" [class.public]="group.isPublic" [class.private]="!group.isPublic">
                      {{ group.isPublic ? '公開' : '非公開' }}
                    </span>
                    <span class="approval-badge" [class.required]="group.requiresApproval">
                      {{ group.requiresApproval ? '承認必要' : '自由参加' }}
                    </span>
                  </div>
                </div>
                <div class="group-actions">
                  <button 
                    class="action-btn danger-btn" 
                    (click)="deleteGroup(group)"
                    title="グループを削除"
                  >
                    削除
                  </button>
                </div>
              </div>
              
              <div class="group-details">
                <div class="detail-item">
                  <span class="label">作成者:</span>
                  <span class="value">{{ getOwnerName(group.ownerId) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">メンバー数:</span>
                  <span class="value">{{ group.memberIds.length }}人</span>
                </div>
                <div class="detail-item">
                  <span class="label">作成日:</span>
                  <span class="value">{{ formatDate(group.createdAt) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">最終更新:</span>
                  <span class="value">{{ formatDate(group.updatedAt) }}</span>
                </div>
              </div>
              
              <div class="group-members">
                <h4>メンバー一覧</h4>
                <div class="members-list">
                  <div *ngFor="let memberId of group.memberIds" class="member-item">
                    <div class="member-avatar">
                      <div class="avatar-circle">
                        {{ getUserInitials(memberId) }}
                      </div>
                    </div>
                    <div class="member-info">
                      <span class="member-name">{{ getUserName(memberId) }}</span>
                      <span *ngIf="memberId === group.ownerId" class="owner-badge">オーナー</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-groups-container {
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

    .search-section {
      background: rgba(255, 255, 255, 0.95);
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-input-group {
      display: flex;
      flex: 1;
      min-width: 300px;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px 0 0 8px;
      font-size: 1rem;
      outline: none;
    }

    .search-input:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .search-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem 1rem;
      border-radius: 0 8px 8px 0;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s ease;
    }

    .search-btn:hover {
      background: #5a67d8;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 600;
      color: #374151;
    }

    .filter-group select {
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      background: white;
      font-size: 1rem;
      cursor: pointer;
    }

    .groups-section {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      margin-bottom: 1.5rem;
    }

    .section-header h2 {
      margin: 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .loading-state, .empty-state {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
      font-style: italic;
    }

    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    .group-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.2s ease;
    }

    .group-card:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
      transform: translateY(-2px);
    }

    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .group-info h3 {
      margin: 0 0 0.5rem 0;
      color: #374151;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .group-info p {
      margin: 0 0 0.75rem 0;
      color: #6b7280;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .group-meta {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .visibility-badge, .approval-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .visibility-badge.public {
      background: #d1fae5;
      color: #065f46;
    }

    .visibility-badge.private {
      background: #fee2e2;
      color: #991b1b;
    }

    .approval-badge {
      background: #e5e7eb;
      color: #374151;
    }

    .approval-badge.required {
      background: #fef3c7;
      color: #92400e;
    }

    .group-actions {
      flex-shrink: 0;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .danger-btn {
      background: #fee2e2;
      color: #dc2626;
    }

    .danger-btn:hover {
      background: #fecaca;
    }

    .group-details {
      margin-bottom: 1rem;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .detail-item:last-child {
      margin-bottom: 0;
    }

    .detail-item .label {
      color: #6b7280;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .detail-item .value {
      color: #374151;
      font-size: 0.875rem;
    }

    .group-members {
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
    }

    .group-members h4 {
      margin: 0 0 0.75rem 0;
      color: #374151;
      font-size: 1rem;
      font-weight: 600;
    }

    .members-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      background: white;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .member-avatar {
      flex-shrink: 0;
    }

    .avatar-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .member-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .member-name {
      color: #374151;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .owner-badge {
      padding: 0.125rem 0.5rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
    }

    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .admin-groups-container {
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

      .search-section {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input-group {
        min-width: auto;
      }

      .groups-grid {
        grid-template-columns: 1fr;
      }

      .group-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
      }
    }
  `]
})
export class AdminGroupsPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private userService = inject(UserService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // データ
  allGroups: Group[] = [];
  filteredGroups: Group[] = [];
  allUsers: User[] = [];
  loading = false;

  // フィルター
  searchTerm = '';
  selectedVisibility = '';

  ngOnInit() {
    this.loadGroups();
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadGroups() {
    this.loading = true;
    this.groupService.getAllGroups().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (groups: Group[]) => {
        this.allGroups = groups;
        this.filterGroups();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('グループ取得エラー:', error);
        this.loading = false;
      }
    });
  }

  private loadUsers() {
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (users: User[]) => {
        this.allUsers = users;
      },
      error: (error: any) => {
        console.error('ユーザー取得エラー:', error);
      }
    });
  }

  filterGroups() {
    let filtered = [...this.allGroups];

    // 検索フィルター
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(term) ||
        (group.description && group.description.toLowerCase().includes(term))
      );
    }

    // 公開設定フィルター
    if (this.selectedVisibility) {
      const isPublic = this.selectedVisibility === 'true';
      filtered = filtered.filter(group => group.isPublic === isPublic);
    }

    this.filteredGroups = filtered;
  }

  getOwnerName(ownerId: string): string {
    const owner = this.allUsers.find(user => user.id === ownerId);
    return owner ? (owner.displayName || owner.email) : '不明';
  }

  getUserName(userId: string): string {
    const user = this.allUsers.find(user => user.id === userId);
    return user ? (user.displayName || user.email) : '不明';
  }

  getUserInitials(userId: string): string {
    const user = this.allUsers.find(user => user.id === userId);
    if (user) {
      if (user.displayName) {
        return user.displayName.charAt(0).toUpperCase();
      }
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  }

  formatDate(date: any): string {
    if (!date) return '不明';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  }

  async deleteGroup(group: Group) {
    if (!confirm(`グループ「${group.name}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await this.groupService.deleteGroup(group.id);
      this.loadGroups(); // グループリストを再読み込み
      alert('グループを削除しました');
    } catch (error) {
      console.error('グループ削除エラー:', error);
      alert('グループの削除に失敗しました');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}


