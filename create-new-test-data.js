const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Firebase Admin SDKの初期化
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 現在の5人のユーザー情報
const currentUsers = [
  {
    uid: 'AFlesJZUw0eMkDgtCbatIUjRNfR2',
    name: '管理者',
    email: 'takashi131502@icloud.com',
    department: 'other',
    role: 'user'
  },
  {
    uid: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    name: '井實　聖',
    email: 'takashi.izhitsu@pathoslogos.co.jp',
    department: 'development',
    role: 'user'
  },
  {
    uid: 'user_consult_saburo',
    name: 'コンサル 三郎',
    email: 'konsal@pathoslogos.co.jp',
    department: 'consulting',
    role: 'user'
  },
  {
    uid: 'user_dev_taro',
    name: '開発 太郎',
    email: 'kaihatsu@pathoslogos.co.jp',
    department: 'development',
    role: 'user'
  },
  {
    uid: 'user_sales_jiro',
    name: '営業 次郎',
    email: 'eigyou@pathoslogos.co.jp',
    department: 'sales',
    role: 'user'
  }
];

// 新しいグループデータ
const newGroups = [
  {
    id: 'group_development_team',
    name: '開発チーム',
    description: 'システム開発を担当するメインチーム',
    department: 'development',
    createdBy: 'o1hDLgu2jGb0t26HULCfSS4118t2', // 井實聖
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 3
  },
  {
    id: 'group_sales_team',
    name: '営業チーム',
    description: '営業活動と顧客管理を担当',
    department: 'sales',
    createdBy: 'user_sales_jiro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 1
  },
  {
    id: 'group_consulting_team',
    name: 'コンサルティングチーム',
    description: 'クライアント向けコンサルティング業務',
    department: 'consulting',
    createdBy: 'user_consult_saburo',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 1
  },
  {
    id: 'group_management_team',
    name: '管理チーム',
    description: '全社的な管理業務と戦略立案',
    department: 'management',
    createdBy: 'AFlesJZUw0eMkDgtCbatIUjRNfR2', // 管理者
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 2
  },
  {
    id: 'group_project_alpha',
    name: 'プロジェクトAlpha',
    description: '新規システム開発プロジェクト',
    department: 'cross_functional',
    createdBy: 'o1hDLgu2jGb0t26HULCfSS4118t2', // 井實聖
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 4
  },
  {
    id: 'group_project_beta',
    name: 'プロジェクトBeta',
    description: '既存システムの改善プロジェクト',
    department: 'cross_functional',
    createdBy: 'user_dev_taro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 3
  }
];

