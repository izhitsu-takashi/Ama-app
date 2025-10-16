import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AsyncPipe, NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AsyncPipe, NgIf],
  template: `
    <div class="home-container">
      <div class="loading" *ngIf="isLoading">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>
      <div class="redirect-message" *ngIf="!isLoading">
        <p>メインページにリダイレクトしています...</p>
      </div>
    </div>
  `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .loading {
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading p, .redirect-message p {
      margin: 0;
      font-size: 16px;
      opacity: 0.9;
    }
  `]
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  isLoading = true;

  ngOnInit() {
    // ログイン状態をチェックしてリダイレクト
    this.auth.currentUser$.subscribe(user => {
      if (user) {
        // ログイン済みの場合はメインページにリダイレクト
        this.router.navigate(['/main']);
      } else {
        // 未ログインの場合はログインページにリダイレクト
        this.router.navigate(['/login']);
      }
      this.isLoading = false;
    });
  }
}


