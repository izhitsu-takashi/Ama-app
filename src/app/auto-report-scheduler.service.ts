import { Injectable, inject } from '@angular/core';
import { AutoReportScheduleService } from './auto-report-schedule.service';

@Injectable({
  providedIn: 'root'
})
export class AutoReportSchedulerService {
  private autoReportScheduleService = inject(AutoReportScheduleService);
  private intervalId: any;

  constructor() {}

  // スケジューラー開始
  startScheduler(): void {
    // 1分ごとにチェック
    this.intervalId = setInterval(() => {
      this.checkAndSendScheduledReports();
    }, 60000); // 60秒 = 1分

    console.log('自動送信スケジューラーが開始されました');
  }

  // スケジューラー停止
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('自動送信スケジューラーが停止されました');
    }
  }

  // 送信予定のレポートをチェックして送信
  private async checkAndSendScheduledReports(): Promise<void> {
    try {
      const now = new Date();
      console.log('スケジュールチェック開始:', now.toISOString());
      
      const schedulesToSend = await this.autoReportScheduleService.getSchedulesToSend();
      console.log('送信予定のスケジュール数:', schedulesToSend.length);
      
      for (const schedule of schedulesToSend) {
        try {
          console.log('スケジュール送信開始:', schedule.title);
          await this.autoReportScheduleService.sendScheduledReport(schedule);
          console.log(`自動送信完了: ${schedule.title} (ID: ${schedule.id})`);
        } catch (error) {
          console.error(`自動送信エラー: ${schedule.title} (ID: ${schedule.id})`, error);
        }
      }
    } catch (error) {
      console.error('スケジュールチェックエラー:', error);
    }
  }
}