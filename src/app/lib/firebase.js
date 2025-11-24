import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache
} from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// เปลี่ยนชื่อ App อีกครั้งเพื่อให้มั่นใจว่าเป็น Instance ใหม่ที่ Config Auth แล้ว
const APP_NAME = 'SPA_V5_FINAL_LOCAL';

let app;
let db;
let auth;

try {
  // 1. ลองดึง App เดิมมา (ถ้ามี)
  app = getApp(APP_NAME);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  // 2. ถ้ายังไม่มี ให้สร้างใหม่แบบ "Memory Only" ทั้งระบบ
  app = initializeApp(firebaseConfig, APP_NAME);

  // Config 1: Database ห้ามเก็บไฟล์ (Memory Cache) + บังคับ HTTP (Long Polling)
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  });

  // Config 2: Auth กลับมาใช้ Local Persistence เพื่อให้จำ Login ได้
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence
  });

  console.log(`🔥 Firebase (${APP_NAME}) initialized: Memory DB + Local Auth`);
}

export { db, auth };
