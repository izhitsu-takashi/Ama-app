import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-group-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">新しいグループを作成</h1>
      </div>

      <div class="form-container">
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="create-form">
          <div class="form-group">
            <label class="form-label">グループ名</label>
            <input 
              type="text" 
              formControlName="name" 
              class="form-input"
              placeholder="グループ名を入力"
              [class.error]="form.get('name')?.invalid && form.get('name')?.touched"
            />
            <div *ngIf="form.get('name')?.invalid && form.get('name')?.touched" class="error-message">
              <span *ngIf="form.get('name')?.errors?.['required']">グループ名を入力してください</span>
              <span *ngIf="form.get('name')?.errors?.['minlength']">グループ名は2文字以上で入力してください</span>
              <span *ngIf="form.get('name')?.errors?.['maxlength']">グループ名は50文字以内で入力してください</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">説明</label>
            <textarea 
              formControlName="description" 
              class="form-textarea"
              placeholder="グループの説明を入力（任意）"
              rows="4"
            ></textarea>
            <div class="field-hint">
              <span class="hint-icon">💡</span>
              グループの目的や活動内容を説明してください
            </div>
          </div>


          <div class="form-group">
            <label class="form-label">参加承認</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" formControlName="requiresApproval" [value]="true" class="radio-input">
                <span class="radio-label">
                  <span class="radio-title">承認が必要</span>
                  <span class="radio-description">管理者が参加リクエストを承認します</span>
                </span>
              </label>
              <label class="radio-option">
                <input type="radio" formControlName="requiresApproval" [value]="false" class="radio-input">
                <span class="radio-label">
                  <span class="radio-title">自動承認</span>
                  <span class="radio-description">参加リクエストは自動で承認されます</span>
                </span>
              </label>
            </div>
          </div>

          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary"
              routerLink="/main"
            >
              キャンセル
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              [disabled]="form.invalid || loading"
              [class.loading]="loading"
            >
              <span *ngIf="!loading">グループを作成</span>
              <span *ngIf="loading" class="loading-spinner">⏳</span>
            </button>
          </div>

          <div *ngIf="error" class="error-alert">
            <span class="error-icon">⚠️</span>
            {{ error }}
          </div>
        </form>
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
      max-width: 800px;
      margin: 0 auto 30px;
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
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

    .form-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .create-form {
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    }

    .form-group {
      margin-bottom: 30px;
    }

    .form-label {
      display: block;
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #fff;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .error-message {
      font-size: 14px;
      color: #ef4444;
      font-weight: 500;
      margin-top: 6px;
    }

    .field-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #6b7280;
      margin-top: 6px;
    }

    .hint-icon {
      font-size: 16px;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .radio-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .radio-option:hover {
      border-color: #667eea;
      background: #f8faff;
    }

    .radio-input {
      margin: 0;
      width: 20px;
      height: 20px;
      accent-color: #667eea;
      margin-top: 2px;
    }

    .radio-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .radio-title {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }

    .radio-description {
      color: #6b7280;
      font-size: 14px;
    }

    .form-actions {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 14px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .btn-secondary:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .error-alert {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 16px;
      border-radius: 12px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
    }

    .error-icon {
      font-size: 18px;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .page-container {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .page-title {
        font-size: 24px;
      }

      .create-form {
        padding: 24px;
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
export class GroupCreatePage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);

  loading = false;
  error = '';

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    description: ['', [Validators.maxLength(500)]],
    requiresApproval: [true, [Validators.required]]
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    
    const { name, description, requiresApproval } = this.form.getRawValue();
    
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        this.error = 'ログインが必要です';
        return;
      }

      const group = await this.groupService.createGroup({
        name: name!,
        description: description || '',
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        isPublic: false, // デフォルトで非公開
        requiresApproval: requiresApproval!
      });
      
      await this.router.navigate(['/group', group.id]);
    } catch (e: any) {
      this.error = e?.message ?? 'グループの作成に失敗しました';
    } finally {
      this.loading = false;
    }
  }
}
