import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EmailVerificationService } from './email-verification.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">
            <div class="logo-icon">📋</div>
            <h1 class="logo-text">AMA</h1>
          </div>
          <p class="auth-subtitle">新規アカウント作成</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label">ユーザーネーム</label>
            <input 
              type="text" 
              formControlName="displayName" 
              class="form-input"
              placeholder="表示名を入力"
              [class.error]="form.get('displayName')?.invalid && form.get('displayName')?.touched"
            />
            <div *ngIf="form.get('displayName')?.invalid && form.get('displayName')?.touched" class="error-message">
              <span *ngIf="form.get('displayName')?.errors?.['required']">ユーザーネームを入力してください</span>
              <span *ngIf="form.get('displayName')?.errors?.['minlength']">ユーザーネームは2文字以上で入力してください</span>
              <span *ngIf="form.get('displayName')?.errors?.['maxlength']">ユーザーネームは20文字以内で入力してください</span>
            </div>
            <div class="username-hint">
              <span class="hint-icon">👤</span>
              他のユーザーに表示される名前です（2-20文字）
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">メールアドレス</label>
            <input 
              type="email" 
              formControlName="email" 
              class="form-input"
              placeholder="your@email.com"
              [class.error]="form.get('email')?.invalid && form.get('email')?.touched"
            />
            <div *ngIf="form.get('email')?.invalid && form.get('email')?.touched" class="error-message">
              <span *ngIf="form.get('email')?.errors?.['required']">メールアドレスを入力してください</span>
              <span *ngIf="form.get('email')?.errors?.['email']">正しいメールアドレスを入力してください</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">パスワード</label>
            <input 
              type="password" 
              formControlName="password" 
              class="form-input"
              placeholder="8文字以上のパスワード"
              [class.error]="form.get('password')?.invalid && form.get('password')?.touched"
            />
            <div *ngIf="form.get('password')?.invalid && form.get('password')?.touched" class="error-message">
              <span *ngIf="form.get('password')?.errors?.['required']">パスワードを入力してください</span>
              <span *ngIf="form.get('password')?.errors?.['minlength']">パスワードは8文字以上で入力してください</span>
            </div>
            <div class="password-hint">
              <span class="hint-icon">💡</span>
              パスワードは8文字以上で設定してください
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">パスワード（確認）</label>
            <input 
              type="password" 
              formControlName="confirmPassword" 
              class="form-input"
              placeholder="パスワードを再入力"
              [class.error]="form.get('confirmPassword')?.invalid && form.get('confirmPassword')?.touched"
            />
            <div *ngIf="form.get('confirmPassword')?.invalid && form.get('confirmPassword')?.touched" class="error-message">
              <span *ngIf="form.get('confirmPassword')?.errors?.['required']">パスワード（確認）を入力してください</span>
              <span *ngIf="form.get('confirmPassword')?.errors?.['passwordMismatch']">パスワードが一致しません</span>
            </div>
            <div class="password-hint">
              <span class="hint-icon">🔒</span>
              パスワードを再入力してください
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">所属</label>
            <select 
              formControlName="department" 
              class="form-input"
              [class.error]="form.get('department')?.invalid && form.get('department')?.touched"
            >
              <option value="">所属を選択してください</option>
              <option value="development">開発</option>
              <option value="consulting">コンサルティング</option>
              <option value="sales">営業</option>
              <option value="corporate">コーポレート</option>
              <option value="training">研修</option>
              <option value="other">その他</option>
            </select>
            <div *ngIf="form.get('department')?.invalid && form.get('department')?.touched" class="error-message">
              <span *ngIf="form.get('department')?.errors?.['required']">所属を選択してください</span>
            </div>
            <div class="department-hint">
              <span class="hint-icon">🏢</span>
              所属部門を選択してください
            </div>
          </div>

          <button 
            type="submit" 
            class="auth-button"
            [disabled]="form.invalid || loading"
            [class.loading]="loading"
          >
            <span *ngIf="!loading">アカウント作成</span>
            <span *ngIf="loading" class="loading-spinner">⏳</span>
          </button>

          <div *ngIf="error" class="error-alert">
            <span class="error-icon">⚠️</span>
            {{ error }}
          </div>
        </form>

        <div class="auth-links">
          <p class="auth-link-text">
            すでにアカウントがありますか？ 
            <a routerLink="/login" class="auth-link">ログイン</a>
          </p>
        </div>
      </div>

      <div class="auth-background">
        <div class="floating-shapes">
          <div class="shape shape-1"></div>
          <div class="shape shape-2"></div>
          <div class="shape shape-3"></div>
          <div class="shape shape-4"></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
      padding: 20px;
      box-sizing: border-box;
    }

    .auth-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      position: relative;
      z-index: 2;
    }

    .auth-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .logo-icon {
      font-size: 32px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }

    .logo-text {
      font-size: 32px;
      font-weight: 900;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      margin: 0;
    }

    .auth-subtitle {
      color: #6b7280;
      font-size: 14px;
      font-weight: 500;
      margin: 0;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin: 0;
    }

    .form-input {
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #fff;
      box-sizing: border-box;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .form-input::placeholder {
      color: #9ca3af;
    }

    select.form-input {
      cursor: pointer;
    }

    .error-message {
      font-size: 12px;
      color: #ef4444;
      font-weight: 500;
    }

    .username-hint, .password-hint, .department-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }

    .hint-icon {
      font-size: 14px;
    }


    .auth-button {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 14px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
      position: relative;
      overflow: hidden;
    }

    .auth-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .auth-button:active:not(:disabled) {
      transform: translateY(0);
    }

    .auth-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .auth-button.loading {
      pointer-events: none;
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
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .error-icon {
      font-size: 16px;
    }

    .auth-links {
      margin-top: 24px;
      text-align: center;
    }

    .auth-link-text {
      margin: 8px 0;
      color: #6b7280;
      font-size: 14px;
    }

    .auth-link {
      color: #667eea;
      text-decoration: none;
      font-weight: 600;
      transition: color 0.2s ease;
    }

    .auth-link:hover {
      color: #5a67d8;
      text-decoration: underline;
    }

    .auth-background {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1;
    }

    .floating-shapes {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    .shape {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      animation: float 6s ease-in-out infinite;
    }

    .shape-1 {
      width: 80px;
      height: 80px;
      top: 20%;
      left: 10%;
      animation-delay: 0s;
    }

    .shape-2 {
      width: 120px;
      height: 120px;
      top: 60%;
      right: 10%;
      animation-delay: 2s;
    }

    .shape-3 {
      width: 60px;
      height: 60px;
      bottom: 20%;
      left: 20%;
      animation-delay: 4s;
    }

    .shape-4 {
      width: 100px;
      height: 100px;
      top: 10%;
      right: 30%;
      animation-delay: 1s;
    }

    @keyframes float {
      0%, 100% {
        transform: translateY(0px) rotate(0deg);
      }
      50% {
        transform: translateY(-20px) rotate(180deg);
      }
    }

    /* レスポンシブ */
    @media (max-width: 480px) {
      .auth-container {
        padding: 16px;
      }

      .auth-card {
        padding: 24px;
        border-radius: 16px;
      }

      .logo-text {
        font-size: 28px;
      }

      .logo-icon {
        font-size: 28px;
      }

      .form-input {
        font-size: 16px; /* iOS zoom prevention */
      }
    }
  `]
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private users = inject(UserService);
  private emailVerification = inject(EmailVerificationService);

  loading = false;
  error = '';

  form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    department: ['', [Validators.required]],
  }, { validators: this.passwordMatchValidator });

  // パスワード一致チェック
  passwordMatchValidator(form: any) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { displayName, email, password, department } = this.form.getRawValue();
    
    try {
      // メール認証コードを送信
      await this.emailVerification.sendVerificationCode(email!);
      
      // 認証コード入力画面に遷移（パスワード情報も含める）
      await this.router.navigate(['/email-verification'], { 
        queryParams: { 
          email: email,
          displayName: displayName,
          department: department,
          password: password
        } 
      });
    } catch (e: any) {
      this.error = e?.message ?? '認証コードの送信に失敗しました';
    } finally {
      this.loading = false;
    }
  }
}


