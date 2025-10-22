import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { NotificationService } from './notification.service';
import { MessageNotificationService } from './message-notification.service';
import { MessageService } from './message.service';
import { TodoService } from './todo.service';
import { User, Group, TaskItem, Notification, CalendarEvent, TodoItem } from './models';
import { Observable, Subscription, combineLatest, of, Subject } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Firestore, collection, addDoc, serverTimestamp, query, where, collectionData, updateDoc, doc, deleteDoc, getDocs } from '@angular/fire/firestore';
import { map, switchMap, take, takeUntil, startWith } from 'rxjs/operators';
import { DesktopNotificationService } from './desktop-notification.service';
import { FcmService } from './fcm.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
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
              <span class="bell-icon" 
                    [class.has-notifications]="unreadNotifications > 0">🔔</span>
              <div class="notification-badge" *ngIf="unreadNotifications > 0">
                {{ unreadNotifications }}
              </div>
            </button>
          </div>
          <div class="user-info">
        <div class="user-avatar" (click)="toggleProfileModal()">
          <img *ngIf="currentUser?.photoURL" [src]="currentUser?.photoURL" alt="ユーザーアイコン" class="header-avatar-image">
          <span *ngIf="!currentUser?.photoURL" class="avatar-icon">👤</span>
        </div>
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
          
          
          <button class="action-btn secondary" routerLink="/user-search">
            🔍 ユーザー検索
          </button>
          
          <button class="action-btn secondary" routerLink="/messages" [class.has-unread-messages]="unreadMessageCount > 0">
            💬 メッセージ
          </button>
          
          <button class="action-btn secondary" routerLink="/group/create">
            👥 グループ作成
          </button>
          <button class="action-btn secondary" routerLink="/groups">
            📋 グループ一覧
          </button>
          
          <button class="action-btn secondary" routerLink="/tasks">
            📝 課題一覧
          </button>
          
          <button class="action-btn secondary" routerLink="/documents">
            📄 資料作成
          </button>
          
          <button class="action-btn secondary" routerLink="/department-tasks">
            🏢 部門課題
          </button>
          
          <!-- 管理者メニュー -->
          <button 
            class="action-btn admin-btn" 
            routerLink="/admin"
            *ngIf="isAdmin$ | async"
            title="管理者ダッシュボード"
          >
            👑 管理者
          </button>
        </div>

        <!-- コンテンツエリア -->
        <div class="content-grid">
          <!-- 今日のTodoリスト -->
          <div class="todo-section">
            <div class="section-header">
              <h2>📝 今日やること</h2>
            </div>
            
            <div class="todo-list" *ngIf="todayTodos$ | async as todos">
              <div *ngIf="todos.length === 0" class="empty-todos">
                <p>今日の予定はありません 🎉</p>
              </div>
              
        <div *ngFor="let todo of todos" class="todo-item">
          <div class="todo-content">
            <div class="todo-header">
              <span class="todo-type">{{ getTypeEmoji(todo.type) }}</span>
              <span class="todo-title">{{ todo.title }}</span>
              <span class="todo-priority">{{ getPriorityEmoji(todo.priority) }}</span>
            </div>
            
            <div *ngIf="todo.description" class="todo-description">
              {{ todo.description }}
            </div>
            
            <div *ngIf="todo.dueDate" class="todo-due-date">
              ⏰ {{ formatTodoDate(todo.dueDate) }}
            </div>
          </div>
          
          <div class="todo-actions">
            <button class="complete-btn" (click)="completeTodo(todo)" title="完了">
              ✅
            </button>
          </div>
        </div>
            </div>
          </div>

          <!-- 左側：カレンダー -->
          <div class="calendar-section">
            <div class="section-header">
              <h2>📅 カレンダー</h2>
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
                     [class.today]="day.isToday"
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
                <h2>👥 グループ</h2>
              </div>
              <div class="groups-container">
                <!-- 招待一覧 -->
                <div *ngIf="pendingInvites.length > 0" class="invite-list" style="margin-bottom: 0.75rem; padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff7ed;">
                  <div *ngFor="let inv of pendingInvites" class="invite-item" style="display:flex; justify-content:space-between; align-items:center; padding: 0.5rem 0; gap: 0.5rem;">
                    <div>
                      <strong>{{ inv.groupName }}</strong> への招待
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                      <button class="btn" (click)="acceptInvite(inv.id, inv.groupId)" style="background:#10b981; color:#fff; border:none; padding:0.35rem 0.75rem; border-radius:8px;">参加</button>
                      <button class="btn" (click)="declineInvite(inv.id)" style="background:#ef4444; color:#fff; border:none; padding:0.35rem 0.75rem; border-radius:8px;">拒否</button>
                    </div>
                  </div>
                </div>
                <div class="groups-list" *ngIf="userGroups$ | async as groups; else noGroups">
                  <a class="group-item" 
                     *ngFor="let group of groups" 
                     [routerLink]="['/group', group.id]"
                     [class.deadline-yellow]="getGroupDeadlineStatus(group.id) === 'yellow'"
                     [class.deadline-red]="getGroupDeadlineStatus(group.id) === 'red'">
                    <div class="group-info">
                      <h3 class="group-name">{{ group.name }}</h3>
                      <div class="group-stats">
                        <span class="member-count">👥 {{ getGroupMemberCount(group.id) }}人</span>
                      </div>
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
            <div class="events-list" *ngIf="selectedDayEvents.length > 0" [class.scrollable]="selectedDayEvents.length > 4">
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

      <!-- プロフィールモーダル -->
      <div class="modal-overlay" *ngIf="showProfileModal" (click)="hideProfileModal()">
        <div class="modal profile-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">プロフィール</h2>
            <button class="modal-close" (click)="hideProfileModal()">×</button>
          </div>
          <div class="profile-content" *ngIf="currentUser">
            <div class="profile-avatar">
              <div class="avatar-container">
                <img *ngIf="currentUser.photoURL" [src]="currentUser.photoURL" alt="プロフィール画像" class="avatar-image">
                <span *ngIf="!currentUser.photoURL" class="avatar-large">👤</span>
                <button class="change-avatar-btn" (click)="triggerImageUpload()">📷</button>
              </div>
              <input type="file" #fileInput (change)="onImageSelected($event)" accept="image/*" style="display: none;">
            </div>
            <div class="profile-info">
              <h3 class="profile-name">{{ currentUser.displayName || '名前未設定' }}</h3>
              <p class="profile-email">{{ currentUser.email }}</p>
              <div class="profile-department">
                <span class="department-label">所属:</span>
                <span class="department-value">{{ getDepartmentLabel(currentUser.department) }}</span>
                <button class="edit-department-btn" (click)="showEditDepartmentModal()">編集</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 所属変更モーダル -->
      <div class="modal-overlay" *ngIf="showEditDepartmentModalFlag" (click)="hideEditDepartmentModal()">
        <div class="modal edit-department-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">所属を変更</h2>
            <button class="modal-close" (click)="hideEditDepartmentModal()">×</button>
          </div>
          <div class="modal-form">
            <div class="warning-message">
              <span class="warning-icon">⚠️</span>
              <p>所属を変更すると、既存のグループや課題へのアクセス権限に影響する可能性があります。本当に変更しますか？</p>
            </div>
            <div class="form-group">
              <label class="form-label">新しい所属</label>
              <select [(ngModel)]="newDepartment" class="form-input">
                <option value="">所属を選択してください</option>
                <option value="development">開発</option>
                <option value="consulting">コンサルティング</option>
                <option value="sales">営業</option>
                <option value="corporate">コーポレート</option>
                <option value="training">研修</option>
                <option value="other">その他</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn secondary" (click)="hideEditDepartmentModal()">キャンセル</button>
              <button type="button" class="btn primary" (click)="updateDepartment()" [disabled]="!newDepartment || updatingDepartment">
                {{ updatingDepartment ? '更新中...' : '更新' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      font-size: 0.75rem; /* 13.3インチ用にスケーリング（27インチ基準の75%） */
    }

    .main-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 0.75rem 1.5rem; /* 13.3インチ用に調整 */
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .app-title {
      margin: 0;
      font-size: 1.125rem; /* 13.3インチ用に調整 */
      font-weight: 700;
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .title-main {
      font-size: 1.65rem; /* 13.3インチ用に調整 */
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
      font-size: 0.675rem; /* 13.3インチ用に調整 */
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

    .bell-icon {
      display: inline-block;
      transition: transform 0.2s ease;
    }

    .bell-icon.has-notifications {
      animation: bellShake 1s ease-in-out infinite;
      transform-origin: center bottom;
    }

    @keyframes bellShake {
      0%, 100% {
        transform: rotate(0deg);
      }
      10%, 30%, 50%, 70%, 90% {
        transform: rotate(-10deg);
      }
      20%, 40%, 60%, 80% {
        transform: rotate(10deg);
      }
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

    .user-avatar {
      width: 30px; /* 13.3インチ用に調整 */
      height: 30px; /* 13.3インチ用に調整 */
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
      overflow: hidden;
    }

    .user-avatar:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .avatar-icon {
      font-size: 15px; /* 13.3インチ用に調整 */
      color: white;
    }

    .header-avatar-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .user-name {
      font-weight: 500;
      color: #2d3748;
    }

    .logout-btn {
      background: #e53e3e;
      color: white;
      border: none;
      padding: 0.375rem 0.75rem; /* 13.3インチ用に調整 */
      border-radius: 0.375rem;
      cursor: pointer;
      font-size: 0.656rem; /* 13.3インチ用に調整 */
      transition: background-color 0.2s;
    }

    .logout-btn:hover {
      background: #c53030;
    }

    .main-content {
      padding: 1.5rem; /* 13.3インチ用に調整 */
      max-width: 1050px; /* 13.3インチ用に調整 */
      margin: 0 auto;
    }

    .action-buttons {
      display: flex;
      gap: 0.75rem; /* 13.3インチ用に調整 */
      margin-bottom: 1.5rem; /* 13.3インチ用に調整 */
      flex-wrap: wrap;
    }

    .action-btn {
      padding: 0.5625rem 1.125rem; /* 13.3インチ用に調整 */
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.75rem; /* 13.3インチ用に調整 */
    }

    .action-btn.primary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .action-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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

    .action-btn.admin-btn {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      font-weight: 600;
      border: none;
    }

    .action-btn.admin-btn:hover {
      background: linear-gradient(135deg, #d97706, #b45309);
      transform: translateY(-1px);
    }

    .action-btn.small {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }

    .action-btn {
      position: relative;
    }

    .message-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #ef4444;
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.125rem; /* 13.3インチ用に調整 */
      margin-bottom: 1.5rem; /* 13.3インチ用に調整 */
      max-height: calc(100vh - 150px); /* 13.3インチ用に調整 */
    }

    .todo-section {
      background: white;
      border-radius: 1rem;
      padding: 1.125rem; /* 13.3インチ用に調整 */
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      height: 100%;
      display: flex;
      flex-direction: column;
      max-height: 425px; /* 枠の高さを425pxに変更 */
    }

    .todo-list {
      flex: 1;
      overflow-y: auto;
      max-height: 355px; /* 425pxの枠に合わせて調整 */
    }

    .todo-list::-webkit-scrollbar {
      width: 6px;
    }

    .todo-list::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    .todo-list::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    .todo-list::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }

    .empty-todos {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-style: italic;
    }

    .todo-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem;
      border: 1px solid #e5e7eb;
      border-radius: 1rem;
      margin-bottom: 0.75rem;
      background: #f9fafb;
      transition: all 0.2s ease;
    }

    .todo-item:hover {
      background: #f3f4f6;
      border-color: #d1d5db;
    }

    .todo-actions {
      flex-shrink: 0;
    }

    .complete-btn {
      background: #10b981;
      color: white;
      border: none;
      border-radius: 1rem;
      padding: 0.5rem;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 36px;
    }

    .complete-btn:hover {
      background: #059669;
      transform: scale(1.05);
    }

    .todo-content {
      flex: 1;
      min-width: 0;
    }

    .todo-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .todo-type {
      font-size: 1rem;
      flex-shrink: 0;
    }

    .todo-title {
      font-weight: 600;
      color: #374151;
      flex: 1;
      min-width: 0;
      word-break: break-word;
    }

    .todo-title.completed-text {
      text-decoration: line-through;
      color: #9ca3af;
    }

    .todo-priority {
      font-size: 1rem;
      flex-shrink: 0;
    }

    .todo-description {
      font-size: 0.875rem;
      color: #6b7280;
      margin-bottom: 0.25rem;
      line-height: 1.4;
    }

    .todo-due-date {
      font-size: 0.75rem;
      color: #9ca3af;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .calendar-section, .right-section {
      background: white;
      border-radius: 1rem;
      padding: 1.125rem; /* 13.3インチ用に調整 */
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 425px; /* 枠の高さを425pxに変更 */
    }

    .today-info {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 0.75rem; /* 13.3インチ用に調整 */
      border-radius: 8px;
      margin-bottom: 0.75rem; /* 13.3インチ用に調整 */
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
      font-size: 0.9rem; /* 13.3インチ用に調整 */
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .today-time {
      font-size: 1.125rem; /* 13.3インチ用に調整 */
      font-weight: 700;
    }

    .today-day {
      font-size: 0.75rem; /* 13.3インチ用に調整 */
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
      margin-bottom: 1.125rem; /* 13.3インチ用に調整 */
      padding-bottom: 0.5625rem; /* 13.3インチ用に調整 */
    }

    .section-header h2 {
      margin: 0;
      color: #2d3748;
      font-size: 0.9375rem; /* 13.3インチ用に調整 */
      font-weight: 600;
    }

    .calendar-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .calendar-btn {
      background: #10b981;
      color: white;
      border: none;
      border-radius: 50%;
      width: 30px; /* 13.3インチ用に調整 */
      height: 30px; /* 13.3インチ用に調整 */
      font-size: 0.9rem; /* 13.3インチ用に調整 */
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .calendar-btn:hover {
      background: #059669;
      transform: scale(1.1);
    }

    .add-event-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .add-event-btn:hover {
      background: #5a67d8;
      transform: scale(1.1);
    }

    .create-group-btn, .view-all-btn {
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
      padding: 0.5rem; /* カレンダーが見切れないように調整 */
      max-height: 400px; /* カレンダーが見切れないように調整 */
      overflow: hidden;
    }

    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem; /* 13.3インチ用に調整 */
    }

    .calendar-header h3 {
      margin: 0;
      color: #2d3748;
      font-size: 0.84375rem; /* 13.3インチ用に調整 */
    }

    .nav-btn {
      background: none;
      border: none;
      font-size: 1.125rem; /* 13.3インチ用に調整 */
      cursor: pointer;
      color: #4a5568;
      padding: 0.1875rem; /* 13.3インチ用に調整 */
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.0625rem; /* カレンダーが見切れないようにさらに調整 */
      flex: 1;
      overflow: hidden;
    }

    .calendar-day {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 0.0625rem; /* カレンダーが見切れないようにさらに調整 */
      border-radius: 0.25rem; /* 角丸を小さく */
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

    .calendar-day.today {
      background-color: rgba(102, 126, 234, 0.3);
      border: 2px solid #667eea;
      box-shadow: 0 0 0 1px rgba(102, 126, 234, 0.2);
    }

    .calendar-day.today .day-number {
      font-weight: 700;
      color: #667eea;
    }

    .day-number {
      font-size: 0.75rem; /* 日付の数字を大きく調整 */
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
      width: 0.25rem; /* 予定マークを大きく調整 */
      height: 0.25rem; /* 予定マークを大きく調整 */
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
    .events-list { 
      display: flex; 
      flex-direction: column; 
      gap: 0.5rem; 
    }
    
    .events-list.scrollable {
      max-height: 300px;
      overflow-y: auto;
      padding-right: 0.5rem;
    }
    
    .events-list.scrollable::-webkit-scrollbar {
      width: 6px;
    }
    
    .events-list.scrollable::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }
    
    .events-list.scrollable::-webkit-scrollbar-thumb {
      background: #cbd5e0;
      border-radius: 3px;
    }
    
    .events-list.scrollable::-webkit-scrollbar-thumb:hover {
      background: #a0aec0;
    }
    .event-row { display: grid; grid-template-columns: 110px 1fr auto; gap: 0.75rem; padding: 0.75rem; border-radius: 0.5rem; }
    .event-time { color: #ffffff; font-size: 0.9rem; font-weight:600; }
    .event-title { font-weight: 700; color: #ffffff; }
    .event-type { font-size: 0.8rem; color: #f3f4f6; }
    .event-actions { display:flex; gap:.5rem; justify-content:flex-end; align-items:center; margin-right: -385px; }
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
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-decoration: none; /* 下線を削除 */
    }

    .group-item:hover, .task-item:hover {
      border-color: #667eea;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .group-item.deadline-yellow {
      border-color: #fbbf24;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }

    .group-item.deadline-yellow:hover {
      border-color: #f59e0b;
      background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
    }

    .group-item.deadline-red {
      border-color: #ef4444;
      background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
    }

    .group-item.deadline-red:hover {
      border-color: #dc2626;
      background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }

    .group-info {
      flex: 1;
    }

    .group-actions {
      flex-shrink: 0;
      margin-left: 1rem;
    }

    .group-name, .task-title {
      margin: 0 0 0.5rem 0;
      color: #2d3748;
      font-size: 0.875rem; /* 文字サイズを少し大きく */
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
      font-size: 0.6875rem; /* 文字サイズを少し大きく */
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

    /* 期限に応じた色変更 */
    .task-item.due-warning {
      border-color: #fbbf24;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }

    .task-item.due-warning:hover {
      border-color: #f59e0b;
      background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
    }

    .task-item.due-danger {
      border-color: #ef4444;
      background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
    }

    .task-item.due-danger:hover {
      border-color: #dc2626;
      background: linear-gradient(135deg, #fca5a5 0%, #f87171 100%);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
    }

    .task-item.overdue {
      border-color: #dc2626;
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    }

    .task-item.overdue:hover {
      border-color: #b91c1c;
      background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
      box-shadow: 0 4px 12px rgba(185, 28, 28, 0.2);
    }

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
      margin-bottom: 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .groups-container,
    .tasks-container {
      flex: 1;
      overflow-y: auto;
      padding-right: 0.5rem;
      max-height: 355px; /* 425pxの枠に合わせて調整 */
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
    @media (max-width: 1200px) {
      .content-grid {
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      
      .todo-section,
      .calendar-section,
      .right-section {
        max-height: 425px; /* 中画面での高さ調整 */
      }
      
      .todo-list,
      .groups-container,
      .tasks-container {
        max-height: 355px; /* 中画面でのスクロール領域調整 */
      }
    }

    @media (max-width: 1024px) {
      .content-grid {
        grid-template-columns: 1fr;
        max-height: none;
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
        font-size: 0.875rem; /* モバイルでも日付を大きく調整 */
      }
      
      .todo-section,
      .calendar-section,
      .right-section {
        max-height: 425px; /* モバイルでの高さ調整 */
      }
      
      .todo-list,
      .groups-container,
      .tasks-container {
        max-height: 355px; /* モバイルでのスクロール領域調整 */
      }
    }

    /* プロフィールモーダル */
    .profile-modal {
      max-width: 400px;
      width: 90%;
    }

    .profile-content {
      padding: 2rem;
      text-align: center;
    }

    .profile-avatar {
      margin-bottom: 1.5rem;
    }

    .avatar-container {
      position: relative;
      display: inline-block;
    }

    .avatar-large {
      font-size: 4rem;
      display: inline-block;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      color: white;
    }

    .avatar-image {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid #e2e8f0;
      display: block;
    }

    .change-avatar-btn {
      position: absolute;
      bottom: 0;
      right: 0;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s;
    }

    .change-avatar-btn:hover {
      background: #5a67d8;
      transform: scale(1.1);
    }

    .profile-info {
      text-align: center;
    }

    .profile-name {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2d3748;
      margin: 0 0 0.5rem 0;
    }

    .profile-email {
      color: #6b7280;
      margin: 0 0 1rem 0;
      font-size: 1rem;
    }

    .profile-department {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: #f3f4f6;
      border-radius: 0.5rem;
      margin: 0 auto;
      max-width: 300px;
      min-width: 250px;
    }

    .department-label {
      font-weight: 500;
      color: #374151;
    }

    .department-value {
      font-weight: 600;
      color: #667eea;
    }

    .edit-department-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.5rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-left: 0.5rem;
      font-weight: 500;
    }

    .edit-department-btn:hover {
      background: #5a67d8;
    }

    /* 所属変更モーダル */
    .edit-department-modal {
      max-width: 500px;
      width: 90%;
    }

    .warning-message {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .warning-icon {
      font-size: 1.25rem;
      color: #d97706;
      flex-shrink: 0;
    }

    .warning-message p {
      margin: 0;
      color: #92400e;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.875rem;
    }

    .btn.primary {
      background: #667eea;
      color: white;
    }

    .btn.primary:hover:not(:disabled) {
      background: #5a67d8;
    }

    .btn.primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .btn.secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn.secondary:hover {
      background: #e5e7eb;
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
  private messageNotificationService = inject(MessageNotificationService);
  private messageService = inject(MessageService);
  private todoService = inject(TodoService);
  private firestore = inject(Firestore);
  private desktopNotifications = inject(DesktopNotificationService);
  private fcm = inject(FcmService);

  currentUser: User | null = null;
  userGroups$: Observable<Group[]> = of([]);
  private userGroupsCache: Group[] = [];
  recentTasks$: Observable<TaskItem[]> = of([]);
  unreadNotifications = 0;
  unreadMessageCount = 0;
  todayTodos$: Observable<TodoItem[]> = of([]);
  isAdmin$: Observable<boolean> = of(false);
  private destroy$ = new Subject<void>();
  currentMonth = '';
  calendarDays: any[] = [];
  allEvents: CalendarEvent[] = [];
  selectedDate: Date | null = null;
  showProfileModal = false;
  showEditDepartmentModalFlag = false;
  newDepartment = '';
  updatingDepartment = false;
  uploadingImage = false;
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
  pendingInvites: { id: string; groupId: string; groupName: string }[] = [];

  ngOnInit() {
    this.loadUserData();
    this.initializeCalendar();
    this.initializeTodayInfo();
    this.loadTodayTodos();
    this.checkAdminStatus();
    
    // 通知ページから戻ってきた時に通知数を更新
    this.router.events.pipe(
      takeUntil(this.destroy$)
    ).subscribe(event => {
      if (event instanceof NavigationEnd && event.url === '/main') {
        this.loadNotifications();
      }
    });
    
    // Initialize desktop notifications after user is ready
    setTimeout(async () => {
      try {
        this.desktopNotifications.init();
        // Initialize FCM (will no-op if unsupported)
        const VAPID_KEY = 'BHiPS0bFe5WmP0KbdL_FSPXsx7UZfo0Eo1HI0irRTI8pRS5FepX6Ni892j1Zbb0xFMqI-BLlpPxGq_vM5KdHAdI';
        await this.fcm.init(VAPID_KEY);
        if (VAPID_KEY) {
          await this.fcm.requestPermissionAndRegisterToken(VAPID_KEY);
          // Retry once after a short delay in case auth was not ready yet
          setTimeout(() => {
            this.fcm.requestPermissionAndRegisterToken(VAPID_KEY).catch(() => {});
          }, 2000);
        }
      } catch {}
    }, 0);
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
            photoURL: profile?.photoURL || user.photoURL || undefined,
            role: 'user',
            department: profile?.department,
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
        // 期限状況を更新
        this.loadGroupDeadlineStatus(groups.map(g => g.id));
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

  private loadGroupDeadlineStatus(groupIds: string[]) {
    groupIds.forEach(groupId => {
      this.taskService.getGroupTasks(groupId).pipe(
        take(1),
        takeUntil(this.destroy$)
      ).subscribe(tasks => {
        this._groupIdToDeadlineStatus[groupId] = this.calculateDeadlineStatus(tasks);
      });
    });
  }

  private calculateDeadlineStatus(tasks: any[]): 'normal' | 'yellow' | 'red' {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const oneDayFromNow = new Date();
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    let hasRedDeadline = false;
    let hasYellowDeadline = false;

    for (const task of tasks) {
      // 完了済みの課題は期限状況に影響しない
      if (task.status === 'completed') {
        continue;
      }

      if (task.dueDate) {
        const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
        
        // 期限が1日以内（赤色）
        if (dueDate <= oneDayFromNow && dueDate >= now) {
          hasRedDeadline = true;
          // 赤色が見つかったら即座に返す（最優先）
          return 'red';
        }
        // 期限が3日以内（黄色）- 1日以内は除外
        else if (dueDate <= threeDaysFromNow && dueDate > oneDayFromNow) {
          hasYellowDeadline = true;
        }
      }
    }

    if (hasRedDeadline) return 'red';
    if (hasYellowDeadline) return 'yellow';
    return 'normal';
  }

  private _groupIdToMemberCount: Record<string, number> = {};
  private _groupIdToDeadlineStatus: Record<string, 'normal' | 'yellow' | 'red'> = {};

  getGroupMemberCount(groupId: string): number {
    return this._groupIdToMemberCount[groupId] ?? 0;
  }

  getGroupDeadlineStatus(groupId: string): 'normal' | 'yellow' | 'red' {
    return this._groupIdToDeadlineStatus[groupId] ?? 'normal';
  }

  private loadRecentTasks() {
    if (this.currentUser) {
      this.recentTasks$ = this.taskService.getRecentTasks(this.currentUser.id, 5).pipe(
        map(tasks => {
          // 期限が近い順にソート
          return tasks.sort((a, b) => {
            const aDate = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : new Date('9999-12-31');
            const bDate = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : new Date('9999-12-31');
            return aDate.getTime() - bDate.getTime();
          });
        })
      );
    } else {
      this.recentTasks$ = of([]);
    }
  }

  private loadNotifications() {
    if (this.currentUser) {
      // 通常の通知のみを取得（🔔バッジ用）
      const regularNotifications$ = this.notificationService.getUnreadCount(this.currentUser.id);
      const unreadMessages$ = this.messageService.getUnreadCount();
      const invites$ = this.notificationService.getUserNotifications(this.currentUser.id, 100);
      const sub = combineLatest([regularNotifications$, unreadMessages$, invites$]).subscribe({
        next: ([regularCount, unreadMessageCount, notifications]) => {
          this.unreadNotifications = regularCount;
          this.unreadMessageCount = unreadMessageCount;
          this.pendingInvites = (notifications || [])
            .filter(n => n.type === 'group_invite' && !n.isRead)
            .map(n => ({ id: n.id!, groupId: (n.data as any)?.groupId, groupName: (n.data as any)?.groupName || 'グループ' }));
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          this.unreadNotifications = 0;
          this.unreadMessageCount = 0;
          this.pendingInvites = [];
        }
      });
      this.subscriptions.push(sub as any);
    } else {
      this.unreadNotifications = 0;
      this.pendingInvites = [];
    }
  }

  async acceptInvite(inviteId: string, groupId: string) {
    if (!this.currentUser) return;
    try {
      // 既に参加済みかチェック
      const existingMembership = await getDocs(query(
        collection(this.firestore, 'groupMemberships'),
        where('groupId', '==', groupId),
        where('userId', '==', this.currentUser.id)
      ));
      
      if (existingMembership.empty) {
        // 参加
        await addDoc(collection(this.firestore, 'groupMemberships'), {
          groupId,
          userId: this.currentUser.id,
          joinedAt: new Date()
        } as any);
      }
      
      // 通知を既読/削除
      await this.notificationService.markAsRead(inviteId);
      
      // UIから即座に削除
      this.pendingInvites = this.pendingInvites.filter(i => i.id !== inviteId);
      
      // 通知リストを再読み込み
      this.loadNotifications();
    } catch (e) {
      console.error('accept invite error', e);
    }
  }

  async declineInvite(inviteId: string) {
    try {
      await this.notificationService.markAsRead(inviteId);
      
      // UIから即座に削除
      this.pendingInvites = this.pendingInvites.filter(i => i.id !== inviteId);
      
      // 通知リストを再読み込み
      this.loadNotifications();
    } catch (e) {
      console.error('decline invite error', e);
    }
  }

  private loadTodayTodos() {
    this.todayTodos$ = this.todoService.getTodayTodos();
  }

  private checkAdminStatus() {
    this.isAdmin$ = this.auth.isAdmin();
  }

  // Todoを完了して削除
  async completeTodo(todo: TodoItem) {
    try {
      // タスク、期限、イベントすべての完了状態を更新
      await this.todoService.updateTodoCompletion(todo.id, true);
      
      // todoリストを再読み込み（完了したアイテムは表示されなくなる）
      this.loadTodayTodos();
    } catch (error) {
      console.error('Todo完了エラー:', error);
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

  getTypeEmoji(type: string): string {
    const emojis = {
      task: '📋',
      event: '📅',
      deadline: '⏰'
    };
    return emojis[type as keyof typeof emojis] || '📝';
  }

  formatTodoDate(date: any): string {
    if (!date) return '';
    
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todoDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    
    if (todoDate.getTime() === today.getTime()) {
      return '今日';
    }
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (todoDate.getTime() === tomorrow.getTime()) {
      return '明日';
    }
    
    return dateObj.toLocaleDateString('ja-JP', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        const currentUserId = this.currentUser?.id;
        const dueEvents: CalendarEvent[] = (tasks || [])
          .filter(t => t.dueDate && t.assigneeId === currentUserId && t.status !== 'completed') // 自分が担当者で未完了の課題のみ
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
    
    // 複数日予定の分割表示の場合は、元のイベントIDを取得
    const originalEventId = ev.id.includes('_') ? ev.id.split('_')[0] : ev.id;
    (this as any)._editingEventId = originalEventId;
    
    // 元のイベントを取得
    const originalEvent = this.allEvents.find(e => e.id === originalEventId);
    if (originalEvent) {
      this.eventForm.patchValue({
        title: originalEvent.title,
        description: originalEvent.description || '',
        start: this.formatDateTimeLocal(originalEvent.startDate),
        end: this.formatDateTimeLocal(originalEvent.endDate),
        color: originalEvent.color || '#3b82f6'
      });
    } else {
      this.eventForm.patchValue({
        title: ev.title,
        description: ev.description || '',
        start: this.formatDateTimeLocal(ev.startDate),
        end: this.formatDateTimeLocal(ev.endDate),
        color: ev.color || '#3b82f6'
      });
    }
    // 予定一覧モーダルを閉じて、編集モーダルを最前面で開く
    this.showDayEventsModal = false;
    this.showEventModal = true;
  }

  async deleteEvent(ev: CalendarEvent) {
    if (ev.type !== 'personal') return;
    if (!confirm('この予定を削除しますか？')) return;
    
    // 複数日予定の分割表示の場合は、元のイベントIDを取得
    const originalEventId = ev.id.includes('_') ? ev.id.split('_')[0] : ev.id;
    
    try {
      await deleteDoc(doc(this.firestore, 'calendarEvents', originalEventId));
      
      // 完了したイベントのリストからも削除
      this.todoService.updateTodoCompletion(`event-${originalEventId}`, false);
      
      // Todoリストを更新
      this.loadTodayTodos();
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
    
    // 今日の日付を取得
    const today = new Date();
    const todayString = today.toDateString();
    
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
        isToday: currentDate.toDateString() === todayString,
        events: this.getEventsForDate(currentDate)
      });
    }
  }

  private getEventsForDate(date: Date): CalendarEvent[] {
    // 選択日のイベントを返す（複数日予定も含む）
    const ymd = date.toDateString();
    const result: CalendarEvent[] = [];
    
    this.allEvents.forEach(ev => {
      const startDate = (ev.startDate as any)?.toDate ? (ev.startDate as any).toDate() : new Date(ev.startDate);
      const endDate = (ev.endDate as any)?.toDate ? (ev.endDate as any).toDate() : new Date(ev.endDate);
      
      // 複数日にまたがる予定の場合、分割して表示
      if (this.isMultiDayEvent(startDate, endDate)) {
        const splitEvents = this.splitMultiDayEvent(ev, date);
        result.push(...splitEvents);
      } else {
        // 単日予定の場合
        if (startDate.toDateString() === ymd) {
          result.push(ev);
        }
      }
    });
    
    return result;
  }

  private isMultiDayEvent(startDate: Date, endDate: Date): boolean {
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    return startDay.getTime() !== endDay.getTime();
  }

  private splitMultiDayEvent(event: CalendarEvent, targetDate: Date): CalendarEvent[] {
    const startDate = (event.startDate as any)?.toDate ? (event.startDate as any).toDate() : new Date(event.startDate);
    const endDate = (event.endDate as any)?.toDate ? (event.endDate as any).toDate() : new Date(event.endDate);
    
    const targetDateStr = targetDate.toDateString();
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    // 対象日が予定の期間内にあるかチェック
    if (targetDate < startDay || targetDate > endDay) {
      return [];
    }
    
    const result: CalendarEvent[] = [];
    
    // 開始日の場合
    if (targetDate.toDateString() === startDay.toDateString()) {
      const dayEnd = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59);
      const eventEnd = endDate < dayEnd ? endDate : dayEnd;
      
      result.push({
        ...event,
        id: `${event.id}_start`,
        startDate: startDate,
        endDate: eventEnd,
        title: `${event.title} (開始)`
      });
    }
    // 終了日の場合
    else if (targetDate.toDateString() === endDay.toDateString()) {
      const dayStart = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0);
      const eventStart = startDate > dayStart ? startDate : dayStart;
      
      result.push({
        ...event,
        id: `${event.id}_end`,
        startDate: eventStart,
        endDate: endDate,
        title: `${event.title} (終了)`
      });
    }
    // 中間日の場合（終日）
    else {
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
      
      result.push({
        ...event,
        id: `${event.id}_${targetDate.toISOString().split('T')[0]}`,
        startDate: dayStart,
        endDate: dayEnd,
        title: `${event.title} (継続)`,
        allDay: true
      });
    }
    
    return result;
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
      // Todoリストを更新
      this.loadTodayTodos();
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
    
    // 開始時間と終了時間が同じ場合は開始時間のみ表示
    if (sStr === eStr) {
      return sStr;
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

  // 期限判定メソッド
  isDueWithinDays(date: any, days: number): boolean {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + days);
    return d <= targetDate && d >= now;
  }

  isOverdue(date: any): boolean {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    return d < new Date();
  }

  // プロフィールモーダル
  toggleProfileModal() {
    this.showProfileModal = !this.showProfileModal;
  }

  hideProfileModal() {
    this.showProfileModal = false;
  }

  getDepartmentLabel(department?: string): string {
    const labels = {
      'development': '開発',
      'consulting': 'コンサルティング',
      'sales': '営業',
      'corporate': 'コーポレート',
      'training': '研修',
      'other': 'その他'
    };
    return labels[department as keyof typeof labels] || '未設定';
  }

  // 所属変更モーダル
  showEditDepartmentModal() {
    this.newDepartment = this.currentUser?.department || '';
    this.showEditDepartmentModalFlag = true;
  }

  hideEditDepartmentModal() {
    this.showEditDepartmentModalFlag = false;
    this.newDepartment = '';
    this.updatingDepartment = false;
  }

  async updateDepartment() {
    if (!this.currentUser || !this.newDepartment) return;
    
    this.updatingDepartment = true;
    try {
      // Firebaseのユーザープロファイルを更新
      const userRef = doc(this.firestore, 'users', this.currentUser.id);
      await updateDoc(userRef, {
        department: this.newDepartment,
        updatedAt: serverTimestamp()
      });

      // ローカルのcurrentUserも更新
      this.currentUser.department = this.newDepartment as any;

      // モーダルを閉じる
      this.hideEditDepartmentModal();
      
      // 成功メッセージ
      alert('所属を更新しました。');
    } catch (error) {
      console.error('所属更新エラー:', error);
      alert('所属の更新に失敗しました。');
    } finally {
      this.updatingDepartment = false;
    }
  }

  // 画像アップロード機能
  triggerImageUpload() {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  async onImageSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      alert('画像ファイルは5MB以下にしてください。');
      return;
    }

    // ファイル形式チェック
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    this.uploadingImage = true;
    try {
      // 画像をBase64に変換してプレビュー
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const imageUrl = e.target.result;
        
        // ローカルのcurrentUserを更新（プレビュー用）
        if (this.currentUser) {
          this.currentUser.photoURL = imageUrl;
        }
      };
      reader.readAsDataURL(file);

      // Firebaseのユーザープロファイルを更新
      if (this.currentUser) {
        const userRef = doc(this.firestore, 'users', this.currentUser.id);
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          try {
            await updateDoc(userRef, {
              photoURL: e.target.result,
              updatedAt: serverTimestamp()
            });
            alert('プロフィール画像を更新しました。');
          } catch (error) {
            console.error('画像更新エラー:', error);
            alert('画像の更新に失敗しました。');
          } finally {
            this.uploadingImage = false;
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('画像処理エラー:', error);
      alert('画像の処理に失敗しました。');
      this.uploadingImage = false;
    }
  }
}