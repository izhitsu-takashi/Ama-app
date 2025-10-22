import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { TodoService } from './todo.service';
import { TaskService } from './task.service';
import { GroupService } from './group.service';
import { TodoItem, CalendarEvent, Group } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Firestore, collection, query, where, getDocs, collectionData } from '@angular/fire/firestore';

@Component({
  selector: 'app-morning-report',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="morning-report-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>🌅 朝会用資料作成</h1>
        </div>
        <div class="header-right">
          <button class="action-btn download-btn" (click)="downloadReport()">📥 ダウンロード</button>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- プレビューエリア -->
        <div class="preview-section">
          <h2>資料プレビュー</h2>
          <div class="slide-container">
            <div class="slide">
              <div class="slide-header">
                <h1 class="slide-title">🌅 朝会用資料</h1>
                <p class="slide-date">{{ getCurrentDate() }}</p>
              </div>
              
              <div class="slide-content">
                <!-- 今日の予定 -->
                <div class="content-section">
                  <h3 class="section-title">📅 今日の予定</h3>
                  <div class="events-list" *ngIf="todayEvents.length > 0; else noEvents">
                    <div *ngFor="let event of todayEvents" class="event-item">
                      <div class="event-time">{{ formatEventTime(event) }}</div>
                      <div class="event-title">{{ event.title }}</div>
                    </div>
                  </div>
                  <ng-template #noEvents>
                    <p class="no-data">今日の予定はありません</p>
                  </ng-template>
                </div>

                <!-- 迫っている課題 -->
                <div class="content-section">
                  <h3 class="section-title">⏰ 迫っている課題</h3>
                  <div class="tasks-container" *ngIf="urgentTasks.length > 0; else noTasks">
                    <div class="tasks-list">
                      <div *ngFor="let task of urgentTasks" class="task-item">
                        <div class="task-priority" [class]="'priority-' + task.priority">
                          {{ getPriorityEmoji(task.priority) }}
                        </div>
                        <div class="task-content">
                          <div class="task-title">{{ task.title }}</div>
                          <div class="task-group" *ngIf="task.groupId">📁 {{ getGroupName(task.groupId) }}</div>
                          <div class="task-due">{{ formatTaskDue(task) }}</div>
                        </div>
                      </div>
                      <div class="remaining-tasks" *ngIf="remainingTasksCount > 0">
                        <div class="remaining-count">他{{ remainingTasksCount }}件</div>
                      </div>
                    </div>
                  </div>
                  <ng-template #noTasks>
                    <p class="no-data">迫っている課題はありません</p>
                  </ng-template>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .morning-report-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      padding: 2rem;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      background: rgba(255, 255, 255, 0.95);
      padding: 1rem 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .back-btn {
      background: #6b7280;
      color: white;
      border: none;
      padding: 0.6rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s ease;
    }

    .back-btn:hover {
      background: #4b5563;
    }

    .header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #374151;
      margin: 0;
    }

    .action-btn {
      background: #f59e0b;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .download-btn {
      background: #10b981;
    }

    .download-btn:hover {
      background: #059669;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .main-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .preview-section {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .preview-section h2 {
      margin: 0 0 1.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .slide-container {
      display: flex;
      justify-content: center;
    }

    .slide {
      width: 800px;
      height: 600px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      padding: 2rem;
      display: flex;
      flex-direction: column;
    }

    .slide-header {
      text-align: center;
      margin-bottom: 2rem;
      border-bottom: 3px solid #f59e0b;
      padding-bottom: 1rem;
    }

    .slide-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #374151;
      margin: 0 0 0.5rem 0;
    }

    .slide-date {
      font-size: 1.25rem;
      color: #6b7280;
      margin: 0;
    }

    .slide-content {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .content-section {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid #f59e0b;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 1rem 0;
    }

    .events-list, .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .tasks-container {
      max-height: 350px;
      overflow-y: auto;
      padding-bottom: 0.5rem;
    }

    .tasks-container::-webkit-scrollbar {
      width: 8px;
    }

    .tasks-container::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
      margin: 0.5rem 0;
    }

    .tasks-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .tasks-container::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .event-item, .task-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.6rem;
      background: white;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .event-time {
      font-weight: 600;
      color: #f59e0b;
      min-width: 80px;
    }

    .event-title {
      color: #374151;
      font-weight: 500;
    }

    .task-priority {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }

    .priority-urgent {
      background: #fee2e2;
      color: #dc2626;
    }

    .priority-high {
      background: #fed7aa;
      color: #ea580c;
    }

    .priority-medium {
      background: #fef3c7;
      color: #d97706;
    }

    .priority-low {
      background: #d1fae5;
      color: #059669;
    }

    .task-content {
      flex: 1;
    }

    .task-title {
      color: #374151;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .task-group {
      color: #8b5cf6;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }

    .task-due {
      color: #6b7280;
      font-size: 0.875rem;
    }

    .remaining-tasks {
      margin-top: 0.5rem;
      padding: 0.5rem;
      text-align: center;
    }

    .remaining-count {
      color: #8b5cf6;
      font-size: 0.875rem;
      font-weight: 600;
      background: rgba(139, 92, 246, 0.1);
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      display: inline-block;
    }


    .no-data {
      color: #9ca3af;
      font-style: italic;
      text-align: center;
      padding: 1rem;
    }

    .loading-state {
      text-align: center;
      padding: 3rem;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #f59e0b;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .generated-slide {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .generated-slide h2 {
      margin: 0 0 1.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .slide-actions {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .action-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .print-btn {
      background: #3b82f6;
      color: white;
    }

    .print-btn:hover {
      background: #2563eb;
    }

    .download-btn {
      background: #10b981;
      color: white;
    }

    .download-btn:hover {
      background: #059669;
    }

    .slide-output {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 2rem;
      background: white;
    }

    /* レスポンシブデザイン */
    @media (max-width: 768px) {
      .morning-report-container {
        padding: 1rem;
      }

      .header {
        flex-direction: column;
        gap: 1rem;
        padding: 1rem;
      }

      .header h1 {
        font-size: 1.5rem;
      }

      .slide {
        width: 100%;
        height: auto;
        min-height: 500px;
      }

      .slide-content {
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      .slide-title {
        font-size: 2rem;
      }
    }
  `]
})
export class MorningReportPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private todoService = inject(TodoService);
  private taskService = inject(TaskService);
  private groupService = inject(GroupService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // データ
  todayEvents: CalendarEvent[] = [];
  urgentTasks: TodoItem[] = [];
  completedTasks: TodoItem[] = [];
  userGroups: Group[] = [];
  remainingTasksCount: number = 0;

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData() {
    // 今日のTodoを取得
    this.todoService.getTodayTodos().pipe(
      takeUntil(this.destroy$)
    ).subscribe(todos => {
      this.completedTasks = todos.filter(todo => todo.isCompleted);
    });

    // ユーザーのグループを取得
    this.loadUserGroups();

    // 今日のイベントを取得（カレンダーから）
    this.loadTodayEvents();
    
    // 迫っている課題を取得（課題期限から）
    this.loadUrgentTasks();
  }

  private loadUserGroups() {
    const currentUser = this.authService.currentUser;
    if (!currentUser) return;

    this.groupService.getUserGroups(currentUser.uid).pipe(
      takeUntil(this.destroy$)
    ).subscribe(groups => {
      this.userGroups = groups;
    });
  }

  private loadTodayEvents() {
    // 今日のカレンダーイベントを取得（インデックス回避）
    const currentUser = this.authService.currentUser;
    if (!currentUser) return;

    // シンプルなクエリでユーザーのイベントを取得
    const personalEventsQuery = query(
      collection(this.firestore, 'calendarEvents'),
      where('userId', '==', currentUser.uid)
    );

    collectionData(personalEventsQuery, { idField: 'id' }).pipe(
      takeUntil(this.destroy$)
    ).subscribe(events => {
      // クライアント側で今日のイベントをフィルタリング
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      
      this.todayEvents = (events as CalendarEvent[]).filter(event => {
        const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
        return eventDate >= startOfDay && eventDate <= endOfDay;
      });
    });
  }

  private loadUrgentTasks() {
    // 迫っている課題を取得（課題期限から、インデックス回避）
    const currentUser = this.authService.currentUser;
    if (!currentUser) return;

    // ユーザーのグループを取得
    this.groupService.getUserGroups(currentUser.uid).pipe(
      takeUntil(this.destroy$)
    ).subscribe(groups => {
      if (groups.length === 0) return;

      const groupIds = groups.map(g => g.id);
      const today = new Date();

      // シンプルなクエリで課題を取得
      const tasksQuery = query(
        collection(this.firestore, 'tasks'),
        where('groupId', 'in', groupIds.slice(0, 10)), // Firestoreの制限
        where('assigneeId', '==', currentUser.uid)
      );

          collectionData(tasksQuery, { idField: 'id' }).pipe(
            takeUntil(this.destroy$)
          ).subscribe(tasks => {
              // クライアント側でフィルタリング（3日以内）
              const next3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
              
              const filteredTasks = tasks.filter(task => {
                const status = task['status'];
                const dueDate = task['dueDate'];
                
                if (status === 'completed') return false;
                if (!dueDate) return false;
                
                const due = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
                return due >= today && due <= next3Days;
              });

        // 課題をTodoItem形式に変換し、期限順にソート
        const allTasks = filteredTasks.map(task => ({
          id: task.id,
          title: task['title'],
          description: task['description'] || '',
          type: 'task' as const,
          priority: this.getTaskPriority(task['dueDate'], today),
          isCompleted: false,
          dueDate: task['dueDate'], // 期限日付を追加
          groupId: task['groupId'], // グループIDを追加
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        // 期限順にソート（早い順）
        allTasks.sort((a, b) => {
          const aDate = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
          const bDate = b.dueDate?.toDate ? b.dueDate.toDate() : new Date(b.dueDate);
          return aDate.getTime() - bDate.getTime();
        });

        // 最大5件に制限
        this.urgentTasks = allTasks.slice(0, 5);
        this.remainingTasksCount = Math.max(0, allTasks.length - 5);
      });
    });
  }

  private getTaskPriority(dueDate: any, today: Date): 'low' | 'medium' | 'high' | 'urgent' {
    if (!dueDate) return 'medium';
    
    const due = dueDate.toDate ? dueDate.toDate() : new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return 'urgent';
    if (diffDays <= 3) return 'high';
    if (diffDays <= 7) return 'medium';
    return 'low';
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  formatEventTime(event: CalendarEvent): string {
    const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    return start.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  formatTaskDue(task: TodoItem): string {
    if (!task.dueDate) return '期限なし';
    const due = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    
    // 日付のみで比較（時間を無視）
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return '今日';
    } else if (diffDays === 1) {
      return '明日';
    } else if (diffDays < 0) {
      return `${Math.abs(diffDays)}日前`;
    } else {
      return `${diffDays}日後 (${due.toLocaleDateString('ja-JP', { 
        month: 'short', 
        day: 'numeric' 
      })})`;
    }
  }

  getPriorityEmoji(priority: string): string {
    const emojis = {
      urgent: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return emojis[priority as keyof typeof emojis] || '⚪';
  }

  getGroupName(groupId: string): string {
    const group = this.userGroups.find(g => g.id === groupId);
    return group?.name || '不明なグループ';
  }

  downloadReport() {
    const reportContent = this.createReportHtml();
    const blob = new Blob([reportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `朝会用資料_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private createReportHtml(): string {
    return `
      <html>
        <head>
          <title>朝会用資料</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
            .slide { width: 800px; height: 600px; background: white; padding: 2rem; }
            .slide-header { text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #f59e0b; padding-bottom: 1rem; }
            .slide-title { font-size: 2.5rem; color: #374151; margin: 0 0 0.5rem 0; }
            .slide-date { font-size: 1.25rem; color: #6b7280; margin: 0; }
            .slide-content { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; height: calc(100% - 120px); }
            .content-section { background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #f59e0b; }
            .section-title { font-size: 1.25rem; color: #374151; margin: 0 0 1rem 0; }
            .event-item, .task-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 6px; margin-bottom: 0.5rem; }
            .event-time { font-weight: 600; color: #f59e0b; min-width: 80px; }
            .task-priority { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
            .priority-urgent { background: #fee2e2; color: #dc2626; }
            .priority-high { background: #fed7aa; color: #ea580c; }
            .priority-medium { background: #fef3c7; color: #d97706; }
            .priority-low { background: #d1fae5; color: #059669; }
            .task-content { flex: 1; }
            .task-title { color: #374151; font-weight: 500; margin-bottom: 0.25rem; }
            .task-group { color: #8b5cf6; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.25rem; }
            .task-due { color: #6b7280; font-size: 0.875rem; }
            .remaining-tasks { margin-top: 0.5rem; padding: 0.5rem; text-align: center; }
            .remaining-count { color: #8b5cf6; font-size: 0.875rem; font-weight: 600; background: rgba(139, 92, 246, 0.1); padding: 0.25rem 0.75rem; border-radius: 12px; display: inline-block; }
            .no-data { color: #9ca3af; font-style: italic; text-align: center; padding: 1rem; }
          </style>
        </head>
        <body>
          <div class="slide">
            <div class="slide-header">
              <h1 class="slide-title">🌅 朝会用資料</h1>
              <p class="slide-date">${this.getCurrentDate()}</p>
            </div>
            
            <div class="slide-content">
              <div class="content-section">
                <h3 class="section-title">📅 今日の予定</h3>
                ${this.todayEvents.length > 0 ? 
                  this.todayEvents.map(event => `
                    <div class="event-item">
                      <div class="event-time">${this.formatEventTime(event)}</div>
                      <div>${event.title}</div>
                    </div>
                  `).join('') : 
                  '<p class="no-data">今日の予定はありません</p>'
                }
              </div>
              
              <div class="content-section">
                <h3 class="section-title">⏰ 迫っている課題</h3>
                ${this.urgentTasks.length > 0 ? 
                  this.urgentTasks.map(task => `
                    <div class="task-item">
                      <div class="task-priority priority-${task.priority}">${this.getPriorityEmoji(task.priority)}</div>
                      <div class="task-content">
                        <div class="task-title">${task.title}</div>
                        ${task.groupId ? `<div class="task-group">📁 ${this.getGroupName(task.groupId)}</div>` : ''}
                        <div class="task-due">${this.formatTaskDue(task)}</div>
                      </div>
                    </div>
                  `).join('') + (this.remainingTasksCount > 0 ? `
                    <div class="remaining-tasks">
                      <div class="remaining-count">他${this.remainingTasksCount}件</div>
                    </div>
                  ` : '') : 
                  '<p class="no-data">迫っている課題はありません</p>'
                }
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  goBack() {
    this.router.navigate(['/documents']);
  }
}

