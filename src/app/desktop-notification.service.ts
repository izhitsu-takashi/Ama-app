import { Injectable, inject } from '@angular/core';
import { Notification as AppNotification } from './models';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { Observable, Subscription, of } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class DesktopNotificationService {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

  private subscription: Subscription | null = null;
  private shownIds = new Set<string>();
  private permissionRequestedKey = 'desktopNotificationPermissionRequested';
  private lastSeenKey = 'desktopNotificationLastSeenAt';

  init(): void {
    // Avoid duplicate init
    if (this.subscription) {
      return;
    }

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return; // Will be called again once user is available in the calling component
    }

    // Restore last seen time to avoid bursting notifications on first run
    const lastSeenAt = Number(localStorage.getItem(this.lastSeenKey) || '0');

    const stream: Observable<AppNotification[]> = this.notificationService
      .getUserNotifications(currentUser.uid, 50)
      .pipe(
        map(list => list.filter(n => {
          const created = n.createdAt && (n.createdAt as any).toDate ? (n.createdAt as any).toDate().getTime() : (n.createdAt ? new Date(n.createdAt as any).getTime() : 0);
          return created > lastSeenAt;
        }))
      );

    this.subscription = stream.subscribe(notifications => {
      // Request permission lazily on first incoming notification if not decided yet
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const alreadyAsked = localStorage.getItem(this.permissionRequestedKey) === '1';
          if (!alreadyAsked) {
            Notification.requestPermission().finally(() => {
              localStorage.setItem(this.permissionRequestedKey, '1');
            });
          }
        }
      }

      notifications.forEach(n => {
        if (!n.id || this.shownIds.has(n.id)) return;
        this.showDesktopNotification(n);
        this.shownIds.add(n.id);
        // Update last seen time progressively
        const created = n.createdAt && (n.createdAt as any).toDate ? (n.createdAt as any).toDate().getTime() : (n.createdAt ? new Date(n.createdAt as any).getTime() : Date.now());
        if (created) {
          const prev = Number(localStorage.getItem(this.lastSeenKey) || '0');
          if (created > prev) localStorage.setItem(this.lastSeenKey, String(created));
        }
      });
    });
  }

  dispose(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
  }

  private showDesktopNotification(n: AppNotification): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission !== 'granted') return;

    const title = n.title || '新しい通知';
    const body = n.content || n.message || '';

    const options: NotificationOptions = {
      body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-72.png',
      data: {
        url: this.resolveClickUrl(n)
      }
    };

    try {
      const notif = new Notification(title, options);
      notif.onclick = (event: any) => {
        event?.preventDefault?.();
        const url = options.data && (options.data as any).url;
        if (url && typeof window !== 'undefined') {
          window.focus();
          window.open(url, '_self');
        }
      };
    } catch {
      // Swallow errors; desktop notifications are best-effort
    }
  }

  private resolveClickUrl(n: AppNotification): string {
    // Route users to an appropriate page based on notification type
    switch (n.type) {
      case 'message_received':
        return '/messages';
      case 'announcement':
        return n.data && (n.data as any).groupId ? `/group/${(n.data as any).groupId}` : '/';
      case 'progress_report':
      case 'progress_report_comment':
        return '/progress-reports';
      case 'group_join_request':
      case 'group_invite':
        return n.data && (n.data as any).groupId ? `/group/${(n.data as any).groupId}` : '/groups';
      case 'task_due':
      case 'task_due_soon':
      case 'task_assigned':
      case 'task_comment':
      case 'task_reaction':
        return '/tasks';
      default:
        return '/';
    }
  }
}
