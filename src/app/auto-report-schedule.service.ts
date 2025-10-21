import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, deleteDoc, collectionData, query, where, orderBy, getDocs, serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { Observable, firstValueFrom } from 'rxjs';
import { AutoReportSchedule, TaskItem } from './models';
import { GroupService } from './group.service';
import { ProgressReportService } from './progress-report.service';
import { AiReportGeneratorService, ReportGenerationData } from './ai-report-generator.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class AutoReportScheduleService {
  private firestore = inject(Firestore);

  constructor(
    private groupService: GroupService,
    private progressReportService: ProgressReportService,
    private aiReportGenerator: AiReportGeneratorService,
    private userService: UserService
  ) {}

  // スケジュール作成
  async createSchedule(scheduleData: any): Promise<string> {
    // nextSendAtが既に計算されている場合はそれを使用、そうでなければ計算
    let nextSendAt: Timestamp;
    if (scheduleData.nextSendAt) {
      nextSendAt = scheduleData.nextSendAt;
    } else {
      const calculatedNextSendAt = this.calculateNextSendAt(scheduleData.startDate.toDate(), scheduleData.frequency, scheduleData.sendTime);
      nextSendAt = Timestamp.fromDate(calculatedNextSendAt);
    }
    
    // undefinedの値を除外
    const cleanData: any = {};
    Object.keys(scheduleData).forEach(key => {
      if (scheduleData[key] !== undefined) {
        cleanData[key] = scheduleData[key];
      }
    });
    
    const schedule: Omit<AutoReportSchedule, 'id'> = {
      ...cleanData,
      nextSendAt,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp
    };

    const docRef = await addDoc(collection(this.firestore, 'auto_report_schedules'), schedule);
    return docRef.id;
  }

  // スケジュール更新
  async updateSchedule(scheduleId: string, scheduleData: any): Promise<void> {
    const scheduleRef = doc(this.firestore, 'auto_report_schedules', scheduleId);
    
    // undefinedの値を除外
    const cleanData: any = {};
    Object.keys(scheduleData).forEach(key => {
      if (scheduleData[key] !== undefined) {
        cleanData[key] = scheduleData[key];
      }
    });
    
    await updateDoc(scheduleRef, {
      ...cleanData,
      updatedAt: serverTimestamp()
    });
  }

  // スケジュール削除
  async deleteSchedule(scheduleId: string): Promise<void> {
    const scheduleRef = doc(this.firestore, 'auto_report_schedules', scheduleId);
    await deleteDoc(scheduleRef);
  }

  // ユーザーのスケジュール一覧取得
  getUserSchedules(userId: string): Observable<AutoReportSchedule[]> {
    const schedulesRef = collection(this.firestore, 'auto_report_schedules');
    const q = query(
      schedulesRef,
      where('userId', '==', userId)
    );
    return collectionData(q, { idField: 'id' }) as Observable<AutoReportSchedule[]>;
  }

  // 送信予定のスケジュール取得
  async getSchedulesToSend(): Promise<AutoReportSchedule[]> {
    const now = new Date();
    console.log('現在時刻:', now.toISOString());
    console.log('現在時刻のTimestamp:', Timestamp.fromDate(now).toDate().toISOString());
    
    try {
      const schedulesRef = collection(this.firestore, 'auto_report_schedules');
      const q = query(
        schedulesRef,
        where('isActive', '==', true),
        where('nextSendAt', '<=', Timestamp.fromDate(now))
      );
      
      const snapshot = await getDocs(q);
      const schedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoReportSchedule));
      
      console.log('送信予定のスケジュール数:', schedules.length);
      schedules.forEach(schedule => {
        console.log(`スケジュール: ${schedule.title}`);
        console.log(`- isActive: ${schedule.isActive}`);
        console.log(`- nextSendAt: ${schedule.nextSendAt.toDate().toISOString()}`);
        console.log(`- 現在時刻との比較: ${schedule.nextSendAt.toDate() <= now}`);
      });
      
      return schedules;
    } catch (error) {
      console.error('スケジュール取得エラー:', error);
      
      // インデックスエラーの場合は、シンプルなクエリで代替
      if (error instanceof Error && error.message && error.message.includes('index')) {
        console.log('インデックスエラーのため、代替クエリを実行します');
        return this.getSchedulesToSendFallback();
      }
      
      throw error;
    }
  }

  // インデックスエラー時の代替クエリ
  private async getSchedulesToSendFallback(): Promise<AutoReportSchedule[]> {
    const now = new Date();
    console.log('代替クエリを実行中...');
    
    const schedulesRef = collection(this.firestore, 'auto_report_schedules');
    const q = query(schedulesRef, where('isActive', '==', true));
    
    const snapshot = await getDocs(q);
    const allSchedules = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoReportSchedule));
    
    // クライアント側でフィルタリング
    const schedulesToSend = allSchedules.filter(schedule => {
      const nextSendAt = schedule.nextSendAt.toDate();
      return nextSendAt <= now;
    });
    
    console.log('代替クエリ結果 - 全スケジュール数:', allSchedules.length);
    console.log('代替クエリ結果 - 送信予定数:', schedulesToSend.length);
    
    return schedulesToSend;
  }

  // 次の送信日時計算
  private calculateNextSendAt(startDate: Date, frequency: 'daily' | 'weekly' | 'monthly', sendTime: string): Date {
    const [hours, minutes] = sendTime.split(':').map(Number);
    const nextDate = new Date(startDate);
    
    // 送信時刻を設定
    nextDate.setHours(hours, minutes, 0, 0);
    
    // 開始日が過去の場合は、次の送信日を計算
    const now = new Date();
    if (nextDate <= now) {
      switch (frequency) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      }
    }
    
    return nextDate;
  }

  // スケジュールに基づく進捗報告送信
  async sendScheduledReport(schedule: AutoReportSchedule): Promise<void> {
    try {
      console.log('自動送信開始:', schedule.title);
      
      // 添付グループのタスクを取得
      if (!schedule.attachedGroupId) {
        throw new Error('添付グループが指定されていません');
      }

      console.log('添付グループのタスクを取得中:', schedule.attachedGroupId);
      const tasks = await this.groupService.getGroupTasks(schedule.attachedGroupId);
      console.log('取得したタスク数:', tasks.length);
      
      // 過去1週間のタスクをフィルタリング
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const filteredTasks = tasks.filter(task => {
        const taskDate = task.occurredOn?.toDate() || task.createdAt?.toDate();
        return taskDate && taskDate >= oneWeekAgo;
      });

      console.log('フィルタリング後のタスク数:', filteredTasks.length);

      // タスクをカテゴリ別に分類
      const categorizedTasks = this.aiReportGenerator.categorizeTasks(filteredTasks);

      // AIレポート生成データを準備
      const reportData: ReportGenerationData = {
        groupId: schedule.attachedGroupId,
        groupName: schedule.attachedGroupName || 'グループ',
        period: {
          start: oneWeekAgo,
          end: new Date()
        },
        tasks: filteredTasks,
        completedTasks: categorizedTasks.completed,
        inProgressTasks: categorizedTasks.inProgress,
        overdueTasks: categorizedTasks.overdue,
        upcomingTasks: categorizedTasks.upcoming
      };

      console.log('AIレポート生成中...');
      // AIでレポート生成
      const generatedReport = await firstValueFrom(this.aiReportGenerator.generateProgressReport(reportData));
      
      if (!generatedReport) {
        throw new Error('レポート生成に失敗しました');
      }

      console.log('生成されたレポート:', generatedReport.title);

      // 送信者のユーザー情報を取得
      const userDoc = await this.userService.getUserProfile(schedule.userId);
      const senderName = userDoc?.displayName || userDoc?.email?.split('@')[0] || 'ユーザー';

      // 進捗報告を作成・送信
      const reportData_toSend: any = {
        title: generatedReport.title,
        content: generatedReport.content,
        senderId: schedule.userId,
        senderName: senderName,
        status: 'sent' as const,
        recipientType: schedule.recipientType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // 送信先の設定（undefinedの場合はフィールドを除外）
      if (schedule.recipientType === 'person') {
        if (schedule.recipientId) {
          reportData_toSend.recipientId = schedule.recipientId;
        }
        if (schedule.recipientName) {
          reportData_toSend.recipientName = schedule.recipientName;
        }
      } else {
        if (schedule.groupId) {
          reportData_toSend.groupId = schedule.groupId;
        }
        if (schedule.groupName) {
          reportData_toSend.groupName = schedule.groupName;
        }
      }

      // 添付グループの設定（空でない場合のみ）
      if (schedule.attachedGroupId && schedule.attachedGroupId.trim() !== '') {
        reportData_toSend.attachedGroupId = schedule.attachedGroupId;
        if (schedule.attachedGroupName) {
          reportData_toSend.attachedGroupName = schedule.attachedGroupName;
        }
      }

      console.log('進捗報告を作成中...');
      await this.progressReportService.createProgressReport(reportData_toSend);
      console.log('進捗報告の作成が完了しました');

      // 次の送信日時を更新
      const nextSendAt = this.calculateNextSendAt(
        schedule.nextSendAt.toDate(),
        schedule.frequency,
        schedule.sendTime
      );

      console.log('次の送信日時を更新中...');
      await this.updateSchedule(schedule.id, {
        lastSentAt: serverTimestamp() as Timestamp,
        nextSendAt: Timestamp.fromDate(nextSendAt)
      });

      console.log('自動送信が完了しました:', schedule.title);

    } catch (error) {
      console.error('自動送信エラー:', error);
      throw error;
    }
  }
}