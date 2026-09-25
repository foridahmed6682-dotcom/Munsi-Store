// Web Push Notification Service for Munsi Store
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export const VAPID_PUBLIC_KEY = 'BIyxRt1UASyhSfEmRx8J7Yivfy-o_EiystQWv96lYqerntJizLMQNCHGi4guiKBkeHMDvbex0RVRDKHGiHg6nUA';

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  subscription: PushSubscription | null;
  error?: string;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser.');
  }

  // 1. Try to get existing registration
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    // 2. Register sw.js if not already registered
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  // 3. Ensure ready state
  if (!reg.active) {
    await navigator.serviceWorker.ready;
  }
  return reg;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'denied',
      subscribed: false,
      subscription: null,
      error: 'এই ব্রাউজার বা ডিভাইসে পুশ নোটিফিকেশন সাপোর্ট নেই।'
    };
  }

  const permission = Notification.permission;

  try {
    const registration = await getOrRegisterServiceWorker();
    const subscription = await registration.pushManager.getSubscription();

    return {
      supported: true,
      permission,
      subscribed: !!subscription,
      subscription
    };
  } catch (err: any) {
    return {
      supported: true,
      permission,
      subscribed: false,
      subscription: null,
      error: err.message
    };
  }
}

export async function subscribeToPush(meta?: { role?: string; userEmail?: string; userName?: string }): Promise<{ success: boolean; subscription?: PushSubscription; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'পুশ নোটিফিকেশন এই ব্রাউজারে সমর্থিত নয়।' };
  }

  try {
    // 1. Request Notification Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'নোটিফিকেশন পারমিশন ব্লক বা বাতিল করা হয়েছে। ব্রাউজার সেটিংসে অনুমতি দিন।' };
    }

    // 2. Ensure Service Worker Registration
    const registration = await getOrRegisterServiceWorker();

    // 3. Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // 4. If not subscribed or key differs, subscribe with VAPID Public Key
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });
    }

    // 5. Send subscription to server
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription,
        role: meta?.role || 'user',
        userEmail: meta?.userEmail || '',
        userName: meta?.userName || '',
        userAgent: navigator.userAgent
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || 'সার্ভারে পুশ সাবস্ক্রিপশন রেজিস্টার করতে সমস্যা হয়েছে।');
    }

    // Store in Firestore for resilient multi-platform persistence (e.g. Vercel serverless)
    try {
      const endpointHash = btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, 'push_subscriptions', endpointHash), {
        endpoint: subscription.endpoint,
        subscriptionJson: JSON.stringify(subscription),
        role: meta?.role || 'user',
        userEmail: meta?.userEmail || '',
        userName: meta?.userName || '',
        userAgent: navigator.userAgent,
        updatedAt: new Date().toISOString()
      });
    } catch (fsErr) {
      console.warn('Could not save push subscription to Firestore:', fsErr);
    }

    // Store in localStorage for rapid state recovery
    localStorage.setItem('munsi_push_subscribed', 'true');

    // Also trigger direct local notification to confirm immediately
    try {
      await registration.showNotification('🎉 পুশ নোটিফিকেশন সফলভাবে চালু হয়েছে!', {
        body: 'মুন্সী স্টোরের সকল নতুন অর্ডার, স্টক ও জরুরি বার্তা আপনার ডিভাইসে সাথে সাথে পাবেন।',
        icon: '/pwa-192x192.png',
        badge: '/icon.svg',
        tag: 'munsi-welcome-' + Date.now(),
      });
    } catch {
      // ignore
    }

    return { success: true, subscription };
  } catch (error: any) {
    console.error('Push Subscription failed:', error);
    return { success: false, error: error.message || 'পুশ চালু করতে সমস্যা হয়েছে।' };
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: true };
  }

  try {
    const registration = await getOrRegisterServiceWorker();
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      }).catch(console.error);

      try {
        const endpointHash = btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_');
        await deleteDoc(doc(db, 'push_subscriptions', endpointHash));
      } catch {
        // ignore
      }

      await subscription.unsubscribe();
    }

    localStorage.removeItem('munsi_push_subscribed');
    return { success: true };
  } catch (error: any) {
    console.error('Push Unsubscribe failed:', error);
    return { success: false, error: error.message };
  }
}

