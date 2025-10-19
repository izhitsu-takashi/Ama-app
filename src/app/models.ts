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
  assigneeName?: string; // 担当者名
  createdBy: Id;
  occurredOn: Timestamp;
  dueDate?: Timestamp;
  completedAt?: Timestamp; // 完了日時
  progress?: number; // 進捗率 (0-100)
  templateId?: Id; // テンプレートから作成された場合
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  reactions?: TaskReaction[]; // リアクション一覧
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
export interface TaskReaction {
  id: Id;
  taskId: Id;
  userId: Id;
  userName: string;
  reactionType: 'thumbs_up'; // 現在は👍のみ
  createdAt: Timestamp;
}

export interface TaskComment {
  id: Id;
  taskId: Id;
  groupId: Id;
  authorId: Id;
  content: string;
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
  tasks?: MilestoneSubTask[]; // マイルストーン内のサブタスク
  flowSteps?: MilestoneFlowStep[]; // フローチャート用のステップ
}

export interface MilestoneFlowStep {
  id: string;
  name: string;
  description?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  order: number; // 表示順序
  startDate?: Timestamp;
  endDate?: Timestamp;
}

export interface MilestoneSubTask {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  estimatedHours?: number; // 見積もり時間
}

// 進捗報告関連
export interface ProgressReport {
  id: Id;
  title: string;
  content: string;
  senderId: Id;
  senderName: string;
  recipientId?: Id; // 特定の人への送信
  recipientName?: string;
  groupId?: Id; // グループへの送信
  groupName?: string;
  attachedGroupId?: Id; // 添付するグループ（個人送信時でも関連グループを指定可能）
  attachedGroupName?: string;
  status: 'draft' | 'sent' | 'read';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  readAt?: Timestamp;
}

export interface ProgressReportComment {
  id: Id;
  reportId: Id;
  commenterId: Id;
  commenterName: string;
  content: string;
  createdAt: Timestamp;
}

export interface MilestoneTask {
  id: Id;
  milestoneId: Id;
  taskId: Id;
  isRequired: boolean; // マイルストーン完了に必要かどうか
  createdAt: Timestamp;
}


export interface ReportAttachment {
  type: 'group' | 'task_list';
  id: Id;
  name: string;
}

// 通知関連
export interface Notification {
  id: Id;
  userId: Id;
  type: 'task_assigned' | 'task_due' | 'task_comment' | 'task_reaction' | 'group_invite' | 'progress_report' | 'progress_report_comment' | 'reminder' | 'task_due_soon' | 'group_join_request' | 'message_received';
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
    messageId?: Id;
    senderName?: string;
    messageContent?: string;
    subject?: string;
  };
  isRead: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export interface AutoReportSchedule {
  id: Id;
  userId: Id;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  startDate: Timestamp;
  sendTime: string; // HH:MM format
  recipientType: 'person' | 'group';
  recipientId?: Id;
  recipientName?: string;
  groupId?: Id;
  groupName?: string;
  attachedGroupId?: Id;
  attachedGroupName?: string;
  isActive: boolean;
  lastSentAt?: Timestamp;
  nextSendAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  type: 'personal' | 'task_due';
  relatedId?: Id; // 関連するタスクやマイルストーンのID
  color?: string; // '#RRGGBB' など
  createdAt: Timestamp;
  // Google Calendar連携用フィールド
  googleEventId?: string; // GoogleカレンダーのイベントID
  source?: 'app' | 'google'; // イベントの作成元
  location?: string; // 場所
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>; // 参加者
  allDay?: boolean; // 終日イベントかどうか
  updatedAt?: Timestamp; // 更新日時（同期用）
}

// Todoリスト関連
export interface TodoItem {
  id: Id;
  title: string;
  description?: string;
  type: 'task' | 'event' | 'deadline';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Timestamp;
  isCompleted: boolean;
  relatedId?: Id; // 関連するタスクやイベントのID
  groupId?: Id; // グループID（タスクの場合）
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  milestones: any[];
  reports: ProgressReport[];
  exportedAt: Timestamp;
  exportedBy: Id;
}

// 参加リクエスト用の型
export interface JoinRequest {
  id?: string;
  groupId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// メッセージ関連
export interface Message {
  id: Id;
  senderId: Id;
  senderName: string;
  senderEmail: string;
  recipientId: Id;
  recipientName: string;
  recipientEmail: string;
  subject: string;
  content: string;
  isRead: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  attachments?: MessageAttachment[];
  isTemporary?: boolean; // 一時的なメッセージ（送信中）のフラグ
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt: Timestamp;
}

export interface MessageThread {
  id: Id;
  participants: Id[]; // 参加者のユーザーID配列
  participantNames: string[]; // 参加者の名前配列
  lastMessage?: {
    content: string;
    senderId: Id;
    senderName: string;
    createdAt: Timestamp;
  };
  unreadCount: number; // 未読メッセージ数
  createdAt: Timestamp;
  updatedAt: Timestamp;
}