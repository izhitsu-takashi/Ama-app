import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ProgressReportService } from './progress-report.service';
import { GroupService } from './group.service';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { AiReportGeneratorService, ReportGenerationData } from './ai-report-generator.service';
import { ProgressReport, Group, User, TaskItem } from './models';
import { Observable, Subject, of, firstValueFrom } from 'rxjs';
import { takeUntil, take, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-progress-report-create',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/progress-reports">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">進捗報告作成</h1>
      </div>

      <!-- 進捗報告フォーム -->
      <div class="form-container">
        <form [formGroup]="reportForm" (ngSubmit)="onSubmit()" class="report-form">
          <!-- AI自動生成セクション -->
          <div class="form-group ai-section">
            <div class="ai-section-header">
              <label class="form-label">🤖 AI自動生成</label>
              <button 
                type="button" 
                class="btn ai-generate-btn" 
                (click)="generateReportWithAI()"
                [disabled]="loading || !selectedGroupForAI"
              >
                <span class="ai-icon">✨</span>
                {{ loading ? '生成中...' : '進捗報告を自動生成' }}
              </button>
            </div>
            <div class="ai-section-content">
              <div class="ai-group-selector">
                <label class="ai-label">対象グループ:</label>
                <select 
                  [(ngModel)]="selectedGroupForAI" 
                  [ngModelOptions]="{standalone: true}"
                  class="form-select ai-select"
                >
                  <option value="">グループを選択</option>
                  <option *ngFor="let group of (userGroups$ | async)" [value]="group.id">
                    {{ group.name }}
                  </option>
                </select>
              </div>
              <div class="ai-period-selector">
                <label class="ai-label">期間:</label>
                <div class="period-inputs">
                  <input 
                    type="date" 
                    [(ngModel)]="aiPeriodStart" 
                    [ngModelOptions]="{standalone: true}"
                    class="form-input period-input"
                  />
                  <span class="period-separator">〜</span>
                  <input 
                    type="date" 
                    [(ngModel)]="aiPeriodEnd" 
                    [ngModelOptions]="{standalone: true}"
                    class="form-input period-input"
                  />
                </div>
              </div>
              <div class="ai-help">
                <small>選択したグループのタスク完了状況から進捗報告を自動生成します。</small>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">タイトル</label>
            <input 
              type="text" 
              formControlName="title" 
              class="form-input"
              placeholder="進捗報告のタイトルを入力"
            />
            <div *ngIf="reportForm.get('title')?.invalid && reportForm.get('title')?.touched" class="error-message">
              タイトルは必須です (2文字以上)
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">内容</label>
            <textarea 
              formControlName="content" 
              class="form-textarea"
              placeholder="進捗の詳細を入力してください"
              rows="8"
            ></textarea>
            <div *ngIf="reportForm.get('content')?.invalid && reportForm.get('content')?.touched" class="error-message">
              内容は必須です (10文字以上)
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">送信先ユーザー</label>
            <div class="user-search-container">
              <input 
                type="text" 
                class="form-input user-search-input"
                placeholder="ユーザー名で検索..."
                [(ngModel)]="userSearchTerm"
                [ngModelOptions]="{standalone: true}"
                (input)="onUserSearch()"
                (focus)="showUserDropdown = true"
              />
              <div class="user-dropdown" *ngIf="showUserDropdown && filteredUsers.length > 0">
                <div 
                  class="user-option" 
                  *ngFor="let user of filteredUsers"
                  (click)="selectUser(user)"
                  [class.selected]="isUserSelected(user)"
                >
                  <div class="user-avatar">
                    <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || 'ユーザー'" class="avatar-image">
                    <span *ngIf="!user.photoURL" class="default-avatar">{{ getUserInitials(user) }}</span>
                  </div>
                  <div class="user-info">
                    <span class="user-name">{{ user.displayName || (user.email ? user.email.split('@')[0] : 'ユーザー') }}</span>
                    <span class="user-email" *ngIf="user.email">{{ user.email }}</span>
                  </div>
                  <div class="selection-indicator" *ngIf="isUserSelected(user)">✓</div>
                </div>
              </div>
              <div class="user-dropdown" *ngIf="showUserDropdown && filteredUsers.length === 0 && userSearchTerm.length > 0">
                <div class="no-results">ユーザーが見つかりません</div>
              </div>
            </div>
            
            <!-- 選択されたユーザー一覧 -->
            <div class="selected-users" *ngIf="selectedUsers.length > 0">
              <div class="selected-users-header">
                <span class="selected-label">選択中 ({{ selectedUsers.length }}人):</span>
                <button type="button" class="clear-all-btn" (click)="clearAllUsers()">すべてクリア</button>
              </div>
              <div class="selected-users-list">
                <div class="selected-user-item" *ngFor="let user of selectedUsers">
                  <div class="user-avatar-small">
                    <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || 'ユーザー'" class="avatar-image-small">
                    <span *ngIf="!user.photoURL" class="default-avatar-small">{{ getUserInitials(user) }}</span>
                  </div>
                  <div class="user-info-small">
                    <span class="user-name-small">{{ user.displayName || (user.email ? user.email.split('@')[0] : 'ユーザー') }}</span>
                    <span class="user-email-small" *ngIf="user.email">{{ user.email }}</span>
                  </div>
                  <button type="button" class="remove-user-btn" (click)="removeUser(user)">×</button>
                </div>
              </div>
            </div>
            
            <div *ngIf="selectedUsers.length === 0 && reportForm.get('recipientIds')?.touched" class="error-message">
              送信先を1人以上選択してください
            </div>
          </div>

          <!-- グループ添付（任意） -->
          <div class="form-group">
            <label class="form-label">関連グループ（任意）</label>
            <select formControlName="attachedGroupId" class="form-select">
              <option value="">関連グループを選択（任意）</option>
              <option *ngFor="let group of (userGroups$ | async)" [value]="group.id">
                {{ group.name }}
              </option>
            </select>
            <div class="form-help">
              進捗報告に関連するグループを添付できます。個人送信でも関連グループを指定可能です。
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn secondary" routerLink="/progress-reports">キャンセル</button>
            <button type="button" class="btn tertiary" (click)="saveDraft()" [disabled]="loading">
              {{ loading ? '保存中...' : '下書き保存' }}
            </button>
            <button type="submit" class="btn primary" [disabled]="reportForm.invalid || loading">
              {{ loading ? '送信中...' : '送信' }}
            </button>
          </div>
        </form>
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

    .form-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 800px;
      margin: 0 auto;
    }

    .report-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-weight: 600;
      color: #374151;
      font-size: 1rem;
    }

    .form-input,
    .form-textarea,
    .form-select {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .form-textarea {
      resize: vertical;
      min-height: 200px;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .error-message {
      color: #ef4444;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .form-help {
      color: #6b7280;
      font-size: 0.875rem;
      margin-top: 0.25rem;
      font-style: italic;
    }

    .recipient-options {
      display: flex;
      gap: 2rem;
      margin-top: 0.5rem;
    }

    .option-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .radio-label {
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
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

    .btn.secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn.secondary:hover {
      background: #e5e7eb;
    }

    .btn.tertiary {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #d1d5db;
    }

    .btn.tertiary:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .user-search-container {
      position: relative;
    }

    .user-search-input {
      width: 100%;
    }

    .user-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #d1d5db;
      border-top: none;
      border-radius: 0 0 0.5rem 0.5rem;
      max-height: 200px;
      overflow-y: auto;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .user-option {
      padding: 0.75rem;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background-color 0.2s;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .user-option:hover {
      background-color: #f9fafb;
    }

    .user-option:last-child {
      border-bottom: none;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-avatar {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      flex: 1;
    }

    .user-name {
      font-weight: 600;
      color: #374151;
    }

    .user-email {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .no-results {
      padding: 0.75rem;
      text-align: center;
      color: #6b7280;
      font-style: italic;
    }

    .selected-user {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      padding: 0.5rem;
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 0.5rem;
    }

    .selected-label {
      font-size: 0.875rem;
      color: #0369a1;
      font-weight: 600;
    }

    .selected-name {
      flex: 1;
      color: #0c4a6e;
      font-weight: 500;
    }

    .clear-selection {
      background: none;
      border: none;
      color: #dc2626;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: background-color 0.2s;
    }

    .clear-selection:hover {
      background-color: #fee2e2;
    }

    .user-option.selected {
      background-color: #eff6ff;
      border-left: 3px solid #0ea5e9;
    }

    .selection-indicator {
      color: #0ea5e9;
      font-weight: 600;
      font-size: 1.2rem;
    }

    .selected-users {
      margin-top: 1rem;
      padding: 1rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
    }

    .selected-users-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .clear-all-btn {
      background: none;
      border: none;
      color: #dc2626;
      font-size: 0.875rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      transition: background-color 0.2s;
    }

    .clear-all-btn:hover {
      background-color: #fee2e2;
    }

    .selected-users-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .selected-user-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
    }

    .user-avatar-small {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-image-small {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-avatar-small {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.75rem;
    }

    .user-info-small {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      flex: 1;
    }

    .user-name-small {
      font-weight: 500;
      color: #374151;
      font-size: 0.875rem;
    }

    .user-email-small {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .remove-user-btn {
      background: none;
      border: none;
      color: #dc2626;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: background-color 0.2s;
    }

    .remove-user-btn:hover {
      background-color: #fee2e2;
    }

    .ai-section {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #0ea5e9;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-top: 1rem;
    }

    .ai-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .ai-generate-btn {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .ai-generate-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
    }

    .ai-generate-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .ai-icon {
      font-size: 1.1rem;
    }

    .ai-section-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ai-group-selector,
    .ai-period-selector {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .ai-label {
      font-weight: 600;
      color: #0369a1;
      min-width: 100px;
    }

    .ai-select {
      flex: 1;
      max-width: 300px;
    }

    .period-inputs {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .period-input {
      width: 150px;
    }

    .period-separator {
      color: #0369a1;
      font-weight: 600;
    }

    .ai-help {
      color: #0369a1;
      font-style: italic;
      margin-top: 0.5rem;
    }

    @media (max-width: 768px) {
      .page-container {
        padding: 1rem;
      }

      .form-container {
        padding: 1.5rem;
      }

      .recipient-options {
        flex-direction: column;
        gap: 1rem;
      }

      .form-actions {
        flex-direction: column;
      }
    }
  `]
})
export class ProgressReportCreatePage implements OnInit, OnDestroy {
  private progressReportService = inject(ProgressReportService);
  private groupService = inject(GroupService);
  private userService = inject(UserService);
  private auth = inject(AuthService);
  private aiReportGenerator = inject(AiReportGeneratorService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  userGroups$: Observable<Group[]> = of([]);
  availableUsers: User[] = [];
  filteredUsers: User[] = [];
  selectedUsers: User[] = [];
  userSearchTerm = '';
  showUserDropdown = false;
  loading = false;
  editingReportId: string | null = null;
  isEditing = false;
  
  // AI自動生成用のプロパティ
  selectedGroupForAI: string = '';
  aiPeriodStart: string = '';
  aiPeriodEnd: string = '';

  reportForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    content: ['', [Validators.required, Validators.minLength(10)]],
    recipientIds: [[] as string[], [Validators.required, Validators.minLength(1)]],
    attachedGroupId: [''] // 添付グループ
  });

  ngOnInit() {
    this.loadUserGroups();
    this.loadAvailableUsers();
    this.initializeAIPeriod();
    
    // 編集モードのチェック
    this.route.queryParams.subscribe(params => {
      if (params['editId']) {
        this.editingReportId = params['editId'];
        this.isEditing = true;
        this.loadReportForEdit(params['editId']);
      }
    });
    
    // ドキュメントクリックでドロップダウンを閉じる
    document.addEventListener('click', this.onDocumentClick.bind(this));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.onDocumentClick.bind(this));
  }

  private loadUserGroups() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap((user: any) => {
        if (user) {
          return this.groupService.getUserGroups(user.uid);
        }
        return of([]);
      })
    ).subscribe((groups: Group[]) => {
      this.userGroups$ = of(groups);
    });
  }

  private loadAvailableUsers() {
    // 全ユーザーを取得
    this.userService.getAllUsers().subscribe({
      next: (users: User[]) => {
        this.availableUsers = users;
      },
      error: (error: any) => {
        console.error('❌ Error loading users:', error);
        this.availableUsers = [];
      }
    });
  }


  onUserSearch() {
    if (this.userSearchTerm.trim().length === 0) {
      this.filteredUsers = [];
      return;
    }

    const searchTerm = this.userSearchTerm.toLowerCase().trim();
    this.filteredUsers = this.availableUsers.filter(user => {
      // 自分を除外
      const currentUser = this.auth.currentUser;
      if (user.id === currentUser?.uid) {
        return false;
      }
      const displayName = (user.displayName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      return displayName.includes(searchTerm) || email.includes(searchTerm);
    });
  }

  selectUser(user: User) {
    if (!this.isUserSelected(user)) {
      this.selectedUsers.push(user);
      this.updateRecipientIds();
    }
    this.showUserDropdown = false;
    this.userSearchTerm = '';
  }

  removeUser(user: User) {
    this.selectedUsers = this.selectedUsers.filter(u => u.id !== user.id);
    this.updateRecipientIds();
  }

  clearAllUsers() {
    this.selectedUsers = [];
    this.updateRecipientIds();
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  private updateRecipientIds() {
    const recipientIds = this.selectedUsers.map(user => user.id);
    this.reportForm.patchValue({ recipientIds });
  }

  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-search-container')) {
      this.showUserDropdown = false;
    }
  }

  /**
   * AI期間の初期化（デフォルトで過去1週間）
   */
  private initializeAIPeriod() {
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    this.aiPeriodEnd = today.toISOString().split('T')[0];
    this.aiPeriodStart = oneWeekAgo.toISOString().split('T')[0];
  }

  /**
   * AIで進捗報告を自動生成
   */
  async generateReportWithAI() {
    if (!this.selectedGroupForAI || !this.aiPeriodStart || !this.aiPeriodEnd) {
      alert('対象グループと期間を選択してください。');
      return;
    }

    this.loading = true;

    try {
      // グループ情報を取得
      const groups = await this.userGroups$.pipe(take(1)).toPromise();
      const selectedGroup = groups?.find(g => g.id === this.selectedGroupForAI);
      
      if (!selectedGroup) {
        alert('選択したグループが見つかりません。');
        return;
      }

      // グループのタスクを取得
      const tasks = await this.groupService.getGroupTasks(this.selectedGroupForAI);
      
      // 期間内のタスクをフィルタリング（発生日または作成日で判定）
      const startDate = new Date(this.aiPeriodStart);
      const endDate = new Date(this.aiPeriodEnd);
      endDate.setHours(23, 59, 59, 999); // 終了日の23:59:59まで含める
      
      // 期間フィルタリングを緩和：すべてのタスクを含める
      const filteredTasks = tasks; // 期間フィルタリングを一時的に無効化

      // タスクをカテゴリ別に分類
      const categorizedTasks = this.aiReportGenerator.categorizeTasks(filteredTasks);

      // 生成データを準備
      const generationData: ReportGenerationData = {
        groupId: this.selectedGroupForAI,
        groupName: selectedGroup.name,
        period: {
          start: startDate,
          end: endDate
        },
        tasks: filteredTasks,
        completedTasks: categorizedTasks.completed,
        inProgressTasks: categorizedTasks.inProgress,
        overdueTasks: categorizedTasks.overdue,
        upcomingTasks: categorizedTasks.upcoming
      };

      // AIで進捗報告を生成
      const generatedReport = await firstValueFrom(this.aiReportGenerator.generateProgressReport(generationData));
      
      if (generatedReport) {
        // フォームに生成された内容を設定
        this.reportForm.patchValue({
          title: generatedReport.title,
          content: generatedReport.content
        });

        // 関連グループも自動設定
        this.reportForm.patchValue({
          attachedGroupId: this.selectedGroupForAI
        });

        alert('進捗報告を自動生成しました！内容を確認して必要に応じて編集してください。');
      }
    } catch (error) {
      console.error('AI進捗報告生成エラー:', error);
      alert('進捗報告の自動生成に失敗しました。');
    } finally {
      this.loading = false;
    }
  }

  async loadReportForEdit(reportId: string) {
    try {
      const report = await this.progressReportService.getProgressReport(reportId);
      if (report) {
        this.reportForm.patchValue({
          title: report.title,
          content: report.content
        });

        if (report.recipientId) {
          this.reportForm.patchValue({ recipientIds: [report.recipientId] });
          // ユーザー情報を設定
          const user = this.availableUsers.find(u => u.id === report.recipientId);
          if (user) {
            this.selectedUsers = [user];
            this.userSearchTerm = user.displayName || (user.email ? user.email.split('@')[0] : 'ユーザー');
          }
        }

        // 添付グループの読み込み
        if (report.attachedGroupId) {
          this.reportForm.patchValue({ attachedGroupId: report.attachedGroupId });
        }
      }
    } catch (error) {
      console.error('進捗報告読み込みエラー:', error);
    }
  }

  async saveDraft() {
    if (this.reportForm.get('title')?.invalid || this.reportForm.get('content')?.invalid) {
      alert('タイトル（2文字以上）と内容（10文字以上）を入力してください。');
      return;
    }

    this.loading = true;
    const formData = this.reportForm.getRawValue();
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      this.loading = false;
      return;
    }

    try {
      const reportData: Omit<ProgressReport, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title!,
        content: formData.content!,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'ユーザー'),
        status: 'draft'
      };

      if (formData.recipientIds && formData.recipientIds.length > 0) {
        // 下書きでは最初のユーザーのみ保存
        const recipient = this.availableUsers.find(u => u.id === formData.recipientIds?.[0]);
        reportData.recipientId = formData.recipientIds[0];
        reportData.recipientName = recipient?.displayName || (recipient?.email ? recipient.email.split('@')[0] : 'ユーザー');
      }

      // 添付グループの処理
      if (formData.attachedGroupId) {
        const groups = await firstValueFrom(this.userGroups$);
        const attachedGroup = groups?.find(g => g.id === formData.attachedGroupId);
        reportData.attachedGroupId = formData.attachedGroupId;
        reportData.attachedGroupName = attachedGroup?.name || 'グループ';
      }

      if (this.isEditing && this.editingReportId) {
        await this.progressReportService.updateProgressReport(this.editingReportId, reportData);
        alert('下書きを更新しました！');
      } else {
        await this.progressReportService.createProgressReport(reportData);
        alert('下書きを保存しました！');
      }
      
      this.router.navigate(['/progress-reports']);
    } catch (error) {
      console.error('下書き保存エラー:', error);
      alert('下書きの保存に失敗しました。');
    } finally {
      this.loading = false;
    }
  }

  async onSubmit() {
    if (this.reportForm.invalid) return;
    
    this.loading = true;
    const formData = this.reportForm.getRawValue();
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      this.loading = false;
      return;
    }

    try {
      const reportData: Omit<ProgressReport, 'id' | 'createdAt' | 'updatedAt'> = {
        title: formData.title!,
        content: formData.content!,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'ユーザー'),
        status: 'sent'
      };

      // 複数ユーザーへの送信処理
      if (formData.recipientIds && formData.recipientIds.length > 0) {
        // 添付グループ情報を取得
        let attachedGroup: Group | undefined;
        if (formData.attachedGroupId) {
          const groups = await firstValueFrom(this.userGroups$);
          attachedGroup = groups?.find(g => g.id === formData.attachedGroupId);
        }

        // 全受信者の名前を取得
        const allRecipients = (formData.recipientIds || []).map(recipientId => {
          const recipient = this.availableUsers.find(u => u.id === recipientId);
          return recipient?.displayName || (recipient?.email ? recipient.email.split('@')[0] : 'ユーザー');
        });

        // 1つの進捗報告に複数受信者を含める
        const multiRecipientReportData: Omit<ProgressReport, 'id' | 'createdAt' | 'updatedAt'> = {
          ...reportData,
          recipientIds: formData.recipientIds,
          recipientNames: allRecipients
        };

        // 添付グループ情報を追加
        if (formData.attachedGroupId && attachedGroup) {
          multiRecipientReportData.attachedGroupId = formData.attachedGroupId;
          multiRecipientReportData.attachedGroupName = attachedGroup.name;
        }
        
        await this.progressReportService.createProgressReport(multiRecipientReportData);
      }
      
      alert(`${formData.recipientIds?.length || 0}人に進捗報告を送信しました！`);
      this.router.navigate(['/progress-reports']);
    } catch (error) {
      console.error('進捗報告送信エラー:', error);
      alert('進捗報告の送信に失敗しました。');
    } finally {
      this.loading = false;
    }
  }

  getUserInitials(user: User): string {
    if (user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    } else if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  }
}
