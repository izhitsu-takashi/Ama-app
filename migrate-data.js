// Firestoreデータ移行スクリプト
// 使用方法: node migrate-data.js

const admin = require('firebase-admin');

// 元のプロジェクトの設定
const sourceConfig = {
  projectId: 'ama-app-d1194',
  // サービスアカウントキーが必要
};

// 新しいプロジェクトの設定
const targetConfig = {
  projectId: 'kensyu10117',
  // サービスアカウントキーが必要
};

async function migrateData() {
  try {
    // 元のプロジェクトに接続
    const sourceApp = admin.initializeApp({
      ...sourceConfig,
      credential: admin.credential.applicationDefault()
    }, 'source');
    
    const sourceDb = admin.firestore(sourceApp);
    
    // 新しいプロジェクトに接続
    const targetApp = admin.initializeApp({
      ...targetConfig,
      credential: admin.credential.applicationDefault()
    }, 'target');
    
    const targetDb = admin.firestore(targetApp);
    
    // 移行するコレクション
    const collections = [
      'users',
      'groups', 
      'group_memberships',
      'tasks',
      'progress_reports',
      'messages',
      'auto_report_schedules'
    ];
    
    for (const collectionName of collections) {
      console.log(`移行中: ${collectionName}`);
      
      const snapshot = await sourceDb.collection(collectionName).get();
      const batch = targetDb.batch();
      
      snapshot.forEach(doc => {
        const newDocRef = targetDb.collection(collectionName).doc(doc.id);
        batch.set(newDocRef, doc.data());
      });
      
      await batch.commit();
      console.log(`${collectionName}: ${snapshot.size} 件のドキュメントを移行しました`);
    }
    
    console.log('データ移行が完了しました');
    
  } catch (error) {
    console.error('移行エラー:', error);
  }
}

// migrateData();
console.log('このスクリプトを実行するには、サービスアカウントキーを設定してください');
