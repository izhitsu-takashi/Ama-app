import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ProgressReportService } from './progress-report.service';
import { AuthService } from './auth.service';
import { ProgressReport, ProgressReportComment } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

@Component({
  selector: 'app-progress-report-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/progress-reports">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">進捗報告詳細</h1>
      </div>

      <!-- 進捗報告詳細 -->
      <div class="report-detail">
        <div class="report-header" *ngIf="report">
          <h2 class="report-title">{{ report.title }}</h2>
          <span class="report-status" [class]="'status-' + report.status">
            {{ getStatusLabel(report.status) }}
          </span>
        </div>

        <div class="report-meta">
          <div class="meta-row">
            <span class="meta-label">送信者:</span>
            <span class="meta-value">{{ report?.senderName || '読み込み中...' }}</span>
          </div>
          <div class="meta-row" *ngIf="report?.recipientName">
            <span class="meta-label">受信者:</span>
            <span class="meta-value">{{ report?.recipientName }}</span>
          </div>
          <div class="meta-row" *ngIf="report?.groupName">
            <span class="meta-label">グループ:</span>
            <span class="meta-value">{{ report?.groupName }}</span>
          </div>
          <div class="meta-row" *ngIf="report?.attachedGroupName">
            <span class="meta-label">関連グループ:</span>
            <span class="meta-value">{{ report?.attachedGroupName }}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">送信日時:</span>
            <span class="meta-value">{{ report?.createdAt ? formatDate(report?.createdAt) : '読み込み中...' }}</span>
          </div>
          <div class="meta-row" *ngIf="report?.readAt">
            <span class="meta-label">既読日時:</span>
            <span class="meta-value">{{ formatDate(report?.readAt) }}</span>
          </div>
        </div>

        <div class="report-content" *ngIf="report">
          <h3 class="content-title">内容</h3>
          <div class="content-text">{{ report.content }}</div>
        </div>

        <div class="report-actions" *ngIf="report && !isOwnReport">
          <button 
            class="btn primary" 
            (click)="markAsRead()" 
            *ngIf="report.status !== 'read'"
          >
            既読にする
          </button>
        </div>
      </div>

      <!-- コメントセクション -->
      <div class="comments-section" *ngIf="report">
        <h3 class="section-title">コメント</h3>
        
        <!-- コメント一覧 -->
        <div class="comments-list" *ngIf="(comments$ | async) as comments">
          <div class="comment-item" *ngFor="let comment of comments">
            <div class="comment-header">
              <span class="commenter-name">{{ comment.commenterName }}</span>
              <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
            <div class="comment-actions" *ngIf="isOwnComment(comment)">
              <button class="btn small danger" (click)="deleteComment(comment.id)">削除</button>
            </div>
          </div>
        </div>

        <!-- コメント入力フォーム -->
        <div class="comment-form" *ngIf="!isOwnReport">
          <form [formGroup]="commentForm" (ngSubmit)="onSubmitComment()">
            <div class="form-group">
              <textarea 
                formControlName="content" 
                class="form-textarea"
                placeholder="コメントを入力してください"
                rows="3"
              ></textarea>
              <div *ngIf="commentForm.get('content')?.invalid && commentForm.get('content')?.touched" class="error-message">
                コメントは必須です (1文字以上)
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn primary" [disabled]="commentForm.invalid || loading">
                {{ loading ? '送信中...' : 'コメント送信' }}
              </button>
            </div>
          </form>
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
      align-items: center;
      gap: 1rem;
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

    .report-detail {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .report-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1f2937;
      flex: 1;
    }

    .report-status {
      padding: 0.5rem 1rem;
      border-radius: 1rem;
      font-size: 0.875rem;
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

    .report-meta {
      background: #f9fafb;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .meta-row {
      display: flex;
      margin-bottom: 0.5rem;
    }

    .meta-row:last-child {
      margin-bottom: 0;
    }

    .meta-label {
      font-weight: 600;
      color: #374151;
      min-width: 100px;
    }

    .meta-value {
      color: #6b7280;
    }


    .report-content {
      margin-bottom: 1.5rem;
    }

    .content-title {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #374151;
    }

    .content-text {
      background: #f9fafb;
      border-radius: 0.5rem;
      padding: 1rem;
      color: #4b5563;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .report-actions {
      display: flex;
      justify-content: flex-end;
    }

    .comments-section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      margin: 0 0 1.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: #1f2937;
    }

    .comments-list {
      margin-bottom: 2rem;
    }

    .comment-item {
      background: #f9fafb;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .comment-item:last-child {
      margin-bottom: 0;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .commenter-name {
      font-weight: 600;
      color: #374151;
    }

    .comment-date {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .comment-content {
      color: #4b5563;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .comment-actions {
      margin-top: 0.5rem;
      display: flex;
      justify-content: flex-end;
    }

    .comment-form {
      border-top: 1px solid #e5e7eb;
      padding-top: 1.5rem;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .form-textarea {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
      resize: vertical;
    }

    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .error-message {
      color: #ef4444;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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

    @media (max-width: 768px) {
      .page-container {
        padding: 1rem;
      }

      .report-detail,
      .comments-section {
        padding: 1.5rem;
      }

      .report-header {
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }

      .meta-row {
        flex-direction: column;
        gap: 0.25rem;
      }

      .meta-label {
        min-width: auto;
      }

      .comment-header {
        flex-direction: column;
        gap: 0.25rem;
        align-items: flex-start;
      }
    }
  `]
})
export class ProgressReportDetailPage implements OnInit, OnDestroy {
  private progressReportService = inject(ProgressReportService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  report: ProgressReport | null = null;
  comments$: Observable<ProgressReportComment[]> = of([]);
  isOwnReport = false;
  loading = false;

  commentForm = this.fb.group({
    content: ['', [Validators.required, Validators.minLength(1)]]
  });

  ngOnInit() {
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const reportId = params['id'];
      if (reportId) {
        this.loadReport(reportId);
        this.loadComments(reportId);
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadReport(reportId: string) {
    try {
      this.report = await this.progressReportService.getProgressReport(reportId);
      if (this.report) {
        this.auth.currentUser$.pipe(
          takeUntil(this.destroy$),
          take(1)
        ).subscribe(user => {
          this.isOwnReport = user ? user.uid === this.report!.senderId : false;
        });
      }
    } catch (error) {
      console.error('進捗報告読み込みエラー:', error);
    }
  }

  private loadComments(reportId: string) {
    this.comments$ = this.progressReportService.getProgressReportComments(reportId);
  }

  getStatusLabel(status: string): string {
    const labels = {
      'draft': '下書き',
      'sent': '送信済み',
      'read': '既読'
    };
    return labels[status as keyof typeof labels] || status;
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


  async markAsRead() {
    if (!this.report) return;
    
    try {
      await this.progressReportService.markAsRead(this.report.id);
      this.report.status = 'read';
      this.report.readAt = new Date() as any;
    } catch (error) {
      console.error('既読マークエラー:', error);
    }
  }

  async onSubmitComment() {
    if (this.commentForm.invalid || !this.report) return;
    
    this.loading = true;
    const formData = this.commentForm.getRawValue();
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      this.loading = false;
      return;
    }

    try {
      await this.progressReportService.addComment(this.report.id, {
        reportId: this.report.id,
        commenterId: currentUser.uid,
        commenterName: currentUser.displayName || currentUser.email?.split('@')[0] || 'ユーザー',
        content: formData.content!
      });
      
      this.commentForm.reset();
      this.loadComments(this.report.id);
    } catch (error) {
      console.error('コメント送信エラー:', error);
      alert('コメントの送信に失敗しました。');
    } finally {
      this.loading = false;
    }
  }

  isOwnComment(comment: ProgressReportComment): boolean {
    const currentUser = this.auth.currentUser;
    return currentUser ? currentUser.uid === comment.commenterId : false;
  }

  async deleteComment(commentId: string) {
    if (confirm('このコメントを削除しますか？')) {
      try {
        await this.progressReportService.deleteComment(commentId);
        if (this.report) {
          this.loadComments(this.report.id);
        }
      } catch (error) {
        console.error('コメント削除エラー:', error);
        alert('コメントの削除に失敗しました。');
      }
    }
  }

}
