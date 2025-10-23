import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, orderBy, limit } from '@angular/fire/firestore';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { TodoItem, TaskItem, CalendarEvent, GroupMembership } from './models';
import { TaskService } from './task.service';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TodoService {
  private firestore = inject(Firestore);
  private taskService = inject(TaskService);
  private groupService = inject(GroupService);
  private authService = inject(AuthService);

  // 今日のTodoリストを取得（最大5件）
  getTodayTodos(): Observable<TodoItem[]> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      return of([]);
    }

    return this.groupService.getUserGroups(currentUser.uid).pipe(
      switchMap(groups => {
        if (groups.length === 0) {
          return of([]);
        }

        const groupIds = groups.map(g => g.id);
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // 今日期限のタスクを取得
        const todayTasks$ = this.getTodayTasks(groupIds, currentUser.uid);
        
        // 一週間以内の期限のタスクを取得
        const upcomingTasks$ = this.getUpcomingTasks(groupIds, currentUser.uid, weekFromNow);
        
        // 今日の予定を取得
        const todayEvents$ = this.getTodayEvents(currentUser.uid, startOfDay, endOfDay);

        return combineLatest([todayTasks$, upcomingTasks$, todayEvents$]).pipe(
          map(([todayTasks, upcomingTasks, events]) => {
            const todos: TodoItem[] = [];

            // 今日期限のタスクをTodoItemに変換
            todayTasks.forEach(task => {
              const group = groups.find(g => g.id === task.groupId);
              todos.push({
                id: `task-${task.id}`,
                title: task.title,
                description: task.content,
                type: 'task',
                priority: task.priority,
                dueDate: task.dueDate,
                isCompleted: task.status === 'completed',
                relatedId: task.id,
                groupId: task.groupId,
                groupName: group?.name,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt
              });
            });

            // 一週間以内の期限のタスクをTodoItemに変換（今日期限のタスクと重複しないもののみ）
            const todayTaskIds = new Set(todayTasks.map(t => t.id));
            upcomingTasks.forEach(task => {
              if (!todayTaskIds.has(task.id)) {
                const group = groups.find(g => g.id === task.groupId);
                todos.push({
                  id: `task-${task.id}`,
                  title: task.title,
                  description: task.content,
                  type: 'deadline',
                  priority: task.priority,
                  dueDate: task.dueDate,
                  isCompleted: task.status === 'completed',
                  relatedId: task.id,
                  groupId: task.groupId,
                  groupName: group?.name,
                  createdAt: task.createdAt,
                  updatedAt: task.updatedAt
                });
              }
            });

            // イベントをTodoItemに変換（完了したイベントは除外）
            const completedEvents = this.getCompletedEvents();
            events.forEach(event => {
              // 完了したイベントは除外
              if (!completedEvents.includes(event.id)) {
                todos.push({
                  id: `event-${event.id}`,
                  title: event.title,
                  description: event.description,
                  type: 'event',
                  priority: this.getEventPriority(event),
                  dueDate: event.startDate,
                  isCompleted: false,
                  relatedId: event.id,
                  createdAt: event.createdAt,
                  updatedAt: event.updatedAt
                });
              }
            });

            // 優先度と期限でソート
            return this.sortTodosByPriority(todos).slice(0, 5);
          }),
          catchError(error => {
            console.error('Todo取得エラー:', error);
            return of([]);
          })
        );
      })
    );
  }

  // 今日期限のタスクを取得
  private getTodayTasks(groupIds: string[], userId: string): Observable<TaskItem[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // インデックスを避けるため、シンプルなクエリを使用
    const taskQueries = groupIds.map(groupId => 
      query(
        collection(this.firestore, 'tasks'),
        where('groupId', '==', groupId),
        where('assigneeId', '==', userId)
      )
    );

    return combineLatest(
      taskQueries.map(q => 
        getDocs(q).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskItem))
        )
      )
    ).pipe(
      map(taskArrays => {
        const allTasks = taskArrays.flat();
        return allTasks.filter(task => {
          // 完了済みでない、かつ今日期限のタスクのみ
          if (task.status === 'completed' || !task.dueDate) return false;
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          return dueDate >= startOfDay && dueDate < endOfDay;
        });
      })
    );
  }

  // 一週間以内の期限のタスクを取得
  private getUpcomingTasks(groupIds: string[], userId: string, weekFromNow: Date): Observable<TaskItem[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); // 明日から

    // インデックスを避けるため、シンプルなクエリを使用
    const taskQueries = groupIds.map(groupId => 
      query(
        collection(this.firestore, 'tasks'),
        where('groupId', '==', groupId),
        where('assigneeId', '==', userId)
      )
    );

    return combineLatest(
      taskQueries.map(q => 
        getDocs(q).then(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskItem))
        )
      )
    ).pipe(
      map(taskArrays => {
        const allTasks = taskArrays.flat();
        return allTasks.filter(task => {
          // 完了済みでない、かつ一週間以内の期限のタスクのみ
          if (task.status === 'completed' || !task.dueDate) return false;
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
          return dueDate >= startOfDay && dueDate <= weekFromNow;
        });
      })
    );
  }

  // 今日の予定を取得
  private getTodayEvents(userId: string, startOfDay: Date, endOfDay: Date): Observable<CalendarEvent[]> {
    const eventsQuery = query(
      collection(this.firestore, 'calendarEvents'),
      where('userId', '==', userId)
    );

    return new Observable(observer => {
      getDocs(eventsQuery).then(snapshot => {
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
        const todayEvents = events.filter(event => {
          if (!event.startDate) return false;
          const startDate = event.startDate.toDate ? event.startDate.toDate() : new Date(event.startDate);
          return startDate >= startOfDay && startDate < endOfDay;
        });
        observer.next(todayEvents);
        observer.complete();
      }).catch(error => {
        console.error('イベント取得エラー:', error);
        observer.next([]);
        observer.complete();
      });
    });
  }

  // イベントの優先度を決定
  private getEventPriority(event: CalendarEvent): 'low' | 'medium' | 'high' | 'urgent' {
    // イベントのタイプに基づいて優先度を決定
    if (event.type === 'task_due') {
      return 'urgent';
    }
    return 'medium';
  }

  // Todoを優先度と期限でソート
  private sortTodosByPriority(todos: TodoItem[]): TodoItem[] {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    return todos.sort((a, b) => {
      // 完了済みは最後
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }

      // 優先度でソート
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // 期限でソート（期限が近い順）
      if (a.dueDate && b.dueDate) {
        const aDate = a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
        const bDate = b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
        return aDate.getTime() - bDate.getTime();
      }

      return 0;
    });
  }

  // Todoの完了状態を更新
  async updateTodoCompletion(todoId: string, isCompleted: boolean): Promise<void> {
    const [type, id] = todoId.split('-');
    
    if (type === 'task' || type === 'deadline') {
      // タスクの完了状態を更新
      await this.taskService.updateTask(id, { 
        status: isCompleted ? 'completed' : 'in_progress' 
      });
    } else if (type === 'event') {
      // イベントの完了状態をローカルストレージで管理
      this.updateCompletedEvents(id, isCompleted);
    }
  }

  // 完了したイベントの管理（ローカルストレージ）
  private updateCompletedEvents(eventId: string, isCompleted: boolean): void {
    const completedEvents = this.getCompletedEvents();
    
    if (isCompleted) {
      if (!completedEvents.includes(eventId)) {
        completedEvents.push(eventId);
      }
    } else {
      const index = completedEvents.indexOf(eventId);
      if (index > -1) {
        completedEvents.splice(index, 1);
      }
    }
    
    // ブラウザ環境でのみlocalStorageを使用
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('completedEvents', JSON.stringify(completedEvents));
    }
  }

  // 完了したイベントのリストを取得
  private getCompletedEvents(): string[] {
    try {
      // ブラウザ環境でのみlocalStorageを使用
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('completedEvents');
        return stored ? JSON.parse(stored) : [];
      }
      return [];
    } catch (error) {
      console.error('完了イベント取得エラー:', error);
      return [];
    }
  }
}
