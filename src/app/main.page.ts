import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { NotificationService } from './notification.service';
import { User, Group, TaskItem, Notification, CalendarEvent } from './models';
import { Observable, Subscription, combineLatest, of, Subject } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Firestore, collection, addDoc, serverTimestamp, query, where, collectionData, updateDoc, doc, deleteDoc } from '@angular/fire/firestore';
import { map, switchMap, take, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="main-container">
      <!-- ヘッダー -->
      <header class="header">
        <div class="header-left">
          <h1 class="app-title">
            <div class="title-main">AMA</div>
            <div class="title-sub">assignment management app</div>
          </h1>
        </div>
        <div class="header-right">
          <div class="notification-container">
            <button class="notification-btn" routerLink="/notifications">
              🔔
              <div class="notification-badge" *ngIf="unreadNotifications > 0">
                {{ unreadNotifications }}
              </div>
            </button>
          </div>
          <div class="user-info">
            <span class="user-name">{{ getUserDisplayName() }}</span>
            <button class="logout-btn" (click)="logout()">ログアウト</button>
          </div>
        </div>
      </header>

      <!-- メインコンテンツ -->
      <main class="main-content">
        <!-- 上部アクションボタン -->
        <div class="action-buttons">
          <button class="action-btn primary" routerLink="/progress-reports">
            📊 進捗報告
          </button>
          
          <button class="action-btn secondary" routerLink="/group/create">
            👥 グループ作成
          </button>
          <button class="action-btn secondary" routerLink="/groups">
            📋 グループ一覧
          </button>
        </div>

        <!-- コンテンツエリア -->
        <div class="content-grid">
          <!-- 左側：カレンダー -->
          <div class="calendar-section">
            <div class="section-header">
              <h2>📅 カレンダー</h2>
              <button class="add-event-btn" (click)="showCreateEventModal()">+</button>
            </div>
            
            <!-- 今日の情報 -->
            <div class="today-info">
              <div class="today-date-time">
                <div class="today-date">{{ todayDate }}</div>
                <div class="today-time">{{ currentTime }}</div>
              </div>
              <div class="today-day" [class.saturday]="isSaturday" [class.sunday]="isSunday">
                {{ todayDayOfWeek }}
              </div>
            </div>
            <div class="calendar-container">
              <div class="calendar-header">
                <button class="nav-btn" (click)="previousMonth()">‹</button>
                <h3>{{ currentMonth }}</h3>
                <button class="nav-btn" (click)="nextMonth()">›</button>
              </div>
              <div class="calendar-grid">
                <div class="calendar-day" 
                     *ngFor="let day of calendarDays" 
                     [class.other-month]="!day.isCurrentMonth"
                     [class.has-events]="day.events.length > 0"
                     [class.saturday]="day.isSaturday"
                     [class.sunday]="day.isSunday"
                     (click)="selectDate(day)">
                  <span class="day-number">{{ day.day }}</span>
                  <div class="day-events" *ngIf="day.events.length > 0">
                    <div class="event-dot" 
                         *ngFor="let event of day.events.slice(0, 3)"
                         [class]="'event-' + event.type"></div>
                    <span class="more-events" *ngIf="day.events.length > 3">
                      +{{ day.events.length - 3 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <!-- 選択日の予定一覧はモーダルで表示に変更 -->
          </div>

          <!-- 右側：グループと課題 -->
          <div class="right-section">
            <!-- 参加しているグループ -->
            <div class="groups-section">
              <div class="section-header">
                <h2>👥 参加しているグループ</h2>
                <button class="create-group-btn" routerLink="/group/create">+ 作成</button>
              </div>
              <div class="groups-container">
                <div class="groups-list" *ngIf="userGroups$ | async as groups; else noGroups">
                  <a class="group-item" 
                     *ngFor="let group of groups" 
                     [routerLink]="['/group', group.id]">
                    <div class="group-info">
                      <h3 class="group-name">{{ group.name }}</h3>
            <div class="group-stats">
              <span class="member-count">👥 {{ getGroupMemberCount(group.id) }}人</span>
            </div>
                    </div>
                    <div class="group-actions">
                      <button class="action-btn small" (click)="openGroup(group); $event.stopPropagation()">
                        開く
                      </button>
                    </div>
                  </a>
                </div>
                <ng-template #noGroups>
                  <div class="empty-state">
                    <p>参加しているグループがありません</p>
                    <button class="create-group-btn" routerLink="/group/create">
                      最初のグループを作成
                    </button>
                  </div>
                </ng-template>
              </div>
            </div>

            <!-- 直近の課題 -->
            <div class="tasks-section">
              <div class="section-header">
                <h2>📋 直近の課題</h2>
                <button class="view-all-btn" (click)="viewAllTasks()">すべて表示</button>
              </div>
              <div class="tasks-container">
                <div class="tasks-list" *ngIf="recentTasks$ | async as tasks; else noTasks">
                  <div class="task-item" 
                       *ngFor="let task of tasks" 
                       [class]="'priority-' + task.priority"
                       (click)="openTask(task)">
                    <div class="task-header">
                      <h4 class="task-title">{{ task.title }}</h4>
                      <span class="task-status" [class]="'status-' + task.status">
                        {{ getStatusLabel(task.status) }}
                      </span>
                    </div>
                    <div class="task-meta">
                      <span class="task-group">📁 {{ getGroupName(task.groupId) }}</span>
                      <span class="task-due" *ngIf="task.dueDate">
                        📅 {{ formatDate(task.dueDate) }}
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
                <ng-template #noTasks>
                  <div class="empty-state">
                    <p>直近の課題はありません</p>
                  </div>
                </ng-template>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- 予定作成モーダル -->
      <div class="modal-overlay" *ngIf="showEventModal" (click)="hideCreateEventModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">予定を作成</h2>
            <button class="modal-close" (click)="hideCreateEventModal()">×</button>
          </div>
          <form [formGroup]="eventForm" (ngSubmit)="createCalendarEvent()" class="modal-form">
            <div class="form-group">
              <label class="form-label">タイトル</label>
              <input type="text" formControlName="title" class="form-input" placeholder="予定のタイトル" />
            </div>
            <div class="form-group">
              <label class="form-label">メモ</label>
              <textarea formControlName="description" class="form-textarea" rows="3" placeholder="メモ"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">カラー</label>
              <div class="color-palette">
                <button type="button" class="color-dot" *ngFor="let c of colorOptions" [style.background]="c" (click)="eventForm.patchValue({color: c})" [class.active]="eventForm.get('color')?.value === c"></button>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">開始</label>
                <input type="datetime-local" formControlName="start" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label">終了</label>
                <input type="datetime-local" formControlName="end" class="form-input" />
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="hideCreateEventModal()">キャンセル</button>
              <button type="submit" class="btn primary" [disabled]="eventForm.invalid || loading">{{ loading ? '作成中...' : '作成' }}</button>
            </div>
          </form>
        </div>
      </div>


      <!-- 日の予定一覧モーダル -->
      <div class="modal-overlay" *ngIf="showDayEventsModal" (click)="hideDayEventsModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">{{ selectedDate | date:'yyyy/MM/dd (EEE)' }} の予定</h2>
            <button class="modal-close" (click)="hideDayEventsModal()">×</button>
          </div>
          <div class="modal-form">
            <div class="day-events-actions">
              <button class="btn primary" (click)="createEventForSelectedDate()">
                + この日に予定を作成
              </button>
            </div>
            <div *ngIf="selectedDayEvents.length === 0" class="empty-state">
              <p>予定はありません</p>
            </div>
            <div class="events-list" *ngIf="selectedDayEvents.length > 0">
              <div class="event-row" *ngFor="let ev of selectedDayEvents" [class]="'event-' + ev.type" [style.background]="ev.color || '#111827'" [style.color]="'#ffffff'">
                <div class="event-time">{{ formatTimeRange(ev.startDate, ev.endDate) }}</div>
                <div class="event-title">{{ ev.title }}</div>
                <div class="event-type">{{ getEventTypeLabel(ev.type) }}</div>
                <div class="event-actions" *ngIf="ev.type !== 'task_due'">
                  <button class="btn small success" (click)="openEditEvent(ev)">編集</button>
                  <button class="btn danger small" (click)="deleteEvent(ev)">削除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .main-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .app-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .title-main {
      font-size: 2.2rem;
      font-weight: 900;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradientShift 3s ease-in-out infinite;
      text-shadow: 0 0 30px rgba(102, 126, 234, 0.3);
      letter-spacing: -0.02em;
    }

    .title-sub {
      font-size: 0.9rem;
      font-weight: 500;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      opacity: 0.8;
      margin-top: 0.2rem;
    }

    @keyframes gradientShift {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .notification-btn {
      background: #f3f4f6; /* 薄いグレー */
      border: 1px solid #e5e7eb;
      font-size: 1.25rem;
      cursor: pointer;
      position: relative;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px; /* 丸 */
      transition: background-color 0.2s, border-color 0.2s;
    }

    .notification-btn:hover {
      background-color: #e5e7eb;
      border-color: #d1d5db;
    }

    .notification-container {
      position: relative;
    }

    .notification-badge {
      position: absolute;
      top: -0.25rem;
      right: -0.25rem;
      background: #e53e3e;
      color: white;
      border-radius: 50%;
      width: 1.25rem;
      height: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: bold;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .user-name {
      font-weight: 500;
      color: #2d3748;
    }

    .logout-btn {
      background: #e53e3e;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 0.875rem;
      transition: background-color 0.2s;
    }

    .logout-btn:hover {
      background: #c53030;
    }

    .main-content {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .action-buttons {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 1rem;
    }

    .action-btn.primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .action-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .action-btn.secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .action-btn.secondary:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .action-btn.small {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .calendar-section, .right-section {
      background: white;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .today-info {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .today-date-time {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .today-date {
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .today-time {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .today-day {
      font-size: 1rem;
      font-weight: 500;
      text-align: right;
    }

    .today-day.saturday {
      color: #93c5fd;
    }

    .today-day.sunday {
      color: #fca5a5;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #f7fafc;
    }

    .section-header h2 {
      margin: 0;
      color: #2d3748;
      font-size: 1.25rem;
      font-weight: 600;
    }

    .add-event-btn, .create-group-btn, .view-all-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .calendar-container {
      background: #f7fafc;
      border-radius: 0.75rem;
      padding: 1rem;
    }

    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .calendar-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 1.125rem;
    }

    .nav-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #4a5568;
      padding: 0.25rem;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.25rem;
    }

    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0.25rem;
      border-radius: 0.375rem;
      cursor: pointer;
      transition: background-color 0.2s;
      position: relative;
    }

    .calendar-day:hover {
      background-color: rgba(102, 126, 234, 0.1);
    }

    .calendar-day.other-month {
      opacity: 0.3;
    }

    .calendar-day.has-events {
      background-color: rgba(102, 126, 234, 0.1);
    }

    .calendar-day.saturday {
      background-color: rgba(147, 197, 253, 0.2);
    }

    .calendar-day.sunday {
      background-color: rgba(252, 165, 165, 0.2);
    }

    .day-number {
      font-size: 0.875rem;
      font-weight: 500;
      color: #2d3748;
    }

    .day-events {
      display: flex;
      flex-wrap: wrap;
      gap: 0.125rem;
      margin-top: 0.25rem;
    }

    .event-dot {
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
    }

    .event-personal { background: #4299e1; }
    .event-task_due { background: #e53e3e; }
    /* milestone color removed */

    .more-events {
      font-size: 0.625rem;
      color: #4a5568;
    }

    .day-events-panel { margin-top: 1rem; background: #fff; border-radius: 0.75rem; padding: 1rem; }
    .events-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .event-row { display: grid; grid-template-columns: 110px 1fr auto; gap: 0.75rem; padding: 0.75rem; border-radius: 0.5rem; }
    .event-time { color: #ffffff; font-size: 0.9rem; font-weight:600; }
    .event-title { font-weight: 700; color: #ffffff; }
    .event-type { font-size: 0.8rem; color: #f3f4f6; }
    .event-actions { display:flex; gap:.5rem; justify-content:flex-end; align-items:center; }
    .event-actions .btn {
      border:none !important;
      padding:.45rem .9rem;
      border-radius:.45rem;
      font-weight:600;
      -webkit-appearance:none;
      appearance:none;
      white-space: nowrap;
      color:#ffffff;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      line-height: 1;
    }
    .event-actions .btn.success { background-color:#3b82f6 !important; } /* 明るめの青 */
    .event-actions .btn.success:hover { background-color:#2563eb !important; }
    .btn.tertiary { background: rgba(255,255,255,0.15); color:#fff; }
    .btn.tertiary:hover { background: rgba(255,255,255,0.28); }
    .btn.success { background-color: #16a34a !important; color:#ffffff !important; border:none !important; }
    .btn.success:hover { background-color: #15803d !important; }
    .btn.danger { background-color: #ef4444 !important; color:#ffffff !important; border:none !important; }
    .btn.danger:hover { background-color: #dc2626 !important; }
    .btn.small { font-size: .85rem; line-height:1; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items:center; justify-content:center; z-index: 1000; }
    .modal { background:#fff; border-radius: 0.75rem; width: 90%; max-width: 560px; overflow: hidden; }
    .modal-header { display:flex; justify-content:space-between; align-items:center; padding: 1rem 1.25rem; border-bottom:1px solid #e5e7eb; }
    .modal-title { margin:0; font-size:1.125rem; color:#1f2937; }
    .modal-close { background:none; border:none; font-size:1.25rem; cursor:pointer; color:#6b7280; }
    .modal-form { padding: 1rem 1.25rem; }
    .form-group { margin-bottom: 1rem; }
    .form-row { display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-label { display:block; margin-bottom: .375rem; color:#374151; font-weight:500; }
    .form-input, .form-textarea { width:100%; max-width:100%; box-sizing:border-box; padding:.625rem .75rem; border:1px solid #d1d5db; border-radius:.5rem; font-size:.95rem; }
    .form-textarea { min-height: 80px; }
    .modal-actions { display:flex; justify-content:flex-end; gap:.75rem; margin-top: 1rem; }
    .day-events-actions { margin-bottom: 1rem; }
    .btn.primary { background:#667eea; color:#fff; border:none; padding:.5rem 1rem; border-radius:.5rem; }
    .btn.secondary { background:#e5e7eb; color:#374151; border:none; padding:.5rem 1rem; border-radius:.5rem; }

    .color-palette { display:flex; gap:.5rem; flex-wrap:wrap; }
    .color-dot { width: 28px; height:28px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 0 1px #d1d5db; cursor:pointer; }
    .color-dot.active { box-shadow:0 0 0 2px #667eea; }

    .groups-list, .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .group-item, .task-item {
      background: #f7fafc;
      border-radius: 0.75rem;
      padding: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .group-item:hover, .task-item:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .group-info {
      margin-bottom: 0.75rem;
    }

    .group-name, .task-title {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
      font-size: 1rem;
      font-weight: 600;
    }

    .group-description {
      margin: 0 0 0.75rem 0;
      color: #4a5568;
      font-size: 0.875rem;
    }

    .group-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: #718096;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.5rem;
    }

    .task-status {
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .status-not_started { background: #fed7d7; color: #c53030; }
    .status-in_progress { background: #feebc8; color: #dd6b20; }
    .status-completed { background: #c6f6d5; color: #2f855a; }

    .task-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      color: #718096;
      margin-bottom: 0.75rem;
    }

    .task-progress {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .progress-bar {
      flex: 1;
      height: 0.5rem;
      background: #e2e8f0;
      border-radius: 0.25rem;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      transition: width 0.3s;
    }

    .progress-text {
      font-size: 0.75rem;
      font-weight: 500;
      color: #4a5568;
    }

    .priority-low { border-left: 4px solid #38a169; }
    .priority-medium { border-left: 4px solid #4299e1; }
    .priority-high { border-left: 4px solid #ed8936; }
    .priority-urgent { border-left: 4px solid #e53e3e; }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #718096;
    }

    .empty-state p {
      margin: 0 0 1rem 0;
    }

    .groups-section,
    .tasks-section {
      margin-bottom: 2rem;
    }

    .groups-container,
    .tasks-container {
      max-height: 300px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }

    .groups-container::-webkit-scrollbar,
    .tasks-container::-webkit-scrollbar {
      width: 6px;
    }

    .groups-container::-webkit-scrollbar-track,
    .tasks-container::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }

    .groups-container::-webkit-scrollbar-thumb,
    .tasks-container::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 3px;
    }

    .groups-container::-webkit-scrollbar-thumb:hover,
    .tasks-container::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }

    

    /* レスポンシブ */
    @media (max-width: 1024px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }

      .header {
        padding: 1rem;
        flex-direction: column;
        gap: 1rem;
      }

      .action-buttons {
        flex-direction: column;
      }

      .calendar-grid {
        gap: 0.125rem;
      }

      .calendar-day {
        padding: 0.125rem;
      }

      .day-number {
        font-size: 0.75rem;
      }
    }
  `]
})
export class MainPage implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private notificationService = inject(NotificationService);
  private firestore = inject(Firestore);

  currentUser: User | null = null;
  userGroups$: Observable<Group[]> = of([]);
  private userGroupsCache: Group[] = [];
  recentTasks$: Observable<TaskItem[]> = of([]);
  unreadNotifications = 0;
  private destroy$ = new Subject<void>();
  currentMonth = '';
  calendarDays: any[] = [];
  allEvents: CalendarEvent[] = [];
  selectedDate: Date | null = null;
  selectedDayEvents: CalendarEvent[] = [];
  showDayEventsModal = false;
  
  // 今日の情報
  todayDate = '';
  currentTime = '';
  todayDayOfWeek = '';
  isSaturday = false;
  isSunday = false;
  
  private subscriptions: Subscription[] = [];
  private calendarSubscriptions: Subscription[] = [];
  private memberCountSubs: { [groupId: string]: Subscription } = {};
  private timeInterval: any;
  showEventModal = false;
  loading = false;
  private fb = inject(FormBuilder);
  colorOptions: string[] = ['#ef4444','#f59e0b','#eab308','#22c55e','#3b82f6','#6366f1','#a855f7'];
  eventForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    description: [''],
    start: ['', [Validators.required]],
    end: ['', [Validators.required]],
    color: ['#3b82f6']
  });

  ngOnInit() {
    this.loadUserData();
    this.initializeCalendar();
    this.initializeTodayInfo();
    
    // 通知ページから戻ってきた時に通知数を更新
    this.router.events.pipe(
      takeUntil(this.destroy$)
    ).subscribe(event => {
      if (event instanceof NavigationEnd && event.url === '/main') {
        this.loadNotifications();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.calendarSubscriptions.forEach(sub => sub.unsubscribe());
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
  }

  private loadUserData() {
    const sub = this.auth.currentUser$.subscribe(user => {
      if (user) {
        // FirestoreのユーザープロファイルからdisplayNameを優先して取得
        this.userService.getUserProfile(user.uid).then(profile => {
          this.currentUser = {
            id: user.uid,
            email: user.email || '',
            displayName: profile?.displayName || user.displayName || undefined,
            photoURL: user.photoURL || undefined,
            role: 'user',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          // ユーザーデータが設定された後にグループと課題を読み込み
          this.loadGroups();
          this.loadRecentTasks();
          // カレンダーイベントも購読開始
          this.loadCalendarEvents();
          // 通知は最後に読み込み（currentUserが確実に設定された後）
          this.loadNotifications();
        });
      } else {
        this.currentUser = null;
        this.userGroups$ = of([]);
        this.recentTasks$ = of([]);
        this.unreadNotifications = 0;
      }
    });
    this.subscriptions.push(sub);
  }

  private loadGroups() {
    if (this.currentUser) {
      const obs = this.groupService.getUserGroups(this.currentUser.id);
      this.userGroups$ = obs;
      // キャッシュして同期参照に使用
      obs.pipe(take(1)).subscribe(groups => {
        this.userGroupsCache = groups;
        // メンバー数購読を更新
        this.setupMemberCountSubscriptions(groups.map(g => g.id));
      });
    } else {
      this.userGroups$ = of([]);
      this.userGroupsCache = [];
      this.teardownMemberCountSubscriptions();
    }
  }

  private setupMemberCountSubscriptions(groupIds: string[]) {
    // 既存購読を解除
    this.teardownMemberCountSubscriptions();
    if (!this.currentUser) return;
    // 各グループのメンバー数を購読
    groupIds.forEach(groupId => {
      const sub = collectionData(
        query(collection(this.firestore, 'groupMemberships'), where('groupId', '==', groupId)),
        { idField: 'id' }
      ).subscribe((members: any[]) => {
        this._groupIdToMemberCount[groupId] = (members || []).length;
      });
      this.memberCountSubs[groupId] = sub;
    });
  }

  private teardownMemberCountSubscriptions() {
    Object.values(this.memberCountSubs).forEach(sub => sub.unsubscribe());
    this.memberCountSubs = {};
    this._groupIdToMemberCount = {} as any;
  }

  private _groupIdToMemberCount: Record<string, number> = {};

  getGroupMemberCount(groupId: string): number {
    return this._groupIdToMemberCount[groupId] ?? 0;
  }

  private loadRecentTasks() {
    if (this.currentUser) {
      this.recentTasks$ = this.taskService.getRecentTasks(this.currentUser.id, 5);
    } else {
      this.recentTasks$ = of([]);
    }
  }

  private loadNotifications() {
    if (this.currentUser) {
      const sub = this.notificationService.getUnreadCount(this.currentUser.id).subscribe({
        next: (count) => {
          this.unreadNotifications = count;
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          this.unreadNotifications = 0;
        }
      });
      this.subscriptions.push(sub);
    }
  }

  

  private initializeTodayInfo() {
    const now = new Date();
    
    // 日付の設定
    this.todayDate = now.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // 曜日の設定
    this.todayDayOfWeek = now.toLocaleDateString('ja-JP', { weekday: 'long' });
    this.isSaturday = now.getDay() === 6;
    this.isSunday = now.getDay() === 0;
    
    // 時間の更新
    this.updateCurrentTime();
    
    // 1秒ごとに時間を更新
    this.timeInterval = setInterval(() => {
      this.updateCurrentTime();
    }, 1000);
  }

  private updateCurrentTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private initializeCalendar() {
    const now = new Date();
    this.currentMonth = now.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long' 
    });
    this.generateCalendarDays(now);
    this.loadCalendarEvents();
  }

  private loadCalendarEvents() {
    if (!this.currentUser) return;
    // 既存購読を解除
    this.calendarSubscriptions.forEach(s => s.unsubscribe());
    this.calendarSubscriptions = [];

    // 個人予定をライブ購読
    const personalSub = collectionData(
      query(collection(this.firestore, 'calendarEvents'), where('userId', '==', this.currentUser.id)),
      { idField: 'id' }
    ).subscribe(events => {
      const personal = (events as any[]).map(e => ({ ...(e as any) })) as CalendarEvent[];
      // 他ソースとマージは後段で再計算するため、一時保持してから再構築
      this._personalEventsCache = personal;
      this.rebuildAllEvents();
    });
    this.calendarSubscriptions.push(personalSub);

    // 所属グループの課題期限をライブ購読
    const membershipSub = collectionData(
      query(collection(this.firestore, 'groupMemberships'), where('userId', '==', this.currentUser.id)),
      { idField: 'id' }
    ).subscribe((memberships: any[]) => {
      const groupIds: string[] = (memberships || []).map(m => m.groupId).filter(Boolean);
      // Firestore where in は最大10件。10件超の場合は先頭10件のみ（開発簡易対応）
      const targetIds = groupIds.slice(0, 10);
      if (this._tasksSub) this._tasksSub.unsubscribe();
      if (targetIds.length === 0) {
        this._taskDueEventsCache = [];
        this.rebuildAllEvents();
        return;
      }
      this._tasksSub = collectionData(
        query(collection(this.firestore, 'tasks'), where('groupId', 'in', targetIds)),
        { idField: 'id' }
      ).subscribe((tasks: any[]) => {
        const dueEvents: CalendarEvent[] = (tasks || [])
          .filter(t => t.dueDate)
          .map(t => ({
            id: 'task_' + t.id,
            userId: this.currentUser!.id,
            title: `[期限] ${t.title}`,
            startDate: t.dueDate,
            endDate: t.dueDate,
            type: 'task_due',
            relatedId: t.id,
            color: '#ef4444',
            createdAt: new Date() as any
          }));
        this._taskDueEventsCache = dueEvents;
        this.rebuildAllEvents();
      });
      this.calendarSubscriptions.push(this._tasksSub as Subscription);
    });
    this.calendarSubscriptions.push(membershipSub);
  }

  // キャッシュと再構築
  private _personalEventsCache: CalendarEvent[] = [];
  private _taskDueEventsCache: CalendarEvent[] = [];
  private _tasksSub: Subscription | null = null;
  private rebuildAllEvents() {
    this.allEvents = [...this._personalEventsCache, ...this._taskDueEventsCache];
    this.generateCalendarDays(new Date());
    if (this.selectedDate) {
      this.selectedDayEvents = this.getEventsForDate(this.selectedDate);
    }
  }

  // 編集/削除
  openEditEvent(ev: CalendarEvent) {
    // 課題期限・マイルストーンは編集不可（読み取り専用）
    if (ev.type !== 'personal') return;
    this.eventForm.patchValue({
      title: ev.title,
      description: ev.description || '',
      start: this.formatDateTimeLocal(ev.startDate),
      end: this.formatDateTimeLocal(ev.endDate),
      color: ev.color || '#3b82f6'
    });
    (this as any)._editingEventId = ev.id;
    // 予定一覧モーダルを閉じて、編集モーダルを最前面で開く
    this.showDayEventsModal = false;
    this.showEventModal = true;
  }

  async deleteEvent(ev: CalendarEvent) {
    if (ev.type !== 'personal') return;
    if (!confirm('この予定を削除しますか？')) return;
    try {
      await deleteDoc(doc(this.firestore, 'calendarEvents', ev.id));
    } catch (e) {
      console.error('予定削除エラー', e);
    }
  }

  private formatDateTimeLocal(date: any): string {
    const d = (date && date.toDate) ? date.toDate() : new Date(date);
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  private generateCalendarDays(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    this.calendarDays = [];
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      this.calendarDays.push({
        day: currentDate.getDate(),
        date: new Date(currentDate),
        isCurrentMonth: currentDate.getMonth() === month,
        isSaturday: currentDate.getDay() === 6,
        isSunday: currentDate.getDay() === 0,
        events: this.getEventsForDate(currentDate)
      });
    }
  }

  private getEventsForDate(date: Date): CalendarEvent[] {
    // 選択日のイベントを返す（selectedDayEventsは最新に更新される）
    const ymd = date.toDateString();
    return this.allEvents.filter(ev => {
      const sd = (ev.startDate as any)?.toDate ? (ev.startDate as any).toDate() : new Date(ev.startDate);
      return sd.toDateString() === ymd;
    });
  }

  // イベントハンドラー
  async logout() {
    try {
      // すべてのサブスクリプションをクリーンアップ
      this.subscriptions.forEach(sub => sub.unsubscribe());
      this.subscriptions = [];
      
      // カレンダー関連のサブスクリプションもクリーンアップ
      if (this.calendarSubscriptions) {
        this.calendarSubscriptions.forEach(sub => sub.unsubscribe());
        this.calendarSubscriptions = [];
      }
      
      // ログアウト処理
      await this.auth.logout();
      
      // ログインページに遷移
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
      // エラーが発生してもログインページに遷移
      this.router.navigate(['/login']);
    }
  }

  showNotifications() {
    // TODO: 通知一覧モーダルを表示
    console.log('通知一覧を表示');
  }


  

  showGroupManagement() {
    this.router.navigate(['/groups']);
  }

  // 予定作成モーダル
  showCreateEventModal() {
    this.eventForm.reset({ title: '', description: '', start: '', end: '' });
    this.showEventModal = true;
  }

  hideCreateEventModal() {
    this.showEventModal = false;
  }

  createEventForSelectedDate() {
    if (!this.selectedDate) return;
    
    // 選択された日付の9:00と17:00をデフォルトに設定（ローカル時間を使用）
    const year = this.selectedDate.getFullYear();
    const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(this.selectedDate.getDate()).padStart(2, '0');
    const selectedDateStr = `${year}-${month}-${day}`;
    const startDateTime = `${selectedDateStr}T09:00`;
    const endDateTime = `${selectedDateStr}T17:00`;
    
    // フォームをリセットしてから値を設定
    this.eventForm.reset();
    this.eventForm.patchValue({
      title: '',
      description: '',
      start: startDateTime,
      end: endDateTime,
      color: '#3b82f6'
    });
    
    // 日付選択モーダルを閉じて、予定作成モーダルを開く
    this.hideDayEventsModal();
    this.showEventModal = true;
  }

  previousMonth() {
    const currentDate = new Date(this.calendarDays[15].date);
    currentDate.setMonth(currentDate.getMonth() - 1);
    this.currentMonth = currentDate.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long' 
    });
    this.generateCalendarDays(currentDate);
  }

  nextMonth() {
    const currentDate = new Date(this.calendarDays[15].date);
    currentDate.setMonth(currentDate.getMonth() + 1);
    this.currentMonth = currentDate.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: 'long' 
    });
    this.generateCalendarDays(currentDate);
  }

  async createCalendarEvent() {
    if (this.eventForm.invalid || !this.currentUser) return;
    this.loading = true;
    const v = this.eventForm.getRawValue();
    try {
      const start = new Date(v.start as string);
      const end = new Date(v.end as string);
      const editingId = (this as any)._editingEventId as string | undefined;
      if (editingId) {
        // 更新
        await updateDoc(doc(this.firestore, 'calendarEvents', editingId), {
          title: v.title,
          description: v.description || '',
          startDate: start,
          endDate: end,
          color: v.color || '#3b82f6'
        });
      } else {
        // 新規作成
        await addDoc(collection(this.firestore, 'calendarEvents'), {
          userId: this.currentUser.id,
          title: v.title,
          description: v.description || '',
          startDate: start,
          endDate: end,
          type: 'personal',
          color: v.color || '#3b82f6',
          createdAt: serverTimestamp()
        });
      }
      (this as any)._editingEventId = undefined;
      this.hideCreateEventModal();
    } finally {
      this.loading = false;
    }
  }

  selectDate(day: any) {
    this.selectedDate = day.date;
    this.selectedDayEvents = this.getEventsForDate(day.date);
    this.showDayEventsModal = true;
  }

  hideDayEventsModal() {
    this.showDayEventsModal = false;
  }

  createGroup() {
    this.router.navigate(['/groups/create']);
  }

  openGroup(group: Group) {
    this.router.navigate(['/groups', group.id]);
  }

  getGroupTaskCount(groupId: string): number {
    // 現在の課題リストから該当するグループの課題数を取得
    let taskCount = 0;
    this.recentTasks$.pipe(take(1)).subscribe(tasks => {
      taskCount = tasks.filter(task => task.groupId === groupId).length;
    });
    return taskCount;
  }

  viewAllTasks() {
    this.router.navigate(['/tasks']);
  }

  openTask(task: TaskItem) {
    this.router.navigate(['/group', task.groupId]);
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'not_started': '未着手',
      'in_progress': '実行中',
      'completed': '完了'
    };
    return labels[status] || status;
  }

  formatTimeRange(start: any, end: any): string {
    const toDate = (d: any) => (d && d.toDate ? d.toDate() : new Date(d));
    const s = toDate(start);
    const e = toDate(end);
    const sStr = s.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const eStr = e.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    // 同日で終日扱いなら時間省略
    if (sStr === '00:00' && eStr === '00:00') {
      return '終日';
    }
    return `${sStr} - ${eStr}`;
  }

  getEventTypeLabel(type: CalendarEvent['type']): string {
    switch (type) {
      case 'personal':
        return '予定';
      case 'task_due':
        return '課題期限';
      default:
        return 'イベント';
    }
  }

  getGroupName(groupId: string): string {
    const group = this.userGroupsCache.find(g => g.id === groupId);
    return group?.name || 'グループ名';
  }

  getUserDisplayName(): string {
    if (!this.currentUser) return 'ユーザー';
    
    // displayNameがある場合はそれを優先、なければemailの@より前の部分を使用
    if (this.currentUser.displayName) {
      return this.currentUser.displayName;
    }
    
    if (this.currentUser.email) {
      return this.currentUser.email.split('@')[0];
    }
    
    return 'ユーザー';
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ja-JP');
  }
}