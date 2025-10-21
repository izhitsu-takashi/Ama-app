import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from './message.service';
import { UserService } from './user.service';
import { Message, MessageThread, User } from './models';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <h2>💬 チャット
            <span *ngIf="getTotalUnreadCount() > 0" class="total-unread-badge">
              {{ getTotalUnreadCount() }}
            </span>
          </h2>
          <button class="new-chat-btn" (click)="toggleCompose()">
            {{ showCompose ? '✕' : '✏️' }}
          </button>
        </div>

        <!-- 新規メッセージ作成フォーム -->
        <div *ngIf="showCompose" class="compose-section">
          <div class="compose-card">
            <div class="compose-header">
              <h3>📝 新規メッセージ</h3>
            </div>
            <div class="compose-content">
              <form (ngSubmit)="sendMessage()" #messageForm="ngForm">
                <!-- 受信者選択 -->
                <div class="form-group">
                  <label for="recipient">受信者</label>
                  <div class="recipient-selector">
                    <input 
                      type="text" 
                      id="recipient"
                      [(ngModel)]="searchTerm"
                      (input)="onSearchChange()"
                      placeholder="ユーザー名またはメールアドレスで検索..."
                      class="search-input"
                      name="recipient"
                      required
                      #recipientInput="ngModel"
                    >
                    <div *ngIf="searchTerm && filteredUsers.length > 0" class="user-dropdown">
                      <div 
                        *ngFor="let user of filteredUsers" 
                        class="user-option"
                        (click)="selectUser(user)"
                      >
                        <div class="user-avatar">
                          <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || user.email" class="avatar-image" (error)="onImageError(user.photoURL)">
                          <span *ngIf="!user.photoURL">{{ getUserInitials(user.displayName || user.email) }}</span>
                        </div>
                        <div class="user-info">
                          <div class="user-name">{{ user.displayName || user.email }}</div>
                          <div class="user-email">{{ user.email }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div *ngIf="selectedUser" class="selected-user">
                    <div class="user-avatar">
                      <img *ngIf="selectedUser.photoURL" [src]="selectedUser.photoURL" [alt]="selectedUser.displayName || selectedUser.email" class="avatar-image" (error)="onImageError(selectedUser.photoURL)">
                      <span *ngIf="!selectedUser.photoURL">{{ getUserInitials(selectedUser.displayName || selectedUser.email) }}</span>
                    </div>
                    <div class="user-info">
                      <div class="user-name">{{ selectedUser.displayName || selectedUser.email }}</div>
                      <div class="user-email">{{ selectedUser.email }}</div>
                    </div>
                    <button type="button" class="remove-btn" (click)="removeSelectedUser()">
                      ✕
                    </button>
                  </div>
                  <div *ngIf="!selectedUser && recipientInput.touched" class="error-message">
                    受信者を選択してください
                  </div>
                </div>

                <!-- メッセージ本文 -->
                <div class="form-group">
                  <label for="content">メッセージ本文</label>
                  <textarea 
                    id="content"
                    [(ngModel)]="message.content"
                    placeholder="メッセージの内容を入力..."
                    class="form-textarea"
                    name="content"
                    rows="6"
                    required
                    #contentInput="ngModel"
                  ></textarea>
                  <div *ngIf="contentInput.invalid && contentInput.touched" class="error-message">
                    メッセージの内容を入力してください
                  </div>
                </div>

                <!-- 送信ボタン -->
                <div class="form-actions">
                  <button 
                    type="button" 
                    class="btn btn-secondary" 
                    (click)="cancelCompose()"
                  >
                    キャンセル
                  </button>
                  <button 
                    type="submit" 
                    class="btn btn-primary"
                    [disabled]="!isFormValid() || sending"
                  >
                    <span *ngIf="!sending">📤 送信</span>
                    <span *ngIf="sending">送信中...</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
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
              class="room-item message-room"
              (click)="openThread(thread)"
            >
              <div class="room-avatar">
                <div class="avatar-circle">
                  <img *ngIf="getThreadUserPhotoURL(thread)" [src]="getThreadUserPhotoURL(thread)" [alt]="getThreadTitle(thread)" class="avatar-image">
                  <span *ngIf="!getThreadUserPhotoURL(thread)">{{ getThreadInitials(thread) }}</span>
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
      background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    }

    .room-item:hover {
      background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
    }

    /* 赤い丸機能は削除 */

    /* .unreadクラスは削除し、.has-unreadのみを使用 */

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

    /* 新規メッセージ作成フォーム */
    .compose-section {
      margin-bottom: 1.5rem;
    }

    .compose-card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .compose-header {
      background: #f8fafc;
      padding: 1.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    .compose-header h3 {
      margin: 0;
      color: #1e293b;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .compose-content {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #374151;
    }

    .form-textarea, .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-textarea:focus, .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 120px;
    }

    .recipient-selector {
      position: relative;
    }

    .user-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
      max-height: 200px;
      overflow-y: auto;
    }

    .user-option {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .user-option:hover {
      background: #f8fafc;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
      margin-right: 0.75rem;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .user-avatar:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
    }

    .user-info {
      flex: 1;
    }

    .user-name {
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 0.25rem;
    }

    .user-email {
      font-size: 0.8rem;
      color: #64748b;
    }

    .selected-user {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      background: #f0f9ff;
      border: 2px solid #0ea5e9;
      border-radius: 8px;
      margin-top: 0.5rem;
    }

    .selected-user .user-avatar {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
    }

    .remove-btn {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      cursor: pointer;
      font-size: 0.8rem;
      margin-left: auto;
    }

    .remove-btn:hover {
      background: #dc2626;
    }

    .error-message {
      color: #ef4444;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
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

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f1f5f9;
      color: #64748b;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e2e8f0;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5a67d8;
      transform: translateY(-1px);
    }

    @media (max-width: 768px) {
      .container {
        padding: 0.5rem;
      }

      .header h1 {
        font-size: 2rem;
      }

      .compose-content {
        padding: 1rem;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
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
  
  // 新規メッセージ作成関連
  showCompose = false;
  searchTerm = '';
  filteredUsers: User[] = [];
  allUsers: User[] = []; // 全ユーザーのキャッシュ
  selectedUser: User | null = null;
  sending = false;
  message = {
    content: ''
  };

  constructor(
    private messageService: MessageService,
    private userService: UserService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadAllUsers(); // ユーザー情報を事前にロード
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/main']);
  }

  loadAllUsers(): void {
    // 全ユーザー情報を事前に読み込んでキャッシュ
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe(users => {
      this.allUsers = users;
    });
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

  // 新規メッセージ作成フォームの表示切り替え
  toggleCompose(): void {
    this.showCompose = !this.showCompose;
    if (!this.showCompose) {
      this.resetComposeForm();
    }
  }

  // 新規メッセージ作成フォームをリセット
  resetComposeForm(): void {
    this.searchTerm = '';
    this.filteredUsers = [];
    this.selectedUser = null;
    this.message.content = '';
  }

  // キャンセルボタン
  cancelCompose(): void {
    this.showCompose = false;
    this.resetComposeForm();
  }

  // ユーザー検索
  async onSearchChange(): Promise<void> {
    if (this.searchTerm.length < 2) {
      this.filteredUsers = [];
      return;
    }

    try {
      // 全ユーザーを取得してクライアント側でフィルタリング（自分を除外）
      this.userService.getAllUsers().pipe(
        takeUntil(this.destroy$)
      ).subscribe(users => {
        this.allUsers = users; // キャッシュに保存
        const currentUser = this.authService.currentUser;
        this.filteredUsers = users.filter(user => {
          // 自分を除外
          if (currentUser && user.id === currentUser.uid) {
            return false;
          }
          const searchLower = this.searchTerm.toLowerCase();
          const nameMatch = user.displayName?.toLowerCase().includes(searchLower);
          const emailMatch = user.email?.toLowerCase().includes(searchLower);
          return nameMatch || emailMatch;
        });
      });
    } catch (error) {
      console.error('ユーザー検索エラー:', error);
    }
  }

  // ユーザー選択
  selectUser(user: User): void {
    this.selectedUser = user;
    this.searchTerm = '';
    this.filteredUsers = [];
  }

  // 選択したユーザーを削除
  removeSelectedUser(): void {
    this.selectedUser = null;
  }

  // フォームの有効性チェック
  isFormValid(): boolean {
    return !!(this.selectedUser && this.message.content.trim());
  }

  // メッセージ送信
  async sendMessage(): Promise<void> {
    if (!this.isFormValid()) return;

    this.sending = true;
    try {
      const currentUser = this.authService.currentUser;
      if (!currentUser || !this.selectedUser) return;

      await this.messageService.sendMessage(
        this.selectedUser.id,
        '', // 件名は空文字列（削除されたため）
        this.message.content
      );
      
      alert('メッセージを送信しました！');
      this.cancelCompose();
      this.loadData(); // スレッド一覧を更新
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました。');
    } finally {
      this.sending = false;
    }
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

  getThreadUserPhotoURL(thread: MessageThread): string | undefined {
    const currentUserId = this.getCurrentUserId();
    const otherParticipantIndex = thread.participants.findIndex(id => id !== currentUserId);
    if (otherParticipantIndex === -1) return undefined;
    
    const otherUserId = thread.participants[otherParticipantIndex];
    // ユーザー情報をキャッシュから取得
    const user = this.allUsers.find(u => u.id === otherUserId);
    return user?.photoURL;
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  onImageError(photoURL: string | undefined): void {
    console.log('画像読み込みエラー:', photoURL);
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

  // 全体の未読メッセージ数を取得
  getTotalUnreadCount(): number {
    return this.threads.reduce((total, thread) => total + (thread.unreadCount || 0), 0);
  }
}
