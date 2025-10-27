// 学習機能テスト用のサンプルデータ作成スクリプト
// Firebase Console の Firestore で実行してください

// 1. サンプルグループデータ
const sampleGroups = [
  {
    name: "Webアプリ開発プロジェクト",
    description: "ReactとNode.jsを使用したWebアプリケーション開発",
    memberIds: ["user1", "user2", "user3"],
    isPublic: true,
    createdAt: new Date(),
    createdBy: "user1"
  },
  {
    name: "モバイルアプリ開発",
    description: "React Nativeを使用したモバイルアプリケーション開発",
    memberIds: ["user2", "user3", "user4"],
    isPublic: true,
    createdAt: new Date(),
    createdBy: "user2"
  },
  {
    name: "研究・調査プロジェクト",
    description: "AI技術の調査と研究を行うプロジェクト",
    memberIds: ["user1", "user4"],
    isPublic: true,
    createdAt: new Date(),
    createdBy: "user1"
  },
  {
    name: "イベント企画",
    description: "技術カンファレンスの企画と運営",
    memberIds: ["user2", "user3", "user4", "user5"],
    isPublic: true,
    createdAt: new Date(),
    createdBy: "user2"
  }
];

// 2. サンプルタスクデータ
const sampleTasks = [
  // Webアプリ開発関連
  {
    title: "システム設計書の作成",
    description: "アーキテクチャ設計とデータベース設計を含むシステム設計書を作成する",
    priority: "high",
    status: "completed",
    assigneeId: "user1",
    groupId: "group1",
    dueDate: new Date(),
    estimatedDays: 5,
    category: "設計・設計書"
  },
  {
    title: "フロントエンド実装",
    description: "Reactコンポーネントの実装とUI/UXの開発",
    priority: "high",
    status: "completed",
    assigneeId: "user2",
    groupId: "group1",
    dueDate: new Date(),
    estimatedDays: 10,
    category: "開発・実装"
  },
  {
    title: "バックエンドAPI開発",
    description: "Node.jsとExpressを使用したRESTful APIの開発",
    priority: "high",
    status: "in_progress",
    assigneeId: "user3",
    groupId: "group1",
    dueDate: new Date(),
    estimatedDays: 8,
    category: "開発・実装"
  },
  {
    title: "ユニットテストの実装",
    description: "Jestを使用したユニットテストの実装とテストカバレッジの向上",
    priority: "medium",
    status: "not_started",
    assigneeId: "user1",
    groupId: "group1",
    dueDate: new Date(),
    estimatedDays: 3,
    category: "テスト・検証"
  },
  
  // モバイルアプリ開発関連
  {
    title: "モバイルアプリ設計",
    description: "React Nativeを使用したモバイルアプリの設計とプロトタイプ作成",
    priority: "high",
    status: "completed",
    assigneeId: "user2",
    groupId: "group2",
    dueDate: new Date(),
    estimatedDays: 7,
    category: "設計・設計書"
  },
  {
    title: "UI/UXデザイン",
    description: "モバイルアプリのUI/UXデザインとプロトタイプの作成",
    priority: "high",
    status: "completed",
    assigneeId: "user3",
    groupId: "group2",
    dueDate: new Date(),
    estimatedDays: 6,
    category: "デザイン・UI/UX"
  },
  {
    title: "ネイティブ機能実装",
    description: "カメラ、位置情報などのネイティブ機能の実装",
    priority: "medium",
    status: "in_progress",
    assigneeId: "user4",
    groupId: "group2",
    dueDate: new Date(),
    estimatedDays: 12,
    category: "開発・実装"
  },
  
  // 研究・調査関連
  {
    title: "AI技術調査",
    description: "最新のAI技術とフレームワークの調査と比較分析",
    priority: "high",
    status: "completed",
    assigneeId: "user1",
    groupId: "group3",
    dueDate: new Date(),
    estimatedDays: 5,
    category: "調査・研究"
  },
  {
    title: "プロトタイプ開発",
    description: "調査結果を基にしたAI機能のプロトタイプ開発",
    priority: "medium",
    status: "in_progress",
    assigneeId: "user4",
    groupId: "group3",
    dueDate: new Date(),
    estimatedDays: 8,
    category: "開発・実装"
  },
  
  // イベント企画関連
  {
    title: "イベント企画書作成",
    description: "技術カンファレンスの企画書とスケジュールの作成",
    priority: "high",
    status: "completed",
    assigneeId: "user2",
    groupId: "group4",
    dueDate: new Date(),
    estimatedDays: 4,
    category: "企画・計画"
  },
  {
    title: "会場手配",
    description: "イベント会場の選定と予約手配",
    priority: "high",
    status: "completed",
    assigneeId: "user3",
    groupId: "group4",
    dueDate: new Date(),
    estimatedDays: 3,
    category: "企画・計画"
  },
  {
    title: "講演者募集",
    description: "技術講演者の募集とスケジュール調整",
    priority: "medium",
    status: "in_progress",
    assigneeId: "user4",
    groupId: "group4",
    dueDate: new Date(),
    estimatedDays: 7,
    category: "企画・計画"
  }
];

console.log("サンプルデータ:");
console.log("Groups:", sampleGroups);
console.log("Tasks:", sampleTasks);

// Firebase Console で以下のコマンドを実行してください:
// 1. Firestore Database に移動
// 2. 各コレクション（groups, tasks）に上記のデータを追加
// 3. グループIDは適切に設定してください（group1, group2, group3, group4）



