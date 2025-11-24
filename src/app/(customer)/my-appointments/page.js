"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { cancelAppointmentByUser, confirmAppointmentByUser } from '@/app/actions/appointmentActions';
import AppointmentCard from './AppointmentCard';
import QrCodeModal from '@/app/components/common/QrCodeModal';
import HistoryCard from './history/HistoryCard';
import CustomerHeader from '@/app/components/CustomerHeader';

const SpaFlowerIcon = ({ className = "w-10 h-10", color = "#553734", ...props }) => (
    <svg className={className} fill={color} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M512,255.992c0-37.331-22.112-69.445-53.84-83.734c12.329-32.557,5.243-70.893-21.149-97.286c-26.376-26.376-64.704-33.461-97.261-21.124C325.445,22.112,293.331,0,256.009,0c-37.323,0-69.445,22.112-83.76,53.848c-32.54-12.337-70.876-5.252-97.252,21.124c-26.393,26.393-33.478,64.729-21.149,97.286C22.121,186.564,0,218.677,0,255.992c0,37.314,22.121,69.444,53.849,83.75c-12.329,32.557-5.244,70.886,21.132,97.27c26.393,26.384,64.729,33.47,97.269,21.14C186.556,489.888,218.661,512,255.992,512c37.339,0,69.469-22.112,83.758-53.848c32.557,12.329,70.885,5.243,97.261-21.14c26.392-26.384,33.478-64.712,21.149-97.27C489.888,325.453,512,293.34,512,255.992z M248.529,125.571c1.717-1.566,3.401-3.174,5.025-4.841c1.709,1.575,3.476,3.108,5.269,4.623c12.69,11.651,9.347,23.252-0.67,48.706c-0.787,2.027-1.893,4.69-3.3,7.882c-1.49-3.132-2.731-5.754-3.601-7.772C240.195,149.191,236.334,137.742,248.529,125.571z M158.094,162.626c2.329-0.068,4.649-0.218,6.969-0.428c17.213-0.728,23.034,9.859,33.94,34.903c0.854,1.977,1.993,4.682,3.25,7.89c-3.283-1.13-6.014-2.127-8.024-2.907c-25.487-9.858-36.301-15.219-36.301-32.448C158.028,167.283,158.094,164.954,158.094,162.626z M125.572,263.48c-1.567-1.725-3.175-3.417-4.833-5.034c1.574-1.717,3.099-3.484,4.623-5.285c11.651-12.672,23.252-9.322,48.689,0.712c2.019,0.788,4.707,1.893,7.856,3.283c-3.099,1.499-5.746,2.706-7.731,3.602C149.2,271.814,137.724,275.642,125.572,263.48z M202.119,317.772c-9.884,25.488-15.253,36.301-32.482,36.293c-2.337-0.084-4.682-0.16-7.003-0.16c-0.067-2.32-0.217-4.649-0.418-6.96c-0.737-17.221,9.85-23.059,34.894-33.939c2.01-0.88,4.707-2.002,7.923-3.292C203.91,312.998,202.906,315.754,202.119,317.772z M263.48,386.429c-1.726,1.558-3.401,3.174-5.026,4.842c-1.708-1.575-3.484-3.107-5.276-4.624c-12.681-11.66-9.331-23.26,0.67-48.706c0.788-2.01,1.91-4.724,3.309-7.907c1.499,3.132,2.721,5.788,3.601,7.79C271.814,362.809,275.675,374.251,263.48,386.429z M256.009,289.328c-18.41,0-33.337-14.917-33.337-33.327c0-18.419,14.926-33.336,33.337-33.336c18.409,0,33.327,14.917,33.327,33.336C289.336,274.411,274.418,289.328,256.009,289.328z M309.891,194.236c9.892-25.504,15.252-36.318,32.473-36.309c2.346,0.092,4.691,0.167,7.02,0.167c0.05,2.329,0.2,4.64,0.418,6.969c0.729,17.204-9.858,23.026-34.902,33.922c-2.01,0.896-4.699,1.986-7.916,3.275C308.107,198.969,309.095,196.256,309.891,194.236z M353.914,349.366c-2.32,0.067-4.649,0.226-6.969,0.436c-17.212,0.72-23.026-9.858-33.931-34.91c-0.888-2.01-2.001-4.716-3.291-7.932c3.283,1.13,6.022,2.136,8.048,2.932c25.505,9.858,36.31,15.244,36.31,32.464C353.981,344.709,353.914,347.037,353.914,349.366z M386.647,258.823c-11.651,12.681-23.26,9.338-48.688-0.696c-2.028-0.788-4.708-1.902-7.882-3.292c3.125-1.499,5.754-2.738,7.765-3.601c24.968-11.057,36.443-14.892,48.588-2.714c1.566,1.726,3.183,3.41,4.842,5.025C389.696,255.263,388.171,257.03,386.647,258.823z"/>
    </svg>
);

