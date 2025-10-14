import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AsyncPipe, NgIf } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, AsyncPipe, NgIf],
  template: `
    <h2>Home</h2>
    <div *ngIf="auth.currentUser$ | async as u; else guest">
      <p>ようこそ、{{ u.email }} さん</p>
      <button (click)="logout()">ログアウト</button>
    </div>
    <ng-template #guest>
      <p><a routerLink="/login">ログイン</a> または <a routerLink="/signup">新規登録</a></p>
    </ng-template>
  `,
})
export class HomeComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}


