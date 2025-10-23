import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { TaskItem, Group, ProgressReport } from './models';

export interface ReportGenerationData {
  groupId: string;
  groupName: string;
  period: {
    start: Date;
    end: Date;
  };
  tasks: TaskItem[];
  completedTasks: TaskItem[];
  inProgressTasks: TaskItem[];
  overdueTasks: TaskItem[];
  upcomingTasks: TaskItem[];
}

export interface GeneratedReport {
  title: string;
  content: string;
  summary: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  highlights: string[];
  concerns: string[];
  nextSteps: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiReportGeneratorService {

  constructor() { }

  /**
   * タスクデータから進捗報告を自動生成
   */
  generateProgressReport(data: ReportGenerationData): Observable<GeneratedReport> {
    const summary = this.calculateSummary(data);
    const highlights = this.generateHighlights(data, summary);
    const concerns = this.generateConcerns(data, summary);
    const nextSteps = this.generateNextSteps(data, summary);
    
    const title = this.generateTitle(data, summary);
    const content = this.generateContent(data, summary, highlights, concerns, nextSteps);

    return of({
      title,
      content,
      summary,
      highlights,
      concerns,
      nextSteps
    });
  }

  /**
   * 進捗サマリーを計算
   */
  private calculateSummary(data: ReportGenerationData): GeneratedReport['summary'] {
    const totalTasks = data.tasks.length;
    const completedTasks = data.completedTasks.length;
    const inProgressTasks = data.inProgressTasks.length;
    const overdueTasks = data.overdueTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate
    };
  }

