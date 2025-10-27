const admin = require('firebase-admin');

// サービスアカウントキーを読み込み
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixMessageThreads() {
  try {
    console.log('メッセージスレッドの未読数を修正中...');
    
    // すべてのメッセージスレッドを取得
    const threadsSnapshot = await db.collection('messageThreads').get();
    
    console.log(`見つかったスレッド数: ${threadsSnapshot.size}`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    threadsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // unreadCountフィールドが存在しない場合は0に設定
      if (data.unreadCount === undefined) {
        console.log(`スレッド ${doc.id} にunreadCountフィールドを追加`);
        batch.update(doc.ref, {
          unreadCount: 0,
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
      console.log(`スレッド ${doc.id}: unreadCount=${data.unreadCount || 0}`);
    });
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    process.exit(0);
  }
}

fixMessageThreads();
