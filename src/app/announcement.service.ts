import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, doc, getDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of, firstValueFrom } from 'rxjs';
import { Announcement } from './models';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AnnouncementService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private notificationService = inject(NotificationService);
  private userService = inject(UserService);

  // アナウンスを作成
  async createAnnouncement(
    groupId: string, 
    title: string, 
    content: string, 
    isImportant: boolean = false
  ): Promise<string> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    // グループ情報を取得
    const group = await this.groupService.getGroup(groupId);
    if (!group) {
      throw new Error('グループが見つかりません');
    }

    // ユーザー情報を取得
    const user = await this.userService.getUserProfile(currentUser.uid);
    const authorName = user?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'ユーザー';

    // アナウンスデータを作成
    const announcementData = {
      groupId: groupId,
      groupName: group.name,
      authorId: currentUser.uid,
      authorName: authorName,
      authorEmail: currentUser.email || '',
      title: title,
      content: content,
      isImportant: isImportant,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // アナウンスを保存
    const announcementRef = await addDoc(collection(this.firestore, 'announcements'), announcementData);
    
    // グループメンバーに通知を送信
    await this.sendAnnouncementNotifications(groupId, title, currentUser.uid);

    return announcementRef.id;
  }

  // グループのアナウンス一覧を取得
  getGroupAnnouncements(groupId: string): Observable<Announcement[]> {
    const announcementsQuery = query(
      collection(this.firestore, 'announcements'),
      where('groupId', '==', groupId),
      limit(50)
    );
    
    return from(getDocs(announcementsQuery)).pipe(
      map(snapshot => {
        const announcements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Announcement));
        
        // クライアント側でソート
        return announcements.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });
      })
    );
  }

  // ユーザーが参加しているグループのアナウンス一覧を取得
  getUserAnnouncements(): Observable<Announcement[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }

    // ユーザーが参加しているグループを取得
    return this.groupService.getUserGroups(currentUser.uid).pipe(
      switchMap(groups => {
        if (groups.length === 0) return of([]);
        
        const groupIds = groups.map(group => group.id);
        const announcementsQuery = query(
          collection(this.firestore, 'announcements'),
          where('groupId', 'in', groupIds),
          orderBy('createdAt', 'desc'),
          limit(100)
        );

        return from(getDocs(announcementsQuery)).pipe(
          map(snapshot => {
            return snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Announcement));
          })
        );
      })
    );
  }

  // アナウンスを更新
  async updateAnnouncement(
    announcementId: string, 
    title: string, 
    content: string, 
    isImportant: boolean = false
  ): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    // アナウンスの作成者かチェック
    const announcementRef = doc(this.firestore, 'announcements', announcementId);
    const announcementDoc = await getDoc(announcementRef);
    
    if (!announcementDoc.exists()) {
      throw new Error('アナウンスが見つかりません');
    }

    const announcementData = announcementDoc.data();
    if (announcementData['authorId'] !== currentUser.uid) {
      throw new Error('このアナウンスを編集する権限がありません');
    }

    // アナウンスを更新
    await updateDoc(announcementRef, {
      title: title,
      content: content,
      isImportant: isImportant,
      updatedAt: serverTimestamp()
    });
  }

  // アナウンスを削除
  async deleteAnnouncement(announcementId: string): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    // アナウンスの作成者かチェック
    const announcementRef = doc(this.firestore, 'announcements', announcementId);
    const announcementDoc = await getDoc(announcementRef);
    
    if (!announcementDoc.exists()) {
      throw new Error('アナウンスが見つかりません');
    }

    const announcementData = announcementDoc.data();
    if (announcementData['authorId'] !== currentUser.uid) {
      throw new Error('このアナウンスを削除する権限がありません');
    }

    // アナウンスを削除
    await deleteDoc(announcementRef);
  }

  // アナウンス投稿時の通知を送信
  private async sendAnnouncementNotifications(
    groupId: string, 
    title: string, 
    authorId: string
  ): Promise<void> {
    try {
      // グループメンバーを取得
      const groupMembers = await firstValueFrom(
        this.groupService.getGroupMembers(groupId).pipe(
          map(memberships => memberships.map(membership => membership.userId))
        )
      );

      if (!groupMembers || groupMembers.length === 0) {
        return;
      }

      // 作成者以外のメンバーに通知を送信
      const recipientIds = groupMembers.filter(userId => userId !== authorId);
      
      for (const recipientId of recipientIds) {
        await this.notificationService.createNotification({
          userId: recipientId,
          type: 'announcement',
          title: `新しいアナウンス: ${title}`,
          content: `グループに新しいアナウンスが投稿されました`,
          message: `グループに新しいアナウンスが投稿されました`
        });
      }
    } catch (error) {
      console.error('アナウンス通知送信エラー:', error);
    }
  }
}
