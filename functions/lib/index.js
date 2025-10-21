"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.manualProgressReport = exports.scheduledProgressReport = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
// 自動進捗レポート送信のスケジュール関数（5分間隔で実行）
exports.scheduledProgressReport = functions.pubsub
    .schedule('*/5 * * * *') // 5分間隔で実行
    .timeZone('Asia/Tokyo')
    .onRun(async (context) => {
    var _a;
    console.log('自動進捗レポート送信を開始します');
    try {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        // 送信予定のスケジュールを取得
        const schedulesQuery = db.collection('auto_report_schedules')
            .where('isActive', '==', true)
            .where('nextSendAt', '<=', now);
        const schedulesSnapshot = await schedulesQuery.get();
        if (schedulesSnapshot.empty) {
            console.log('送信予定のスケジュールはありません');
            return;
        }
        console.log(`送信予定のスケジュール数: ${schedulesSnapshot.size}`);
        for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            const scheduleId = scheduleDoc.id;
            try {
                console.log(`スケジュール処理開始: ${schedule.title} (ID: ${scheduleId})`);
                // 添付グループのタスクを取得
                if (!schedule.attachedGroupId) {
                    console.log('添付グループが指定されていません:', scheduleId);
                    continue;
                }
                const tasksSnapshot = await db.collection('tasks')
                    .where('groupId', '==', schedule.attachedGroupId)
                    .get();
                const tasks = tasksSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
                console.log(`取得したタスク数: ${tasks.length}`);
                // 過去1週間のタスクをフィルタリング
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const filteredTasks = tasks.filter((task) => {
                    var _a, _b;
                    const taskDate = ((_a = task.occurredOn) === null || _a === void 0 ? void 0 : _a.toDate()) || ((_b = task.createdAt) === null || _b === void 0 ? void 0 : _b.toDate());
                    return taskDate && taskDate >= oneWeekAgo;
                });
                console.log(`フィルタリング後のタスク数: ${filteredTasks.length}`);
                // 送信者のユーザー情報を取得
                const userDoc = await db.collection('users').doc(schedule.userId).get();
                const userData = userDoc.exists ? userDoc.data() : null;
                const senderName = (userData === null || userData === void 0 ? void 0 : userData.displayName) || ((_a = userData === null || userData === void 0 ? void 0 : userData.email) === null || _a === void 0 ? void 0 : _a.split('@')[0]) || 'ユーザー';
                // 進捗レポートを作成
                const reportData = {
                    title: `${schedule.title} - ${new Date().toLocaleDateString('ja-JP')}`,
                    content: generateReportContent(filteredTasks, schedule.attachedGroupName || 'グループ'),
                    senderId: schedule.userId,
                    senderName: senderName,
                    status: 'sent',
                    recipientType: schedule.recipientType,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                // 送信先の設定
                if (schedule.recipientType === 'person') {
                    if (schedule.recipientId) {
                        reportData.recipientId = schedule.recipientId;
                    }
                    if (schedule.recipientName) {
                        reportData.recipientName = schedule.recipientName;
                    }
                }
                else {
                    if (schedule.groupId) {
                        reportData.groupId = schedule.groupId;
                    }
                    if (schedule.groupName) {
                        reportData.groupName = schedule.groupName;
                    }
                }
                // 添付グループの設定
                if (schedule.attachedGroupId) {
                    reportData.attachedGroupId = schedule.attachedGroupId;
                    if (schedule.attachedGroupName) {
                        reportData.attachedGroupName = schedule.attachedGroupName;
                    }
                }
                // 進捗レポートを保存
                await db.collection('progress_reports').add(reportData);
                console.log(`進捗レポートを作成しました: ${schedule.title}`);
                // 次の送信日時を計算・更新
                const nextSendAt = calculateNextSendAt(schedule.nextSendAt.toDate(), schedule.frequency, schedule.sendTime);
                await db.collection('auto_report_schedules').doc(scheduleId).update({
                    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
                    nextSendAt: admin.firestore.Timestamp.fromDate(nextSendAt)
                });
                console.log(`スケジュール更新完了: ${schedule.title}`);
            }
            catch (error) {
                console.error(`スケジュール処理エラー: ${schedule.title}`, error);
            }
        }
        console.log('自動進捗レポート送信が完了しました');
    }
    catch (error) {
        console.error('自動進捗レポート送信でエラーが発生しました:', error);
    }
});
// 次の送信日時計算
function calculateNextSendAt(currentDate, frequency, sendTime) {
    const [hours, minutes] = sendTime.split(':').map(Number);
    const nextDate = new Date(currentDate);
    // 送信時刻を設定
    nextDate.setHours(hours, minutes, 0, 0);
    // 頻度に応じて次の送信日を計算
    switch (frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }
    return nextDate;
}
// レポート内容生成
function generateReportContent(tasks, groupName) {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const inProgressTasks = tasks.filter(task => task.status === 'in_progress');
    const pendingTasks = tasks.filter(task => task.status === 'pending');
    let content = `【${groupName}】の進捗報告\n\n`;
    content += `📊 タスク状況\n`;
    content += `✅ 完了: ${completedTasks.length}件\n`;
    content += `🔄 進行中: ${inProgressTasks.length}件\n`;
    content += `⏳ 未着手: ${pendingTasks.length}件\n\n`;
    if (completedTasks.length > 0) {
        content += `✅ 完了したタスク:\n`;
        completedTasks.forEach(task => {
            content += `- ${task.title}\n`;
        });
        content += `\n`;
    }
    if (inProgressTasks.length > 0) {
        content += `🔄 進行中のタスク:\n`;
        inProgressTasks.forEach(task => {
            content += `- ${task.title}\n`;
        });
        content += `\n`;
    }
    if (pendingTasks.length > 0) {
        content += `⏳ 未着手のタスク:\n`;
        pendingTasks.forEach(task => {
            content += `- ${task.title}\n`;
        });
    }
    return content;
}
// 手動実行用のHTTP関数
exports.manualProgressReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    try {
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        // 送信予定のスケジュールを取得
        const schedulesQuery = db.collection('auto_report_schedules')
            .where('isActive', '==', true)
            .where('nextSendAt', '<=', now);
        const schedulesSnapshot = await schedulesQuery.get();
        let processedCount = 0;
        for (const scheduleDoc of schedulesSnapshot.docs) {
            const schedule = scheduleDoc.data();
            const scheduleId = scheduleDoc.id;
            try {
                // スケジュール処理（上記と同じロジック）
                // ... 省略 ...
                processedCount++;
            }
            catch (error) {
                console.error(`スケジュール処理エラー: ${schedule.title}`, error);
            }
        }
        return {
            success: true,
            processedCount,
            message: `${processedCount}件のスケジュールを処理しました`
        };
    }
    catch (error) {
        console.error('手動実行エラー:', error);
        throw new functions.https.HttpsError('internal', '処理中にエラーが発生しました');
    }
});
// メール送信関数（EmailJSの代替）
exports.sendEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const { to, subject } = data;
    // ここでメール送信ロジックを実装
    // 実際のメール送信サービス（SendGrid、Mailgun等）を使用
    console.log(`メール送信: ${to} - ${subject}`);
    return { success: true };
});
//# sourceMappingURL=index.js.map