import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, collectionData, setDoc, orderBy, limit, getDocs, docData } from '@angular/fire/firestore';
import { Observable, from, combineLatest, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { Group, GroupMembership, GroupJoinRequest, User } from './models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class GroupService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // グループ作成
  async createGroup(groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Promise<Group> {
    const ref = await addDoc(collection(this.firestore, 'groups'), {
      ...groupData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // グループメンバーシップを作成
    const currentUser = this.authService.currentUser;
    await addDoc(collection(this.firestore, 'groupMemberships'), {
      groupId: ref.id,
      userId: groupData.ownerId,
      role: 'owner',
      joinedAt: serverTimestamp(),
      userName: currentUser?.displayName || 'グループオーナー',
      userEmail: currentUser?.email || 'owner@example.com'
    });
    
    const snap = await getDoc(doc(this.firestore, 'groups', ref.id));
    return { id: ref.id, ...(snap.data() as Omit<Group, 'id'>) };
  }

  // ユーザーのグループ一覧取得
  getUserGroups(userId: string): Observable<Group[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groupMemberships'),
        where('userId', '==', userId)
      ),
      { idField: 'id' }
    ).pipe(
      switchMap((memberships: any[]) => {
        if (memberships.length === 0) return of([]);
        
        const groupIds = memberships.map(m => m.groupId);
        return combineLatest(
          groupIds.map(groupId => 
            docData(doc(this.firestore, 'groups', groupId), { idField: 'id' }) as Observable<Group>
          )
        );
      })
    );
  }

  // グループ詳細取得
  getGroup$(groupId: string): Observable<Group | null> {
    return docData(doc(this.firestore, 'groups', groupId), { idField: 'id' }) as Observable<Group | null>;
  }

  async getGroup(groupId: string): Promise<Group | null> {
    const docRef = doc(this.firestore, 'groups', groupId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Group;
    }
    return null;
  }

  // グループ更新
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<void> {
    await updateDoc(doc(this.firestore, 'groups', groupId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  // グループ削除
  async deleteGroup(groupId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'groups', groupId));
  }

  // グループメンバー一覧取得
  getGroupMembers(groupId: string): Observable<GroupMembership[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groupMemberships'),
        where('groupId', '==', groupId)
      ),
      { idField: 'id' }
    ) as Observable<GroupMembership[]>;
  }

  // グループメンバー追加
  async addMember(groupId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<void> {
    await addDoc(collection(this.firestore, 'groupMemberships'), {
      groupId,
      userId,
      role,
      joinedAt: serverTimestamp(),
    });
  }

  // グループメンバー削除
  async removeMember(groupId: string, userId: string): Promise<void> {
    const membershipQuery = query(
      collection(this.firestore, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    memberships.forEach(doc => {
      deleteDoc(doc.ref);
    });
  }

  // グループ参加リクエスト作成
  async createJoinRequest(groupId: string, userId: string): Promise<void> {
    // 既存のリクエストをチェック
    const existingRequestQuery = query(
      collection(this.firestore, 'groupJoinRequests'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const existingRequests = await getDocs(existingRequestQuery);
    if (!existingRequests.empty) {
      throw new Error('既に参加リクエストが送信されています');
    }

    await addDoc(collection(this.firestore, 'groupJoinRequests'), {
      groupId,
      userId,
      status: 'pending',
      requestedAt: serverTimestamp(),
    });
  }

  // グループ参加リクエスト一覧取得
  getJoinRequests(groupId: string): Observable<GroupJoinRequest[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groupJoinRequests'),
        where('groupId', '==', groupId),
        where('status', '==', 'pending')
      ),
      { idField: 'id' }
    ) as Observable<GroupJoinRequest[]>;
  }

  // 参加リクエスト承認
  async approveJoinRequest(requestId: string): Promise<void> {
    const requestDoc = await getDoc(doc(this.firestore, 'groupJoinRequests', requestId));
    if (!requestDoc.exists()) {
      throw new Error('参加リクエストが見つかりません');
    }

    const requestData = requestDoc.data();
    
    // メンバーシップを作成
    await this.addMember(requestData['groupId'], requestData['userId']);
    
    // リクエストを承認済みに更新
    await updateDoc(doc(this.firestore, 'groupJoinRequests', requestId), {
      status: 'approved',
      processedAt: serverTimestamp(),
      processedBy: this.getCurrentUserId(),
    });
  }

  // 参加リクエスト拒否
  async denyJoinRequest(requestId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'groupJoinRequests', requestId), {
      status: 'denied',
      processedAt: serverTimestamp(),
      processedBy: this.getCurrentUserId(),
    });
  }

  // ユーザーがグループのメンバーかチェック
  async isMember(groupId: string, userId: string): Promise<boolean> {
    const membershipQuery = query(
      collection(this.firestore, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    
    const memberships = await getDocs(membershipQuery);
    return !memberships.empty;
  }

  // ユーザーがグループの管理者かチェック
  async isAdmin(groupId: string, userId: string): Promise<boolean> {
    const membershipQuery = query(
      collection(this.firestore, 'groupMemberships'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      where('role', 'in', ['owner', 'admin'])
    );
    
    const memberships = await getDocs(membershipQuery);
    return !memberships.empty;
  }

  // グループ検索
  searchGroups(searchTerm: string): Observable<Group[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groups'),
        where('isPublic', '==', true),
        orderBy('name'),
        limit(20)
      ),
      { idField: 'id' }
    ).pipe(
      map((groups: any[]) => 
        (groups as Group[]).filter(group => 
          group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (group.description && group.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      )
    ) as Observable<Group[]>;
  }

  // 公開グループ一覧取得
  getPublicGroups(): Observable<Group[]> {
    return collectionData(
      query(
        collection(this.firestore, 'groups'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(20)
      ),
      { idField: 'id' }
    ) as Observable<Group[]>;
  }

  // グループ統計取得
  async getGroupStats(groupId: string): Promise<any> {
    // TODO: グループの統計情報を取得
    return {
      totalMembers: 0,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0
    };
  }

  private getCurrentUserId(): string {
    // TODO: 現在のユーザーIDを取得
    return 'current-user-id';
  }
}