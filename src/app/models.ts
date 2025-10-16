// 基本型定義
export type Id = string;
export type Timestamp = any; // Firestore timestamp

// ユーザー関連
export interface User {
  id: Id;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'user' | 'admin';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// グループ関連
export interface Group {
  id: Id;
  name: string;
  description?: string;
  ownerId: Id;
  memberIds: Id[];
  isPublic: boolean;
  requiresApproval: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMembership {
  id: Id;
  groupId: Id;
  userId: Id;
  userName?: string;
  userEmail?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Timestamp;
}

export interface GroupJoinRequest {
  id: Id;
  groupId: Id;
  userId: Id;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: Id;
}

// 課題関連
export interface TaskItem {
  id: Id;
  groupId: Id;
  title: string;
  content?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: Id;
  createdBy: Id;
  occurredOn: Timestamp;
  dueDate?: Timestamp;
  progress?: number; // 進捗率 (0-100)
  templateId?: Id; // テンプレートから作成された場合
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaskTemplate {
  id: Id;
  groupId: Id;
  name: string;
  title: string;
  content?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  defaultAssigneeId?: Id;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  createdBy: Id;
  createdAt: Timestamp;
}

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // 間隔（例：2週間ごとなら2）
  daysOfWeek?: number[]; // 0-6 (日-土)
  dayOfMonth?: number; // 1-31
  endDate?: Timestamp;
}

// コメント・リアクション関連
export interface TaskComment {
  id: Id;
  taskId: Id;
  groupId: Id;
  authorId: Id;
  content: string;
  createdAt: Timestamp;
}

export interface TaskReaction {
  id: Id;
  taskId: Id;
  userId: Id;
  type: 'thumbs_up' | 'important' | 'question' | 'check';
  createdAt: Timestamp;
}

export interface CommentReaction {
  id: Id;
  commentId: Id;
  userId: Id;
  type: 'thumbs_up' | 'important';
  createdAt: Timestamp;
}

// マイルストーン関連
export interface Milestone {
  id: Id;
  groupId: Id;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'not_started' | 'in_progress' | 'completed';
  createdBy: Id;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MilestoneTask {
  id: Id;
  milestoneId: Id;
  taskId: Id;
  isRequired: boolean; // マイルストーン完了に必要かどうか
  createdAt: Timestamp;
}

// 進捗報告関連
export interface ProgressReport {
  id: Id;
  groupId: Id;
  title: string;
  content: string;
  period: {
    startDate: Timestamp;
    endDate: Timestamp;
  };
  authorId: Id;
  recipients: Id[];
  attachments: ReportAttachment[];
  status: 'draft' | 'sent';
  sentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReportAttachment {
  type: 'group' | 'milestone' | 'task_list';
  id: Id;
  name: string;
}

// 通知関連
export interface Notification {
  id: Id;
  userId: Id;
  type: 'task_assigned' | 'task_due' | 'task_comment' | 'task_reaction' | 'group_invite' | 'progress_report' | 'reminder' | 'task_due_soon';
  title: string;
  content: string;
  message: string;
  data?: any; // 通知に関連するデータ
  metadata?: {
    taskId?: Id;
    groupId?: Id;
    relatedUserId?: Id;
    taskTitle?: string;
    groupName?: string;
    userName?: string;
    dueDate?: any;
  };
  isRead: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export interface Reminder {
  id: Id;
  userId: Id;
  title: string;
  message: string;
  remindAt: Timestamp;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  isActive: boolean;
  createdAt: Timestamp;
}

// カレンダー関連
export interface CalendarEvent {
  id: Id;
  userId: Id;
  title: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  type: 'personal' | 'task_due' | 'milestone';
  relatedId?: Id; // 関連するタスクやマイルストーンのID
  color?: string; // '#RRGGBB' など
  createdAt: Timestamp;
}

// 統計・分析関連
export interface GroupStats {
  groupId: Id;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  tasksByStatus: {
    not_started: number;
    in_progress: number;
    completed: number;
  };
  tasksByPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  lastUpdated: Timestamp;
}

// 設定関連
export interface UserSettings {
  userId: Id;
  emailNotifications: boolean;
  pushNotifications: boolean;
  reminderSettings: {
    taskDue: boolean;
    taskComment: boolean;
    progressReport: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  timezone: string;
  updatedAt: Timestamp;
}

// エクスポート用の型
export interface ExportData {
  groups: Group[];
  tasks: TaskItem[];
  milestones: Milestone[];
  reports: ProgressReport[];
  exportedAt: Timestamp;
  exportedBy: Id;
}