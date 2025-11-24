// src/app/(employee)/check-in/page.js
"use client";

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { findAppointmentsByPhone, findAppointmentById, updateAppointmentStatus, updatePaymentStatusByEmployee } from '@/app/actions/employeeActions';
import EmployeeHeader from '@/app/components/EmployeeHeader';
import { format, parseISO, differenceInMinutes, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';
import { getPaymentSettings } from '@/app/actions/settingsActions';
import QRCode from 'qrcode';
import generatePayload from 'promptpay-qr';
import { useToast } from '@/app/components/Toast';
import { Notification, ConfirmationModal } from '@/app/components/common/NotificationComponent'; // [1] ตรวจสอบ import

// --- Modal สำหรับแสดง QR Code ชำระเงิน ---
const PaymentQrModal = ({ show, onClose, appointment, profile }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show && appointment) {
            const generateQR = async () => {
                setLoading(true);
                setError('');
                setQrCodeUrl('');
                try {
                    const settingsResult = await getPaymentSettings();
                    if (!settingsResult.success) throw new Error(settingsResult.error || "ไม่พบการตั้งค่าการชำระเงิน");

                    const { settings } = settingsResult;
                    if (settings.method === 'image') {
                        if (!settings.qrCodeImageUrl) throw new Error("แอดมินยังไม่ได้ตั้งค่ารูปภาพ QR Code");
                        setQrCodeUrl(settings.qrCodeImageUrl);
                    } else if (settings.method === 'promptpay') {
                        if (!settings.promptPayAccount) throw new Error("แอดมินยังไม่ได้ตั้งค่าบัญชี PromptPay");
                        const amount = appointment.paymentInfo.totalPrice;
                        const payload = generatePayload(settings.promptPayAccount, { amount });
                        const url = await QRCode.toDataURL(payload);
                        setQrCodeUrl(url);
                    } else {
                        throw new Error("รูปแบบการชำระเงินไม่ถูกต้อง");
                    }
                } catch (err) {
                    setError(err.message);
                } finally {
                    setLoading(false);
                }
            };
            generateQR();
        }
    }, [show, appointment]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[100] p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-bold mb-1 text-gray-800">Scan to Pay</h2>
                <p className="text-2xl font-bold text-blue-600 mb-3">{appointment.paymentInfo.totalPrice?.toLocaleString()} {profile.currencySymbol}</p>
                <div className="h-64 w-64 mx-auto flex items-center justify-center">
                    {loading ? <p>กำลังสร้าง QR Code...</p> :
                        error ? <p className="text-red-500 text-sm">{error}</p> :
                            qrCodeUrl && <Image src={qrCodeUrl} alt="Payment QR Code" width={256} height={256} style={{ objectFit: 'contain' }} />}
                </div>
                <button onClick={onClose} className="mt-4 w-full bg-gray-200 text-gray-800 py-2 rounded-xl font-semibold">ปิด</button>
            </div>
        </div>
    );
};

