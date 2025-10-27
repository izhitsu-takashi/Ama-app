import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { Firestore, collection, query, getDocs, where, orderBy, limit } from '@angular/fire/firestore';
import { GroupService } from './group.service';
import { TaskService } from './task.service';

export interface ProjectAnalysis {
  tasks: GeneratedTask[];
  timeline: TimelinePhase[];
  recommendations: string[];
}

export interface GeneratedTask {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  estimatedDays: number;
  category: string;
  dependencies?: string[];
}

export interface TimelinePhase {
  phase: string;
  duration: number; // days
  tasks: string[];
  description: string;
}

export interface ProjectInput {
  projectName: string;
  description: string;
  appType: string;
  goals: string;
  scale: string;
  teamSize: number;
  deadline?: string;
}

export interface LearningData {
  similarGroups: SimilarGroup[];
  commonTasks: CommonTask[];
  successPatterns: SuccessPattern[];
  recommendations: string[];
}

export interface SimilarGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  taskCount: number;
  completionRate: number;
  commonKeywords: string[];
}

export interface CommonTask {
  title: string;
  description: string;
  category: string;
  averageDays: number;
  frequency: number; // 出現頻度（0-1）
  priority: string;
}

export interface SuccessPattern {
  pattern: string;
  description: string;
  successRate: number;
  applicableTypes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiProjectAnalyzerService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly API_KEY = 'YOUR_OPENAI_API_KEY'; // 実際のAPIキーに置き換える

