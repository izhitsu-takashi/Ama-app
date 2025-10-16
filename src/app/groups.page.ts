import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { Group } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

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
        <div class="search-box">
          <input 
            type="text" 
            class="search-input" 
            placeholder="グループを検索..."
            [(ngModel)]="searchTerm"
            (input)="onSearch()"
          />
          <span class="search-icon">🔍</span>
        </div>
      </div>

      <!-- グループ一覧 -->
      <div class="groups-section">
        <div class="section-header">
          <h2 class="section-title">参加しているグループ</h2>
          <div class="group-count">
            {{ (userGroups$ | async)?.length || 0 }}グループ
          </div>
        </div>

        <div class="groups-grid" *ngIf="(userGroups$ | async) as groups; else emptyGroups">
          <div class="group-card" *ngFor="let group of filteredGroups" [routerLink]="['/group', group.id]">
            <div class="group-header">
              <h3 class="group-name">{{ group.name }}</h3>
              <div class="group-status">
                <span class="status-badge" [class]="group.isPublic ? 'public' : 'private'">
                  {{ group.isPublic ? '公開' : '非公開' }}
                </span>
              </div>
            </div>
            
            <p class="group-description" *ngIf="group.description">{{ group.description }}</p>
            <p class="group-description empty" *ngIf="!group.description">説明なし</p>
            
            <div class="group-stats">
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
              <button class="group-action-btn" (click)="openGroup(group); $event.stopPropagation()">
                開く →
              </button>
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
  private auth = inject(AuthService);

  private destroy$ = new Subject<void>();

  userGroups$: Observable<Group[]> = of([]);
  filteredGroups: Group[] = [];
  searchTerm = '';

  ngOnInit() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          this.userGroups$ = this.groupService.getUserGroups(user.uid);
          
          this.userGroups$.subscribe(groups => {
            this.filteredGroups = groups;
            this.applySearch();
          });

          return this.userGroups$;
        }
        return of([]);
      })
    ).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch() {
    this.applySearch();
  }

  applySearch() {
    if (!this.searchTerm.trim()) {
      this.userGroups$.subscribe(groups => {
        this.filteredGroups = groups;
      });
      return;
    }

    this.userGroups$.subscribe(groups => {
      this.filteredGroups = groups.filter(group =>
        group.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (group.description && group.description.toLowerCase().includes(this.searchTerm.toLowerCase()))
      );
    });
  }

  getGroupTaskCount(groupId: string): number {
    // TODO: 実際のタスク数を取得
    return 0;
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
