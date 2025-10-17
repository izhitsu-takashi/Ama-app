import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MilestoneService } from './milestone.service';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { Milestone, Group, MilestoneSubTask, MilestoneFlowStep } from './models';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, switchMap, take } from 'rxjs/operators';

@Component({
  selector: 'app-milestone',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page-container">
      <!-- ヘッダー -->
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">マイルストーン管理</h1>
        <div class="header-actions">
          <button class="btn primary" (click)="showCreateModal()">+ マイルストーン作成</button>
        </div>
      </div>

      <!-- マイルストーン一覧 -->
      <div class="milestones-section">
        <h2 class="section-title">マイルストーン一覧</h2>
        
        <!-- フィルター -->
        <div class="filters">
          <div class="filter-group">
            <label class="filter-label">グループ:</label>
            <select class="filter-select" [(ngModel)]="selectedGroupId" (change)="applyFilter()">
              <option value="">すべてのグループ</option>
              <option *ngFor="let group of (userGroups$ | async)" [value]="group.id">
                {{ group.name }}
              </option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">ステータス:</label>
            <select class="filter-select" [(ngModel)]="statusFilter" (change)="applyFilter()">
              <option value="">すべて</option>
              <option value="not_started">未着手</option>
              <option value="in_progress">実行中</option>
              <option value="completed">完了</option>
            </select>
          </div>
          <button class="btn secondary small" (click)="clearFilters()">クリア</button>
        </div>

        <!-- マイルストーンリスト -->
        <div class="milestones-list" *ngIf="filteredMilestones$ | async as milestones; else noMilestones">
          <div class="milestone-card" *ngFor="let milestone of milestones" [class]="'status-' + milestone.status">
            <div class="milestone-header">
              <h3 class="milestone-name">{{ milestone.name }}</h3>
              <span class="milestone-status" [class]="'status-' + milestone.status">
                {{ getStatusLabel(milestone.status) }}
              </span>
            </div>
            
            <p class="milestone-description" *ngIf="milestone.description">{{ milestone.description }}</p>
            
            <div class="milestone-dates">
              <div class="date-item">
                <span class="date-label">開始日:</span>
                <span class="date-value">{{ formatDate(milestone.startDate) }}</span>
              </div>
              <div class="date-item">
                <span class="date-label">終了日:</span>
                <span class="date-value">{{ formatDate(milestone.endDate) }}</span>
              </div>
              <div class="date-item">
                <span class="date-label">期間:</span>
                <span class="date-value">{{ getDuration(milestone.startDate, milestone.endDate) }}</span>
              </div>
            </div>

            <!-- タスク進捗 -->
            <div class="milestone-progress" *ngIf="milestone.tasks && milestone.tasks.length > 0">
              <div class="progress-header">
                <span class="progress-label">タスク進捗</span>
                <span class="progress-text">{{ getTaskProgress(milestone.tasks) }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="getTaskProgressPercentage(milestone.tasks)"></div>
              </div>
              <div class="task-summary">
                <span class="task-count">📋 {{ milestone.tasks.length }}タスク</span>
                <span class="estimated-hours" *ngIf="getTotalEstimatedHours(milestone.tasks) > 0">
                  ⏱️ {{ getTotalEstimatedHours(milestone.tasks) }}時間見積もり
                </span>
              </div>
            </div>

            <div class="milestone-meta">
              <span class="meta-item">📁 {{ getGroupName(milestone.groupId) }}</span>
              <span class="meta-item">📅 {{ formatDate(milestone.createdAt) }} 作成</span>
            </div>

            <!-- フローチャート表示 -->
            <div class="milestone-flow" *ngIf="milestone.flowSteps && milestone.flowSteps.length > 0">
              <h4 class="flow-title">プロセスフロー</h4>
              <div class="flow-chart">
                <div 
                  class="flow-step" 
                  *ngFor="let step of milestone.flowSteps; let i = index; trackBy: trackByStepId"
                  [class]="'step-' + step.status"
                >
                  <div class="step-content">
                    <div class="step-name">{{ step.name }}</div>
                    <div class="step-description" *ngIf="step.description">{{ step.description }}</div>
                    <div class="step-status">
                      <span class="status-indicator" [class]="'status-' + step.status">
                        {{ getStepStatusLabel(step.status) }}
                      </span>
                    </div>
                  </div>
                  <div class="flow-arrow" *ngIf="i < milestone.flowSteps!.length - 1">
                    <span class="arrow">▶</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="milestone-actions">
              <button class="btn small primary" (click)="editMilestone(milestone)">編集</button>
              <button class="btn small danger" (click)="deleteMilestone(milestone.id)">削除</button>
            </div>
          </div>
        </div>

        <ng-template #noMilestones>
          <div class="empty-state">
            <div class="empty-icon">🎯</div>
            <h3 class="empty-title">マイルストーンがありません</h3>
            <p class="empty-description">新しいマイルストーンを作成して、プロジェクトの進捗を管理しましょう。</p>
            <button class="btn primary" (click)="showCreateModal()">+ マイルストーン作成</button>
          </div>
        </ng-template>
      </div>

      <!-- マイルストーン作成・編集モーダル -->
      <div class="modal-overlay" *ngIf="showCreateModalFlag" (click)="hideCreateModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">{{ editingMilestone ? 'マイルストーン編集' : 'マイルストーン作成' }}</h2>
            <button class="modal-close" (click)="hideCreateModal()">×</button>
          </div>
          
          <form [formGroup]="milestoneForm" (ngSubmit)="onSubmit()" class="modal-form">
            <div class="form-group">
              <label class="form-label">マイルストーン名</label>
              <input 
                type="text" 
                formControlName="name" 
                class="form-input"
                placeholder="マイルストーン名を入力"
              />
              <div *ngIf="milestoneForm.get('name')?.invalid && milestoneForm.get('name')?.touched" class="error-message">
                マイルストーン名は必須です (2文字以上)
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">説明</label>
              <textarea 
                formControlName="description" 
                class="form-textarea"
                placeholder="マイルストーンの詳細を入力"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">グループ</label>
              <select formControlName="groupId" class="form-select">
                <option value="">グループを選択</option>
                <option *ngFor="let group of (userGroups$ | async)" [value]="group.id">
                  {{ group.name }}
                </option>
              </select>
              <div *ngIf="milestoneForm.get('groupId')?.invalid && milestoneForm.get('groupId')?.touched" class="error-message">
                グループを選択してください
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">開始日</label>
                <input 
                  type="date" 
                  formControlName="startDate" 
                  class="form-input"
                />
                <div *ngIf="milestoneForm.get('startDate')?.invalid && milestoneForm.get('startDate')?.touched" class="error-message">
                  開始日を選択してください
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">終了日</label>
                <input 
                  type="date" 
                  formControlName="endDate" 
                  class="form-input"
                />
                <div *ngIf="milestoneForm.get('endDate')?.invalid && milestoneForm.get('endDate')?.touched" class="error-message">
                  終了日を選択してください
                </div>
              </div>
            </div>

            <!-- フローチャート設定セクション -->
            <div class="form-group">
              <div class="section-header">
                <label class="form-label">プロセスフロー</label>
                <div class="flow-actions">
                  <button type="button" class="btn small secondary" (click)="loadTemplate()">
                    📋 テンプレート
                  </button>
                  <button type="button" class="btn small primary" (click)="addFlowStep()">
                    + ステップ追加
                  </button>
                </div>
              </div>
              
              <div class="flow-steps-container" *ngIf="flowSteps.length > 0">
                <div class="flow-step-item" *ngFor="let step of flowSteps; let i = index">
                  <div class="step-header">
                    <input 
                      type="text" 
                      [(ngModel)]="step.name"
                      class="form-input step-name-input"
                      placeholder="ステップ名 (例: 企画)"
                    />
                    <button type="button" class="btn small danger" (click)="removeFlowStep(i)">
                      ×
                    </button>
                  </div>
                  
                  <div class="step-details">
                    <textarea 
                      [(ngModel)]="step.description"
                      class="form-textarea step-description"
                      placeholder="ステップの詳細説明 (任意)"
                      rows="2"
                    ></textarea>
                    
                    <div class="step-meta">
                      <select [(ngModel)]="step.status" class="form-select step-status">
                        <option value="not_started">未着手</option>
                        <option value="in_progress">実行中</option>
                        <option value="completed">完了</option>
                      </select>
                      
                      <div class="step-dates">
                        <input 
                          type="date" 
                          [(ngModel)]="step.startDate"
                          class="form-input step-date"
                          placeholder="開始日"
                        />
                        <input 
                          type="date" 
                          [(ngModel)]="step.endDate"
                          class="form-input step-date"
                          placeholder="終了日"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="no-flow-steps" *ngIf="flowSteps.length === 0">
                <p class="no-steps-text">プロセスフローを設定してマイルストーンの流れを可視化しましょう</p>
                <div class="template-buttons">
                  <button type="button" class="btn small secondary" (click)="loadDefaultTemplate()">
                    📋 デフォルトテンプレート
                  </button>
                  <button type="button" class="btn small secondary" (click)="loadDevelopmentTemplate()">
                    💻 開発テンプレート
                  </button>
                </div>
              </div>
            </div>

            <!-- タスク分割セクション -->
            <div class="form-group">
              <div class="section-header">
                <label class="form-label">タスク分割</label>
                <button type="button" class="btn small primary" (click)="addSubTask()">
                  + タスク追加
                </button>
              </div>
              
              <div class="subtasks-container" *ngIf="subTasks.length > 0">
                <div class="subtask-item" *ngFor="let task of subTasks; let i = index">
                  <div class="subtask-header">
                    <input 
                      type="text" 
                      [(ngModel)]="task.title"
                      class="form-input subtask-title"
                      placeholder="タスク名を入力"
                    />
                    <button type="button" class="btn small danger" (click)="removeSubTask(i)">
                      ×
                    </button>
                  </div>
                  
                  <div class="subtask-details">
                    <textarea 
                      [(ngModel)]="task.description"
                      class="form-textarea subtask-description"
                      placeholder="タスクの詳細 (任意)"
                      rows="2"
                    ></textarea>
                    
                    <div class="subtask-meta">
                      <select [(ngModel)]="task.priority" class="form-select subtask-priority">
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                      
                      <input 
                        type="number" 
                        [(ngModel)]="task.estimatedHours"
                        class="form-input subtask-hours"
                        placeholder="見積もり時間"
                        min="0"
                        step="0.5"
                      />
                      <span class="hours-label">時間</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="no-tasks" *ngIf="subTasks.length === 0">
                <p class="no-tasks-text">タスクを追加してマイルストーンを詳細に計画しましょう</p>
              </div>
            </div>

            <div class="form-group" *ngIf="editingMilestone">
              <label class="form-label">ステータス</label>
              <select formControlName="status" class="form-select">
                <option value="not_started">未着手</option>
                <option value="in_progress">実行中</option>
                <option value="completed">完了</option>
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="hideCreateModal()">キャンセル</button>
              <button type="submit" class="btn primary" [disabled]="milestoneForm.invalid || loading">
                {{ loading ? '保存中...' : (editingMilestone ? '更新' : '作成') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .page-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .back-btn {
      background: none;
      border: none;
      color: #667eea;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      transition: background-color 0.2s;
    }

    .back-btn:hover {
      background-color: rgba(102, 126, 234, 0.1);
    }

    .page-title {
      margin: 0;
      color: #2d3748;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      gap: 1rem;
    }

    .milestones-section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .section-title {
      margin: 0 0 1.5rem 0;
      color: #2d3748;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .filters {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      align-items: end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .filter-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
    }

    .filter-select {
      padding: 0.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      background: white;
    }

    .milestones-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1.5rem;
    }

    .milestone-card {
      background: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #e2e8f0;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .milestone-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .milestone-card.status-not_started {
      border-left-color: #a0aec0;
    }

    .milestone-card.status-in_progress {
      border-left-color: #4299e1;
    }

    .milestone-card.status-completed {
      border-left-color: #48bb78;
    }

    .milestone-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .milestone-name {
      margin: 0;
      color: #2d3748;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .milestone-status {
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .milestone-status.status-not_started {
      background: #f7fafc;
      color: #4a5568;
    }

    .milestone-status.status-in_progress {
      background: #ebf8ff;
      color: #2b6cb0;
    }

    .milestone-status.status-completed {
      background: #f0fff4;
      color: #2f855a;
    }

    .milestone-description {
      color: #6b7280;
      margin-bottom: 1rem;
      line-height: 1.5;
    }

    .milestone-dates {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .date-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .date-label {
      font-size: 0.75rem;
      color: #6b7280;
      font-weight: 500;
    }

    .date-value {
      font-size: 0.875rem;
      color: #2d3748;
      font-weight: 500;
    }

    .milestone-meta {
      display: flex;
      gap: 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .milestone-actions {
      display: flex;
      gap: 0.5rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-title {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .empty-description {
      margin: 0 0 2rem 0;
      color: #6b7280;
      line-height: 1.5;
    }

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
    }

    .modal {
      background: white;
      border-radius: 1rem;
      width: 95%;
      max-width: 900px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-title {
      margin: 0;
      color: #2d3748;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      color: #6b7280;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 0.25rem;
      transition: background-color 0.2s;
    }

    .modal-close:hover {
      background-color: #f7fafc;
    }

    .modal-form {
      padding: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-row-wide {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1rem;
    }

    .form-label {
      display: block;
      margin-bottom: 0.5rem;
      color: #374151;
      font-weight: 500;
    }

    .form-input,
    .form-textarea,
    .form-select {
      width: 100%;
      max-width: 100%;
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .form-input:focus,
    .form-textarea:focus,
    .form-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }

    .error-message {
      color: #e53e3e;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn.primary {
      background: #667eea;
      color: white;
    }

    .btn.primary:hover:not(:disabled) {
      background: #5a67d8;
    }

    .btn.secondary {
      background: #e2e8f0;
      color: #4a5568;
    }

    .btn.secondary:hover:not(:disabled) {
      background: #cbd5e0;
    }

    .btn.danger {
      background: #e53e3e;
      color: white;
    }

    .btn.danger:hover:not(:disabled) {
      background: #c53030;
    }

    .btn.small {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      .page-container {
        padding: 1rem;
      }

      .page-header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }

      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

      .milestones-list {
        grid-template-columns: 1fr;
      }

      .modal {
        width: 95%;
        margin: 1rem;
      }
    }

    /* サブタスク関連のスタイル */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .subtasks-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 1rem;
      background: #f9f9f9;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .subtask-item {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .subtask-item:last-child {
      margin-bottom: 0;
    }

    .subtask-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .subtask-title {
      flex: 1;
      font-weight: 600;
    }

    .subtask-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .subtask-description {
      font-size: 0.9rem;
      resize: vertical;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .subtask-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .subtask-priority {
      width: 80px;
    }

    .subtask-hours {
      width: 100px;
    }

    .hours-label {
      font-size: 0.9rem;
      color: #666;
    }

    .no-tasks {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .no-tasks-text {
      margin: 0;
      font-style: italic;
    }

    /* 進捗表示のスタイル */
    .milestone-progress {
      margin: 1rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      border: 1px solid #e9ecef;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .progress-label {
      font-weight: 600;
      color: #495057;
    }

    .progress-text {
      font-size: 0.9rem;
      color: #6c757d;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #28a745, #20c997);
      transition: width 0.3s ease;
    }

    .task-summary {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: #6c757d;
    }

    .task-count, .estimated-hours {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* フローチャート関連のスタイル */
    .milestone-flow {
      margin: 1rem 0;
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 0.5rem;
      border: 1px solid #e9ecef;
    }

    .flow-title {
      margin: 0 0 1rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: #495057;
    }

    .flow-chart {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .flow-step {
      display: flex;
      align-items: center;
      background: white;
      border: 2px solid #e9ecef;
      border-radius: 0.5rem;
      padding: 0.75rem;
      min-width: 120px;
      position: relative;
    }

    .flow-step.step-not_started {
      border-color: #6c757d;
      background: #f8f9fa;
    }

    .flow-step.step-in_progress {
      border-color: #007bff;
      background: #e3f2fd;
    }

    .flow-step.step-completed {
      border-color: #28a745;
      background: #e8f5e8;
    }

    .step-content {
      text-align: center;
    }

    .step-name {
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 0.25rem;
      color: #495057;
    }

    .step-description {
      font-size: 0.75rem;
      color: #6c757d;
      margin-bottom: 0.5rem;
    }

    .step-status {
      margin-top: 0.25rem;
    }

    .status-indicator {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .status-indicator.status-not_started {
      background: #6c757d;
      color: white;
    }

    .status-indicator.status-in_progress {
      background: #007bff;
      color: white;
    }

    .status-indicator.status-completed {
      background: #28a745;
      color: white;
    }

    .flow-arrow {
      margin: 0 0.5rem;
      color: #6c757d;
      font-size: 1.2rem;
    }

    .arrow {
      display: block;
    }

    /* フローチャート編集用のスタイル */
    .flow-actions {
      display: flex;
      gap: 0.5rem;
    }

    .flow-steps-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 1rem;
      background: #f9f9f9;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .flow-step-item {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .flow-step-item:last-child {
      margin-bottom: 0;
    }

    .step-header {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .step-name-input {
      flex: 1;
      font-weight: 600;
    }

    .step-details {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .step-description {
      font-size: 0.9rem;
      resize: vertical;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .step-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .step-status {
      width: 100px;
    }

    .step-dates {
      display: flex;
      gap: 0.5rem;
    }

    .step-date {
      width: 120px;
    }

    .no-flow-steps {
      text-align: center;
      padding: 2rem;
      color: #666;
    }

    .no-steps-text {
      margin: 0 0 1rem 0;
      font-style: italic;
    }

    .template-buttons {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* レスポンシブ対応 */
    @media (max-width: 768px) {
      .modal {
        width: 98%;
        max-width: none;
        margin: 0.5rem;
      }

      .form-row-wide {
        grid-template-columns: 1fr;
      }

      .flow-steps-container,
      .subtasks-container {
        grid-template-columns: 1fr;
      }

      .flow-chart {
        flex-direction: column;
        align-items: stretch;
      }

      .flow-arrow {
        transform: rotate(90deg);
        margin: 0.5rem 0;
        text-align: center;
      }

      .flow-step {
        min-width: auto;
      }

      .step-meta {
        flex-direction: column;
        align-items: stretch;
      }

      .step-dates {
        justify-content: space-between;
      }

      .template-buttons {
        flex-direction: column;
      }
    }
  `]
})
export class MilestonePage implements OnInit, OnDestroy {
  private milestoneService = inject(MilestoneService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  userGroups$: Observable<Group[]> = of([]);
  allMilestones$: Observable<Milestone[]> = of([]);
  filteredMilestones$: Observable<Milestone[]> = of([]);
  
  selectedGroupId = '';
  statusFilter = '';
  
  showCreateModalFlag = false;
  editingMilestone: Milestone | null = null;
  loading = false;
  subTasks: MilestoneSubTask[] = [];
  flowSteps: MilestoneFlowStep[] = [];

  milestoneForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    groupId: ['', [Validators.required]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    status: ['not_started']
  });

  ngOnInit() {
    this.loadUserGroups();
    this.loadMilestones();
    
    // クエリパラメータからグループIDを取得してフィルタリング
    this.route.queryParams.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      if (params['groupId']) {
        this.selectedGroupId = params['groupId'];
        this.applyFilter();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadUserGroups() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          return this.groupService.getUserGroups(user.uid);
        }
        return of([]);
      })
    ).subscribe(groups => {
      this.userGroups$ = of(groups);
    });
  }

  private loadMilestones() {
    this.auth.currentUser$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (user) {
          return this.milestoneService.getUserMilestones(user.uid);
        }
        return of([]);
      })
    ).subscribe(milestones => {
      this.allMilestones$ = of(milestones);
      this.applyFilter();
    });
  }

  applyFilter() {
    this.allMilestones$.pipe(take(1)).subscribe(milestones => {
      let filtered = milestones;
      
      if (this.selectedGroupId) {
        filtered = filtered.filter(m => m.groupId === this.selectedGroupId);
      }
      
      if (this.statusFilter) {
        filtered = filtered.filter(m => m.status === this.statusFilter);
      }
      
      this.filteredMilestones$ = of(filtered);
    });
  }

  clearFilters() {
    this.selectedGroupId = '';
    this.statusFilter = '';
    this.applyFilter();
  }

  showCreateModal() {
    this.editingMilestone = null;
    this.milestoneForm.reset({
      name: '',
      description: '',
      groupId: '',
      startDate: '',
      endDate: '',
      status: 'not_started'
    });
    this.showCreateModalFlag = true;
  }

  hideCreateModal() {
    this.showCreateModalFlag = false;
    this.editingMilestone = null;
    this.milestoneForm.reset();
    this.subTasks = [];
    this.flowSteps = [];
  }

  editMilestone(milestone: Milestone) {
    this.editingMilestone = milestone;
    this.milestoneForm.patchValue({
      name: milestone.name,
      description: milestone.description || '',
      groupId: milestone.groupId,
      startDate: this.formatDateForInput(milestone.startDate),
      endDate: this.formatDateForInput(milestone.endDate),
      status: milestone.status
    });
    // サブタスクとフローチャートステップを読み込み
    this.subTasks = milestone.tasks ? [...milestone.tasks] : [];
    this.flowSteps = milestone.flowSteps ? [...milestone.flowSteps] : [];
    this.showCreateModalFlag = true;
  }

  async onSubmit() {
    if (this.milestoneForm.invalid) return;
    
    this.loading = true;
    const formData = this.milestoneForm.getRawValue();
    const currentUser = this.auth.currentUser;
    
    if (!currentUser) {
      this.loading = false;
      return;
    }

    try {
      if (this.editingMilestone) {
        // 更新
        await this.milestoneService.updateMilestone(this.editingMilestone.id, {
          name: formData.name!,
          description: formData.description || '',
          groupId: formData.groupId!,
          startDate: new Date(formData.startDate!),
          endDate: new Date(formData.endDate!),
          status: formData.status as any,
          createdBy: this.editingMilestone.createdBy,
          tasks: this.subTasks,
          flowSteps: this.flowSteps
        });
      } else {
        // 作成
        await this.milestoneService.createMilestone({
          name: formData.name!,
          description: formData.description || '',
          groupId: formData.groupId!,
          startDate: new Date(formData.startDate!),
          endDate: new Date(formData.endDate!),
          status: formData.status as any,
          createdBy: currentUser.uid,
          tasks: this.subTasks,
          flowSteps: this.flowSteps
        });
      }
      
      this.hideCreateModal();
      this.loadMilestones();
    } catch (error) {
      console.error('マイルストーン保存エラー:', error);
    } finally {
      this.loading = false;
    }
  }

  async deleteMilestone(milestoneId: string) {
    if (confirm('このマイルストーンを削除しますか？')) {
      try {
        await this.milestoneService.deleteMilestone(milestoneId);
        this.loadMilestones();
      } catch (error) {
        console.error('マイルストーン削除エラー:', error);
      }
    }
  }


  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'not_started': '未着手',
      'in_progress': '実行中',
      'completed': '完了'
    };
    return labels[status] || status;
  }

  getGroupName(groupId: string): string {
    let groupName = 'グループ名';
    this.userGroups$.pipe(take(1)).subscribe(groups => {
      const group = groups.find(g => g.id === groupId);
      if (group) {
        groupName = group.name;
      }
    });
    return groupName;
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ja-JP');
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toISOString().split('T')[0];
  }

  // サブタスク管理メソッド
  addSubTask() {
    const newTask: MilestoneSubTask = {
      id: Date.now().toString(),
      title: '',
      description: '',
      isCompleted: false,
      priority: 'medium',
      estimatedHours: 0
    };
    this.subTasks.push(newTask);
  }

  removeSubTask(index: number) {
    this.subTasks.splice(index, 1);
  }

  // 期間計算
  getDuration(startDate: any, endDate: any): string {
    if (!startDate || !endDate) return '';
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    const end = endDate.toDate ? endDate.toDate() : new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays}日間`;
  }

  // タスク進捗計算
  getTaskProgress(tasks: MilestoneSubTask[]): string {
    if (!tasks || tasks.length === 0) return '0/0';
    const completed = tasks.filter(task => task.isCompleted).length;
    return `${completed}/${tasks.length}`;
  }

  getTaskProgressPercentage(tasks: MilestoneSubTask[]): number {
    if (!tasks || tasks.length === 0) return 0;
    const completed = tasks.filter(task => task.isCompleted).length;
    return (completed / tasks.length) * 100;
  }

  getTotalEstimatedHours(tasks: MilestoneSubTask[]): number {
    if (!tasks || tasks.length === 0) return 0;
    return tasks.reduce((total, task) => total + (task.estimatedHours || 0), 0);
  }

  // フローチャート関連メソッド
  addFlowStep() {
    const newStep: MilestoneFlowStep = {
      id: Date.now().toString(),
      name: '',
      description: '',
      status: 'not_started',
      order: this.flowSteps.length
    };
    this.flowSteps.push(newStep);
  }

  removeFlowStep(index: number) {
    this.flowSteps.splice(index, 1);
    // 順序を再設定
    this.flowSteps.forEach((step, i) => {
      step.order = i;
    });
  }

  trackByStepId(index: number, step: MilestoneFlowStep): string {
    return step.id;
  }

  getStepStatusLabel(status: string): string {
    const labels = {
      not_started: '未着手',
      in_progress: '実行中',
      completed: '完了'
    };
    return labels[status as keyof typeof labels] || status;
  }

  // テンプレート読み込み
  loadDefaultTemplate() {
    this.flowSteps = [
      {
        id: '1',
        name: '企画',
        description: 'プロジェクトの企画・要件定義',
        status: 'not_started',
        order: 0
      },
      {
        id: '2',
        name: '設計',
        description: 'システム設計・詳細設計',
        status: 'not_started',
        order: 1
      },
      {
        id: '3',
        name: '実装',
        description: 'コーディング・実装作業',
        status: 'not_started',
        order: 2
      },
      {
        id: '4',
        name: 'テスト',
        description: 'テスト・品質保証',
        status: 'not_started',
        order: 3
      },
      {
        id: '5',
        name: 'リリース',
        description: '本番リリース・運用開始',
        status: 'not_started',
        order: 4
      }
    ];
  }

  loadDevelopmentTemplate() {
    this.flowSteps = [
      {
        id: '1',
        name: '要件定義',
        description: '機能要件・非機能要件の定義',
        status: 'not_started',
        order: 0
      },
      {
        id: '2',
        name: '設計',
        description: 'アーキテクチャ設計・DB設計',
        status: 'not_started',
        order: 1
      },
      {
        id: '3',
        name: '開発',
        description: 'フロントエンド・バックエンド開発',
        status: 'not_started',
        order: 2
      },
      {
        id: '4',
        name: '単体テスト',
        description: 'ユニットテスト・コードレビュー',
        status: 'not_started',
        order: 3
      },
      {
        id: '5',
        name: '結合テスト',
        description: 'システム統合テスト',
        status: 'not_started',
        order: 4
      },
      {
        id: '6',
        name: 'デプロイ',
        description: '本番環境へのデプロイ',
        status: 'not_started',
        order: 5
      }
    ];
  }

  loadTemplate() {
    // テンプレート選択モーダルを表示する場合のメソッド
    // 現在は直接デフォルトテンプレートを読み込み
    this.loadDefaultTemplate();
  }
}
