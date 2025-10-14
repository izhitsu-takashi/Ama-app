import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { LoginComponent } from './login.component';
import { SignupComponent } from './signup.component';
import { authGuard } from './auth.guard';
import { ResetPasswordComponent } from './reset-password.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: '**', redirectTo: '' },
];
