import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>ログイン</h2>
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label>メールアドレス</label>
        <input type="email" formControlName="email" />
      </div>
      <div>
        <label>パスワード</label>
        <input type="password" formControlName="password" />
      </div>
      <button type="submit" [disabled]="form.invalid || loading">ログイン</button>
      <div *ngIf="error" style="color:red;">{{ error }}</div>
    </form>
    <p>
      初めての方は <a routerLink="/signup">新規登録</a>
      / パスワードをお忘れの方は <a routerLink="/reset-password">こちら</a>
    </p>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);

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
      await this.auth.signInWithEmail(email!, password!);
      await this.router.navigateByUrl('/');
    } catch (e: any) {
      this.error = e?.message ?? 'ログインに失敗しました';
    } finally {
      this.loading = false;
    }
  }
}


