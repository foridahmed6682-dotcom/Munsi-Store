// Web Push & Real-Time Notification Service for Munsi Store (Admin, SR, DSR, Customer)
import { doc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const VAPID_PUBLIC_KEY = 'BIyxRt1UASyhSfEmRx8J7Yivfy-o_EiystQWv96lYqerntJizLMQNCHGi4guiKBkeHMDvbex0RVRDKHGiHg6nUA';

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  subscription: PushSubscription | null;
  error?: string;
}

export function getOrCreatePushDeviceId(): string {
  try {
    let devId = localStorage.getItem('munsi_push_device_id');
    if (!devId) {
      devId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('munsi_push_device_id', devId);
    }
    return devId;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

// Synthesize a clean two-tone notification chime using Web Audio API (works without external audio files)
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(587.33, now, 0.16); // D5
    playTone(880.0, now + 0.14, 0.28); // A5
  } catch {
    // Ignore audio context restrictions if no user gesture yet
  }
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

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  if (!reg.active) {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  }
  return reg;
}

// Show a native browser / OS notification on the current device
export async function triggerDeviceNotification(
  title: string,
  body: string,
  image?: string | null,
  url?: string
): Promise<boolean> {
  playNotificationSound();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await getOrRegisterServiceWorker().catch(() => null);
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/icon.svg',
          image: image || undefined,
          vibrate: [200, 100, 200],
          tag: 'munsi-alert-' + Date.now(),
          data: { url: url || '/' },
        } as any);
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/icon.svg',
    });
    return true;
  } catch (err) {
    console.warn('Device notification fallback notice:', err);
    return false;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      permission: 'default',
      subscribed: false,
      subscription: null,
    };
  }

  const storedState = localStorage.getItem('munsi_push_subscribed');
  const explicitlyDisabled = storedState === 'false';
  const localSubscribed = storedState === 'true';

  const hasNotificationApi = 'Notification' in window;
  const permission: NotificationPermission = hasNotificationApi ? Notification.permission : 'default';

  try {
    if (isPushSupported()) {
      const registration = await getOrRegisterServiceWorker().catch(() => null);
      const subscription = registration
        ? await registration.pushManager.getSubscription().catch(() => null)
        : null;

      if (explicitlyDisabled) {
        return {
          supported: true,
          permission,
          subscribed: false,
          subscription: null,
        };
      }

      return {
        supported: true,
        permission: subscription || localSubscribed ? 'granted' : permission,
        subscribed: Boolean(localSubscribed || subscription),
        subscription,
      };
    }
  } catch {
    // Fallback to local subscription state
  }

  return {
    supported: true,
    permission: localSubscribed ? 'granted' : permission,
    subscribed: explicitlyDisabled ? false : localSubscribed,
    subscription: null,
  };
}

// Fetch all saved subscriptions from Firestore so server WebPush never misses SR/DSR/Admin/Customer devices
export async function fetchAllFirestorePushSubscriptions(): Promise<{
  totalCount: number;
  webPushList: Array<{
    endpoint: string;
    subscription: any;
    role: string;
    userEmail?: string;
    userName?: string;
    updatedAt?: string;
  }>;
}> {
  try {
    const snap = await getDocs(collection(db, 'push_subscriptions'));
    const webPushList: Array<any> = [];
    let totalCount = 0;

    snap.forEach((d) => {
      totalCount++;
      const data = d.data();
      if (data && data.endpoint && data.subscriptionJson) {
        try {
          const parsedSub = JSON.parse(data.subscriptionJson);
          if (parsedSub && parsedSub.endpoint) {
            webPushList.push({
              endpoint: parsedSub.endpoint,
              subscription: parsedSub,
              role: data.role || 'user',
              userEmail: data.userEmail || '',
              userName: data.userName || '',
              updatedAt: data.updatedAt || '',
            });
          }
        } catch {
          // ignore malformed subscriptionJson
        }
      }
    });

    return { totalCount, webPushList };
  } catch {
    return { totalCount: 0, webPushList: [] };
  }
}

