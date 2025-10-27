import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { GroupService } from './group.service';
import { AuthService } from './auth.service';
import { AiProjectAnalyzerService, ProjectInput, ProjectAnalysis, LearningData } from './ai-project-analyzer.service';
import { TaskService } from './task.service';

@Component({
  selector: 'app-group-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <button class="back-btn" routerLink="/main">
          <span class="back-icon">←</span>
          戻る
        </button>
        <h1 class="page-title">新しいグループを作成</h1>
      </div>

      <div class="form-container">
        <!-- タブナビゲーション -->
        <div class="tab-navigation">
          <button 
            class="tab-button" 
            [class.active]="activeTab === 'manual'"
            (click)="setActiveTab('manual')"
          >
            <span class="tab-icon">✏️</span>
            手動作成
          </button>
          <button 
            class="tab-button" 
            [class.active]="activeTab === 'ai'"
            (click)="setActiveTab('ai')"
          >
            <span class="tab-icon">🤖</span>
            AI基盤作成
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="create-form">
          <!-- 手動作成タブ -->
          <div *ngIf="activeTab === 'manual'" class="tab-content">
            <div class="form-group">
              <label class="form-label">グループ名</label>
              <input 
                type="text" 
                formControlName="name" 
                class="form-input"
                placeholder="グループ名を入力"
                maxlength="20"
                [class.error]="form.get('name')?.invalid && form.get('name')?.touched"
                (input)="onNameInput($event)"
              />
              <div *ngIf="nameLength >= 20" class="char-limit-warning">
                最大20文字までです
              </div>
              <div *ngIf="form.get('name')?.invalid && form.get('name')?.touched" class="error-message">
                <span *ngIf="form.get('name')?.errors?.['required']">グループ名を入力してください</span>
                <span *ngIf="form.get('name')?.errors?.['minlength']">グループ名は2文字以上で入力してください</span>
                <span *ngIf="form.get('name')?.errors?.['maxlength']">グループ名は20文字以内で入力してください</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">説明</label>
              <textarea 
                formControlName="description" 
                class="form-textarea"
                placeholder="グループの説明を入力（任意）"
                rows="4"
                maxlength="100"
                (input)="onDescriptionInput($event)"
              ></textarea>
              <div *ngIf="descriptionLength >= 100" class="char-limit-warning">
                最大100文字までです
              </div>
              <div class="field-hint">
                <span class="hint-icon">💡</span>
                グループの目的や活動内容を説明してください
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">グループの公開設定</label>
              <div class="radio-group">
                <label class="radio-option">
                  <input type="radio" formControlName="isPublic" [value]="true" class="radio-input">
                  <span class="radio-label">
                    <span class="radio-title">公開グループ</span>
                    <span class="radio-description">誰でも参加できます</span>
                  </span>
                </label>
                <label class="radio-option">
                  <input type="radio" formControlName="isPublic" [value]="false" class="radio-input">
                  <span class="radio-label">
                    <span class="radio-title">非公開グループ</span>
                    <span class="radio-description">参加リクエストが必要です</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- AI基盤作成タブ -->
          <div *ngIf="activeTab === 'ai'" class="tab-content">
            <div class="ai-intro">
              <h3 class="ai-intro-title">🤖 AI グループ基盤作成</h3>
              <p class="ai-intro-description">
                グループの概要を入力すると、AIが自動的に課題・優先度・タイムラインを生成し、
                グループにタスクとして追加します。個人の課題から大規模プロジェクトまで対応します。
              </p>
            </div>

            <div class="form-group">
              <label class="form-label">グループ名</label>
              <input 
                type="text" 
                formControlName="name" 
                class="form-input"
                placeholder="グループ名を入力"
                maxlength="20"
                [class.error]="form.get('name')?.invalid && form.get('name')?.touched"
                (input)="onNameInput($event)"
              />
              <div *ngIf="nameLength >= 20" class="char-limit-warning">
                最大20文字までです
              </div>
              <div *ngIf="form.get('name')?.invalid && form.get('name')?.touched" class="error-message">
                <span *ngIf="form.get('name')?.errors?.['required']">グループ名を入力してください</span>
                <span *ngIf="form.get('name')?.errors?.['minlength']">グループ名は2文字以上で入力してください</span>
                <span *ngIf="form.get('name')?.errors?.['maxlength']">グループ名は20文字以内で入力してください</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">グループ概要</label>
              <textarea 
                formControlName="description" 
                class="form-textarea"
                placeholder="グループの概要や目的を入力してください"
                rows="4"
                maxlength="100"
                (input)="onDescriptionInput($event)"
              ></textarea>
              <div *ngIf="descriptionLength >= 100" class="char-limit-warning">
                最大100文字までです
              </div>
              <div class="field-hint">
                <span class="hint-icon">💡</span>
                AIがより適切な分析を行うために、詳細な情報を入力してください
              </div>
            </div>

            <div class="ai-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">プロジェクトタイプ</label>
                  <select [(ngModel)]="projectInput.appType" [ngModelOptions]="{standalone: true}" class="form-select">
                    <option value="">選択してください</option>
                    <option value="個人の課題・学習">個人の課題・学習</option>
                    <option value="Webアプリケーション">Webアプリケーション</option>
                    <option value="モバイルアプリ">モバイルアプリ</option>
                    <option value="デスクトップアプリ">デスクトップアプリ</option>
                    <option value="API/バックエンド">API/バックエンド</option>
                    <option value="データ分析ツール">データ分析ツール</option>
                    <option value="研究・調査">研究・調査</option>
                    <option value="イベント企画">イベント企画</option>
                    <option value="マーケティング">マーケティング</option>
                    <option value="その他">その他</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="form-label">チームサイズ</label>
                  <select [(ngModel)]="projectInput.teamSize" [ngModelOptions]="{standalone: true}" class="form-select">
                    <option value="1">1人</option>
                    <option value="2">2人</option>
                    <option value="3">3人</option>
                    <option value="4">4人</option>
                    <option value="5">5人</option>
                    <option value="6">6-10人</option>
                    <option value="11">11人以上</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">実現したいこと</label>
                <textarea 
                  [(ngModel)]="projectInput.goals" 
                  [ngModelOptions]="{standalone: true}"
                  class="form-textarea"
                  placeholder="グループで実現したい具体的な目標や成果を入力してください"
                  rows="3"
                ></textarea>
              </div>

              <div class="form-group">
                <label class="form-label">規模感</label>
                <select [(ngModel)]="projectInput.scale" [ngModelOptions]="{standalone: true}" class="form-select">
                  <option value="">選択してください</option>
                  <option value="個人課題（数日）">個人課題（数日）</option>
                  <option value="小規模（1-2週間）">小規模（1-2週間）</option>
                  <option value="中規模（1-2ヶ月）">中規模（1-2ヶ月）</option>
                  <option value="大規模（3-6ヶ月）">大規模（3-6ヶ月）</option>
                  <option value="超大規模（6ヶ月以上）">超大規模（6ヶ月以上）</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">期限（任意）</label>
                <input 
                  type="date" 
                  [(ngModel)]="projectInput.deadline" 
                  [ngModelOptions]="{standalone: true}"
                  class="form-input"
                />
              </div>

              <div class="ai-actions">
                <button 
                  type="button" 
                  class="btn btn-ai"
                  (click)="analyzeProject()"
                  [disabled]="analyzing || !isProjectInputValid()"
                >
                  <span *ngIf="!analyzing">🔍 AI分析を実行</span>
                  <span *ngIf="analyzing" class="loading-spinner">⏳</span>
                </button>
                
              </div>

              <!-- AI分析結果 -->
              <div *ngIf="projectAnalysis" class="ai-results">
                <h4 class="results-title">📊 AI分析結果</h4>
                
                <div class="results-section">
                  <h5 class="section-title">📋 生成されたタスク</h5>
                  <div class="tasks-list">
                    <div *ngFor="let task of projectAnalysis.tasks" class="task-item">
                      <div class="task-header">
                        <span class="task-title">{{ task.title }}</span>
                        <span class="task-priority priority-{{ task.priority }}">{{ getPriorityText(task.priority) }}</span>
                      </div>
                      <p class="task-description">{{ task.description }}</p>
                      <div class="task-meta">
                        <span class="task-category">{{ task.category }}</span>
                        <span class="task-duration">予想日数: {{ task.estimatedDays }}日</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="results-section">
                  <h5 class="section-title">📅 タイムライン</h5>
                  <div class="timeline">
                    <div *ngFor="let phase of projectAnalysis.timeline" class="timeline-phase">
                      <div class="phase-header">
                        <span class="phase-name">{{ phase.phase }}</span>
                        <span class="phase-duration">{{ phase.duration }}日</span>
                      </div>
                      <p class="phase-description">{{ phase.description }}</p>
                      <div class="phase-tasks">
                        <span *ngFor="let task of phase.tasks" class="phase-task">{{ task }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="results-section">
                  <h5 class="section-title">💡 推奨事項</h5>
                  <ul class="recommendations">
                    <li *ngFor="let rec of projectAnalysis.recommendations">{{ rec }}</li>
                  </ul>
                </div>

                <!-- 学習データセクション -->
                <div *ngIf="learningData" class="learning-data-section">
                  <div class="learning-header">
                    <h5 class="section-title">🧠 学習データ</h5>
                    <button 
                      type="button" 
                      class="toggle-btn"
                      (click)="showLearningData = !showLearningData"
                    >
                      {{ showLearningData ? '隠す' : '表示' }}
                    </button>
                  </div>
                  
                  <div *ngIf="showLearningData" class="learning-content">
                    <!-- 類似グループ -->
                    <div *ngIf="learningData.similarGroups.length > 0" class="learning-subsection">
                      <h6 class="subsection-title">📊 類似プロジェクト</h6>
                      <div class="similar-groups">
                        <div *ngFor="let group of learningData.similarGroups" class="similar-group">
                          <div class="group-header">
                            <span class="group-name">{{ group.name }}</span>
                            <span class="completion-rate">{{ Math.round(group.completionRate * 100) }}%</span>
                          </div>
                          <p class="group-description">{{ group.description }}</p>
                          <div class="group-stats">
                            <span class="stat">👥 {{ group.memberCount }}人</span>
                            <span class="stat">📋 {{ group.taskCount }}タスク</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 共通タスク -->
                    <div *ngIf="learningData.commonTasks.length > 0" class="learning-subsection">
                      <h6 class="subsection-title">🔄 共通タスクパターン</h6>
                      <div class="common-tasks">
                        <div *ngFor="let task of learningData.commonTasks" class="common-task">
                          <div class="task-header">
                            <span class="task-title">{{ task.title }}</span>
                            <span class="task-frequency">{{ Math.round(task.frequency * 100) }}%</span>
                          </div>
                          <p class="task-description">{{ task.description }}</p>
                          <div class="task-meta">
                            <span class="task-category">{{ task.category }}</span>
                            <span class="task-days">平均{{ task.averageDays }}日</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 成功パターン -->
                    <div *ngIf="learningData.successPatterns.length > 0" class="learning-subsection">
                      <h6 class="subsection-title">🎯 成功パターン</h6>
                      <div class="success-patterns">
                        <div *ngFor="let pattern of learningData.successPatterns" class="success-pattern">
                          <div class="pattern-header">
                            <span class="pattern-name">{{ pattern.pattern }}</span>
                            <span class="success-rate">{{ Math.round(pattern.successRate * 100) }}%</span>
                          </div>
                          <p class="pattern-description">{{ pattern.description }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


          <div class="form-actions">
            <button 
              type="button" 
              class="btn btn-secondary"
              routerLink="/main"
            >
              キャンセル
            </button>
            <button 
              type="submit" 
              class="btn btn-primary"
              [disabled]="form.invalid || loading"
              [class.loading]="loading"
            >
              <span *ngIf="!loading">グループを作成</span>
              <span *ngIf="loading" class="loading-spinner">⏳</span>
            </button>
          </div>

          <div *ngIf="error" class="error-alert">
            <span class="error-icon">⚠️</span>
            {{ error }}
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 2rem;
    }

    .page-header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      border-radius: 1rem;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      position: relative;
      max-width: 800px;
      margin: 0 auto 2rem;
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

    .back-icon {
      font-size: 18px;
    }

    .page-title {
      margin: 0;
      color: #2d3748;
      font-size: 1.8rem;
      font-weight: 700;
      text-align: center;
      flex: 1;
    }

    .form-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .tab-navigation {
      display: flex;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 16px 24px;
      background: transparent;
      border: none;
      font-size: 16px;
      font-weight: 500;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .tab-button:hover {
      background: #f1f5f9;
      color: #475569;
    }

    .tab-button.active {
      background: white;
      color: #3b82f6;
      border-bottom: 2px solid #3b82f6;
    }

    .tab-icon {
      font-size: 18px;
    }

    .tab-content {
      padding: 40px;
    }

    .ai-intro {
      background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 1px solid #bae6fd;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
    }

    .ai-intro-title {
      font-size: 20px;
      font-weight: 600;
      color: #0369a1;
      margin: 0 0 12px 0;
    }

    .ai-intro-description {
      color: #0c4a6e;
      margin: 0;
      line-height: 1.6;
    }

    .create-form {
      background: transparent;
      border-radius: 0;
      padding: 0;
      box-shadow: none;
    }

    .form-group {
      margin-bottom: 30px;
    }

    .form-label {
      display: block;
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 8px;
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
      transition: all 0.2s ease;
      background: #fff;
      box-sizing: border-box;
    }

    .form-input:focus, .form-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-input.error {
      border-color: #ef4444;
      box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }

    .form-textarea {
      resize: vertical;
      min-height: 100px;
    }

    .error-message {
      font-size: 14px;
      color: #ef4444;
      font-weight: 500;
      margin-top: 6px;
    }

    /* 文字数制限警告 */
    .char-limit-warning {
      color: #ef4444;
      font-size: 12px;
      margin-top: 4px;
      font-weight: 500;
    }

    .field-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #6b7280;
      margin-top: 6px;
    }

    .hint-icon {
      font-size: 16px;
    }

    .radio-group {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .radio-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .radio-option:hover {
      border-color: #667eea;
      background: #f8faff;
    }

    .radio-input {
      margin: 0;
      width: 20px;
      height: 20px;
      accent-color: #667eea;
      margin-top: 2px;
    }

    .radio-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .radio-title {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }

    .radio-description {
      color: #6b7280;
      font-size: 14px;
    }

    .form-actions {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      margin-top: 40px;
      margin-bottom: 20px;
      padding-top: 30px;
      padding-bottom: 10px;
      padding-right: 10px;
      border-top: 1px solid #e2e8f0;
    }

    .btn {
      padding: 14px 24px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 120px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
    }

    .btn-secondary {
      background: white;
      color: #4a5568;
      border: 2px solid #e2e8f0;
    }

    .btn-secondary:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .loading-spinner {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .error-alert {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 16px;
      border-radius: 12px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
    }

    .error-icon {
      font-size: 18px;
    }

    /* AI プロジェクト基盤作成スタイル */
    .ai-section {
      background: #f8faff;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
    }

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .ai-title {
      margin: 0;
      color: #2d3748;
      font-size: 18px;
      font-weight: 600;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 50px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
    }

    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    input:checked + .toggle-slider {
      background-color: #667eea;
    }

    input:checked + .toggle-slider:before {
      transform: translateX(26px);
    }

    .toggle-label {
      font-size: 14px;
      color: #4a5568;
      font-weight: 500;
    }

    .ai-form {
      margin-top: 20px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .form-select {
      width: 100%;
      padding: 14px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 16px;
      background: white;
      cursor: pointer;
    }

    .form-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .ai-actions {
      margin-top: 20px;
      text-align: center;
    }

    .btn-ai {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-ai:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
    }


    .ai-results {
      margin-top: 30px;
      background: white;
      border-radius: 16px;
      padding: 24px;
      border: 1px solid #e2e8f0;
    }

    .results-title {
      margin: 0 0 20px 0;
      color: #2d3748;
      font-size: 20px;
      font-weight: 600;
    }

    .results-section {
      margin-bottom: 24px;
    }

    .section-title {
      margin: 0 0 12px 0;
      color: #4a5568;
      font-size: 16px;
      font-weight: 600;
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-item {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .task-title {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }

    .task-priority {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .priority-urgent {
      background: #fef2f2;
      color: #dc2626;
    }

    .priority-high {
      background: #fef3c7;
      color: #d97706;
    }

    .priority-medium {
      background: #dbeafe;
      color: #2563eb;
    }

    .priority-low {
      background: #f0fdf4;
      color: #16a34a;
    }

    .task-description {
      margin: 0 0 12px 0;
      color: #6b7280;
      font-size: 14px;
      line-height: 1.5;
    }

    .task-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #9ca3af;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .timeline-phase {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }

    .phase-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .phase-name {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }

    .phase-duration {
      background: #667eea;
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .phase-description {
      margin: 0 0 12px 0;
      color: #6b7280;
      font-size: 14px;
    }

    .phase-tasks {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .phase-task {
      background: #e2e8f0;
      color: #4a5568;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
    }

    .recommendations {
      margin: 0;
      padding-left: 20px;
    }

    .recommendations li {
      margin-bottom: 8px;
      color: #4a5568;
      font-size: 14px;
      line-height: 1.5;
    }

    /* レスポンシブ */
    @media (max-width: 768px) {
      .page-container {
        padding: 16px 16px 16px 16px;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .page-title {
        font-size: 24px;
      }

      .create-form {
        padding: 24px;
      }

      .form-actions {
        flex-direction: column;
      }

      .btn {
        width: 100%;
      }
    }

    /* 学習データセクション */
    .learning-data-section {
      margin-top: 20px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .learning-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .toggle-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .toggle-btn:hover {
      background: #5a67d8;
      transform: translateY(-1px);
    }

    .learning-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .learning-subsection {
      background: white;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .subsection-title {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #2d3748;
    }

    .similar-groups, .common-tasks, .success-patterns {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .similar-group, .common-task, .success-pattern {
      padding: 12px;
      background: #f7fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .group-header, .task-header, .pattern-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .group-name, .task-title, .pattern-name {
      font-weight: 600;
      color: #2d3748;
    }

    .completion-rate, .task-frequency, .success-rate {
      background: #10b981;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .group-description, .task-description, .pattern-description {
      margin: 8px 0;
      color: #4a5568;
      font-size: 14px;
      line-height: 1.5;
    }

    .group-stats, .task-meta {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }

    .stat {
      font-size: 12px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .task-category, .task-days {
      font-size: 12px;
      color: #6b7280;
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
    }
  `]
})
export class GroupCreatePage {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private groupService = inject(GroupService);
  private auth = inject(AuthService);
  private aiAnalyzer = inject(AiProjectAnalyzerService);
  private taskService = inject(TaskService);

  loading = false;
  error = '';
  activeTab: 'manual' | 'ai' = 'manual';
  analyzing = false;
  projectAnalysis: ProjectAnalysis | null = null;
  learningData: LearningData | null = null;
  showLearningData = false;
  Math = Math; // テンプレートでMath.round()を使用するため

  projectInput: ProjectInput = {
    projectName: '', // グループ名として使用
    description: '',
    appType: '',
    goals: '',
    scale: '',
    teamSize: 1,
    deadline: ''
  };

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(20)]],
    description: ['', [Validators.maxLength(100)]],
    isPublic: [true, [Validators.required]]
  });

  // 文字数制限のプロパティ
  nameLength = 0;
  descriptionLength = 0;

  setActiveTab(tab: 'manual' | 'ai') {
    this.activeTab = tab;
  }

  // 文字数制限のイベントハンドラー
  onNameInput(event: any) {
    const value = event.target.value;
    this.nameLength = value.length;
    
    // 20文字を超えた場合は入力をブロック
    if (value.length > 20) {
      event.target.value = value.substring(0, 20);
      this.nameLength = 20;
    }
  }

  onDescriptionInput(event: any) {
    const value = event.target.value;
    this.descriptionLength = value.length;
    
    // 100文字を超えた場合は入力をブロック
    if (value.length > 100) {
      event.target.value = value.substring(0, 100);
      this.descriptionLength = 100;
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    
    const { name, description, isPublic } = this.form.getRawValue();
    
    try {
      const currentUser = this.auth.currentUser;
      if (!currentUser) {
        this.error = 'ログインが必要です';
        return;
      }

      const group = await this.groupService.createGroup({
        name: name!,
        description: description || '',
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        isPublic: isPublic!,
        requiresApproval: true // デフォルトで承認が必要
      });

      // AI基盤作成タブで分析結果がある場合はタスクを自動生成
      if (this.activeTab === 'ai' && this.projectAnalysis) {
        await this.createTasksFromAnalysis(group.id, currentUser.uid);
      }
      
      await this.router.navigate(['/group', group.id]);
    } catch (e: any) {
      this.error = e?.message ?? 'グループの作成に失敗しました';
    } finally {
      this.loading = false;
    }
  }

  async analyzeProject() {
    if (!this.isProjectInputValid()) return;
    
    this.analyzing = true;
    this.error = '';
    
    try {
      // グループ名をフォームから取得
      this.projectInput.projectName = this.form.get('name')?.value || '';
      this.projectInput.description = this.form.get('description')?.value || '';
      
      // 学習データを取得
      this.learningData = await this.aiAnalyzer.getLearningData(this.projectInput);
      
      // AI分析を実行
      this.projectAnalysis = await this.aiAnalyzer.analyzeProject(this.projectInput).toPromise() || null;
    } catch (e: any) {
      this.error = 'AI分析に失敗しました: ' + (e?.message || '不明なエラー');
    } finally {
      this.analyzing = false;
    }
  }

  isProjectInputValid(): boolean {
    // グループ基盤作成に必要な項目が入力されているかチェック
    return !!(
      this.projectInput.appType &&
      this.projectInput.goals &&
      this.projectInput.scale &&
      this.projectInput.teamSize
    );
  }

  getPriorityText(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'urgent': '緊急',
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return priorityMap[priority] || priority;
  }


  private async createTasksFromAnalysis(groupId: string, userId: string) {
    if (!this.projectAnalysis) return;

    try {
      for (const task of this.projectAnalysis.tasks) {
        // 期限を計算（現在日時 + 予想日数）
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + task.estimatedDays);

        await this.taskService.createTask(groupId, {
          title: task.title,
          content: task.description,
          priority: task.priority,
          status: 'not_started',
          assigneeId: userId,
          dueDate: dueDate,
          occurredOn: new Date(),
          isRecurring: false
        });
      }
    } catch (error) {
      console.error('タスクの自動作成に失敗しました:', error);
      // エラーが発生してもグループ作成は続行
    }
  }
}