// --- Modal หลักสำหรับจัดการนัดหมาย (แก้ไขเพิ่ม Confirmation) ---
const ManagementModal = ({ appointment, onClose, onAction, profile }) => {
    const [showQr, setShowQr] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // [2] State สำหรับ Confirmation Modal
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', action: null });

    const { showToast } = useToast();

    if (!appointment) return null;

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const isCheckedIn = appointment.status === 'in_progress';

    // ฟังก์ชันเรียก Action จริงๆ หลังจากยืนยันแล้ว
    const executeConfirmAction = async () => {
        if (confirmModal.action) {
            await confirmModal.action();
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const handleUpdatePayment = async () => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const result = await updatePaymentStatusByEmployee(appointment.id, profile.userId);
        if (result.success) {
            showToast('อัปเดตสถานะการชำระเงินสำเร็จ!', 'success');
            onAction({ ...appointment, paymentInfo: { ...appointment.paymentInfo, paymentStatus: 'paid' } });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleCheckIn = async () => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const result = await updateAppointmentStatus(appointment.id, 'in_progress', profile.userId, 'Customer checked in');
        if (result.success) {
            showToast('ยืนยันการเข้ารับบริการสำเร็จ!', 'success');
            onAction({ ...appointment, status: 'in_progress' });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    };

    const handleStatusChange = async (newStatus) => {
        if (!profile?.userId) return showToast("ไม่สามารถระบุตัวตนพนักงานได้", "error");

        setIsUpdating(true);
        const result = await updateAppointmentStatus(appointment.id, newStatus, profile.userId, `Status updated to ${newStatus}`);
        if (result.success) {
            showToast('อัปเดตสถานะสำเร็จ!', 'success');
            onAction({ ...appointment, status: newStatus });
        } else {
            showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
        }
        setIsUpdating(false);
    }

    // [3] ฟังก์ชันเรียก Modal ยืนยัน
    const confirmPayment = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการชำระเงิน",
            message: "ยืนยันว่าลูกค้าได้ชำระเงินครบถ้วนแล้วใช่หรือไม่?",
            action: handleUpdatePayment
        });
    };

    const confirmComplete = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันเสร็จสิ้นบริการ",
            message: "ต้องการบันทึกว่าการบริการนี้เสร็จสิ้นแล้วใช่หรือไม่?",
            action: () => handleStatusChange('completed')
        });
    };

    const confirmCancel = () => {
        setConfirmModal({
            show: true,
            title: "ยืนยันการยกเลิก",
            message: "คุณต้องการยกเลิกนัดหมายนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
            action: () => handleStatusChange('cancelled')
        });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50" onClick={onClose}></div>
            <div className="fixed bottom-0 left-0 right-0 bg-gray-100 rounded-t-2xl shadow-lg p-5 z-50 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">จัดการนัดหมาย</h2>
                    <button onClick={onClose} className="text-gray-500 text-2xl">&times;</button>
                </div>

                {/* --- Appointment Info --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName}</p>
                    <p className="text-sm text-gray-600 font-semibold mb-2">{appointment.serviceInfo.name}</p>

                    {/* Multi-area service details */}
                    {appointment.serviceInfo?.serviceType === 'multi-area' && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs">
                            {appointment.serviceInfo?.selectedArea && (
                                <p className="text-gray-700">📍 {appointment.serviceInfo.selectedArea.name}</p>
                            )}
                            {appointment.serviceInfo?.selectedPackage && (
                                <div className="text-gray-600 flex justify-between items-center">
                                    <span>📦 {appointment.serviceInfo.selectedPackage.name}</span>
                                    <span className="text-gray-500">{appointment.serviceInfo.selectedPackage.duration} นาที</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Option-based service details */}
                    {appointment.serviceInfo?.serviceType === 'option-based' && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            {appointment.serviceInfo?.selectedOptionName && (
                                <div className="flex justify-between items-center">
                                    <p className="text-gray-700 font-medium flex-1">
                                        🏷️ {appointment.serviceInfo.selectedOptionName}
                                        {appointment.serviceInfo.selectedAreas?.length > 0 && (
                                            <span className="text-gray-500"> x {appointment.serviceInfo.selectedAreas.length} จุด</span>
                                        )}
                                    </p>
                                    {appointment.serviceInfo.selectedOptionDuration && (
                                        <span className="text-gray-500 ml-2">{appointment.serviceInfo.selectedOptionDuration} นาที/จุด</span>
                                    )}
                                </div>
                            )}
                            {appointment.serviceInfo?.selectedAreas?.length > 0 && (
                                <p className="text-gray-600 pl-4">({appointment.serviceInfo.selectedAreas.join(', ')})</p>
                            )}
                        </div>
                    )}

                    {/* Area-based-options service details */}
                    {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions?.length > 0 && (
                        <div className="bg-gray-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            {appointment.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="text-gray-700">🔸 {opt.areaName} ({opt.optionName})</span>
                                    <div className="text-gray-500 flex items-center gap-1">
                                        {opt.duration && <span>{opt.duration} นาที</span>}
                                        {opt.duration && opt.price && <span>•</span>}
                                        {opt.price && <span>{Number(opt.price).toLocaleString()} {profile.currencySymbol}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add-ons */}
                    {appointment.appointmentInfo?.addOns?.length > 0 && (
                        <div className="bg-blue-50 p-2 rounded-lg mb-2 text-xs space-y-1">
                            <p className="font-semibold text-blue-800">บริการเสริม:</p>
                            {appointment.appointmentInfo.addOns.map((addon, idx) => (
                                <div key={idx} className="flex justify-between items-center text-blue-700">
                                    <span>+ {addon.name}</span>
                                    <div className="flex items-center gap-1 text-blue-600">
                                        {addon.duration && <span>{addon.duration} นาที</span>}
                                        {addon.duration && addon.price && <span>•</span>}
                                        {addon.price && <span>{Number(addon.price).toLocaleString()} {profile.currencySymbol}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <hr className="my-2" />
                    <p className="text-sm"><strong>วันที่:</strong> {format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th })}</p>
                    <p className="text-sm"><strong>เวลา:</strong> {appointment.time} น.</p>
                </div>

                {/* --- Payment Section --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <h3 className="font-semibold text-md mb-3">การชำระเงิน</h3>
                    <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-lg">{appointment.paymentInfo.totalPrice?.toLocaleString()} {profile.currencySymbol}</span>
                        <span className={`font-semibold px-3 py-1 rounded-full text-sm ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {isPaid ? 'ชำระเงินแล้ว' : 'ยังไม่ชำระ'}
                        </span>
                    </div>
                    {!isPaid && (
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setShowQr(true)} disabled={isUpdating} className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300">แสดง QR</button>
                            {/* เปลี่ยนมาใช้ confirmPayment */}
                            <button onClick={confirmPayment} disabled={isUpdating} className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300">ยืนยันชำระเงิน</button>
                        </div>
                    )}
                </div>

                {/* --- Check-in Section --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
                    <h3 className="font-semibold text-md mb-3">การเข้ารับบริการ</h3>
                    {isCheckedIn ? (
                        <p className="text-center text-green-600 font-semibold bg-green-50 p-3 rounded-lg">ลูกค้าเข้ารับบริการแล้ว</p>
                    ) : (
                        <button onClick={handleCheckIn} disabled={isUpdating || !['pending', 'confirmed', 'awaiting_confirmation'].includes(appointment.status)} className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg disabled:bg-gray-300">
                            ยืนยันการเข้ารับบริการ
                        </button>
                    )}
                </div>

                {/* --- Other Actions --- */}
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <h3 className="font-semibold text-md mb-3">การดำเนินการอื่นๆ</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {/* เปลี่ยนมาใช้ confirmComplete และ confirmCancel */}
                        <button onClick={confirmComplete} disabled={isUpdating || appointment.status === 'completed'} className="w-full bg-gray-600 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300">เสร็จสิ้นบริการ</button>
                        <button onClick={confirmCancel} disabled={isUpdating || appointment.status === 'cancelled'} className="w-full bg-red-500 text-white py-2 rounded-lg font-semibold disabled:bg-gray-300">ยกเลิกนัด</button>
                    </div>
                </div>
            </div>

            <PaymentQrModal show={showQr} onClose={() => setShowQr(false)} appointment={appointment} profile={profile} />

            {/* [4] เพิ่ม Component Modal ยืนยัน */}
            <ConfirmationModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={executeConfirmAction}
                onCancel={() => setConfirmModal({ ...confirmModal, show: false })}
                isProcessing={isUpdating}
            />
        </>
    );
};


// --- Card แสดงข้อมูลนัดหมาย (เหมือนเดิม) ---
const AppointmentCard = ({ appointment, onManage }) => {
    const { profile } = useProfile();
    const appointmentDateTime = useMemo(() => {
        const [hours, minutes] = appointment.time.split(':');
        return parseISO(appointment.date).setHours(hours, minutes);
    }, [appointment.date, appointment.time]);

    const checkInStatus = useMemo(() => {
        const diff = differenceInMinutes(appointmentDateTime, new Date());
        // [แก้ไขเล็กน้อย] ถ้ากำลังใช้บริการ ให้แสดงสถานะที่เหมาะสม
        if (appointment.status === 'in_progress') {
            return { text: 'กำลังใช้บริการ', color: 'text-blue-600' };
        }
        if (appointment.status !== 'pending' && appointment.status !== 'confirmed' && appointment.status !== 'awaiting_confirmation') {
            return { text: '', color: '' };
        }
        if (diff > 60) {
            return { text: 'เช็คอินล่วงหน้า', color: 'text-blue-600' };
        }
        if (diff < -30) {
            return { text: 'เลยเวลานัดหมาย', color: 'text-red-600' };
        }
        return { text: 'สามารถเช็คอินได้', color: 'text-green-600' };
    }, [appointmentDateTime, appointment.status]);

    const isPaid = appointment.paymentInfo?.paymentStatus === 'paid';
    const statusInfo = {
        awaiting_confirmation: { label: 'รอการยืนยัน', color: 'bg-yellow-100 text-yellow-800' },
        confirmed: { label: 'ยืนยันแล้ว', color: 'bg-teal-100 text-teal-800' },
        pending: { label: 'รอใช้บริการ', color: 'bg-gray-200 text-gray-800' },
        in_progress: { label: 'กำลังใช้บริการ', color: 'bg-blue-100 text-blue-800' },
        completed: { label: 'เสร็จสิ้น', color: 'bg-green-100 text-green-800' },
        cancelled: { label: 'ยกเลิก', color: 'bg-red-100 text-red-800' }
    }[appointment.status] || { label: 'ไม่ระบุ', color: 'bg-gray-100' };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200 space-y-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-lg">{appointment.customerInfo.fullName}</p>
                    <p className="text-sm text-gray-600 font-semibold">{appointment.serviceInfo.name}</p>

                    {/* Service type details */}
                    {appointment.serviceInfo?.serviceType === 'option-based' && appointment.serviceInfo?.selectedOptionName && (
                        <p className="text-xs text-gray-500 mt-1">🏷️ {appointment.serviceInfo.selectedOptionName}</p>
                    )}
                    {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions?.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">🔸 {appointment.serviceInfo.selectedAreaOptions.length} รายการ</p>
                    )}
                    {appointment.serviceInfo?.serviceType === 'multi-area' && appointment.serviceInfo?.selectedArea && (
                        <p className="text-xs text-gray-500 mt-1">📍 {appointment.serviceInfo.selectedArea.name}</p>
                    )}
                </div>
                <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {isPaid ? 'ชำระแล้ว' : 'ยังไม่ชำระ'}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                </div>
            </div>
            <div className="text-sm text-gray-700 border-t pt-3">
                <p><strong>วันที่:</strong> {format(parseISO(appointment.date), 'dd MMMM yyyy', { locale: th })}</p>
                <p><strong>เวลา:</strong> {appointment.time} น.</p>
                <p><strong>ยอดชำระ:</strong> <span className="font-bold">{appointment.paymentInfo.totalPrice?.toLocaleString()} {profile.currencySymbol}</span></p>
            </div>
            <div className="border-t pt-3 text-center">
                <p className={`font-semibold mb-2 ${checkInStatus.color}`}>{checkInStatus.text}</p>
                <button
                    onClick={() => onManage(appointment)}
                    className="w-full font-bold py-2.5 rounded-lg transition-colors bg-indigo-500 text-white hover:bg-indigo-600"
                >
                    จัดการนัดหมาย
                </button>
            </div>
        </div>
    );
};

// --- หน้าหลัก ---
export default function CheckInPage() {
    const { liff, profile, loading: liffLoading } = useLiffContext();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const { showToast } = useToast();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!phoneNumber) return;
        const sanitizedPhoneNumber = phoneNumber.replace(/[\s-()]/g, '');
        setLoading(true);
        setMessage('');
        setAppointments([]);
        const result = await findAppointmentsByPhone(sanitizedPhoneNumber);
        if (result.success) {
            if (result.appointments.length > 0) {
                setAppointments(result.appointments);
            } else {
                setMessage('ไม่พบการนัดหมายสำหรับเบอร์โทรนี้');
            }
        } else {
            setMessage(`เกิดข้อผิดพลาด: ${result.error}`);
        }
        setLoading(false);
    };

    const handleScan = async () => {
        if (!liff || !liff.isInClient()) {
            showToast('ฟังก์ชันสแกน QR ใช้งานได้บน LINE เท่านั้น', 'error');
            return;
        }
        try {
            const result = await liff.scanCodeV2();
            if (result && result.value) {
                setLoading(true);
                setMessage('กำลังค้นหาข้อมูล...');
                const searchResult = await findAppointmentById(result.value);
                if (searchResult.success) {
                    setAppointments([searchResult.appointment]);
                    setMessage('');
                } else {
                    setMessage(`ไม่พบข้อมูล: ${searchResult.error}`);
                }
                setLoading(false);
            }
        } catch (error) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message || 'ไม่สามารถสแกน QR Code ได้'}`);
        }
    };

    const handleOpenModal = (appointment) => {
        setSelectedAppointment(appointment);
    };

    const handleCloseModal = () => {
        setSelectedAppointment(null);
    };

    const handleActionInModal = (updatedAppointment) => {
        setAppointments(prev => prev.map(app => app.id === updatedAppointment.id ? updatedAppointment : app));
        setSelectedAppointment(updatedAppointment);

        if (updatedAppointment.status === 'cancelled') {
            setAppointments(prev => prev.filter(app => app.id !== updatedAppointment.id));
            handleCloseModal();
        }
    };

    return (
        <div>
            <EmployeeHeader />
            {selectedAppointment && (
                <ManagementModal
                    appointment={selectedAppointment}
                    onClose={handleCloseModal}
                    onAction={handleActionInModal}
                    profile={profile}
                />
            )}
            <div className="p-4 space-y-6">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <form onSubmit={handleSearch}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ค้นหาด้วยเบอร์โทรศัพท์</label>
                        <div className="flex space-x-2">
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="กรอกเบอร์โทรลูกค้า"
                                className="flex-1 p-2 border rounded-md"
                            />
                            <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md" disabled={loading}>
                                {loading ? '...' : 'ค้นหา'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="text-center">
                    <p className="mb-2 text-gray-600">หรือ</p>
                    <button
                        onClick={handleScan}
                        className="w-full max-w-xs mx-auto bg-gray-800 text-white font-bold py-3 rounded-lg hover:bg-gray-700"
                        disabled={liffLoading || loading}
                    >
                        สแกน QR Code
                    </button>
                </div>

                <div className="space-y-4">
                    {loading && <p className="text-center">กำลังค้นหา...</p>}
                    {message && <p className="text-center text-red-500 bg-red-50 p-3 rounded-lg">{message}</p>}
                    {appointments.map(app => (
                        <AppointmentCard
                            key={app.id}
                            appointment={app}
                            onManage={handleOpenModal}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
