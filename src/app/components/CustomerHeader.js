"use client";

import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';
import { db } from '@/app/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Component ไอคอนเหรียญ (Coin Icon)
const CoinIcon = ({ className = "w-6 h-6", ...props }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        {...props}
    >
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
    </svg>
);

export default function CustomerHeader({ showBackButton = false, showActionButtons = true }) {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [customerData, setCustomerData] = useState(null);
    const [dbError, setDbError] = useState(null);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe = () => { };

        if (!liffLoading && profile?.userId) {
            const customerRef = doc(db, "customers", profile.userId);

            unsubscribe = onSnapshot(customerRef, (doc) => {
                if (doc.exists()) {
                    setCustomerData(doc.data());
                    setDbError(null);
                } else {
                    console.warn("ไม่พบข้อมูลลูกค้าใน Database (อาจเป็นลูกค้าใหม่)");
                    setCustomerData({ points: 0 });
                }
            }, (error) => {
                console.error("Firebase Error:", error);
                setDbError("เชื่อมต่อข้อมูลไม่สำเร็จ");
            });
        }
        return () => unsubscribe();
    }, [profile, liffLoading]);

    if (liffLoading) return <div className="p-6 bg-primary animate-pulse h-32"></div>;

    if (liffError) return null;

    return (
        <div className="px-6 pt-6 bg-primary">
            <header className="flex items-center justify-between">
                {/* ส่วนโปรไฟล์ซ้ายมือ */}
                <div className="flex items-center gap-3">
                    {profile?.pictureUrl ? (
                        <div className="w-13 h-13 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20 shadow-sm">
                            <Image src={profile.pictureUrl} width={56} height={56} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-13 h-13 rounded-full bg-gray-800 flex-shrink-0 border-2 border-white/20 shadow-sm" />
                    )}
                    <div>
                        <p className="font-semibold text-primary-dark text-lg line-clamp-1">
                            {profile?.displayName || 'ผู้ใช้'}
                        </p>
                       <p className="text-xs text-primary opacity-80"> SPA & MASSAGE ยินดีต้อนรับ</p>
                        {dbError && <p className="text-xs text-red-600 bg-white/80 px-1 rounded mt-1">{dbError}</p>}
                    </div>
                </div>

                {/* ส่วนแสดงแต้มสะสม (แก้ไขใหม่) */}
                <div className="flex flex-col items-end gap-1">
                    <div className="bg-background rounded-full px-4 py-2 flex items-center gap-2">
                        <div className="bg-yellow-100 rounded-full p-1">
                            <CoinIcon className="w-5 h-5 text-yellow-500" />
                        </div>
                        <span className="text-lg font-bold text-gray-800 leading-none">
                            {customerData?.points ?? 0} <span className="text-sm font-normal text-gray-500">แต้ม</span>
                        </span>
                    </div>
                </div>
            </header>

            {showActionButtons && (
                <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push('/appointment')}
                        className="bg-primary-dark text-primary-light rounded-full py-3 font-medium text-base hover:shadow-md transition-all active:scale-95 border border-gray-200/20"
                    >
                        จองบริการ
                    </button>
                    <button
                        onClick={() => router.push('/my-coupons')}
                        className="bg-white text-gray-800 rounded-full py-3 font-medium text-base hover:shadow-md transition-all active:scale-95 border border-gray-200"
                    >
                        คูปองของฉัน
                    </button>
                </div>
            )}
        </div>
    );
}
