import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, updateDoc, doc, query, where, orderBy, serverTimestamp, getDoc } from '@angular/fire/firestore';
import { Observable, map, switchMap, of } from 'rxjs';
import { take, catchError } from 'rxjs/operators';
import { JoinRequest } from './models';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { GroupService } from './group.service';

@Injectable({
  providedIn: 'root'
})
export class JoinRequestService {
  private firestore = inject(Firestore);
  private auth = inject(AuthService);
  private notificationService = inject(NotificationService);
  private groupService = inject(GroupService);

  // 参加リクエストを送信
  async sendJoinRequest(groupId: string): Promise<void> {
    try {
      const user = await this.auth.currentUser$.pipe(take(1)).toPromise();
      if (!user) {
        return; // エラーを投げずに静かに終了
      }

      // 既存の参加リクエストをチェック
      try {
        const existingRequest = await this.hasPendingJoinRequest((user as any).uid, groupId).pipe(take(1)).toPromise();
        if (existingRequest) {
          throw new Error('このグループには既に参加リクエストを送信しています');
        }
      } catch (checkError) {
        // 権限エラーの場合は続行
      }

      const joinRequest: Omit<JoinRequest, 'id'> = {
        groupId,
        userId: (user as any).uid,
        userName: user.displayName || user.email?.split('@')[0] || 'ユーザー',
        userEmail: user.email || '',
        status: 'pending',
        message: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(this.firestore, 'joinRequests'), {
        ...joinRequest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // グループオーナーに通知を送信（直接作成で重複を防ぐ）
      try {
        await this.notificationService.createGroupJoinRequestNotification(groupId, (user as any).uid, joinRequest.userName);
      } catch (notificationError) {
        // 通知の失敗は無視（参加リクエストは作成済み）
      }
      
    } catch (error) {
      // 権限エラーやログアウト関連のエラーは無視
      if (error instanceof Error) {
        if (error.message.includes('auth') || 
            error.message.includes('permissions') || 
            error.message.includes('Missing or insufficient permissions')) {
          return;
        }
      }
      
      // FirebaseErrorの場合も権限エラーは無視
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as any;
        if (firebaseError.code === 'permission-denied' || 
            firebaseError.code === 'unauthenticated') {
          return;
        }
      }
      
      throw error;
    }
  }

  // 参加リクエストを承認
  async approveJoinRequest(requestId: string): Promise<void> {
    const user = await this.auth.currentUser$.pipe(take(1)).toPromise();
    if (!user) {
      throw new Error('ユーザーがログインしていません');
    }

    // 参加リクエストの詳細を取得
    const requestDoc = await getDoc(doc(this.firestore, 'joinRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('参加リクエストが見つかりません');
    }

    const requestData = requestDoc.data() as JoinRequest;
    
    // グループに参加させる
    await this.groupService.joinGroup(requestData.groupId, requestData.userId);

    // 参加リクエストのステータスを更新
    await updateDoc(doc(this.firestore, 'joinRequests', requestId), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: (user as any).uid,
      updatedAt: serverTimestamp()
    });
  }

  // 参加リクエストを拒否
  async rejectJoinRequest(requestId: string): Promise<void> {
    const user = await this.auth.currentUser$.pipe(take(1)).toPromise();
    if (!user) {
      throw new Error('ユーザーがログインしていません');
    }

    await updateDoc(doc(this.firestore, 'joinRequests', requestId), {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
      reviewedBy: (user as any).uid,
      updatedAt: serverTimestamp()
    });
  }

  // グループの参加リクエスト一覧を取得（グループオーナー用）
  getGroupJoinRequests(groupId: string): Observable<JoinRequest[]> {
    return collectionData(
      query(
        collection(this.firestore, 'joinRequests'),
        where('groupId', '==', groupId),
        where('status', '==', 'pending')
      ),
      { idField: 'id' }
    ).pipe(
      map((requests: any[]) => {
        return requests.map(request => ({
          ...request,
          createdAt: request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt),
          updatedAt: request.updatedAt?.toDate ? request.updatedAt.toDate() : new Date(request.updatedAt),
          reviewedAt: request.reviewedAt?.toDate ? request.reviewedAt.toDate() : undefined
        })).sort((a, b) => {
          // クライアント側でソート
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        }) as JoinRequest[];
      })
    );
  }

  // ユーザーがオーナーのグループの参加リクエスト一覧を取得
  getUserOwnedGroupJoinRequests(userId: string): Observable<JoinRequest[]> {
    // まず、ユーザーがオーナーのグループを取得
    return this.getUserOwnedGroups(userId).pipe(
      switchMap(groups => {
        if (groups.length === 0) {
          return of([]);
        }
        
        const groupIds = groups.map(group => group.id);
        
        // 各グループの参加リクエストを取得
        return collectionData(
          query(
            collection(this.firestore, 'joinRequests'),
            where('groupId', 'in', groupIds),
            where('status', '==', 'pending')
          ),
          { idField: 'id' }
        ).pipe(
          map((requests: any[]) => {
            return requests.map(request => ({
              ...request,
              createdAt: request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt),
              updatedAt: request.updatedAt?.toDate ? request.updatedAt.toDate() : new Date(request.updatedAt),
              reviewedAt: request.reviewedAt?.toDate ? request.reviewedAt.toDate() : undefined
            })).sort((a, b) => {
              // クライアント側でソート
              const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
              const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
              return dateB.getTime() - dateA.getTime();
            }) as JoinRequest[];
          })
        );
      })
    );
  }

  // ユーザーがオーナーのグループを取得
  private getUserOwnedGroups(userId: string): Observable<any[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groups'),
        where('ownerId', '==', userId)
      ),
      { idField: 'id' }
    );
  }

  // ユーザーの参加リクエスト一覧を取得
  getUserJoinRequests(userId: string): Observable<JoinRequest[]> {
    return collectionData(
      query(
        collection(this.firestore, 'joinRequests'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      ),
      { idField: 'id' }
    ).pipe(
      map((requests: any[]) => {
        return requests.map(request => ({
          ...request,
          createdAt: request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt),
          updatedAt: request.updatedAt?.toDate ? request.updatedAt.toDate() : new Date(request.updatedAt),
          reviewedAt: request.reviewedAt?.toDate ? request.reviewedAt.toDate() : undefined
        })) as JoinRequest[];
      })
    );
  }

  // ユーザーがグループに参加リクエストを送信済みかチェック
  hasPendingJoinRequest(userId: string, groupId: string): Observable<boolean> {
    return collectionData(
      query(
        collection(this.firestore, 'joinRequests'),
        where('userId', '==', userId),
        where('groupId', '==', groupId),
        where('status', '==', 'pending')
      ),
      { idField: 'id' }
    ).pipe(
      map(requests => requests.length > 0),
      catchError((error: any) => {
        // 権限エラーの場合はfalseを返す（重複チェックをスキップ）
        if (error && typeof error === 'object' && 'code' in error) {
          const firebaseError = error as any;
          if (firebaseError.code === 'permission-denied' || 
              firebaseError.code === 'unauthenticated') {
            return of(false);
          }
        }
        return of(false);
      })
    );
  }
}

