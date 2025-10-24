import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProgressReportService } from './progress-report.service';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { ProgressReport, ProgressReportComment } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

@Component({
  selector: 'app-progress-reports',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">進捗報告</h1>
        <div class="header-actions">
          <button class="btn secondary" routerLink="/auto-report-schedule">
            ⚙️ 自動送信設定
          </button>
          <button class="btn primary" routerLink="/progress-report-create">
            + 進捗報告作成
          </button>
        </div>
      </div>

      <!-- タブ -->
      <div class="tabs">
        <button 
          class="tab-btn" 
          [class.active]="activeTab === 'drafts'"
          (click)="setActiveTab('drafts')"
        >
          下書き
        </button>
        <button 
          class="tab-btn" 
          [class.active]="activeTab === 'sent'"
          (click)="setActiveTab('sent')"
        >
          送信済み
        </button>
        <button 
          class="tab-btn" 
          [class.active]="activeTab === 'received'"
          (click)="setActiveTab('received')"
        >
          受信済み
        </button>
      </div>

      <!-- 進捗報告一覧 -->
      <div class="reports-section">
        <!-- 下書きセクション -->
        <div *ngIf="activeTab === 'drafts' && (draftReports$ | async) as reports">
          <div class="reports-list">
            <div class="report-item" *ngFor="let report of reports">
              <div class="report-header">
                <h3 class="report-title">{{ report.title }}</h3>
                <span class="report-status status-draft">下書き</span>
              </div>
              
              <div class="report-content">
                <p class="report-text" [class.preview-text]="!showFullContent[report.id]">
                  {{ showFullContent[report.id] ? report.content : getPreviewText(report.content) }}
                </p>
                <button 
                  *ngIf="!showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  すべて表示
                </button>
                <button 
                  *ngIf="showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  折りたたむ
                </button>
              </div>
              
              <div class="report-meta">
                <span class="meta-item">📝 下書き保存日時: {{ formatDate(report.updatedAt) }}</span>
              </div>

              <div class="report-actions">
                <button class="btn small primary" (click)="editDraft(report)">編集</button>
                <button class="btn small secondary" (click)="sendDraft(report)">送信</button>
                <button class="btn small danger" (click)="deleteReport(report.id)">削除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 送信済みセクション -->
        <div *ngIf="activeTab === 'sent' && (sentReports$ | async) as reports">
          <div class="reports-list">
            <div class="report-item" *ngFor="let report of reports">
              <div class="report-header">
                <h3 class="report-title">{{ report.title }}</h3>
                <span class="report-status" [class]="'status-' + report.status">
                  {{ getStatusLabel(report.status) }}
                </span>
              </div>
              
              <div class="report-content">
                <p class="report-text" [class.preview-text]="!showFullContent[report.id]">
                  {{ showFullContent[report.id] ? report.content : getPreviewText(report.content) }}
                </p>
                <button 
                  *ngIf="!showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  すべて表示
                </button>
                <button 
                  *ngIf="showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  折りたたむ
                </button>
              </div>
              
              <div class="report-meta">
                <span class="meta-item">📤 {{ getRecipientDisplayName(report) }}</span>
                <span class="meta-item" *ngIf="report.attachedGroupName">
                  📎 <a class="group-link" (click)="navigateToGroup(report.attachedGroupId!)">{{ report.attachedGroupName }}</a>
                </span>
                <span class="meta-item">📅 {{ formatDate(report.createdAt) }}</span>
                <span class="meta-item" *ngIf="report.readAt">👁️ {{ formatDate(report.readAt) }} 既読</span>
              </div>

              <div class="report-actions">
                <button class="btn small secondary" (click)="viewReport(report)">詳細</button>
                <button class="btn small danger" (click)="deleteReport(report.id)">削除</button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="activeTab === 'received' && (receivedReports$ | async) as reports">
          <div class="reports-list">
            <div class="report-item" *ngFor="let report of reports">
              <div class="report-header">
                <h3 class="report-title">{{ report.title }}</h3>
                <span class="report-status" [class]="'status-' + report.status">
                  {{ getStatusLabel(report.status) }}
                </span>
              </div>
              
              <div class="report-content">
                <p class="report-text" [class.preview-text]="!showFullContent[report.id]">
                  {{ showFullContent[report.id] ? report.content : getPreviewText(report.content) }}
                </p>
                <button 
                  *ngIf="!showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  すべて表示
                </button>
                <button 
                  *ngIf="showFullContent[report.id] && report.content.length > 200" 
                  class="btn small secondary show-more-btn"
                  (click)="toggleContent(report.id)"
                >
                  折りたたむ
                </button>
              </div>
              
              <div class="report-meta">
                <span class="meta-item">📥 {{ report.senderName }}</span>
                <span class="meta-item" *ngIf="report.attachedGroupName">
                  📎 <a class="group-link" (click)="navigateToGroup(report.attachedGroupId!)">{{ report.attachedGroupName }}</a>
                </span>
                <span class="meta-item">📅 {{ formatDate(report.createdAt) }}</span>
              </div>

              <div class="report-actions">
                <button class="btn small primary" (click)="viewReport(report)">詳細・コメント</button>
                <button class="btn small secondary" (click)="markAsRead(report.id)" *ngIf="report.status !== 'read'">
                  既読にする
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 空の状態表示 -->
        <div class="empty-state" *ngIf="activeTab === 'drafts' && (draftReports$ | async)?.length === 0">
          <div class="empty-icon">📝</div>
          <h3 class="empty-title">下書きの進捗報告がありません</h3>
          <p class="empty-description">進捗報告を作成して、下書きとして保存できます。</p>
          <button class="btn primary" routerLink="/progress-report-create">+ 進捗報告作成</button>
        </div>

        <div class="empty-state" *ngIf="activeTab === 'sent' && (sentReports$ | async)?.length === 0">
          <div class="empty-icon">📤</div>
          <h3 class="empty-title">送信済みの進捗報告がありません</h3>
          <p class="empty-description">新しい進捗報告を作成して、チームに進捗を共有しましょう。</p>
          <button class="btn primary" routerLink="/progress-report-create">+ 進捗報告作成</button>
        </div>

        <div class="empty-state" *ngIf="activeTab === 'received' && (receivedReports$ | async)?.length === 0">
          <div class="empty-icon">📥</div>
          <h3 class="empty-title">受信した進捗報告がありません</h3>
          <p class="empty-description">チームメンバーからの進捗報告がここに表示されます。</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .page-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      background: none;
      border: none;
      color: #667eea;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      transition: background-color 0.2s;
    }

    .back-btn:hover {
      background-color: rgba(102, 126, 234, 0.1);
    }

    .page-title {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 700;
      color: #2d3748;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 0.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .tab-btn {
      flex: 1;
      padding: 0.75rem 1.5rem;
      border: none;
      background: none;
      color: #6b7280;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0.5rem;
      transition: all 0.2s;
    }

    .tab-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .tab-btn:hover:not(.active) {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
    }

    .reports-section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .reports-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .report-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: box-shadow 0.2s;
    }

    .report-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .report-title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
      flex: 1;
    }

    .report-status {
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-draft {
      background: #f3f4f6;
      color: #6b7280;
    }

    .status-sent {
      background: #dbeafe;
      color: #1e40af;
    }

    .status-read {
      background: #d1fae5;
      color: #065f46;
    }

    .report-content {
      margin-bottom: 1rem;
    }

    .report-text {
      margin: 0;
      color: #4b5563;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .preview-text {
      max-height: 4.5rem;
      overflow: hidden;
      position: relative;
    }

    .preview-text::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1.5rem;
      background: linear-gradient(transparent, white);
    }

    .show-more-btn {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }

    .report-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .group-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      cursor: pointer;
      transition: color 0.2s;
    }

    .group-link:hover {
      color: #5a67d8;
      text-decoration: underline;
    }

    .report-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn.secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn.secondary:hover {
      background: #e5e7eb;
    }

    .btn.danger {
      background: #fee2e2;
      color: #dc2626;
      border: 1px solid #fecaca;
    }

    .btn.danger:hover {
      background: #fecaca;
    }

    .btn.small {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #374151;
    }

    .empty-description {
      margin: 0 0 2rem 0;
      color: #6b7280;
      line-height: 1.6;
    }

    @media (max-width: 768px) {
      .page-container {
        padding: 1rem;
      }

      .page-header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .reports-section {
        padding: 1.5rem;
      }

      .report-header {
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }

      .report-meta {
        flex-direction: column;
        gap: 0.5rem;
      }

      .report-actions {
        flex-direction: column;
      }
    }
  `]
})
export class ProgressReportsPage implements OnInit, OnDestroy {
  private progressReportService = inject(ProgressReportService);
  private auth = inject(AuthService);
  private groupService = inject(GroupService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  activeTab: 'drafts' | 'sent' | 'received' = 'drafts';
  draftReports$: Observable<ProgressReport[]> = of([]);
  sentReports$: Observable<ProgressReport[]> = of([]);
  receivedReports$: Observable<ProgressReport[]> = of([]);
  
  // プレビュー表示の制御
  showFullContent: { [key: string]: boolean } = {};

  ngOnInit() {
    this.loadReports();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadReports() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      take(1)
    ).subscribe(user => {
      if (user) {
        this.draftReports$ = this.progressReportService.getDraftProgressReports(user.uid);
        this.sentReports$ = this.progressReportService.getSentProgressReports(user.uid);
        this.receivedReports$ = this.progressReportService.getReceivedProgressReports(user.uid);
      }
    });
  }

  setActiveTab(tab: 'drafts' | 'sent' | 'received') {
    this.activeTab = tab;
  }

  getStatusLabel(status: string): string {
    const labels = {
      'draft': '下書き',
      'sent': '送信済み',
      'read': '既読'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getRecipientDisplayName(report: ProgressReport): string {
    // 単一受信者の場合
    if (report.recipientName) {
      return report.recipientName;
    }
    
    // グループ送信の場合
    if (report.groupName) {
      return report.groupName;
    }
    
    // 複数受信者の場合
    if (report.recipientNames && report.recipientNames.length > 0) {
      if (report.recipientNames.length === 1) {
        return report.recipientNames[0];
      } else {
        return `${report.recipientNames[0]} 他${report.recipientNames.length - 1}名`;
      }
    }
    
    // 受信者IDのみが設定されている場合
    if (report.recipientIds && report.recipientIds.length > 0) {
      if (report.recipientIds.length === 1) {
        return 'ユーザー';
      } else {
        return `複数ユーザー (${report.recipientIds.length}名)`;
      }
    }
    
    return '送信先不明';
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

  viewReport(report: ProgressReport) {
    this.router.navigate(['/progress-report-detail', report.id]);
  }

  async navigateToGroup(groupId: string) {
    try {
      // 現在のユーザーを取得
      const currentUser = await this.auth.currentUser$.pipe(take(1)).toPromise();
      if (!currentUser) {
        alert('ログインが必要です。');
        return;
      }

      // ユーザーのグループ一覧を取得
      const userGroups = await this.groupService.getUserGroups(currentUser.uid).pipe(take(1)).toPromise();
      
      // 指定されたグループに参加しているかチェック
      const isMember = userGroups?.some(group => group.id === groupId);
      
      if (isMember) {
        // 参加している場合はグループ詳細ページに遷移
        this.router.navigate(['/group', groupId]);
      } else {
        // 参加していない場合はメッセージを表示
        alert('グループに参加していません。グループ一覧からグループ名を検索して参加をお願いします。');
      }
    } catch (error) {
      console.error('グループ遷移エラー:', error);
      alert('グループ情報の取得に失敗しました。');
    }
  }

  async markAsRead(reportId: string) {
    try {
      await this.progressReportService.markAsRead(reportId);
      this.loadReports();
    } catch (error) {
      console.error('既読マークエラー:', error);
    }
  }

  async deleteReport(reportId: string) {
    if (confirm('この進捗報告を削除しますか？')) {
      try {
        await this.progressReportService.deleteProgressReport(reportId);
        this.loadReports();
      } catch (error) {
        console.error('進捗報告削除エラー:', error);
        alert('進捗報告の削除に失敗しました。');
      }
    }
  }

  editDraft(report: ProgressReport) {
    this.router.navigate(['/progress-report-create'], {
      queryParams: { editId: report.id }
    });
  }

  async sendDraft(report: ProgressReport) {
    if (confirm('この下書きを送信しますか？')) {
      try {
        await this.progressReportService.updateProgressReport(report.id, {
          status: 'sent'
        });
        this.loadReports();
        alert('進捗報告を送信しました！');
      } catch (error) {
        console.error('下書き送信エラー:', error);
        alert('下書きの送信に失敗しました。');
      }
    }
  }

  // プレビューテキストを取得（200文字で切り詰め）
  getPreviewText(content: string): string {
    if (content.length <= 200) {
      return content;
    }
    return content.substring(0, 200) + '...';
  }

  // コンテンツの表示/非表示を切り替え
  toggleContent(reportId: string) {
    this.showFullContent[reportId] = !this.showFullContent[reportId];
  }
}
