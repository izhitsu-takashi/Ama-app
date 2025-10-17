import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { JoinRequestService } from './join-request.service';
import { MilestoneService } from './milestone.service';
import { Group, TaskItem, GroupMembership, JoinRequest, Milestone } from './models';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, map, switchMap, take } from 'rxjs/operators';

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <div class="header-content">
          <h1 class="group-title">{{ group?.name }}</h1>
          <p class="group-description" *ngIf="group?.description">{{ group?.description }}</p>
        </div>
        <div class="header-actions">
          <button 
            class="btn btn-secondary" 
            (click)="toggleMembers()"
          >
            <span class="btn-icon">👥</span>
            メンバー
          </button>
          <button 
            class="btn btn-secondary" 
            (click)="viewGroupMilestones()"
          >
            <span class="btn-icon">🎯</span>
            マイルストーン
            <span *ngIf="(groupMilestones$ | async)?.length" class="milestone-count">
              {{ (groupMilestones$ | async)?.length }}
            </span>
          </button>
          <button 
            *ngIf="isGroupOwner" 
            class="btn btn-secondary" 
            (click)="toggleJoinRequests()"
          >
            <span class="btn-icon">📝</span>
            参加リクエスト
            <span *ngIf="(joinRequests$ | async)?.length" class="request-count">
              {{ (joinRequests$ | async)?.length }}
            </span>
          </button>
          <button class="btn btn-primary" (click)="showCreateTaskModal()">
            <span class="btn-icon">+</span>
            課題を作成
          </button>
        </div>
      </div>

      

      <!-- メンバー一覧 -->
      <div class="members-section" *ngIf="showMembers">
        <div class="section-header">
          <h2 class="section-title">メンバー一覧</h2>
          <button class="close-btn" (click)="showMembers = false">×</button>
        </div>
        
        <div class="members-list" *ngIf="(members$ | async) as members; else noMembers">
          <div class="member-item" *ngFor="let member of members">
            <div class="member-info">
              <div class="member-avatar">
                <span class="avatar-text">{{ getMemberInitial(getMemberDisplayName(member.userId, member.userName, member.userEmail)) }}</span>
              </div>
              <div class="member-details">
                <h4 class="member-name">{{ getMemberDisplayName(member.userId, member.userName, member.userEmail) }}</h4>
                <p class="member-email">{{ member.userEmail }}</p>
                <span class="member-role" [class]="member.role">
                  {{ getRoleLabel(member.role) }}
                </span>
              </div>
            </div>
            <div class="member-meta">
              <span class="join-date">参加日: {{ formatDate(member.joinedAt) }}</span>
            </div>
          </div>
        </div>
        
        <ng-template #noMembers>
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">メンバーがいません</h3>
            <p class="empty-description">グループにメンバーが参加するとここに表示されます</p>
          </div>
        </ng-template>
      </div>

      <!-- 参加リクエスト管理 -->
      <div class="join-requests-section" *ngIf="showJoinRequests && isGroupOwner">
        <div class="section-header">
          <h2 class="section-title">参加リクエスト</h2>
          <button class="close-btn" (click)="showJoinRequests = false">×</button>
        </div>
        
        <div class="join-requests-list" *ngIf="(joinRequests$ | async) as requests; else noJoinRequests">
          <div class="join-request-item" *ngFor="let request of requests">
            <div class="request-info">
              <div class="request-header">
                <h4 class="request-user">{{ request.userName }}</h4>
                <span class="request-date">{{ formatDate(request.createdAt) }}</span>
              </div>
              <p class="request-email">{{ request.userEmail }}</p>
            </div>
            <div class="request-actions">
              <button class="btn btn-success" (click)="approveJoinRequest(request.id!)">
                <span class="btn-icon">✓</span>
                承認
              </button>
              <button class="btn btn-danger" (click)="rejectJoinRequest(request.id!)">
                <span class="btn-icon">✗</span>
                拒否
              </button>
            </div>
          </div>
        </div>
        
        <ng-template #noJoinRequests>
          <div class="empty-state">
            <div class="empty-icon">👥</div>
            <h3 class="empty-title">参加リクエストがありません</h3>
            <p class="empty-description">グループへの参加リクエストが届くとここに表示されます</p>
          </div>
        </ng-template>
      </div>

      <!-- 課題一覧 -->
      <div class="tasks-section">
        <div class="tasks-header">
          <div class="tasks-header-left">
            <h2 class="section-title">課題一覧</h2>
            <div class="tasks-stats">
              <span class="stat-item">
                <span class="stat-label">課題数:</span>
                <span class="stat-value">{{ (tasks$ | async)?.length || 0 }}件</span>
              </span>
              <span class="stat-item">
                <span class="stat-label">完了率:</span>
                <span class="stat-value">{{ getCompletionRate() }}%</span>
              </span>
            <span class="stat-item">
              <span class="stat-label">未着手:</span>
              <span class="stat-value">{{ getTaskCount('not_started') }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">実行中:</span>
              <span class="stat-value">{{ getTaskCount('in_progress') }}</span>
            </span>
            <span class="stat-item">
              <span class="stat-label">完了:</span>
              <span class="stat-value">{{ getTaskCount('completed') }}</span>
            </span>
            </div>
          </div>
          <div class="tasks-filters">
            <select class="filter-select" [(ngModel)]="statusFilter" (change)="applyFilters()">
              <option value="">ステータス: すべて</option>
              <option value="not_started">未着手</option>
              <option value="in_progress">実行中</option>
              <option value="completed">完了</option>
            </select>
            <select class="filter-select" [(ngModel)]="priorityFilter" (change)="applyFilters()">
              <option value="">優先度: すべて</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">緊急</option>
            </select>
            <select class="filter-select" [(ngModel)]="assigneeFilter" (change)="applyFilters()">
              <option value="">担当者: すべて</option>
              <option *ngFor="let member of (members$ | async)" [value]="member.userId">
                {{ member.userName || member.userEmail || 'ユーザー' }}
              </option>
            </select>
            <button class="btn btn-secondary" (click)="clearFilters()">クリア</button>
          </div>
        </div>

        <div class="tasks-table-container" *ngIf="(tasks$ | async) as tasks; else emptyTasks">
          <table class="tasks-table">
            <thead>
              <tr>
                <th>タイトル</th>
                <th>発生日</th>
                <th>期限</th>
                <th>担当者</th>
                <th>優先度</th>
                <th>進捗</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks" class="task-row" [class]="'priority-' + task.priority">
                <td class="task-title-cell">
                  <div class="task-title">{{ task.title }}</div>
                  <div class="task-content" *ngIf="task.content">{{ task.content }}</div>
                </td>
                <td class="task-date-cell">
                  {{ formatDate(task.occurredOn) }}
                </td>
                <td class="task-due-cell" [class.due-soon]="isDueSoon(task.dueDate)" [class.overdue]="isOverdue(task.dueDate)">
                  {{ formatDate(task.dueDate) }}
                </td>
                <td class="task-assignee-cell">
                  {{ getAssigneeName(task.assigneeId) }}
                </td>
                <td class="task-priority-cell">
                  <span class="priority-badge" [class]="'priority-' + task.priority">
                    {{ getPriorityLabel(task.priority) }}
                  </span>
                </td>
                <td class="task-progress-cell">
                  <div class="progress-container">
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="task.progress || 0"></div>
                    </div>
                    <span class="progress-text">{{ task.progress || 0 }}%</span>
                  </div>
                </td>
                <td class="task-actions-cell">
                  <div class="action-buttons">
                    <button class="btn btn-small btn-success" (click)="markTaskComplete(task.id)" *ngIf="task.status !== 'completed'" title="完了">
                      ✓
                    </button>
                    <button class="btn btn-small btn-primary" (click)="editTask(task)" title="編集">
                      ✏️
                    </button>
                    <button class="btn btn-small btn-danger" (click)="deleteTask(task.id)" title="削除">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ng-template #emptyTasks>
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <h3 class="empty-title">課題がありません</h3>
            <p class="empty-description">新しい課題を作成して始めましょう</p>
            <button class="btn btn-primary" (click)="showCreateTaskModal()">
              課題を作成
            </button>
          </div>
        </ng-template>
      </div>
    </div>

    <!-- 課題作成モーダル -->
    <div class="modal-overlay" *ngIf="showCreateModal" (click)="hideCreateTaskModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 class="modal-title">新しい課題を作成</h3>
          <button class="modal-close" (click)="hideCreateTaskModal()">×</button>
        </div>
        
        <form [formGroup]="taskForm" (ngSubmit)="createTask()" class="modal-form">
          <div class="form-group">
            <label class="form-label">課題名</label>
            <input 
              type="text" 
              formControlName="title" 
              class="form-input"
              placeholder="課題名を入力"
            />
          </div>

          <div class="form-group">
            <label class="form-label">説明</label>
            <textarea 
              formControlName="content" 
              class="form-textarea"
              placeholder="課題の詳細を入力"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">担当者</label>
                  <select formControlName="assigneeId" class="form-select">
                    <option value="">未設定</option>
                    <option *ngFor="let member of (members$ | async)" [value]="member.userId">
                      {{ getMemberDisplayName(member.userId, member.userName, member.userEmail) }}
                    </option>
                  </select>
            </div>

            <div class="form-group">
              <label class="form-label">優先度</label>
              <select formControlName="priority" class="form-select">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">期限</label>
              <input 
                type="date" 
                formControlName="dueDate" 
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label">進捗 (%)</label>
              <input 
                type="number" 
                formControlName="progress" 
                class="form-input"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="hideCreateTaskModal()">
              キャンセル
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="taskForm.invalid || loading">
              {{ loading ? '作成中...' : '課題を作成' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 課題編集モーダル -->
    <div class="modal-overlay" *ngIf="showEditModal" (click)="hideEditTaskModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">課題を編集</h2>
          <button class="modal-close" (click)="hideEditTaskModal()">×</button>
        </div>
        <form [formGroup]="editForm" (ngSubmit)="updateTask()" class="modal-form">
          <div class="form-group">
            <label class="form-label">課題名</label>
            <input 
              type="text" 
              formControlName="title" 
              class="form-input"
              placeholder="課題名を入力"
            />
          </div>

          <div class="form-group">
            <label class="form-label">説明</label>
            <textarea 
              formControlName="content" 
              class="form-textarea"
              placeholder="課題の詳細を入力"
              rows="3"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">担当者</label>
              <select formControlName="assigneeId" class="form-select">
                <option value="">未設定</option>
                <option *ngFor="let member of (members$ | async)" [value]="member.userId">
                  {{ member.userName || member.userEmail || 'ユーザー' }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">優先度</label>
              <select formControlName="priority" class="form-select">
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">期限</label>
              <input 
                type="date" 
                formControlName="dueDate" 
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label">進捗 (%)</label>
              <input 
                type="number" 
                formControlName="progress" 
                class="form-input"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">ステータス</label>
            <select formControlName="status" class="form-select">
              <option value="not_started">未着手</option>
              <option value="in_progress">実行中</option>
              <option value="completed">完了</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-danger" (click)="deleteEditingTask()">削除</button>
            <button type="button" class="btn btn-secondary" (click)="hideEditTaskModal()">キャンセル</button>
            <button type="submit" class="btn btn-primary" [disabled]="editForm.invalid || loading">
              {{ loading ? '更新中...' : '課題を更新' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 30px;
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8f9fa;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      color: #4a5568;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .back-btn:hover {
      border-color: #667eea;
      color: #667eea;
      transform: translateY(-1px);
    }

    .header-content {
      flex: 1;
    }

    .group-title {
      margin: 0 0 8px 0;
      color: #2d3748;
      font-size: 28px;
      font-weight: 700;
    }

    .group-description {
      margin: 0;
      color: #6b7280;
      font-size: 16px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .btn-secondary:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .btn-icon {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background-color 0.2s;
    }

    .btn-icon:hover {
      background: #f1f5f9;
    }

    /* 旧情報カード・旧フィルターのスタイルを削除 */

    .filter-select {
      padding: 10px 12px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background: white;
      min-width: 120px;
    }

    .filter-select:focus {
      outline: none;
      border-color: #667eea;
    }

    .tasks-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .tasks-header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .section-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .tasks-stats {
      display: flex;
      gap: 20px;
    }

    .tasks-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .tasks-filters {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .stat-item {
      display: flex;
      gap: 4px;
      font-size: 14px;
    }

    .stat-label {
      color: #6b7280;
    }

    .stat-value {
      color: #2d3748;
      font-weight: 600;
    }

    .tasks-table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .tasks-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
    }

    .tasks-table thead {
      background: #f8f9fa;
    }

    .tasks-table th {
      padding: 16px 12px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e2e8f0;
      font-size: 16px;
    }

    .tasks-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
      background: white;
      font-size: 16px; /* タイトル以外の文字を大きく */
    }

    .task-row:hover {
      background: #f8f9fa;
    }

    .task-title-cell {
      min-width: 200px;
    }

    .task-title {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 4px;
      font-size: 16px;
    }

    .task-content {
      font-size: 13px;
      color: #6b7280;
      line-height: 1.4;
    }

    .task-date-cell,
    .task-due-cell {
      white-space: nowrap;
      font-size: 16px; /* 文字サイズアップ */
    }

    .task-due-cell.due-soon {
      color: #f59e0b;
      font-weight: 600;
    }

    .task-due-cell.overdue {
      color: #ef4444;
      font-weight: 600;
    }

    .task-assignee-cell {
      font-size: 16px; /* 文字サイズアップ */
    }

    .task-priority-cell {
      text-align: left; /* 右寄り解消 */
      padding-left: 12px;
    }

    .priority-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    /* テーブル内の優先度バッジを大きく表示 */
    .task-priority-cell .priority-badge {
      font-size: 16px;
      padding: 6px 10px;
    }

    .priority-low {
      background: #dbeafe;
      color: #1e40af;
    }

    .priority-medium {
      background: #fef3c7;
      color: #d97706;
    }

    .priority-high {
      background: #fed7d7;
      color: #dc2626;
    }

    .priority-urgent {
      background: #fecaca;
      color: #b91c1c;
    }

    .task-progress-cell {
      min-width: 120px;
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-bar {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #059669);
      transition: width 0.3s ease;
    }

    .progress-text {
      font-size: 14px; /* 文字サイズアップ */
      font-weight: 600;
      color: #374151;
      min-width: 35px;
    }

    .task-actions-cell {
      text-align: center;
    }

    .action-buttons {
      display: flex;
      gap: 4px;
      justify-content: center;
    }

    .btn-small {
      padding: 6px 8px;
      font-size: 12px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-success {
      background: #10b981;
      color: white;
    }

    .btn-success:hover {
      background: #059669;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
    }

    .btn-danger:hover {
      background: #dc2626;
    }

    .task-card {
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      transition: all 0.2s ease;
    }

    .task-card:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }

    .task-card.priority-low { border-left: 4px solid #38a169; }
    .task-card.priority-medium { border-left: 4px solid #4299e1; }
    .task-card.priority-high { border-left: 4px solid #ed8936; }
    .task-card.priority-urgent { border-left: 4px solid #e53e3e; }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .task-title {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
    }

    .task-actions {
      display: flex;
      gap: 8px;
    }

    .task-content {
      margin: 0 0 16px 0;
      color: #6b7280;
      line-height: 1.5;
    }

    .task-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .meta-label {
      font-size: 12px;
      color: #6b7280;
      font-weight: 500;
    }

    .meta-value {
      font-size: 14px;
      color: #2d3748;
      font-weight: 600;
    }

    .meta-value.overdue {
      color: #e53e3e;
    }

    .priority-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .priority-low { background: #c6f6d5; color: #2f855a; }
    .priority-medium { background: #bee3f8; color: #2b6cb0; }
    .priority-high { background: #feebc8; color: #dd6b20; }
    .priority-urgent { background: #fed7d7; color: #c53030; }

    .task-progress {
      margin-bottom: 16px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .progress-label {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }

    .progress-percentage {
      font-size: 14px;
      color: #2d3748;
      font-weight: 600;
    }

    .progress-bar {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s ease;
    }

    .task-status {
      display: flex;
      justify-content: flex-end;
    }

    .status-select {
      padding: 8px 12px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background: white;
    }

    .status-select:focus {
      outline: none;
      border-color: #667eea;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-title {
      margin: 0 0 8px 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .empty-description {
      margin: 0 0 24px 0;
      color: #6b7280;
    }

    /* モーダル */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 24px 0;
    }

    .modal-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
    }

    .modal-form {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 6px;
    }

    .form-input, .form-textarea, .form-select {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus, .form-select:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-textarea {
      resize: vertical;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .page-container {
        padding: 16px;
      }

      .page-header {
        flex-direction: column;
        gap: 16px;
      }

      .info-card {
        flex-direction: column;
        gap: 20px;
      }

      .filter-section {
        flex-direction: column;
        align-items: stretch;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .modal-actions {
        flex-direction: column;
      }
    }

    /* 参加リクエスト管理スタイル */
    .join-requests-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f1f5f9;
    }

    .section-title {
      margin: 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: #6b7280;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #f1f5f9;
      color: #374151;
    }

    .join-requests-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .join-request-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.2s;
    }

    .join-request-item:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .request-info {
      flex: 1;
    }

    .request-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .request-user {
      margin: 0;
      color: #2d3748;
      font-size: 16px;
      font-weight: 600;
    }

    .request-date {
      color: #6b7280;
      font-size: 14px;
    }

    .request-email {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    .request-actions {
      display: flex;
      gap: 8px;
    }

    .btn-success {
      background: #10b981;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-success:hover {
      background: #059669;
      transform: translateY(-1px);
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .btn-danger:hover {
      background: #dc2626;
      transform: translateY(-1px);
    }

    .request-count {
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
    }

    .milestone-count {
      background: #10b981;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-title {
      margin: 0 0 8px;
      color: #374151;
      font-size: 18px;
      font-weight: 600;
    }

    .empty-description {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }

    /* メンバー表示スタイル */
    .members-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .members-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .member-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.2s;
    }

    .member-item:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .member-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .member-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 18px;
    }

    .avatar-text {
      text-transform: uppercase;
    }

    .member-details {
      flex: 1;
    }

    .member-name {
      margin: 0 0 4px;
      color: #2d3748;
      font-size: 16px;
      font-weight: 600;
    }

    .member-email {
      margin: 0 0 8px;
      color: #6b7280;
      font-size: 14px;
    }

    .member-role {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .member-role.owner {
      background: #fef3c7;
      color: #92400e;
    }

    .member-role.member {
      background: #dbeafe;
      color: #1e40af;
    }

    .member-meta {
      text-align: right;
    }

    .join-date {
      color: #6b7280;
      font-size: 14px;
    }

    .member-count {
      background: #3b82f6;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
    }
  `]
})
export class GroupDetailPage implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private joinRequestService = inject(JoinRequestService);
  private milestoneService = inject(MilestoneService);

  private destroy$ = new Subject<void>();

  group: Group | null = null;
  members$: Observable<GroupMembership[]> = of([]);
  members: GroupMembership[] = []; // メンバー情報をキャッシュ
  memberNameById: { [userId: string]: string } = {}; // ユーザー名キャッシュ
  tasks$: Observable<TaskItem[]> = of([]);
  filteredTasks: TaskItem[] = [];
  groupMilestones$: Observable<Milestone[]> = of([]);

  showCreateModal = false;
  showEditModal = false;
  loading = false;
  editingTask: TaskItem | null = null;

  statusFilter = '';
  priorityFilter = '';
  assigneeFilter = '';

  // 参加リクエスト関連
  joinRequests$: Observable<JoinRequest[]> = of([]);
  showJoinRequests = false;
  isGroupOwner = false;

  // メンバー表示関連
  showMembers = false;

  taskForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    content: [''],
    assigneeId: [''],
    priority: ['medium', [Validators.required]],
    dueDate: [''],
    progress: [0, [Validators.min(0), Validators.max(100)]]
  });

  editForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    content: [''],
    assigneeId: [''],
    priority: ['medium', [Validators.required]],
    dueDate: [''],
    progress: [0, [Validators.min(0), Validators.max(100)]],
    status: ['not_started', [Validators.required]]
  });

  ngOnInit() {
    this.route.params.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const groupId = params['id'];
        return this.groupService.getGroup(groupId);
      })
    ).subscribe(group => {
      this.group = group;
      if (group) {
        this.members$ = this.groupService.getGroupMembers(group.id);
        this.tasks$ = this.taskService.getTasksByGroup(group.id);
        this.groupMilestones$ = this.milestoneService.getGroupMilestones(group.id);
        
        // グループオーナーチェック
        this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
          this.isGroupOwner = !!(user && (user as any).uid === group.ownerId);
          
          // グループオーナーの場合、参加リクエストを読み込み
          if (this.isGroupOwner) {
            this.joinRequests$ = this.joinRequestService.getGroupJoinRequests(group.id);
          }
        });
        
        // メンバー情報をキャッシュし、ユーザープロファイルから表示名を解決
        this.members$.pipe(takeUntil(this.destroy$)).subscribe(async members => {
          this.members = members;
          const uniqueUserIds = Array.from(new Set(members.map(m => m.userId)));
          for (const uid of uniqueUserIds) {
            try {
              // 既にキャッシュ済みならスキップ
              if (this.memberNameById[uid]) continue;
              const profile = await this.userService.getUserProfile(uid);
              if (profile?.displayName) {
                this.memberNameById[uid] = profile.displayName;
              }
            } catch (_) {
              // ignore profile fetch errors
            }
          }
        });
        
        this.tasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => {
          this.filteredTasks = tasks;
          this.applyFilters();
        });
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters() {
    this.tasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => {
      this.filteredTasks = tasks.filter(task => {
        const statusMatch = !this.statusFilter || task.status === this.statusFilter;
        const priorityMatch = !this.priorityFilter || task.priority === this.priorityFilter;
        const assigneeMatch = !this.assigneeFilter || task.assigneeId === this.assigneeFilter;
        return statusMatch && priorityMatch && assigneeMatch;
      });
    });
  }

  clearFilters() {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.assigneeFilter = '';
    this.applyFilters();
  }

  getTaskCount(status: string): number {
    return this.filteredTasks.filter(task => task.status === status).length;
  }

  getCompletionRate(): number {
    if (this.filteredTasks.length === 0) return 0;
    const completed = this.filteredTasks.filter(task => task.status === 'completed').length;
    return Math.round((completed / this.filteredTasks.length) * 100);
  }

  getAssigneeName(userId: string | undefined): string {
    if (!userId) return '未設定';
    // ユーザープロファイル由来の表示名を最優先
    if (this.memberNameById[userId]) {
      return this.memberNameById[userId];
    }
    // メンバーシップに保存されている名前/メールをフォールバック
    const member = this.members.find(m => m.userId === userId);
    if (member) {
      return member.userName || member.userEmail || 'ユーザー';
    }
    return 'ユーザー';
  }

  getMemberDisplayName(userId: string, userName?: string, userEmail?: string): string {
    // キャッシュされた実際のユーザー名を優先
    if (this.memberNameById[userId]) {
      return this.memberNameById[userId];
    }
    
    // グループメンバーシップのuserNameが「グループオーナー」の場合は無視
    if (userName && userName !== 'グループオーナー') {
      return userName;
    }
    
    // メールアドレスから名前を抽出
    if (userEmail) {
      return userEmail.split('@')[0];
    }
    
    return 'ユーザー';
  }

  getPriorityLabel(priority: string): string {
    const labels = {
      low: '低',
      medium: '中',
      high: '高',
      urgent: '緊急'
    };
    return labels[priority as keyof typeof labels] || priority;
  }

  formatDate(date: any): string {
    if (!date) return '未設定';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ja-JP');
  }

  isOverdue(date: any): boolean {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    return d < new Date();
  }

  isDueSoon(date: any): boolean {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d <= tomorrow && d >= new Date();
  }

  showCreateTaskModal() {
    this.taskForm.patchValue({
      title: '',
      content: '',
      assigneeId: '',
      priority: 'medium',
      dueDate: '',
      progress: 0
    });
    this.showCreateModal = true;
  }

  hideCreateTaskModal() {
    this.showCreateModal = false;
    this.taskForm.reset({
      title: '',
      content: '',
      assigneeId: '',
      priority: 'medium',
      dueDate: '',
      progress: 0
    });
  }

  async createTask() {
    if (this.taskForm.invalid || !this.group) return;
    
    this.loading = true;
    const taskData = this.taskForm.getRawValue();
    
    try {
      await this.taskService.createTask(this.group.id, {
        title: taskData.title!,
        content: taskData.content || '',
        assigneeId: taskData.assigneeId || '',
        priority: taskData.priority as any,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
        progress: taskData.progress || 0,
        status: 'not_started',
        occurredOn: new Date(),
        isRecurring: false
      });
      
      // 課題一覧を再読み込み
      this.tasks$ = this.taskService.getTasksByGroup(this.group.id);
      this.tasks$.pipe(takeUntil(this.destroy$)).subscribe(tasks => {
        this.filteredTasks = tasks;
        this.applyFilters();
      });
      
      this.taskForm.reset();
      this.hideCreateTaskModal();
    } catch (error) {
      console.error('課題作成エラー:', error);
    } finally {
      this.loading = false;
    }
  }

  async updateTaskStatus(taskId: string, event: any) {
    const newStatus = event.target.value;
    try {
      await this.taskService.updateTask(taskId, { status: newStatus });
    } catch (error) {
      console.error('ステータス更新エラー:', error);
    }
  }

  editTask(task: TaskItem) {
    this.editingTask = task;
    this.editForm.patchValue({
      title: task.title,
      content: task.content,
      assigneeId: task.assigneeId || '',
      priority: task.priority,
      dueDate: task.dueDate ? this.formatDateForInput(task.dueDate) : '',
      progress: task.progress || 0,
      status: task.status
    });
    this.showEditModal = true;
  }

  hideEditTaskModal() {
    this.showEditModal = false;
    this.editingTask = null;
    this.editForm.reset({
      title: '',
      content: '',
      assigneeId: '',
      priority: 'medium',
      dueDate: '',
      progress: 0,
      status: 'not_started'
    });
  }

  async updateTask() {
    if (this.editForm.invalid || !this.editingTask) return;
    
    this.loading = true;
    const taskData = this.editForm.getRawValue();
    
    try {
      await this.taskService.updateTask(this.editingTask.id, {
        title: taskData.title!,
        content: taskData.content || '',
        assigneeId: taskData.assigneeId || '',
        priority: taskData.priority as any,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
        progress: taskData.progress || 0,
        status: taskData.status as any
      });
      
      this.hideEditTaskModal();
    } catch (error) {
      console.error('課題更新エラー:', error);
    } finally {
      this.loading = false;
    }
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split('T')[0];
  }

  async markTaskComplete(taskId: string) {
    try {
      await this.taskService.updateTask(taskId, { 
        status: 'completed',
        progress: 100
      });
    } catch (error) {
      console.error('課題完了エラー:', error);
    }
  }

  async deleteEditingTask() {
    if (this.editingTask && confirm('この課題を削除しますか？')) {
      try {
        await this.taskService.deleteTask(this.editingTask.id);
        this.hideEditTaskModal();
      } catch (error) {
        console.error('課題削除エラー:', error);
      }
    }
  }

  async deleteTask(taskId: string) {
    if (confirm('この課題を削除しますか？')) {
      try {
        await this.taskService.deleteTask(taskId);
      } catch (error) {
        console.error('課題削除エラー:', error);
      }
    }
  }

  // メンバー表示メソッド
  toggleMembers() {
    this.showMembers = !this.showMembers;
  }

  getMemberInitial(name: string): string {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  }

  getRoleLabel(role: string): string {
    const labels = {
      owner: 'オーナー',
      member: 'メンバー'
    };
    return labels[role as keyof typeof labels] || role;
  }

  // 参加リクエスト管理メソッド
  toggleJoinRequests() {
    this.showJoinRequests = !this.showJoinRequests;
  }

  async approveJoinRequest(requestId: string) {
    if (confirm('この参加リクエストを承認しますか？')) {
      try {
        await this.joinRequestService.approveJoinRequest(requestId);
        alert('参加リクエストを承認しました！');
      } catch (error) {
        console.error('参加リクエスト承認エラー:', error);
        alert('参加リクエストの承認に失敗しました。');
      }
    }
  }

  async rejectJoinRequest(requestId: string) {
    if (confirm('この参加リクエストを拒否しますか？')) {
      try {
        await this.joinRequestService.rejectJoinRequest(requestId);
        alert('参加リクエストを拒否しました。');
      } catch (error) {
        console.error('参加リクエスト拒否エラー:', error);
        alert('参加リクエストの拒否に失敗しました。');
      }
    }
  }

  // マイルストーン表示メソッド
  viewGroupMilestones() {
    if (this.group) {
      this.router.navigate(['/milestones'], { 
        queryParams: { groupId: this.group.id } 
      });
    }
  }
}
