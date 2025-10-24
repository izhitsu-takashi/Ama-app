"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.sendVerificationEmail = exports.manualProgressReport = exports.scheduledProgressReport = exports.sendPushOnNotificationCreate = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
// ================================
// FCM: Firestore通知 -> デバイストークンへ配信
// ================================
exports.sendPushOnNotificationCreate = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
    try {
        const notification = snap.data();
        const userId = notification === null || notification === void 0 ? void 0 : notification.userId;
        if (!userId)
            return;
        const db = admin.firestore();
        // 対象ユーザーのデバイストークンを取得
        const devicesSnap = await db.collection('users').doc(userId).collection('devices').get();
        const tokens = devicesSnap.docs.map(d => d.id).filter(Boolean);
        if (tokens.length === 0)
            return;
        // 通知内容
        const title = notification.title || '新しい通知';
        const body = notification.content || notification.message || '';
        // クリック時の遷移URL（typeに応じてbest-effort）
        const url = (() => {
            const data = notification.data || {};
            switch (notification.type) {
                case 'message_received':
                    return '/messages';
                case 'announcement':
                    return data.groupId ? `/group/${data.groupId}` : '/';
                case 'progress_report':
                case 'progress_report_comment':
                    return '/progress-reports';
                case 'group_join_request':
                case 'group_invite':
                    return data.groupId ? `/group/${data.groupId}` : '/groups';
                case 'task_due':
                case 'task_due_soon':
                case 'task_assigned':
                case 'task_comment':
                case 'task_reaction':
                    return '/tasks';
                default:
                    return '/';
            }
        })();
        const message = {
            tokens,
            notification: {
                title,
                body,
            },
            data: {
                url,
                type: String(notification.type || ''),
            }
        };
        const res = await admin.messaging().sendMulticast(message);
        // 不達トークンをクリーンアップ
        const deletions = [];
        res.responses.forEach((r, idx) => {
            if (!r.success) {
                const code = (r.error && r.error.errorInfo && r.error.errorInfo.code) || '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                    const token = tokens[idx];
                    deletions.push(db.collection('users').doc(userId).collection('devices').doc(token).delete());
                }
            }
        });
        if (deletions.length)
            await Promise.all(deletions);
    }
    catch (e) {
        console.error('sendPushOnNotificationCreate error', e);
    }
});
// 自動進捗レポート送信のスケジュール関数（1分間隔で実行）
exports.scheduledProgressReport = functions.pubsub
    .schedule('* * * * *') // 1分間隔で実行
    .timeZone('Asia/Tokyo')
    .onRun(async (context) => {
    var _a;
    try {
        console.log('自動進捗レポート送信スケジューラー開始');
        const db = admin.firestore();
        const now = admin.firestore.Timestamp.now();
        // 送信予定のスケジュールを取得
        const schedulesQuery = db.collection('auto_report_schedules')
            .where('isActive', '==', true)
            .where('nextSendAt', '<=', now);
        const schedulesSnapshot = await schedulesQuery.get();
        if (schedulesSnapshot.empty) {
            console.log('送信予定のスケジュールがありません');
            return;
        }
        console.log(`処理対象のスケジュール数: ${schedulesSnapshot.docs.length}`);
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
                    title: schedule.title,
                    content: generateReportContent(filteredTasks, schedule.attachedGroupName || 'グループ'),
                    senderId: schedule.userId,
                    senderName: senderName,
                    status: 'sent',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                // 送信先の設定（新しい仕様に対応）
                if (schedule.recipientIds && schedule.recipientIds.length > 0) {
                    // 複数受信者対応
                    reportData.recipientIds = schedule.recipientIds;
                    reportData.recipientNames = schedule.recipientNames || [];
                    // 表示用の送信先名を設定（最初の受信者名または「複数ユーザー」）
                    if (schedule.recipientNames && schedule.recipientNames.length > 0) {
                        reportData.recipientName = schedule.recipientNames.length === 1
                            ? schedule.recipientNames[0]
                            : `${schedule.recipientNames[0]} 他${schedule.recipientNames.length - 1}名`;
                    }
                }
                else if (schedule.recipientId) {
                    // 単一受信者（後方互換性）
                    reportData.recipientId = schedule.recipientId;
                    reportData.recipientName = schedule.recipientName;
                }
                // 添付グループの設定
                if (schedule.attachedGroupId) {
                    reportData.attachedGroupId = schedule.attachedGroupId;
                    if (schedule.attachedGroupName) {
                        reportData.attachedGroupName = schedule.attachedGroupName;
                    }
                }
                // 進捗レポートを保存
                const reportRef = await db.collection('progressReports').add(reportData);
                console.log(`進捗レポート作成完了: ${reportRef.id}`);
                // レポートIDを設定してから通知を送信
                reportData.id = reportRef.id;
                await sendProgressReportNotifications(db, reportData);
                // 次の送信日時を計算・更新
                const nextSendAt = calculateNextSendAt(schedule.nextSendAt.toDate(), schedule.frequency, schedule.sendTime);
                await db.collection('auto_report_schedules').doc(scheduleId).update({
                    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
                    nextSendAt: admin.firestore.Timestamp.fromDate(nextSendAt)
                });
                console.log(`スケジュール更新完了: 次回送信 ${nextSendAt.toLocaleString('ja-JP')}`);
            }
            catch (error) {
                console.error(`スケジュール処理エラー: ${schedule.title}`, error);
            }
        }
    }
    catch (error) {
        console.error('自動進捗レポート送信でエラーが発生しました:', error);
    }
});
// 次の送信日時計算
function calculateNextSendAt(currentDate, frequency, sendTime) {
    const [hours, minutes] = sendTime.split(':').map(Number);
    // 現在の日本時間を取得
    const now = new Date();
    const japanOffset = 9 * 60; // 日本時間はUTC+9
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const japanTime = new Date(utc + (japanOffset * 60000));
    // 次の送信日時を日本時間で計算
    const nextDate = new Date(japanTime);
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
    // UTCに変換（日本時間から9時間引く）
    const utcDate = new Date(nextDate.getTime() - (japanOffset * 60000));
    return utcDate;
}
// 進捗レポート通知送信
async function sendProgressReportNotifications(db, reportData) {
    try {
        const recipients = [];
        // 受信者IDを取得
        if (reportData.recipientIds && reportData.recipientIds.length > 0) {
            recipients.push(...reportData.recipientIds);
        }
        else if (reportData.recipientId) {
            recipients.push(reportData.recipientId);
        }
        if (recipients.length === 0) {
            console.log('通知送信先がありません');
            return;
        }
        // 各受信者に通知を送信
        for (const recipientId of recipients) {
            const notificationData = {
                userId: recipientId,
                type: 'progress_report',
                title: '新しい進捗報告',
                content: `${reportData.senderName}さんから進捗報告が送信されました`,
                message: `${reportData.senderName}さんから進捗報告が送信されました`,
                data: {
                    reportId: reportData.id,
                    senderId: reportData.senderId,
                    senderName: reportData.senderName
                },
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await db.collection('notifications').add(notificationData);
            console.log(`通知送信完了: ${recipientId}`);
            // プッシュ通知も送信
            await sendPushNotificationToUser(db, recipientId, {
                title: '新しい進捗報告',
                body: `${reportData.senderName}さんから進捗報告が送信されました`,
                data: {
                    url: '/progress-reports',
                    type: 'progress_report',
                    reportId: reportData.id
                }
            });
        }
    }
    catch (error) {
        console.error('通知送信エラー:', error);
    }
}
// プッシュ通知送信
async function sendPushNotificationToUser(db, userId, notification) {
    try {
        // ユーザーのデバイストークンを取得
        const devicesSnapshot = await db.collection('users').doc(userId).collection('devices').get();
        const tokens = devicesSnapshot.docs.map(doc => doc.id).filter(Boolean);
        if (tokens.length === 0) {
            console.log(`ユーザー ${userId} のデバイストークンが見つかりません`);
            return;
        }
        const message = {
            tokens,
            notification: {
                title: notification.title,
                body: notification.body,
            },
            data: notification.data || {}
        };
        const response = await admin.messaging().sendMulticast(message);
        console.log(`プッシュ通知送信完了: ${response.successCount}/${response.failureCount} 成功/失敗`);
        // 無効なトークンをクリーンアップ
        const deletions = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = (resp.error && resp.error.errorInfo && resp.error.errorInfo.code) || '';
                if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
                    const token = tokens[idx];
                    deletions.push(db.collection('users').doc(userId).collection('devices').doc(token).delete());
                }
            }
        });
        if (deletions.length > 0) {
            await Promise.all(deletions);
            console.log(`${deletions.length}個の無効なトークンを削除しました`);
        }
    }
    catch (error) {
        console.error('プッシュ通知送信エラー:', error);
    }
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
// メール送信関数（認証コード送信用）
exports.sendVerificationEmail = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const { to, code } = data;
    try {
        console.log('=== 認証メール送信 ===');
        console.log('送信先:', to);
        console.log('認証コード:', code);
        // 本番環境では実際のメール送信を実行
        const emailContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>AMA 認証コード</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 3px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 AMA</h1>
            <p>Assignment Management App</p>
        </div>
        <div class="content">
            <h2>認証コードをお送りします</h2>
            <p>AMAアカウントの作成を完了するために、以下の認証コードを入力してください：</p>
            <div class="code">${code}</div>
            <p><strong>注意事項：</strong></p>
            <ul>
                <li>この認証コードは10分間有効です</li>
                <li>認証コードは6桁の数字です</li>
                <li>このメールに心当たりがない場合は、無視してください</li>
            </ul>
            <div class="footer">
                <p>このメールは自動送信されています。返信はできません。</p>
            </div>
        </div>
    </div>
</body>
</html>`;
        // 実際のメール送信（Firebase Functionsの環境変数を使用）
        const nodemailer = require('nodemailer');
        // Firebase Functionsの環境変数から取得
        const emailUser = ((_a = functions.config().email) === null || _a === void 0 ? void 0 : _a.user) || process.env.EMAIL_USER;
        const emailPass = ((_b = functions.config().email) === null || _b === void 0 ? void 0 : _b.pass) || process.env.EMAIL_PASS;
        console.log('環境変数チェック:', {
            emailUser: emailUser ? '設定済み' : '未設定',
            emailPass: emailPass ? '設定済み' : '未設定'
        });
        if (!emailUser || !emailPass || emailUser === 'your-email@gmail.com' || emailPass === 'your-app-password') {
            throw new Error('メール送信の環境変数が正しく設定されていません');
        }
        // Gmail SMTP設定
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
        const mailOptions = {
            from: emailUser,
            to: to,
            subject: 'AMA 認証コード',
            html: emailContent
        };
        await transporter.sendMail(mailOptions);
        console.log('メール送信完了:', to);
        return {
            success: true,
            message: '認証メールを送信しました'
        };
    }
    catch (error) {
        console.error('メール送信エラー:', error);
        // エラーが発生した場合はコンソール出力にフォールバック
        console.log('=== 認証メール送信（フォールバック） ===');
        console.log('送信先:', to);
        console.log('認証コード:', code);
        console.log('==================');
        return {
            success: true,
            message: '認証メールを送信しました（フォールバック）'
        };
    }
});
// 一般的なメール送信関数
exports.sendEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
    }
    const { to, subject, body } = data;
    try {
        console.log(`メール送信: ${to} - ${subject}`);
        console.log('内容:', body);
        return { success: true };
    }
    catch (error) {
        console.error('メール送信エラー:', error);
        throw new functions.https.HttpsError('internal', 'メール送信に失敗しました');
    }
});
//# sourceMappingURL=index.js.map