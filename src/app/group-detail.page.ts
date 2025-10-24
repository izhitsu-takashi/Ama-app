import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { JoinRequestService } from './join-request.service';
import { NotificationService } from './notification.service';
import { AnnouncementService } from './announcement.service';
import { Group, TaskItem, GroupMembership, JoinRequest, Announcement } from './models';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, map, switchMap, take } from 'rxjs/operators';
import { collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { Firestore } from '@angular/fire/firestore';

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
          <button class="btn btn-primary" (click)="showCreateTaskModal()">
            <span class="btn-icon">+</span>
            課題を作成
          </button>
          <button class="btn btn-secondary menu-btn" (click)="toggleActionsModal()">
            <span class="btn-icon">⚙️</span>
            メニュー
            <span *ngIf="hasMenuNotifications()" class="menu-notification-badge"></span>
          </button>
        </div>
      </div>


      <!-- アクションメニューモーダル -->
      <div class="modal-overlay" *ngIf="showActionsModal" (click)="closeActionsModal()">
        <div class="modal actions-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">メニュー</h2>
            <button class="modal-close" (click)="closeActionsModal()">×</button>
          </div>
          <div class="modal-form">
            <div class="actions-grid">
              <button class="action-card" (click)="toggleMembers(); closeActionsModal()">
                <div class="action-icon">👥</div>
                <div class="action-title">メンバー</div>
                <div class="action-description">グループメンバーを管理</div>
              </button>
              
              <button class="action-card" (click)="toggleTimeline(); closeActionsModal()">
                <div class="action-icon">📈</div>
                <div class="action-title">タイムライン</div>
                <div class="action-description">課題の進捗を可視化</div>
              </button>
              
              <button 
                *ngIf="isGroupOwner" 
                class="action-card" 
                (click)="toggleJoinRequests(); closeActionsModal()"
              >
                <div class="action-icon">📝</div>
                <div class="action-title">参加リクエスト</div>
                <div class="action-description">参加申請を管理</div>
                <span *ngIf="(joinRequests$ | async)?.length" class="action-badge">
                  {{ (joinRequests$ | async)?.length }}
                </span>
              </button>
              
              <button 
                class="action-card" 
                [class.action-card-unread]="hasUnreadAnnouncements()"
                (click)="showAnnouncementListModal(); closeActionsModal()"
              >
                <div class="action-icon">📢</div>
                <div class="action-title">アナウンス</div>
                <div class="action-description">グループのお知らせ</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- タイムライン -->
      <div class="timeline-section" *ngIf="showTimeline">
        <div class="timeline-header">
          <h2 class="section-title">タイムライン</h2>
          <div class="timeline-controls">
            <div class="timeline-legend">
              <span class="legend-item"><span class="legend-color priority-low"></span>低</span>
              <span class="legend-item"><span class="legend-color priority-medium"></span>中</span>
              <span class="legend-item"><span class="legend-color priority-high"></span>高</span>
              <span class="legend-item"><span class="legend-color priority-urgent"></span>緊急</span>
            </div>
          </div>
        </div>
        <div class="timeline-container" #timelineContainer>
          <div class="timeline-scroll-area" (scroll)="onTimelineScroll($event)">
            <div class="timeline-grid">
              <div class="timeline-day" *ngFor="let day of timelineDays; let i = index" [style.width.px]="dayWidth">
                <div class="day-date">{{ formatTimelineDate(day, i) }}</div>
                <div class="day-weekday">{{ getWeekdayName(day) }}</div>
              </div>
              <div class="today-marker" *ngIf="timelineTodayOffset >= 0" [style.left.px]="timelineTodayOffset"></div>
            </div>
            <div class="timeline-rows">
              <div class="timeline-row" *ngFor="let item of timelineItems">
                <div 
                  class="timeline-bar" 
                  [class]="'priority-' + item.priority"
                  [style.left.px]="item.left"
                  [style.width.px]="item.width"
                  (click)="openTaskFromTimeline(item.id)"
                  (mouseenter)="showSimpleTooltip($event, item)"
                  (mouseleave)="hideSimpleTooltip()"
                >
                  <span class="bar-title">{{ item.title }}</span>
                  <div class="bar-progress" [style.width.%]="item.progress"></div>
                  <div class="bar-tooltip">
                    <div class="tooltip-title">{{ item.title }}</div>
                    <div class="tooltip-line">期限: {{ item.due | date:'MM/dd' }}</div>
                    <div class="tooltip-line">担当: {{ item.assignee }}</div>
                    <div class="tooltip-line">進捗: {{ item.progress || 0 }}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- メンバー一覧（モーダル） -->
      <div class="modal-overlay" *ngIf="showMembers">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">メンバー一覧</h2>
            <div class="header-actions">
              <button 
                *ngIf="isGroupOwner" 
                class="btn btn-invite-header btn-medium" 
                (click)="openInviteModal()"
                title="ユーザーを招待"
              >
                招待
              </button>
              <button class="modal-close" (click)="showMembers = false">×</button>
            </div>
          </div>
          <div class="modal-form">
            <div class="members-list" *ngIf="(members$ | async) as members; else noMembers">
              <div class="member-item" *ngFor="let member of members">
                <div class="member-info">
                  <div class="member-avatar">
                    <img *ngIf="getMemberPhotoURL(member.userId)" [src]="getMemberPhotoURL(member.userId)" [alt]="getMemberDisplayName(member.userId, member.userName, member.userEmail)">
                    <span *ngIf="!getMemberPhotoURL(member.userId)" class="avatar-text">{{ getMemberInitialForAvatar(member.userId, member.userName, member.userEmail) }}</span>
                  </div>
                  <div class="member-details">
                    <h4 class="member-name">{{ getMemberDisplayName(member.userId, member.userName, member.userEmail) }}</h4>
                    <p class="member-email">{{ getMemberEmail(member.userId, member.userEmail) }}</p>
                    <span class="member-role" [class]="member.role">
                      {{ getRoleLabel(member.role) }}
                    </span>
                  </div>
                </div>
                <div class="member-meta">
                  <span class="join-date">参加日: {{ formatDate(member.joinedAt) }}</span>
                </div>
                <div class="member-actions" *ngIf="member.userId === getCurrentUserId() && !isGroupOwner">
                  <button 
                    class="btn btn-danger btn-medium" 
                    (click)="leaveGroup()"
                  >
                    退会
                  </button>
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
        </div>
      </div>

      <!-- 参加リクエスト管理（モーダル） -->
      <div class="modal-overlay" *ngIf="showJoinRequests && isGroupOwner">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">参加リクエスト</h2>
            <button class="modal-close" (click)="showJoinRequests = false">×</button>
          </div>
          <div class="modal-form">
            <div class="join-requests-list" *ngIf="(joinRequests$ | async) as requests">
              <div *ngIf="requests.length > 0; else noJoinRequests">
                <div class="join-request-item" *ngFor="let request of requests">
                  <div class="request-info">
                    <div class="request-header">
                      <h4 class="request-user">{{ request.userName }}</h4>
                      <span class="request-date">{{ formatDate(request.createdAt) }}</span>
                    </div>
                    <p class="request-email">{{ request.userEmail }}</p>
                  </div>
                  <div class="request-actions">
                    <button class="btn btn-success btn-small" (click)="approveJoinRequest(request.id!)">承認</button>
                    <button class="btn btn-danger btn-small" (click)="rejectJoinRequest(request.id!)">拒否</button>
                  </div>
                </div>
              </div>
              <ng-template #noJoinRequests>
                <div class="empty-state">
                  <div class="empty-icon">📝</div>
                  <h3 class="empty-title">参加リクエストがありません</h3>
                  <p class="empty-description">グループへの参加リクエストが届くとここに表示されます</p>
                </div>
              </ng-template>
            </div>
          </div>
        </div>
      </div>

      <!-- アナウンス作成モーダル -->
      <div class="modal-overlay" *ngIf="showAnnouncementModalFlag">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">アナウンス作成</h2>
            <button class="modal-close" (click)="closeAnnouncementModal()">×</button>
          </div>
          <div class="modal-form">
            <form (ngSubmit)="createAnnouncement(announcementForm)" #announcementForm="ngForm" novalidate>
              <div class="form-group">
                <label for="announcementTitle" class="form-label">タイトル</label>
                <input 
                  type="text" 
                  id="announcementTitle"
                  [(ngModel)]="announcementData.title" 
                  name="title"
                  class="form-input"
                  [class.error]="announcementFormSubmitted && !announcementData.title.trim()"
                  placeholder="アナウンスのタイトルを入力"
                  maxlength="20"
                  (input)="onAnnouncementTitleInput($event)"
                  required
                >
                <div *ngIf="announcementTitleLength >= 20" class="char-limit-warning">
                  最大20文字までです
                </div>
                <div *ngIf="announcementFormSubmitted && !announcementData.title.trim()" class="error-message">
                  タイトルの入力は必須です
                </div>
              </div>
              
              <div class="form-group">
                <label for="announcementContent" class="form-label">内容</label>
                <textarea 
                  id="announcementContent"
                  [(ngModel)]="announcementData.content" 
                  name="content"
                  class="form-textarea"
                  [class.error]="announcementFormSubmitted && !announcementData.content.trim()"
                  placeholder="アナウンスの内容を入力"
                  rows="6"
                  required
                ></textarea>
                <div *ngIf="announcementFormSubmitted && !announcementData.content.trim()" class="error-message">
                  内容の入力は必須です
                </div>
              </div>
              
              
              <div class="modal-actions">
                <button type="button" class="btn btn-secondary" (click)="closeAnnouncementModal()">
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  class="btn btn-primary" 
                  [disabled]="creatingAnnouncement"
                >
                  <span *ngIf="!creatingAnnouncement">📢 アナウンス投稿</span>
                  <span *ngIf="creatingAnnouncement">⏳ 投稿中...</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- アナウンス一覧ポップアップ -->
      <div class="modal-overlay" *ngIf="showAnnouncementListModalFlag" (click)="closeAnnouncementMenu()">
        <div class="modal announcement-list-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title">📢 アナウンス一覧</h2>
            <div class="modal-header-actions">
              <button class="btn btn-announcement" (click)="showAnnouncementModal()">
                <span class="btn-icon">📢</span>
                アナウンス作成
              </button>
              <button class="modal-close" (click)="closeAnnouncementListModal()">×</button>
            </div>
          </div>
          <div class="modal-content" [class.scrollable]="announcements.length > 3">
            <div class="announcements-list" *ngIf="announcements.length > 0; else noAnnouncements">
              <div class="announcement-item" *ngFor="let announcement of announcements">
                <div class="announcement-header">
                  <div class="announcement-title">
                    {{ announcement.title }}
                  </div>
                  <div class="announcement-meta">
                    <span class="announcement-author">{{ announcement.authorName }}</span>
                    <span class="announcement-date">{{ formatDate(announcement.createdAt) }}</span>
                    <div class="announcement-actions" *ngIf="canDeleteAnnouncement(announcement)">
                      <button class="announcement-menu-btn" (click)="toggleAnnouncementMenu(announcement.id)">
                        ⋯
                      </button>
                      <div class="announcement-menu" *ngIf="showAnnouncementMenu === announcement.id">
                        <button class="announcement-menu-item delete" (click)="deleteAnnouncement(announcement.id)">
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="announcement-content">{{ announcement.content }}</div>
              </div>
            </div>
            <ng-template #noAnnouncements>
              <div class="no-announcements">
                <p>まだアナウンスがありません。</p>
              </div>
            </ng-template>
          </div>
        </div>
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
                {{ getMemberDisplayName(member.userId, member.userName, member.userEmail) }}
              </option>
            </select>
            <select class="filter-select" [(ngModel)]="taskSortByDueDate" (change)="applyFilters()">
              <option value="">期限: 並べ替えなし</option>
              <option value="asc">期限: 近い順</option>
              <option value="desc">期限: 遠い順</option>
            </select>
            <button class="btn btn-secondary" (click)="clearFilters()">クリア</button>
          </div>
        </div>

        <div class="tasks-table-container" *ngIf="(tasks$ | async) as tasks; else emptyTasks">
          <table class="tasks-table">
            <thead>
              <tr>
                <th>タイトル</th>
                <th>期限</th>
                <th>担当者</th>
                <th>優先度</th>
                <th>ステータス</th>
                <th>進捗</th>
                <th>リアクション</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of filteredTasks" class="task-row" [class]="'priority-' + task.priority">
                <td class="task-title-cell">
                  <div class="task-title">{{ task.title }}</div>
                  <div class="task-content" *ngIf="task.content">{{ task.content }}</div>
                  <div class="task-occurred-date" *ngIf="task.occurredOn">
                    発生日：{{ formatOccurredDate(task.occurredOn) }}
                  </div>
                </td>
                <td class="task-due-cell" 
                    [class.due-warning]="isDueWithinDays(task.dueDate, 3) && !isDueWithinDays(task.dueDate, 1) && !isOverdue(task.dueDate)"
                    [class.due-danger]="isDueWithinDays(task.dueDate, 1) && !isOverdue(task.dueDate)"
                    [class.overdue]="isOverdue(task.dueDate)">
                  <span *ngIf="isOverdue(task.dueDate)" class="overdue-text">期限超過</span>
                  <span *ngIf="!isOverdue(task.dueDate)">{{ formatDate(task.dueDate) }}</span>
                </td>
                <td class="task-assignee-cell">
                  {{ task.assigneeName || getAssigneeName(task.assigneeId) }}
                </td>
                <td class="task-priority-cell">
                  <span class="priority-badge" [class]="'priority-' + task.priority">
                    {{ getPriorityLabel(task.priority) }}
                  </span>
                </td>
                <td class="task-status-cell">
                  <span class="status-badge" [class]="'status-' + task.status">
                    {{ getStatusLabel(task.status) }}
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
                <td class="task-reaction-cell">
                  <div class="reaction-container">
                    <div class="reaction-btn-wrapper">
                      <button 
                        class="reaction-btn" 
                        [class.active]="hasUserReacted(task.id)"
                        (click)="toggleReaction(task.id)"
                        (mouseenter)="showReactionTooltip(task.id, $event)"
                        (mouseleave)="hideReactionTooltip()"
                      >
                        👍
                      </button>
                      <div 
                        class="reaction-tooltip" 
                        *ngIf="showTooltip && tooltipTaskId === task.id"
                        [style.left.px]="tooltipPosition.x"
                        [style.top.px]="tooltipPosition.y"
                      >
                        <div class="tooltip-header">
                          <span class="tooltip-title">👍 リアクション</span>
                          <span class="tooltip-count">{{ getReactionCount(task.id) }}件</span>
                        </div>
                        <div class="tooltip-users" *ngIf="getReactionUsers(task.id).length > 0">
                          <div class="user-list">
                            <div *ngFor="let user of getReactionUsers(task.id)" class="tooltip-user">
                              <span class="user-name">{{ user.userName }}</span>
                            </div>
                          </div>
                        </div>
                        <div class="tooltip-users" *ngIf="getReactionUsers(task.id).length === 0">
                          <span class="no-reactions">まだリアクションがありません</span>
                        </div>
                      </div>
                    </div>
                    <span class="reaction-count">{{ getReactionCount(task.id) }}</span>
                  </div>
                </td>
                <td class="task-actions-cell">
                  <div class="action-buttons">
                    <button class="btn btn-small btn-success" (click)="markTaskComplete(task.id)" *ngIf="task.status !== 'completed'" title="完了">
                      完了
                    </button>
                    <button class="btn btn-small btn-primary" (click)="editTask(task)" title="編集">
                      編集
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
    <div class="modal-overlay" *ngIf="showCreateModal">
      <div class="modal">
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
              maxlength="20"
              (input)="onTitleInput($event)"
            />
            <div *ngIf="titleLength >= 20" class="char-limit-warning">
              最大20文字までです
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">説明</label>
            <textarea 
              formControlName="content" 
              class="form-textarea"
              placeholder="課題の詳細を入力"
              rows="3"
              maxlength="100"
              (input)="onContentInput($event)"
            ></textarea>
            <div *ngIf="contentLength >= 100" class="char-limit-warning">
              最大100文字までです
            </div>
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
              <label class="form-label">発生日</label>
              <input 
                type="datetime-local" 
                formControlName="occurredOn" 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label">期限</label>
              <input 
                type="datetime-local" 
                formControlName="dueDate" 
                class="form-input"
              />
              <div *ngIf="taskForm.hasError('dateInvalid')" class="error-message">
                期限は発生日より後に設定してください
              </div>
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
    <div class="modal-overlay" *ngIf="showEditModal">
      <div class="modal">
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
              maxlength="20"
              (input)="onTitleInput($event)"
            />
            <div *ngIf="titleLength >= 20" class="char-limit-warning">
              最大20文字までです
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">説明</label>
            <textarea 
              formControlName="content" 
              class="form-textarea"
              placeholder="課題の詳細を入力"
              rows="3"
              maxlength="100"
              (input)="onContentInput($event)"
            ></textarea>
            <div *ngIf="contentLength >= 100" class="char-limit-warning">
              最大100文字までです
            </div>
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
              <label class="form-label">発生日</label>
              <input 
                type="datetime-local" 
                formControlName="occurredOn" 
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label class="form-label">期限</label>
              <input 
                type="datetime-local" 
                formControlName="dueDate" 
                class="form-input"
              />
              <div *ngIf="editForm.hasError('dateInvalid')" class="error-message">
                期限は発生日より後に設定してください
              </div>
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

    <!-- 招待モーダル -->
    <div class="modal-overlay" *ngIf="showInviteModal">
      <div class="modal invite-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">ユーザーを招待</h2>
          <button class="modal-close" (click)="closeInviteModal()">×</button>
        </div>
        <div class="modal-form">
          <div class="search-section">
            <div class="search-input-group">
              <input
                type="text"
                [(ngModel)]="inviteSearchTerm"
                (input)="searchUsersForInvite()"
                placeholder="ユーザー名またはメールで検索..."
                class="search-input"
              >
              <button class="search-btn" (click)="searchUsersForInvite()">🔍</button>
            </div>
          </div>

          <div *ngIf="inviteLoading" class="empty-state">検索中...</div>
          <div *ngIf="!inviteLoading && inviteSearchResults.length === 0 && inviteSearchTerm">対象のユーザーが見つかりません</div>

          <div class="members-list" *ngIf="inviteSearchResults.length > 0">
            <div class="member-item" *ngFor="let u of inviteSearchResults">
              <div class="member-info">
                <div class="member-avatar">
                  <img *ngIf="getUserPhotoURL(u.id)" [src]="getUserPhotoURL(u.id)" [alt]="u.displayName || u.email">
                  <span *ngIf="!getUserPhotoURL(u.id)" class="avatar-text">{{ (u.displayName || u.email).slice(0,1) }}</span>
                </div>
                <div class="member-details">
                  <h4 class="member-name">{{ u.displayName || u.email }}</h4>
                  <p class="member-email">{{ u.email }}</p>
                </div>
              </div>
              <div class="member-meta">
                <button class="btn btn-medium btn-blue" (click)="sendInviteToUser(u.id, u.displayName, u.email)">招待を送信</button>
              </div>
            </div>
          </div>
        </div>
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
      font-size: 32px;
      font-weight: 700;
    }

    .group-description {
      margin: 0;
      color: #6b7280;
      font-size: 16px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 100px;
      height: 54px;
      justify-content: center;
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

    /* タイムライン */
    .timeline-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      overflow: visible; /* ツールチップがはみ出せるように */
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .timeline-controls {
      display: flex;
      align-items: center;
      gap: 20px;
    }


    .timeline-legend { display:flex; gap:12px; color:#6b7280; font-size: 13px; }
    .legend-item { display:flex; align-items:center; gap:6px; }
    .legend-color { width:12px; height:12px; border-radius:3px; display:inline-block; }
    .legend-color.priority-low { background:#60a5fa; }
    .legend-color.priority-medium { background:#34d399; }
    .legend-color.priority-high { background:#fb923c; }
    .legend-color.priority-urgent { background:#ef4444; }

    .timeline-container { 
      overflow: hidden; 
      padding-bottom: 8px; 
      position: relative; 
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }

    .timeline-scroll-area {
      overflow-x: auto;
      overflow-y: visible;
      max-height: 400px;
    }

    .timeline-grid { 
      position: relative; 
      display: flex; 
      min-width: fit-content; 
      border-bottom: 1px solid #e5e7eb; 
      padding-bottom: 8px; 
      background: #f9fafb;
    }

    .timeline-day { 
      text-align: center; 
      color: #6b7280; 
      font-size: 11px; 
      position: relative; 
      border-right: 1px solid #e5e7eb;
      padding: 4px 2px;
      min-width: 60px;
    }

    .day-date {
      font-weight: 600;
      color: #374151;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .day-weekday {
      font-size: 10px;
      color: #9ca3af;
      text-transform: uppercase;
      font-weight: 500;
    }

    .today-marker { 
      position: absolute; 
      top: 0; 
      bottom: -8px; 
      width: 2px; 
      background: #ef4444; 
      z-index: 10;
    }

    .timeline-rows { 
      position: relative; 
      overflow: visible; 
      pointer-events: none; 
      background: white;
      padding: 8px 0;
    }
    
    .timeline-row, .timeline-bar { pointer-events: auto; }
    .timeline-row { position: relative; height: 20px; margin: 6px 0; }
    
    .timeline-bar { 
      position: absolute; 
      top: 2px; 
      height: 16px; 
      border-radius: 8px; 
      background: #e5e7eb; 
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
      cursor: pointer;
      transition: all 0.2s ease;
      overflow: hidden;
    }

    .timeline-bar:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    .timeline-bar:hover .bar-tooltip {
      display: block;
    }

    /* 吹き出しツールチップのスタイル */
    .bubble-tooltip {
      position: absolute !important;
      background: white !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      pointer-events: none !important;
      z-index: 1000 !important;
      max-width: 250px !important;
      min-width: 180px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    .bubble-tooltip-content {
      position: relative !important;
      padding: 12px !important;
    }

    .bubble-tooltip-title {
      font-weight: 600 !important;
      color: #1f2937 !important;
      font-size: 13px !important;
      line-height: 1.4 !important;
      margin-bottom: 6px !important;
      word-break: break-word !important;
    }

    .bubble-tooltip-deadline {
      color: #6b7280 !important;
      font-size: 11px !important;
      margin-bottom: 6px !important;
    }

    .bubble-tooltip-row {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      margin-bottom: 6px !important;
    }

    .bubble-tooltip-priority {
      padding: 2px 6px !important;
      border-radius: 4px !important;
      font-size: 9px !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
    }

    .bubble-tooltip-priority.priority-low {
      background: #dbeafe !important;
      color: #1e40af !important;
    }

    .bubble-tooltip-priority.priority-medium {
      background: #dcfce7 !important;
      color: #166534 !important;
    }

    .bubble-tooltip-priority.priority-high {
      background: #fed7aa !important;
      color: #c2410c !important;
    }

    .bubble-tooltip-priority.priority-urgent {
      background: #fee2e2 !important;
      color: #dc2626 !important;
    }

    .bubble-tooltip-status {
      color: #6b7280 !important;
      font-size: 10px !important;
    }

    .bubble-tooltip-assignee {
      color: #6b7280 !important;
      font-size: 11px !important;
    }

    .bubble-tooltip-arrow {
      position: absolute !important;
      bottom: -6px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      width: 0 !important;
      height: 0 !important;
      border-left: 6px solid transparent !important;
      border-right: 6px solid transparent !important;
      border-top: 6px solid white !important;
    }

    .bubble-tooltip-arrow::before {
      content: '' !important;
      position: absolute !important;
      bottom: 1px !important;
      left: -6px !important;
      width: 0 !important;
      height: 0 !important;
      border-left: 6px solid transparent !important;
      border-right: 6px solid transparent !important;
      border-top: 6px solid #e5e7eb !important;
    }

    .bar-title {
      position: absolute;
      top: 50%;
      left: 8px;
      transform: translateY(-50%);
      font-size: 11px;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 16px);
    }

    .bar-progress {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: rgba(255,255,255,0.3);
      border-radius: 8px;
      transition: width 0.3s ease;
    }

    /* タイムラインも同配色に統一（低=青, 中=緑, 高=オレンジ, 緊急=赤） */
    .timeline-bar.priority-low { background: linear-gradient(135deg, #60a5fa, #3b82f6); }
    .timeline-bar.priority-medium { background: linear-gradient(135deg, #34d399, #10b981); }
    .timeline-bar.priority-high { background: linear-gradient(135deg, #fb923c, #f59e0b); }
    .timeline-bar.priority-urgent { background: linear-gradient(135deg, #ef4444, #dc2626); }

    .timeline-bar { position: relative; }
    .bar-tooltip { 
      position:absolute; 
      bottom: 100%; left: 50%; 
      transform: translate(-50%, -8px); 
      background: rgba(17,24,39,0.95); 
      color:#fff; 
      padding:10px 12px; 
      border-radius:8px; 
      font-size:12px; 
      line-height: 1.4;
      display:none; 
      width: 260px; /* 固定幅 */
      white-space: normal; /* 折り返し */
      word-break: break-word;
      text-align: left;
      z-index: 100; /* 前面に表示 */
      pointer-events: none;
      box-shadow: 0 6px 16px rgba(0,0,0,0.25);
    }
    .timeline-bar:hover .bar-tooltip { display:block; }
    .tooltip-title { font-weight:700; margin-bottom:4px; }
    .tooltip-line { opacity: .9; }

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

    .tasks-filters .btn-secondary {
      height: 42px;
      padding: 10px 12px;
      font-size: 14px;
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

    .tasks-table th:not(:first-child) {
      text-align: center;
    }

    .tasks-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
      background: white;
      font-size: 16px; /* タイトル以外の文字を大きく */
    }

    .tasks-table td:not(:first-child) {
      text-align: center;
    }

    .task-row:hover {
      background: #f8f9fa;
    }

    .task-title-cell {
      min-width: 180px;
      max-width: 250px;
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

    .task-occurred-date {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      font-style: italic;
    }

    .task-due-cell {
      white-space: nowrap;
      font-size: 16px; /* 文字サイズアップ */
      color: #111827; /* 黒 */
    }

    .task-due-cell.due-warning { color: #f59e0b; font-weight: 600; }
    .task-due-cell.due-danger { color: #ef4444; font-weight: 600; }
    .task-due-cell.overdue { color: #ef4444; font-weight: 600; }

    .overdue-text {
      color: #ef4444;
      font-weight: 600;
      font-size: 14px;
    }

    .task-assignee-cell {
      font-size: 16px; /* 文字サイズアップ */
      color: #111827; /* 黒 */
      min-width: 120px;
    }

    .task-priority-cell {
      text-align: left; /* 右寄り解消 */
      padding-left: 12px;
      min-width: 100px;
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
      background: #d1fae5; /* 緑 */
      color: #065f46;
    }

    .priority-high {
      background: #ffedd5; /* オレンジ */
      color: #9a3412;
    }

    .priority-urgent {
      background: #fee2e2; /* 赤 */
      color: #991b1b;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    /* テーブル内のステータスバッジを大きく表示 */
    .task-status-cell .status-badge {
      font-size: 16px;
      padding: 6px 10px;
    }

    .task-status-cell {
      min-width: 100px;
    }

    .status-not_started {
      background: #f3f4f6; /* グレー */
      color: #374151;
    }

    .status-in_progress {
      background: #dbeafe; /* 青 */
      color: #1e40af;
    }

    .status-completed {
      background: #d1fae5; /* 緑 */
      color: #065f46;
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

    .task-reaction-cell {
      text-align: center;
      min-width: 100px;
    }

    .reaction-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .reaction-btn {
      background: #f8f9fa;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer !important;
      font-size: 16px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 32px;
    }

    .reaction-btn:hover {
      background: #e2e8f0;
      border-color: #cbd5e1;
      transform: scale(1.05);
      cursor: pointer !important;
    }

    .reaction-btn.active {
      background: #dbeafe;
      border-color: #3b82f6;
      color: #1e40af;
      transform: scale(1.1);
      cursor: pointer !important;
    }

    .reaction-count {
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      min-width: 20px;
      text-align: center;
    }

    .reaction-btn-wrapper {
      position: relative;
      display: inline-block;
    }

    .reaction-tooltip {
      position: fixed;
      background: rgba(17, 24, 39, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      animation: tooltipFadeIn 0.2s ease-out;
      cursor: default;
      pointer-events: none;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .tooltip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }

    .tooltip-title {
      font-weight: 600;
      font-size: 16px;
    }

    .tooltip-count {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.1);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .tooltip-users {
      max-height: 120px;
      overflow-y: auto;
    }

    .user-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .tooltip-user {
      display: flex;
      align-items: center;
      padding: 4px 0;
    }

    .user-name {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
    }

    .no-reactions {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
      font-style: italic;
    }

    /* ツールチップの矢印 */
    .reaction-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: rgba(17, 24, 39, 0.95);
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
      padding: 3px 8px;
      font-size: 12px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 40px; /* ボタン幅を統一（完了・編集ボタン用） */
      white-space: nowrap; /* 折り返し防止 */
      height: 24px; /* 高さを統一 */
      display: inline-flex;
      align-items: center;
      justify-content: center; /* 文字を中央に */
      line-height: 1;
    }

    .btn-medium {
      padding: 6px 12px;
      font-size: 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 48px;
      white-space: nowrap;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .btn-blue {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
    }

    .btn-blue:hover {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      transform: translateY(-1px);
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

    /* 課題一覧テーブルのボタン専用スタイル */
    .task-actions-cell .btn-success,
    .task-actions-cell .btn-primary {
      padding: 6px 12px;
      font-size: 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 50px;
      white-space: nowrap;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
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

    /* 統一: 低=青, 中=緑, 高=オレンジ, 緊急=赤 */
    .priority-low { background: #dbeafe; color: #1e40af; }
    .priority-medium { background: #d1fae5; color: #065f46; }
    .priority-high { background: #ffedd5; color: #9a3412; }
    .priority-urgent { background: #fee2e2; color: #991b1b; }

    /* ステータスバッジ（カード表示用） */
    .status-not_started { background: #f3f4f6; color: #374151; }
    .status-in_progress { background: #dbeafe; color: #1e40af; }
    .status-completed { background: #d1fae5; color: #065f46; }

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
      font-size: 14px;
      line-height: 1.5;
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

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
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

    /* ヘッダー招待ボタン */
    .btn-invite-header {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-invite-header:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
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

    .error-message {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
    }

    .form-input.error,
    .form-textarea.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
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

    /* アナウンス関連スタイル */
    .btn-announcement {
      background: white;
      color: #374151;
      border: 2px solid #e5e7eb;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-announcement:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      border-color: #d1d5db;
    }

    .btn-announcement-unread {
      background: #fef3c7;
      border-color: #f59e0b;
      color: #92400e;
    }

    .btn-announcement-unread:hover {
      background: #fde68a;
      border-color: #d97706;
    }

    .announcements-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .announcement-item {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      border-left: 4px solid #f59e0b;
    }

    .announcement-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .announcement-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .important-badge {
      background: #ef4444;
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .announcement-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .announcement-author {
      font-size: 0.875rem;
      color: #6b7280;
      font-weight: 500;
    }

    .announcement-date {
      font-size: 0.75rem;
      color: #9ca3af;
    }

    .announcement-content {
      color: #374151;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .checkbox-input {
      width: 16px;
      height: 16px;
      accent-color: #f59e0b;
    }

    .checkbox-text {
      font-size: 0.875rem;
      color: #374151;
    }

    .form-textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 0.875rem;
      font-family: inherit;
      resize: vertical;
      min-height: 120px;
    }

    .form-textarea:focus {
      outline: none;
      border-color: #f59e0b;
      box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }

    .no-announcements {
      text-align: center;
      padding: 40px 20px;
      color: #6b7280;
    }

    .no-announcements p {
      margin-bottom: 20px;
      font-size: 1.125rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .announcement-list-modal {
      max-width: 800px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .announcement-list-modal .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .announcement-list-modal .modal-header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .announcement-list-modal .modal-content {
      max-height: 50vh;
      padding: 24px;
    }

    .announcement-list-modal .modal-content.scrollable {
      overflow-y: auto;
      max-height: 40vh;
    }

    .announcement-list-modal .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .announcement-list-modal .announcement-item {
      background: #f8fafc;
      border-radius: 12px;
      padding: 24px;
      border-left: 4px solid #f59e0b;
      margin-bottom: 8px;
    }

    .announcement-list-modal .announcement-header {
      margin-bottom: 16px;
    }

    .announcement-list-modal .announcement-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 8px;
    }

    .announcement-list-modal .announcement-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .announcement-list-modal .announcement-content {
      color: #374151;
      line-height: 1.6;
      white-space: pre-wrap;
    }

    .announcement-actions {
      position: relative;
      display: inline-block;
    }

    .announcement-menu-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }

    .announcement-menu-btn:hover {
      background: #f3f4f6;
      color: #374151;
    }

    .announcement-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10;
      min-width: 120px;
    }

    .announcement-menu-item {
      display: block;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: none;
      text-align: left;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-size: 0.875rem;
    }

    .announcement-menu-item:hover {
      background: #f3f4f6;
    }

    .announcement-menu-item.delete {
      color: #dc2626;
    }

    .announcement-menu-item.delete:hover {
      background: #fef2f2;
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
      align-items: flex-start;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      transition: all 0.2s;
      position: relative;
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
      overflow: hidden;
    }

    .member-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
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
      flex: 1;
    }

    .member-actions {
      position: absolute;
      bottom: 16px;
      right: 16px;
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

    .invite-modal .search-section {
      background: rgba(255,255,255,0.95);
      padding: 1rem;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      margin-bottom: 0.75rem;
    }
    .invite-modal .search-input-group {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .invite-modal .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 2px solid #e5e7eb;
      border-radius: 10px;
      font-size: 0.95rem;
      transition: all .2s ease;
    }
    .invite-modal .search-input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .invite-modal .search-btn {
      background: linear-gradient(135deg, #667eea 0%, #5a67d8 100%);
      color: #fff;
      border: none;
      padding: 0.65rem 1rem;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: all .2s ease;
      min-width: 48px;
    }
    .invite-modal .search-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }


    /* アクションメニューモーダル */
    .actions-modal {
      max-width: 600px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .action-card {
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .action-card:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .action-card-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-color: transparent;
    }

    .action-card-primary:hover {
      background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
      border-color: transparent;
    }

    .action-card-unread {
      background: #fef3c7;
      border-color: #f59e0b;
    }

    .action-card-unread:hover {
      background: #fde68a;
      border-color: #d97706;
    }

    .action-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .action-title {
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 4px;
    }

    .action-card-primary .action-title {
      color: white;
    }

    .action-description {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }

    .action-card-primary .action-description {
      color: rgba(255, 255, 255, 0.8);
    }

    .action-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
      min-width: 20px;
      text-align: center;
    }

    /* メニューボタンの通知バッジ */
    .menu-btn {
      position: relative;
    }

    .menu-notification-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      background: #ef4444;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    /* 文字数制限警告 */
    .char-limit-warning {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
      font-weight: 500;
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
  private notificationService = inject(NotificationService);
  private announcementService = inject(AnnouncementService);
  private cd = inject(ChangeDetectorRef);
  
  // メインページの通知バッジ更新用（簡易実装）
  private updateMainPageNotificationBadge() {
    // メインページの通知バッジを更新するためのイベントを発火
    window.dispatchEvent(new CustomEvent('updateGroupNotificationBadge', {
      detail: { groupId: this.group?.id }
    }));
  }
  private firestore = inject(Firestore);

  private destroy$ = new Subject<void>();

  group: Group | null = null;
  members$: Observable<GroupMembership[]> = of([]);
  members: GroupMembership[] = []; // メンバー情報をキャッシュ
  memberNameById: { [userId: string]: string } = {}; // ユーザー名キャッシュ
  memberEmailById: { [userId: string]: string } = {}; // メールアドレスキャッシュ
  memberPhotoById: { [userId: string]: string } = {}; // プロフィール画像URLキャッシュ
  tasks$: Observable<TaskItem[]> = of([]);
  filteredTasks: TaskItem[] = [];
  showTimeline = false;
  timelineDays: Date[] = [];
  timelineItems: Array<{ id:string; title:string; priority:string; left:number; width:number; due: any; assignee: string; progress:number }>=[];
  timelineTodayOffset = -1;
  dayWidth = 40;
  timelineStartDate = new Date();
  timelineEndDate = new Date();

  showCreateModal = false;
  showEditModal = false;
  loading = false;
  editingTask: TaskItem | null = null;

  statusFilter = '';
  priorityFilter = '';
  assigneeFilter = '';
  taskSortByDueDate = 'asc'; // デフォルトで期限が近い順

  // 参加リクエスト関連
  joinRequests$: Observable<JoinRequest[]> = of([]);
  showJoinRequests = false;
  isGroupOwner = false;
  joinRequestCount = 0;

  // アナウンス関連
  announcements: Announcement[] = [];
  showAnnouncementModalFlag = false;
  showAnnouncementListModalFlag = false;
  creatingAnnouncement = false;
  announcementData = {
    title: '',
    content: ''
  };
  announcementTitleLength = 0;
  announcementFormSubmitted = false;
  unreadAnnouncements: Set<string> = new Set();
  showAnnouncementMenu: string | null = null;

  // メンバー表示関連
  showMembers = false;

  // モーダル表示関連
  showActionsModal = false;

  // 文字数制限関連
  titleLength = 0;
  contentLength = 0;

  // リアクション関連
  taskReactions: { [taskId: string]: { count: number; hasReacted: boolean } } = {};
  taskReactionUsers: { [taskId: string]: any[] } = {}; // リアクションしたユーザー一覧

  // ツールチップ関連
  showTooltip = false;
  tooltipTaskId = '';
  tooltipPosition = { x: 0, y: 0 };

  showInviteModal = false;
  inviteSearchTerm = '';
  inviteSearchResults: { id: string, displayName: string, email: string }[] = [];
  inviteLoading = false;

  taskForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    content: [''],
    assigneeId: [''],
    priority: ['medium', [Validators.required]],
    occurredOn: [''],
    dueDate: [''],
    progress: [0, [Validators.min(0), Validators.max(100)]]
  }, { validators: this.dateValidator });

  editForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    content: [''],
    assigneeId: [''],
    priority: ['medium', [Validators.required]],
    occurredOn: [''],
    dueDate: [''],
    progress: [0, [Validators.min(0), Validators.max(100)]],
    status: ['not_started', [Validators.required]]
  }, { validators: this.dateValidator });

  // 日付バリデーター：期限が発生日より前にならないようにする
  dateValidator(group: any) {
    const occurredOn = group.get('occurredOn')?.value;
    const dueDate = group.get('dueDate')?.value;
    
    if (occurredOn && dueDate) {
      const occurredDate = new Date(occurredOn);
      const dueDateObj = new Date(dueDate);
      
      // 時刻も含めて比較
      if (dueDateObj <= occurredDate) {
        return { dateInvalid: true };
      }
    }
    
    return null;
  }

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
        
        // アナウンスを読み込み
        this.loadAnnouncements(group.id);
        
        // タイムライン初期化
        this.initializeTimeline();
        
        // グループオーナーチェック
        this.auth.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
          this.isGroupOwner = !!(user && (user as any).uid === group.ownerId);
          
          // グループオーナーの場合、参加リクエストを読み込み
          if (this.isGroupOwner) {
            this.joinRequests$ = this.joinRequestService.getGroupJoinRequests(group.id);
            // 参加リクエスト数を監視
            this.joinRequests$.pipe(takeUntil(this.destroy$)).subscribe(requests => {
              this.joinRequestCount = requests.length;
            });
          }
        });
        
        // メンバー情報をキャッシュし、ユーザープロファイルから表示名を解決
        this.members$.pipe(takeUntil(this.destroy$)).subscribe(async members => {
          this.members = members;
          const uniqueUserIds = Array.from(new Set(members.map(m => m.userId)));
          let hasUpdates = false;
          
          for (const uid of uniqueUserIds) {
            try {
              // 既にキャッシュ済みならスキップ
              if (this.memberNameById[uid]) continue;
              
              const profile = await this.userService.getUserProfile(uid);
              if (profile?.displayName) {
                this.memberNameById[uid] = profile.displayName;
                hasUpdates = true;
              }
              
              // メールアドレスも取得
              if (profile?.email) {
                this.memberEmailById[uid] = profile.email;
                hasUpdates = true;
              } else {
                // displayNameが取得できない場合は、メンバーシップの情報から推測
                const member = members.find(m => m.userId === uid);
                if (member?.userEmail && member.userEmail !== 'owner@example.com') {
                  // メールアドレスから名前を抽出してdisplayNameとして保存
                  const emailName = member.userEmail.split('@')[0];
                  this.memberNameById[uid] = emailName;
                  this.memberEmailById[uid] = member.userEmail;
                  // Firestoreのプロファイルも更新
                  await this.userService.updateUserProfile(uid, { displayName: emailName });
                  hasUpdates = true;
                }
              }
            } catch (error) {
              console.error('初期化時ユーザープロファイル取得エラー:', uid, error);
            }
          }
          
          // ユーザー名が更新された場合は変更検知をトリガー
          if (hasUpdates) {
            this.cd.detectChanges();
          }
        });
        
        this.tasks$.pipe(takeUntil(this.destroy$)).subscribe(async tasks => {
          // assigneeNameがない課題の担当者名を補完
          for (const task of tasks) {
            if (task.assigneeId && !task.assigneeName) {
              try {
                const assigneeProfile = await this.userService.getUserProfile(task.assigneeId);
                if (assigneeProfile?.displayName) {
                  // Firestoreの課題データを更新
                  await this.taskService.updateTask(task.id, { assigneeName: assigneeProfile.displayName });
                  task.assigneeName = assigneeProfile.displayName;
                }
              } catch (error) {
                console.error('担当者名補完エラー:', error);
              }
            }
          }
          
          this.filteredTasks = tasks;
          this.applyFilters();
          this.buildTimeline(tasks);
          // リアクション状態を初期化（少し遅延させて確実に初期化）
          setTimeout(() => {
            this.initializeTaskReactions(tasks);
          }, 100);
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

      // 期限でソート
      if (this.taskSortByDueDate) {
        this.filteredTasks.sort((a, b) => {
          const aDate = a.dueDate ? (a.dueDate.toDate ? a.dueDate.toDate() : new Date(a.dueDate)) : new Date('9999-12-31');
          const bDate = b.dueDate ? (b.dueDate.toDate ? b.dueDate.toDate() : new Date(b.dueDate)) : new Date('9999-12-31');
          
          if (this.taskSortByDueDate === 'asc') {
            return aDate.getTime() - bDate.getTime();
          } else if (this.taskSortByDueDate === 'desc') {
            return bDate.getTime() - aDate.getTime();
          }
          return 0;
        });
      }
    });
  }

  clearFilters() {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.assigneeFilter = '';
    this.taskSortByDueDate = '';
    this.applyFilters();
  }

  toggleTimeline() {
    this.showTimeline = !this.showTimeline;
    if (this.showTimeline) {
      this.initializeTimeline();
      this.tasks$.pipe(take(1)).subscribe(tasks => this.buildTimeline(tasks));
    }
  }

  initializeTimeline() {
    const today = new Date();
    
    // 1ヶ月固定（今日から前後15日）
    this.timelineStartDate = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000);
    this.timelineEndDate = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    // タイムラインコンテナの実際の幅を取得
    setTimeout(() => {
      const timelineContainer = document.querySelector('.timeline-scroll-area');
      if (timelineContainer) {
        const containerWidth = timelineContainer.clientWidth;
        this.dayWidth = Math.max(containerWidth / 30, 20);
        
        this.tasks$.pipe(take(1)).subscribe(tasks => this.buildTimeline(tasks));
      } else {
        // フォールバック
        this.dayWidth = 40;
        this.tasks$.pipe(take(1)).subscribe(tasks => this.buildTimeline(tasks));
      }
    }, 100);
  }

  formatTimelineDate(date: Date, index: number): string {
    // 月の表示は最初の日のみ、または月が変わった時のみ
    if (index === 0) {
      return date.toLocaleDateString('ja-JP', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // 前の日と月が違う場合は月を表示
    if (index > 0 && this.timelineDays[index - 1].getMonth() !== date.getMonth()) {
      return date.toLocaleDateString('ja-JP', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    // それ以外は日付のみ
    return date.getDate().toString();
  }

  getWeekdayName(date: Date): string {
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    return weekdays[date.getDay()];
  }

  onTimelineScroll(event: Event) {
    // スクロール位置に基づいて表示期間を調整
    const scrollElement = event.target as HTMLElement;
    const scrollLeft = scrollElement.scrollLeft;
    const maxScroll = scrollElement.scrollWidth - scrollElement.clientWidth;
    
    // スクロール位置に応じて期間を調整（必要に応じて実装）
    // 現在は基本的なスクロール機能のみ
  }

  showSimpleTooltip(event: MouseEvent, item: any) {
    // 既存のツールチップを削除
    this.hideSimpleTooltip();
    
    
    // 吹き出しツールチップを作成
    const tooltip = document.createElement('div');
    tooltip.className = 'bubble-tooltip';
    tooltip.style.cssText = `
      position: absolute !important;
      background: white !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      pointer-events: none !important;
      z-index: 1000 !important;
      max-width: 320px !important;
      min-width: 220px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    `;
    
    tooltip.innerHTML = `
      <div style="position: relative !important; padding: 16px !important;">
        <div style="font-weight: 600 !important; color: #1f2937 !important; font-size: 16px !important; line-height: 1.4 !important; margin-bottom: 8px !important; word-break: break-word !important;">${item.title}</div>
        <div style="color: #6b7280 !important; font-size: 14px !important; margin-bottom: 8px !important;">期限: ${item.due ? new Date(item.due).toLocaleDateString('ja-JP') : '未設定'}</div>
        <div style="display: flex !important; align-items: center !important; gap: 10px !important; margin-bottom: 8px !important;">
          <span style="padding: 4px 8px !important; border-radius: 4px !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase !important; background: ${this.getPriorityColor(item.priority)} !important; color: white !important;">${this.getPriorityLabel(item.priority)}</span>
          <span style="color: #6b7280 !important; font-size: 13px !important;">進行中</span>
        </div>
        <div style="color: #6b7280 !important; font-size: 14px !important;">担当者: ${item.assignee}</div>
        <div style="position: absolute !important; bottom: -8px !important; left: 50% !important; transform: translateX(-50%) !important; width: 0 !important; height: 0 !important; border-left: 8px solid transparent !important; border-right: 8px solid transparent !important; border-top: 8px solid white !important;"></div>
      </div>
    `;
    
    document.body.appendChild(tooltip);
    
    // 位置を調整（バーの真上に表示）
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    // バーの中央上に配置
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - 10;
    
    // 画面の端を考慮した位置調整
    if (left < 10) {
      left = 10;
    }
    if (left + tooltipRect.width > window.innerWidth - 10) {
      left = window.innerWidth - tooltipRect.width - 10;
    }
    if (top < 10) {
      top = rect.bottom + 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    
  }

  hideSimpleTooltip() {
    const tooltip = document.querySelector('.bubble-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  private buildTimeline(tasks: TaskItem[]) {
    // 日付をローカルの0時に正規化（より正確に）
    const toMidnight = (d: Date) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    // 新しい期間設定を使用
    const today = toMidnight(new Date());
    const start = toMidnight(new Date(this.timelineStartDate));
    const end = toMidnight(new Date(this.timelineEndDate));

    // 目盛り生成（より正確に）
    const days: Date[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
      days.push(toMidnight(d));
    }
    this.timelineDays = days;

    // today marker offset（より正確に）
    const todayIndex = days.findIndex(day => 
      day.getFullYear() === today.getFullYear() && 
      day.getMonth() === today.getMonth() && 
      day.getDate() === today.getDate()
    );
    
    // タイムライングリッドの実際の幅を取得して今日マーカーの位置を計算
    setTimeout(() => {
      const timelineGrid = document.querySelector('.timeline-grid');
      if (timelineGrid) {
        const gridWidth = timelineGrid.clientWidth;
        const totalDays = days.length;
        const actualDayWidth = gridWidth / totalDays;
        this.timelineTodayOffset = todayIndex >= 0 ? todayIndex * actualDayWidth : 0;
      } else {
        this.timelineTodayOffset = todayIndex >= 0 ? todayIndex * this.dayWidth : 0;
      }
    }, 100);


    // バーに必要な位置と幅を計算（動的な日幅を使用）。
    // 既存データ: occurredOn(開始)〜dueDate(終了)。
    const items: Array<{ id:string; title:string; priority:string; left:number; width:number; due:any; assignee:string; progress:number }>=[];
    const toDate = (v:any) => v?.toDate ? v.toDate() : (v ? new Date(v) : undefined);
    (tasks || []).forEach(t => {
      if (t.status === 'completed') return; // 完了は非表示
      
      // 日付の変換と正規化
      const startDateRaw = toDate(t.occurredOn) || today;
      const endDateRaw = toDate(t.dueDate) || new Date(startDateRaw.getTime() + dayMs);
      const startDate = toMidnight(startDateRaw);
      const endDate = toMidnight(endDateRaw);


      // 可視範囲外はスキップ
      if (endDate < start || startDate > end) {
        return;
      }

      const clampedStart = startDate < start ? start : startDate;
      const clampedEnd = endDate > end ? end : endDate;
      
      // 日付のインデックスを正確に計算
      const startIndex = days.findIndex(day => 
        day.getFullYear() === clampedStart.getFullYear() && 
        day.getMonth() === clampedStart.getMonth() && 
        day.getDate() === clampedStart.getDate()
      );
      const endIndex = days.findIndex(day => 
        day.getFullYear() === clampedEnd.getFullYear() && 
        day.getMonth() === clampedEnd.getMonth() && 
        day.getDate() === clampedEnd.getDate()
      );
      
      if (startIndex === -1 || endIndex === -1) {
        return;
      }
      
      // タイムライングリッドの実際の幅を取得
      const timelineGrid = document.querySelector('.timeline-grid');
      let actualDayWidth = this.dayWidth;
      
      if (timelineGrid) {
        const gridWidth = timelineGrid.clientWidth;
        const totalDays = days.length;
        actualDayWidth = gridWidth / totalDays;
      }

      const left = Math.max(0, startIndex * actualDayWidth);
      const widthDays = Math.max(1, endIndex - startIndex + 1);
      const width = widthDays * actualDayWidth - 4;


      items.push({
        id: t.id,
        title: t.title,
        priority: t.priority,
        left,
        width,
        due: endDate,
        assignee: this.getAssigneeName(t.assigneeId),
        progress: t.progress || 0
      });
    });
    this.timelineItems = items;
  }

  // 課題作成時に期限間近かどうかをチェックして通知を送信
  private async checkAndNotifyTaskDueSoon(task: TaskItem): Promise<void> {
    if (!this.group || !task.dueDate) return;

    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // 期限日を取得
    const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    
    // 期限が3日以内の場合
    if (dueDate <= threeDaysFromNow && dueDate >= now) {
      try {
        // 担当者に通知
        if (task.assigneeId) {
          await this.notificationService.createTaskNotification(
            task.assigneeId,
            'task_due_soon' as any,
            task.id,
            task.groupId,
            { 
              taskTitle: task.title, 
              dueDate: task.dueDate,
              groupName: this.group.name
            }
          );
        }

        // グループオーナーに通知（担当者と異なる場合のみ）
        if (this.group.ownerId && this.group.ownerId !== task.assigneeId) {
          await this.notificationService.createTaskNotification(
            this.group.ownerId,
            'task_due_soon' as any,
            task.id,
            task.groupId,
            { 
              taskTitle: task.title, 
              dueDate: task.dueDate,
              groupName: this.group.name,
              assigneeName: this.getAssigneeName(task.assigneeId)
            }
          );
        }
      } catch (error) {
        console.error('期限間近通知エラー:', error);
      }
    }
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
      // 「グループオーナー」という文字列は無視
      if (member.userName && member.userName !== 'グループオーナー') {
        return member.userName;
      }
      // メールアドレスから名前を抽出（デフォルトメールは無視）
      if (member.userEmail && member.userEmail !== 'owner@example.com') {
        return member.userEmail.split('@')[0];
      }
    }
    
    // ユーザー名が取得できていない場合は、非同期で取得を試行
    this.loadUserDisplayName(userId);
    return 'ユーザー';
  }

  // 非同期でユーザー名を取得するメソッド
  async getAssigneeNameAsync(userId: string | undefined): Promise<string> {
    if (!userId) return '未設定';
    
    // ユーザープロファイル由来の表示名を最優先
    if (this.memberNameById[userId]) {
      return this.memberNameById[userId];
    }
    
    try {
      const profile = await this.userService.getUserProfile(userId);
      if (profile?.displayName) {
        this.memberNameById[userId] = profile.displayName;
        return profile.displayName;
      }
    } catch (error) {
      console.error('ユーザープロファイル取得エラー:', error);
    }
    
    // メンバーシップに保存されている名前/メールをフォールバック
    const member = this.members.find(m => m.userId === userId);
    if (member) {
      // 「グループオーナー」という文字列は無視
      if (member.userName && member.userName !== 'グループオーナー') {
        return member.userName;
      }
      // メールアドレスから名前を抽出（デフォルトメールは無視）
      if (member.userEmail && member.userEmail !== 'owner@example.com') {
        return member.userEmail.split('@')[0];
      }
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
    if (userEmail && userEmail !== 'owner@example.com') {
      return userEmail.split('@')[0];
    }
    
    // ユーザー名が取得できていない場合は、非同期で取得を試行
    this.loadUserDisplayName(userId);
    return 'ユーザー';
  }

  private async loadUserDisplayName(userId: string): Promise<void> {
    try {
      // 既にキャッシュ済みならスキップ
      if (this.memberNameById[userId]) return;
      
      const profile = await this.userService.getUserProfile(userId);
      if (profile?.displayName) {
        this.memberNameById[userId] = profile.displayName;
        // 変更検知をトリガー
        this.cd.detectChanges();
      } else {
        // displayNameが取得できない場合は、メンバーシップの情報から推測
        const member = this.members.find(m => m.userId === userId);
        if (member?.userEmail && member.userEmail !== 'owner@example.com') {
          // メールアドレスから名前を抽出してdisplayNameとして保存
          const emailName = member.userEmail.split('@')[0];
          this.memberNameById[userId] = emailName;
          // Firestoreのプロファイルも更新
          await this.userService.updateUserProfile(userId, { displayName: emailName });
          // 変更検知をトリガー
          this.cd.detectChanges();
        }
      }
    } catch (error) {
      console.error('ユーザー名取得エラー:', error);
    }
  }

  private async loadUserPhotoURL(userId: string): Promise<void> {
    try {
      // 既にキャッシュ済みならスキップ
      if (this.memberPhotoById[userId]) return;
      
      const profile = await this.userService.getUserProfile(userId);
      if (profile?.photoURL) {
        this.memberPhotoById[userId] = profile.photoURL;
        // 変更検知をトリガー
        this.cd.detectChanges();
      }
    } catch (error) {
      console.error('プロフィール画像取得エラー:', error);
    }
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

  getPriorityColor(priority: string): string {
    const colors = {
      low: '#60a5fa',
      medium: '#34d399',
      high: '#fb923c',
      urgent: '#ef4444'
    };
    return colors[priority as keyof typeof colors] || '#6b7280';
  }

  getStatusLabel(status: string): string {
    const labels = {
      not_started: '未着手',
      in_progress: '実行中',
      completed: '完了'
    };
    return labels[status as keyof typeof labels] || status;
  }

  formatDate(date: any): string {
    if (!date) return '未設定';
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    
    // 年をまたぐ場合は yyyy/mm/dd 形式
    if (d.getFullYear() !== now.getFullYear()) {
      return d.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/\//g, '/');
    }
    
    // 同年の場合は mm/dd 形式
    return d.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  isDueWithinDays(date: any, days: number): boolean {
    if (!date) return false;
    const d = date.toDate ? date.toDate() : new Date(date);
    const now = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + days);
    return d >= now && d <= limit;
  }

  showCreateTaskModal() {
    this.taskForm.patchValue({
      title: '',
      content: '',
      assigneeId: '',
      priority: 'medium',
      occurredOn: this.formatDateForInput(new Date()),
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
      const createdTask = await this.taskService.createTask(this.group.id, {
        title: taskData.title!,
        content: taskData.content || '',
        assigneeId: taskData.assigneeId || '',
        priority: taskData.priority as any,
        occurredOn: taskData.occurredOn ? new Date(taskData.occurredOn) : new Date(),
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
        progress: taskData.progress || 0,
        status: 'not_started',
        isRecurring: false
      });
      
      // 期限間近の課題かどうかをチェックして通知を送信
      if (createdTask) {
        await this.checkAndNotifyTaskDueSoon(createdTask);
      }
      
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
      occurredOn: task.occurredOn ? this.formatDateForInput(task.occurredOn) : '',
      dueDate: task.dueDate ? this.formatDateForInput(task.dueDate) : '',
      progress: task.progress || 0,
      status: task.status
    });
    this.showEditModal = true;
  }

  openTaskFromTimeline(taskId: string) {
    if (!taskId) return;
    // 現在のfilteredTasksから該当を検索
    const target = this.filteredTasks.find(t => t.id === taskId);
    if (target) {
      this.editTask(target);
    } else {
      // 非同期で取得してから開くフォールバック
      this.tasks$.pipe(take(1)).subscribe(tasks => {
        const t = (tasks || []).find(x => x.id === taskId);
        if (t) this.editTask(t);
      });
    }
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
        occurredOn: taskData.occurredOn ? new Date(taskData.occurredOn) : this.editingTask.occurredOn,
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
    // datetime-local形式に変換（YYYY-MM-DDTHH:mm）
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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

  // 招待リンクをクリップボードにコピー
  async copyInviteLink() {
    if (!this.group) return;
    
    const inviteUrl = `${window.location.origin}/group/${this.group.id}/join`;
    
    try {
      await navigator.clipboard.writeText(inviteUrl);
      // 成功メッセージを表示（簡易的な実装）
      alert('招待リンクをクリップボードにコピーしました！');
    } catch (error) {
      console.error('クリップボードへのコピーに失敗しました:', error);
      // フォールバック: テキストエリアを使用
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('招待リンクをクリップボードにコピーしました！');
      } catch (fallbackError) {
        console.error('フォールバックコピーも失敗しました:', fallbackError);
        alert('招待リンク: ' + inviteUrl);
      }
      document.body.removeChild(textArea);
    }
  }

  getMemberInitial(name: string): string {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  }

  getMemberInitialForAvatar(userId: string, userName?: string, userEmail?: string): string {
    // キャッシュされた実際のユーザー名を優先
    if (this.memberNameById[userId]) {
      return this.memberNameById[userId].charAt(0).toUpperCase();
    }
    
    // グループメンバーシップのuserNameが「グループオーナー」の場合は無視
    if (userName && userName !== 'グループオーナー') {
      return userName.charAt(0).toUpperCase();
    }
    
    // メールアドレスから名前を抽出
    if (userEmail && userEmail !== 'owner@example.com') {
      return userEmail.split('@')[0].charAt(0).toUpperCase();
    }
    
    // ユーザー名が取得できていない場合は、非同期で取得を試行
    this.loadUserDisplayName(userId);
    return 'U';
  }

  getMemberPhotoURL(userId: string): string | null {
    // キャッシュされたプロフィール画像URLを確認
    if (this.memberPhotoById && this.memberPhotoById[userId]) {
      return this.memberPhotoById[userId];
    }
    
    // 非同期でプロフィール画像を取得
    this.loadUserPhotoURL(userId);
    return null;
  }

  getUserPhotoURL(userId: string): string | null {
    // キャッシュされたプロフィール画像URLを確認
    if (this.memberPhotoById && this.memberPhotoById[userId]) {
      return this.memberPhotoById[userId];
    }
    
    // 非同期でプロフィール画像を取得
    this.loadUserPhotoURL(userId);
    return null;
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

  // リアクション機能
  async toggleReaction(taskId: string): Promise<void> {
    try {
      await this.taskService.addTaskReaction(taskId);
      // リアクション状態を即座に更新
      this.refreshTaskReactionState(taskId);
    } catch (error) {
      console.error('リアクションエラー:', error);
    }
  }

  hasUserReacted(taskId: string): boolean {
    return this.taskReactions[taskId]?.hasReacted || false;
  }

  getReactionCount(taskId: string): number {
    return this.taskReactions[taskId]?.count || 0;
  }

  private updateTaskReactionState(taskId: string): void {
    // リアクション数を取得
    this.taskService.getTaskReactionCount(taskId).subscribe(count => {
      this.taskReactions[taskId] = {
        ...this.taskReactions[taskId],
        count
      };
    });

    // 現在のユーザーがリアクションしているかチェック
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      this.taskService.hasUserReacted(taskId, currentUser.uid).subscribe(hasReacted => {
        this.taskReactions[taskId] = {
          ...this.taskReactions[taskId],
          hasReacted
        };
      });
    }

    // リアクションしたユーザー一覧を取得
    this.taskService.getTaskReactions(taskId).subscribe(reactions => {
      this.taskReactionUsers[taskId] = reactions;
    });
  }

  // ツールチップ機能
  showReactionTooltip(taskId: string, event: MouseEvent): void {
    this.tooltipTaskId = taskId;
    this.showTooltip = true;
    
    // ツールチップの位置を計算
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipWidth = 200; // ツールチップの幅
    const tooltipHeight = 80; // ツールチップの高さ（概算）
    
    this.tooltipPosition = {
      x: rect.left + rect.width / 2 - tooltipWidth / 2, // ボタンの中央にツールチップの中央を合わせる
      y: rect.top - tooltipHeight - 15 // ボタンの上に適切な間隔で表示
    };
  }

  hideReactionTooltip(): void {
    this.showTooltip = false;
    this.tooltipTaskId = '';
  }

  getReactionUsers(taskId: string): any[] {
    return this.taskReactionUsers[taskId] || [];
  }

  private refreshTaskReactionState(taskId: string): void {
    // リアクション状態を即座に更新（リアルタイム）
    this.taskService.getTaskReactions(taskId).subscribe(reactions => {
      const currentUser = this.auth.currentUser;
      const hasReacted = currentUser ? reactions.some(r => r.userId === currentUser.uid) : false;
      
      this.taskReactions[taskId] = {
        count: reactions.length,
        hasReacted
      };
      
      // リアクションしたユーザー一覧も更新
      this.taskReactionUsers[taskId] = reactions;
    });
  }

  private initializeTaskReactions(tasks: TaskItem[]): void {
    // 既存のリアクション状態をクリア
    this.taskReactions = {};
    
    // 各課題のリアクション状態を初期化
    tasks.forEach(task => {
      this.taskReactions[task.id] = {
        count: 0,
        hasReacted: false
      };
      this.updateTaskReactionState(task.id);
    });
  }

  // アナウンス関連メソッド
  loadAnnouncements(groupId: string): void {
    this.announcementService.getGroupAnnouncements(groupId).pipe(
      takeUntil(this.destroy$)
    ).subscribe(announcements => {
      this.announcements = announcements;
      this.checkUnreadAnnouncements();
      
      // アナウンスを確認した時にメインページの通知バッジを更新
      this.updateMainPageNotificationBadge();
    });
  }

  checkUnreadAnnouncements(): void {
    const currentUser = this.auth.currentUser;
    if (!currentUser || !this.group) return;

    // ユーザーが最後にアナウンスを確認した日時を取得
    const lastChecked = localStorage.getItem(`announcements_checked_${this.group.id}_${currentUser.uid}`);
    const lastCheckedTime = lastChecked ? new Date(lastChecked) : new Date(0);

    // 未読のアナウンスをチェック
    this.unreadAnnouncements.clear();
    this.announcements.forEach(announcement => {
      const announcementTime = announcement.createdAt?.toDate?.() || new Date(0);
      if (announcementTime > lastCheckedTime && announcement.authorId !== currentUser.uid) {
        this.unreadAnnouncements.add(announcement.id);
      }
    });
  }

  markAnnouncementsAsRead(): void {
    const currentUser = this.auth.currentUser;
    if (!currentUser || !this.group) return;

    // 現在の日時を保存
    localStorage.setItem(`announcements_checked_${this.group.id}_${currentUser.uid}`, new Date().toISOString());
    this.unreadAnnouncements.clear();
    
    // メインページに通知バッジ更新を通知
    window.dispatchEvent(new CustomEvent('updateGroupNotificationBadge', {
      detail: { groupId: this.group.id }
    }));
  }

  hasUnreadAnnouncements(): boolean {
    return this.unreadAnnouncements.size > 0;
  }

  // アナウンス削除関連メソッド
  toggleAnnouncementMenu(announcementId: string): void {
    this.showAnnouncementMenu = this.showAnnouncementMenu === announcementId ? null : announcementId;
  }

  closeAnnouncementMenu(): void {
    this.showAnnouncementMenu = null;
  }

  canDeleteAnnouncement(announcement: Announcement): boolean {
    const currentUser = this.auth.currentUser;
    return currentUser ? announcement.authorId === currentUser.uid : false;
  }

  async deleteAnnouncement(announcementId: string): Promise<void> {
    if (!confirm('このアナウンスを削除しますか？')) {
      return;
    }

    try {
      await this.announcementService.deleteAnnouncement(announcementId);
      alert('アナウンスを削除しました。');
      this.closeAnnouncementMenu();
      this.loadAnnouncements(this.group?.id || '');
    } catch (error) {
      console.error('アナウンス削除エラー:', error);
      alert('アナウンスの削除に失敗しました。');
    }
  }

  showAnnouncementListModal(): void {
    this.showAnnouncementListModalFlag = true;
    this.loadAnnouncements(this.group?.id || '');
    this.markAnnouncementsAsRead();
    this.closeAnnouncementMenu();
  }

  closeAnnouncementListModal(): void {
    this.showAnnouncementListModalFlag = false;
  }

  showAnnouncementModal(): void {
    this.showAnnouncementModalFlag = true;
    this.closeAnnouncementListModal(); // アナウンス一覧ポップアップを閉じる
    this.announcementData = {
      title: '',
      content: ''
    };
    this.announcementTitleLength = 0;
  }

  closeAnnouncementModal(): void {
    this.showAnnouncementModalFlag = false;
    this.announcementData = {
      title: '',
      content: ''
    };
    this.announcementTitleLength = 0;
    this.announcementFormSubmitted = false;
  }

  async createAnnouncement(form: any): Promise<void> {
    // フォームを送信済み状態にする
    this.announcementFormSubmitted = true;
    
    // バリデーション: タイトルと内容が入力されているかチェック
    if (!this.announcementData.title.trim() || !this.announcementData.content.trim()) {
      return;
    }

    if (!this.group) {
      return;
    }

    this.creatingAnnouncement = true;
    try {
      const announcementId = await this.announcementService.createAnnouncement(
        this.group.id,
        this.announcementData.title,
        this.announcementData.content,
        false // isImportantは常にfalse
      );
      
      alert('アナウンスを投稿しました！');
      this.closeAnnouncementModal();
      this.loadAnnouncements(this.group.id);
    } catch (error) {
      console.error('アナウンス作成エラー:', error);
      alert('アナウンスの投稿に失敗しました。');
    } finally {
      this.creatingAnnouncement = false;
    }
  }

  openInviteModal() {
    this.showInviteModal = true;
    this.inviteSearchTerm = '';
    this.inviteSearchResults = [];
  }

  closeInviteModal() {
    this.showInviteModal = false;
  }

  async searchUsersForInvite() {
    const term = (this.inviteSearchTerm || '').trim().toLowerCase();
    if (!term) {
      this.inviteSearchResults = [];
      return;
    }
    this.inviteLoading = true;
    try {
      // 簡易検索: users コレクション全体を取得してクライアント側フィルタ（小規模想定）
      // 大規模化する場合は Cloud Functions 経由の検索APIへ変更
      const usersSnap = await getDocs(collection(this.firestore, 'users'));
      const results: { id: string, displayName: string, email: string }[] = [];
      usersSnap.forEach(docSnap => {
        const data: any = docSnap.data();
        const name = (data.displayName || '').toLowerCase();
        const email = (data.email || '').toLowerCase();
        if (name.includes(term) || email.includes(term)) {
          results.push({ id: docSnap.id, displayName: data.displayName || email, email: data.email || '' });
        }
      });
      // 既に参加済みのユーザーは除外（members$の最新値があれば使用）
      let memberIds: string[] = [];
      try {
        const membersSnap = await getDocs(collection(this.firestore, 'groupMemberships'));
        memberIds = membersSnap.docs
          .map(d => d.data() as any)
          .filter(m => m.groupId === this.group?.id)
          .map(m => m.userId);
      } catch {}
      this.inviteSearchResults = results.filter(u => !memberIds.includes(u.id)).slice(0, 20);
    } catch (e) {
      console.error('invite search error', e);
      this.inviteSearchResults = [];
    } finally {
      this.inviteLoading = false;
    }
  }

  async sendInviteToUser(userId: string, displayName: string, email: string) {
    if (!this.group || !this.isGroupOwner) return;
    
    try {
      // 1. 既にメンバーかチェック
      const isAlreadyMember = await this.groupService.isMember(this.group.id, userId);
      if (isAlreadyMember) {
        alert(`${displayName || email} さんは既にグループのメンバーです`);
        return;
      }

      // 2. 既に招待済みかチェック（未読の招待通知があるか）
      const existingInvites = await this.notificationService.getUserNotifications(userId, 100).pipe(take(1)).toPromise();
      const hasPendingInvite = existingInvites?.some((notification: any) => 
        notification.type === 'group_invite' && 
        notification.data?.groupId === this.group?.id && 
        !notification.isRead
      ) || false;

      if (hasPendingInvite) {
        alert(`${displayName || email} さんには既に招待を送信済みです`);
        return;
      }

      // 3. 通知レコードを作成（pushはFunctions側が拾って送信）
      await this.notificationService.createGroupNotification(
        'group_invite' as any,
        this.group.id,
        this.group.name,
        userId,
        { inviterName: (this.auth.currentUser && ((this as any).memberNameById?.[this.auth.currentUser.uid] || this.auth.currentUser.displayName || this.auth.currentUser.email?.split('@')[0])) || 'ユーザー' }
      );
      alert(`${displayName || email} さんに招待を送信しました`);
    } catch (e) {
      console.error('send invite error', e);
      alert('招待の送信に失敗しました');
    }
  }

  getCurrentUserId(): string {
    return this.auth.currentUser?.uid || '';
  }

  getMemberEmail(userId: string, userEmail?: string): string {
    // キャッシュされたメールアドレスを確認
    if (this.memberEmailById && this.memberEmailById[userId]) {
      return this.memberEmailById[userId];
    }
    
    // 既存のuserEmailがある場合はそれを使用
    if (userEmail && userEmail !== 'owner@example.com') {
      return userEmail;
    }
    
    // 非同期でメールアドレスを取得
    this.loadUserEmail(userId);
    return 'メールアドレス未設定';
  }

  async loadUserEmail(userId: string): Promise<void> {
    try {
      const profile = await this.userService.getUserProfile(userId);
      if (profile?.email) {
        this.memberEmailById[userId] = profile.email;
        this.cd.detectChanges();
      }
    } catch (error) {
      console.error('メールアドレス取得エラー:', userId, error);
    }
  }

  async leaveGroup() {
    if (!this.group || !this.auth.currentUser) return;
    
    const confirmed = confirm('本当にこのグループから退会しますか？');
    if (!confirmed) return;
    
    try {
      // groupMembershipsから自分のレコードを削除
      const membershipQuery = query(
        collection(this.firestore, 'groupMemberships'),
        where('groupId', '==', this.group.id),
        where('userId', '==', this.auth.currentUser.uid)
      );
      
      const membershipSnapshot = await getDocs(membershipQuery);
      const deletePromises = membershipSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      alert('グループから退会しました');
      this.router.navigate(['/main']);
    } catch (e) {
      console.error('leave group error', e);
      alert('退会に失敗しました');
    }
  }

  // モーダル制御メソッド
  toggleActionsModal() {
    this.showActionsModal = !this.showActionsModal;
  }

  closeActionsModal() {
    this.showActionsModal = false;
  }

  // 発生日のフォーマット（月日形式）
  formatOccurredDate(date: any): string {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${month}月${day}日`;
  }

  // メニューに通知があるかチェック
  hasMenuNotifications(): boolean {
    // 参加リクエストがあるかチェック（グループオーナーのみ）
    const hasJoinRequests = this.isGroupOwner && this.joinRequestCount > 0;
    // 未読アナウンスがあるかチェック
    const hasUnreadAnnouncements = this.hasUnreadAnnouncements();
    return hasJoinRequests || hasUnreadAnnouncements;
  }

  // 文字数制限チェック
  onTitleInput(event: any) {
    const value = event.target.value;
    this.titleLength = value.length;
    
    // 20文字を超えた場合は入力を制限
    if (value.length > 20) {
      event.target.value = value.substring(0, 20);
      this.titleLength = 20;
    }
  }

  // アナウンスタイトルの文字数制限チェック
  onAnnouncementTitleInput(event: any) {
    const value = event.target.value;
    this.announcementTitleLength = value.length;
    
    // 20文字を超えた場合は入力をブロック
    if (value.length > 20) {
      event.target.value = value.substring(0, 20);
      this.announcementTitleLength = 20;
    }
  }

  onContentInput(event: any) {
    const value = event.target.value;
    this.contentLength = value.length;
    
    // 100文字を超えた場合は入力を制限
    if (value.length > 100) {
      event.target.value = value.substring(0, 100);
      this.contentLength = 100;
    }
  }
}
