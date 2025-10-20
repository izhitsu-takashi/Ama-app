import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(): boolean {
    const currentUser = this.authService.currentUser;
    
    if (!currentUser) {
      this.router.navigate(['/login']);
      return false;
    }

    // 管理者権限をチェック
    const isAdmin = this.authService.isAdminSync();
    
    if (!isAdmin) {
      // 管理者でない場合はメインページにリダイレクト
      this.router.navigate(['/main']);
      return false;
    }

    return true;
  }
}

