import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, collectionData, orderBy, limit, getDocs } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map, catchError, take, switchMap } from 'rxjs/operators';
import { Milestone, MilestoneTask, Id } from './models';

@Injectable({ providedIn: 'root' })
export class MilestoneService {
  private firestore = inject(Firestore);

  // マイルストーン作成
  async createMilestone(milestoneData: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>): Promise<Milestone> {
    const ref = await addDoc(collection(this.firestore, 'milestones'), {
      ...milestoneData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const snap = await getDoc(doc(this.firestore, 'milestones', ref.id));
    return { id: ref.id, ...(snap.data() as Omit<Milestone, 'id'>) };
  }

  // マイルストーン更新
  async updateMilestone(milestoneId: string, updates: Partial<Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'milestones', milestoneId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  // マイルストーン削除
  async deleteMilestone(milestoneId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'milestones', milestoneId));
  }

  // グループのマイルストーン一覧取得
  getGroupMilestones(groupId: string): Observable<Milestone[]> {
    return collectionData(
      query(
        collection(this.firestore, 'milestones'),
        where('groupId', '==', groupId)
      ),
      { idField: 'id' }
    ).pipe(
      map(milestones => {
        // クライアント側でソート
        return (milestones as Milestone[]).sort((a, b) => {
          const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
          const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
          return dateA.getTime() - dateB.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading milestones:', error);
        return of([]);
      })
    );
  }

  // マイルストーン詳細取得
  async getMilestone(milestoneId: string): Promise<Milestone | null> {
    const docRef = doc(this.firestore, 'milestones', milestoneId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Milestone;
    }
    return null;
  }

  // マイルストーンに課題を追加
  async addTaskToMilestone(milestoneId: string, taskId: string, isRequired: boolean = true): Promise<void> {
    await addDoc(collection(this.firestore, 'milestoneTasks'), {
      milestoneId,
      taskId,
      isRequired,
      createdAt: serverTimestamp(),
    });
  }

  // マイルストーンから課題を削除
  async removeTaskFromMilestone(milestoneId: string, taskId: string): Promise<void> {
    const q = query(
      collection(this.firestore, 'milestoneTasks'),
      where('milestoneId', '==', milestoneId),
      where('taskId', '==', taskId)
    );
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (doc) => {
      await deleteDoc(doc.ref);
    });
  }

  // マイルストーンの課題一覧取得
  getMilestoneTasks(milestoneId: string): Observable<MilestoneTask[]> {
    return collectionData(
      query(
        collection(this.firestore, 'milestoneTasks'),
        where('milestoneId', '==', milestoneId)
      ),
      { idField: 'id' }
    ).pipe(
      map(tasks => tasks as MilestoneTask[]),
      catchError(error => {
        console.error('Error loading milestone tasks:', error);
        return of([]);
      })
    );
  }

  // ユーザーがアクセス可能なマイルストーン一覧取得
  getUserMilestones(userId: string): Observable<Milestone[]> {
    // まずユーザーが所属するグループを取得
    return collectionData(
      query(
        collection(this.firestore, 'groupMemberships'),
        where('userId', '==', userId)
      ),
      { idField: 'id' }
    ).pipe(
      switchMap(memberships => {
        if (memberships.length === 0) {
          return of([]);
        }
        
        const groupIds = memberships.map(m => m['groupId']);
        
        // 各グループのマイルストーンを取得
        return collectionData(
          query(
            collection(this.firestore, 'milestones'),
            where('groupId', 'in', groupIds)
          ),
          { idField: 'id' }
        ).pipe(
          map(milestones => {
            // クライアント側でソート
            return (milestones as Milestone[]).sort((a, b) => {
              const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
              const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
              return dateA.getTime() - dateB.getTime();
            });
          }),
          catchError(error => {
            console.error('Error loading user milestones:', error);
            return of([]);
          })
        );
      }),
      catchError(error => {
        console.error('Error loading user groups:', error);
        return of([]);
      })
    );
  }

  // マイルストーンの進捗計算
  async calculateMilestoneProgress(milestoneId: string): Promise<number> {
    const milestoneTasks = await this.getMilestoneTasks(milestoneId).pipe(take(1)).toPromise();
    if (!milestoneTasks || milestoneTasks.length === 0) {
      return 0;
    }

    const requiredTasks = milestoneTasks.filter(mt => mt.isRequired);
    if (requiredTasks.length === 0) {
      return 100;
    }

    // 各課題の完了状況を確認
    let completedRequiredTasks = 0;
    for (const milestoneTask of requiredTasks) {
      const taskDoc = await getDoc(doc(this.firestore, 'tasks', milestoneTask.taskId));
      if (taskDoc.exists()) {
        const task = taskDoc.data();
        if (task['status'] === 'completed') {
          completedRequiredTasks++;
        }
      }
    }

    return Math.round((completedRequiredTasks / requiredTasks.length) * 100);
  }
}
