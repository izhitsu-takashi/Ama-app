import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { User } from './models';
import { Observable, Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="admin-users-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>👥 ユーザー管理</h1>
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
              (input)="filterUsers()"
              placeholder="ユーザー名またはメールアドレスで検索..."
              class="search-input"
            >
            <button class="search-btn" (click)="filterUsers()">
              🔍
            </button>
          </div>
          
          <div class="filter-group">
            <label for="role-filter">権限:</label>
            <select id="role-filter" [(ngModel)]="selectedRole" (change)="filterUsers()">
              <option value="">全て</option>
              <option value="user">ユーザー</option>
              <option value="admin">管理者</option>
            </select>
          </div>
        </div>

        <!-- ユーザー一覧 -->
        <div class="users-section">
          <div class="section-header">
            <h2>ユーザー一覧 ({{ filteredUsers.length }}件)</h2>
          </div>
          
          <div *ngIf="loading" class="loading-state">
            <p>読み込み中...</p>
          </div>
          
          <div *ngIf="!loading && filteredUsers.length === 0" class="empty-state">
            <p>ユーザーが見つかりません</p>
          </div>
          
          <div *ngIf="!loading && filteredUsers.length > 0" class="users-grid">
            <div *ngFor="let user of filteredUsers" class="user-card">
              <div class="user-header">
                <div class="user-avatar">
                  <div class="avatar-circle">
                    {{ getUserInitials(user) }}
                  </div>
                </div>
                <div class="user-info">
                  <h3>{{ user.displayName || '名前未設定' }}</h3>
                  <p>{{ user.email }}</p>
                  <span class="role-badge" [class.admin]="user.role === 'admin'">
                    {{ user.role === 'admin' ? '管理者' : 'ユーザー' }}
                  </span>
                </div>
              </div>
              
              <div class="user-details">
                <div class="detail-item">
                  <span class="label">登録日:</span>
                  <span class="value">{{ formatDate(user.createdAt) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">最終更新:</span>
                  <span class="value">{{ formatDate(user.updatedAt) }}</span>
                </div>
                <div class="detail-item">
                  <span class="label">所属:</span>
                  <div class="department-edit">
                    <select 
                      [(ngModel)]="user.department" 
                      (change)="updateUserDepartment(user)"
                      class="department-select"
                    >
                      <option value="">選択してください</option>
                      <option value="development">開発部</option>
                      <option value="consulting">コンサルティング部</option>
                      <option value="sales">営業部</option>
                      <option value="corporate">総務部</option>
                      <option value="training">研修部</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div class="user-actions">
                <button 
                  class="action-btn role-btn" 
                  [class.admin]="user.role === 'admin'"
                  (click)="toggleUserRole(user)"
                  [disabled]="isCurrentUser(user)"
                >
                  {{ user.role === 'admin' ? '管理者解除' : '管理者に昇格' }}
                </button>
                
                <button 
                  class="action-btn danger-btn" 
                  (click)="deleteUser(user)"
                  [disabled]="isCurrentUser(user)"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .admin-users-container {
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

    .users-section {
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

    .users-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .user-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.2s ease;
    }

    .user-card:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
      transform: translateY(-2px);
    }

    .user-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .user-avatar {
      flex-shrink: 0;
    }

    .avatar-circle {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.25rem;
    }

    .user-info {
      flex: 1;
    }

    .user-info h3 {
      margin: 0 0 0.25rem 0;
      color: #374151;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .user-info p {
      margin: 0 0 0.5rem 0;
      color: #6b7280;
      font-size: 0.875rem;
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

    .user-details {
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

    .department-edit {
      display: flex;
      align-items: center;
    }

    .department-select {
      padding: 0.25rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.875rem;
      width: 150px;
      background: white;
      cursor: pointer;
    }

    .department-select:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
    }

    .user-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      flex: 1;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .role-btn {
      background: #e5e7eb;
      color: #374151;
    }

    .role-btn:hover:not(:disabled) {
      background: #d1d5db;
    }

    .role-btn.admin {
      background: #fef3c7;
      color: #92400e;
    }

    .role-btn.admin:hover:not(:disabled) {
      background: #fde68a;
    }

    .danger-btn {
      background: #fee2e2;
      color: #dc2626;
    }

    .danger-btn:hover:not(:disabled) {
      background: #fecaca;
    }

    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .admin-users-container {
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

      .users-grid {
        grid-template-columns: 1fr;
      }

      .user-actions {
        flex-direction: column;
      }
    }
  `]
})
export class AdminUsersPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // データ
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  loading = false;

  // フィルター
  searchTerm = '';
  selectedRole = '';

  ngOnInit() {
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUsers() {
    this.loading = true;
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (users: User[]) => {
        this.allUsers = users;
        this.filterUsers();
        this.loading = false;
      },
      error: (error: any) => {
        console.error('ユーザー取得エラー:', error);
        this.loading = false;
      }
    });
  }

  filterUsers() {
    let filtered = [...this.allUsers];

    // 検索フィルター
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        (user.displayName && user.displayName.toLowerCase().includes(term)) ||
        user.email.toLowerCase().includes(term)
      );
    }

    // 権限フィルター
    if (this.selectedRole) {
      filtered = filtered.filter(user => user.role === this.selectedRole);
    }

    this.filteredUsers = filtered;
  }

  getUserInitials(user: User): string {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
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

  isCurrentUser(user: User): boolean {
    const currentUser = this.authService.currentUser;
    return currentUser ? user.id === currentUser.uid : false;
  }

  async toggleUserRole(user: User) {
    if (this.isCurrentUser(user)) {
      alert('自分の権限は変更できません');
      return;
    }

    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? '管理者に昇格' : '管理者権限を解除';
    
    if (!confirm(`${user.displayName || user.email} を${action}しますか？`)) {
      return;
    }

    try {
      await this.userService.updateUserRole(user.id, newRole);
      user.role = newRole;
      
      // 管理者権限を変更した場合、ローカルストレージも更新
      if (newRole === 'admin') {
        this.authService.setAdminStatus(true);
      } else {
        this.authService.setAdminStatus(false);
      }
      
      alert(`${action}しました`);
    } catch (error) {
      console.error('権限変更エラー:', error);
      alert('権限の変更に失敗しました');
    }
  }

  async updateUserDepartment(user: User) {
    try {
      await this.userService.updateUserProfile(user.id, { department: user.department });
      alert('所属を更新しました');
    } catch (error) {
      console.error('所属更新エラー:', error);
      alert('所属の更新に失敗しました');
    }
  }

  async deleteUser(user: User) {
    if (this.isCurrentUser(user)) {
      alert('自分自身を削除することはできません');
      return;
    }

    if (!confirm(`${user.displayName || user.email} を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await this.userService.deleteUser(user.id);
      this.loadUsers(); // ユーザーリストを再読み込み
      alert('ユーザーを削除しました');
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      alert('ユーザーの削除に失敗しました');
    }
  }

  goBack() {
    this.router.navigate(['/admin']);
  }
}
