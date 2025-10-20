import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { AuthService } from './auth.service';
import { JoinRequestService } from './join-request.service';
import { Group, JoinRequest } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, switchMap, take } from 'rxjs/operators';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">グループ一覧</h1>
        <div class="header-actions">
          <button class="btn btn-primary" routerLink="/group/create">
            <span class="btn-icon">+</span>
            新しいグループを作成
          </button>
        </div>
      </div>

      <!-- 検索・フィルター -->
      <div class="search-section">
        <div class="search-controls">
          <div class="search-mode-toggle">
            <button 
              class="toggle-btn" 
              [class.active]="!showAllGroups"
              (click)="toggleSearchMode(false)"
            >
              参加グループ
            </button>
            <button 
              class="toggle-btn" 
              [class.active]="showAllGroups"
              (click)="toggleSearchMode(true)"
            >
              すべてのグループ
            </button>
          </div>
          <div class="search-box">
            <input 
              type="text" 
              class="search-input" 
              [placeholder]="showAllGroups ? 'すべてのグループを検索...' : '参加グループを検索...'"
              [(ngModel)]="searchTerm"
              (input)="onSearch()"
              (keyup)="onSearch()"
            />
            <span class="search-icon">🔍</span>
          </div>
        </div>
      </div>

      <!-- グループ一覧 -->
      <div class="groups-section">
        <div class="section-header">
          <h2 class="section-title">{{ showAllGroups ? 'すべてのグループ' : '参加しているグループ' }}</h2>
          <div class="group-count">
            {{ filteredGroups.length }}グループ
          </div>
        </div>

        <div class="groups-grid" *ngIf="(userGroups$ | async) as groups; else emptyGroups">
          <div class="group-card" 
               *ngFor="let group of filteredGroups" 
               [class.restricted]="!isUserInGroup(group.id)"
               [class.deadline-yellow]="isUserInGroup(group.id) && getGroupDeadlineStatus(group.id) === 'yellow'"
               [class.deadline-red]="isUserInGroup(group.id) && getGroupDeadlineStatus(group.id) === 'red'">
            <div class="group-header">
              <h3 class="group-name">{{ group.name }}</h3>
              <!-- 参加しているグループのみ公開/非公開を表示 -->
              <div class="group-status" *ngIf="isUserInGroup(group.id)">
                <span class="status-badge" [class]="group.isPublic ? 'public' : 'private'">
                  {{ group.isPublic ? '公開' : '非公開' }}
                </span>
              </div>
            </div>
            
            <!-- 参加しているグループのみ詳細を表示 -->
            <p class="group-description" *ngIf="isUserInGroup(group.id) && group.description">{{ group.description }}</p>
            <p class="group-description empty" *ngIf="isUserInGroup(group.id) && !group.description">説明なし</p>
            <p class="group-description restricted-content" *ngIf="!isUserInGroup(group.id)">
              <span class="restricted-text">グループに参加すると詳細を確認できます</span>
            </p>
            
            <div class="group-stats" *ngIf="isUserInGroup(group.id)">
              <div class="stat-item">
                <span class="stat-icon">👥</span>
                <span class="stat-value">{{ group.memberIds.length }}人</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">📋</span>
                <span class="stat-value">{{ getGroupTaskCount(group.id) }}件</span>
              </div>
            </div>

            <div class="group-footer">
              <span class="created-date">
                作成日: {{ formatDate(group.createdAt) }}
              </span>
              <div class="group-actions">
                <!-- 参加しているグループのみ「開く」ボタンを表示 -->
                <button 
                  *ngIf="isUserInGroup(group.id)" 
                  class="group-action-btn" 
                  (click)="openGroup(group); $event.stopPropagation()"
                >
                  開く →
                </button>
                
                <!-- 参加していないグループの場合のアクションボタン -->
                <ng-container *ngIf="!isUserInGroup(group.id)">
                  <button 
                    *ngIf="group.isPublic" 
                    class="group-action-btn join-btn" 
                    (click)="joinGroup(group.id); $event.stopPropagation()"
                    [disabled]="isJoiningGroup"
                  >
                    ➕ 参加
                  </button>
                  
                  <button 
                    *ngIf="!group.isPublic" 
                    class="group-action-btn request-btn" 
                    (click)="requestToJoinGroup(group.id); $event.stopPropagation()"
                    [disabled]="isRequestingJoinForGroup(group.id)"
                  >
                    📝 参加リクエスト
                  </button>
                  
                </ng-container>
              </div>
            </div>
          </div>
        </div>

        <ng-template #emptyGroups>
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">参加しているグループがありません</h3>
            <p class="empty-description">新しいグループを作成するか、既存のグループに参加しましょう</p>
            <button class="btn btn-primary" routerLink="/group/create">
              最初のグループを作成
            </button>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8f9fa;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      color: #4a5568;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .back-btn:hover {
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-1px);
    }

    .back-icon {
      font-size: 18px;
    }

    .page-title {
      margin: 0;
      color: #2d3748;
      font-size: 28px;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-icon {
      font-size: 16px;
    }

    .search-section {
      background: white;
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .search-controls {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .search-mode-toggle {
      display: flex;
      gap: 8px;
    }

    .toggle-btn {
      padding: 8px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toggle-btn:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .toggle-btn.active {
      background: #667eea;
      border-color: #667eea;
      color: white;
    }

    .search-box {
      position: relative;
      max-width: 400px;
    }

    .search-input {
      width: 100%;
      padding: 12px 16px 12px 48px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: #6b7280;
      font-size: 18px;
    }

    .groups-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .section-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .group-count {
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
    }

    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .group-card {
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      transition: all 0.2s ease;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }

    .group-card:hover {
      border-color: #667eea;
      transform: translateY(-4px);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
    }

    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .group-name {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
      flex: 1;
    }

    .group-status {
      margin-left: 12px;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-badge.public {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-badge.private {
      background: #f3f4f6;
      color: #6b7280;
    }

    .group-description {
      margin: 0 0 16px 0;
      color: #6b7280;
      line-height: 1.5;
      font-size: 14px;
    }

    .group-description.empty {
      font-style: italic;
      color: #9ca3af;
    }

    .group-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 16px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-icon {
      font-size: 16px;
    }

    .stat-value {
      font-size: 14px;
      color: #4a5568;
      font-weight: 600;
    }

    .group-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }

    .group-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .created-date {
      font-size: 12px;
      color: #9ca3af;
    }

    .group-action-btn {
      background: #f8f9fa;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      color: #4a5568;
      cursor: pointer;
      transition: all 0.2s;
    }

    .group-action-btn:hover {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .group-action-btn:disabled {
      background: #f3f4f6;
      color: #9ca3af;
      cursor: not-allowed;
    }

    .join-btn {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }

    .join-btn:hover {
      background: #059669;
      border-color: #059669;
    }

    .request-btn {
      background: #f59e0b;
      color: white;
      border-color: #f59e0b;
    }

    .request-btn:hover {
      background: #d97706;
      border-color: #d97706;
    }

    .restricted-content {
      background: #f8f9fa;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      text-align: center;
    }

    .restricted-text {
      color: #6b7280;
      font-style: italic;
      font-size: 14px;
    }

    .group-card.restricted {
      opacity: 0.8;
    }

    .group-card.deadline-yellow {
      border-color: #fbbf24;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }

    .group-card.deadline-yellow:hover {
      border-color: #f59e0b;
      background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
      box-shadow: 0 12px 30px rgba(245, 158, 11, 0.2);
    }

    .group-card.deadline-red {
      border-color: #ef4444;
      background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
    }

    .group-card.deadline-red:hover {
      border-color: #dc2626;
      background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
      box-shadow: 0 12px 30px rgba(239, 68, 68, 0.2);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-title {
      margin: 0 0 8px 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .empty-description {
      margin: 0 0 24px 0;
      color: #6b7280;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .page-container {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
      }

      .groups-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class GroupsPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private auth = inject(AuthService);
  private joinRequestService = inject(JoinRequestService);

  private destroy$ = new Subject<void>();

  userGroups$: Observable<Group[]> = of([]);
  allGroups: Group[] = [];
  allPublicGroups: Group[] = [];
  filteredGroups: Group[] = [];
  searchTerm = '';
  groupTaskCounts: { [groupId: string]: number } = {};
  groupDeadlineStatus: { [groupId: string]: 'normal' | 'yellow' | 'red' } = {};
  showAllGroups = false;
  isJoiningGroup = false;
  requestingJoinGroups: Set<string> = new Set();

  ngOnInit() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          this.userGroups$ = this.groupService.getUserGroups((user as any).uid);
          
          // グループデータを一度だけ購読して、検索フィルタリングを適用
          this.userGroups$.pipe(
            takeUntil(this.destroy$)
          ).subscribe(groups => {
            this.allGroups = groups;
            this.loadGroupTaskCounts(groups);
            this.loadGroupDeadlineStatus(groups);
            this.applySearch();
          });

          // 全グループ（公開グループ）も取得
          this.loadAllPublicGroups();

          return this.userGroups$;
        }
        return of([]);
      })
    ).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    // リクエスト状態をクリア
    this.requestingJoinGroups.clear();
  }

  // ユーザーがグループに参加しているかチェック
  isUserInGroup(groupId: string): boolean {
    const isInGroup = this.allGroups.some(group => group.id === groupId);
    return isInGroup;
  }


  // 公開グループに参加
  async joinGroup(groupId: string): Promise<void> {
    if (this.isJoiningGroup) return;
    
    this.isJoiningGroup = true;
    try {
      const user = await this.auth.currentUser$.pipe(take(1)).toPromise();
      if (!user) {
        throw new Error('ユーザーがログインしていません');
      }

      await this.groupService.joinGroup(groupId, (user as any).uid);
      alert('グループに参加しました！');
      
      // グループ一覧を更新
      this.loadUserGroups();
    } catch (error) {
      console.error('グループ参加エラー:', error);
      alert('グループの参加に失敗しました。');
    } finally {
      this.isJoiningGroup = false;
    }
  }

  // 特定のグループで参加リクエスト中かチェック
  isRequestingJoinForGroup(groupId: string): boolean {
    return this.requestingJoinGroups.has(groupId);
  }

  // 非公開グループに参加リクエスト
  async requestToJoinGroup(groupId: string): Promise<void> {
    if (this.isRequestingJoinForGroup(groupId)) {
      return;
    }
    
    this.requestingJoinGroups.add(groupId);
    try {
      // ユーザーがログインしているかチェック
      const user = await this.auth.currentUser$.pipe(take(1)).toPromise();
      if (!user) {
        return; // ログアウト済みの場合は何もしない
      }
      
      await this.joinRequestService.sendJoinRequest(groupId);
      
      // 成功メッセージは即座に表示
      alert('参加リクエストを送信しました！');
    } catch (error) {
      // 権限エラーやログアウト関連のエラーは無視
      if (error instanceof Error) {
        if (error.message.includes('auth') || 
            error.message.includes('permissions') || 
            error.message.includes('Missing or insufficient permissions')) {
          return;
        }
        alert('参加リクエストの送信に失敗しました。エラー: ' + error.message);
      } else if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        if (firebaseError.code === 'permission-denied' || 
            firebaseError.code === 'unauthenticated') {
          return;
        }
        alert('参加リクエストの送信に失敗しました。');
      } else {
        alert('参加リクエストの送信に失敗しました。');
      }
    } finally {
      this.requestingJoinGroups.delete(groupId);
    }
  }

  // ユーザーグループを再読み込み
  private loadUserGroups(): void {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          this.userGroups$ = this.groupService.getUserGroups((user as any).uid);
          return this.userGroups$;
        }
        return of([]);
      })
    ).subscribe(groups => {
      this.allGroups = groups;
      this.applySearch();
    });
  }

  toggleSearchMode(showAll: boolean) {
    this.showAllGroups = showAll;
    this.searchTerm = ''; // 検索語をリセット
    
    // 全グループモードに切り替える場合、データが読み込まれていない場合は読み込む
    if (showAll && this.allPublicGroups.length === 0) {
      this.loadAllPublicGroups();
    } else {
      this.applySearch();
    }
  }

  loadAllPublicGroups() {
    // 開発用：すべてのグループを取得（公開・非公開問わず）
    this.groupService.getAllGroups().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (groups) => {
        this.allPublicGroups = groups;
        // 全グループモードの場合は検索を再実行
        if (this.showAllGroups) {
          this.applySearch();
        }
      },
      error: (error) => {
        console.error('Error loading all groups:', error);
      }
    });
  }

  onSearch() {
    this.applySearch();
  }

  applySearch() {
    // 検索対象のグループリストを決定
    const sourceGroups = this.showAllGroups ? this.allPublicGroups : this.allGroups;
    
    if (!this.searchTerm || !this.searchTerm.trim()) {
      // 検索語が空の場合は、すべてのグループを表示
      this.filteredGroups = [...sourceGroups];
      return;
    }

    const searchTerm = this.searchTerm.trim();
    
    // 検索語がある場合は、sourceGroupsをフィルタリング
    this.filteredGroups = sourceGroups.filter(group => {
      const groupName = group.name || '';
      const groupDesc = group.description || '';
      
      // 大文字小文字を区別しない検索（日本語対応）
      const nameMatch = groupName.toLowerCase().includes(searchTerm.toLowerCase());
      const descMatch = groupDesc.toLowerCase().includes(searchTerm.toLowerCase());
      
      return nameMatch || descMatch;
    });
  }

  loadGroupTaskCounts(groups: Group[]) {
    groups.forEach(group => {
      this.taskService.getGroupTasks(group.id).pipe(
        take(1),
        takeUntil(this.destroy$)
      ).subscribe(tasks => {
        this.groupTaskCounts[group.id] = tasks.length;
      });
    });
  }

  loadGroupDeadlineStatus(groups: Group[]) {
    groups.forEach(group => {
      this.taskService.getGroupTasks(group.id).pipe(
        take(1),
        takeUntil(this.destroy$)
      ).subscribe(tasks => {
        this.groupDeadlineStatus[group.id] = this.calculateDeadlineStatus(tasks);
      });
    });
  }

  calculateDeadlineStatus(tasks: any[]): 'normal' | 'yellow' | 'red' {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    let hasRedDeadline = false;
    let hasYellowDeadline = false;

    for (const task of tasks) {
      // 完了済みの課題は期限状況に影響しない
      if (task.status === 'completed') {
        continue;
      }

      if (task.dueDate) {
        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        
        // 期限が1日以内（赤色）
        if (dueDate <= oneDayFromNow && dueDate >= now) {
          hasRedDeadline = true;
          // 赤色が見つかったら即座に返す（最優先）
          return 'red';
        }
        // 期限が3日以内（黄色）- 1日以内は除外
        else if (dueDate <= threeDaysFromNow && dueDate > oneDayFromNow) {
          hasYellowDeadline = true;
        }
      }
    }

    if (hasRedDeadline) return 'red';
    if (hasYellowDeadline) return 'yellow';
    return 'normal';
  }

  getGroupTaskCount(groupId: string): number {
    return this.groupTaskCounts[groupId] || 0;
  }

  getGroupDeadlineStatus(groupId: string): 'normal' | 'yellow' | 'red' {
    return this.groupDeadlineStatus[groupId] || 'normal';
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ja-JP');
  }

  openGroup(group: Group) {
    this.router.navigate(['/group', group.id]);
  }
}
