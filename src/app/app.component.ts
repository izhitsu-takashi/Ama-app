import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AutoReportSchedulerService } from './auto-report-scheduler.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'Ama-app';
  private autoReportScheduler = inject(AutoReportSchedulerService);

  ngOnInit(): void {
    // 自動送信スケジューラーを一時的に無効化（起動問題のため）
    // TODO: サーバーサイド実装後に有効化
    console.log('自動送信スケジューラーは一時的に無効化されています');
    
    /* 元のコード（起動問題のためコメントアウト）
    try {
      this.autoReportScheduler.startScheduler();
    } catch (error) {
      console.error('スケジューラー初期化エラー:', error);
    }
    */
  }
}