export default function MyAppointmentsPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [appointments, setAppointments] = useState([]);
    const [historyBookings, setHistoryBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => setNotification({ ...notification, show: false }), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading) return;

        if (!profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }
        
        setLoading(true);

        // --- ใช้ Query แบบง่าย (Client-side Filtering) เพื่อป้องกันการค้าง ---
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where("userId", "==", profile.userId)
        );

        const unsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // --- กรองข้อมูลนัดหมายปัจจุบัน ---
            const activeStatus = ['awaiting_confirmation', 'confirmed', 'in_progress'];
            const filteredDocs = allDocs
                .filter(doc => activeStatus.includes(doc.status))
                .sort((a, b) => {
                    // เรียงวันที่จากน้อยไปมาก (ใกล้ถึงก่อน)
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateA - dateB;
                });

            setAppointments(filteredDocs);
            setLoading(false);
            
            // --- กรองประวัติย้อนหลัง ---
            const historyStatus = ["completed", "cancelled"];
            const historyDocs = allDocs
                .filter(doc => historyStatus.includes(doc.status))
                .sort((a, b) => {
                     // เรียงวันที่จากมากไปน้อย (ล่าสุดก่อน)
                    const dateA = new Date(`${a.date}T${a.time}`);
                    const dateB = new Date(`${b.date}T${b.time}`);
                    return dateB - dateA;
                });
            setHistoryBookings(historyDocs);

        }, (error) => {
            console.error("Error fetching appointments:", error);
            setNotification({ show: true, title: 'Error', message: 'Connection Error. Please retry.', type: 'error' });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleQrCodeClick = (appointmentId) => {
        setSelectedAppointmentId(appointmentId);
        setShowQrModal(true);
    };

    const handleCancelClick = (appointment) => {
        setAppointmentToCancel(appointment);
    };

    const confirmCancelAppointment = async () => {
        if (!appointmentToCancel || !profile?.userId) return;
        setIsCancelling(true);
        const result = await cancelAppointmentByUser(appointmentToCancel.id, profile.userId);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยกเลิกนัดหมายแล้ว', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsCancelling(false);
        setAppointmentToCancel(null);
    };

    const handleConfirmClick = async (appointment) => {
        if (!profile?.userId) return;
        setIsConfirming(true);
        const result = await confirmAppointmentByUser(appointment.id, profile.userId);
        if (result.success) {
            setNotification({ show: true, title: 'สำเร็จ', message: 'ยืนยันการนัดหมายเรียบร้อย', type: 'success' });
        } else {
            setNotification({ show: true, title: 'ผิดพลาด', message: result.error, type: 'error' });
        }
        setIsConfirming(false);
    };

    // --- Loading Screen ---
    if (liffLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <SpaFlowerIcon className="w-16 h-16 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
            </div>
        );
    }

    if (liffError) return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;

    return (
        <div>
            <CustomerHeader showBackButton={false} showActionButtons={true} />
            <div className="p-4 space-y-5">
            <Notification {...notification} />
            
            <ConfirmationModal
                show={!!appointmentToCancel}
                title="ยืนยันการยกเลิก"
                message={`คุณต้องการยกเลิกการนัดหมายบริการ ${appointmentToCancel?.serviceInfo.name} ใช่หรือไม่?`}
                onConfirm={confirmCancelAppointment}
                onCancel={() => setAppointmentToCancel(null)}
                isProcessing={isCancelling}
            />
            <QrCodeModal
                show={showQrModal}
                onClose={() => setShowQrModal(false)}
                appointmentId={selectedAppointmentId}
            />
            
            <div className="space-y-4">
                <div className="font-bold text-md text-gray-700">นัดหมายของฉัน</div>
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                         <SpaFlowerIcon className="w-14 h-14 animate-spin" color="#553734" style={{ animationDuration: '3s' }} />
                        <p className="text-sm text-gray-400 mt-2">Loading data...</p>
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl shadow-sm">
                        <p className="font-semibold">ไม่มีรายการนัดหมายที่กำลังดำเนินอยู่</p>
                    </div>
                ) : (
                    appointments.map((job) => (
                        <AppointmentCard
                            key={job.id}
                            job={job}
                            onQrCodeClick={handleQrCodeClick}
                            onCancelClick={handleCancelClick}
                            onConfirmClick={handleConfirmClick}
                            isConfirming={isConfirming}
                        />
                    ))
                )}
            </div>
            
            <div className="flex flex-col items-center mt-6">
                <button className="text-primary flex items-center gap-2 focus:outline-none" onClick={() => setShowHistory(v => !v)}>
                    <span className="text-md">{showHistory ? '▲ ซ่อนประวัติที่ผ่านมา' : '▼ ดูประวัติที่ผ่านมา'}</span>
                </button>
            </div>
            
            {showHistory && (
                <div className="space-y-4 mt-2">
                    <div className="text-sm text-gray-700">ประวัติการใช้บริการ</div>
                    {historyBookings.length === 0 ? (
                        <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-xl">
                            <p>ยังไม่มีประวัติการใช้บริการ</p>
                        </div>
                    ) : (
                        historyBookings.map(job => (
                            <HistoryCard
                                key={job.id}
                                appointment={job}
                                onBookAgain={() => { window.location.href = '/appointment'; }}
                            />
                        ))
                    )}
                </div>
            )}
            </div>
        </div>
    );
}
