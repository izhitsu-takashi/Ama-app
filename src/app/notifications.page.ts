import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { JoinRequestService } from './join-request.service';
import { GroupService } from './group.service';
import { MessageNotificationService } from './message-notification.service';
import { Notification, JoinRequest } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">通知</h1>
        <div class="header-actions">
          <button class="btn btn-secondary" (click)="markAllAsRead()" *ngIf="hasUnreadNotifications">
            すべて既読
          </button>
        </div>
      </div>

      <!-- 通知一覧 -->
      <div class="notifications-section">
        <div class="notifications-header">
          <h2 class="section-title">通知一覧</h2>
          <div class="notification-stats">
            <span class="stat-item">
              <span class="stat-label">未読:</span>
              <span class="stat-value unread">{{ unreadCount }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">総数:</span>
              <span class="stat-value">{{ totalCount }}</span>
            </span>
          </div>
        </div>

        <div class="notifications-list" *ngIf="(notifications$ | async) as notifications; else emptyNotifications">
          <div class="notification-item" 
               *ngFor="let notification of notifications" 
               [class.unread]="!notification.isRead"
               (click)="handleNotificationClick(notification)">
            
            <div class="notification-icon">
              <span [class]="getNotificationIcon(notification.type)">
                {{ getNotificationEmoji(notification.type) }}
              </span>
            </div>

            <div class="notification-content">
              <div class="notification-header">
                <h3 class="notification-title">{{ notification.title }}</h3>
                <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
              </div>
              
              <p class="notification-message">{{ getNotificationDisplayMessage(notification) }}</p>
              
              <div class="notification-meta" *ngIf="notification.metadata">
                <span class="meta-item" *ngIf="notification.metadata.groupName">
                  📁 {{ notification.metadata.groupName }}
                </span>
                <span class="meta-item" *ngIf="notification.metadata.taskTitle">
                  📋 {{ notification.metadata.taskTitle }}
                </span>
                <span class="meta-item" *ngIf="notification.metadata.userName">
                  👤 {{ notification.metadata.userName }}
                </span>
              </div>

              <div class="notification-actions">
                <button class="btn btn-small" *ngIf="!notification.isRead" (click)="markAsRead(notification.id); $event.stopPropagation()">既読にする</button>
                <button class="btn btn-small btn-danger" (click)="deleteNotification(notification.id); $event.stopPropagation()">削除</button>
              </div>
            </div>

            <div class="notification-status">
              <span class="unread-indicator" *ngIf="!notification.isRead"></span>
            </div>
          </div>
        </div>

        <ng-template #emptyNotifications>
          <div class="empty-state">
            <div class="empty-icon">🔔</div>
            <h3 class="empty-title">通知がありません</h3>
            <p class="empty-description">新しい通知が届くとここに表示されます</p>
          </div>
        </ng-template>
      </div>

      

    </div>

  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8f9fa;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      color: #4a5568;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .back-btn:hover {
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-1px);
    }

    .back-icon {
      font-size: 18px;
    }

    .page-title {
      margin: 0;
      color: #2d3748;
      font-size: 28px;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .btn-secondary:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .btn-small {
      padding: 8px 12px;
      font-size: 12px;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .btn-icon {
      font-size: 16px;
    }

    .join-request-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 12px;
      background: #f8f9fa;
    }

    .request-info {
      flex: 1;
    }

    .request-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .request-user {
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin: 0;
    }

    .request-date {
      font-size: 12px;
      color: #6b7280;
    }

    .request-group {
      font-size: 14px;
      color: #4a5568;
      margin: 4px 0;
    }

    .request-email {
      font-size: 12px;
      color: #6b7280;
      margin: 0;
    }

    .request-actions {
      display: flex;
      gap: 8px;
    }

    .notifications-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .section-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .notification-stats {
      display: flex;
      gap: 20px;
    }

    .stat-item {
      display: flex;
      gap: 4px;
      font-size: 14px;
    }

    .stat-label {
      color: #6b7280;
    }

    .stat-value {
      color: #2d3748;
      font-weight: 600;
    }

    .stat-value.unread {
      color: #ef4444;
    }

    .notifications-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .notification-item:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .notification-item.unread {
      border-color: #667eea;
      background: #f8faff;
    }

    .notification-icon {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }

    .notification-icon {
      background: #e2e8f0;
    }

    .notification-icon.task {
      background: #dbeafe;
    }

    .notification-icon.group {
      background: #dcfce7;
    }

    .notification-icon.system {
      background: #fef3c7;
    }


    .notification-content {
      flex: 1;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
    }

    .notification-title {
      margin: 0;
      color: #2d3748;
      font-size: 16px;
      font-weight: 600;
    }

    .notification-time {
      font-size: 12px;
      color: #6b7280;
    }

    .notification-message {
      margin: 0 0 12px 0;
      color: #4a5568;
      line-height: 1.5;
    }

    .notification-meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .meta-item {
      font-size: 12px;
      color: #6b7280;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 6px;
    }

    .notification-actions {
      display: flex;
      gap: 8px;
    }

    .notification-status {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }

    .unread-indicator {
      width: 8px;
      height: 8px;
      background: #ef4444;
      border-radius: 50%;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-title {
      margin: 0 0 8px 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .empty-description {
      margin: 0 0 24px 0;
      color: #6b7280;
    }

    /* モーダル */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 24px 0;
    }

    .modal-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
    }

    .modal-form {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }

    .form-input, .form-textarea, .form-select {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-textarea {
      resize: vertical;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .page-container {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .modal-actions {
        flex-direction: column;
      }
    }
  `]
})
export class NotificationsPage implements OnInit, OnDestroy {
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private auth = inject(AuthService);
  private joinRequestService = inject(JoinRequestService);
  private groupService = inject(GroupService);

  private destroy$ = new Subject<void>();

  notifications$: Observable<Notification[]> = of([]);
  joinRequests$: Observable<JoinRequest[]> = of([]);
  unreadCount = 0;
  totalCount = 0;
  hasUnreadNotifications = false;

  ngOnInit() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          this.notifications$ = this.notificationService.getUserNotifications(user.uid);
          this.joinRequests$ = this.joinRequestService.getUserOwnedGroupJoinRequests(user.uid);
          
          // 未読通知数を取得
          this.notificationService.getUnreadCount(user.uid).subscribe(count => {
            this.unreadCount = count;
            this.hasUnreadNotifications = count > 0;
          });

          // 総通知数を取得
          this.notifications$.subscribe(notifications => {
            this.totalCount = notifications.length;
          });

          return this.notifications$;
        }
        return of([]);
      })
    ).subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async deleteNotification(id: string) {
    try {
      await this.notificationService.deleteNotification(id);
      this.reloadNotifications();
    } catch (e) {
      console.error('通知削除エラー:', e);
    }
  }

  private reloadNotifications() {
    // 再購読せずとも、通知一覧はcollectionDataでライブ更新される場合は不要。
    // 明示的にリロードが必要な場合のみ実装を強化。
  }

  getNotificationIcon(type: string): string {
    const icons = {
      task: 'task',
      group: 'group',
      system: 'system'
    };
    return icons[type as keyof typeof icons] || 'system';
  }

  getNotificationEmoji(type: string): string {
    const emojis = {
      task: '📋',
      group: '👥',
      system: '🔔',
      message_received: '💬'
    };
    return emojis[type as keyof typeof emojis] || '🔔';
  }

  getNotificationDisplayMessage(notification: Notification): string {
    // メッセージ通知の場合は特別な処理
    if (notification.type === 'message_received') {
      const senderName = notification.metadata?.senderName || notification.data?.senderName || 'Unknown User';
      const messageContent = notification.metadata?.messageContent || notification.data?.messageContent;
      const subject = notification.metadata?.subject || notification.data?.subject;
      
      // メッセージ内容がある場合はそれを使用、なければ件名を使用
      const content = messageContent || subject || 'メッセージ';
      return `${senderName}：${content}`;
    }
    
    // その他の通知は既存のmessageフィールドを使用
    return notification.message || notification.content || '';
  }


  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'たった今';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}日前`;
    
    return date.toLocaleDateString('ja-JP');
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP');
  }

  async markAsRead(notificationId: string) {
    try {
      await this.notificationService.markAsRead(notificationId);
      // 既読にした後、未読数を更新
      this.loadUnreadCount();
    } catch (error) {
      console.error('既読マークエラー:', error);
    }
  }

  async handleNotificationClick(notification: Notification) {
    // メッセージ通知の場合はメッセージやり取り画面に遷移
    if (notification.type === 'message_received' && notification.metadata?.relatedUserId) {
      this.router.navigate(['/chat', notification.metadata.relatedUserId]);
    }
    
    // 既読にする
    if (!notification.isRead) {
      await this.markAsRead(notification.id);
    }
  }

  private loadUnreadCount() {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      this.notificationService.getUnreadCount(currentUser.uid).subscribe(count => {
        this.unreadCount = count;
        this.hasUnreadNotifications = count > 0;
      });
    }
  }

  async markAllAsRead() {
    try {
      const currentUser = this.auth.currentUser;
      if (currentUser) {
        await this.notificationService.markAllAsRead(currentUser.uid);
        // すべて既読にした後、未読数を更新
        this.loadUnreadCount();
      }
    } catch (error) {
      console.error('すべて既読エラー:', error);
    }
  }


  // 参加リクエストを承認
  async approveJoinRequest(requestId: string) {
    if (confirm('この参加リクエストを承認しますか？')) {
      try {
        await this.joinRequestService.approveJoinRequest(requestId);
        alert('参加リクエストを承認しました！');
      } catch (error) {
        console.error('参加リクエスト承認エラー:', error);
        alert('参加リクエストの承認に失敗しました。');
      }
    }
  }

  // 参加リクエストを拒否
  async rejectJoinRequest(requestId: string) {
    if (confirm('この参加リクエストを拒否しますか？')) {
      try {
        await this.joinRequestService.rejectJoinRequest(requestId);
        alert('参加リクエストを拒否しました。');
      } catch (error) {
        console.error('参加リクエスト拒否エラー:', error);
        alert('参加リクエストの拒否に失敗しました。');
      }
    }
  }

  // グループ名を取得
  getGroupName(groupId: string): string {
    // 簡単な実装：グループIDをそのまま返す
    // 実際の実装では、グループサービスからグループ名を取得する
    return `グループ ${groupId.substring(0, 8)}...`;
  }
}
