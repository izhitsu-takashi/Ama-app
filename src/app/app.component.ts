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
    // Cloud Functionsで自動送信を処理するため、クライアント側スケジューラーは無効化
    console.log('Cloud Functionsで自動送信を処理します');
  }
}