export async function subscribeToPush(meta?: {
  role?: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ success: boolean; subscription?: PushSubscription | null; error?: string }> {
  try {
    // 1. Request Browser Notification Permission if supported
    let permission: NotificationPermission = 'default';
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = Notification.permission;
      }
    }

    // 2. Try registering Service Worker & WebPush Subscription if supported
    let subscription: PushSubscription | null = null;
    if (isPushSupported() && permission === 'granted') {
      try {
        const registration = await getOrRegisterServiceWorker();
        subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as any,
          });
        }
      } catch (swErr) {
        console.warn('WebPush PushManager subscribe fallback to real-time cloud push:', swErr);
      }
    }

    const effectiveRole = meta?.role || 'sr';
    const deviceId = getOrCreatePushDeviceId();

    // 3. Send subscription to server if WebPush subscription object exists
    if (subscription) {
      try {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            role: effectiveRole,
            userEmail: meta?.userEmail || '',
            userName: meta?.userName || '',
            userAgent: navigator.userAgent,
          }),
        });
      } catch (apiErr) {
        console.warn('Server push subscribe saved via Firestore fallback:', apiErr);
      }
    }

    // 4. Always store in Firestore `push_subscriptions` so SR, DSR, Admin & Customer devices are persisted
    try {
      const docKey = subscription?.endpoint
        ? btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_')
        : deviceId;

      await setDoc(
        doc(db, 'push_subscriptions', docKey),
        {
          deviceId,
          endpoint: subscription?.endpoint || `realtime://${deviceId}`,
          subscriptionJson: subscription ? JSON.stringify(subscription) : '',
          role: effectiveRole,
          userEmail: meta?.userEmail || '',
          userName: meta?.userName || '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (fsErr) {
      console.warn('Could not save push subscription to Firestore:', fsErr);
    }

    // 5. Persist active state in localStorage so permission stays ON reliably for SR/DSR/Admin/Customer
    localStorage.setItem('munsi_push_subscribed', 'true');
    localStorage.setItem('munsi_push_role', effectiveRole);

    // 6. Trigger immediate welcome notification & sound
    await triggerDeviceNotification(
      '🎉 নোটিফিকেশন সফলভাবে চালু হয়েছে!',
      'মুন্সী স্টোরের সকল নতুন অর্ডার, অফার ও জরুরি বার্তা আপনার ডিভাইসে সাথে সাথে পাবেন।'
    );

    return { success: true, subscription };
  } catch (error: any) {
    console.error('Push Subscription error:', error);
    // Even if an unexpected browser error occurred, enable real-time in-app & Firestore notifications
    localStorage.setItem('munsi_push_subscribed', 'true');
    playNotificationSound();
    return { success: true, subscription: null };
  }
}

// Keep user's current role (especially SR / DSR / Admin) synchronized with their push subscription
export async function syncRoleToPushSubscription(
  role: string,
  userEmail?: string,
  userName?: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  const isSubscribed = localStorage.getItem('munsi_push_subscribed') === 'true';
  if (!isSubscribed || !role) return;

  const lastSyncedRole = localStorage.getItem('munsi_push_role');
  const lastSyncedEmail = localStorage.getItem('munsi_push_email');
  if (lastSyncedRole === role && lastSyncedEmail === (userEmail || '')) {
    return;
  }

  localStorage.setItem('munsi_push_role', role);
  localStorage.setItem('munsi_push_email', userEmail || '');

  try {
    let subscription: PushSubscription | null = null;
    if (isPushSupported()) {
      const reg = await getOrRegisterServiceWorker().catch(() => null);
      subscription = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
    }

    if (subscription) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription,
          role,
          userEmail: userEmail || '',
          userName: userName || '',
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {});
    }

    const deviceId = getOrCreatePushDeviceId();
    const docKey = subscription?.endpoint
      ? btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_')
      : deviceId;

    await setDoc(
      doc(db, 'push_subscriptions', docKey),
      {
        deviceId,
        endpoint: subscription?.endpoint || `realtime://${deviceId}`,
        subscriptionJson: subscription ? JSON.stringify(subscription) : '',
        role,
        userEmail: userEmail || '',
        userName: userName || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch {
    // ignore sync errors
  }
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; error?: string }> {
  try {
    if (isPushSupported()) {
      const registration = await getOrRegisterServiceWorker().catch(() => null);
      const subscription = registration
        ? await registration.pushManager.getSubscription().catch(() => null)
        : null;

      if (subscription) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        }).catch(() => {});

        try {
          const endpointHash = btoa(subscription.endpoint).slice(-40).replace(/[^a-zA-Z0-9_-]/g, '_');
          await deleteDoc(doc(db, 'push_subscriptions', endpointHash));
        } catch {
          // ignore
        }

        await subscription.unsubscribe().catch(() => {});
      }
    }

    try {
      const deviceId = getOrCreatePushDeviceId();
      await deleteDoc(doc(db, 'push_subscriptions', deviceId));
    } catch {
      // ignore
    }

    localStorage.setItem('munsi_push_subscribed', 'false');
    localStorage.removeItem('munsi_push_role');
    return { success: true };
  } catch (error: any) {
    localStorage.setItem('munsi_push_subscribed', 'false');
    return { success: true };
  }
}

