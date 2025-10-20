import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { TaskService } from './task.service';
import { User } from './models';
import { Subject, takeUntil } from 'rxjs';
import { Firestore, collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from '@angular/fire/firestore';

// 部門課題のインターフェース
interface DepartmentTask {
  id: string;
  title: string;
  description: string;
  department: 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not_started' | 'in_progress' | 'completed';
  assignedTo?: string;
  assignedToName?: string;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByName: string;
}

@Component({
  selector: 'app-department-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>🏢 部門課題</h1>
        <p>部門別の課題を管理します</p>
      </div>

      <div class="content">
        <!-- フィルター・検索 -->
        <div class="filters-section">
          <div class="filter-group">
            <label>部門:</label>
            <select [(ngModel)]="selectedDepartment" (change)="applyFilters()">
              <option value="">すべての部門</option>
              <option value="development">開発</option>
              <option value="consulting">コンサルティング</option>
              <option value="sales">営業</option>
              <option value="corporate">コーポレート</option>
              <option value="training">研修</option>
              <option value="other">その他</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>ステータス:</label>
            <select [(ngModel)]="selectedStatus" (change)="applyFilters()">
              <option value="">すべてのステータス</option>
              <option value="not_started">未着手</option>
              <option value="in_progress">実行中</option>
              <option value="completed">完了</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>優先度:</label>
            <select [(ngModel)]="selectedPriority" (change)="applyFilters()">
              <option value="">すべての優先度</option>
              <option value="urgent">緊急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          
          <div class="filter-group">
            <input 
              type="text" 
              [(ngModel)]="searchTerm" 
              (input)="applyFilters()"
              placeholder="課題を検索..."
              class="search-input"
            >
          </div>
        </div>

        <!-- 課題作成ボタン -->
        <div class="actions-section">
          <button class="create-btn" (click)="showCreateTaskModal()">
            ➕ 新しい課題を作成
          </button>
        </div>

        <!-- 課題一覧 -->
        <div class="tasks-section">
          <div *ngIf="loading" class="loading">
            <div class="spinner"></div>
            <p>課題を読み込み中...</p>
          </div>
          
          <div *ngIf="!loading && filteredTasks.length === 0" class="no-tasks">
            <p>課題が見つかりませんでした。</p>
          </div>
          
          <div *ngIf="!loading && filteredTasks.length > 0" class="tasks-list">
            <div *ngFor="let task of filteredTasks" class="task-item" [class]="'priority-' + task.priority + ' status-' + task.status">
              <div class="task-header">
                <h3 class="task-title">{{ task.title }}</h3>
                <div class="task-badges">
                  <span class="department-badge" [class]="'dept-' + task.department">
                    {{ getDepartmentLabel(task.department) }}
                  </span>
                  <span class="priority-badge" [class]="'priority-' + task.priority">
                    {{ getPriorityLabel(task.priority) }}
                  </span>
                  <span class="status-badge" [class]="'status-' + task.status">
                    {{ getStatusLabel(task.status) }}
                  </span>
                </div>
              </div>
              
              <div class="task-content">
                <p class="task-description">{{ task.description }}</p>
                
                <div class="task-details">
                  <div class="task-info">
                    <span class="info-item">
                      <strong>担当者:</strong> {{ task.assignedToName || '未割り当て' }}
                    </span>
                    <span class="info-item">
                      <strong>期限:</strong> {{ formatDate(task.dueDate) }}
                    </span>
                    <span class="info-item">
                      <strong>作成者:</strong> {{ task.createdByName }}
                    </span>
                  </div>
                  
                  <div class="task-actions">
                    <button class="action-btn edit" (click)="editTask(task)">
                      ✏️ 編集
                    </button>
                    <button class="action-btn delete" (click)="deleteTask(task)">
                      🗑️ 削除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 課題作成・編集モーダル -->
    <div class="modal-overlay" *ngIf="showTaskModal" (click)="hideTaskModal()">
      <div class="modal task-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingTask ? '課題を編集' : '新しい課題を作成' }}</h2>
          <button class="modal-close" (click)="hideTaskModal()">×</button>
        </div>
        
        <div class="modal-content">
          <form (ngSubmit)="saveTask()" #taskForm="ngForm">
            <div class="form-group">
              <label for="title">タイトル *</label>
              <input 
                type="text" 
                id="title"
                [(ngModel)]="formTitle" 
                name="title"
                required
                class="form-input"
                placeholder="課題のタイトルを入力"
              >
            </div>
            
            <div class="form-group">
              <label for="description">説明</label>
              <textarea 
                id="description"
                [(ngModel)]="formDescription" 
                name="description"
                class="form-textarea"
                placeholder="課題の詳細を入力"
                rows="4"
              ></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="department">部門 *</label>
                <select 
                  id="department"
                  [(ngModel)]="formDepartment" 
                  name="department"
                  required
                  class="form-select"
                >
                  <option value="development">開発</option>
                  <option value="consulting">コンサルティング</option>
                  <option value="sales">営業</option>
                  <option value="corporate">コーポレート</option>
                  <option value="training">研修</option>
                  <option value="other">その他</option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="priority">優先度 *</label>
                <select 
                  id="priority"
                  [(ngModel)]="formPriority" 
                  name="priority"
                  required
                  class="form-select"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="assignedTo">担当者</label>
                <select 
                  id="assignedTo"
                  [(ngModel)]="formAssignedTo" 
                  name="assignedTo"
                  class="form-select"
                >
                  <option value="">未割り当て</option>
                  <option *ngFor="let user of users" [value]="user.id">
                    {{ user.displayName || user.email }}
                  </option>
                </select>
              </div>
              
              <div class="form-group">
                <label for="dueDate">期限 *</label>
                <input 
                  type="datetime-local" 
                  id="dueDate"
                  [(ngModel)]="formDueDate" 
                  name="dueDate"
                  required
                  class="form-input"
                >
              </div>
            </div>
            
            <div class="form-group" *ngIf="editingTask">
              <label for="status">ステータス *</label>
              <select 
                id="status"
                [(ngModel)]="formStatus" 
                name="status"
                required
                class="form-select"
              >
                <option value="not_started">未着手</option>
                <option value="in_progress">実行中</option>
                <option value="completed">完了</option>
              </select>
            </div>
            
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="hideTaskModal()">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="!taskForm.form.valid || saving">
                {{ saving ? '保存中...' : (editingTask ? '更新' : '作成') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .back-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      cursor: pointer;
      margin-bottom: 1rem;
      transition: background-color 0.2s;
    }

    .back-btn:hover {
      background: #5a67d8;
    }

    .header h1 {
      font-size: 2.5rem;
      color: #2d3748;
      margin: 0 0 0.5rem 0;
    }

    .header p {
      color: #6b7280;
      font-size: 1.1rem;
      margin: 0;
    }

    .content {
      background: white;
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .filters-section {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      align-items: end;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-group label {
      font-weight: 600;
      color: #374151;
      font-size: 0.9rem;
    }

    .filter-group select,
    .search-input {
      padding: 0.5rem;
      border: 2px solid #e5e7eb;
      border-radius: 0.5rem;
      font-size: 1rem;
      min-width: 150px;
    }

    .search-input {
      min-width: 200px;
    }

    .actions-section {
      margin-bottom: 2rem;
    }

    .create-btn {
      background: #10b981;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .create-btn:hover {
      background: #059669;
    }

    .loading {
      text-align: center;
      padding: 3rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f4f6;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .no-tasks {
      text-align: center;
      padding: 3rem;
      color: #6b7280;
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .task-item {
      border: 2px solid #e5e7eb;
      border-radius: 0.75rem;
      padding: 1.5rem;
      background: white;
      transition: all 0.2s;
    }

    .task-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }

    .task-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
      flex: 1;
    }

    .task-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .department-badge,
    .priority-badge,
    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .department-badge {
      background: #dbeafe;
      color: #1e40af;
    }

    .priority-badge.priority-urgent {
      background: #fecaca;
      color: #dc2626;
    }

    .priority-badge.priority-high {
      background: #fed7aa;
      color: #ea580c;
    }

    .priority-badge.priority-medium {
      background: #fef3c7;
      color: #d97706;
    }

    .priority-badge.priority-low {
      background: #d1fae5;
      color: #059669;
    }

    .status-badge.status-not_started {
      background: #f3f4f6;
      color: #6b7280;
    }

    .status-badge.status-in_progress {
      background: #dbeafe;
      color: #2563eb;
    }

    .status-badge.status-completed {
      background: #d1fae5;
      color: #059669;
    }

    .task-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .task-description {
      color: #4b5563;
      line-height: 1.6;
      margin: 0;
    }

    .task-details {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .task-info {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
    }

    .info-item {
      font-size: 0.9rem;
      color: #6b7280;
    }

    .task-actions {
      display: flex;
      gap: 0.5rem;
    }

    .action-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .action-btn.edit {
      background: #3b82f6;
      color: white;
    }

    .action-btn.edit:hover {
      background: #2563eb;
    }

    .action-btn.delete {
      background: #ef4444;
      color: white;
    }

    .action-btn.delete:hover {
      background: #dc2626;
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
    }

    .task-modal {
      background: white;
      border-radius: 1rem;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #6b7280;
      padding: 0.25rem;
    }

    .modal-close:hover {
      color: #374151;
    }

    .modal-content {
      padding: 1.5rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-row {
      display: flex;
      gap: 1rem;
    }

    .form-row .form-group {
      flex: 1;
    }

    .form-group label {
      display: block;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e5e7eb;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .form-input:focus,
    .form-select:focus,
    .form-textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #5a67d8;
    }

    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }

      .filters-section {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-group select,
      .search-input {
        min-width: auto;
      }

      .task-header {
        flex-direction: column;
        gap: 1rem;
      }

      .task-details {
        flex-direction: column;
        align-items: stretch;
      }

      .task-info {
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-row {
        flex-direction: column;
      }
    }
  `]
})
export class DepartmentTasksPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // データ
  tasks: DepartmentTask[] = [];
  filteredTasks: DepartmentTask[] = [];
  users: User[] = [];
  loading = false;
  
  // フィルター
  selectedDepartment = '';
  selectedStatus = '';
  selectedPriority = '';
  searchTerm = '';
  
  // モーダル
  showTaskModal = false;
  editingTask: DepartmentTask | null = null;
  saving = false;
  
  // フォーム
  taskForm = {
    title: '',
    description: '',
    department: 'development' as 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    status: 'not_started' as 'not_started' | 'in_progress' | 'completed',
    assignedTo: '',
    dueDate: ''
  };

  // フォーム用の個別プロパティ
  formTitle = '';
  formDescription = '';
  formDepartment: 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other' = 'development';
  formPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  formStatus: 'not_started' | 'in_progress' | 'completed' = 'not_started';
  formAssignedTo = '';
  formDueDate = '';

  constructor(
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private taskService: TaskService,
    private firestore: Firestore
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadDepartmentTasks();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.router.navigate(['/main']);
  }

  loadUsers() {
    this.userService.getAllUsers().pipe(
      takeUntil(this.destroy$)
    ).subscribe(users => {
      this.users = users;
    });
  }

  async loadDepartmentTasks() {
    this.loading = true;
    try {
      const tasksQuery = query(collection(this.firestore, 'departmentTasks'));
      const querySnapshot = await getDocs(tasksQuery);
      
      this.tasks = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data['dueDate']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date()
        } as DepartmentTask;
      });
      
      this.applyFilters();
    } catch (error) {
      console.error('部門課題の読み込みエラー:', error);
    } finally {
      this.loading = false;
    }
  }

  applyFilters() {
    this.filteredTasks = this.tasks.filter(task => {
      const matchesDepartment = !this.selectedDepartment || task.department === this.selectedDepartment;
      const matchesStatus = !this.selectedStatus || task.status === this.selectedStatus;
      const matchesPriority = !this.selectedPriority || task.priority === this.selectedPriority;
      const matchesSearch = !this.searchTerm || 
        task.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return matchesDepartment && matchesStatus && matchesPriority && matchesSearch;
    });
  }

  showCreateTaskModal() {
    this.editingTask = null;
    this.resetForm();
    this.showTaskModal = true;
  }

  editTask(task: DepartmentTask) {
    this.editingTask = task;
    this.formTitle = task.title;
    this.formDescription = task.description;
    this.formDepartment = task.department;
    this.formPriority = task.priority;
    this.formStatus = task.status;
    this.formAssignedTo = task.assignedTo || '';
    this.formDueDate = this.formatDateForInput(task.dueDate);
    this.showTaskModal = true;
  }

  hideTaskModal() {
    this.showTaskModal = false;
    this.editingTask = null;
    this.resetForm();
  }

  resetForm() {
    this.formTitle = '';
    this.formDescription = '';
    this.formDepartment = 'development';
    this.formPriority = 'medium';
    this.formStatus = 'not_started';
    this.formAssignedTo = '';
    this.formDueDate = '';
  }

  async saveTask() {
    if (!this.authService.currentUser) return;
    
    this.saving = true;
    try {
      const assignedUser = this.users.find(u => u.id === this.formAssignedTo);
      
      const taskData = {
        title: this.formTitle,
        description: this.formDescription,
        department: this.formDepartment,
        priority: this.formPriority,
        status: this.formStatus,
        assignedTo: this.formAssignedTo || null,
        assignedToName: assignedUser?.displayName || assignedUser?.email || null,
        dueDate: new Date(this.formDueDate),
        createdBy: this.authService.currentUser.uid,
        createdByName: this.authService.currentUser.displayName || this.authService.currentUser.email || 'Unknown',
        updatedAt: serverTimestamp()
      };

      if (this.editingTask) {
        // 更新
        const taskRef = doc(this.firestore, 'departmentTasks', this.editingTask.id);
        await updateDoc(taskRef, taskData);
      } else {
        // 新規作成
        const newTaskData = {
          ...taskData,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(this.firestore, 'departmentTasks'), newTaskData);
      }
      
      this.hideTaskModal();
      this.loadDepartmentTasks();
    } catch (error) {
      console.error('課題の保存エラー:', error);
      alert('課題の保存に失敗しました。');
    } finally {
      this.saving = false;
    }
  }

  async deleteTask(task: DepartmentTask) {
    if (!confirm(`「${task.title}」を削除しますか？`)) return;
    
    try {
      await deleteDoc(doc(this.firestore, 'departmentTasks', task.id));
      this.loadDepartmentTasks();
    } catch (error) {
      console.error('課題の削除エラー:', error);
      alert('課題の削除に失敗しました。');
    }
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  getDepartmentLabel(department: string): string {
    const labels: { [key: string]: string } = {
      'development': '開発',
      'consulting': 'コンサルティング',
      'sales': '営業',
      'corporate': 'コーポレート',
      'training': '研修',
      'other': 'その他'
    };
    return labels[department] || department;
  }

  getPriorityLabel(priority: string): string {
    const labels: { [key: string]: string } = {
      'urgent': '緊急',
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return labels[priority] || priority;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'not_started': '未着手',
      'in_progress': '実行中',
      'completed': '完了'
    };
    return labels[status] || status;
  }
}
