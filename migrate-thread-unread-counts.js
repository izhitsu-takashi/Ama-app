const admin = require('firebase-admin');

// サービスアカウントキーを読み込み
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateThreadUnreadCounts() {
  try {
    console.log('スレッドの未読数を新しい形式に移行中...');
    
    // すべてのメッセージスレッドを取得
    const threadsSnapshot = await db.collection('messageThreads').get();
    
    console.log(`見つかったスレッド数: ${threadsSnapshot.size}`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    threadsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // unreadCountsフィールドが存在しない場合は追加
      if (!data.unreadCounts) {
        console.log(`スレッド ${doc.id} にunreadCountsフィールドを追加`);
        
        // 既存のunreadCountを各参加者に均等分配（後方互換性のため）
        const participants = data.participants || [];
        const oldUnreadCount = data.unreadCount || 0;
        const unreadCounts = {};
        
        // 各参加者の未読数を0に初期化
        participants.forEach(participantId => {
          unreadCounts[participantId] = 0;
        });
        
        batch.update(doc.ref, {
          unreadCounts: unreadCounts,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(`${updateCount}個のスレッドを更新しました`);
    } else {
      console.log('更新が必要なスレッドはありませんでした');
    }
    
    // 更新後のデータを確認
    console.log('\n更新後のスレッドデータ:');
    const updatedSnapshot = await db.collection('messageThreads').get();
    updatedSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`スレッド ${doc.id}:`);
      console.log(`  participants: ${data.participants}`);
      console.log(`  unreadCounts:`, data.unreadCounts);
      console.log(`  unreadCount: ${data.unreadCount || 0}`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

migrateThreadUnreadCounts();
