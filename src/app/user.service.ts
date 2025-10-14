import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, setDoc, serverTimestamp } from '@angular/fire/firestore';

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
}