// グループメンバーシップデータ
const groupMemberships = [
  // 開発チーム
  { groupId: 'group_development_team', userId: 'o1hDLgu2jGb0t26HULCfSS4118t2', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_development_team', userId: 'user_dev_taro', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_development_team', userId: 'user_consult_saburo', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // 営業チーム
  { groupId: 'group_sales_team', userId: 'user_sales_jiro', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // コンサルティングチーム
  { groupId: 'group_consulting_team', userId: 'user_consult_saburo', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // 管理チーム
  { groupId: 'group_management_team', userId: 'AFlesJZUw0eMkDgtCbatIUjRNfR2', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_management_team', userId: 'o1hDLgu2jGb0t26HULCfSS4118t2', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // プロジェクトAlpha
  { groupId: 'group_project_alpha', userId: 'o1hDLgu2jGb0t26HULCfSS4118t2', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_project_alpha', userId: 'user_dev_taro', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_project_alpha', userId: 'user_sales_jiro', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_project_alpha', userId: 'user_consult_saburo', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // プロジェクトBeta
  { groupId: 'group_project_beta', userId: 'user_dev_taro', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_project_beta', userId: 'o1hDLgu2jGb0t26HULCfSS4118t2', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_project_beta', userId: 'user_consult_saburo', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() }
];

// 新しい課題データ
const newTasks = [
  // 開発チームの課題
  {
    id: 'task_dev_001',
    title: 'ユーザー認証システムの改修',
    content: 'セキュリティ強化のため、多要素認証機能を追加する',
    groupId: 'group_development_team',
    assigneeId: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    priority: 'urgent',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_dev_002',
    title: 'API パフォーマンス最適化',
    content: 'レスポンス時間を50%短縮するための最適化作業',
    groupId: 'group_development_team',
    assigneeId: 'user_dev_taro',
    priority: 'high',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)), // 10日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_dev_003',
    title: 'データベース設計見直し',
    content: 'スケーラビリティ向上のためのDB設計の見直し',
    groupId: 'group_development_team',
    assigneeId: 'user_consult_saburo',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), // 14日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // 営業チームの課題
  {
    id: 'task_sales_001',
    title: '新規顧客開拓リスト作成',
    content: '潜在顧客500社のリストアップと優先順位付け',
    groupId: 'group_sales_team',
    assigneeId: 'user_sales_jiro',
    priority: 'high',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // コンサルティングチームの課題
  {
    id: 'task_consult_001',
    title: 'クライアント向け提案書作成',
    content: '新規プロジェクトの提案書とプレゼン資料の作成',
    groupId: 'group_consulting_team',
    assigneeId: 'user_consult_saburo',
    priority: 'urgent',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // 管理チームの課題
  {
    id: 'task_mgmt_001',
    title: '四半期戦略計画策定',
    content: '来四半期の事業戦略とKPI設定',
    groupId: 'group_management_team',
    assigneeId: 'AFlesJZUw0eMkDgtCbatIUjRNfR2',
    priority: 'high',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)), // 21日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_mgmt_002',
    title: '組織体制見直し',
    content: '効率化のための組織体制の見直しと改善案作成',
    groupId: 'group_management_team',
    assigneeId: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // プロジェクトAlphaの課題
  {
    id: 'task_alpha_001',
    title: '要件定義書作成',
    content: '新システムの詳細要件定義と仕様書作成',
    groupId: 'group_project_alpha',
    assigneeId: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    priority: 'urgent',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)), // 4日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_alpha_002',
    title: '技術選定とアーキテクチャ設計',
    content: '使用技術の選定とシステムアーキテクチャの設計',
    groupId: 'group_project_alpha',
    assigneeId: 'user_dev_taro',
    priority: 'high',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)), // 8日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_alpha_003',
    title: '市場調査と競合分析',
    content: '競合他社の分析と市場動向の調査',
    groupId: 'group_project_alpha',
    assigneeId: 'user_sales_jiro',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 12 * 24 * 60 * 60 * 1000)), // 12日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // プロジェクトBetaの課題
  {
    id: 'task_beta_001',
    title: '既存システムの監査',
    content: '現在のシステムの問題点と改善点の洗い出し',
    groupId: 'group_project_beta',
    assigneeId: 'user_dev_taro',
    priority: 'high',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)), // 6日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_beta_002',
    title: '改善提案書作成',
    content: 'システム改善のための具体的な提案書作成',
    groupId: 'group_project_beta',
    assigneeId: 'user_consult_saburo',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)), // 15日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// 新しいカレンダーイベントデータ
const newEvents = [
  {
    id: 'event_dev_meeting',
    title: '開発チーム定例会議',
    description: '週次開発進捗の確認と課題の共有',
    userId: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    groupId: 'group_development_team',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 明日
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000)), // 明日の1時間後
    color: '#3b82f6',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_sales_strategy',
    title: '営業戦略会議',
    description: '四半期営業戦略の見直しと計画策定',
    userId: 'user_sales_jiro',
    groupId: 'group_sales_team',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // 明後日
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)), // 明後日の2時間後
    color: '#ef4444',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_consult_presentation',
    title: 'クライアントプレゼンテーション',
    description: '新規プロジェクトの提案プレゼンテーション',
    userId: 'user_consult_saburo',
    groupId: 'group_consulting_team',
    type: 'presentation',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3日後
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000)), // 3日後の1.5時間後
    color: '#22c55e',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_management_meeting',
    title: '経営会議',
    description: '全社的な戦略と方針についての会議',
    userId: 'AFlesJZUw0eMkDgtCbatIUjRNfR2',
    groupId: 'group_management_team',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 1週間後
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)), // 1週間後の3時間後
    color: '#a855f7',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_project_alpha_kickoff',
    title: 'プロジェクトAlpha キックオフ',
    description: '新規プロジェクトの開始会議',
    userId: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    groupId: 'group_project_alpha',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5日後
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)), // 5日後の2時間後
    color: '#f59e0b',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_project_beta_review',
    title: 'プロジェクトBeta レビュー',
    description: '既存システム改善プロジェクトの進捗確認',
    userId: 'user_dev_taro',
    groupId: 'group_project_beta',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000)), // 9日後
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 9 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000)), // 9日後の1.5時間後
    color: '#6366f1',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// 新しいアナウンスメントデータ