  private firestore = inject(Firestore);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);

  constructor(private http: HttpClient) {}

  analyzeProject(projectInput: ProjectInput): Observable<ProjectAnalysis> {
    const prompt = this.createAnalysisPrompt(projectInput);
    
    // 実際のOpenAI APIを使用する場合
    // return this.callOpenAI(prompt);
    
    // 学習データを取得してから分析を生成
    return this.generateAnalysisWithLearning(projectInput);
  }

  /**
   * 既存のグループと課題データから学習データを取得
   */
  async getLearningData(projectInput: ProjectInput): Promise<LearningData> {
    try {
      console.log('🔍 学習データ取得開始:', projectInput);
      
      const [similarGroups, commonTasks, successPatterns] = await Promise.all([
        this.findSimilarGroups(projectInput),
        this.analyzeCommonTasks(projectInput),
        this.identifySuccessPatterns(projectInput)
      ]);

      console.log('📊 学習データ取得完了:');
      console.log('- 類似グループ:', similarGroups.length, '件');
      console.log('- 共通タスク:', commonTasks.length, '件');
      console.log('- 成功パターン:', successPatterns.length, '件');

      return {
        similarGroups,
        commonTasks,
        successPatterns,
        recommendations: this.generateLearningRecommendations(similarGroups, commonTasks, successPatterns)
      };
    } catch (error) {
      console.error('学習データの取得に失敗:', error);
      return this.getDefaultLearningData();
    }
  }

  private createAnalysisPrompt(input: ProjectInput): string {
    return `
プロジェクト分析を依頼します。以下の情報を基に、詳細なプロジェクト計画を生成してください。

プロジェクト名: ${input.projectName}
概要: ${input.description}
アプリタイプ: ${input.appType}
実現したいこと: ${input.goals}
規模感: ${input.scale}
チームサイズ: ${input.teamSize}人
期限: ${input.deadline || '未設定'}

以下の形式でJSONを返してください：

{
  "tasks": [
    {
      "title": "タスク名",
      "description": "詳細な説明",
      "priority": "urgent|high|medium|low",
      "estimatedDays": 数値,
      "category": "カテゴリ名",
      "dependencies": ["依存タスク名"]
    }
  ],
  "timeline": [
    {
      "phase": "フェーズ名",
      "duration": 日数,
      "tasks": ["タスク名の配列"],
      "description": "フェーズの説明"
    }
  ],
  "recommendations": ["推奨事項の配列"]
}

優先度の基準：
- urgent: プロジェクトの成功に必須で、遅延が許されない
- high: 重要な機能や基盤
- medium: 通常の開発タスク
- low: 改善や追加機能

カテゴリ例：
- 要件定義
- 設計
- 開発
- テスト
- デプロイ
- 運用
- ドキュメント
`;
  }

  private callOpenAI(prompt: string): Observable<ProjectAnalysis> {
    const headers = {
      'Authorization': `Bearer ${this.API_KEY}`,
      'Content-Type': 'application/json'
    };

    const body = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'あなたは経験豊富なプロジェクトマネージャーです。プロジェクトの情報を基に、詳細なタスク分解とタイムラインを作成してください。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    };

    return this.http.post<any>(this.OPENAI_API_URL, body, { headers }).pipe(
      map(response => {
        try {
          const content = response.choices[0].message.content;
          return JSON.parse(content);
        } catch (error) {
          console.error('AI response parsing error:', error);
          return this.generateMockAnalysis({
            projectName: 'プロジェクト',
            description: '',
            appType: '',
            goals: '',
            scale: '',
            teamSize: 1
          });
        }
      }),
      catchError(error => {
        console.error('OpenAI API error:', error);
        return this.generateMockAnalysis({
          projectName: 'プロジェクト',
          description: '',
          appType: '',
          goals: '',
          scale: '',
          teamSize: 1
        });
      })
    );
  }

  private generateAnalysisWithLearning(input: ProjectInput): Observable<ProjectAnalysis> {
    return new Observable(observer => {
      this.getLearningData(input).then(learningData => {
        const tasks = this.generateTasksWithLearning(input, learningData);
        const timeline = this.generateTimelineWithLearning(input, learningData);
        const recommendations = this.generateRecommendationsWithLearning(input, learningData);

        observer.next({
          tasks,
          timeline,
          recommendations
        });
        observer.complete();
      }).catch(error => {
        console.error('学習データの処理に失敗:', error);
        // フォールバックとして従来の方法を使用
        const tasks = this.generateTasksForProject(input);
        const timeline = this.generateTimelineForProject(input);
        const recommendations = this.generateRecommendations(input);

        observer.next({
          tasks,
          timeline,
          recommendations
        });
        observer.complete();
      });
    });
  }

  private generateMockAnalysis(input: ProjectInput): Observable<ProjectAnalysis> {
    // プロジェクトタイプに応じたモックデータを生成
    const analysis: ProjectAnalysis = {
      tasks: this.generateTasksForProject(input),
      timeline: this.generateTimelineForProject(input),
      recommendations: this.generateRecommendations(input)
    };

    return of(analysis);
  }

  private generateTasksForProject(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    
    // プロジェクトタイプに応じたタスク生成
    if (input.appType === '個人の課題・学習') {
      return this.generatePersonalTaskTasks(input);
    } else if (input.appType === '研究・調査') {
      return this.generateResearchTasks(input);
    } else if (input.appType === 'イベント企画') {
      return this.generateEventTasks(input);
    } else if (input.appType === 'マーケティング') {
      return this.generateMarketingTasks(input);
    } else if (input.appType.includes('Web') || input.appType.includes('モバイル') || input.appType.includes('デスクトップ')) {
      return this.generateAppDevelopmentTasks(input);
    } else {
      return this.generateGenericTasks(input);
    }
  }

  private generatePersonalTaskTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    
    // 個人の課題・学習に特化したタスク
    if (input.goals.toLowerCase().includes('学習') || input.goals.toLowerCase().includes('勉強')) {
      const baseDays = this.getEstimatedDaysFromScale(input.scale);
      
      tasks.push({
        title: '学習計画の策定',
        description: `${input.goals}を達成するための詳細な学習計画を作成する`,
        priority: 'high',
        estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
        category: '計画'
      });
      
      tasks.push({
        title: '学習リソースの収集',
        description: '必要な教材、参考書、オンラインコースなどの学習リソースを収集する',
        priority: 'high',
        estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
        category: '準備',
        dependencies: ['学習計画の策定']
      });
      
      tasks.push({
        title: '学習環境の整備',
        description: '集中できる学習環境を整備し、必要なツールをセットアップする',
        priority: 'medium',
        estimatedDays: Math.max(1, Math.round(baseDays * 0.05)),
        category: '準備'
      });
    }
    
    if (input.goals.toLowerCase().includes('スキル') || input.goals.toLowerCase().includes('技術')) {
      tasks.push({
        title: 'スキル習得の実践',
        description: `${input.goals}に関するスキルを実際に練習し、習得する`,
        priority: 'high',
        estimatedDays: this.getEstimatedDaysFromScale(input.scale),
        category: '実践',
        dependencies: ['学習リソースの収集']
      });
    }
    
    if (input.goals.toLowerCase().includes('プロジェクト') || input.goals.toLowerCase().includes('作品')) {
      tasks.push({
        title: 'プロジェクトの実装',
        description: `${input.goals}を実際に実装し、完成させる`,
        priority: 'high',
        estimatedDays: this.getEstimatedDaysFromScale(input.scale),
        category: '実装',
        dependencies: ['スキル習得の実践']
      });
    }
    
    tasks.push({
      title: '進捗の振り返り',
      description: '定期的に学習・実践の進捗を振り返り、計画を調整する',
      priority: 'medium',
      estimatedDays: 1,
      category: '評価'
    });
    
    return tasks;
  }

  private generateResearchTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const baseDays = this.getEstimatedDaysFromScale(input.scale);
    
    tasks.push({
      title: '研究テーマの詳細化',
      description: `${input.goals}に関する研究テーマを具体的に定義し、研究範囲を明確にする`,
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '計画'
    });
    
    tasks.push({
      title: '先行研究の調査',
      description: '関連する先行研究や文献を調査し、現状を把握する',
      priority: 'high',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.15)),
      category: '調査',
      dependencies: ['研究テーマの詳細化']
    });
    
    tasks.push({
      title: '研究方法の決定',
      description: '研究の目的に最適な研究方法を選択し、手順を決定する',
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '計画',
      dependencies: ['先行研究の調査']
    });
    
    tasks.push({
      title: 'データ収集',
      description: '研究に必要なデータを収集する',
      priority: 'high',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.6),
      category: '実践',
      dependencies: ['研究方法の決定']
    });
    
    tasks.push({
      title: 'データ分析',
      description: '収集したデータを分析し、結果を導き出す',
      priority: 'high',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.3),
      category: '分析',
      dependencies: ['データ収集']
    });
    
    tasks.push({
      title: '研究報告書の作成',
      description: '研究結果をまとめ、報告書を作成する',
      priority: 'medium',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.1)),
      category: '文書化',
      dependencies: ['データ分析']
    });
    
    return tasks;
  }

  private generateEventTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const baseDays = this.getEstimatedDaysFromScale(input.scale);
    
    tasks.push({
      title: 'イベント企画の詳細化',
      description: `${input.goals}のイベント企画を具体的に詳細化する`,
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '企画'
    });
    
    tasks.push({
      title: '予算計画の策定',
      description: 'イベント開催に必要な予算を算出し、予算計画を策定する',
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.05)),
      category: '計画',
      dependencies: ['イベント企画の詳細化']
    });
    
    tasks.push({
      title: '会場の確保',
      description: 'イベント開催に適した会場を確保する',
      priority: 'urgent',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.1)),
      category: '準備'
    });
    
    tasks.push({
      title: '参加者の募集',
      description: 'イベントの参加者を募集し、申し込みを受け付ける',
      priority: 'high',
      estimatedDays: Math.max(3, Math.round(baseDays * 0.2)),
      category: '募集',
      dependencies: ['会場の確保']
    });
    
    tasks.push({
      title: '当日の運営準備',
      description: 'イベント当日の運営に必要な準備を行う',
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '準備',
      dependencies: ['参加者の募集']
    });
    
    tasks.push({
      title: 'イベントの実施',
      description: '計画通りにイベントを実施する',
      priority: 'urgent',
      estimatedDays: 1, // 実施日は固定
      category: '実施',
      dependencies: ['当日の運営準備']
    });
    
    tasks.push({
      title: '事後評価と報告',
      description: 'イベントの結果を評価し、報告書を作成する',
      priority: 'medium',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '評価',
      dependencies: ['イベントの実施']
    });
    
    return tasks;
  }

  private generateMarketingTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const baseDays = this.getEstimatedDaysFromScale(input.scale);
    
    tasks.push({
      title: 'マーケティング戦略の策定',
      description: `${input.goals}を達成するためのマーケティング戦略を策定する`,
      priority: 'high',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.1)),
      category: '戦略'
    });
    
    tasks.push({
      title: 'ターゲット分析',
      description: 'マーケティングのターゲットとなる顧客層を分析する',
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '分析',
      dependencies: ['マーケティング戦略の策定']
    });
    
    tasks.push({
      title: 'コンテンツ制作',
      description: 'マーケティングに必要なコンテンツ（動画、画像、文章など）を制作する',
      priority: 'high',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.5),
      category: '制作',
      dependencies: ['ターゲット分析']
    });
    
    tasks.push({
      title: 'SNS運用',
      description: 'SNSを活用したマーケティング活動を実施する',
      priority: 'medium',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.3),
      category: '運用',
      dependencies: ['コンテンツ制作']
    });
    
    tasks.push({
      title: '効果測定と分析',
      description: 'マーケティング活動の効果を測定し、分析する',
      priority: 'medium',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '分析',
      dependencies: ['SNS運用']
    });
    
    return tasks;
  }

  private generateAppDevelopmentTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const baseDays = this.getEstimatedDaysFromScale(input.scale);
    
    tasks.push({
      title: '要件定義書の作成',
      description: `${input.goals}を実現するための詳細な要件を整理し、要件定義書を作成する`,
      priority: 'high',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.1)),
      category: '要件定義'
    });
    
    tasks.push({
      title: 'システム設計',
      description: 'アーキテクチャ設計、データベース設計、API設計を行う',
      priority: 'high',
      estimatedDays: Math.max(3, Math.round(baseDays * 0.15)),
      category: '設計',
      dependencies: ['要件定義書の作成']
    });
    
    tasks.push({
      title: '開発環境構築',
      description: '開発に必要な環境、ツール、ライブラリのセットアップ',
      priority: 'urgent',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.05)),
      category: '開発'
    });
    
    if (input.appType.includes('Web')) {
      tasks.push({
        title: 'フロントエンド開発',
        description: 'ユーザーインターフェースの開発',
        priority: 'high',
        estimatedDays: Math.max(5, Math.round(baseDays * 0.3)),
        category: '開発',
        dependencies: ['システム設計', '開発環境構築']
      });
    }
    
    if (input.appType.includes('モバイル')) {
      tasks.push({
        title: 'モバイルアプリ開発',
        description: 'iOS/Androidアプリの開発',
        priority: 'high',
        estimatedDays: Math.max(8, Math.round(baseDays * 0.4)),
        category: '開発',
        dependencies: ['システム設計', '開発環境構築']
      });
    }
    
    tasks.push({
      title: 'コア機能の実装',
      description: `${input.goals}の核心となる機能を実装する`,
      priority: 'high',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.4),
      category: '開発',
      dependencies: ['システム設計', '開発環境構築']
    });
    
    tasks.push({
      title: 'テスト実装',
      description: '各機能のテストを作成し、品質を確保する',
      priority: 'medium',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.15)),
      category: 'テスト',
      dependencies: ['コア機能の実装']
    });
    
    tasks.push({
      title: 'デプロイ準備',
      description: '本番環境へのデプロイ準備と設定',
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.05)),
      category: 'デプロイ',
      dependencies: ['テスト実装']
    });
    
    return tasks;
  }

  private generateGenericTasks(input: ProjectInput): GeneratedTask[] {
    const tasks: GeneratedTask[] = [];
    const baseDays = this.getEstimatedDaysFromScale(input.scale);
    
    tasks.push({
      title: 'プロジェクト計画の策定',
      description: `${input.goals}を達成するための詳細なプロジェクト計画を策定する`,
      priority: 'high',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '計画'
    });
    
    tasks.push({
      title: 'リソースの準備',
      description: 'プロジェクトに必要なリソース（人材、資金、設備など）を準備する',
      priority: 'high',
      estimatedDays: Math.max(2, Math.round(baseDays * 0.1)),
      category: '準備',
      dependencies: ['プロジェクト計画の策定']
    });
    
    tasks.push({
      title: '実行フェーズ',
      description: `${input.goals}の実現に向けて実際の作業を実行する`,
      priority: 'high',
      estimatedDays: Math.round(this.getEstimatedDaysFromScale(input.scale) * 0.7),
      category: '実行',
      dependencies: ['リソースの準備']
    });
    
    tasks.push({
      title: '品質管理',
      description: 'プロジェクトの品質を管理し、必要に応じて調整を行う',
      priority: 'medium',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.1)),
      category: '管理',
      dependencies: ['実行フェーズ']
    });
    
    tasks.push({
      title: '完了報告',
      description: 'プロジェクトの完了報告書を作成し、成果をまとめる',
      priority: 'medium',
      estimatedDays: Math.max(1, Math.round(baseDays * 0.05)),
      category: '報告',
      dependencies: ['品質管理']
    });
    
    return tasks;
  }

  private getEstimatedDaysFromScale(scale: string): number {
    if (scale.includes('個人課題（数日）')) return 3;
    if (scale.includes('小規模（1-2週間）')) return 14;
    if (scale.includes('中規模（1-2ヶ月）')) return 45;
    if (scale.includes('大規模（3-6ヶ月）')) return 135;
    if (scale.includes('超大規模（6ヶ月以上）')) return 270;
    return 14; // デフォルト
  }

  private generateTimelineForProject(input: ProjectInput): TimelinePhase[] {
    const tasks = this.generateTasksForProject(input);
    const timeline: TimelinePhase[] = [];
    
    // プロジェクトタイプに応じたタイムライン生成
    if (input.appType === '個人の課題・学習') {
      return this.generatePersonalTaskTimeline(tasks, input);
    } else if (input.appType === '研究・調査') {
      return this.generateResearchTimeline(tasks, input);
    } else if (input.appType === 'イベント企画') {
      return this.generateEventTimeline(tasks, input);
    } else if (input.appType === 'マーケティング') {
      return this.generateMarketingTimeline(tasks, input);
    } else if (input.appType.includes('Web') || input.appType.includes('モバイル') || input.appType.includes('デスクトップ')) {
      return this.generateAppDevelopmentTimeline(tasks, input);
    } else {
      return this.generateGenericTimeline(tasks, input);
    }
  }

  private generatePersonalTaskTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const planningTasks = tasks.filter(t => t.category === '計画');
    const preparationTasks = tasks.filter(t => t.category === '準備');
    const practiceTasks = tasks.filter(t => t.category === '実践' || t.category === '実装');
    const evaluationTasks = tasks.filter(t => t.category === '評価');
    
    if (planningTasks.length > 0) {
      timeline.push({
        phase: '計画フェーズ',
        duration: Math.round(planningTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: planningTasks.map(t => t.title),
        description: `${input.goals}を達成するための計画を策定する`
      });
    }
    
    if (preparationTasks.length > 0) {
      timeline.push({
        phase: '準備フェーズ',
        duration: Math.round(preparationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: preparationTasks.map(t => t.title),
        description: '学習・実践に必要な環境とリソースを準備する'
      });
    }
    
    if (practiceTasks.length > 0) {
      timeline.push({
        phase: '実践フェーズ',
        duration: Math.round(practiceTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: practiceTasks.map(t => t.title),
        description: '実際に学習・実践を行い、スキルを習得する'
      });
    }
    
    if (evaluationTasks.length > 0) {
      timeline.push({
        phase: '評価フェーズ',
        duration: Math.round(evaluationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: evaluationTasks.map(t => t.title),
        description: '進捗を評価し、必要に応じて計画を調整する'
      });
    }
    
    return timeline;
  }

  private generateResearchTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const planningTasks = tasks.filter(t => t.category === '計画');
    const researchTasks = tasks.filter(t => t.category === '調査');
    const practiceTasks = tasks.filter(t => t.category === '実践');
    const analysisTasks = tasks.filter(t => t.category === '分析');
    const documentationTasks = tasks.filter(t => t.category === '文書化');
    
    if (planningTasks.length > 0) {
      timeline.push({
        phase: '研究計画フェーズ',
        duration: Math.round(planningTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: planningTasks.map(t => t.title),
        description: `${input.goals}に関する研究計画を策定する`
      });
    }
    
    if (researchTasks.length > 0) {
      timeline.push({
        phase: '調査フェーズ',
        duration: Math.round(researchTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: researchTasks.map(t => t.title),
        description: '先行研究や関連資料を調査する'
      });
    }
    
    if (practiceTasks.length > 0) {
      timeline.push({
        phase: 'データ収集フェーズ',
        duration: Math.round(practiceTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: practiceTasks.map(t => t.title),
        description: '研究に必要なデータを収集する'
      });
    }
    
    if (analysisTasks.length > 0) {
      timeline.push({
        phase: '分析フェーズ',
        duration: Math.round(analysisTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: analysisTasks.map(t => t.title),
        description: '収集したデータを分析し、結果を導き出す'
      });
    }
    
    if (documentationTasks.length > 0) {
      timeline.push({
        phase: '報告フェーズ',
        duration: Math.round(documentationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: documentationTasks.map(t => t.title),
        description: '研究結果をまとめ、報告書を作成する'
      });
    }
    
    return timeline;
  }

  private generateEventTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const planningTasks = tasks.filter(t => t.category === '企画' || t.category === '計画');
    const preparationTasks = tasks.filter(t => t.category === '準備');
    const recruitmentTasks = tasks.filter(t => t.category === '募集');
    const executionTasks = tasks.filter(t => t.category === '実施');
    const evaluationTasks = tasks.filter(t => t.category === '評価');
    
    if (planningTasks.length > 0) {
      timeline.push({
        phase: '企画フェーズ',
        duration: Math.round(planningTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: planningTasks.map(t => t.title),
        description: `${input.goals}のイベント企画を詳細化する`
      });
    }
    
    if (preparationTasks.length > 0) {
      timeline.push({
        phase: '準備フェーズ',
        duration: Math.round(preparationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: preparationTasks.map(t => t.title),
        description: 'イベント開催に必要な準備を行う'
      });
    }
    
    if (recruitmentTasks.length > 0) {
      timeline.push({
        phase: '募集フェーズ',
        duration: Math.round(recruitmentTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: recruitmentTasks.map(t => t.title),
        description: 'イベントの参加者を募集する'
      });
    }
    
    if (executionTasks.length > 0) {
      timeline.push({
        phase: '実施フェーズ',
        duration: Math.round(executionTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: executionTasks.map(t => t.title),
        description: '計画通りにイベントを実施する'
      });
    }
    
    if (evaluationTasks.length > 0) {
      timeline.push({
        phase: '評価フェーズ',
        duration: Math.round(evaluationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: evaluationTasks.map(t => t.title),
        description: 'イベントの結果を評価し、報告する'
      });
    }
    
    return timeline;
  }

  private generateMarketingTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const strategyTasks = tasks.filter(t => t.category === '戦略');
    const analysisTasks = tasks.filter(t => t.category === '分析');
    const productionTasks = tasks.filter(t => t.category === '制作');
    const operationTasks = tasks.filter(t => t.category === '運用');
    
    if (strategyTasks.length > 0) {
      timeline.push({
        phase: '戦略策定フェーズ',
        duration: Math.round(strategyTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: strategyTasks.map(t => t.title),
        description: `${input.goals}を達成するためのマーケティング戦略を策定する`
      });
    }
    
    if (analysisTasks.length > 0) {
      timeline.push({
        phase: '分析フェーズ',
        duration: Math.round(analysisTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: analysisTasks.map(t => t.title),
        description: 'ターゲット分析と効果測定を行う'
      });
    }
    
    if (productionTasks.length > 0) {
      timeline.push({
        phase: '制作フェーズ',
        duration: Math.round(productionTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: productionTasks.map(t => t.title),
        description: 'マーケティングに必要なコンテンツを制作する'
      });
    }
    
    if (operationTasks.length > 0) {
      timeline.push({
        phase: '運用フェーズ',
        duration: Math.round(operationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: operationTasks.map(t => t.title),
        description: 'マーケティング活動を実施し、効果を測定する'
      });
    }
    
    return timeline;
  }

  private generateAppDevelopmentTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const planningTasks = tasks.filter(t => t.category === '要件定義' || t.category === '設計');
    const developmentTasks = tasks.filter(t => t.category === '開発');
    const testingTasks = tasks.filter(t => t.category === 'テスト');
    const deploymentTasks = tasks.filter(t => t.category === 'デプロイ');
    
    if (planningTasks.length > 0) {
      timeline.push({
        phase: '要件定義・設計フェーズ',
        duration: Math.round(planningTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: planningTasks.map(t => t.title),
        description: `${input.goals}を実現するための要件定義と設計を行う`
      });
    }
    
    if (developmentTasks.length > 0) {
      timeline.push({
        phase: '開発フェーズ',
        duration: Math.round(developmentTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: developmentTasks.map(t => t.title),
        description: 'アプリケーションの主要機能を実装する'
      });
    }
    
    if (testingTasks.length > 0) {
      timeline.push({
        phase: 'テストフェーズ',
        duration: Math.round(testingTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: testingTasks.map(t => t.title),
        description: '品質確保のためのテストを実施する'
      });
    }
    
    if (deploymentTasks.length > 0) {
      timeline.push({
        phase: 'デプロイフェーズ',
        duration: Math.round(deploymentTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: deploymentTasks.map(t => t.title),
        description: '本番環境へのデプロイ準備と設定を行う'
      });
    }
    
    return timeline;
  }

  private generateGenericTimeline(tasks: GeneratedTask[], input: ProjectInput): TimelinePhase[] {
    const timeline: TimelinePhase[] = [];
    
    const planningTasks = tasks.filter(t => t.category === '計画');
    const preparationTasks = tasks.filter(t => t.category === '準備');
    const executionTasks = tasks.filter(t => t.category === '実行');
    const managementTasks = tasks.filter(t => t.category === '管理');
    const reportingTasks = tasks.filter(t => t.category === '報告');
    
    if (planningTasks.length > 0) {
      timeline.push({
        phase: '計画フェーズ',
        duration: Math.round(planningTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: planningTasks.map(t => t.title),
        description: `${input.goals}を達成するためのプロジェクト計画を策定する`
      });
    }
    
    if (preparationTasks.length > 0) {
      timeline.push({
        phase: '準備フェーズ',
        duration: Math.round(preparationTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: preparationTasks.map(t => t.title),
        description: 'プロジェクトに必要なリソースを準備する'
      });
    }
    
    if (executionTasks.length > 0) {
      timeline.push({
        phase: '実行フェーズ',
        duration: Math.round(executionTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: executionTasks.map(t => t.title),
        description: 'プロジェクトの主要な作業を実行する'
      });
    }
    
    if (managementTasks.length > 0) {
      timeline.push({
        phase: '管理フェーズ',
        duration: Math.round(managementTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: managementTasks.map(t => t.title),
        description: 'プロジェクトの品質を管理し、調整を行う'
      });
    }
    
    if (reportingTasks.length > 0) {
      timeline.push({
        phase: '報告フェーズ',
        duration: Math.round(reportingTasks.reduce((sum, task) => sum + task.estimatedDays, 0)),
        tasks: reportingTasks.map(t => t.title),
        description: 'プロジェクトの完了報告書を作成する'
      });
    }
    
    return timeline;
  }

  private generateRecommendations(input: ProjectInput): string[] {
    const recommendations: string[] = [];

    // プロジェクトタイプに応じた推奨事項
    if (input.appType === '個人の課題・学習') {
      recommendations.push('学習の進捗を記録し、定期的に振り返りを行うことを推奨します');
      recommendations.push('モチベーション維持のため、小さな目標を設定し、達成を祝うことをお勧めします');
      recommendations.push('学習内容をアウトプット（ブログ、SNS、プレゼンなど）することで理解を深めることができます');
    } else if (input.appType === '研究・調査') {
      recommendations.push('研究の信頼性を高めるため、複数の情報源からデータを収集することを推奨します');
      recommendations.push('研究の進捗を定期的に記録し、仮説の検証プロセスを明確にしてください');
      recommendations.push('研究結果の再現性を確保するため、詳細な手順を文書化することをお勧めします');
    } else if (input.appType === 'イベント企画') {
      recommendations.push('イベントの成功のため、参加者のニーズを事前に調査することを推奨します');
      recommendations.push('当日のトラブルに備え、バックアッププランを準備することをお勧めします');
      recommendations.push('イベント後のフィードバック収集により、次回の改善に活用してください');
    } else if (input.appType === 'マーケティング') {
      recommendations.push('マーケティング効果を測定するため、KPIを明確に設定することを推奨します');
      recommendations.push('ターゲット層に合わせたコンテンツ制作により、エンゲージメントを向上させることができます');
      recommendations.push('競合他社の動向を定期的に調査し、差別化戦略を検討してください');
    } else if (input.appType.includes('Web') || input.appType.includes('モバイル') || input.appType.includes('デスクトップ')) {
      recommendations.push('開発の品質を確保するため、コードレビューとテストを徹底することを推奨します');
      recommendations.push('ユーザビリティを重視し、プロトタイプでの検証を早期に行うことをお勧めします');
      recommendations.push('セキュリティ対策を開発初期段階から考慮し、定期的な脆弱性チェックを行ってください');
    } else {
      recommendations.push('プロジェクトの成功のため、明確な目標と成功指標を設定することを推奨します');
      recommendations.push('リスク管理のため、想定される問題点を事前に洗い出し、対策を準備してください');
      recommendations.push('チーム内でのコミュニケーションを円滑にするため、定期的な進捗共有を行ってください');
    }

    // チームサイズに応じた推奨事項
    if (input.teamSize === 1) {
      recommendations.push('個人作業のため、進捗管理ツールを活用し、自己管理を徹底してください');
    } else if (input.teamSize <= 3) {
      recommendations.push('小規模チームのため、密なコミュニケーションと役割分担の明確化が重要です');
    } else if (input.teamSize <= 5) {
      recommendations.push('中規模チームのため、定期的なミーティングと進捗共有を設定してください');
    } else {
      recommendations.push('大規模チームのため、アジャイル開発手法の導入とプロジェクト管理ツールの活用を検討してください');
    }

    // 規模感に応じた推奨事項
    if (input.scale.includes('個人課題（数日）')) {
      recommendations.push('短期間のプロジェクトのため、集中して作業に取り組む環境を整備してください');
    } else if (input.scale.includes('小規模（1-2週間）')) {
      recommendations.push('短期プロジェクトのため、優先順位を明確にし、重要なタスクから着手してください');
    } else if (input.scale.includes('中規模（1-2ヶ月）')) {
      recommendations.push('中期的なプロジェクトのため、マイルストーンを設定し、定期的な進捗確認を行ってください');
    } else if (input.scale.includes('大規模（3-6ヶ月）')) {
      recommendations.push('長期プロジェクトのため、詳細な計画策定とリスク管理が重要です');
    } else if (input.scale.includes('超大規模（6ヶ月以上）')) {
      recommendations.push('超長期プロジェクトのため、段階的な成果物の設定と継続的なモチベーション管理が必要です');
    }

    // 期限が設定されている場合の推奨事項
    if (input.deadline) {
      recommendations.push('設定された期限を考慮し、バッファ時間を含めた現実的なスケジュールを立ててください');
    }

    return recommendations;
  }

  // ===== 学習データを活用したメソッド =====

  /**
   * 類似グループを検索
   */
  private async findSimilarGroups(input: ProjectInput): Promise<SimilarGroup[]> {
    try {
      const groupsRef = collection(this.firestore, 'groups');
      const groupsSnapshot = await getDocs(groupsRef);
      
      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // プロジェクトタイプや説明に基づいて類似度を計算
      const similarGroups = groups
        .filter(group => this.calculateSimilarity(input, group) > 0.3)
        .map(group => ({
          id: group.id,
          name: group.name,
          description: group.description,
          memberCount: group.memberIds?.length || 0,
          taskCount: 0, // 後で計算
          completionRate: 0, // 後で計算
          commonKeywords: this.extractKeywords(group.description)
        }))
        .slice(0, 5); // 上位5件

      // 各グループのタスク情報を取得
      for (const group of similarGroups) {
        const tasks = await this.taskService.getGroupTasks(group.id).pipe(take(1)).toPromise();
        group.taskCount = tasks?.length || 0;
        group.completionRate = tasks ? (tasks.filter(t => t.status === 'completed').length / tasks.length) : 0;
      }

      return similarGroups;
    } catch (error) {
      console.error('類似グループの検索に失敗:', error);
      return [];
    }
  }

  /**
   * 共通タスクを分析
   */
  private async analyzeCommonTasks(input: ProjectInput): Promise<CommonTask[]> {
    try {
      const tasksRef = collection(this.firestore, 'tasks');
      const tasksSnapshot = await getDocs(tasksRef);
      
      const allTasks = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      // プロジェクトタイプに関連するタスクをフィルタリング
      const relevantTasks = allTasks.filter(task => 
        this.isTaskRelevant(task, input)
      );

      // タスクをカテゴリ別にグループ化
      const taskCategories = this.categorizeTasks(relevantTasks);
      
      // 各カテゴリの共通タスクを生成
      const commonTasks: CommonTask[] = [];
      
      for (const [category, tasks] of Object.entries(taskCategories)) {
        if (tasks.length > 0) {
          const avgDays = tasks.reduce((sum, task) => sum + (task.estimatedDays || 3), 0) / tasks.length;
          const frequency = Math.min(tasks.length / 10, 1); // 出現頻度（正規化）
          
          commonTasks.push({
            title: this.generateTaskTitle(category, tasks),
            description: this.generateTaskDescription(category, tasks),
            category,
            averageDays: Math.round(avgDays),
            frequency,
            priority: this.determinePriority(frequency, avgDays)
          });
        }
      }

      return commonTasks.sort((a, b) => b.frequency - a.frequency).slice(0, 10);
    } catch (error) {
      console.error('共通タスクの分析に失敗:', error);
      return [];
    }
  }

  /**
   * 成功パターンを特定
   */
  private async identifySuccessPatterns(input: ProjectInput): Promise<SuccessPattern[]> {
    try {
      const groupsRef = collection(this.firestore, 'groups');
      const groupsSnapshot = await getDocs(groupsRef);
      
      const groups = groupsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      const patterns: SuccessPattern[] = [];

      // 高完了率グループの特徴を分析
      for (const group of groups) {
        const tasks = await this.taskService.getGroupTasks(group.id).pipe(take(1)).toPromise();
        if (tasks && tasks.length > 0) {
          const completionRate = tasks.filter(t => t.status === 'completed').length / tasks.length;
          
          if (completionRate > 0.8) { // 高完了率グループ
            patterns.push({
              pattern: '段階的タスク分割',
              description: '大きなタスクを小さな単位に分割することで、進捗が見えやすくなり完了率が向上',
              successRate: completionRate,
              applicableTypes: ['Webアプリケーション', 'モバイルアプリ', '研究・調査']
            });
          }
        }
      }

      // デフォルトの成功パターンも追加
      patterns.push(
        {
          pattern: '定期的な進捗確認',
          description: '週次または日次での進捗確認により、問題の早期発見と解決が可能',
          successRate: 0.85,
          applicableTypes: ['すべて']
        },
        {
          pattern: '明確な期限設定',
          description: '各タスクに明確な期限を設定することで、優先順位が明確になり効率が向上',
          successRate: 0.78,
          applicableTypes: ['すべて']
        }
      );

      return patterns.slice(0, 5);
    } catch (error) {
      console.error('成功パターンの特定に失敗:', error);
      return [];
    }
  }

  /**
   * 学習データを活用したタスク生成
   */
  private generateTasksWithLearning(input: ProjectInput, learningData: LearningData): GeneratedTask[] {
    const baseTasks = this.generateTasksForProject(input);
    const learnedTasks: GeneratedTask[] = [];

    // 共通タスクから学習したタスクを追加
    for (const commonTask of learningData.commonTasks) {
      if (commonTask.frequency > 0.5) { // 高頻度タスクのみ採用
        learnedTasks.push({
          title: commonTask.title,
          description: commonTask.description,
          priority: commonTask.priority as 'high' | 'medium' | 'low',
          estimatedDays: commonTask.averageDays,
          category: commonTask.category
        });
      }
    }

    // ベースタスクと学習タスクをマージ（重複を避ける）
    const allTasks = [...baseTasks];
    for (const learnedTask of learnedTasks) {
      if (!allTasks.some(task => task.title === learnedTask.title)) {
        allTasks.push(learnedTask);
      }
    }

    return allTasks.slice(0, 15); // 最大15タスク
  }

  /**
   * 学習データを活用したタイムライン生成
   */
  private generateTimelineWithLearning(input: ProjectInput, learningData: LearningData): TimelinePhase[] {
    const baseTimeline = this.generateTimelineForProject(input);
    
    // 成功パターンに基づいてタイムラインを調整
    const adjustedTimeline = baseTimeline.map(phase => {
      const relevantPatterns = learningData.successPatterns.filter(pattern => 
        pattern.applicableTypes.includes(input.appType) || pattern.applicableTypes.includes('すべて')
      );

      if (relevantPatterns.length > 0) {
        const avgSuccessRate = relevantPatterns.reduce((sum, p) => sum + p.successRate, 0) / relevantPatterns.length;
        // 成功率に基づいて期間を調整
        const adjustedDuration = Math.round(phase.duration * (1 + (1 - avgSuccessRate) * 0.2));
        return {
          ...phase,
          duration: adjustedDuration
        };
      }
      return phase;
    });

    return adjustedTimeline;
  }

  /**
   * 学習データを活用した推奨事項生成
   */
  private generateRecommendationsWithLearning(input: ProjectInput, learningData: LearningData): string[] {
    const baseRecommendations = this.generateRecommendations(input);
    const learnedRecommendations: string[] = [];

    // 類似グループからの学習
    if (learningData.similarGroups.length > 0) {
      const avgCompletionRate = learningData.similarGroups.reduce((sum, group) => sum + group.completionRate, 0) / learningData.similarGroups.length;
      
      if (avgCompletionRate > 0.8) {
        learnedRecommendations.push(`類似プロジェクト「${learningData.similarGroups[0].name}」では高い完了率（${Math.round(avgCompletionRate * 100)}%）を達成しています。同じアプローチを参考にしてください。`);
      }
    }

    // 成功パターンからの学習
    for (const pattern of learningData.successPatterns) {
      if (pattern.applicableTypes.includes(input.appType) || pattern.applicableTypes.includes('すべて')) {
        learnedRecommendations.push(`成功パターン「${pattern.pattern}」を採用することを推奨します（成功率: ${Math.round(pattern.successRate * 100)}%）。${pattern.description}`);
      }
    }

    return [...baseRecommendations, ...learnedRecommendations].slice(0, 8);
  }

  // ===== ヘルパーメソッド =====

  private calculateSimilarity(input: ProjectInput, group: any): number {
    let similarity = 0;
    
    // プロジェクトタイプの類似度
    if (group.description && input.appType) {
      const inputKeywords = this.extractKeywords(input.appType + ' ' + input.description);
      const groupKeywords = this.extractKeywords(group.description);
      const commonKeywords = inputKeywords.filter(keyword => groupKeywords.includes(keyword));
      similarity += (commonKeywords.length / Math.max(inputKeywords.length, groupKeywords.length)) * 0.6;
    }

    // チームサイズの類似度
    const groupSize = group.memberIds?.length || 0;
    const sizeDiff = Math.abs(groupSize - input.teamSize);
    similarity += (1 - sizeDiff / Math.max(groupSize, input.teamSize, 1)) * 0.4;

    return similarity;
  }

  private extractKeywords(text: string): string[] {
    const keywords = text.toLowerCase()
      .replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
    
    return [...new Set(keywords)]; // 重複を除去
  }

  private isTaskRelevant(task: any, input: ProjectInput): boolean {
    const taskText = (task.title + ' ' + task.description).toLowerCase();
    const inputText = (input.appType + ' ' + input.description + ' ' + input.goals).toLowerCase();
    
    const inputKeywords = this.extractKeywords(inputText);
    const taskKeywords = this.extractKeywords(taskText);
    
    const commonKeywords = inputKeywords.filter(keyword => taskKeywords.includes(keyword));
    return commonKeywords.length > 0;
  }

  private categorizeTasks(tasks: any[]): { [category: string]: any[] } {
    const categories: { [category: string]: any[] } = {};
    
    for (const task of tasks) {
      const category = this.determineTaskCategory(task);
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(task);
    }
    
    return categories;
  }

  private determineTaskCategory(task: any): string {
    const title = task.title?.toLowerCase() || '';
    const description = task.description?.toLowerCase() || '';
    const text = title + ' ' + description;

    if (text.includes('設計') || text.includes('設計書') || text.includes('architecture')) {
      return '設計・設計書';
    } else if (text.includes('開発') || text.includes('実装') || text.includes('coding')) {
      return '開発・実装';
    } else if (text.includes('テスト') || text.includes('検証') || text.includes('testing')) {
      return 'テスト・検証';
    } else if (text.includes('調査') || text.includes('研究') || text.includes('analysis')) {
      return '調査・研究';
    } else if (text.includes('企画') || text.includes('計画') || text.includes('planning')) {
      return '企画・計画';
    } else if (text.includes('デザイン') || text.includes('ui') || text.includes('ux')) {
      return 'デザイン・UI/UX';
    } else if (text.includes('ドキュメント') || text.includes('文書') || text.includes('documentation')) {
      return 'ドキュメント・文書';
    } else if (text.includes('デプロイ') || text.includes('リリース') || text.includes('deployment')) {
      return 'デプロイ・リリース';
    } else {
      return 'その他';
    }
  }

  private generateTaskTitle(category: string, tasks: any[]): string {
    const commonWords = this.findCommonWords(tasks.map(t => t.title));
    
    switch (category) {
      case '設計・設計書':
        return commonWords.length > 0 ? `${commonWords[0]}の設計書作成` : 'システム設計書の作成';
      case '開発・実装':
        return commonWords.length > 0 ? `${commonWords[0]}の実装` : '機能の実装';
      case 'テスト・検証':
        return commonWords.length > 0 ? `${commonWords[0]}のテスト` : '機能テストの実施';
      case '調査・研究':
        return commonWords.length > 0 ? `${commonWords[0]}の調査` : '技術調査の実施';
      case '企画・計画':
        return commonWords.length > 0 ? `${commonWords[0]}の企画` : 'プロジェクト企画の策定';
      case 'デザイン・UI/UX':
        return commonWords.length > 0 ? `${commonWords[0]}のデザイン` : 'UI/UXデザインの作成';
      case 'ドキュメント・文書':
        return commonWords.length > 0 ? `${commonWords[0]}のドキュメント作成` : '技術文書の作成';
      case 'デプロイ・リリース':
        return commonWords.length > 0 ? `${commonWords[0]}のデプロイ` : 'システムのデプロイ';
      default:
        return commonWords.length > 0 ? `${commonWords[0]}の作業` : 'タスクの実行';
    }
  }

  private generateTaskDescription(category: string, tasks: any[]): string {
    const descriptions = tasks.map(t => t.description).filter(d => d && d.length > 0);
    const commonPhrases = this.findCommonPhrases(descriptions);
    
    if (commonPhrases.length > 0) {
      return commonPhrases[0];
    }
    
    switch (category) {
      case '設計・設計書':
        return 'システムの設計書を作成し、要件を明確に定義する';
      case '開発・実装':
        return '要件に基づいて機能を実装し、動作確認を行う';
      case 'テスト・検証':
        return '実装した機能のテストを実施し、品質を確保する';
      case '調査・研究':
        return '必要な技術や手法について調査し、最適解を見つける';
      case '企画・計画':
        return 'プロジェクトの企画を策定し、実行計画を立てる';
      case 'デザイン・UI/UX':
        return 'ユーザビリティを考慮したデザインを作成する';
      case 'ドキュメント・文書':
        return 'プロジェクトに関する技術文書を作成する';
      case 'デプロイ・リリース':
        return 'システムを本番環境にデプロイし、リリースする';
      default:
        return 'プロジェクトの目標達成に向けて作業を進める';
    }
  }

  private findCommonWords(titles: string[]): string[] {
    const wordCount: { [word: string]: number } = {};
    
    for (const title of titles) {
      const words = this.extractKeywords(title);
      for (const word of words) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }
    
    return Object.entries(wordCount)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([word, _]) => word)
      .slice(0, 3);
  }

  private findCommonPhrases(descriptions: string[]): string[] {
    const phraseCount: { [phrase: string]: number } = {};
    
    for (const description of descriptions) {
      const sentences = description.split(/[。！？]/).filter(s => s.trim().length > 0);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 10 && trimmed.length < 100) {
          phraseCount[trimmed] = (phraseCount[trimmed] || 0) + 1;
        }
      }
    }
    
    return Object.entries(phraseCount)
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .map(([phrase, _]) => phrase)
      .slice(0, 3);
  }

  private determinePriority(frequency: number, averageDays: number): string {
    if (frequency > 0.7 && averageDays <= 3) {
      return 'high';
    } else if (frequency > 0.4 || averageDays <= 7) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private generateLearningRecommendations(similarGroups: SimilarGroup[], commonTasks: CommonTask[], successPatterns: SuccessPattern[]): string[] {
    const recommendations: string[] = [];
    
    if (similarGroups.length > 0) {
      recommendations.push(`類似プロジェクトから${similarGroups.length}件の成功事例を学習しました`);
    }
    
    if (commonTasks.length > 0) {
      recommendations.push(`過去のプロジェクトから${commonTasks.length}件の共通タスクパターンを抽出しました`);
    }
    
    if (successPatterns.length > 0) {
      recommendations.push(`${successPatterns.length}件の成功パターンを特定し、適用可能なものを推奨事項に含めました`);
    }
    
    return recommendations;
  }

  private getDefaultLearningData(): LearningData {
    return {
      similarGroups: [],
      commonTasks: [],
      successPatterns: [
        {
          pattern: '段階的タスク分割',
          description: '大きなタスクを小さな単位に分割することで、進捗が見えやすくなり完了率が向上',
          successRate: 0.85,
          applicableTypes: ['すべて']
        }
      ],
      recommendations: ['学習データの取得に失敗したため、デフォルトの推奨事項を適用しています']
    };
  }
}
