const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Firebase Admin SDKの初期化
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// サンプルユーザーデータ
const sampleUsers = [
  {
    uid: 'user_dev_taro',
    email: 'kaihatsu@pathoslogos.co.jp',
    displayName: '開発 太郎',
    department: 'development',
    role: 'user',
    photoURL: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    uid: 'user_sales_jiro',
    email: 'eigyou@pathoslogos.co.jp',
    displayName: '営業 次郎',
    department: 'sales',
    role: 'user',
    photoURL: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    uid: 'user_consult_saburo',
    email: 'konsal@pathoslogos.co.jp',
    displayName: 'コンサル 三郎',
    department: 'consulting',
    role: 'user',
    photoURL: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// サンプルグループデータ
const sampleGroups = [
  {
    id: 'group_dev_team',
    name: '開発チーム',
    description: 'システム開発を担当するチーム',
    department: 'development',
    createdBy: 'user_dev_taro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 2
  },
  {
    id: 'group_sales_team',
    name: '営業チーム',
    description: '営業活動を担当するチーム',
    department: 'sales',
    createdBy: 'user_sales_jiro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 1
  },
  {
    id: 'group_consulting_team',
    name: 'コンサルティングチーム',
    description: 'コンサルティング業務を担当するチーム',
    department: 'consulting',
    createdBy: 'user_consult_saburo',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    memberCount: 1
  },
  {
    id: 'group_cross_functional',
    name: 'クロスファンクショナルチーム',
    description: '複数部門が参加するプロジェクトチーム',
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
  { groupId: 'group_dev_team', userId: 'user_dev_taro', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_dev_team', userId: 'user_consult_saburo', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // 営業チーム
  { groupId: 'group_sales_team', userId: 'user_sales_jiro', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // コンサルティングチーム
  { groupId: 'group_consulting_team', userId: 'user_consult_saburo', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  
  // クロスファンクショナルチーム
  { groupId: 'group_cross_functional', userId: 'user_dev_taro', role: 'admin', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_cross_functional', userId: 'user_sales_jiro', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() },
  { groupId: 'group_cross_functional', userId: 'user_consult_saburo', role: 'member', joinedAt: admin.firestore.FieldValue.serverTimestamp() }
];

// サンプル課題データ
const sampleTasks = [
  // 開発チームの課題
  {
    id: 'task_dev_1',
    title: 'ユーザー認証機能の実装',
    content: 'Firebase Authenticationを使用したユーザー認証機能を実装する',
    groupId: 'group_dev_team',
    assigneeId: 'user_dev_taro',
    priority: 'high',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 1週間後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_dev_2',
    title: 'データベース設計の見直し',
    content: 'パフォーマンス向上のためのデータベース設計を見直す',
    groupId: 'group_dev_team',
    assigneeId: 'user_consult_saburo',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), // 2週間後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'task_dev_3',
    title: 'API仕様書の作成',
    content: 'REST APIの仕様書を作成し、開発チームに共有する',
    groupId: 'group_dev_team',
    assigneeId: 'user_dev_taro',
    priority: 'urgent',
    status: 'completed',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)), // 2日前
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // 営業チームの課題
  {
    id: 'task_sales_1',
    title: '新規顧客開拓',
    content: '潜在顧客リストを作成し、アプローチ計画を立てる',
    groupId: 'group_sales_team',
    assigneeId: 'user_sales_jiro',
    priority: 'high',
    status: 'in_progress',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)), // 5日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // コンサルティングチームの課題
  {
    id: 'task_consult_1',
    title: 'クライアント向け提案書作成',
    content: '新規プロジェクトの提案書を作成し、プレゼンテーション準備を行う',
    groupId: 'group_consulting_team',
    assigneeId: 'user_consult_saburo',
    priority: 'urgent',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  
  // クロスファンクショナルチームの課題
  {
    id: 'task_cross_1',
    title: '新サービス企画会議',
    content: '新サービスの企画について、各部門の意見をまとめる',
    groupId: 'group_cross_functional',
    assigneeId: 'user_dev_taro',
    priority: 'medium',
    status: 'pending',
    dueDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)), // 10日後
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// サンプルカレンダーイベントデータ
const sampleEvents = [
  {
    id: 'event_dev_1',
    title: '開発チーム定例会議',
    description: '週次開発進捗の確認と課題の共有',
    userId: 'user_dev_taro',
    groupId: 'group_dev_team',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 明日
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000)), // 明日の1時間後
    color: '#3b82f6',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'event_sales_1',
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
    id: 'event_consult_1',
    title: 'クライアントプレゼン',
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
    id: 'event_cross_1',
    title: '全社ミーティング',
    description: '全社的な情報共有と今後の方針について',
    userId: 'user_dev_taro',
    groupId: 'group_cross_functional',
    type: 'meeting',
    startDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 1週間後
    endDate: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)), // 1週間後の3時間後
    color: '#a855f7',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// サンプルアナウンスメントデータ
const sampleAnnouncements = [
  {
    id: 'announcement_1',
    title: '新システムリリースのお知らせ',
    content: '来月1日に新システムがリリースされます。詳細は後日共有いたします。',
    groupId: 'group_dev_team',
    createdBy: 'user_dev_taro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_2',
    title: '営業目標の更新',
    content: '今四半期の営業目標を更新しました。チーム一丸となって取り組みましょう。',
    groupId: 'group_sales_team',
    createdBy: 'user_sales_jiro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    id: 'announcement_3',
    title: '全社イベントの開催',
    content: '来月、全社イベントを開催予定です。詳細は後日お知らせします。',
    groupId: 'group_cross_functional',
    createdBy: 'user_dev_taro',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function createSampleData() {
  try {
    console.log('サンプルデータの作成を開始します...');

    // 1. ユーザーを作成（Firebase Authentication + Firestore）
    console.log('ユーザーを作成中...');
    for (const user of sampleUsers) {
      try {
        // Firebase Authenticationでユーザーを作成
        const userRecord = await admin.auth().createUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          password: 'password123' // デフォルトパスワード
        });
        
        // Firestoreにユーザー情報を保存
        await db.collection('users').doc(user.uid).set(user);
        console.log(`ユーザー作成完了: ${user.displayName} (パスワード: password123)`);
      } catch (error) {
        if (error.code === 'auth/uid-already-exists') {
          console.log(`ユーザー既存: ${user.displayName}`);
        } else {
          console.error(`ユーザー作成エラー: ${user.displayName}`, error);
        }
      }
    }

    // 2. グループを作成
    console.log('グループを作成中...');
    for (const group of sampleGroups) {
      await db.collection('groups').doc(group.id).set(group);
      console.log(`グループ作成完了: ${group.name}`);
    }

    // 3. グループメンバーシップを作成
    console.log('グループメンバーシップを作成中...');
    for (const membership of groupMemberships) {
      await db.collection('groupMemberships').add(membership);
      console.log(`メンバーシップ作成完了: ${membership.userId} -> ${membership.groupId}`);
    }

    // 4. 課題を作成
    console.log('課題を作成中...');
    for (const task of sampleTasks) {
      await db.collection('tasks').doc(task.id).set(task);
      console.log(`課題作成完了: ${task.title}`);
    }

    // 5. カレンダーイベントを作成
    console.log('カレンダーイベントを作成中...');
    for (const event of sampleEvents) {
      await db.collection('calendarEvents').doc(event.id).set(event);
      console.log(`イベント作成完了: ${event.title}`);
    }

    // 6. アナウンスメントを作成
    console.log('アナウンスメントを作成中...');
    for (const announcement of sampleAnnouncements) {
      await db.collection('announcements').doc(announcement.id).set(announcement);
      console.log(`アナウンスメント作成完了: ${announcement.title}`);
    }

    console.log('✅ サンプルデータの作成が完了しました！');
    console.log('\n作成されたデータ:');
    console.log(`- ユーザー: ${sampleUsers.length}人`);
    console.log(`- グループ: ${sampleGroups.length}個`);
    console.log(`- 課題: ${sampleTasks.length}個`);
    console.log(`- カレンダーイベント: ${sampleEvents.length}個`);
    console.log(`- アナウンスメント: ${sampleAnnouncements.length}個`);

  } catch (error) {
    console.error('❌ サンプルデータの作成中にエラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

// スクリプト実行
createSampleData();
