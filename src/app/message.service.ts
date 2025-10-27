import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, getDoc, writeBatch, setDoc } from '@angular/fire/firestore';
import { Observable, from, map, switchMap, combineLatest, of } from 'rxjs';
import { Message, MessageThread, User } from './models';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { MessageNotificationService } from './message-notification.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private userService: UserService,
    private messageNotificationService: MessageNotificationService
  ) {}

  // メッセージを削除
  async deleteMessage(messageId: string): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    // メッセージの存在確認と送信者チェック
    const messageRef = doc(this.firestore, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      throw new Error('メッセージが見つかりません');
    }

    const messageData = messageDoc.data();
    if (messageData['senderId'] !== currentUser.uid) {
      throw new Error('このメッセージを削除する権限がありません');
    }

    // メッセージを削除
    await deleteDoc(messageRef);
  }

  // メッセージを送信
  async sendMessage(recipientId: string, subject: string, content: string): Promise<string> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ユーザーが認証されていません');
    }

    // 送信者と受信者の情報を取得
    const [sender, recipient] = await Promise.all([
      this.userService.getUserProfile(currentUser.uid),
      this.userService.getUserProfile(recipientId)
    ]);

    if (!sender || !recipient) {
      throw new Error('ユーザー情報の取得に失敗しました');
    }

    const messageData = {
      senderId: currentUser.uid,
      senderName: sender.displayName || sender.email,
      senderEmail: sender.email,
      recipientId: recipientId,
      recipientName: recipient.displayName || recipient.email,
      recipientEmail: recipient.email,
      subject: subject,
      content: content,
      isRead: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // メッセージを保存
    const messageRef = await addDoc(collection(this.firestore, 'messages'), messageData);
    
    // メッセージスレッドを更新または作成
    await this.updateMessageThread(currentUser.uid, recipientId, {
      content: content,
      senderId: currentUser.uid,
      senderName: sender.displayName || sender.email,
      createdAt: serverTimestamp()
    });

    // 受信者に通知を作成
    try {
      await this.messageNotificationService.createMessageNotification(
        recipientId,
        sender.displayName || sender.email || 'Unknown User',
        subject,
        messageRef.id,
        content
      );
    } catch (error) {
      console.error('通知作成エラー:', error);
      // 通知作成に失敗してもメッセージ送信は成功とする
    }

    return messageRef.id;
  }

  // 受信メッセージ一覧を取得
  getReceivedMessages(): Observable<Message[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }
    
    // インデックスを避けるため、シンプルなクエリに変更
    const q = query(
      collection(this.firestore, 'messages'),
      where('recipientId', '==', currentUser.uid)
    );
    
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        // クライアント側でソート
        return messages.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });
      })
    );
  }

  // 送信メッセージ一覧を取得
  getSentMessages(): Observable<Message[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }
    
    // インデックスを避けるため、シンプルなクエリに変更
    const q = query(
      collection(this.firestore, 'messages'),
      where('senderId', '==', currentUser.uid)
    );
    
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        // クライアント側でソート
        return messages.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });
      })
    );
  }

  // メッセージスレッド一覧を取得
  getMessageThreads(): Observable<MessageThread[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }
    
    // インデックスを避けるため、シンプルなクエリに変更
    const q = query(
      collection(this.firestore, 'messageThreads'),
      where('participants', 'array-contains', currentUser.uid)
    );
    
    return from(getDocs(q)).pipe(
      switchMap(snapshot => {
        const threads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as MessageThread));
        
        // 各スレッドのparticipantNamesを構築
        const threadPromises = threads.map(async (thread) => {
          const participantNames: string[] = [];
          
          for (const participantId of thread.participants) {
            try {
              const user = await this.userService.getUserProfile(participantId);
              participantNames.push(user?.displayName || 'Unknown User');
            } catch (error) {
              console.error('ユーザー情報取得エラー:', error);
              participantNames.push('Unknown User');
            }
          }
          
          return {
            ...thread,
            participantNames
          };
        });
        
        return from(Promise.all(threadPromises));
      }),
      map(threads => {
        // クライアント側でソート
        return threads.sort((a, b) => {
          const aTime = a.updatedAt?.toDate?.() || new Date(0);
          const bTime = b.updatedAt?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });
      })
    );
  }

  // 特定のユーザーとのメッセージ履歴を取得
  getMessagesWithUser(otherUserId: string): Observable<Message[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }
    
    // インデックスを避けるため、2つのクエリを実行してマージ
    const sentQuery = query(
      collection(this.firestore, 'messages'),
      where('senderId', '==', currentUser.uid),
      where('recipientId', '==', otherUserId)
    );
    
    const receivedQuery = query(
      collection(this.firestore, 'messages'),
      where('senderId', '==', otherUserId),
      where('recipientId', '==', currentUser.uid)
    );
    
    return combineLatest([
      from(getDocs(sentQuery)),
      from(getDocs(receivedQuery))
    ]).pipe(
      map(([sentSnapshot, receivedSnapshot]) => {
        const sentMessages = sentSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        const receivedMessages = receivedSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
        
        // すべてのメッセージをマージしてソート
        const allMessages = [...sentMessages, ...receivedMessages];
        return allMessages.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.() || new Date(0);
          const bTime = b.createdAt?.toDate?.() || new Date(0);
          return aTime.getTime() - bTime.getTime(); // 古い順にソート
        });
      })
    );
  }

  // メッセージを既読にする
  async markAsRead(messageId: string): Promise<void> {
    const messageRef = doc(this.firestore, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      throw new Error('メッセージが見つかりません');
    }
    
    const messageData = messageDoc.data();
    const senderId = messageData['senderId'];
    const receiverId = messageData['receiverId'];
    
    // メッセージを既読にする
    await updateDoc(messageRef, {
      isRead: true,
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // スレッドの未読数をリセット（現在のユーザーの未読数を0にする）
    if (senderId && receiverId) {
      const participants = [senderId, receiverId].sort();
      const threadId = participants.join('_');
      const threadRef = doc(this.firestore, 'messageThreads', threadId);
      
      try {
        // 現在のスレッドデータを取得
        const threadDoc = await getDoc(threadRef);
        if (threadDoc.exists()) {
          const currentData = threadDoc.data();
          const currentUnreadCounts = currentData['unreadCounts'] || {};
          
          // 現在のユーザー（チャットルームを開いている人）の未読数を0にする
          const currentUser = this.authService.currentUser;
          if (currentUser) {
            const newUnreadCounts = { ...currentUnreadCounts };
            newUnreadCounts[currentUser.uid] = 0;
            
            // 後方互換性のため、全体の未読数も計算
            const totalUnreadCount = Object.values(newUnreadCounts).reduce((sum: number, count: any) => sum + (count as number), 0);
            
            await updateDoc(threadRef, {
              unreadCounts: newUnreadCounts,
              unreadCount: totalUnreadCount, // 後方互換性
              updatedAt: serverTimestamp()
            });
            
            console.log(`スレッド ${threadId} の未読数をリセットしました:`, newUnreadCounts, `(現在のユーザー: ${currentUser.uid})`);
          }
        }
      } catch (error) {
        console.error('未読数リセットエラー:', error);
      }
    }

    // 関連する通知も既読にする
    try {
      await this.messageNotificationService.markMessageNotificationsAsRead(messageId);
    } catch (error) {
      console.error('通知既読エラー:', error);
    }
  }


  // スレッドの未読数をリセット（チャットルームを開いた時など）
  async resetThreadUnreadCount(threadId: string): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      console.error('ユーザーがログインしていません');
      return;
    }

    const threadRef = doc(this.firestore, 'messageThreads', threadId);
    
    try {
      // 現在のスレッドデータを取得
      const threadDoc = await getDoc(threadRef);
      if (threadDoc.exists()) {
        const currentData = threadDoc.data();
        const currentUnreadCounts = currentData['unreadCounts'] || {};
        
        // 現在のユーザーの未読数を0にする
        const newUnreadCounts = { ...currentUnreadCounts };
        newUnreadCounts[currentUser.uid] = 0;
        
        // 後方互換性のため、全体の未読数も計算
        const totalUnreadCount = Object.values(newUnreadCounts).reduce((sum: number, count: any) => sum + (count as number), 0);
        
        await updateDoc(threadRef, {
          unreadCounts: newUnreadCounts,
          unreadCount: totalUnreadCount, // 後方互換性
          updatedAt: serverTimestamp()
        });
        
        console.log(`スレッド ${threadId} の未読数をリセットしました:`, newUnreadCounts, `(現在のユーザー: ${currentUser.uid})`);
      }
    } catch (error) {
      console.error('スレッド未読数リセットエラー:', error);
    }
  }

  // 未読メッセージ数を取得
  getUnreadCount(): Observable<number> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of(0);
    }
    
    const q = query(
      collection(this.firestore, 'messages'),
      where('recipientId', '==', currentUser.uid),
      where('isRead', '==', false)
    );
    
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.size)
    );
  }

  // メッセージスレッドを更新または作成
  private async updateMessageThread(userId1: string, userId2: string, lastMessage: any): Promise<void> {
    const participants = [userId1, userId2].sort();
    const threadId = participants.join('_');
    
    const threadRef = doc(this.firestore, 'messageThreads', threadId);
    const threadDoc = await getDoc(threadRef);
    
    if (threadDoc.exists()) {
      // 既存のスレッドを更新
      const currentData = threadDoc.data();
      const currentUnreadCount = currentData['unreadCount'] || 0;
      
      // メッセージ送信時: 受信者の未読数を+1、送信者の未読数は0
      const isSender1 = lastMessage.senderId === userId1;
      const isSender2 = lastMessage.senderId === userId2;
      
      // ユーザー別の未読数管理
      const currentUnreadCounts = currentData['unreadCounts'] || {};
      const newUnreadCounts = { ...currentUnreadCounts };
      
      if (isSender1) {
        // userId1が送信者の場合、受信者（userId2）の未読数を+1、送信者（userId1）は0
        newUnreadCounts[userId1] = 0;
        newUnreadCounts[userId2] = (newUnreadCounts[userId2] || 0) + 1;
      } else if (isSender2) {
        // userId2が送信者の場合、受信者（userId1）の未読数を+1、送信者（userId2）は0
        newUnreadCounts[userId1] = (newUnreadCounts[userId1] || 0) + 1;
        newUnreadCounts[userId2] = 0;
      }
      
      // 後方互換性のため、全体の未読数も計算
      const totalUnreadCount = Object.values(newUnreadCounts).reduce((sum: number, count: any) => sum + (count as number), 0);
      
      console.log(`スレッド ${threadId} の未読数更新:`, newUnreadCounts, `(送信者: ${lastMessage.senderId})`);
      
      await updateDoc(threadRef, {
        lastMessage: lastMessage,
        unreadCounts: newUnreadCounts,
        unreadCount: totalUnreadCount, // 後方互換性
        updatedAt: serverTimestamp()
      });
    } else {
      // 新しいスレッドを作成
      const [user1, user2] = await Promise.all([
        this.userService.getUserProfile(userId1),
        this.userService.getUserProfile(userId2)
      ]);
      
      // 新しいスレッドの場合、受信者の未読数を1にする
      const isSender1 = lastMessage.senderId === userId1;
      const isSender2 = lastMessage.senderId === userId2;
      
      // ユーザー別の未読数管理
      const initialUnreadCounts: { [userId: string]: number } = {};
      
      if (isSender1) {
        // userId1が送信者の場合、受信者（userId2）の未読数を1、送信者（userId1）は0
        initialUnreadCounts[userId1] = 0;
        initialUnreadCounts[userId2] = 1;
      } else if (isSender2) {
        // userId2が送信者の場合、受信者（userId1）の未読数を1、送信者（userId2）は0
        initialUnreadCounts[userId1] = 1;
        initialUnreadCounts[userId2] = 0;
      }
      
      // 後方互換性のため、全体の未読数も計算
      const totalUnreadCount = Object.values(initialUnreadCounts).reduce((sum: number, count: any) => sum + (count as number), 0);
      
      console.log(`新しいスレッド ${threadId} 作成:`, initialUnreadCounts, `(送信者: ${lastMessage.senderId})`);
      
      const threadData = {
        participants: participants,
        participantNames: [
          user1?.displayName || user1?.email || '',
          user2?.displayName || user2?.email || ''
        ],
        lastMessage: lastMessage,
        unreadCounts: initialUnreadCounts,
        unreadCount: totalUnreadCount, // 後方互換性
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(threadRef, threadData);
    }
  }

  // メッセージスレッドの未読数をリセット
  async resetUnreadCount(threadId: string): Promise<void> {
    const threadRef = doc(this.firestore, 'messageThreads', threadId);
    await updateDoc(threadRef, {
      unreadCount: 0,
      updatedAt: serverTimestamp()
    });
  }
}
