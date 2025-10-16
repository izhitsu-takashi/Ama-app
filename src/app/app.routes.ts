import { Routes } from '@angular/router';
import { HomeComponent } from './home.component';
import { LoginComponent } from './login.component';
import { SignupComponent } from './signup.component';
import { authGuard } from './auth.guard';
import { ResetPasswordComponent } from './reset-password.component';
import { MainPage } from './main.page';
import { GroupCreatePage } from './group-create.page';
import { GroupDetailPage } from './group-detail.page';
import { GroupsPage } from './groups.page';
import { NotificationsPage } from './notifications.page';
import { MilestonePage } from './milestone.page';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'main', component: MainPage, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsPage, canActivate: [authGuard] },
  { path: 'groups', component: GroupsPage, canActivate: [authGuard] },
  { path: 'group/create', component: GroupCreatePage, canActivate: [authGuard] },
  { path: 'group/:id', component: GroupDetailPage, canActivate: [authGuard] },
  { path: 'milestones', component: MilestonePage, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: '**', redirectTo: '' },
];
