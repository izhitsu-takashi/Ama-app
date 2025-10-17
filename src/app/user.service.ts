import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, collectionData } from '@angular/fire/firestore';
import { User } from './models';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface AppUserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  createdAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private firestore = inject(Firestore);

  async getUserProfile(uid: string) {
    const ref = doc(this.firestore, 'users', uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as AppUserProfile) : null;
  }

  async ensureUserProfile(uid: string, email: string | null, displayName?: string | null) {
    const existing = await this.getUserProfile(uid);
    if (existing) return existing;
    const ref = doc(this.firestore, 'users', uid);
    const profile: AppUserProfile = {
      uid,
      email,
      displayName: displayName ?? null,
      createdAt: serverTimestamp(),
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

  async getAllUsers(): Promise<User[]> {
    try {
      const usersCollection = collection(this.firestore, 'users');
      const snapshot = await getDocs(usersCollection);
      
      const users: User[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as AppUserProfile;
        users.push({
          id: data.uid,
          email: data.email || '',
          displayName: data.displayName || undefined,
          photoURL: undefined,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      return users;
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  }

  getAllUsersObservable(): Observable<User[]> {
    return collectionData(collection(this.firestore, 'users'), { idField: 'uid' }).pipe(
      map((userProfiles: any[]) => {
        return userProfiles.map(profile => ({
          id: profile.uid,
          email: profile.email || '',
          displayName: profile.displayName || undefined,
          photoURL: undefined,
          role: 'user' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      }),
      catchError(error => {
        console.error('Error fetching all users:', error);
        return of([]);
      })
    );
  }
}


