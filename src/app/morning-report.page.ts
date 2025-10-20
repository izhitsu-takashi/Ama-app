import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { TodoService } from './todo.service';
import { TodoItem, CalendarEvent } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

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
          <button class="generate-btn" (click)="generateSlide()" [disabled]="loading">
            <span *ngIf="!loading">📄 スライド生成</span>
            <span *ngIf="loading">生成中...</span>
          </button>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- プレビューエリア -->
        <div class="preview-section">
          <h2>資料プレビュー</h2>
          <div class="slide-container" *ngIf="!loading">
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
                  <div class="tasks-list" *ngIf="urgentTasks.length > 0; else noTasks">
                    <div *ngFor="let task of urgentTasks" class="task-item">
                      <div class="task-priority" [class]="'priority-' + task.priority">
                        {{ getPriorityEmoji(task.priority) }}
                      </div>
                      <div class="task-content">
                        <div class="task-title">{{ task.title }}</div>
                        <div class="task-due">{{ formatTaskDue(task) }}</div>
                      </div>
                    </div>
                  </div>
                  <ng-template #noTasks>
                    <p class="no-data">迫っている課題はありません</p>
                  </ng-template>
                </div>

                <!-- 進捗サマリー -->
                <div class="content-section">
                  <h3 class="section-title">📊 進捗サマリー</h3>
                  <div class="progress-summary">
                    <div class="progress-item">
                      <span class="progress-label">今日の予定</span>
                      <span class="progress-value">{{ todayEvents.length }}件</span>
                    </div>
                    <div class="progress-item">
                      <span class="progress-label">緊急課題</span>
                      <span class="progress-value">{{ urgentTasks.length }}件</span>
                    </div>
                    <div class="progress-item">
                      <span class="progress-label">完了済み</span>
                      <span class="progress-value">{{ completedTasks.length }}件</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div *ngIf="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <p>資料を生成中...</p>
          </div>
        </div>

        <!-- 生成されたスライド -->
        <div class="generated-slide" *ngIf="generatedSlideHtml">
          <h2>生成されたスライド</h2>
          <div class="slide-actions">
            <button class="action-btn print-btn" (click)="printSlide()">🖨️ 印刷</button>
            <button class="action-btn download-btn" (click)="downloadSlide()">💾 ダウンロード</button>
          </div>
          <div class="slide-output" [innerHTML]="generatedSlideHtml"></div>
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

    .generate-btn {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .generate-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .generate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
      gap: 0.75rem;
    }

    .event-item, .task-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
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

    .task-due {
      color: #6b7280;
      font-size: 0.875rem;
    }

    .progress-summary {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .progress-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: white;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .progress-label {
      color: #6b7280;
      font-weight: 500;
    }

    .progress-value {
      color: #374151;
      font-weight: 600;
      font-size: 1.125rem;
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
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // データ
  todayEvents: CalendarEvent[] = [];
  urgentTasks: TodoItem[] = [];
  completedTasks: TodoItem[] = [];
  loading = false;
  generatedSlideHtml = '';

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
      this.urgentTasks = todos.filter(todo => 
        (todo.type === 'task' || todo.type === 'deadline') && 
        todo.priority === 'urgent' && 
        !todo.isCompleted
      );
      this.completedTasks = todos.filter(todo => todo.isCompleted);
    });

    // 今日のイベントを取得（簡易版）
    this.todayEvents = [
      {
        id: '1',
        title: '朝会',
        description: 'チーム朝会',
        startDate: new Date(),
        endDate: new Date(),
        type: 'personal',
        userId: 'current-user',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
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
    return due.toLocaleDateString('ja-JP', { 
      month: 'short', 
      day: 'numeric' 
    });
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

  generateSlide() {
    this.loading = true;
    
    // スライド生成のシミュレーション
    setTimeout(() => {
      this.generatedSlideHtml = this.createSlideHtml();
      this.loading = false;
    }, 2000);
  }

  private createSlideHtml(): string {
    return `
      <div style="width: 800px; height: 600px; background: white; padding: 2rem; font-family: 'Segoe UI', sans-serif;">
        <div style="text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #f59e0b; padding-bottom: 1rem;">
          <h1 style="font-size: 2.5rem; color: #374151; margin: 0 0 0.5rem 0;">🌅 朝会用資料</h1>
          <p style="font-size: 1.25rem; color: #6b7280; margin: 0;">${this.getCurrentDate()}</p>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; height: calc(100% - 120px);">
          <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="font-size: 1.25rem; color: #374151; margin: 0 0 1rem 0;">📅 今日の予定</h3>
            ${this.todayEvents.length > 0 ? 
              this.todayEvents.map(event => `
                <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 6px; margin-bottom: 0.5rem;">
                  <div style="font-weight: 600; color: #f59e0b; min-width: 80px;">${this.formatEventTime(event)}</div>
                  <div style="color: #374151; font-weight: 500;">${event.title}</div>
                </div>
              `).join('') : 
              '<p style="color: #9ca3af; font-style: italic; text-align: center; padding: 1rem;">今日の予定はありません</p>'
            }
          </div>
          
          <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <h3 style="font-size: 1.25rem; color: #374151; margin: 0 0 1rem 0;">⏰ 迫っている課題</h3>
            ${this.urgentTasks.length > 0 ? 
              this.urgentTasks.map(task => `
                <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 6px; margin-bottom: 0.5rem;">
                  <div style="width: 32px; height: 32px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">${this.getPriorityEmoji(task.priority)}</div>
                  <div style="flex: 1;">
                    <div style="color: #374151; font-weight: 500; margin-bottom: 0.25rem;">${task.title}</div>
                    <div style="color: #6b7280; font-size: 0.875rem;">${this.formatTaskDue(task)}</div>
                  </div>
                </div>
              `).join('') : 
              '<p style="color: #9ca3af; font-style: italic; text-align: center; padding: 1rem;">迫っている課題はありません</p>'
            }
          </div>
        </div>
      </div>
    `;
  }

  printSlide() {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>朝会用資料</title>
            <style>
              body { margin: 0; padding: 0; }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${this.generatedSlideHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }

  downloadSlide() {
    const blob = new Blob([this.generatedSlideHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `朝会用資料_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  goBack() {
    this.router.navigate(['/documents']);
  }
}

