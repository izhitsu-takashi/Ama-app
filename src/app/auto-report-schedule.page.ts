import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil, combineLatest, map } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

import { AutoReportScheduleService } from './auto-report-schedule.service';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { AutoReportSchedule, Group, User } from './models';

@Component({
  selector: 'app-auto-report-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>📅 自動送信設定</h1>
        <p>定期的に進捗報告を自動送信するスケジュールを設定できます</p>
      </div>

      <!-- タブ -->
      <div class="tabs">
        <button 
          class="tab-btn" 
          [class.active]="activeTab === 'create'"
          (click)="setActiveTab('create')"
        >
          新規作成
        </button>
        <button 
          class="tab-btn" 
          [class.active]="activeTab === 'schedules'"
          (click)="setActiveTab('schedules')"
        >
          設定済みスケジュール
        </button>
      </div>

      <!-- 新規作成フォーム -->
      <div class="create-section" *ngIf="activeTab === 'create'">
        <h2>新規スケジュール作成</h2>
        <form [formGroup]="scheduleForm" (ngSubmit)="onSubmit()">
          <div class="form-row">
            <div class="form-group">
              <label for="title">スケジュール名 *</label>
              <input type="text" id="title" formControlName="title" placeholder="例: 週次進捗報告">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="frequency">送信頻度 *</label>
              <select id="frequency" formControlName="frequency">
                <option value="daily">毎日</option>
                <option value="weekly">毎週</option>
                <option value="monthly">毎月</option>
              </select>
            </div>
            <div class="form-group">
              <label for="sendTime">送信時刻 *</label>
              <input type="time" id="sendTime" formControlName="sendTime">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="startDate">開始日 *</label>
              <input type="date" id="startDate" formControlName="startDate">
            </div>
          </div>

          <!-- 送信先選択 -->
          <div class="form-section">
            <h3>送信先設定</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="userSearch">送信先ユーザー検索</label>
                <input 
                  type="text" 
                  id="userSearch" 
                  [(ngModel)]="userSearchTerm" 
                  [ngModelOptions]="{standalone: true}"
                  (input)="onUserSearch()"
                  placeholder="ユーザー名またはメールアドレスで検索..."
                  class="search-input">
                
                <div *ngIf="showUserDropdown && filteredUsers.length > 0" class="dropdown">
                  <div 
                    *ngFor="let user of filteredUsers" 
                    class="dropdown-item user-item"
                    (click)="toggleUserSelection(user)">
                    <div class="user-avatar">
                      <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || 'ユーザー'" class="avatar-image">
                      <div *ngIf="!user.photoURL" class="default-avatar">
                        {{ getUserInitials(user) }}
                      </div>
                    </div>
                    <div class="user-info">
                      <div class="user-name">{{ user.displayName || '名前未設定' }}</div>
                      <div class="user-email">{{ user.email }}</div>
                    </div>
                    <div class="user-selection">
                      <span *ngIf="isUserSelected(user)" class="selected-icon">✓</span>
                    </div>
                  </div>
                </div>
                
                <div *ngIf="selectedUsers.length > 0" class="selected-users">
                  <h4>選択中のユーザー ({{ selectedUsers.length }}人)</h4>
                  <div class="selected-users-list">
                    <div *ngFor="let user of selectedUsers" class="selected-user-item">
                      <div class="user-avatar">
                        <img *ngIf="user.photoURL" [src]="user.photoURL" [alt]="user.displayName || 'ユーザー'" class="avatar-image">
                        <div *ngIf="!user.photoURL" class="default-avatar">
                          {{ getUserInitials(user) }}
                        </div>
                      </div>
                      <div class="user-info">
                        <div class="user-name">{{ user.displayName || '名前未設定' }}</div>
                        <div class="user-email">{{ user.email }}</div>
                      </div>
                      <button type="button" (click)="removeUser(user)" class="remove-btn">×</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 添付グループ選択 -->
          <div class="form-section">
            <h3>添付グループ設定</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="attachedGroupSelect">進捗報告に添付するグループ *</label>
                <select id="attachedGroupSelect" formControlName="attachedGroupId">
                  <option value="">グループを選択してください</option>
                  <option *ngFor="let group of userGroups$ | async" [value]="group.id">
                    {{ group.name }}
                  </option>
                </select>
                <small class="form-help">このグループのタスク進捗が自動生成されます</small>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" [disabled]="scheduleForm.invalid || loading" class="btn primary">
              {{ editingSchedule ? '更新' : '作成' }}
            </button>
            <button type="button" (click)="cancelEdit()" *ngIf="editingSchedule" class="btn secondary">
              キャンセル
            </button>
          </div>
        </form>
      </div>

      <!-- スケジュール一覧 -->
      <div class="schedules-section" *ngIf="activeTab === 'schedules'">
        <h2>設定済みスケジュール</h2>
        
        <div *ngIf="(schedules$ | async) as schedules">
          <div *ngIf="schedules.length === 0" class="empty-state">
            <p>まだスケジュールが設定されていません</p>
          </div>
          
          <div *ngFor="let schedule of schedules" class="schedule-card">
            <div class="schedule-header">
              <h3>{{ schedule.title }}</h3>
              <div class="schedule-status">
                <span [class]="schedule.isActive ? 'status-active' : 'status-inactive'">
                  {{ schedule.isActive ? '有効' : '無効' }}
                </span>
              </div>
            </div>
            
            <div class="schedule-details">
              <div class="detail-row">
                <span class="label">頻度:</span>
                <span>{{ getFrequencyLabel(schedule.frequency) }}</span>
              </div>
              <div class="detail-row">
                <span class="label">送信時刻:</span>
                <span>{{ schedule.sendTime }}</span>
              </div>
              <div class="detail-row">
                <span class="label">送信先:</span>
                <span *ngIf="schedule.recipientNames && schedule.recipientNames.length > 0">
                  {{ schedule.recipientNames.join(', ') }}
                </span>
                <span *ngIf="!schedule.recipientNames || schedule.recipientNames.length === 0">
                  {{ schedule.recipientName || schedule.groupName }}
                </span>
              </div>
              <div class="detail-row">
                <span class="label">添付グループ:</span>
                <span>{{ schedule.attachedGroupName }}</span>
              </div>
              <div class="detail-row">
                <span class="label">次回送信:</span>
                <span>{{ formatDate(schedule.nextSendAt) }}</span>
              </div>
              <div class="detail-row" *ngIf="schedule.lastSentAt">
                <span class="label">最終送信:</span>
                <span>{{ formatDate(schedule.lastSentAt) }}</span>
              </div>
            </div>
            
            <div class="schedule-actions">
              <button (click)="editSchedule(schedule)" class="btn small">編集</button>
              <button (click)="toggleScheduleActive(schedule)" class="btn small" [class]="schedule.isActive ? 'secondary' : 'primary'">
                {{ schedule.isActive ? '無効化' : '有効化' }}
              </button>
              <button (click)="deleteSchedule(schedule.id)" class="btn small danger">削除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 2rem;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      text-align: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      position: relative;
    }

    .back-btn {
      position: absolute;
      left: 2rem;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(102, 126, 234, 0.1);
      border: 2px solid rgba(102, 126, 234, 0.3);
      color: #667eea;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .back-btn:hover {
      background: rgba(102, 126, 234, 0.2);
      transform: translateY(-50%) scale(1.05);
    }

    .header h1 {
      color: #2d3748;
      margin-bottom: 10px;
      font-size: 1.8rem;
      font-weight: 700;
    }

    .header p {
      color: #718096;
      margin: 0;
    }

    .tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 0.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .tab-btn {
      flex: 1;
      padding: 1rem 2rem;
      border: none;
      background: transparent;
      color: #718096;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      border-radius: 0.75rem;
      transition: all 0.2s ease;
    }

    .tab-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
    }

    .tab-btn:hover:not(.active) {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
    }

    .create-section, .schedules-section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      box-sizing: border-box;
    }

    .form-section {
      margin: 20px 0;
      padding: 20px;
      background: rgba(248, 249, 250, 0.8);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      overflow: visible;
      box-sizing: border-box;
    }

    .form-section h3 {
      margin: 0 0 15px 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
    }

    .form-row {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
      width: 100%;
      box-sizing: border-box;
      overflow: visible;
    }

    .form-group {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      overflow: visible;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
      color: #495057;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      font-size: 14px;
      background: rgba(255, 255, 255, 0.9);
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      background: white;
    }

    .form-group textarea {
      resize: vertical;
      min-height: 100px;
    }

    .radio-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .radio-group label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: normal;
      white-space: nowrap;
      cursor: pointer;
    }

    .radio-group input[type="radio"] {
      width: auto;
      margin: 0;
    }

    .form-group {
      position: relative;
      overflow: visible;
    }

    .dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 2px solid rgba(102, 126, 234, 0.3);
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      min-width: 100%;
      width: 100%;
    }

    .dropdown-item {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f1f3f4;
      transition: background-color 0.2s ease;
    }

    .dropdown-item:hover {
      background: rgba(102, 126, 234, 0.1);
      color: #667eea;
    }

    .dropdown-item:last-child {
      border-bottom: none;
    }

    .user-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f3f4;
      transition: background-color 0.2s ease;
      min-height: 60px;
      white-space: nowrap;
    }

    .user-item:hover {
      background: rgba(102, 126, 234, 0.1);
    }

    .user-item:last-child {
      border-bottom: none;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .default-avatar {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
    }

    .user-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .user-name {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .user-email {
      font-size: 12px;
      color: #718096;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .user-selection {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .selected-icon {
      color: #667eea;
      font-weight: bold;
      font-size: 16px;
    }

    .selected-users {
      margin-top: 16px;
      padding: 16px;
      background: rgba(102, 126, 234, 0.05);
      border: 2px solid rgba(102, 126, 234, 0.2);
      border-radius: 8px;
    }

    .selected-users h4 {
      margin: 0 0 12px 0;
      color: #667eea;
      font-size: 14px;
      font-weight: 600;
    }

    .selected-users-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .selected-user-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: white;
      border: 1px solid rgba(102, 126, 234, 0.3);
      border-radius: 6px;
    }

    .selected-user-item .user-avatar {
      width: 32px;
      height: 32px;
    }

    .selected-user-item .user-name {
      font-size: 14px;
      margin-bottom: 1px;
    }

    .selected-user-item .user-email {
      font-size: 11px;
    }

    .remove-btn {
      background: rgba(229, 62, 62, 0.1);
      border: none;
      color: #e53e3e;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .remove-btn:hover {
      background: rgba(229, 62, 62, 0.2);
      transform: scale(1.1);
    }

    .clear-btn {
      background: rgba(229, 62, 62, 0.1);
      border: none;
      color: #e53e3e;
      cursor: pointer;
      font-size: 16px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .clear-btn:hover {
      background: rgba(229, 62, 62, 0.2);
      transform: scale(1.1);
    }

    .form-help {
      color: #6c757d;
      font-size: 12px;
      margin-top: 5px;
    }

    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }

    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
    }

    .btn.primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
    }

    .btn.secondary {
      background: rgba(108, 117, 125, 0.9);
      color: white;
      box-shadow: 0 2px 4px rgba(108, 117, 125, 0.3);
    }

    .btn.secondary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(108, 117, 125, 0.4);
    }

    .btn.danger {
      background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
      color: white;
      box-shadow: 0 2px 4px rgba(229, 62, 62, 0.3);
    }

    .btn.danger:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(229, 62, 62, 0.4);
    }

    .btn.small {
      padding: 8px 16px;
      font-size: 12px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      background: #e2e8f0;
      color: #a0aec0;
    }

    .btn.primary:disabled {
      background: #e2e8f0;
      color: #a0aec0;
    }

    .schedule-card {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
    }

    .schedule-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .schedule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .schedule-header h3 {
      margin: 0;
      color: #2c3e50;
    }

    .status-active {
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(72, 187, 120, 0.3);
    }

    .status-inactive {
      background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(229, 62, 62, 0.3);
    }

    .schedule-details {
      margin-bottom: 15px;
    }

    .detail-row {
      display: flex;
      margin-bottom: 5px;
    }

    .detail-row .label {
      font-weight: 500;
      width: 100px;
      color: #6c757d;
    }

    .schedule-actions {
      display: flex;
      gap: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 40px;
      color: #718096;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 12px;
      border: 2px dashed rgba(255, 255, 255, 0.3);
    }

    .empty-state h3 {
      color: #2d3748;
      margin-bottom: 10px;
    }

    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      .header {
        padding: 1rem;
      }

      .back-btn {
        left: 1rem;
        padding: 6px 12px;
        font-size: 12px;
      }


      .tabs {
        flex-direction: column;
        gap: 0.5rem;
      }

      .tab-btn {
        padding: 0.75rem 1rem;
      }

      .create-section, .schedules-section {
        padding: 1rem;
      }

      .form-section {
        padding: 15px;
      }

      .form-row {
        flex-direction: column;
        gap: 10px;
      }

      .form-group input,
      .form-group select,
      .form-group textarea {
        padding: 10px 12px;
      }

      .radio-group {
        flex-direction: column;
        gap: 10px;
      }

      .radio-group label {
        justify-content: flex-start;
      }
      
      .schedule-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      
      .schedule-actions {
        flex-wrap: wrap;
      }

      .dropdown {
        max-height: 250px;
        left: 0;
        right: 0;
        width: 100%;
      }

      .user-item {
        min-height: 50px;
        padding: 8px 12px;
        gap: 8px;
      }

      .user-avatar {
        width: 32px;
        height: 32px;
      }

      .user-name {
        font-size: 14px;
        max-width: 150px;
      }

      .user-email {
        font-size: 11px;
        max-width: 150px;
      }

      .selected-users {
        padding: 12px;
      }

      .selected-user-item {
        padding: 6px 8px;
        gap: 8px;
      }

      .selected-user-item .user-avatar {
        width: 28px;
        height: 28px;
      }

      .selected-user-item .user-name {
        font-size: 13px;
      }

      .selected-user-item .user-email {
        font-size: 10px;
      }
    }
  `]
})
export class AutoReportSchedulePage implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private autoReportScheduleService = inject(AutoReportScheduleService);
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private authService = inject(AuthService);

  private destroy$ = new Subject<void>();

  scheduleForm: FormGroup;
  schedules$!: Observable<AutoReportSchedule[]>;
  userGroups$!: Observable<Group[]>;
  allUsers$!: Observable<User[]>;

  // フォーム関連
  userSearchTerm = '';
  filteredUsers: User[] = [];
  selectedUsers: User[] = [];
  showUserDropdown = false;

  // 状態管理
  loading = false;
  editingSchedule: AutoReportSchedule | null = null;
  activeTab: 'create' | 'schedules' = 'create';

  constructor() {
    this.scheduleForm = this.fb.group({
      title: ['', Validators.required],
      frequency: ['weekly', Validators.required],
      sendTime: ['09:00', Validators.required],
      startDate: [new Date().toISOString().split('T')[0], Validators.required],
      attachedGroupId: ['']
    });
  }

  ngOnInit(): void {
    try {
      this.loadSchedules();
      this.loadUserGroups();
      this.loadAllUsers();
    } catch (error) {
      console.error('自動送信設定ページ初期化エラー:', error);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSchedules(): void {
    // 現在のユーザーIDを取得
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.schedules$ = this.autoReportScheduleService.getUserSchedules(currentUser.uid).pipe(
        map(schedules => {
          // クライアント側でソート（作成日時の降順）
          return schedules.sort((a, b) => {
            const aTime = a.createdAt?.toDate()?.getTime() || 0;
            const bTime = b.createdAt?.toDate()?.getTime() || 0;
            return bTime - aTime;
          });
        })
      );
      this.schedules$.subscribe(schedules => {
        // スケジュール読み込み完了
      });
    }
  }

  private loadUserGroups(): void {
    // 現在のユーザーのグループを取得
    const currentUser = this.authService.currentUser;
    if (currentUser) {
      this.userGroups$ = this.groupService.getUserGroups(currentUser.uid);
    }
  }

  private loadAllUsers(): void {
    this.allUsers$ = this.userService.getAllUsers();
  }

  onUserSearch(): void {
    if (this.userSearchTerm.length < 2) {
      this.filteredUsers = [];
      this.showUserDropdown = false;
      return;
    }

    this.allUsers$.pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.filteredUsers = users.filter(user => {
        // 自分を除外
        const currentUser = this.authService.currentUser;
        if (user.id === currentUser?.uid) {
          return false;
        }
        return (user.displayName?.toLowerCase().includes(this.userSearchTerm.toLowerCase()) ||
               user.email?.toLowerCase().includes(this.userSearchTerm.toLowerCase()));
      }).slice(0, 10);
      this.showUserDropdown = this.filteredUsers.length > 0;
    });
  }

  toggleUserSelection(user: User): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
    this.userSearchTerm = '';
    this.showUserDropdown = false;
    this.filteredUsers = [];
  }

  isUserSelected(user: User): boolean {
    return this.selectedUsers.some(u => u.id === user.id);
  }

  removeUser(user: User): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    }
  }

  getUserInitials(user: User): string {
    if (user.displayName) {
      return user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (user.email) {
      return user.email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'U';
  }

  markFormGroupTouched(): void {
    Object.keys(this.scheduleForm.controls).forEach(key => {
      const control = this.scheduleForm.get(key);
      control?.markAsTouched();
    });
  }

  onSubmit(): void {
    console.log('onSubmit called');
    console.log('Form valid:', this.scheduleForm.valid);
    console.log('Form value:', this.scheduleForm.value);
    
    // カスタムバリデーション
    if (this.selectedUsers.length === 0) {
      alert('送信先のユーザーを選択してください');
      return;
    }
    
    if (this.scheduleForm.invalid) {
      console.log('Form is invalid');
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      console.error('ユーザーが認証されていません');
      this.loading = false;
      return;
    }

    // グループ名を取得するためにObservableを使用
    this.userGroups$.pipe(takeUntil(this.destroy$)).subscribe(groups => {
      const formValue = this.scheduleForm.value;
      const attachedGroup = groups.find(g => g.id === formValue.attachedGroupId);
      const attachedGroupName = attachedGroup?.name;

      // 次の送信日時を計算
      const startDate = new Date(formValue.startDate);
      const [hours, minutes] = formValue.sendTime.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
      
      const scheduleData: any = {
        userId: currentUser.uid,
        title: formValue.title,
        frequency: formValue.frequency,
        startDate: Timestamp.fromDate(new Date(formValue.startDate)),
        sendTime: formValue.sendTime,
        recipientType: 'person',
        recipientIds: this.selectedUsers.map(user => user.id),
        recipientNames: this.selectedUsers.map(user => user.displayName || user.email?.split('@')[0] || 'ユーザー'),
        nextSendAt: Timestamp.fromDate(startDate),
        isActive: true
      };

      // 添付グループの設定（空でない場合のみ）
      if (formValue.attachedGroupId && formValue.attachedGroupId.trim() !== '') {
        scheduleData.attachedGroupId = formValue.attachedGroupId;
        if (attachedGroupName) {
          scheduleData.attachedGroupName = attachedGroupName;
        }
      }

      console.log('Schedule data:', scheduleData);

      if (this.editingSchedule) {
        this.autoReportScheduleService.updateSchedule(this.editingSchedule.id, scheduleData)
          .then(() => {
            this.loading = false;
            this.cancelEdit();
            this.loadSchedules(); // スケジュール一覧を再読み込み
            alert('スケジュールが更新されました！');
          })
          .catch(error => {
            console.error('スケジュール更新エラー:', error);
            this.loading = false;
            alert('スケジュールの更新に失敗しました: ' + error.message);
          });
      } else {
        this.autoReportScheduleService.createSchedule(scheduleData)
          .then((scheduleId) => {
            console.log('Schedule created with ID:', scheduleId);
            this.loading = false;
            this.scheduleForm.reset();
            this.selectedUsers = [];
            
            // 少し遅延を入れてからリストを更新
            setTimeout(() => {
              this.loadSchedules(); // スケジュール一覧を再読み込み
              this.activeTab = 'schedules'; // 設定済みスケジュールタブに切り替え
            }, 500);
            
            alert('スケジュールが作成されました！');
          })
          .catch(error => {
            console.error('スケジュール作成エラー:', error);
            this.loading = false;
            alert('スケジュールの作成に失敗しました: ' + error.message);
          });
      }
    });
  }

  editSchedule(schedule: AutoReportSchedule): void {
    this.editingSchedule = schedule;
    this.activeTab = 'create'; // 新規作成タブに切り替え
    
    this.scheduleForm.patchValue({
      title: schedule.title,
      frequency: schedule.frequency,
      sendTime: schedule.sendTime,
      startDate: schedule.startDate.toDate().toISOString().split('T')[0],
      attachedGroupId: schedule.attachedGroupId
    });

    if (schedule.recipientIds && schedule.recipientIds.length > 0) {
      this.allUsers$.pipe(takeUntil(this.destroy$)).subscribe(users => {
        this.selectedUsers = users.filter(u => schedule.recipientIds!.includes(u.id));
      });
    }
  }

  cancelEdit(): void {
    this.editingSchedule = null;
    this.scheduleForm.reset();
    this.selectedUsers = [];
  }

  toggleScheduleActive(schedule: AutoReportSchedule): void {
    this.autoReportScheduleService.updateSchedule(schedule.id, { isActive: !schedule.isActive })
      .then(() => {
        this.loadSchedules(); // スケジュール一覧を再読み込み
      })
      .catch(error => console.error('スケジュール更新エラー:', error));
  }

  deleteSchedule(scheduleId: string): void {
    if (confirm('このスケジュールを削除しますか？')) {
      this.autoReportScheduleService.deleteSchedule(scheduleId)
        .then(() => {
          this.loadSchedules(); // スケジュール一覧を再読み込み
        })
        .catch(error => console.error('スケジュール削除エラー:', error));
    }
  }


  getFrequencyLabel(frequency: string): string {
    switch (frequency) {
      case 'daily': return '毎日';
      case 'weekly': return '毎週';
      case 'monthly': return '毎月';
      default: return frequency;
    }
  }

  formatDate(timestamp: Timestamp): string {
    return timestamp.toDate().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  setActiveTab(tab: 'create' | 'schedules'): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.router.navigate(['/progress-reports']);
  }

}