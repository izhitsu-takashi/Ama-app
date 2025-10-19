import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { Group, TaskItem } from './models';
import { Observable, Subscription, combineLatest, of, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="tasks-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>📋 課題一覧</h1>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- フィルター -->
        <div class="filter-section">
          <div class="filter-group">
            <label>グループ:</label>
            <select [(ngModel)]="selectedGroupId" (change)="filterTasks()">
              <option value="">すべてのグループ</option>
              <option *ngFor="let group of userGroups" [value]="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>ステータス:</label>
            <select [(ngModel)]="selectedStatus" (change)="filterTasks()">
              <option value="">すべて</option>
              <option value="not_started">未着手</option>
              <option value="in_progress">進行中</option>
              <option value="completed">完了</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>優先度:</label>
            <select [(ngModel)]="selectedPriority" (change)="filterTasks()">
              <option value="">すべて</option>
              <option value="urgent">緊急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>

        <!-- 課題一覧 -->
        <div class="tasks-list" *ngIf="filteredTasks.length > 0; else noTasks">
          <div *ngFor="let task of filteredTasks" class="task-item" (click)="openTask(task)">
            <div class="task-header">
              <h3 class="task-title">{{ task.title }}</h3>
              <div class="task-meta">
                <span class="priority-badge" [class]="'priority-' + task.priority">
                  {{ getPriorityLabel(task.priority) }}
                </span>
                <span class="status-badge" [class]="'status-' + task.status">
                  {{ getStatusLabel(task.status) }}
                </span>
              </div>
            </div>
            
            <div class="task-content" *ngIf="task.content">
              <p>{{ task.content }}</p>
            </div>
            
            <div class="task-footer">
              <div class="task-info">
                <span class="group-name">📁 {{ getGroupName(task.groupId) }}</span>
                <span class="assignee" *ngIf="task.assigneeId">👤 {{ getAssigneeName(task.assigneeId) }}</span>
                <span class="due-date" *ngIf="task.dueDate">
                  ⏰ {{ formatDate(task.dueDate) }}
                </span>
              </div>
              
              <div class="task-progress" *ngIf="task.progress !== undefined">
                <div class="progress-bar">
                  <div class="progress-fill" [style.width.%]="task.progress"></div>
                </div>
                <span class="progress-text">{{ task.progress }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 課題なし -->
        <ng-template #noTasks>
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3>課題がありません</h3>
            <p>新しい課題を作成するか、グループに参加してください</p>
            <button class="btn primary" routerLink="/groups">グループ一覧</button>
          </div>
        </ng-template>
      </main>
    </div>
  `,
  styles: [`
    .tasks-container {
      min-height: 100vh;
      background: #f8fafc;
    }

    .header {
      background: white;
      padding: 1rem 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
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
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
    }

    .back-btn:hover {
      background: #4b5563;
    }

    .header h1 {
      margin: 0;
      color: #1f2937;
      font-size: 1.5rem;
    }


    .main-content {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .filter-section {
      background: white;
      padding: 1.5rem;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
    }

    .filter-group select {
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      font-size: 0.875rem;
    }

    .tasks-list {
      display: grid;
      gap: 1rem;
    }

    .task-item {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .task-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .task-title {
      margin: 0;
      color: #1f2937;
      font-size: 1.125rem;
      font-weight: 600;
      flex: 1;
    }

    .task-meta {
      display: flex;
      gap: 0.5rem;
    }

    .priority-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .priority-urgent {
      background: #fef2f2;
      color: #dc2626;
    }

    .priority-high {
      background: #fff7ed;
      color: #ea580c;
    }

    .priority-medium {
      background: #fefce8;
      color: #ca8a04;
    }

    .priority-low {
      background: #f0fdf4;
      color: #16a34a;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-not_started {
      background: #f3f4f6;
      color: #6b7280;
    }

    .status-in_progress {
      background: #dbeafe;
      color: #2563eb;
    }

    .status-completed {
      background: #dcfce7;
      color: #16a34a;
    }

    .task-content {
      margin-bottom: 1rem;
    }

    .task-content p {
      margin: 0;
      color: #6b7280;
      line-height: 1.5;
    }

    .task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .task-info {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .task-info span {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .task-progress {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .progress-bar {
      width: 100px;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 0.75rem;
      color: #6b7280;
      font-weight: 600;
    }

    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .empty-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-state h3 {
      margin: 0 0 0.5rem 0;
      color: #1f2937;
    }

    .empty-state p {
      margin: 0 0 2rem 0;
      color: #6b7280;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s ease;
    }

    .btn.primary {
      background: #3b82f6;
      color: white;
    }

    .btn.primary:hover {
      background: #2563eb;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }

      .filter-section {
        flex-direction: column;
        gap: 1rem;
      }

      .task-header {
        flex-direction: column;
        gap: 0.5rem;
      }

      .task-footer {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `]
})
export class TasksPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  currentUser: any = null;
  userGroups: Group[] = [];
  allTasks: TaskItem[] = [];
  filteredTasks: TaskItem[] = [];
  
  // フィルター
  selectedGroupId = '';
  selectedStatus = '';
  selectedPriority = '';

  ngOnInit() {
    this.loadUserData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserData() {
    this.currentUser = this.authService.currentUser;
    if (this.currentUser) {
      this.loadGroups();
    }
  }

  private loadGroups() {
    if (this.currentUser) {
      this.groupService.getUserGroups(this.currentUser.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(groups => {
        this.userGroups = groups;
        this.loadTasks();
      });
    }
  }

  private loadTasks() {
    if (this.userGroups.length === 0) return;

    const groupIds = this.userGroups.map(g => g.id);
    const taskObservables = groupIds.map(groupId => 
      this.taskService.getTasksByGroup(groupId)
    );

    combineLatest(taskObservables).pipe(
      takeUntil(this.destroy$)
    ).subscribe(taskArrays => {
      this.allTasks = taskArrays.flat();
      this.filterTasks();
    });
  }

  filterTasks() {
    this.filteredTasks = this.allTasks.filter(task => {
      const groupMatch = !this.selectedGroupId || task.groupId === this.selectedGroupId;
      const statusMatch = !this.selectedStatus || task.status === this.selectedStatus;
      const priorityMatch = !this.selectedPriority || task.priority === this.selectedPriority;
      
      return groupMatch && statusMatch && priorityMatch;
    });
  }

  getPriorityLabel(priority: string): string {
    const labels = {
      urgent: '緊急',
      high: '高',
      medium: '中',
      low: '低'
    };
    return labels[priority as keyof typeof labels] || priority;
  }

  getStatusLabel(status: string): string {
    const labels = {
      not_started: '未着手',
      in_progress: '進行中',
      completed: '完了'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getGroupName(groupId: string): string {
    const group = this.userGroups.find(g => g.id === groupId);
    return group?.name || '不明なグループ';
  }

  getAssigneeName(assigneeId: string): string {
    // 簡易実装 - 実際にはUserServiceから取得
    return 'ユーザー';
  }

  formatDate(date: any): string {
    if (!date) return '';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openTask(task: TaskItem) {
    this.router.navigate(['/group', task.groupId]);
  }

  goBack() {
    this.router.navigate(['/main']);
  }

}