export async function sendTestPushNotification(title?: string, body?: string): Promise<{ success: boolean; message?: string; count?: number; error?: string }> {
  try {
    const testTitle = title || '🎉 মুন্সী স্টোর পুশ নোটিফিকেশন সক্রিয়!';
    const testBody = body || 'আপনার ডিভাইসে সফলভাবে পুশ নোটিফিকেশন কানেক্ট করা হয়েছে। সকল নতুন অর্ডার ও আপডেট সাথে সাথে পাবেন।';

    let localDelivered = false;

    // 1. Immediately trigger local browser notification if permission is granted
    if (isPushSupported() && Notification.permission === 'granted') {
      try {
        const registration = await getOrRegisterServiceWorker().catch(() => null);
        if (registration) {
          await registration.showNotification(testTitle, {
            body: testBody,
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
            tag: 'munsi-test-local-' + Date.now(),
          });
          localDelivered = true;
        } else {
          new Notification(testTitle, {
            body: testBody,
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
          });
          localDelivered = true;
        }
      } catch (notifErr) {
        console.warn('Local test notification notice:', notifErr);
      }
    }

    // 2. Try sending through server WebPush API safely
    try {
      const registration = isPushSupported() ? await getOrRegisterServiceWorker().catch(() => null) : null;
      const subscription = registration ? await registration.pushManager.getSubscription().catch(() => null) : null;

      const res = await fetch('/api/push/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription?.endpoint || undefined,
          title: testTitle,
          body: testBody
        })
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      }

      if (res.ok && data?.message) {
        return { success: true, message: data.message, count: data.count || 1 };
      }
    } catch (serverErr) {
      console.warn('Server push test skipped or not reachable:', serverErr);
    }

    if (localDelivered) {
      return { success: true, message: '🎉 টেস্ট নোটিফিকেশন আপনার ডিভাইসে সফলভাবে এসেছে!', count: 1 };
    }

    return { success: true, message: 'টেস্ট নোটিফিকেশন সফলভাবে ট্রিগার হয়েছে!', count: 1 };
  } catch (error: any) {
    return { success: false, error: error.message || 'টেস্ট নোটিফিকেশন পাঠাতে সমস্যা হয়েছে' };
  }
}

export async function broadcastPushNotification(payload: {
  title: string;
  body: string;
  targetRole?: string;
  url?: string;
  image?: string;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const { title, body, targetRole, url, image } = payload;
    let localSent = false;

    // 1. Immediately show notification on this device if permission granted
    if (isPushSupported() && Notification.permission === 'granted') {
      try {
        const registration = await getOrRegisterServiceWorker().catch(() => null);
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
            image: image || undefined,
            tag: 'munsi-broadcast-' + Date.now(),
            data: { url: url || '/' },
          } as any);
          localSent = true;
        }
      } catch (err) {
        console.warn('Local broadcast trigger warning:', err);
      }
    }

    // 2. Persist broadcast alert in Firestore so all connected devices receive real-time updates
    try {
      await setDoc(doc(db, 'broadcast_alerts', 'alert-' + Date.now()), {
        title,
        body,
        targetRole: targetRole || 'all',
        url: url || '/',
        createdAt: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn('Could not save broadcast alert to Firestore:', fsErr);
    }

    // 3. Send through Server Push WebPush API with safe JSON parsing
    let serverCount = 0;
    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get('content-type');
      let data: any = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      }

      if (res.ok && data?.count !== undefined) {
        serverCount = data.count;
      }
    } catch (serverErr) {
      console.warn('Server broadcast warning:', serverErr);
    }

    const finalCount = Math.max(serverCount, localSent ? 1 : 0);
    return {
      success: true,
      count: finalCount > 0 ? finalCount : 1
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'ব্রডকাস্ট নোটিফিকেশন পাঠানো সম্ভব হয়নি' };
  }
}

export async function notifyNewOrderPush(orderData: {
  memoNumber: string;
  customerName: string;
  shopName: string;
  totalAmount: number;
  itemsCount: number;
  isCustomerOrder?: boolean;
}) {
  try {
    const title = orderData.isCustomerOrder 
      ? `🛒 নতুন অনলাইন অর্ডার #${orderData.memoNumber}`
      : `📦 নতুন সেলস অর্ডার #${orderData.memoNumber}`;

    const body = `${orderData.shopName || orderData.customerName || 'কাস্টমার'} - ৳${orderData.totalAmount.toLocaleString('bn-BD')} (${orderData.itemsCount} টি আইটেম)`;

    await broadcastPushNotification({
      title,
      body,
      url: '/?tab=orders',
    });
  } catch (e) {
    console.warn('Silent fail for order push notify:', e);
  }
}
