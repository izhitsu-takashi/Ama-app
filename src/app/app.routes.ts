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
import { ProgressReportCreatePage } from './progress-report-create.page';
import { ProgressReportsPage } from './progress-reports.page';
import { ProgressReportDetailPage } from './progress-report-detail.page';
import { AutoReportSchedulePage } from './auto-report-schedule.page';
import { GoogleCalendarSettingsPage } from './google-calendar-settings.page';
import { GoogleAuthCallbackComponent } from './google-auth-callback.component';
import { UserSearchPage } from './user-search.page';
import { MessagesPage } from './messages.page';
import { MessageComposePage } from './message-compose.page';
import { MessageViewPage } from './message-view.page';
import { ChatRoomPage } from './chat-room.page';
import { TasksPage } from './tasks.page';
import { AdminDashboardPage } from './admin-dashboard.page';
import { AdminUsersPage } from './admin-users.page';
import { AdminGroupsPage } from './admin-groups.page';
import { AdminGuard } from './admin.guard';
import { DocumentsPage } from './documents.page';
import { MorningReportPage } from './morning-report.page';
import { GroupReportPage } from './group-report.page';
import { DepartmentTasksPage } from './department-tasks.page';
import { GroupInvitePage } from './group-invite.page';

export const routes: Routes = [
  { path: '', component: HomeComponent, canActivate: [authGuard] },
  { path: 'main', component: MainPage, canActivate: [authGuard] },
  { path: 'notifications', component: NotificationsPage, canActivate: [authGuard] },
  { path: 'groups', component: GroupsPage, canActivate: [authGuard] },
  { path: 'group/create', component: GroupCreatePage, canActivate: [authGuard] },
  { path: 'group/:id', component: GroupDetailPage, canActivate: [authGuard] },
  { path: 'group/:id/join', component: GroupInvitePage },
  { path: 'progress-report-create', component: ProgressReportCreatePage, canActivate: [authGuard] },
  { path: 'progress-reports', component: ProgressReportsPage, canActivate: [authGuard] },
  { path: 'progress-report-detail/:id', component: ProgressReportDetailPage, canActivate: [authGuard] },
  { path: 'auto-report-schedule', component: AutoReportSchedulePage, canActivate: [authGuard] },
  { path: 'google-calendar-settings', component: GoogleCalendarSettingsPage, canActivate: [authGuard] },
  { path: 'auth/google/callback', component: GoogleAuthCallbackComponent },
  { path: 'user-search', component: UserSearchPage, canActivate: [authGuard] },
  { path: 'messages', component: MessagesPage, canActivate: [authGuard] },
  { path: 'messages/compose', component: MessageComposePage, canActivate: [authGuard] },
  { path: 'messages/view/:id', component: MessageViewPage, canActivate: [authGuard] },
  { path: 'chat/:userId', component: ChatRoomPage, canActivate: [authGuard] },
  { path: 'tasks', component: TasksPage, canActivate: [authGuard] },
  { path: 'admin', component: AdminDashboardPage, canActivate: [AdminGuard] },
  { path: 'admin/users', component: AdminUsersPage, canActivate: [AdminGuard] },
  { path: 'admin/groups', component: AdminGroupsPage, canActivate: [AdminGuard] },
  { path: 'documents', component: DocumentsPage, canActivate: [authGuard] },
  { path: 'documents/morning-report', component: MorningReportPage, canActivate: [authGuard] },
  { path: 'documents/group-report', component: GroupReportPage, canActivate: [authGuard] },
  { path: 'department-tasks', component: DepartmentTasksPage, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: '**', redirectTo: '' },
];
