import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from './message.service';
import { Message, User } from './models';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Component({
  selector: 'app-chat-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="chat-container">
      <!-- チャットヘッダー -->
      <div class="chat-header">
        <button class="back-btn" (click)="goBack()">
          ←
        </button>
        <div class="chat-info">
          <div class="chat-avatar">
            {{ getUserInitials(otherUserName) }}
          </div>
          <div class="chat-details">
            <h2 class="chat-title">{{ otherUserName }}</h2>
            <span class="chat-status">オンライン</span>
          </div>
        </div>
        <div class="chat-actions">
          <button class="action-btn" (click)="showUserInfo()">
            ℹ️
          </button>
        </div>
      </div>

      <!-- メッセージエリア -->
      <div class="messages-container" #messagesContainer>
        <div *ngIf="loading" class="loading-messages">
          <div class="spinner"></div>
          <span>メッセージを読み込み中...</span>
        </div>

        <div *ngIf="!loading && messages.length === 0" class="empty-chat">
          <div class="empty-icon">💬</div>
          <h3>まだメッセージがありません</h3>
          <p>最初のメッセージを送信してみましょう</p>
        </div>

        <div *ngIf="!loading && messages.length > 0" class="messages-list">
          <div 
            *ngFor="let message of messages; let i = index" 
            class="message-wrapper"
            [class.same-sender]="isSameSender(message, messages[i-1])"
          >
            <!-- 日付セパレーター -->
            <div *ngIf="shouldShowDateSeparator(message, messages[i-1])" class="date-separator">
              {{ formatDateSeparator(message.createdAt) }}
            </div>

            <!-- メッセージバブル -->
            <div class="message-bubble" 
                 [class.sent]="isSentByCurrentUser(message)" 
                 [class.received]="!isSentByCurrentUser(message)"
                 [class.sending]="message.isTemporary">
              <div class="message-content">
                {{ message.content }}
                <span *ngIf="message.isTemporary" class="sending-indicator">送信中...</span>
              </div>
              <div class="message-meta">
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                <span *ngIf="isSentByCurrentUser(message) && !message.isTemporary" class="read-status">
                  {{ message.isRead ? '既読' : '未読' }}
                </span>
                <!-- 削除ボタン（自分のメッセージのみ） -->
                <button 
                  *ngIf="isSentByCurrentUser(message) && !message.isTemporary" 
                  class="delete-btn"
                  (click)="deleteMessage(message.id)"
                  title="メッセージを削除"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- メッセージ入力エリア -->
      <div class="input-container">
        <div class="input-wrapper">
          <textarea 
            [(ngModel)]="newMessage"
            (keydown.enter)="onEnterKey($event)"
            placeholder="メッセージを入力..."
            class="message-input"
            rows="1"
            #messageInput
          ></textarea>
          <button 
            class="send-btn" 
            (click)="sendMessage()"
            [disabled]="!newMessage.trim() || sending"
          >
            <span *ngIf="!sending">📤</span>
            <span *ngIf="sending">⏳</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f0f2f5;
    }

    .chat-header {
      background: #00c851;
      color: white;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      background: rgba(255, 255, 255, 0.2);
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
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .chat-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
    }

    .chat-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .chat-details {
      flex: 1;
    }

    .chat-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }

    .chat-status {
      font-size: 0.8rem;
      opacity: 0.8;
    }

    .chat-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: #f0f2f5;
    }

    .loading-messages {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem;
      color: #64748b;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e2e8f0;
      border-top: 2px solid #00c851;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .empty-chat {
      text-align: center;
      padding: 3rem 1rem;
      color: #64748b;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-chat h3 {
      margin: 0 0 0.5rem 0;
      color: #374151;
    }

    .empty-chat p {
      margin: 0;
      font-size: 0.9rem;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .message-wrapper {
      display: flex;
      flex-direction: column;
    }

    .date-separator {
      text-align: center;
      margin: 1rem 0;
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 500;
    }

    .message-bubble {
      max-width: 70%;
      padding: 0.75rem 1rem;
      border-radius: 18px;
      position: relative;
      word-wrap: break-word;
    }

    .message-bubble.sent {
      background: #00c851;
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }

    .message-bubble.received {
      background: white;
      color: #1e293b;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .message-bubble.sending {
      opacity: 0.7;
      background: #e0e0e0 !important;
      color: #666 !important;
    }

    .sending-indicator {
      font-size: 0.8rem;
      font-style: italic;
      margin-left: 0.5rem;
    }

    .message-content {
      font-size: 0.95rem;
      line-height: 1.4;
      margin-bottom: 0.25rem;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.7rem;
      opacity: 0.7;
    }

    .read-status {
      font-size: 0.6rem;
    }

    .delete-btn {
      background: transparent;
      border: none;
      padding: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      opacity: 0.6;
      transition: all 0.2s ease;
      margin-left: auto;
    }

    .delete-btn:hover {
      opacity: 1;
      transform: scale(1.2);
    }

    .input-container {
      background: white;
      padding: 1rem;
      border-top: 1px solid #e2e8f0;
    }

    .input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 0.75rem;
      background: #f8f9fa;
      border-radius: 24px;
      padding: 0.5rem 1rem;
      border: 1px solid #e2e8f0;
    }

    .message-input {
      flex: 1;
      border: none;
      background: transparent;
      resize: none;
      outline: none;
      font-size: 0.95rem;
      line-height: 1.4;
      max-height: 120px;
      min-height: 20px;
    }

    .message-input::placeholder {
      color: #9ca3af;
    }

    .send-btn {
      background: #00c851;
      color: white;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .send-btn:hover:not(:disabled) {
      background: #00a041;
      transform: scale(1.05);
    }

    .send-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }

    @media (max-width: 768px) {
      .chat-container {
        height: 100vh;
      }

      .message-bubble {
        max-width: 85%;
      }

      .chat-header {
        padding: 0.75rem;
      }

      .messages-container {
        padding: 0.75rem;
      }

      .input-container {
        padding: 0.75rem;
      }
    }
  `]
})
export class ChatRoomPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  otherUserId: string = '';
  otherUserName: string = '';
  messages: Message[] = [];
  newMessage: string = '';
  loading = false;
  sending = false;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['userId']) {
        this.otherUserId = params['userId'];
        
        // 自分とのチャットを防ぐ
        const currentUser = this.authService.currentUser;
        if (currentUser && this.otherUserId === currentUser.uid) {
          this.router.navigate(['/messages']);
          return;
        }
        
        this.loadUserInfo();
        this.loadMessages();
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

  async loadUserInfo(): Promise<void> {
    try {
      const userProfile = await this.userService.getUserProfile(this.otherUserId);
      if (userProfile) {
        this.otherUserName = userProfile.displayName || userProfile.email || 'Unknown User';
      }
    } catch (error) {
      console.error('ユーザー情報取得エラー:', error);
      this.otherUserName = 'Unknown User';
    }
  }

  async loadMessages(): Promise<void> {
    this.loading = true;
    try {
      this.messageService.getMessagesWithUser(this.otherUserId).subscribe({
        next: (messages) => {
          this.messages = messages;
          this.loading = false;
          // メッセージを既読にする
          this.markMessagesAsRead();
          // 最新メッセージにスクロール
          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: (error) => {
          console.error('メッセージ取得エラー:', error);
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      this.loading = false;
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.newMessage.trim() || this.sending) return;

    this.sending = true;
    const messageContent = this.newMessage.trim();
    this.newMessage = ''; // 先にクリアしてUIを即座に更新

    // 送信中のメッセージを一時的に表示（楽観的更新）
    const tempMessage: Message = {
      id: 'temp-' + Date.now(),
      senderId: this.authService.currentUser?.uid || '',
      senderName: this.authService.currentUser?.displayName || this.authService.currentUser?.email || 'あなた',
      senderEmail: this.authService.currentUser?.email || '',
      recipientId: this.otherUserId,
      recipientName: this.otherUserName,
      recipientEmail: '', // 一時メッセージでは空でOK
      subject: messageContent.length > 30 ? messageContent.substring(0, 30) + '...' : messageContent,
      content: messageContent,
      isRead: false,
      createdAt: new Date() as any, // Timestamp型の代わりにDateを使用
      updatedAt: new Date() as any, // Timestamp型の代わりにDateを使用
      isTemporary: true // 一時的なメッセージのフラグ
    };
    
    this.messages.push(tempMessage);
    this.scrollToBottom();

    try {
      // メッセージ内容を件名として使用（通知で表示される）
      const subject = messageContent.length > 30 ? messageContent.substring(0, 30) + '...' : messageContent;
      
      await this.messageService.sendMessage(
        this.otherUserId,
        subject,
        messageContent
      );
      
      // メッセージ送信後に一覧を再読み込み
      this.loadMessages();
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました: ' + (error as Error).message);
      // エラー時は一時メッセージを削除してメッセージを復元
      this.messages = this.messages.filter(msg => msg.id !== tempMessage.id);
      this.newMessage = messageContent;
    } finally {
      this.sending = false;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!confirm('このメッセージを削除してもよろしいですか？')) {
      return;
    }

    try {
      await this.messageService.deleteMessage(messageId);
      // メッセージ一覧から削除されたメッセージを除外
      this.messages = this.messages.filter(msg => msg.id !== messageId);
    } catch (error) {
      console.error('メッセージ削除エラー:', error);
      alert('メッセージの削除に失敗しました: ' + (error as Error).message);
    }
  }

  onEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.sendMessage();
    }
  }

  isSentByCurrentUser(message: Message): boolean {
    const currentUser = this.authService.currentUser;
    return currentUser ? message.senderId === currentUser.uid : false;
  }

  isSameSender(message: Message, previousMessage?: Message): boolean {
    if (!previousMessage) return false;
    return message.senderId === previousMessage.senderId;
  }

  shouldShowDateSeparator(message: Message, previousMessage?: Message): boolean {
    if (!previousMessage) return true;
    
    const currentDate = new Date(message.createdAt.toDate ? message.createdAt.toDate() : message.createdAt);
    const previousDate = new Date(previousMessage.createdAt.toDate ? previousMessage.createdAt.toDate() : previousMessage.createdAt);
    
    return currentDate.toDateString() !== previousDate.toDateString();
  }

  formatDateSeparator(timestamp: any): string {
    if (!timestamp) return '';
    
    let date: Date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return '今日';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return '昨日';
    } else {
      return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });
    }
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

    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  showUserInfo(): void {
    // ユーザー情報表示機能（将来実装）
    alert(`${this.otherUserName} の情報を表示`);
  }

  private async markMessagesAsRead(): Promise<void> {
    // スレッドの未読数を直接リセット（より効率的）
    const currentUser = this.authService.currentUser;
    if (currentUser && this.otherUserId) {
      const participants = [currentUser.uid, this.otherUserId].sort();
      const threadId = participants.join('_');
      
      try {
        await this.messageService.resetThreadUnreadCount(threadId);
        console.log('チャットルーム開封時に未読数をリセットしました');
      } catch (error) {
        console.error('未読数リセットエラー:', error);
      }
    }

    // 受信メッセージを既読にする（個別メッセージの既読状態も更新）
    const unreadMessages = this.messages.filter(msg => 
      !this.isSentByCurrentUser(msg) && !msg.isRead
    );

    for (const message of unreadMessages) {
      try {
        await this.messageService.markAsRead(message.id);
      } catch (error) {
        console.error('既読マークエラー:', error);
      }
    }
  }

  private scrollToBottom(): void {
    try {
      const messagesContainer = document.querySelector('.messages-list');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    } catch (error) {
      console.error('スクロールエラー:', error);
    }
  }
}
