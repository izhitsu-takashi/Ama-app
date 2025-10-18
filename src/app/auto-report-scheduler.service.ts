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
    console.log('注意: バックグラウンドでの自動送信は現在無効化されています（権限の問題のため）');
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
    // 現在は権限の問題でバックグラウンド自動送信を無効化
    // 将来的には、サーバーサイドでの実装または適切な認証コンテキストの設定が必要
    console.log('バックグラウンド自動送信は現在無効化されています');
    return;
    
    /* 元のコード（権限問題のためコメントアウト）
    try {
      const schedulesToSend = await this.autoReportScheduleService.getSchedulesToSend();
      
      for (const schedule of schedulesToSend) {
        try {
          await this.autoReportScheduleService.sendScheduledReport(schedule);
          console.log(`自動送信完了: ${schedule.title} (ID: ${schedule.id})`);
        } catch (error) {
          console.error(`自動送信エラー: ${schedule.title} (ID: ${schedule.id})`, error);
        }
      }
    } catch (error) {
      console.error('スケジュールチェックエラー:', error);
    }
    */
  }
}