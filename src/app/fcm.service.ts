import { Injectable, inject } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported, deleteToken } from 'firebase/messaging';
import { AuthService } from './auth.service';
import { Firestore, doc, setDoc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';

@Injectable({ providedIn: 'root' })
export class FcmService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private messaging: Messaging | null = null;
  private initialized = false;

  async init(vapidKey: string): Promise<void> {
    if (this.initialized) return;
    if (!(await isSupported())) return;

    // Reuse existing Firebase app (AngularFire already initialized)
    try {
      const app = getApps().length ? getApp() : undefined;
      this.messaging = getMessaging(app);
    } catch {
      this.messaging = null;
      return;
    }

    this.initialized = true;
    this.setupForegroundHandler();
    this.setupServiceWorkerMessageHandler();
  }

  async requestPermissionAndRegisterToken(vapidKey: string): Promise<void> {
    if (!this.messaging) return;

    // Request permission explicitly
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if ('Notification' in window && Notification.permission !== 'granted') return;

    try {
      const token = await getToken(this.messaging, { vapidKey });
      if (!token) return;
      const user = this.auth.currentUser;
      if (!user) return;

      const ref = doc(this.firestore, `users/${user.uid}/devices/${token}`);
      await setDoc(ref, {
        token,
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('FCM token registration failed', e);
    }
  }

  async unregisterToken(): Promise<void> {
    if (!this.messaging) return;
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      const token = await getToken(this.messaging, { vapidKey: undefined as any });
      if (!token) return;
      await deleteToken(this.messaging);
      const ref = doc(this.firestore, `users/${user.uid}/devices/${token}`);
      await deleteDoc(ref);
    } catch (e) {
      // best-effort
    }
  }

  private setupForegroundHandler(): void {
    if (!this.messaging) return;
    onMessage(this.messaging, (payload) => {
      try {
        const n = payload.notification;
        if (!n || Notification.permission !== 'granted') return;
        
        // より詳細な通知オプション
        const options: NotificationOptions = {
          body: n.body || '',
          icon: (n as any).icon || '/assets/icons/icon-192.png',
          badge: '/assets/icons/icon-72.png',
          data: payload.data || {},
          tag: `ama-foreground-${Date.now()}`,
          requireInteraction: false,
          silent: false
        };
        
        const notification = new Notification(n.title || 'AMA - 新しい通知', options);
        
        // 通知クリック時の処理
        notification.onclick = (event) => {
          event.preventDefault();
          const url = payload.data?.['url'] || '/';
          window.focus();
          window.location.href = url;
        };
        
      } catch (error) {
        console.error('フォアグラウンド通知エラー:', error);
      }
    });
  }

  private setupServiceWorkerMessageHandler(): void {
    // Service Workerからのメッセージを処理
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'notification-clicked') {
          const { url, action } = event.data;
          console.log('Service Worker通知クリック:', { url, action });
          
          // 必要に応じてページ遷移や状態更新を実行
          if (url && url !== window.location.pathname) {
            window.location.href = url;
          }
        }
      });
    }
  }
}
