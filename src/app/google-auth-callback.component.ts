import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleCalendarBrowserService } from './google-calendar-browser.service';

@Component({
  selector: 'app-google-auth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-callback-container">
      <div class="auth-callback-content">
        <div class="loading-spinner" *ngIf="!error">
          <div class="spinner"></div>
          <h2>認証中...</h2>
          <p>Googleアカウントの認証を処理しています</p>
        </div>
        
        <div class="error-message" *ngIf="error">
          <h2>❌ 認証エラー</h2>
          <p>{{ error }}</p>
          <button class="retry-btn" (click)="retryAuth()">再試行</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-callback-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .auth-callback-content {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 3rem;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 100%;
    }

    .loading-spinner h2 {
      color: #667eea;
      margin: 1rem 0 0.5rem 0;
      font-size: 1.5rem;
    }

    .loading-spinner p {
      color: #666;
      margin: 0;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-message h2 {
      color: #ef4444;
      margin: 0 0 1rem 0;
      font-size: 1.5rem;
    }

    .error-message p {
      color: #666;
      margin: 0 0 2rem 0;
    }

    .retry-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .retry-btn:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }
  `]
})
export class GoogleAuthCallbackComponent implements OnInit {
  error: string | null = null;

  constructor(private googleCalendarService: GoogleCalendarBrowserService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.googleCalendarService.handleAuthCallback();
    } catch (error) {
      this.error = (error as Error).message;
    }
  }

  retryAuth(): void {
    window.location.href = '/google-calendar-settings';
  }
}

