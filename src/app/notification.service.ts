import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, collectionData, orderBy, limit, getDocs, writeBatch, docData } from '@angular/fire/firestore';
import { Observable, from, of, Subject } from 'rxjs';
import { map, catchError, switchMap, shareReplay, take, takeUntil } from 'rxjs/operators';
import { Notification, Reminder } from './models';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private notificationCache = new Map<string, Promise<string>>(); // 重複通知を防ぐキャッシュ
  private destroy$ = new Subject<void>(); // ログアウト時のリスナー停止用

  // 通知作成
  async createNotification(notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<void> {
    await addDoc(collection(this.firestore, 'notifications'), {
      ...notificationData,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  }

  // ユーザーの通知一覧取得
  getUserNotifications(userId: string, limitCount: number = 50): Observable<Notification[]> {
    if (!userId) {
      return of([]);
    }
    
    return collectionData(
      query(
        collection(this.firestore, 'notifications'),
        where('userId', '==', userId)
      ),
      { idField: 'id' }
    ).pipe(
      takeUntil(this.destroy$), // ログアウト時に停止
      map(notifications => {
        // クライアント側でソートとリミット
        return (notifications as Notification[])
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, limitCount);
      }),
      catchError(error => {
        // 権限エラーの場合は空配列を返す（ログを出力しない）
        if (error instanceof Error && error.message.includes('permissions')) {
          return of([]);
        }
        console.error('Error loading notifications:', error);
        return of([]);
      })
    );
  }

  // 未読通知数取得
  getUnreadCount(userId: string): Observable<number> {
    if (!userId) {
      return of(0);
    }
    
    return collectionData(
      query(
        collection(this.firestore, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      )
    ).pipe(
      takeUntil(this.destroy$), // ログアウト時に停止
      map(notifications => notifications.length),
      catchError(error => {
        // 権限エラーの場合は0を返す（ログを出力しない）
        if (error instanceof Error && error.message.includes('permissions')) {
          return of(0);
        }
        console.error('Error loading unread count:', error);
        return of(0);
      })
    );
  }

  // 通知を既読にする
  async markAsRead(notificationId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'notifications', notificationId), {
      isRead: true,
    });
  }

  // すべての通知を既読にする
  async markAllAsRead(userId: string): Promise<void> {
    const notificationsQuery = query(
      collection(this.firestore, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const notifications = await getDocs(notificationsQuery);
    const updatePromises = notifications.docs.map(doc => 
      updateDoc(doc.ref, { isRead: true })
    );

    await Promise.all(updatePromises);
  }

  // 通知削除
  async deleteNotification(notificationId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'notifications', notificationId));
  }

  // 課題関連の通知作成
  async createTaskNotification(
    userId: string,
    type: 'task_assigned' | 'task_due' | 'task_comment' | 'task_reaction' | 'task_due_soon',
    taskId: string,
    groupId: string,
    additionalData?: any
  ): Promise<void> {
    const taskTitle = additionalData?.taskTitle || '課題';
    const title = this.getTaskNotificationTitle(type, taskTitle);
    const content = this.getTaskNotificationContent(type, taskTitle, additionalData);

    await this.createNotification({
      userId,
      type,
      title,
      content,
      message: content,
      data: {
        taskId,
        ...additionalData
      }
    });
  }

  // グループ関連の通知作成
  async createGroupNotification(
    type: 'group_invite',
    groupId: string,
    groupName: string,
    userId: string,
    additionalData?: any
  ): Promise<void> {
    const title = this.getGroupNotificationTitle(type, groupName);
    const content = this.getGroupNotificationContent(type, groupName, additionalData);

    await this.createNotification({
      userId,
      type,
      title,
      content,
      message: content,
      data: {
        groupId,
        groupName,
        ...additionalData
      }
    });
  }

  // 進捗報告関連の通知作成
  async createProgressReportNotification(
    reportId: string,
    reportTitle: string,
    authorName: string,
    userId: string
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'progress_report',
      title: '新しい進捗報告が届きました',
      content: `${authorName}さんから「${reportTitle}」の進捗報告が送信されました。`,
      message: `${authorName}さんから「${reportTitle}」の進捗報告が送信されました。`,
      data: {
        reportId,
        authorName
      }
    });
  }

  // リマインド作成
  async createReminder(reminderData: Omit<Reminder, 'id' | 'createdAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'reminders'), {
      ...reminderData,
      createdAt: serverTimestamp(),
    });
  }

  // ユーザーのリマインド一覧取得
  getUserReminders(userId: string): Observable<Reminder[]> {
    return collectionData(
      query(
        collection(this.firestore, 'reminders'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      ),
      { idField: 'id' }
    ).pipe(
      map(reminders => {
        // クライアント側でソート
        return (reminders as Reminder[]).sort((a, b) => {
          const dateA = a.remindAt?.toDate ? a.remindAt.toDate() : new Date(a.remindAt);
          const dateB = b.remindAt?.toDate ? b.remindAt.toDate() : new Date(b.remindAt);
          return dateA.getTime() - dateB.getTime();
        });
      }),
      catchError(error => {
        // 権限エラーの場合は空配列を返す（ログを出力しない）
        if (error instanceof Error && error.message.includes('permissions')) {
          return of([]);
        }
        console.error('Error loading reminders:', error);
        return of([]);
      })
    );
  }

  // 期限切れのリマインドをチェックして通知を作成
  async checkAndCreateReminderNotifications(): Promise<void> {
    const now = new Date();
    const remindersQuery = query(
      collection(this.firestore, 'reminders'),
      where('isActive', '==', true),
      where('remindAt', '<=', now)
    );

    const reminders = await getDocs(remindersQuery);

    for (const reminderDoc of reminders.docs) {
      const reminder = { id: reminderDoc.id, ...reminderDoc.data() } as Reminder;
      
      // リマインド通知を作成
      await this.createNotification({
        userId: reminder.userId,
        type: 'reminder',
        title: 'リマインド',
        content: reminder.message,
        message: reminder.message,
        data: {
          reminderId: reminder.id
        }
      });

      // リマインドの処理
      await this.processReminder(reminder);
    }
  }

  private async processReminder(reminder: Reminder): Promise<void> {
    if (reminder.frequency === 'once') {
      // 一回限りのリマインドは無効化
      await updateDoc(doc(this.firestore, 'reminders', reminder.id), {
        isActive: false,
      });
    } else {
      // 定期リマインドの次回スケジュールを設定
      const nextDate = this.calculateNextReminderDate(reminder);
      await updateDoc(doc(this.firestore, 'reminders', reminder.id), {
        scheduledDate: nextDate,
      });
    }
  }

  private calculateNextReminderDate(reminder: Reminder): Date {
    const now = new Date();
    const nextDate = new Date(reminder.remindAt);

    switch (reminder.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }

    return nextDate;
  }

  // リマインド削除
  async deleteReminder(reminderId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'reminders', reminderId), {
      isActive: false,
    });
  }

  // 通知タイトル生成
  private getTaskNotificationTitle(type: string, taskTitle: string): string {
    switch (type) {
      case 'task_assigned':
        return '新しい課題が割り当てられました';
      case 'task_due':
        return '課題の期限が近づいています';
      case 'task_due_soon':
        return '課題の期限が近づいています';
      case 'task_comment':
        return '課題にコメントが追加されました';
      case 'task_reaction':
        return '課題にリアクションが追加されました';
      default:
        return '課題に関する通知';
    }
  }

  // 通知内容生成
  private getTaskNotificationContent(type: string, taskTitle: string, additionalData?: any): string {
    switch (type) {
      case 'task_assigned':
        return `「${taskTitle}」があなたに割り当てられました。`;
      case 'task_due':
        return `「${taskTitle}」の期限が近づいています。`;
      case 'task_due_soon':
        return `「${taskTitle}」の期限が明日に迫っています。`;
      case 'task_comment':
        return `「${taskTitle}」に${additionalData?.authorName || '誰か'}がコメントしました。`;
      case 'task_reaction':
        return `「${taskTitle}」に${additionalData?.reactorName || '誰か'}がリアクションしました。`;
      default:
        return `「${taskTitle}」に関する通知です。`;
    }
  }

  // グループ通知タイトル生成
  private getGroupNotificationTitle(type: string, groupName: string): string {
    switch (type) {
      case 'group_invite':
        return `「${groupName}」への招待`;
      default:
        return 'グループに関する通知';
    }
  }

  // グループ通知内容生成
  private getGroupNotificationContent(type: string, groupName: string, additionalData?: any): string {
    switch (type) {
      case 'group_invite':
        return `「${groupName}」への招待が送信されました。`;
      default:
        return `「${groupName}」に関する通知です。`;
    }
  }

  // メール通知送信（実装は後で追加）
  async sendEmailNotification(userId: string, subject: string, content: string): Promise<void> {
    // TODO: メール送信機能を実装
    console.log('Email notification would be sent:', { userId, subject, content });
  }

  // プッシュ通知送信（実装は後で追加）
  async sendPushNotification(userId: string, title: string, body: string): Promise<void> {
    // TODO: プッシュ通知機能を実装
    console.log('Push notification would be sent:', { userId, title, body });
  }


  // 期限切れ課題のリマインド送信
  async checkAndSendTaskReminders(): Promise<void> {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // 明日が期限の課題を取得（シンプルなクエリに変更）
    const tasksQuery = query(
      collection(this.firestore, 'tasks'),
      where('dueDate', '>=', now),
      where('dueDate', '<=', tomorrow)
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    
    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      // クライアント側でステータスをチェック
      if (task['assigneeId'] && task['status'] !== 'completed') {
        try {
          await this.createTaskNotification(
            task['assigneeId'],
            'task_due_soon' as any,
            taskDoc.id,
            task['groupId'],
            { 
              taskTitle: task['title'],
              dueDate: task['dueDate']
            }
          );
        } catch (error) {
          console.error('リマインド送信エラー:', error);
        }
      }
    }
  }

  // 定期的なリマインドチェック（1時間ごとに実行）
  startReminderScheduler(): void {
    setInterval(() => {
      this.checkAndSendTaskReminders();
    }, 60 * 60 * 1000); // 1時間
  }


  // 参加リクエスト通知作成（Promise版）
  async createGroupJoinRequestNotification(groupId: string, requesterId: string, requesterName: string): Promise<string> {
    // 重複チェック用のキーを作成
    const cacheKey = `${groupId}-${requesterId}`;
    
    // 既に同じ通知が処理中または完了している場合は、そのPromiseを返す
    if (this.notificationCache.has(cacheKey)) {
      return this.notificationCache.get(cacheKey)!;
    }
    
    // 新しい通知作成処理を開始
    const notificationPromise = this.createNotificationInternal(groupId, requesterId, requesterName);
    this.notificationCache.set(cacheKey, notificationPromise);
    
    try {
      const result = await notificationPromise;
      // 完了後にキャッシュから削除
      this.notificationCache.delete(cacheKey);
      return result;
    } catch (error) {
      // エラー時もキャッシュから削除
      this.notificationCache.delete(cacheKey);
      throw error;
    }
  }
  
  private async createNotificationInternal(groupId: string, requesterId: string, requesterName: string): Promise<string> {
    try {
      // グループ情報を取得
      const groupInfo = await this.getGroupInfo(groupId).pipe(take(1)).toPromise();
      
      if (!groupInfo?.ownerId) {
        return '';
      }

      const notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'> = {
        userId: groupInfo.ownerId,
        type: 'group_join_request',
        title: 'グループ参加リクエスト',
        content: `${requesterName}さんが「${groupInfo.groupName}」への参加をリクエストしました`,
        message: `${requesterName}さんが「${groupInfo.groupName}」への参加をリクエストしました`,
        data: { 
          groupId, 
          requesterId, 
          requesterName,
          groupName: groupInfo.groupName
        }
      };

      await this.createNotification(notification);
      return 'success'; // 成功を示す文字列を返す
      
    } catch (error) {
      // 権限エラーの場合は静かに失敗
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        if (firebaseError.code === 'permission-denied' || 
            firebaseError.code === 'unauthenticated') {
          return '';
        }
      }
      return '';
    }
  }

  // グループ情報を取得（オーナーIDとグループ名を一度に）
  private getGroupInfo(groupId: string): Observable<{ ownerId: string | null, groupName: string }> {
    return docData(doc(this.firestore, 'groups', groupId)).pipe(
      map((group: any) => ({
        ownerId: group?.ownerId || null,
        groupName: group?.name || 'グループ'
      })),
      catchError(error => {
        // 権限エラーの場合はデフォルト値を返す
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as any;
          if (firebaseError.code === 'permission-denied' || 
              firebaseError.code === 'unauthenticated') {
            return of({ ownerId: null, groupName: 'グループ' });
          }
        }
        return of({ ownerId: null, groupName: 'グループ' });
      }),
      shareReplay(1) // 結果をキャッシュして重複実行を防ぐ
    );
  }

  // ログアウト時にすべてのリスナーを停止
  stopAllListeners(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // 新しいdestroy$を作成（サービスが再利用される場合に備えて）
    this.destroy$ = new Subject<void>();
  }
}