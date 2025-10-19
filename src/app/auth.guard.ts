import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): boolean {
    const currentUser = this.authService.currentUser;
    
    if (currentUser) {
      return true;
    } else {
      // ログインしていない場合はログインページにリダイレクト
      this.router.navigate(['/login']);
      return false;
    }
  }
}

// エクスポート用のエイリアス
export const authGuard = AuthGuard;
