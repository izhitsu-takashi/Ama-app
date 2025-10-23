import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-group-invite',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="invite-container">
      <div class="invite-card">
        <h2 class="title">グループに参加しています...</h2>
        <p class="desc">少々お待ちください。</p>
      </div>
    </div>
  `,
  styles: [`
    .invite-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
      padding: 24px;
      box-sizing: border-box;
    }
    .invite-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 24px 28px;
      width: 100%;
      max-width: 520px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
    }
    .title { margin: 0 0 8px 0; color: #111827; font-size: 20px; }
    .desc { margin: 0; color: #6b7280; font-size: 14px; }
  `]
})
export class GroupInvitePage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);

  async ngOnInit() {
    const groupId = this.route.snapshot.paramMap.get('id');
    if (!groupId) {
      this.router.navigateByUrl('/');
      return;
    }

    try {
      const current = this.auth.currentUser;
      if (current?.uid) {
        await this.groupService.joinGroup(groupId, current.uid);
        await this.router.navigate(['/group', groupId]);
        return;
      }
      // 未ログイン: 保留してログインへ
      localStorage.setItem('pendingInviteGroupId', groupId);
      await this.router.navigate(['/login'], { queryParams: { redirect: 'invite' } });
    } catch {
      await this.router.navigateByUrl('/login');
    }
  }
}



