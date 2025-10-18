import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from './message.service';
import { Message } from './models';

@Component({
  selector: 'app-message-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>📧 メッセージ詳細</h1>
      </div>

      <div class="content">
        <!-- ローディング表示 -->
        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>読み込み中...</span>
        </div>

        <!-- メッセージ詳細 -->
        <div *ngIf="!loading && message" class="card">
          <div class="message-header">
            <div class="message-info">
              <div class="sender-info">
                <div class="sender-avatar">
                  {{ getUserInitials(message.senderName) }}
                </div>
                <div class="sender-details">
                  <h2 class="sender-name">{{ message.senderName }}</h2>
                  <p class="sender-email">{{ message.senderEmail }}</p>
                </div>
              </div>
              <div class="message-meta">
                <div class="message-time">{{ formatDate(message.createdAt) }}</div>
                <div class="message-status" [class.read]="message.isRead">
                  {{ message.isRead ? '既読' : '未読' }}
                </div>
              </div>
            </div>
          </div>

          <div class="message-content">
            <div class="message-subject">
              <h3>{{ message.subject }}</h3>
            </div>
            <div class="message-body">
              <p>{{ message.content }}</p>
            </div>
          </div>

          <div class="message-actions">
            <button class="btn btn-secondary" (click)="goBack()">
              ← 戻る
            </button>
            <button class="btn btn-primary" (click)="replyMessage()">
              📤 返信
            </button>
            <button class="btn btn-danger" (click)="deleteMessage()">
              🗑️ 削除
            </button>
          </div>
        </div>

        <!-- エラー表示 -->
        <div *ngIf="!loading && !message" class="error-card">
          <div class="error-icon">❌</div>
          <h3>メッセージが見つかりません</h3>
          <p>指定されたメッセージが存在しないか、削除された可能性があります。</p>
          <button class="btn btn-primary" (click)="goBack()">
            メッセージ一覧に戻る
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .header {
      text-align: center;
      color: white;
      margin-bottom: 2rem;
      position: relative;
    }

    .back-btn {
      position: absolute;
      left: 0;
      top: 0;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s ease;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }

    .header h1 {
      font-size: 2.5rem;
      margin: 0;
      font-weight: 700;
    }

    .content {
      max-width: 800px;
      margin: 0 auto;
    }

    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .message-header {
      background: #f8fafc;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .message-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sender-info {
      display: flex;
      align-items: center;
    }

    .sender-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.2rem;
      margin-right: 1rem;
    }

    .sender-details h2 {
      margin: 0 0 0.25rem 0;
      color: #1e293b;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .sender-details p {
      margin: 0;
      color: #64748b;
      font-size: 0.9rem;
    }

    .message-meta {
      text-align: right;
    }

    .message-time {
      color: #64748b;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
    }

    .message-status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
      background: #fef3c7;
      color: #92400e;
    }

    .message-status.read {
      background: #d1fae5;
      color: #065f46;
    }

    .message-content {
      padding: 1.5rem;
    }

    .message-subject {
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .message-subject h3 {
      margin: 0;
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .message-body {
      line-height: 1.6;
      color: #374151;
    }

    .message-body p {
      margin: 0;
      white-space: pre-wrap;
    }

    .message-actions {
      background: #f8fafc;
      padding: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
    }

    .btn-secondary:hover {
      background: #e2e8f0;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
      transform: translateY(-1px);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 3rem;
      color: white;
      font-size: 1.1rem;
    }

    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      padding: 3rem;
      text-align: center;
    }

    .error-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .error-card h3 {
      margin: 0 0 0.5rem 0;
      color: #1e293b;
      font-size: 1.25rem;
    }

    .error-card p {
      margin: 0 0 2rem 0;
      color: #64748b;
    }

    @media (max-width: 768px) {
      .container {
        padding: 0.5rem;
      }

      .header h1 {
        font-size: 2rem;
      }

      .message-info {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }

      .message-meta {
        text-align: left;
      }

      .message-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class MessageViewPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  message: Message | null = null;
  loading = false;

  constructor(
    private messageService: MessageService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadMessage(params['id']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/messages']);
  }

  async loadMessage(messageId: string): Promise<void> {
    this.loading = true;
    try {
      // 実際の実装では、MessageServiceにgetMessageメソッドを追加する必要があります
      // ここでは仮の実装として、受信メッセージから該当するメッセージを探します
      const messages = await this.messageService.getReceivedMessages().toPromise() || [];
      this.message = messages.find(msg => msg.id === messageId) || null;
      
      if (this.message && !this.message.isRead) {
        await this.messageService.markAsRead(messageId);
        this.message.isRead = true;
      }
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      this.message = null;
    } finally {
      this.loading = false;
    }
  }

  replyMessage(): void {
    if (this.message) {
      // 件名に「Re:」が既に含まれているかチェック
      const subject = this.message.subject.startsWith('Re: ') 
        ? this.message.subject 
        : `Re: ${this.message.subject}`;
      
      this.router.navigate(['/messages/compose'], {
        queryParams: { 
          to: this.message.senderId,
          subject: subject,
          replyTo: this.message.id
        }
      });
    }
  }

  async deleteMessage(): Promise<void> {
    if (!this.message) return;

    if (confirm('このメッセージを削除しますか？')) {
      try {
        await this.messageService.deleteMessage(this.message.id);
        alert('メッセージを削除しました');
        this.goBack();
      } catch (error) {
        console.error('メッセージ削除エラー:', error);
        alert('メッセージの削除に失敗しました: ' + (error as Error).message);
      }
    }
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
