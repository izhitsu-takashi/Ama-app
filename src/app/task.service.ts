import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, collectionData, setDoc, orderBy, limit, getDocs } from '@angular/fire/firestore';
import { Observable, from, combineLatest, of } from 'rxjs';
import { map, switchMap, take, catchError } from 'rxjs/operators';
import { TaskItem, TaskTemplate, TaskComment, TaskReaction, CommentReaction, RecurringPattern } from './models';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private firestore = inject(Firestore);
  private notificationService = inject(NotificationService);

  // 課題作成
  async createTask(groupId: string, taskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'groupId'>): Promise<TaskItem> {
    const createdBy = this.getCurrentUserId();
    if (!createdBy) throw new Error('Not authenticated');

    const ref = await addDoc(collection(this.firestore, 'tasks'), {
      ...taskData,
      groupId,
      createdBy,
      status: taskData.status ?? 'not_started',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snap = await getDoc(doc(this.firestore, 'tasks', ref.id));
    const task = { id: ref.id, ...(snap.data() as Omit<TaskItem, 'id'>) };

    // 担当者に通知を送信
    if (task.assigneeId && task.assigneeId !== createdBy) {
      try {
        await this.notificationService.createTaskNotification(
          task.assigneeId,
          'task_assigned',
          task.id,
          groupId,
          { taskTitle: task.title }
        );
      } catch (error) {
        console.error('通知送信エラー:', error);
      }
    }

    return task;
  }

  // 課題更新
  async updateTask(taskId: string, updates: Partial<TaskItem>): Promise<void> {
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(doc(this.firestore, 'tasks', taskId), {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    });
  }

  // 課題削除
  async deleteTask(taskId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'tasks', taskId));
  }

  // グループの課題一覧取得
  getGroupTasks(groupId: string): Observable<TaskItem[]> {
    return collectionData(
      query(
        collection(this.firestore, 'tasks'),
        where('groupId', '==', groupId)
      ),
      { idField: 'id' }
    ).pipe(
      map(tasks => {
        // クライアント側でソート
        return (tasks as TaskItem[]).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading tasks:', error);
        return of([]);
      })
    );
  }

  getTasksByGroup(groupId: string): Observable<TaskItem[]> {
    return this.getGroupTasks(groupId);
  }

  // ユーザーの課題一覧取得
  getUserTasks(userId: string): Observable<TaskItem[]> {
    return collectionData(
      query(
        collection(this.firestore, 'tasks'),
        where('assigneeId', '==', userId),
        orderBy('createdAt', 'desc')
      ),
      { idField: 'id' }
    ).pipe(
      map(tasks => tasks as TaskItem[]),
      catchError(error => {
        console.error('Error loading user tasks:', error);
        return of([]);
      })
    );
  }

  // 最近の課題取得（ユーザーが所属するグループの課題）
  getRecentTasks(userId: string, limitCount: number = 10): Observable<TaskItem[]> {
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
        
        // 各グループの課題を取得
        return collectionData(
          query(
            collection(this.firestore, 'tasks'),
            where('groupId', 'in', groupIds)
          ),
          { idField: 'id' }
        ).pipe(
          map(tasks => {
            // クライアント側でソートとリミット
            return (tasks as TaskItem[])
              .sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB.getTime() - dateA.getTime();
              })
              .slice(0, limitCount);
          }),
          catchError(error => {
            console.error('Error loading recent tasks:', error);
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

  // 期限が近い課題取得
  getUpcomingTasks(userId: string, days: number = 7): Observable<TaskItem[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return collectionData(
      query(
        collection(this.firestore, 'tasks'),
        where('assigneeId', '==', userId),
        where('dueDate', '>=', now),
        where('dueDate', '<=', futureDate),
        orderBy('dueDate', 'asc')
      ),
      { idField: 'id' }
    ).pipe(
      map(tasks => tasks as TaskItem[]),
      catchError(error => {
        console.error('Error loading upcoming tasks:', error);
        return of([]);
      })
    );
  }

  // 課題詳細取得
  getTask$(taskId: string): Observable<TaskItem | null> {
    return from(getDoc(doc(this.firestore, 'tasks', taskId))).pipe(
      map(doc => {
        if (doc.exists()) {
          return { id: doc.id, ...doc.data() } as TaskItem;
        }
        return null;
      })
    );
  }

  // 課題ステータス更新
  async updateTaskStatus(taskId: string, status: TaskItem['status']): Promise<void> {
    await updateDoc(doc(this.firestore, 'tasks', taskId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  // 課題進捗更新
  async updateTaskProgress(taskId: string, progress: number): Promise<void> {
    await updateDoc(doc(this.firestore, 'tasks', taskId), {
      progress: Math.max(0, Math.min(100, progress)),
      updatedAt: serverTimestamp(),
    });
  }

  // 課題コメント追加
  async addComment(taskId: string, content: string, groupId?: string): Promise<void> {
    const authorId = this.getCurrentUserId();
    if (!authorId) throw new Error('Not authenticated');

    await addDoc(collection(this.firestore, 'taskComments'), {
      taskId,
      groupId,
      authorId,
      content,
      createdAt: serverTimestamp()
    });
  }

  // 課題コメント一覧取得
  getTaskComments(taskId: string): Observable<TaskComment[]> {
    return collectionData(
      query(
        collection(this.firestore, 'taskComments'),
        where('taskId', '==', taskId)
      ),
      { idField: 'id' }
    ).pipe(
      map(comments => {
        return (comments as TaskComment[]).sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return aTime.getTime() - bTime.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading comments:', error);
        return of([]);
      })
    );
  }

  // 課題リアクション追加
  async addTaskReaction(taskId: string, type: TaskReaction['type']): Promise<void> {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // 既存のリアクションをチェック
    const existingReactionQuery = query(
      collection(this.firestore, 'taskReactions'),
      where('taskId', '==', taskId),
      where('userId', '==', userId),
      where('type', '==', type)
    );

    const existingReactions = await getDocs(existingReactionQuery);

    if (existingReactions.empty) {
      // リアクションが存在しない場合は追加
      await addDoc(collection(this.firestore, 'taskReactions'), {
        taskId,
        userId,
        type,
        createdAt: serverTimestamp()
      });
    } else {
      // リアクションが存在する場合は削除（トグル）
      const reactionDoc = existingReactions.docs[0];
      await deleteDoc(reactionDoc.ref);
    }
  }

  // 課題リアクション一覧取得
  getTaskReactions(taskId: string): Observable<TaskReaction[]> {
    return collectionData(
      query(
        collection(this.firestore, 'taskReactions'),
        where('taskId', '==', taskId)
      ),
      { idField: 'id' }
    ).pipe(
      map(reactions => reactions as TaskReaction[]),
      catchError(error => {
        console.error('Error loading task reactions:', error);
        return of([]);
      })
    );
  }

  // コメントリアクション追加
  async addCommentReaction(commentId: string, type: CommentReaction['type'], groupId?: string): Promise<void> {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // 既存のリアクションをチェック
    const existingReactionQuery = query(
      collection(this.firestore, 'commentReactions'),
      where('commentId', '==', commentId),
      where('userId', '==', userId),
      where('type', '==', type)
    );

    const existingReactions = await getDocs(existingReactionQuery);

    if (existingReactions.empty) {
      // リアクションが存在しない場合は追加
      await addDoc(collection(this.firestore, 'commentReactions'), {
        commentId,
        groupId,
        userId,
        type,
        createdAt: serverTimestamp()
      });
    } else {
      // リアクションが存在する場合は削除（トグル）
      const reactionDoc = existingReactions.docs[0];
      await deleteDoc(reactionDoc.ref);
    }
  }

  // コメントリアクション一覧取得
  getCommentReactions(commentId: string): Observable<CommentReaction[]> {
    return collectionData(
      query(
        collection(this.firestore, 'commentReactions'),
        where('commentId', '==', commentId)
      ),
      { idField: 'id' }
    ).pipe(
      map(reactions => reactions as CommentReaction[]),
      catchError(error => {
        console.error('Error loading comment reactions:', error);
        return of([]);
      })
    );
  }

  // 課題テンプレート作成
  async createTaskTemplate(templateData: Omit<TaskTemplate, 'id' | 'createdAt'>): Promise<TaskTemplate> {
    const createdBy = this.getCurrentUserId();
    if (!createdBy) throw new Error('Not authenticated');

    const ref = await addDoc(collection(this.firestore, 'taskTemplates'), {
      ...templateData,
      createdBy,
      createdAt: serverTimestamp(),
    });

    const snap = await getDoc(doc(this.firestore, 'taskTemplates', ref.id));
    return { id: ref.id, ...(snap.data() as Omit<TaskTemplate, 'id'>) };
  }

  // グループの課題テンプレート一覧取得
  getGroupTaskTemplates(groupId: string): Observable<TaskTemplate[]> {
    return collectionData(
      query(
        collection(this.firestore, 'taskTemplates'),
        where('groupId', '==', groupId),
        orderBy('createdAt', 'desc')
      ),
      { idField: 'id' }
    ).pipe(
      map(templates => templates as TaskTemplate[]),
      catchError(error => {
        console.error('Error loading task templates:', error);
        return of([]);
      })
    );
  }

  // テンプレートから課題作成
  async createTaskFromTemplate(templateId: string, groupId: string, overrides: Partial<TaskItem> = {}): Promise<TaskItem> {
    const templateDoc = await getDoc(doc(this.firestore, 'taskTemplates', templateId));
    if (!templateDoc.exists()) {
      throw new Error('テンプレートが見つかりません');
    }

    const template = templateDoc.data() as TaskTemplate;
    const taskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'groupId'> = {
      title: template.title,
      content: template.content,
      priority: template.priority,
      assigneeId: template.defaultAssigneeId,
      status: 'not_started',
      occurredOn: serverTimestamp(),
      isRecurring: template.isRecurring,
      recurringPattern: template.recurringPattern,
      ...overrides
    };

    return this.createTask(groupId, taskData);
  }

  // 定期課題の生成
  async generateRecurringTasks(): Promise<void> {
    const now = new Date();
    const recurringTasksQuery = query(
      collection(this.firestore, 'tasks'),
      where('isRecurring', '==', true)
    );

    const recurringTasks = await getDocs(recurringTasksQuery);
    
    for (const taskDoc of recurringTasks.docs) {
      const task = { id: taskDoc.id, ...taskDoc.data() } as TaskItem;
      if (task.recurringPattern && this.shouldGenerateRecurringTask(task, now)) {
        await this.createRecurringTaskInstance(task);
      }
    }
  }

  private shouldGenerateRecurringTask(task: TaskItem, now: Date): boolean {
    if (!task.recurringPattern) return false;

    const lastGenerated = task.updatedAt?.toDate ? task.updatedAt.toDate() : new Date(task.createdAt);
    const pattern = task.recurringPattern;

    switch (pattern.type) {
      case 'daily':
        return now.getTime() - lastGenerated.getTime() >= pattern.interval * 24 * 60 * 60 * 1000;
      case 'weekly':
        return now.getTime() - lastGenerated.getTime() >= pattern.interval * 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return now.getTime() - lastGenerated.getTime() >= pattern.interval * 30 * 24 * 60 * 60 * 1000;
      case 'yearly':
        return now.getTime() - lastGenerated.getTime() >= pattern.interval * 365 * 24 * 60 * 60 * 1000;
      default:
        return false;
    }
  }

  private async createRecurringTaskInstance(originalTask: TaskItem): Promise<void> {
    const newTaskData: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'groupId'> = {
      title: originalTask.title,
      content: originalTask.content,
      priority: originalTask.priority,
      assigneeId: originalTask.assigneeId,
      status: 'not_started',
      isRecurring: false, // 新しいインスタンスは定期タスクではない
      occurredOn: serverTimestamp(),
      dueDate: this.calculateNextDueDate(originalTask)
    };

    await this.createTask(originalTask.groupId, newTaskData);
    
    // 元のタスクの更新日時を更新
    await this.updateTask(originalTask.id, { updatedAt: serverTimestamp() });
  }

  private calculateNextDueDate(task: TaskItem): any {
    if (!task.recurringPattern) return null;

    const now = new Date();
    const pattern = task.recurringPattern;

    switch (pattern.type) {
      case 'daily':
        now.setDate(now.getDate() + pattern.interval);
        break;
      case 'weekly':
        now.setDate(now.getDate() + pattern.interval * 7);
        break;
      case 'monthly':
        now.setMonth(now.getMonth() + pattern.interval);
        break;
      case 'yearly':
        now.setFullYear(now.getFullYear() + pattern.interval);
        break;
    }

    return now;
  }

  // 課題統計取得
  async getTaskStats(groupId: string): Promise<any> {
    const tasksQuery = query(
      collection(this.firestore, 'tasks'),
      where('groupId', '==', groupId)
    );

    const tasks = await getDocs(tasksQuery);
    const taskList = tasks.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskItem));

    return {
      total: taskList.length,
      notStarted: taskList.filter(t => t.status === 'not_started').length,
      inProgress: taskList.filter(t => t.status === 'in_progress').length,
      completed: taskList.filter(t => t.status === 'completed').length,
      overdue: taskList.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
        return dueDate < new Date() && t.status !== 'completed';
      }).length
    };
  }

  private getCurrentUserId(): string {
    // TODO: 現在のユーザーIDを取得
    return 'current-user-id';
  }
}