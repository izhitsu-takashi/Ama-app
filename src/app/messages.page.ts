import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from './message.service';
import { Message, MessageThread } from './models';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>💬 メッセージ</h1>
        <p>メッセージの送受信を管理します</p>
      </div>

      <div class="content">
        <!-- Line風ヘッダー -->
        <div class="chat-header">
          <h2>💬 チャット</h2>
          <button class="new-chat-btn" (click)="composeMessage()">
            ✏️
          </button>
        </div>

        <!-- ローディング表示 -->
        <div *ngIf="loading" class="loading">
          <div class="spinner"></div>
          <span>読み込み中...</span>
        </div>

        <!-- Line風チャットルーム一覧 -->
        <div *ngIf="!loading" class="chat-rooms">
          <div *ngIf="threads.length === 0" class="empty-state">
            <div class="empty-icon">💬</div>
            <h3>チャットがありません</h3>
            <p>新しいメッセージを送信してチャットを始めましょう</p>
          </div>
          
          <div *ngIf="threads.length > 0" class="room-list">
            <div 
              *ngFor="let thread of threads" 
              class="room-item"
              [class.unread]="thread.unreadCount > 0"
              (click)="openThread(thread)"
            >
              <div class="room-avatar">
                <div class="avatar-circle">
                  {{ getThreadInitials(thread) }}
                </div>
                <div *ngIf="thread.unreadCount > 0" class="unread-badge">
                  {{ thread.unreadCount }}
                </div>
              </div>
              
              <div class="room-content">
                <div class="room-header">
                  <h3 class="room-name">{{ getThreadTitle(thread) }}</h3>
                  <span class="room-time">{{ formatTime(thread.lastMessage?.createdAt) }}</span>
                </div>
                
                <div class="room-preview">
                  <span class="preview-text">{{ thread.lastMessage?.content }}</span>
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
      margin: 0 0 0.5rem 0;
      font-weight: 700;
    }

    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin: 0;
    }

    .content {
      max-width: 800px;
      margin: 0 auto;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 1rem 1.5rem;
      border-radius: 12px;
      backdrop-filter: blur(10px);
    }

    .chat-header h2 {
      margin: 0;
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .new-chat-btn {
      background: #00c851;
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(0, 200, 81, 0.3);
    }

    .new-chat-btn:hover {
      background: #00a041;
      transform: scale(1.05);
    }

    .action-section {
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .new-message-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 25px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
    }

    .new-message-btn:hover {
      background: #059669;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
    }

    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .card-header {
      background: #f8fafc;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h2 {
      margin: 0;
      color: #1e293b;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .count {
      background: #667eea;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .card-content {
      padding: 0;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      color: #64748b;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      margin: 0 0 0.5rem 0;
      color: #334155;
      font-size: 1.25rem;
    }

    .empty-state p {
      margin: 0;
      font-size: 0.9rem;
    }

    .chat-rooms {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .room-list {
      max-height: 600px;
      overflow-y: auto;
    }

    .room-item {
      display: flex;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .room-item:hover {
      background: #f8fafc;
    }

    .room-item.unread {
      background: #f0f9ff;
      border-left: 4px solid #00c851;
    }

    .room-item.unread::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: #00c851;
    }

    .room-avatar {
      position: relative;
      margin-right: 1rem;
    }

    .avatar-circle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00c851 0%, #00a041 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.2rem;
      box-shadow: 0 2px 8px rgba(0, 200, 81, 0.3);
    }

    .unread-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background: #ff4444;
      color: white;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .unread-indicator {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid white;
    }

    .room-content {
      flex: 1;
      min-width: 0;
    }

    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
    }

    .room-name {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #1e293b;
    }

    .room-time {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 500;
    }

    .room-preview {
      font-size: 0.9rem;
      color: #64748b;
      line-height: 1.4;
    }

    .preview-text {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
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

    @media (max-width: 768px) {
      .container {
        padding: 0.5rem;
      }

      .header h1 {
        font-size: 2rem;
      }

      .tab-navigation {
        flex-direction: column;
        gap: 0.25rem;
      }

      .tab-btn {
        padding: 0.5rem;
        font-size: 0.8rem;
      }

      .thread-item, .message-item {
        padding: 0.75rem 1rem;
      }

      .avatar-circle {
        width: 40px;
        height: 40px;
        font-size: 1rem;
      }

      .thread-header, .message-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.25rem;
      }
    }
  `]
})
export class MessagesPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  threads: MessageThread[] = [];
  loading = false;

  constructor(
    private messageService: MessageService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/main']);
  }

  async loadData(): Promise<void> {
    this.loading = true;
    try {
      this.messageService.getMessageThreads().subscribe({
        next: (threads) => {
          this.threads = threads;
          this.loading = false;
        },
        error: (error) => {
          console.error('スレッド取得エラー:', error);
          this.threads = [];
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('データ取得エラー:', error);
      this.threads = [];
      this.loading = false;
    }
  }

  composeMessage(): void {
    this.router.navigate(['/messages/compose']);
  }

  openThread(thread: MessageThread): void {
    // 他の参加者のIDを取得
    const otherParticipantId = thread.participants.find(id => id !== this.getCurrentUserId());
    if (otherParticipantId) {
      this.router.navigate(['/chat', otherParticipantId]);
    }
  }

  openMessage(message: Message): void {
    this.router.navigate(['/messages/view', message.id]);
  }

  getThreadTitle(thread: MessageThread): string {
    const currentUserId = this.getCurrentUserId();
    const otherParticipantIndex = thread.participants.findIndex(id => id !== currentUserId);
    return thread.participantNames[otherParticipantIndex] || 'Unknown User';
  }

  getThreadInitials(thread: MessageThread): string {
    const title = this.getThreadTitle(thread);
    return this.getUserInitials(title);
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨日';
    } else if (days < 7) {
      return `${days}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
    }
  }

  private getCurrentUserId(): string {
    // AuthServiceから現在のユーザーIDを取得
    return this.authService.currentUser?.uid || '';
  }
}
