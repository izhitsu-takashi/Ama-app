import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, collectionData, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { User } from './models';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role?: 'user' | 'admin';
  department?: 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other';
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);

  async getUserProfile(uid: string) {
    const ref = doc(this.firestore, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as AppUserProfile) : null;
  }

  async ensureUserProfile(uid: string, email: string | null, displayName?: string | null, department?: 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other') {
    const existing = await this.getUserProfile(uid);
    if (existing) return existing;
    const ref = doc(this.firestore, 'users', uid);
    const profile: AppUserProfile = {
      uid,
      email,
      displayName: displayName ?? null,
      role: 'user', // デフォルトは一般ユーザー
      department: department ?? 'other', // デフォルトはその他
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  }

  async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];
    
    const users: User[] = [];
    for (const userId of userIds) {
      try {
        const userProfile = await this.getUserProfile(userId);
        if (userProfile) {
          users.push({
            id: userProfile.uid,
            email: userProfile.email || '',
            displayName: userProfile.displayName || undefined,
            photoURL: undefined,
            role: 'user',
            department: userProfile.department,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
      }
    }
    return users;
  }

  // 管理者用メソッド

  // 全ユーザーを取得（管理者用）
  getAllUsers(): Observable<User[]> {
    // 認証状態をチェック（AuthServiceをインポートする必要がある）
    // このメソッドは管理者用なので、認証チェックは呼び出し元で行う
    
    const usersQuery = query(collection(this.firestore, 'users'));
    return collectionData(usersQuery, { idField: 'uid' }).pipe(
      map((users: any[]) => users.map((user: any) => ({
        id: user.uid,
        email: user['email'] || '',
        displayName: user['displayName'] || undefined,
        photoURL: undefined,
        role: user['role'] || 'user',
        department: user['department'],
        createdAt: user['createdAt'] || new Date(),
        updatedAt: user['updatedAt'] || new Date()
      }))),
      catchError(error => {
        // 認証エラーの場合はログを出力しない
        if (!error.message?.includes('permissions')) {
          console.error('Error fetching all users:', error);
        }
        return of([]);
      })
    );
  }

  // ユーザーの権限を更新
  async updateUserRole(userId: string, newRole: 'user' | 'admin'): Promise<void> {
    const userRef = doc(this.firestore, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  }

  // ユーザーを削除
  async deleteUser(userId: string): Promise<void> {
    const userRef = doc(this.firestore, 'users', userId);
    await deleteDoc(userRef);
  }
}