  /**
   * ハイライト（良い点）を生成
   */
  private generateHighlights(data: ReportGenerationData, summary: GeneratedReport['summary']): string[] {
    const highlights: string[] = [];

    // 完了率が高い場合
    if (summary.completionRate >= 80) {
      highlights.push(`高い完了率（${summary.completionRate}%）を達成しています`);
    } else if (summary.completionRate >= 60) {
      highlights.push(`順調な進捗（完了率${summary.completionRate}%）を維持しています`);
    }

    // 完了したタスクの詳細
    if (summary.completedTasks > 0) {
      const highPriorityCompleted = data.completedTasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      if (highPriorityCompleted > 0) {
        highlights.push(`${highPriorityCompleted}件の高優先度タスクを完了しました`);
      }
    }

    // 進行中のタスク
    if (summary.inProgressTasks > 0) {
      highlights.push(`${summary.inProgressTasks}件のタスクが進行中です`);
    }

    // 期限前の完了
    const earlyCompleted = data.completedTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      const completedDate = task.completedAt ? new Date(task.completedAt) : new Date();
      return completedDate <= dueDate;
    }).length;

    if (earlyCompleted > 0) {
      highlights.push(`${earlyCompleted}件のタスクを期限前に完了しました`);
    }

    return highlights;
  }

  /**
   * 懸念事項を生成
   */
  private generateConcerns(data: ReportGenerationData, summary: GeneratedReport['summary']): string[] {
    const concerns: string[] = [];

    // 遅延タスク
    if (summary.overdueTasks > 0) {
      concerns.push(`${summary.overdueTasks}件のタスクが期限を過ぎています`);
      
      const urgentOverdue = data.overdueTasks.filter(t => t.priority === 'urgent').length;
      if (urgentOverdue > 0) {
        concerns.push(`${urgentOverdue}件の緊急タスクが遅延しています`);
      }
    }

    // 完了率が低い場合
    if (summary.completionRate < 50) {
      concerns.push(`完了率が${summary.completionRate}%と低く、進捗の加速が必要です`);
    }

    // 進行中のタスクが多い場合
    if (summary.inProgressTasks > summary.completedTasks) {
      concerns.push(`進行中のタスクが完了したタスクより多く、リソースの集中が必要です`);
    }

    // 期限が近いタスク
    const upcomingDeadlines = data.upcomingTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    }).length;

    if (upcomingDeadlines > 0) {
      concerns.push(`${upcomingDeadlines}件のタスクが3日以内に期限を迎えます`);
    }

    return concerns;
  }

  /**
   * 次のステップを生成
   */
  private generateNextSteps(data: ReportGenerationData, summary: GeneratedReport['summary']): string[] {
    const nextSteps: string[] = [];

    // 遅延タスクへの対応
    if (summary.overdueTasks > 0) {
      nextSteps.push('遅延タスクの優先順位を再評価し、リソースを集中させます');
    }

    // 期限が近いタスク
    const urgentUpcoming = data.upcomingTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= 0;
    });

    if (urgentUpcoming.length > 0) {
      nextSteps.push('期限が近いタスクの進捗を確認し、必要に応じてサポートを提供します');
    }

    // 完了率向上の提案
    if (summary.completionRate < 70) {
      nextSteps.push('タスクの細分化や優先順位の見直しを検討します');
    }

    // 進行中タスクの完了促進
    if (summary.inProgressTasks > 0) {
      nextSteps.push('進行中のタスクの完了を促進するため、定期的な進捗確認を行います');
    }

    // 新規タスクの計画
    nextSteps.push('来週のタスク計画を立て、リソース配分を最適化します');

    return nextSteps;
  }

  /**
   * タイトルを生成
   */
  private generateTitle(data: ReportGenerationData, summary: GeneratedReport['summary']): string {
    const startDate = this.parseFirestoreDate(data.period.start);
    const endDate = this.parseFirestoreDate(data.period.end);
    
    const startStr = startDate ? startDate.toLocaleDateString('ja-JP') : '不明';
    const endStr = endDate ? endDate.toLocaleDateString('ja-JP') : '不明';
    const periodStr = `${startStr} - ${endStr}`;
    
    if (summary.completionRate >= 80) {
      return `${data.groupName} 進捗報告 - 順調な進捗（${periodStr}）`;
    } else if (summary.completionRate >= 60) {
      return `${data.groupName} 進捗報告 - 着実な進捗（${periodStr}）`;
    } else if (summary.overdueTasks > 0) {
      return `${data.groupName} 進捗報告 - 遅延対応が必要（${periodStr}）`;
    } else {
      return `${data.groupName} 進捗報告（${periodStr}）`;
    }
  }

  /**
   * 報告内容を生成
   */
  private generateContent(
    data: ReportGenerationData, 
    summary: GeneratedReport['summary'],
    highlights: string[],
    concerns: string[],
    nextSteps: string[]
  ): string {
    const startDate = this.parseFirestoreDate(data.period.start);
    const endDate = this.parseFirestoreDate(data.period.end);
    
    const startStr = startDate ? startDate.toLocaleDateString('ja-JP') : '不明';
    const endStr = endDate ? endDate.toLocaleDateString('ja-JP') : '不明';
    const periodStr = `${startStr} - ${endStr}`;
    
    let content = `## 進捗サマリー（${periodStr}）\n\n`;
    
    content += `- **総タスク数**: ${summary.totalTasks}件\n`;
    content += `- **完了タスク**: ${summary.completedTasks}件\n`;
    content += `- **進行中タスク**: ${summary.inProgressTasks}件\n`;
    content += `- **遅延タスク**: ${summary.overdueTasks}件\n`;
    content += `- **完了率**: ${summary.completionRate}%\n\n`;

    if (highlights.length > 0) {
      content += `## ハイライト\n\n`;
      highlights.forEach(highlight => {
        content += `- ${highlight}\n`;
      });
      content += `\n`;
    }

    if (concerns.length > 0) {
      content += `## 懸念事項\n\n`;
      concerns.forEach(concern => {
        content += `- ${concern}\n`;
      });
      content += `\n`;
    }

    if (nextSteps.length > 0) {
      content += `## 次のステップ\n\n`;
      nextSteps.forEach(step => {
        content += `- ${step}\n`;
      });
      content += `\n`;
    }

    // 完了したタスクの詳細
    if (summary.completedTasks > 0) {
      content += `## 完了したタスク\n\n`;
      data.completedTasks.forEach(task => {
        const priorityLabel = this.getPriorityLabel(task.priority);
        // 完了日が設定されていない場合は、更新日時を使用
        let completedDate = '不明';
        
        // completedAtの処理
        if (task.completedAt) {
          const date = this.parseFirestoreDate(task.completedAt);
          if (date && !isNaN(date.getTime())) {
            completedDate = date.toLocaleDateString('ja-JP');
          }
        }
        
        // completedAtが無効な場合はupdatedAtを使用
        if (completedDate === '不明' && task.updatedAt) {
          const date = this.parseFirestoreDate(task.updatedAt);
          if (date && !isNaN(date.getTime())) {
            completedDate = date.toLocaleDateString('ja-JP');
          }
        }
        
        content += `- [${priorityLabel}] **${task.title}** (完了日: ${completedDate})\n`;
        if (task.assigneeName) {
          content += `  - 担当者: ${task.assigneeName}\n`;
        }
      });
      content += `\n`;
    }

    // 進行中のタスク
    if (summary.inProgressTasks > 0) {
      content += `## 進行中のタスク\n\n`;
      data.inProgressTasks.forEach(task => {
        const priorityLabel = this.getPriorityLabel(task.priority);
        let dueDate = '未設定';
        if (task.dueDate) {
          const date = this.parseFirestoreDate(task.dueDate);
          if (date && !isNaN(date.getTime())) {
            dueDate = date.toLocaleDateString('ja-JP');
          }
        }
        content += `- [${priorityLabel}] **${task.title}** (期限: ${dueDate})\n`;
        if (task.assigneeName) {
          content += `  - 担当者: ${task.assigneeName}\n`;
        }
        if (task.progress) {
          content += `  - 進捗: ${task.progress}%\n`;
        }
      });
      content += `\n`;
    }

    // 遅延タスク
    if (summary.overdueTasks > 0) {
      content += `## 遅延タスク\n\n`;
      data.overdueTasks.forEach(task => {
        const priorityLabel = this.getPriorityLabel(task.priority);
        let dueDate = '未設定';
        if (task.dueDate) {
          const date = this.parseFirestoreDate(task.dueDate);
          if (date && !isNaN(date.getTime())) {
            dueDate = date.toLocaleDateString('ja-JP');
          }
        }
        content += `- [${priorityLabel}] **${task.title}** (期限: ${dueDate})\n`;
        if (task.assigneeName) {
          content += `  - 担当者: ${task.assigneeName}\n`;
        }
      });
      content += `\n`;
    }

    content += `---\n`;
    content += `*この報告書はAIによって自動生成されました。*`;

    return content;
  }

  /**
   * 優先度のラベルを取得
   */
  private getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'urgent': return '緊急';
      case 'high': return '優先度高';
      case 'medium': return '優先度中';
      case 'low': return '優先度低';
      default: return '未設定';
    }
  }

  /**
   * Firestoreの日付を安全にパースする
   */
  private parseFirestoreDate(dateValue: any): Date | null {
    try {
      if (!dateValue) return null;
      
      // Firestore Timestampの場合
      if (dateValue.toDate && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      
      // 文字列の場合
      if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
      }
      
      // 数値（ミリ秒）の場合
      if (typeof dateValue === 'number') {
        const date = new Date(dateValue);
        return isNaN(date.getTime()) ? null : date;
      }
      
      // Dateオブジェクトの場合
      if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
      }
      
      return null;
    } catch (error) {
      // 日付パースエラーは本番環境でも有用なためログを残す
      console.error('日付パースエラー:', error, dateValue);
      return null;
    }
  }

  /**
   * タスクをカテゴリ別に分類
   */
  categorizeTasks(tasks: TaskItem[]): {
    completed: TaskItem[];
    inProgress: TaskItem[];
    overdue: TaskItem[];
    upcoming: TaskItem[];
  } {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    return {
      completed: tasks.filter(task => task.status === 'completed'),
      inProgress: tasks.filter(task => task.status === 'in_progress'),
      overdue: tasks.filter(task => {
        if (task.status === 'completed' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate < now;
      }),
      upcoming: tasks.filter(task => {
        if (task.status === 'completed' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= now && dueDate <= threeDaysFromNow;
      })
    };
  }
}