const newAnnouncements = [
  {
    id: 'announcement_dev_001',
    title: '開発環境のメンテナンスについて',
    content: '来週月曜日の深夜2:00-4:00に開発環境のメンテナンスを実施します。',
    groupId: 'group_development_team',
    createdBy: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_sales_001',
    title: '営業目標の更新',
    content: '今四半期の営業目標を20%上方修正しました。チーム一丸となって取り組みましょう。',
    groupId: 'group_sales_team',
    createdBy: 'user_sales_jiro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_consult_001',
    title: '新規クライアント獲得',
    content: '大手企業との契約が正式に決定しました。おめでとうございます！',
    groupId: 'group_consulting_team',
    createdBy: 'user_consult_saburo',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_mgmt_001',
    title: '全社イベントの開催',
    content: '来月、全社イベントを開催予定です。詳細は後日お知らせします。',
    groupId: 'group_management_team',
    createdBy: 'AFlesJZUw0eMkDgtCbatIUjRNfR2',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_alpha_001',
    title: 'プロジェクトAlpha 開始',
    content: '新規システム開発プロジェクトが正式に開始されました。',
    groupId: 'group_project_alpha',
    createdBy: 'o1hDLgu2jGb0t26HULCfSS4118t2',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_beta_001',
    title: 'プロジェクトBeta 進捗報告',
    content: '既存システム改善プロジェクトの進捗が順調です。',
    groupId: 'group_project_beta',
    createdBy: 'user_dev_taro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function createNewTestData() {
  try {
    console.log('新しいテストデータの作成を開始します...\n');

    // 1. グループを作成
    console.log('グループを作成中...');
    for (const group of newGroups) {
      await db.collection('groups').doc(group.id).set(group);
      console.log(`グループ作成完了: ${group.name}`);
    }

    // 2. グループメンバーシップを作成
    console.log('\nグループメンバーシップを作成中...');
    for (const membership of groupMemberships) {
      await db.collection('groupMemberships').add(membership);
      console.log(`メンバーシップ作成完了: ${membership.userId} -> ${membership.groupId}`);
    }

    // 3. 課題を作成
    console.log('\n課題を作成中...');
    for (const task of newTasks) {
      await db.collection('tasks').doc(task.id).set(task);
      console.log(`課題作成完了: ${task.title}`);
    }

    // 4. カレンダーイベントを作成
    console.log('\nカレンダーイベントを作成中...');
    for (const event of newEvents) {
      await db.collection('calendarEvents').doc(event.id).set(event);
      console.log(`イベント作成完了: ${event.title}`);
    }

    // 5. アナウンスメントを作成
    console.log('\nアナウンスメントを作成中...');
    for (const announcement of newAnnouncements) {
      await db.collection('announcements').doc(announcement.id).set(announcement);
      console.log(`アナウンスメント作成完了: ${announcement.title}`);
    }

    console.log('\n✅ 新しいテストデータの作成が完了しました！');
    console.log('\n作成されたデータ:');
    console.log(`- グループ: ${newGroups.length}個`);
    console.log(`- メンバーシップ: ${groupMemberships.length}個`);
    console.log(`- 課題: ${newTasks.length}個`);
    console.log(`- カレンダーイベント: ${newEvents.length}個`);
    console.log(`- アナウンスメント: ${newAnnouncements.length}個`);

    console.log('\n=== グループ構成 ===');
    newGroups.forEach(group => {
      console.log(`- ${group.name} (${group.department})`);
    });

  } catch (error) {
    console.error('❌ テストデータの作成中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

// スクリプト実行
createNewTestData();

