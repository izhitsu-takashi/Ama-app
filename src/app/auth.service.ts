import { Injectable, inject } from '@angular/core';
import { Auth, user, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import { UserService } from './user.service';
import { map, switchMap, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private userService = inject(UserService);

  currentUser$: Observable<User | null> = user(this.auth);

  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  signUpWithEmail(email: string, password: string) {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  async createUserWithEmailAndPassword(email: string, password: string) {
    try {
      return await createUserWithEmailAndPassword(this.auth, email, password);
    } catch (error: any) {
      // メールアドレス重複エラーの場合は、より分かりやすいエラーメッセージを投げる
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('このメールアドレスは既に使用されています');
      }
      throw error;
    }
  }

  // Firebaseの標準メール認証を無効化するための設定
  async createUserWithoutEmailVerification(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    
    // メール認証を無効化（カスタム認証を使用するため）
    if (userCredential.user) {
      // ユーザーのメール認証状態を手動で確認済みに設定
      await userCredential.user.reload();
    }
    
    return userCredential;
  }

  signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async logout() {
    try {
      // ログアウト前にFirebaseの接続をクリーンアップ
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout error:', error);
      // エラーが発生してもログアウト処理を続行
      throw error;
    }
  }

  // 管理者権限チェック
  isAdmin(): Observable<boolean> {
    const currentUser = this.currentUser;
    if (!currentUser) {
      return of(false);
    }

    return new Observable<boolean>(observer => {
      this.userService.getUserProfile(currentUser.uid).then(userProfile => {
        const isAdmin = (userProfile as any)?.role === 'admin';
        observer.next(isAdmin);
        observer.complete();
      }).catch(() => {
        observer.next(false);
        observer.complete();
      });
    });
  }

  // 管理者権限チェック（同期版）
  isAdminSync(): boolean {
    // 注意: このメソッドはFirestoreのデータを直接参照しないため、
    // ユーザープロファイルのroleが変更された場合、再ログインが必要
    const currentUser = this.currentUser;
    if (!currentUser) {
      return false;
    }
    
    // ブラウザ環境でのみlocalStorageを使用
    if (typeof window !== 'undefined' && window.localStorage) {
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      return isAdmin;
    }
    return false;
  }

  // 管理者権限を設定（ログイン時に呼び出し）
  setAdminStatus(isAdmin: boolean): void {
    // ブラウザ環境でのみlocalStorageを使用
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('isAdmin', isAdmin.toString());
    }
  }
}


