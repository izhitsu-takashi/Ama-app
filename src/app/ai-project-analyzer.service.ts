import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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

@Injectable({
  providedIn: 'root'
})
export class AiProjectAnalyzerService {
  private readonly OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly API_KEY = 'YOUR_OPENAI_API_KEY'; // 実際のAPIキーに置き換える

  constructor(private http: HttpClient) {}

  analyzeProject(projectInput: ProjectInput): Observable<ProjectAnalysis> {
    const prompt = this.createAnalysisPrompt(projectInput);
    
    // 実際のOpenAI APIを使用する場合
    // return this.callOpenAI(prompt);
    
    // 開発用のモックデータを返す
    return this.generateMockAnalysis(projectInput);
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
    const baseTasks: GeneratedTask[] = [
      {
        title: '要件定義書の作成',
        description: 'プロジェクトの詳細な要件を整理し、要件定義書を作成する',
        priority: 'high',
        estimatedDays: 3,
        category: '要件定義'
      },
      {
        title: 'システム設計',
        description: 'アーキテクチャ設計、データベース設計、API設計を行う',
        priority: 'high',
        estimatedDays: 5,
        category: '設計',
        dependencies: ['要件定義書の作成']
      },
      {
        title: '開発環境構築',
        description: '開発に必要な環境、ツール、ライブラリのセットアップ',
        priority: 'urgent',
        estimatedDays: 2,
        category: '開発'
      },
      {
        title: 'コア機能の実装',
        description: 'アプリケーションの主要機能を実装する',
        priority: 'high',
        estimatedDays: 10,
        category: '開発',
        dependencies: ['システム設計', '開発環境構築']
      },
      {
        title: 'ユニットテスト作成',
        description: '各機能のユニットテストを作成し、品質を確保する',
        priority: 'medium',
        estimatedDays: 4,
        category: 'テスト',
        dependencies: ['コア機能の実装']
      },
      {
        title: '統合テスト',
        description: 'システム全体の統合テストを実施する',
        priority: 'medium',
        estimatedDays: 3,
        category: 'テスト',
        dependencies: ['ユニットテスト作成']
      },
      {
        title: 'デプロイ準備',
        description: '本番環境へのデプロイ準備と設定',
        priority: 'high',
        estimatedDays: 2,
        category: 'デプロイ',
        dependencies: ['統合テスト']
      },
      {
        title: 'ドキュメント作成',
        description: 'ユーザーマニュアル、技術ドキュメントを作成',
        priority: 'low',
        estimatedDays: 3,
        category: 'ドキュメント'
      }
    ];

    // プロジェクトタイプに応じてタスクを調整
    if (input.appType.includes('Web')) {
      baseTasks.push({
        title: 'フロントエンド開発',
        description: 'ユーザーインターフェースの開発',
        priority: 'high',
        estimatedDays: 8,
        category: '開発',
        dependencies: ['システム設計']
      });
    }

    if (input.appType.includes('モバイル')) {
      baseTasks.push({
        title: 'モバイルアプリ開発',
        description: 'iOS/Androidアプリの開発',
        priority: 'high',
        estimatedDays: 12,
        category: '開発',
        dependencies: ['システム設計']
      });
    }

    return baseTasks;
  }

  private generateTimelineForProject(input: ProjectInput): TimelinePhase[] {
    return [
      {
        phase: '要件定義・設計フェーズ',
        duration: 8,
        tasks: ['要件定義書の作成', 'システム設計'],
        description: 'プロジェクトの基盤となる要件定義と設計を行う'
      },
      {
        phase: '開発フェーズ',
        duration: 20,
        tasks: ['開発環境構築', 'コア機能の実装', 'フロントエンド開発', 'モバイルアプリ開発'],
        description: 'アプリケーションの主要機能を実装する'
      },
      {
        phase: 'テストフェーズ',
        duration: 7,
        tasks: ['ユニットテスト作成', '統合テスト'],
        description: '品質確保のためのテストを実施する'
      },
      {
        phase: 'リリース準備フェーズ',
        duration: 5,
        tasks: ['デプロイ準備', 'ドキュメント作成'],
        description: '本番リリースの準備を行う'
      }
    ];
  }

  private generateRecommendations(input: ProjectInput): string[] {
    const recommendations = [
      '定期的な進捗確認ミーティングを設定することを推奨します',
      'リスク管理のため、バッファ時間を20%程度確保することをお勧めします',
      'チーム内でのコミュニケーションを円滑にするため、SlackやDiscordなどのツールを活用してください'
    ];

    if (input.teamSize > 5) {
      recommendations.push('チームサイズが大きいため、アジャイル開発手法の導入を検討してください');
    }

    if (input.appType.includes('Web')) {
      recommendations.push('Webアプリケーションの場合、レスポンシブデザインを考慮してください');
    }

    if (input.appType.includes('モバイル')) {
      recommendations.push('モバイルアプリの場合、App Store/Google Playの審査期間を考慮してください');
    }

    return recommendations;
  }
}
