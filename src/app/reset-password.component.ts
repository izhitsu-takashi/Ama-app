import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { sendPasswordResetEmail } from '@angular/fire/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <h2>パスワードリセット</h2>
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label>メールアドレス</label>
        <input type="email" formControlName="email" />
      </div>
      <button type="submit" [disabled]="form.invalid || loading">送信</button>
      <div *ngIf="message" style="color:green;">{{ message }}</div>
      <div *ngIf="error" style="color:red;">{{ error }}</div>
    </form>
    <p><a routerLink="/login">ログインに戻る</a></p>
  `,
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(Auth);

  loading = false;
  error = '';
  message = '';

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.message = '';
    const { email } = this.form.getRawValue();
    try {
      await sendPasswordResetEmail(this.auth, email!);
      this.message = 'パスワード再設定メールを送信しました';
    } catch (e: any) {
      this.error = e?.message ?? '送信に失敗しました';
    } finally {
      this.loading = false;
    }
  }
}


