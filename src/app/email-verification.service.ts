import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AuthService } from './auth.service';
import { getAuth, fetchSignInMethodsForEmail, createUserWithEmailAndPassword, deleteUser, updateProfile } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class EmailVerificationService {
  private firestore = inject(Firestore);
  private functions = inject(Functions);
  private authService = inject(AuthService);

  // 認証コードを生成
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // メールアドレスの重複チェック（より確実な方法）
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const auth = getAuth();
      
      // まずfetchSignInMethodsForEmailでチェック
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, email);
        if (signInMethods.length > 0) {
          return true;
        }
      } catch (error) {
        // fetchSignInMethodsForEmailが失敗した場合は、実際にユーザー作成を試行
        console.log('fetchSignInMethodsForEmail failed, trying createUserWithEmailAndPassword');
      }
      
      // 一時的なパスワードでユーザー作成を試行
      const tempPassword = 'temp_' + Math.random().toString(36).substring(7);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
        // ユーザー作成に成功した場合は、そのユーザーを削除
        await deleteUser(userCredential.user);
        return false; // ユーザーが存在しなかった
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          return true; // メールアドレスが既に使用されている
        }
        // その他のエラーは無視してfalseを返す
        console.error('ユーザー作成試行エラー:', error);
        return false;
      }
    } catch (error) {
      console.error('メールアドレス重複チェックエラー:', error);
      return false;
    }
  }

  // 認証コードを送信
  async sendVerificationCode(email: string): Promise<string> {
    // メールアドレスの重複チェック
    const emailExists = await this.checkEmailExists(email);
    if (emailExists) {
      throw new Error('このメールアドレスは既に使用されています');
    }

    const code = this.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10分後に期限切れ

    // 既存の認証コードを削除
    await this.cleanupExpiredCodes(email);

    // 新しい認証コードを保存
    const verificationData = {
      email: email,
      code: code,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      isUsed: false
    };

    const docRef = await addDoc(collection(this.firestore, 'email_verifications'), verificationData);
    
    // メール送信（開発環境ではコンソールに出力）
    await this.sendEmail(email, code);
    
    console.log('認証コードを保存しました:', {
      email,
      code,
      docId: docRef.id,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString()
    });

    return docRef.id;
  }

  // 認証コードを検証
  async verifyCode(email: string, inputCode: string): Promise<boolean> {
    try {
      console.log('認証コード検証開始:', { email, inputCode });
      
      const verificationRef = collection(this.firestore, 'email_verifications');
      const q = query(
        verificationRef,
        where('email', '==', email),
        where('code', '==', inputCode),
        where('isUsed', '==', false)
      );

      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('検索結果: 0 件');
        return false;
      }

      console.log('検索結果:', snapshot.size, '件');

      for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log('見つかった認証コードデータ:', data);
        
        const now = new Date();
        const expiresAt = data['expiresAt'].toDate();
        console.log('現在時刻:', now.toISOString());
        console.log('期限切れ時刻:', expiresAt.toISOString());
        console.log('期限切れチェック:', now <= expiresAt);

        if (now <= expiresAt) {
          // 認証コードを使用済みにマーク
          await deleteDoc(doc.ref);
          console.log('認証コード検証成功');
          return true;
        } else {
          console.log('認証コードが期限切れです');
          // 期限切れのコードを削除
          await deleteDoc(doc.ref);
        }
      }

      console.log('認証コード検証失敗');
      return false;
    } catch (error) {
      console.error('認証コード検証エラー:', error);
      return false;
    }
  }

  // 期限切れの認証コードをクリーンアップ
  private async cleanupExpiredCodes(email: string): Promise<void> {
    try {
      const verificationRef = collection(this.firestore, 'email_verifications');
      const q = query(verificationRef, where('email', '==', email));
      const snapshot = await getDocs(q);

      const now = new Date();
      const deletePromises: Promise<void>[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const expiresAt = data['expiresAt'].toDate();
        if (now > expiresAt) {
          deletePromises.push(deleteDoc(doc.ref));
        }
      });

      await Promise.all(deletePromises);
      console.log('期限切れコードクリーンアップ完了');
    } catch (error) {
      console.error('クリーンアップエラー:', error);
    }
  }

  // メール送信（Firebase Functions経由）
  private async sendEmail(email: string, code: string): Promise<void> {
    try {
      const sendVerificationEmail = httpsCallable(this.functions, 'sendVerificationEmail');
      const result = await sendVerificationEmail({ to: email, code: code });
      
      console.log('メール送信結果:', result);
    } catch (error) {
      console.error('メール送信エラー:', error);
      // エラーが発生してもコンソール出力は継続
      console.log('=== 認証メール送信（フォールバック） ===');
      console.log('送信先:', email);
      console.log('認証コード:', code);
      console.log('==================');
    }
  }

  // ユーザー作成（重複チェック付き）
  async createUser(email: string, password: string, displayName: string, department: string) {
    try {
      // 最終的な重複チェック
      const emailExists = await this.checkEmailExists(email);
      if (emailExists) {
        throw new Error('このメールアドレスは既に使用されています');
      }

      // ユーザー作成
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // ユーザープロファイルを更新
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: displayName
        });
      }

      return userCredential;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('このメールアドレスは既に使用されています');
      }
      throw error;
    }
  }
}
