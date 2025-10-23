import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, collectionData, orderBy, getDocs } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { map, catchError, take, switchMap } from 'rxjs/operators';
import { ProgressReport, ProgressReportComment, Id } from './models';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ProgressReportService {
  private firestore = inject(Firestore);
  private notificationService = inject(NotificationService);

  // 進捗報告作成
  async createProgressReport(reportData: Omit<ProgressReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProgressReport> {
    const ref = await addDoc(collection(this.firestore, 'progressReports'), {
      ...reportData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    const snap = await getDoc(doc(this.firestore, 'progressReports', ref.id));
    const report = { id: ref.id, ...(snap.data() as Omit<ProgressReport, 'id'>) };
    
    // 通知を送信
    await this.sendProgressReportNotification(report);
    
    return report;
  }

  // 進捗報告通知を送信
  private async sendProgressReportNotification(report: ProgressReport): Promise<void> {
    try {
      if (report.recipientId) {
        // 特定の人への送信
        await this.notificationService.createNotification({
          userId: report.recipientId,
          type: 'progress_report',
          title: '新しい進捗報告が届きました',
          message: `${report.senderName}さんから進捗報告「${report.title}」が送信されました`,
          content: report.content,
          data: {
            reportId: report.id,
            senderId: report.senderId,
            senderName: report.senderName
          }
        });
      } else if (report.groupId) {
        // グループへの送信 - グループメンバー全員に通知
        const groupMembers = await this.getGroupMembers(report.groupId);
        const notificationPromises = groupMembers
          .filter(member => member.userId !== report.senderId) // 送信者以外
          .map(member => 
            this.notificationService.createNotification({
              userId: member.userId,
              type: 'progress_report',
              title: '新しい進捗報告が届きました',
              message: `${report.senderName}さんからグループ「${report.groupName}」に進捗報告「${report.title}」が送信されました`,
              content: report.content,
              data: {
                reportId: report.id,
                senderId: report.senderId,
                senderName: report.senderName,
                groupId: report.groupId,
                groupName: report.groupName
              }
            })
          );
        
        await Promise.all(notificationPromises);
      }
    } catch (error) {
      console.error('進捗報告通知送信エラー:', error);
    }
  }

  // グループメンバーを取得
  private async getGroupMembers(groupId: string): Promise<any[]> {
    try {
      const membersSnapshot = await getDocs(
        query(collection(this.firestore, 'groupMemberships'), where('groupId', '==', groupId))
      );
      return membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('グループメンバー取得エラー:', error);
      return [];
    }
  }

  // 進捗報告更新
  async updateProgressReport(reportId: string, updates: Partial<Omit<ProgressReport, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'progressReports', reportId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  // 進捗報告削除
  async deleteProgressReport(reportId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'progressReports', reportId));
  }

  // 下書き進捗報告一覧取得
  getDraftProgressReports(senderId: string): Observable<ProgressReport[]> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReports'),
        where('senderId', '==', senderId),
        where('status', '==', 'draft')
      ),
      { idField: 'id' }
    ).pipe(
      map(reports => {
        return (reports as ProgressReport[]).sort((a, b) => {
          const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt);
          const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt);
          return dateB.getTime() - dateA.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading draft progress reports:', error);
        return of([]);
      })
    );
  }

  // 送信した進捗報告一覧取得
  getSentProgressReports(senderId: string): Observable<ProgressReport[]> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReports'),
        where('senderId', '==', senderId),
        where('status', 'in', ['sent', 'read'])
      ),
      { idField: 'id' }
    ).pipe(
      map(reports => {
        return (reports as ProgressReport[]).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading sent progress reports:', error);
        return of([]);
      })
    );
  }

  // 受信した進捗報告一覧取得
  getReceivedProgressReports(recipientId: string): Observable<ProgressReport[]> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReports'),
        where('recipientId', '==', recipientId)
      ),
      { idField: 'id' }
    ).pipe(
      map(reports => {
        return (reports as ProgressReport[]).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading received progress reports:', error);
        return of([]);
      })
    );
  }

  // グループの進捗報告一覧取得
  getGroupProgressReports(groupId: string): Observable<ProgressReport[]> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReports'),
        where('groupId', '==', groupId)
      ),
      { idField: 'id' }
    ).pipe(
      map(reports => {
        return (reports as ProgressReport[]).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading group progress reports:', error);
        return of([]);
      })
    );
  }

  // 進捗報告詳細取得
  async getProgressReport(reportId: string): Promise<ProgressReport | null> {
    const docRef = doc(this.firestore, 'progressReports', reportId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ProgressReport;
    }
    return null;
  }

  // 進捗報告を既読にする
  async markAsRead(reportId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'progressReports', reportId), {
      status: 'read',
      readAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // コメント追加
  async addComment(reportId: string, commentData: Omit<ProgressReportComment, 'id' | 'createdAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'progressReportComments'), {
      ...commentData,
      reportId,
      createdAt: serverTimestamp(),
    });

    // コメント通知を送信
    await this.sendCommentNotification(reportId, commentData);
  }

  // コメント通知を送信
  private async sendCommentNotification(reportId: string, commentData: Omit<ProgressReportComment, 'id' | 'createdAt'>): Promise<void> {
    try {
      // 進捗報告の詳細を取得
      const report = await this.getProgressReport(reportId);
      if (!report) {
        console.error('進捗報告が見つかりません:', reportId);
        return;
      }

      // コメント投稿者以外に通知を送信
      if (report.senderId !== commentData.commenterId) {
        await this.notificationService.createNotification({
          userId: report.senderId,
          type: 'progress_report_comment',
          title: '進捗報告にコメントが付きました',
          message: `${commentData.commenterName}さんが進捗報告「${report.title}」にコメントしました`,
          content: commentData.content,
          data: {
            reportId: report.id,
            commenterId: commentData.commenterId,
            commenterName: commentData.commenterName,
            senderId: report.senderId,
            senderName: report.senderName
          }
        });
      }

      // グループ進捗報告の場合、他のメンバーにも通知
      if (report.groupId) {
        const groupMembers = await this.getGroupMembers(report.groupId);
        const notificationPromises = groupMembers
          .filter(member => 
            member.userId !== commentData.commenterId && // コメント投稿者以外
            member.userId !== report.senderId // 送信者以外（既に通知済み）
          )
          .map(member => 
            this.notificationService.createNotification({
              userId: member.userId,
              type: 'progress_report_comment',
              title: '進捗報告にコメントが付きました',
              message: `${commentData.commenterName}さんがグループ「${report.groupName}」の進捗報告「${report.title}」にコメントしました`,
              content: commentData.content,
              data: {
                reportId: report.id,
                commenterId: commentData.commenterId,
                commenterName: commentData.commenterName,
                groupId: report.groupId,
                groupName: report.groupName,
                senderId: report.senderId,
                senderName: report.senderName
              }
            })
          );
        
        await Promise.all(notificationPromises);
      }
    } catch (error) {
      console.error('コメント通知送信エラー:', error);
    }
  }

  // 進捗報告のコメント一覧取得
  getProgressReportComments(reportId: string): Observable<ProgressReportComment[]> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReportComments'),
        where('reportId', '==', reportId)
      ),
      { idField: 'id' }
    ).pipe(
      map(comments => {
        return (comments as ProgressReportComment[]).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateA.getTime() - dateB.getTime();
        });
      }),
      catchError(error => {
        console.error('Error loading progress report comments:', error);
        return of([]);
      })
    );
  }

  // コメント削除
  async deleteComment(commentId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'progressReportComments', commentId));
  }

  // 未読の進捗報告数を取得
  getUnreadCount(userId: string): Observable<number> {
    return collectionData(
      query(
        collection(this.firestore, 'progressReports'),
        where('recipientId', '==', userId),
        where('status', '==', 'sent')
      ),
      { idField: 'id' }
    ).pipe(
      map(reports => (reports as ProgressReport[]).length),
      catchError(error => {
        console.error('Error loading unread progress reports:', error);
        return of(0);
      })
    );
  }
}
