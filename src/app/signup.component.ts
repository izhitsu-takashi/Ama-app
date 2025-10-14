import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { sendEmailVerification } from '@angular/fire/auth';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>新規登録</h2>
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label>メールアドレス</label>
        <input type="email" formControlName="email" />
      </div>
      <div>
        <label>パスワード</label>
        <input type="password" formControlName="password" />
      </div>
      <button type="submit" [disabled]="form.invalid || loading">登録</button>
      <div *ngIf="error" style="color:red;">{{ error }}</div>
    </form>
    <p>
      すでにアカウントがありますか？ <a routerLink="/login">ログイン</a>
    </p>
  `,
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private users = inject(UserService);

  loading = false;
  error = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();
    try {
      const cred = await this.auth.signUpWithEmail(email!, password!);
      await this.users.ensureUserProfile(cred.user.uid, cred.user.email, cred.user.displayName);
      try {
        await sendEmailVerification(cred.user);
        alert('確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。');
      } catch {}
      await this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error = e?.message ?? '登録に失敗しました';
    } finally {
      this.loading = false;
    }
  }
}


