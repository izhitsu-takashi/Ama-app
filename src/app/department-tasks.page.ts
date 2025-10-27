import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { TaskService } from './task.service';
import { User } from './models';
import { Subject, takeUntil } from 'rxjs';
import { Firestore, collection, query, getDocs } from '@angular/fire/firestore';

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
  imports: [CommonModule],
  template: `
    <div class="container">
      <div class="header">
        <button class="back-btn" (click)="goBack()">
          ← 戻る
        </button>
        <h1>部門課題</h1>
      </div>

      <div class="content">

        <!-- 部門選択ボタン -->
        <div class="department-buttons">
          <button 
            class="dept-btn dept-development" 
            [class.active]="currentDepartment === 'development'"
            (click)="selectDepartment('development')"
          >
            💻 開発部門
          </button>
          <button 
            class="dept-btn dept-consulting" 
            [class.active]="currentDepartment === 'consulting'"
            (click)="selectDepartment('consulting')"
          >
            📊 コンサルティング部門
          </button>
          <button 
            class="dept-btn dept-sales" 
            [class.active]="currentDepartment === 'sales'"
            (click)="selectDepartment('sales')"
          >
            💼 営業部門
          </button>
        </div>


        <!-- 課題一覧 -->
        <div class="tasks-section">
          <div *ngIf="loading" class="loading">
            <div class="spinner"></div>
            <p>課題を読み込み中...</p>
          </div>
          
          <div *ngIf="!loading && currentDepartment && filteredTasks.length === 0" class="no-tasks">
            <p>{{ getDepartmentLabel(currentDepartment) }}の課題が見つかりませんでした。</p>
          </div>
          
          <div *ngIf="!loading && !currentDepartment && filteredTasks.length === 0" class="no-tasks">
            <p>部門を選択してください。</p>
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
                <p class="task-description">
                  <strong>説明:</strong> 
                  <span *ngIf="task.description && task.description.trim() !== ''; else noDescription">
                    {{ task.description }}
                  </span>
                  <ng-template #noDescription>
                    <span class="no-description">説明なし</span>
                  </ng-template>
                </p>
                
                <div class="task-info">
                  <span class="info-item">
                    <strong>作成者:</strong> {{ task.createdByName }}
                  </span>
                </div>
              </div>
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
    }

    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
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
      font-size: 1.8rem;
      font-weight: 700;
      color: #2d3748;
      margin: 0;
      text-align: center;
      flex: 1;
    }

    .content {
      background: white;
      border-radius: 1rem;
      padding: 2rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }


    .department-buttons {
      display: flex;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .dept-btn {
      background: #f3f4f6;
      color: #374151;
      border: 2px solid #e5e7eb;
      padding: 1rem 1.5rem;
      border-radius: 0.75rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      flex: 1;
      min-width: 200px;
    }

    .dept-btn:hover {
      background: #e5e7eb;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .dept-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .dept-btn.active:hover {
      background: #5a67d8;
    }

    .dept-development.active {
      background: #3b82f6;
      border-color: #3b82f6;
    }

    .dept-development.active:hover {
      background: #2563eb;
    }

    .dept-consulting.active {
      background: #10b981;
      border-color: #10b981;
    }

    .dept-consulting.active:hover {
      background: #059669;
    }

    .dept-sales.active {
      background: #f59e0b;
      border-color: #f59e0b;
    }

    .dept-sales.active:hover {
      background: #d97706;
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

    .probability-info {
      text-align: center;
      padding: 1rem;
      background: #f0f9ff;
      border: 1px solid #0ea5e9;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    .probability-info p {
      margin: 0;
      color: #0369a1;
      font-size: 0.9rem;
      font-weight: 500;
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
      color: #374151;
      line-height: 1.6;
      margin: 0;
      font-size: 0.95rem;
    }

    .task-description strong {
      color: #1f2937;
      font-weight: 600;
    }

    .no-description {
      color: #9ca3af;
      font-style: italic;
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

      .department-buttons {
        flex-direction: column;
      }

      .dept-btn {
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
  
  
  // 部門選択
  currentDepartment: 'development' | 'consulting' | 'sales' | null = null;
  

  constructor(
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private taskService: TaskService,
    private firestore: Firestore
  ) {}

  async ngOnInit() {
    console.log('部門課題ページ初期化');
    await this.loadUsers();
    await this.loadDepartmentTasks();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack() {
    this.router.navigate(['/main']);
  }

  async loadUsers() {
    return new Promise<void>((resolve) => {
      this.userService.getAllUsers().pipe(
        takeUntil(this.destroy$)
      ).subscribe(users => {
        this.users = users;
        resolve();
      });
    });
  }

  async loadDepartmentTasks() {
    this.loading = true;
    try {
      // グループ課題を読み込み
      const tasksQuery = query(collection(this.firestore, 'tasks'));
      const querySnapshot = await getDocs(tasksQuery);
      
      this.tasks = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data['title'] || '',
          description: data['description'] || data['content'] || '',
          department: data['department'] || 'other',
          priority: data['priority'] || 'medium',
          status: data['status'] || 'not_started',
          assignedTo: data['assignedTo'] || '',
          assignedToName: data['assignedToName'] || '',
          dueDate: data['dueDate']?.toDate() || new Date(),
          createdAt: data['createdAt']?.toDate() || new Date(),
          updatedAt: data['updatedAt']?.toDate() || new Date(),
          createdBy: data['createdBy'] || '',
          createdByName: data['createdByName'] || (data['createdBy'] === 'current-user-id' ? 'Loading...' : data['createdBy']) || 'Unknown'
        } as DepartmentTask;
      });
      
      
      // createdByNameが空の場合、createdByのUIDからユーザー名を取得
      await this.enrichTaskWithCreatorNames();
      
      // 部門情報を補完（作成者の部門を取得）
      this.enrichTaskWithDepartments();
      
      this.applyFilters();
    } catch (error) {
      console.error('部門課題の読み込みエラー:', error);
    } finally {
      this.loading = false;
    }
  }

  getUserDepartment(createdBy: string): 'development' | 'consulting' | 'sales' | 'corporate' | 'training' | 'other' {
    // 'current-user-id'の場合は現在のユーザーの部門を取得
    if (createdBy === 'current-user-id') {
      const currentUser = this.authService.currentUser;
      if (currentUser) {
        const currentUserProfile = this.users.find(u => u.id === currentUser.uid);
        if (currentUserProfile && currentUserProfile.department) {
          return currentUserProfile.department;
        }
      }
    } else {
      // 通常のユーザーIDの場合
      const user = this.users.find(u => u.id === createdBy);
      if (user && user.department) {
        return user.department;
      }
    }
    return 'other';
  }

  async enrichTaskWithCreatorNames() {
    // createdByNameが空またはUnknownの場合、createdByのUIDからユーザー名を取得
    for (let task of this.tasks) {
      if (!task.createdByName || task.createdByName === 'Unknown' || task.createdByName === task.createdBy || task.createdByName === 'Loading...') {
        // 'current-user-id'の場合は現在のユーザーを使用
        if (task.createdBy === 'current-user-id') {
          const currentUser = this.authService.currentUser;
          if (currentUser) {
            // 現在のユーザーの詳細情報を取得
            const currentUserProfile = this.users.find(u => u.id === currentUser.uid);
            if (currentUserProfile) {
              task.createdByName = currentUserProfile.displayName || currentUserProfile.email || 'Unknown';
            } else {
              task.createdByName = currentUser.displayName || currentUser.email || 'Current User';
            }
          } else {
            task.createdByName = 'Current User';
          }
        } else {
          const user = this.users.find(u => u.id === task.createdBy);
          
          if (user) {
            task.createdByName = user.displayName || user.email || 'Unknown';
          } else {
            task.createdByName = 'Unknown';
          }
        }
      }
    }
  }

  enrichTaskWithDepartments() {
    for (let task of this.tasks) {
      // 部門が'other'の場合のみ、作成者の部門を取得
      if (task.department === 'other') {
        const userDepartment = this.getUserDepartment(task.createdBy);
        if (userDepartment !== 'other') {
          task.department = userDepartment;
        }
      }
    }
  }

  selectDepartment(department: 'development' | 'consulting' | 'sales') {
    this.currentDepartment = department;
    this.applyFilters();
  }

  applyFilters() {
    // 部門が選択されていない場合は何も表示しない
    if (!this.currentDepartment) {
      this.filteredTasks = [];
      return;
    }
    
    this.filteredTasks = this.tasks.filter(task => {
      const matchesDepartment = task.department === this.currentDepartment;
      return matchesDepartment;
    });

    // 作成日時で降順ソート（最新順）
    this.filteredTasks.sort((a, b) => {
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // 最新の5つに制限
    this.filteredTasks = this.filteredTasks.slice(0, 5);
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
