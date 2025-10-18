import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from './message.service';
import { UserService } from './user.service';
import { User } from './models';

@Component({
  selector: 'app-message-compose',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>✉️ 新規メッセージ</h1>
        <p>メッセージを作成して送信します</p>
      </div>

      <div class="content">
        <div class="card">
          <div class="card-header">
            <h2>📝 メッセージ作成</h2>
          </div>
          <div class="card-content">
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
                        {{ getUserInitials(user.displayName || user.email) }}
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
                    {{ getUserInitials(selectedUser.displayName || selectedUser.email) }}
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

              <!-- 件名 -->
              <div class="form-group">
                <label for="subject">件名</label>
                <input 
                  type="text" 
                  id="subject"
                  [(ngModel)]="message.subject"
                  placeholder="メッセージの件名を入力..."
                  class="form-input"
                  name="subject"
                  required
                  #subjectInput="ngModel"
                >
                <div *ngIf="subjectInput.invalid && subjectInput.touched" class="error-message">
                  件名を入力してください
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
                  rows="8"
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
                  (click)="goBack()"
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
      max-width: 600px;
      margin: 0 auto;
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
    }

    .card-header h2 {
      margin: 0;
      color: #1e293b;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .card-content {
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

    .form-input, .form-textarea, .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus, .search-input:focus {
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
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
      margin-right: 0.75rem;
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
      background: #0ea5e9;
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

      .card-content {
        padding: 1rem;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class MessageComposePage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  message = {
    subject: '',
    content: ''
  };

  searchTerm = '';
  filteredUsers: User[] = [];
  selectedUser: User | null = null;
  sending = false;

  constructor(
    private messageService: MessageService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // URLパラメータから受信者IDと件名を取得
    this.route.queryParams.subscribe(params => {
      if (params['to']) {
        this.loadUserById(params['to']);
      }
      if (params['subject']) {
        this.message.subject = params['subject'];
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

  async onSearchChange(): Promise<void> {
    if (this.searchTerm.length < 2) {
      this.filteredUsers = [];
      return;
    }

    try {
      const users = await this.userService.getAllUsers();
      this.filteredUsers = users.filter(user => 
        (user.displayName && user.displayName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        user.email.toLowerCase().includes(this.searchTerm.toLowerCase())
      ).slice(0, 10); // 最大10件まで表示
    } catch (error) {
      console.error('ユーザー検索エラー:', error);
    }
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.searchTerm = '';
    this.filteredUsers = [];
  }

  removeSelectedUser(): void {
    this.selectedUser = null;
  }

  async loadUserById(userId: string): Promise<void> {
    try {
      const userProfile = await this.userService.getUserProfile(userId);
      if (userProfile) {
        // AppUserProfileをUserに変換
        this.selectedUser = {
          id: userProfile.uid,
          email: userProfile.email || '',
          displayName: userProfile.displayName || undefined,
          role: 'user', // デフォルト値
          createdAt: userProfile.createdAt || new Date(),
          updatedAt: new Date()
        };
      }
    } catch (error) {
      console.error('ユーザー取得エラー:', error);
    }
  }

  async sendMessage(): Promise<void> {
    if (!this.selectedUser) {
      alert('受信者を選択してください');
      return;
    }

    this.sending = true;
    try {
      await this.messageService.sendMessage(
        this.selectedUser.id,
        this.message.subject,
        this.message.content
      );
      
      alert('メッセージを送信しました');
      this.router.navigate(['/messages']);
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました: ' + (error as Error).message);
    } finally {
      this.sending = false;
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

  isFormValid(): boolean {
    return !!(this.selectedUser && this.message.subject.trim() && this.message.content.trim());
  }
}
