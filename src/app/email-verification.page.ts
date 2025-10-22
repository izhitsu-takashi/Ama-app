import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EmailVerificationService } from './email-verification.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="verification-container">
      <div class="verification-card">
        <div class="verification-header">
          <h1>📧 メール認証</h1>
          <p>入力されたメールアドレスに認証コードを送信しました</p>
        </div>

        <div class="verification-form">
          <div class="form-group">
            <label for="email">メールアドレス</label>
            <input 
              type="email" 
              id="email" 
              [(ngModel)]="email" 
              placeholder="example@example.com"
              readonly
              class="form-input"
            >
          </div>

          <div class="form-group">
            <label for="verificationCode">認証コード</label>
            <input 
              type="text" 
              id="verificationCode" 
              [(ngModel)]="verificationCode" 
              placeholder="6桁の認証コードを入力"
              maxlength="6"
              class="form-input"
              (input)="onCodeInput($event)"
            >
            <small class="form-help">認証コードは10分間有効です</small>
          </div>

          <div class="verification-actions">
            <button 
              class="btn primary" 
              (click)="verifyCode()" 
              [disabled]="!verificationCode || verificationCode.length !== 6 || loading"
            >
              {{ loading ? '認証中...' : '認証する' }}
            </button>
            
            <button 
              class="btn secondary" 
              (click)="resendCode()" 
              [disabled]="loading || resendCooldown > 0"
            >
              {{ resendCooldown > 0 ? (resendCooldown + '秒後に再送信可能') : '認証コードを再送信' }}
            </button>
          </div>

          <div class="verification-footer">
            <button class="btn-link" (click)="goBack()">
              ← 戻る
            </button>
          </div>
        </div>

        <!-- エラーメッセージ -->
        <div *ngIf="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <!-- 成功メッセージ -->
        <div *ngIf="successMessage" class="success-message">
          {{ successMessage }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .verification-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }

    .verification-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 400px;
    }

    .verification-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .verification-header h1 {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
      font-size: 1.8rem;
      font-weight: 700;
    }

    .verification-header p {
      margin: 0;
      color: #718096;
      font-size: 0.9rem;
    }

    .verification-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-weight: 600;
      color: #2d3748;
      font-size: 0.9rem;
    }

    .form-input {
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: all 0.2s ease;
      background: white;
    }

    .form-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input[readonly] {
      background: #f7fafc;
      color: #718096;
    }

    .form-help {
      color: #718096;
      font-size: 0.8rem;
    }

    .verification-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
    }

    .btn.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
    }

    .btn.secondary {
      background: #f7fafc;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }

    .btn.secondary:hover:not(:disabled) {
      background: #edf2f7;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-link {
      background: none;
      border: none;
      color: #667eea;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0.5rem 0;
    }

    .btn-link:hover {
      color: #5a67d8;
    }

    .verification-footer {
      text-align: center;
      margin-top: 1rem;
    }

    .error-message {
      background: #fed7d7;
      color: #c53030;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #feb2b2;
      margin-top: 1rem;
      font-size: 0.9rem;
    }

    .success-message {
      background: #c6f6d5;
      color: #2f855a;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid #9ae6b4;
      margin-top: 1rem;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
      .verification-container {
        padding: 1rem;
      }

      .verification-card {
        padding: 1.5rem;
      }
    }
  `]
})
export class EmailVerificationPage {
  private emailVerificationService = inject(EmailVerificationService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);

  email: string = '';
  displayName: string = '';
  department: string = '';
  password: string = '';
  verificationCode: string = '';
  loading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  resendCooldown: number = 0;

  ngOnInit() {
    // URLパラメータから情報を取得
    const urlParams = new URLSearchParams(window.location.search);
    this.email = urlParams.get('email') || '';
    this.displayName = urlParams.get('displayName') || '';
    this.department = urlParams.get('department') || '';
    this.password = urlParams.get('password') || '';
    
    if (!this.email || !this.displayName || !this.department || !this.password) {
      this.router.navigate(['/login']);
    }
  }

  onCodeInput(event: any) {
    // 数字のみ入力可能
    const value = event.target.value.replace(/\D/g, '');
    this.verificationCode = value;
    event.target.value = value;
  }

  async verifyCode() {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      this.errorMessage = '6桁の認証コードを入力してください';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const isValid = await this.emailVerificationService.verifyCode(this.email, this.verificationCode);
      
      if (isValid) {
        this.successMessage = '認証が完了しました！アカウントを作成しています...';
        
        // 認証成功後、重複チェック付きでアカウント作成
        try {
          const cred = await this.emailVerificationService.createUser(
            this.email, 
            this.password, 
            this.displayName, 
            this.department as any
          );
          
          // ユーザープロファイルを作成
          await this.userService.ensureUserProfile(
            cred.user.uid, 
            this.email, 
            this.displayName, 
            this.department as any
          );
          
          this.successMessage = 'アカウントが正常に作成されました！';
          
          setTimeout(() => {
            this.router.navigate(['/main']);
          }, 2000);
        } catch (error: any) {
          console.error('アカウント作成エラー:', error);
          this.errorMessage = this.getErrorMessage(error);
        }
      } else {
        this.errorMessage = '認証コードが正しくありません。もう一度お試しください。';
      }
    } catch (error) {
      console.error('認証エラー:', error);
      this.errorMessage = '認証中にエラーが発生しました。もう一度お試しください。';
    } finally {
      this.loading = false;
    }
  }

  async resendCode() {
    if (this.resendCooldown > 0) return;

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await this.emailVerificationService.sendVerificationCode(this.email);
      this.successMessage = '認証コードを再送信しました';
      
      // 再送信クールダウン（60秒）
      this.resendCooldown = 60;
      const interval = setInterval(() => {
        this.resendCooldown--;
        if (this.resendCooldown <= 0) {
          clearInterval(interval);
        }
      }, 1000);
    } catch (error) {
      console.error('再送信エラー:', error);
      this.errorMessage = '認証コードの再送信に失敗しました。';
    } finally {
      this.loading = false;
    }
  }

  goBack() {
    this.router.navigate(['/login']);
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています';
      case 'auth/weak-password':
        return 'パスワードが弱すぎます';
      case 'auth/invalid-email':
        return '無効なメールアドレスです';
      default:
        return 'アカウント作成中にエラーが発生しました。もう一度お試しください。';
    }
  }
}
