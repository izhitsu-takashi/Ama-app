import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { Group, TaskItem, User } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-group-report',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="group-report-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">← 戻る</button>
          <h1>👥 グループ資料作成</h1>
        </div>
        <div class="header-right">
          <button class="generate-btn" (click)="generateSlide()" [disabled]="loading || !selectedGroup">
            <span *ngIf="!loading">📄 スライド生成</span>
            <span *ngIf="loading">生成中...</span>
          </button>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- グループ選択 -->
        <div class="group-selection">
          <h2>グループ選択</h2>
          <div class="selection-area">
            <select [(ngModel)]="selectedGroupId" (change)="onGroupChange()" class="group-select">
              <option value="">グループを選択してください</option>
              <option *ngFor="let group of userGroups" [value]="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- プレビューエリア -->
        <div class="preview-section" *ngIf="selectedGroup">
          <h2>資料プレビュー</h2>
          <div class="slide-container" *ngIf="!loading">
            <div class="slide">
              <div class="slide-header">
                <h1 class="slide-title">👥 グループ進捗資料</h1>
                <p class="slide-subtitle">{{ selectedGroup.name }}</p>
                <p class="slide-date">{{ getCurrentDate() }}</p>
              </div>
              
              <div class="slide-content">
                <!-- グループ概要 -->
                <div class="content-section overview-section">
                  <h3 class="section-title">📊 グループ概要</h3>
                  <div class="overview-grid">
                    <div class="overview-item">
                      <div class="overview-value">{{ selectedGroup.memberIds.length }}</div>
                      <div class="overview-label">メンバー数</div>
                    </div>
                    <div class="overview-item">
                      <div class="overview-value">{{ groupTasks.length }}</div>
                      <div class="overview-label">総タスク数</div>
                    </div>
                    <div class="overview-item">
                      <div class="overview-value">{{ completedTasks.length }}</div>
                      <div class="overview-label">完了済み</div>
                    </div>
                    <div class="overview-item">
                      <div class="overview-value">{{ getProgressPercentage() }}%</div>
                      <div class="overview-label">進捗率</div>
                    </div>
                  </div>
                </div>

                <!-- 左側: タスク状況と期限管理 -->
                <div class="left-column">
                  <!-- タスク状況 -->
                  <div class="content-section">
                    <h3 class="section-title">📋 タスク状況</h3>
                    <div class="task-stats">
                      <div class="stat-item">
                        <span class="stat-label">未着手:</span>
                        <span class="stat-value not-started">{{ getTaskCountByStatus('not_started') }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">進行中:</span>
                        <span class="stat-value in-progress">{{ getTaskCountByStatus('in_progress') }}</span>
                      </div>
                      <div class="stat-item">
                        <span class="stat-label">完了:</span>
                        <span class="stat-value completed">{{ getTaskCountByStatus('completed') }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 期限管理 -->
                  <div class="content-section">
                    <h3 class="section-title">⏰ 期限管理</h3>
                    <div class="deadline-stats">
                      <div class="deadline-item urgent">
                        <span class="deadline-label">緊急（今日まで）:</span>
                        <span class="deadline-value">{{ getUrgentTasks().length }}</span>
                      </div>
                      <div class="deadline-item warning">
                        <span class="deadline-label">注意（3日以内）:</span>
                        <span class="deadline-value">{{ getWarningTasks().length }}</span>
                      </div>
                      <div class="deadline-item normal">
                        <span class="deadline-label">正常:</span>
                        <span class="deadline-value">{{ getNormalTasks().length }}</span>
                      </div>
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
    .group-report-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
      background: linear-gradient(135deg, #10b981, #059669);
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
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .generate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .main-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .group-selection {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 2rem;
    }

    .group-selection h2 {
      margin: 0 0 1.5rem 0;
      color: #374151;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .group-select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 1rem;
      background: white;
      cursor: pointer;
    }

    .group-select:focus {
      border-color: #10b981;
      outline: none;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
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
      width: 1000px;
      height: 750px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      padding: 2rem;
      display: flex;
      flex-direction: column;
    }

    .slide-header {
      text-align: center;
      margin-bottom: 1.5rem;
      border-bottom: 3px solid #10b981;
      padding-bottom: 1rem;
    }

    .slide-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #374151;
      margin: 0 0 0.5rem 0;
    }

    .slide-subtitle {
      font-size: 1.5rem;
      color: #10b981;
      margin: 0 0 0.5rem 0;
      font-weight: 600;
    }

    .slide-date {
      font-size: 1.25rem;
      color: #6b7280;
      margin: 0;
    }

    .slide-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-height: 0;
    }

    .left-column {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .content-section {
      background: #f9fafb;
      padding: 1.5rem;
      border-radius: 8px;
      border-left: 4px solid #10b981;
      height: fit-content;
      display: flex;
      flex-direction: column;
    }

    .overview-section {
      grid-column: 1 / -1;
      margin-bottom: 0.5rem;
    }

    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #374151;
      margin: 0 0 0.75rem 0;
    }

    .overview-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
    }

    .overview-item {
      text-align: center;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .overview-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #10b981;
      margin-bottom: 0.5rem;
    }

    .overview-label {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    }

    .task-stats, .deadline-stats {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      flex: 1;
    }

    .stat-item, .deadline-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: white;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .stat-label, .deadline-label {
      color: #6b7280;
      font-weight: 500;
    }

    .stat-value, .deadline-value {
      font-weight: 600;
      font-size: 1rem;
    }

    .stat-value.not-started { color: #6b7280; }
    .stat-value.in-progress { color: #3b82f6; }
    .stat-value.completed { color: #10b981; }

    .deadline-item.urgent .deadline-value { color: #dc2626; }
    .deadline-item.warning .deadline-value { color: #f59e0b; }
    .deadline-item.normal .deadline-value { color: #10b981; }



    .loading-state {
      text-align: center;
      padding: 3rem;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e5e7eb;
      border-top: 4px solid #10b981;
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
      .group-report-container {
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
        min-height: 650px;
      }

      .slide-content {
        gap: 1rem;
      }

      .left-column {
        grid-template-columns: 1fr;
        gap: 1rem;
      }

      .overview-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }

      .slide-title {
        font-size: 2rem;
      }
    }
  `]
})
export class GroupReportPage implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // データ
  userGroups: Group[] = [];
  selectedGroup: Group | null = null;
  selectedGroupId = '';
  groupTasks: TaskItem[] = [];
  completedTasks: TaskItem[] = [];
  allUsers: User[] = [];
  loading = false;
  generatedSlideHtml = '';

  ngOnInit() {
    this.loadUserGroups();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserGroups() {
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.groupService.getUserGroups(currentUser.uid).pipe(
        takeUntil(this.destroy$)
      ).subscribe(groups => {
        this.userGroups = groups;
      });
    }
  }

  onGroupChange() {
    if (this.selectedGroupId) {
      this.selectedGroup = this.userGroups.find(g => g.id === this.selectedGroupId) || null;
      if (this.selectedGroup) {
        this.loadGroupTasks();
      }
    } else {
      this.selectedGroup = null;
      this.groupTasks = [];
    }
  }

  private loadGroupTasks() {
    if (!this.selectedGroup) return;

    this.taskService.getGroupTasks(this.selectedGroup.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe(tasks => {
      this.groupTasks = tasks;
      this.completedTasks = tasks.filter(task => task.status === 'completed');
    });
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  }

  getProgressPercentage(): number {
    if (this.groupTasks.length === 0) return 0;
    return Math.round((this.completedTasks.length / this.groupTasks.length) * 100);
  }

  getTaskCountByStatus(status: string): number {
    return this.groupTasks.filter(task => task.status === status).length;
  }

  getUrgentTasks(): TaskItem[] {
    const today = new Date();
    return this.groupTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate <= today && task.status !== 'completed';
    });
  }

  getWarningTasks(): TaskItem[] {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    return this.groupTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate > today && dueDate <= threeDaysFromNow && task.status !== 'completed';
    });
  }

  getNormalTasks(): TaskItem[] {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    return this.groupTasks.filter(task => {
      if (!task.dueDate) return true;
      const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      return dueDate > threeDaysFromNow && task.status !== 'completed';
    });
  }

  getMemberName(memberId: string): string {
    // 簡易版：実際の実装ではUserServiceから取得
    return `ユーザー${memberId.slice(-4)}`;
  }

  getMemberTaskCount(memberId: string): number {
    return this.groupTasks.filter(task => task.assigneeId === memberId).length;
  }

  getMemberProgress(memberId: string): number {
    const memberTasks = this.groupTasks.filter(task => task.assigneeId === memberId);
    if (memberTasks.length === 0) return 0;
    const completed = memberTasks.filter(task => task.status === 'completed').length;
    return Math.round((completed / memberTasks.length) * 100);
  }



  generateSlide() {
    if (!this.selectedGroup) return;
    
    this.loading = true;
    
    // スライド生成のシミュレーション
    setTimeout(() => {
      this.generatedSlideHtml = this.createSlideHtml();
      this.loading = false;
    }, 2000);
  }

  private createSlideHtml(): string {
    if (!this.selectedGroup) return '';

    return `
      <div style="width: 800px; height: 600px; background: white; padding: 2rem; font-family: 'Segoe UI', sans-serif;">
        <div style="text-align: center; margin-bottom: 2rem; border-bottom: 3px solid #10b981; padding-bottom: 1rem;">
          <h1 style="font-size: 2.5rem; color: #374151; margin: 0 0 0.5rem 0;">👥 グループ進捗資料</h1>
          <p style="font-size: 1.5rem; color: #10b981; margin: 0 0 0.5rem 0; font-weight: 600;">${this.selectedGroup.name}</p>
          <p style="font-size: 1.25rem; color: #6b7280; margin: 0;">${this.getCurrentDate()}</p>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1rem; height: calc(100% - 120px);">
          <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #10b981;">
            <h3 style="font-size: 1.1rem; color: #374151; margin: 0 0 0.75rem 0;">📊 グループ概要</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
              <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px;">
                <div style="font-size: 1.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">${this.selectedGroup.memberIds.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">メンバー数</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px;">
                <div style="font-size: 1.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">${this.groupTasks.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">総タスク数</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px;">
                <div style="font-size: 1.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">${this.completedTasks.length}</div>
                <div style="font-size: 0.875rem; color: #6b7280;">完了済み</div>
              </div>
              <div style="text-align: center; padding: 1rem; background: white; border-radius: 8px;">
                <div style="font-size: 1.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.5rem;">${this.getProgressPercentage()}%</div>
                <div style="font-size: 0.875rem; color: #6b7280;">進捗率</div>
              </div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
            <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #10b981;">
              <h3 style="font-size: 1.1rem; color: #374151; margin: 0 0 0.75rem 0;">📋 タスク状況</h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">未着手:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #6b7280;">${this.getTaskCountByStatus('not_started')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">進行中:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #3b82f6;">${this.getTaskCountByStatus('in_progress')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">完了:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #10b981;">${this.getTaskCountByStatus('completed')}</span>
                </div>
              </div>
            </div>
            
            <div style="background: #f9fafb; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #10b981;">
              <h3 style="font-size: 1.1rem; color: #374151; margin: 0 0 0.75rem 0;">⏰ 期限管理</h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">緊急（今日まで）:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #dc2626;">${this.getUrgentTasks().length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">注意（3日以内）:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #f59e0b;">${this.getWarningTasks().length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: white; border-radius: 6px;">
                  <span style="color: #6b7280; font-weight: 500;">正常:</span>
                  <span style="font-weight: 600; font-size: 1rem; color: #10b981;">${this.getNormalTasks().length}</span>
                </div>
              </div>
            </div>
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
            <title>グループ進捗資料</title>
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
    a.download = `グループ進捗資料_${this.selectedGroup?.name}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  goBack() {
    this.router.navigate(['/documents']);
  }
}
