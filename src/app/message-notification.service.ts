import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from '@angular/fire/firestore';
import { Observable, from, map, of } from 'rxjs';
import { Notification } from './models';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class MessageNotificationService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  // メッセージ受信通知を作成
  async createMessageNotification(
    recipientId: string,
    senderName: string,
    subject: string,
    messageId: string,
    messageContent?: string
  ): Promise<string> {
    const notificationData = {
      userId: recipientId,
      type: 'message_received',
      title: '新しいメッセージ',
      content: `${senderName} からメッセージが届きました`,
      message: `${senderName}：${messageContent || subject}`,
      data: {
        messageId: messageId,
        senderName: senderName,
        subject: subject,
        messageContent: messageContent
      },
      metadata: {
        messageId: messageId,
        senderName: senderName,
        subject: subject,
        messageContent: messageContent
      },
      isRead: false,
      createdAt: serverTimestamp()
    };

    const notificationRef = await addDoc(collection(this.firestore, 'notifications'), notificationData);
    return notificationRef.id;
  }

  // メッセージ関連の通知を取得
  getMessageNotifications(): Observable<Notification[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return from([]);
    }

    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('type', '==', 'message_received')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Notification));
      })
    );
  }

  // 通知を既読にする
  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(this.firestore, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      isRead: true,
      readAt: serverTimestamp()
    });
  }

  // メッセージ関連の未読通知数を取得
  getUnreadMessageNotificationCount(): Observable<number> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of(0);
    }

    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('type', '==', 'message_received'),
      where('isRead', '==', false)
    );

    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.size)
    );
  }

  // メッセージを開いた時に通知を既読にする
  async markMessageNotificationsAsRead(messageId: string): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return;
    }

    const q = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('type', '==', 'message_received'),
      where('data.messageId', '==', messageId),
      where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, {
        isRead: true,
        readAt: serverTimestamp()
      })
    );

    await Promise.all(updatePromises);
  }
}
