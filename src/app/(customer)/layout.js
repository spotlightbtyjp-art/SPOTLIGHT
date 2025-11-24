// src/app/(customer)/layout.js
"use client";

import { useEffect } from 'react'; // [เพิ่ม]
import { db } from '@/app/lib/firebase'; // [เพิ่ม]
import { enableNetwork, disableNetwork } from 'firebase/firestore'; // [เพิ่ม]
import { LiffProvider } from '@/context/LiffProvider';
import { ToastProvider } from '@/app/components/Toast';
import { ProfileProvider } from '@/context/ProfileProvider';

export default function CustomerLayout({ children }) {
    const customerLiffId = process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID;

    // [เพิ่ม] Effect นี้จะช่วย Reset Connection เมื่อสลับหน้าจอ
    useEffect(() => {
        const handleVisibilityChange = async () => {
            try {
                if (document.hidden) {
                    // เมื่อพับจอ หรือสลับแอป -> ตัดเน็ต Firestore (เพื่อไม่ให้ socket ค้าง)
                    // console.log("App backgrounded: Disabling Firestore network");
                    await disableNetwork(db);
                } else {
                    // เมื่อกลับมา -> ต่อเน็ตใหม่
                    // console.log("App foregrounded: Enabling Firestore network");
                    await enableNetwork(db);
                }
            } catch (err) {
                console.error("Error toggling network:", err);
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    return (
        <ToastProvider>
            <LiffProvider liffId={customerLiffId}>
                <ProfileProvider>
                    <div className="bg-white min-h-screen relative bg-fixed">
                        <main className='w-full max-w-md mx-auto'>
                            {children}
                        </main>
                    </div>
                </ProfileProvider>
            </LiffProvider>
        </ToastProvider>
    );
}
