const admin = require('firebase-admin');

// Firebase Admin SDKの初期化
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsers() {
  try {
    console.log('現在のユーザー情報を確認中...\n');

    // Firestoreのusersコレクションからユーザーを取得
    const usersSnapshot = await db.collection('users').get();
    console.log('=== Firestore Users ===');
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${user.displayName}`);
      console.log(`Email: ${user.email}`);
      console.log(`Department: ${user.department}`);
      console.log(`Role: ${user.role}`);
      console.log('---');
    });

    // Firebase Authenticationのユーザーを取得
    console.log('\n=== Firebase Auth Users ===');
    const listUsersResult = await admin.auth().listUsers();
    listUsersResult.users.forEach(userRecord => {
      console.log(`UID: ${userRecord.uid}`);
      console.log(`Email: ${userRecord.email}`);
      console.log(`Display Name: ${userRecord.displayName}`);
      console.log(`Created: ${userRecord.metadata.creationTime}`);
      console.log('---');
    });

    console.log(`\n合計ユーザー数: ${listUsersResult.users.length}人`);

  } catch (error) {
    console.error('ユーザー確認エラー:', error);
  } finally {
    process.exit(0);
  }
}

checkUsers();