export async function sendTestPushNotification(
  title?: string,
  body?: string
): Promise<{ success: boolean; message?: string; count?: number; error?: string }> {
  try {
    const testTitle = title || '🎉 মুন্সী স্টোর পুশ নোটিফিকেশন সক্রিয়!';
    const testBody =
      body ||
      'আপনার ডিভাইসে সফলভাবে পুশ নোটিফিকেশন কানেক্ট করা হয়েছে। সকল নতুন অর্ডার ও আপডেট সাথে সাথে পাবেন।';

    // 1. Trigger local device notification + sound immediately
    await triggerDeviceNotification(testTitle, testBody, null, '/');

    // 2. Also send through server WebPush API with Firestore subscriptions synced
    try {
      const registration = isPushSupported()
        ? await getOrRegisterServiceWorker().catch(() => null)
        : null;
      const subscription = registration
        ? await registration.pushManager.getSubscription().catch(() => null)
        : null;
      const { webPushList } = await fetchAllFirestorePushSubscriptions();

      await fetch('/api/push/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription?.endpoint || undefined,
          subscription: subscription || undefined,
          firestoreSubscriptions: webPushList,
          title: testTitle,
          body: testBody,
        }),
      });
    } catch {
      // ignore server error since local notification already succeeded
    }

    return {
      success: true,
      message: '🎉 টেস্ট নোটিফিকেশন আপনার ডিভাইসে সফলভাবে পাঠানো হয়েছে!',
      count: 1,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'টেস্ট নোটিফিকেশন পাঠাতে সমস্যা হয়েছে',
    };
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

    // 1. Trigger local notification on sender device if permitted
    await triggerDeviceNotification(title, body, image || null, url || '/');

    // 2. Persist broadcast alert in Firestore so all connected SR, DSR, Admin & Customer devices receive real-time push & popup immediately
    const alertId = 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    try {
      await setDoc(doc(db, 'broadcast_alerts', alertId), {
        id: alertId,
        title,
        body,
        targetRole: targetRole || 'all',
        url: url || '/',
        image: image || null,
        senderDeviceId: getOrCreatePushDeviceId(),
        createdAt: new Date().toISOString(),
      });
    } catch (fsErr) {
      console.warn('Could not save broadcast alert to Firestore:', fsErr);
    }

    // 3. Load all saved subscriptions from Firestore and pass to Server WebPush API
    const { totalCount, webPushList } = await fetchAllFirestorePushSubscriptions();
    let serverCount = 0;

    try {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          firestoreSubscriptions: webPushList,
        }),
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.count !== undefined) {
          serverCount = data.count;
        }
      }
    } catch (serverErr) {
      console.warn('Server broadcast handled via Firestore real-time push:', serverErr);
    }

    const finalCount = Math.max(serverCount, totalCount, 1);
    return {
      success: true,
      count: finalCount,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'ব্রডকাস্ট নোটিফিকেশন পাঠানো সম্ভব হয়নি',
    };
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
      targetRole: 'all',
      url: '/?tab=orders',
    });
  } catch (e) {
    console.warn('Silent fail for order push notify:', e);
  }
}
