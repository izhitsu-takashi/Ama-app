import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { GroupService } from './group.service';
import { TaskService } from './task.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class TestDataService {
  private firestore = inject(Firestore);
  private groupService = inject(GroupService);
  private taskService = inject(TaskService);
  private authService = inject(AuthService);

  async createTestData(): Promise<void> {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      throw new Error('ログインが必要です');
    }

    console.log('🧪 テストデータ作成開始...');

    try {
      // 1. テストグループを作成
      const group1 = await this.groupService.createGroup({
        name: 'Webアプリ開発プロジェクト',
        description: 'ReactとNode.jsを使用したWebアプリケーション開発',
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        isPublic: true,
        requiresApproval: false
      });

      const group2 = await this.groupService.createGroup({
        name: 'モバイルアプリ開発',
        description: 'React Nativeを使用したモバイルアプリケーション開発',
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        isPublic: true,
        requiresApproval: false
      });

      const group3 = await this.groupService.createGroup({
        name: '研究・調査プロジェクト',
        description: 'AI技術の調査と研究を行うプロジェクト',
        ownerId: currentUser.uid,
        memberIds: [currentUser.uid],
        isPublic: true,
        requiresApproval: false
      });

      console.log('✅ テストグループ作成完了:', { group1: group1.id, group2: group2.id, group3: group3.id });

      // 2. テストタスクを作成
      const tasks = [
        // Webアプリ開発関連
        {
          groupId: group1.id,
          title: 'システム設計書の作成',
          content: 'アーキテクチャ設計とデータベース設計を含むシステム設計書を作成する',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date(),
          estimatedDays: 5
        },
        {
          groupId: group1.id,
          title: 'フロントエンド実装',
          content: 'Reactコンポーネントの実装とUI/UXの開発',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date(),
          estimatedDays: 10
        },
        {
          groupId: group1.id,
          title: 'バックエンドAPI開発',
          content: 'Node.jsとExpressを使用したRESTful APIの開発',
          priority: 'high' as const,
          status: 'in_progress' as const,
          dueDate: new Date(),
          estimatedDays: 8
        },
        {
          groupId: group1.id,
          title: 'ユニットテストの実装',
          content: 'Jestを使用したユニットテストの実装とテストカバレッジの向上',
          priority: 'medium' as const,
          status: 'not_started' as const,
          dueDate: new Date(),
          estimatedDays: 3
        },
        
        // モバイルアプリ開発関連
        {
          groupId: group2.id,
          title: 'モバイルアプリ設計',
          content: 'React Nativeを使用したモバイルアプリの設計とプロトタイプ作成',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date(),
          estimatedDays: 7
        },
        {
          groupId: group2.id,
          title: 'UI/UXデザイン',
          content: 'モバイルアプリのUI/UXデザインとプロトタイプの作成',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date(),
          estimatedDays: 6
        },
        {
          groupId: group2.id,
          title: 'ネイティブ機能実装',
          content: 'カメラ、位置情報などのネイティブ機能の実装',
          priority: 'medium' as const,
          status: 'in_progress' as const,
          dueDate: new Date(),
          estimatedDays: 12
        },
        
        // 研究・調査関連
        {
          groupId: group3.id,
          title: 'AI技術調査',
          content: '最新のAI技術とフレームワークの調査と比較分析',
          priority: 'high' as const,
          status: 'completed' as const,
          dueDate: new Date(),
          estimatedDays: 5
        },
        {
          groupId: group3.id,
          title: 'プロトタイプ開発',
          content: '調査結果を基にしたAI機能のプロトタイプ開発',
          priority: 'medium' as const,
          status: 'in_progress' as const,
          dueDate: new Date(),
          estimatedDays: 8
        }
      ];

      for (const taskData of tasks) {
        await this.taskService.createTask(taskData.groupId, {
          ...taskData,
          assigneeId: currentUser.uid,
          occurredOn: new Date(),
          isRecurring: false
        });
      }

      console.log('✅ テストタスク作成完了:', tasks.length, '件');

      alert('テストデータの作成が完了しました！\n\n作成されたデータ:\n- グループ: 3件\n- タスク: 9件\n\nAI基盤作成機能で学習データをテストしてください。');

    } catch (error) {
      console.error('❌ テストデータ作成に失敗:', error);
      alert('テストデータの作成に失敗しました: ' + error);
    }
  }

  async clearTestData(): Promise<void> {
    // 注意: この機能は慎重に使用してください
    // 実際のデータも削除される可能性があります
    console.log('⚠️ テストデータクリア機能は実装されていません');
    alert('テストデータのクリア機能は安全のため実装されていません。\nFirebase Consoleから手動で削除してください。');
  }
}
