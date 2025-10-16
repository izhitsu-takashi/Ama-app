import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MilestoneService } from './milestone.service';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { Milestone, Group } from './models';
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
            </div>

            <div class="milestone-meta">
              <span class="meta-item">📁 {{ getGroupName(milestone.groupId) }}</span>
              <span class="meta-item">📅 {{ formatDate(milestone.createdAt) }} 作成</span>
            </div>

            <div class="milestone-actions">
              <button class="btn small primary" (click)="editMilestone(milestone)">編集</button>
              <button class="btn small secondary" (click)="viewMilestone(milestone)">詳細</button>
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
      width: 90%;
      max-width: 600px;
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
      padding: 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
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
  `]
})
export class MilestonePage implements OnInit, OnDestroy {
  private milestoneService = inject(MilestoneService);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private router = inject(Router);
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
          createdBy: this.editingMilestone.createdBy
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
          createdBy: currentUser.uid
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

  viewMilestone(milestone: Milestone) {
    // TODO: マイルストーン詳細ページに遷移
    console.log('マイルストーン詳細:', milestone);
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
}
