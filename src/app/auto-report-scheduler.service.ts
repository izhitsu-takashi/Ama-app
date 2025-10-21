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
  }

  // スケジューラー停止
  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // 送信予定のレポートをチェックして送信
  private async checkAndSendScheduledReports(): Promise<void> {
    try {
      const schedulesToSend = await this.autoReportScheduleService.getSchedulesToSend();
      
      for (const schedule of schedulesToSend) {
        try {
          await this.autoReportScheduleService.sendScheduledReport(schedule);
        } catch (error) {
          console.error(`自動送信エラー: ${schedule.title} (ID: ${schedule.id})`, error);
        }
      }
    } catch (error) {
      console.error('スケジュールチェックエラー:', error);
    }
  }
}