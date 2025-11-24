"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import {
    saveProfileSettings,
    saveNotificationSettings,
    saveBookingSettings,
    savePointSettings,
    savePaymentSettings,
    saveCalendarSettings
} from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyNotificationsNow } from '@/app/actions/dailyNotificationActions';
import { useToast } from '@/app/components/Toast';

// --- Icons ---
const Icons = {
    Store: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Bell: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
    CreditCard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
    Gift: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>,
    Share: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    Save: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
};

// --- Helper Components ---

const SettingsCard = ({ title, icon: Icon, children, className = '' }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col ${className}`}>
        <div className="flex items-center gap-3 mb-6 border-b border-gray-50 pb-4">
            {Icon && <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Icon /></div>}
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        <div className="space-y-5 flex-grow">{children}</div>
    </div>
);

const Toggle = ({ label, checked, onChange, disabled = false }) => (
    <div className={`flex items-center justify-between ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" disabled={disabled} />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
        </label>
    </div>
);

const InputGroup = ({ label, type = "text", value, onChange, placeholder, className = "", ...props }) => (
    <div className={className}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 focus:bg-white text-sm"
            placeholder={placeholder}
            {...props}
        />
    </div>
);

const TextAreaGroup = ({ label, value, onChange, placeholder, rows = 3 }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
        <textarea
            value={value}
            onChange={onChange}
            rows={rows}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-gray-50/50 focus:bg-white text-sm"
            placeholder={placeholder}
        />
    </div>
);

// --- Main Page Component ---

export default function AdminSettingsPage() {
    // --- States ---
    const [settings, setSettings] = useState({
        allNotifications: { enabled: true },
        reportRecipients: [],
        adminNotifications: { enabled: true, newBooking: true, bookingCancelled: true, paymentReceived: true, customerConfirmed: true },
        customerNotifications: {
            enabled: true, newBooking: true, appointmentConfirmed: true, serviceCompleted: true,
            appointmentCancelled: true, appointmentReminder: true, reviewRequest: true,
            paymentInvoice: true, dailyAppointmentNotification: true
        },
    });
    const [bookingSettings, setBookingSettings] = useState({
        useBeautician: false, totalBeauticians: 1, bufferMinutes: 0, timeQueues: [],
        weeklySchedule: {}, holidayDates: [], _queueTime: '', _queueCount: '', _newHolidayDate: ''
    });
    const [pointSettings, setPointSettings] = useState({
        reviewPoints: 5, pointsPerCurrency: 100, pointsPerVisit: 1,
        enableReviewPoints: true, enablePurchasePoints: false, enableVisitPoints: false
    });
    const [paymentSettings, setPaymentSettings] = useState({
        method: 'promptpay', promptPayAccount: '', qrCodeImageUrl: '', bankInfoText: ''
    });
    const [calendarSettings, setCalendarSettings] = useState({ enabled: false, calendarId: '' });
    const [profileSettings, setProfileSettings] = useState({
        storeName: '', contactPhone: '', address: '', description: '', currency: '฿', currencySymbol: 'บาท',
    });

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const { showToast } = useToast();

    // --- Effects ---
    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const docs = ['notifications', 'booking', 'points', 'payment', 'calendar', 'profile'];
                const snaps = await Promise.all(docs.map(id => getDoc(doc(db, 'settings', id))));
                const [notifSnap, bookSnap, pointSnap, paySnap, calSnap, profSnap] = snaps;

                if (notifSnap.exists()) {
                    const data = notifSnap.data();
                    setSettings(prev => ({
                        ...prev, ...data,
                        customerNotifications: { ...prev.customerNotifications, ...data.customerNotifications, newBooking: data.customerNotifications?.newBooking ?? true }
                    }));
                }
                if (bookSnap.exists()) setBookingSettings(prev => ({ ...prev, ...bookSnap.data() }));
                if (pointSnap.exists()) setPointSettings(prev => ({ ...prev, ...pointSnap.data() }));
                if (paySnap.exists()) setPaymentSettings(prev => ({ ...prev, ...paySnap.data() }));
                if (calSnap.exists()) setCalendarSettings(prev => ({ ...prev, ...calSnap.data() }));
                if (profSnap.exists()) setProfileSettings(prev => ({ ...prev, ...profSnap.data() }));
            } catch (error) {
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    // --- Handlers ---
    const handleNotificationChange = async (group, key, value) => {
        setSettings(prev => {
            const newSettings = { ...prev, [group]: { ...prev[group], [key]: value } };
            if (group === 'allNotifications' && key === 'enabled' && !value) {
                newSettings.adminNotifications.enabled = false;
                newSettings.customerNotifications.enabled = false;
            }
            return newSettings;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const { updatedAt: nUp, ...notifData } = settings;
            const { updatedAt: bUp, ...bookData } = bookingSettings;
            const { updatedAt: pUp, ...pointData } = pointSettings;
            const { updatedAt: payUp, ...payData } = paymentSettings;
            const { updatedAt: cUp, ...calData } = calendarSettings;
            const { updatedAt: prUp, ...profData } = profileSettings;

            const results = await Promise.all([
                saveProfileSettings(profData),
                saveNotificationSettings(notifData),
                saveBookingSettings(bookData),
                savePointSettings(pointData),
                savePaymentSettings(payData),
                saveCalendarSettings(calData)
            ]);

            if (results.every(r => r.success)) {
                showToast('บันทึกการตั้งค่าทั้งหมดสำเร็จ!', 'success');
            } else {
                throw new Error('มีข้อผิดพลาดในการบันทึกบางส่วน');
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendNow = async (isMock = false) => {
        setIsSending(true);
        try {
            const result = await sendDailyNotificationsNow(isMock);
            if (result.success) {
                const { data } = result;
                const mode = isMock ? '🎭 ทดสอบสำเร็จ' : 'ส่งแจ้งเตือนสำเร็จ';
                const message = data ? `${mode}: จะส่ง ${data.sentCount}/${data.validStatusAppointments || data.totalAppointments} คน` : result.message;
                showToast(message, 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
        } finally {
            setIsSending(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ตั้งค่าระบบ</h1>
                        <p className="text-gray-500 mt-1">จัดการข้อมูลร้าน การจอง และการแจ้งเตือน</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
                    >
                        {isSaving ? 'กำลังบันทึก...' : <><Icons.Save /> บันทึกการตั้งค่า</>}
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Column 1: Profile & Booking */}
                    <div className="space-y-6">
                        <SettingsCard title="ข้อมูลร้าน" icon={Icons.Store}>
                            <InputGroup label="ชื่อร้าน" value={profileSettings.storeName} onChange={e => setProfileSettings({ ...profileSettings, storeName: e.target.value })} />
                            <InputGroup label="เบอร์โทรติดต่อ" type="tel" value={profileSettings.contactPhone} onChange={e => setProfileSettings({ ...profileSettings, contactPhone: e.target.value })} />
                            <TextAreaGroup label="ที่อยู่" value={profileSettings.address} onChange={e => setProfileSettings({ ...profileSettings, address: e.target.value })} />
                            <TextAreaGroup label="รายละเอียดร้าน (ไม่บังคับ)" value={profileSettings.description} onChange={e => setProfileSettings({ ...profileSettings, description: e.target.value })} />
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="หน่วยเงิน (ย่อ)" value={profileSettings.currency} onChange={e => setProfileSettings({ ...profileSettings, currency: e.target.value })} placeholder="฿" />
                                <InputGroup label="หน่วยเงิน (เต็ม)" value={profileSettings.currencySymbol} onChange={e => setProfileSettings({ ...profileSettings, currencySymbol: e.target.value })} placeholder="บาท" />
                            </div>
                        </SettingsCard>

                        <SettingsCard title="โหมดและคิวการจอง" icon={Icons.Calendar}>
                            <InputGroup label="Buffer (นาที) ระหว่างคิว" type="number" value={bookingSettings.bufferMinutes} onChange={e => setBookingSettings(bs => ({ ...bs, bufferMinutes: Number(e.target.value) }))} />
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                <Toggle label="โหมดเลือกช่าง" checked={bookingSettings.useBeautician} onChange={(value) => setBookingSettings(prev => ({ ...prev, useBeautician: value }))} />
                                <InputGroup label={bookingSettings.useBeautician ? 'จำนวนช่างทั้งหมด' : 'จำนวนคิวสูงสุด'} type="number" value={bookingSettings.totalBeauticians} onChange={e => setBookingSettings(prev => ({ ...prev, totalBeauticians: parseInt(e.target.value) || 1 }))} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">กำหนดคิว/ช่าง ตามช่วงเวลา</label>
                                <div className="flex gap-2 mb-3">
                                    <input type="time" value={bookingSettings._queueTime} onChange={e => setBookingSettings(prev => ({ ...prev, _queueTime: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <input type="number" value={bookingSettings._queueCount} onChange={e => setBookingSettings(prev => ({ ...prev, _queueCount: e.target.value }))} className="w-20 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="จำนวน" />
                                    <button type="button" onClick={() => setBookingSettings(prev => ({ ...prev, timeQueues: [...(prev.timeQueues || []), { time: prev._queueTime, count: parseInt(prev._queueCount) }].sort((a, b) => a.time.localeCompare(b.time)), _queueTime: '', _queueCount: '' }))} disabled={!bookingSettings._queueTime || !bookingSettings._queueCount} className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50"><Icons.Plus /></button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(bookingSettings.timeQueues || []).map(q => (
                                        <span key={q.time} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-medium border border-indigo-100">
                                            {q.time} ({q.count})
                                            <button type="button" className="text-indigo-400 hover:text-indigo-600" onClick={() => setBookingSettings(prev => ({ ...prev, timeQueues: prev.timeQueues.filter(x => x.time !== q.time) }))}>×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Column 2: Payment & Schedule */}
                    <div className="space-y-6">
                        <SettingsCard title="การชำระเงิน" icon={Icons.CreditCard}>
                            <div className="space-y-3">
                                {['promptpay', 'image', 'bankinfo'].map(method => (
                                    <label key={method} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${paymentSettings.method === method ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" name="paymentMethod" value={method} checked={paymentSettings.method === method} onChange={e => setPaymentSettings({ ...paymentSettings, method: e.target.value })} className="sr-only" />
                                        <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${paymentSettings.method === method ? 'border-indigo-600' : 'border-gray-400'}`}>
                                            {paymentSettings.method === method && <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">
                                            {method === 'promptpay' ? 'PromptPay' : method === 'image' ? 'รูปภาพ QR Code' : 'ข้อมูลบัญชีธนาคาร'}
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {paymentSettings.method === 'promptpay' && (
                                <InputGroup label="เบอร์ PromptPay" value={paymentSettings.promptPayAccount} onChange={e => setPaymentSettings({ ...paymentSettings, promptPayAccount: e.target.value })} placeholder="0812345678" />
                            )}
                            {paymentSettings.method === 'image' && (
                                <div>
                                    <InputGroup label="URL รูปภาพ QR Code" value={paymentSettings.qrCodeImageUrl} onChange={e => setPaymentSettings({ ...paymentSettings, qrCodeImageUrl: e.target.value })} placeholder="https://..." />
                                    {paymentSettings.qrCodeImageUrl && <div className="mt-3 relative h-32 w-32 border rounded-lg overflow-hidden"><img src={paymentSettings.qrCodeImageUrl} alt="QR" className="object-cover w-full h-full" /></div>}
                                </div>
                            )}
                            {paymentSettings.method === 'bankinfo' && (
                                <TextAreaGroup label="ข้อมูลบัญชีธนาคาร" value={paymentSettings.bankInfoText} onChange={e => setPaymentSettings({ ...paymentSettings, bankInfoText: e.target.value })} rows={5} placeholder="ชื่อธนาคาร, เลขบัญชี..." />
                            )}
                        </SettingsCard>

                        <SettingsCard title="เวลาทำการ" icon={Icons.Clock}>
                            {["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"].map((dayName, dayIndex) => {
                                const day = bookingSettings.weeklySchedule?.[dayIndex] || { isOpen: false, openTime: '09:00', closeTime: '18:00' };
                                return (
                                    <div key={dayIndex} className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-3">
                                            <Toggle checked={day.isOpen} onChange={(value) => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...day, isOpen: value } } }))} />
                                            <span className={`text-sm font-medium ${day.isOpen ? 'text-gray-900' : 'text-gray-400'}`}>{dayName}</span>
                                        </div>
                                        {day.isOpen && (
                                            <div className="flex items-center gap-2">
                                                <input type="time" value={day.openTime} onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...day, openTime: e.target.value } } }))} className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500" />
                                                <span className="text-gray-400 text-xs">-</span>
                                                <input type="time" value={day.closeTime} onChange={e => setBookingSettings(prev => ({ ...prev, weeklySchedule: { ...prev.weeklySchedule, [dayIndex]: { ...day, closeTime: e.target.value } } }))} className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </SettingsCard>

                        <SettingsCard title="วันหยุดพิเศษ" icon={Icons.Calendar}>
                            <div className="flex gap-2 mb-3">
                                <input type="date" value={bookingSettings._newHolidayDate} onChange={e => setBookingSettings(prev => ({ ...prev, _newHolidayDate: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" min={new Date().toISOString().split('T')[0]} />
                                <input type="text" value={bookingSettings._newHolidayReason} onChange={e => setBookingSettings(prev => ({ ...prev, _newHolidayReason: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="สาเหตุ" />
                                <button type="button" onClick={() => { if (!bookingSettings._newHolidayDate) return; setBookingSettings(prev => ({ ...prev, holidayDates: [...(prev.holidayDates || []), { date: prev._newHolidayDate, reason: prev._newHolidayReason }].sort((a, b) => a.date.localeCompare(b.date)), _newHolidayDate: '', _newHolidayReason: '' })) }} disabled={!bookingSettings._newHolidayDate} className="bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 disabled:opacity-50"><Icons.Plus /></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(bookingSettings.holidayDates || []).map(h => (
                                    <span key={h.date} className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-lg text-xs font-medium border border-red-100">
                                        {h.date} {h.reason && `(${h.reason})`}
                                        <button type="button" className="text-red-400 hover:text-red-600" onClick={() => setBookingSettings(prev => ({ ...prev, holidayDates: prev.holidayDates.filter(x => x.date !== h.date) }))}>×</button>
                                    </span>
                                ))}
                            </div>
                        </SettingsCard>
                    </div>

                    {/* Column 3: Notifications, Points, Integrations */}
                    <div className="space-y-6">
                        <SettingsCard title="การแจ้งเตือน LINE" icon={Icons.Bell}>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                                <Toggle label="เปิดการแจ้งเตือนทั้งหมด" checked={settings.allNotifications.enabled} onChange={(value) => handleNotificationChange('allNotifications', 'enabled', value)} />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">สำหรับ Admin</h3>
                                    <div className="space-y-3 pl-2 border-l-2 border-gray-100">
                                        <Toggle label="เปิดแจ้งเตือน Admin" checked={settings.adminNotifications.enabled} onChange={(value) => handleNotificationChange('adminNotifications', 'enabled', value)} disabled={!settings.allNotifications.enabled} />
                                        {settings.adminNotifications.enabled && (
                                            <>
                                                <Toggle label="เมื่อมีการจองใหม่" checked={settings.adminNotifications.newBooking} onChange={(value) => handleNotificationChange('adminNotifications', 'newBooking', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อลูกค้ายืนยัน" checked={settings.adminNotifications.customerConfirmed} onChange={(value) => handleNotificationChange('adminNotifications', 'customerConfirmed', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อมีการยกเลิก" checked={settings.adminNotifications.bookingCancelled} onChange={(value) => handleNotificationChange('adminNotifications', 'bookingCancelled', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อมีการชำระเงิน" checked={settings.adminNotifications.paymentReceived} onChange={(value) => handleNotificationChange('adminNotifications', 'paymentReceived', value)} disabled={!settings.allNotifications.enabled} />
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">สำหรับลูกค้า</h3>
                                    <div className="space-y-3 pl-2 border-l-2 border-gray-100">
                                        <Toggle label="เปิดแจ้งเตือนลูกค้า" checked={settings.customerNotifications.enabled} onChange={(value) => handleNotificationChange('customerNotifications', 'enabled', value)} disabled={!settings.allNotifications.enabled} />
                                        {settings.customerNotifications.enabled && (
                                            <>
                                                <Toggle label="เมื่อมีการจองใหม่" checked={settings.customerNotifications.newBooking} onChange={(value) => handleNotificationChange('customerNotifications', 'newBooking', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อยืนยันนัดหมาย" checked={settings.customerNotifications.appointmentConfirmed} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentConfirmed', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อบริการเสร็จสิ้น" checked={settings.customerNotifications.serviceCompleted} onChange={(value) => handleNotificationChange('customerNotifications', 'serviceCompleted', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="เมื่อยกเลิกนัดหมาย" checked={settings.customerNotifications.appointmentCancelled} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentCancelled', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="แจ้งเตือนล่วงหน้า 1 ชม." checked={settings.customerNotifications.appointmentReminder} onChange={(value) => handleNotificationChange('customerNotifications', 'appointmentReminder', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="แจ้งเตือนประจำวัน (08:00)" checked={settings.customerNotifications.dailyAppointmentNotification} onChange={(value) => handleNotificationChange('customerNotifications', 'dailyAppointmentNotification', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="แจ้งเตือนชำระเงิน" checked={settings.customerNotifications.paymentInvoice} onChange={(value) => handleNotificationChange('customerNotifications', 'paymentInvoice', value)} disabled={!settings.allNotifications.enabled} />
                                                <Toggle label="แจ้งเตือนขอรีวิว" checked={settings.customerNotifications.reviewRequest} onChange={(value) => handleNotificationChange('customerNotifications', 'reviewRequest', value)} disabled={!settings.allNotifications.enabled} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </SettingsCard>

                        <SettingsCard title="ระบบสะสมพ้อยต์" icon={Icons.Gift}>
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <Toggle label="ให้พ้อยต์หลังรีวิว" checked={pointSettings.enableReviewPoints} onChange={(value) => setPointSettings(prev => ({ ...prev, enableReviewPoints: value }))} />
                                    {pointSettings.enableReviewPoints && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <InputGroup label="พ้อยต์ที่ได้" type="number" value={pointSettings.reviewPoints} onChange={e => setPointSettings(prev => ({ ...prev, reviewPoints: parseInt(e.target.value) || 5 }))} />
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <Toggle label="ให้พ้อยต์ตามยอดซื้อ" checked={pointSettings.enablePurchasePoints} onChange={(value) => setPointSettings(prev => ({ ...prev, enablePurchasePoints: value }))} />
                                    {pointSettings.enablePurchasePoints && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <InputGroup label={`ยอดซื้อกี่ ${profileSettings.currencySymbol} ต่อ 1 พ้อยต์`} type="number" value={pointSettings.pointsPerCurrency} onChange={e => setPointSettings(prev => ({ ...prev, pointsPerCurrency: parseInt(e.target.value) || 100 }))} />
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    <Toggle label="ให้พ้อยต์ต่อครั้งที่มา" checked={pointSettings.enableVisitPoints} onChange={(value) => setPointSettings(prev => ({ ...prev, enableVisitPoints: value }))} />
                                    {pointSettings.enableVisitPoints && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <InputGroup label="พ้อยต์ที่ได้" type="number" value={pointSettings.pointsPerVisit} onChange={e => setPointSettings(prev => ({ ...prev, pointsPerVisit: parseInt(e.target.value) || 1 }))} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </SettingsCard>

                        <SettingsCard title="Google Calendar" icon={Icons.Share}>
                            <Toggle label="เปิดการเชื่อมต่อ" checked={calendarSettings.enabled} onChange={(value) => setCalendarSettings(prev => ({ ...prev, enabled: value }))} />
                            {calendarSettings.enabled && (
                                <div className="mt-4">
                                    <InputGroup label="Calendar ID" value={calendarSettings.calendarId} onChange={e => setCalendarSettings(prev => ({ ...prev, calendarId: e.target.value }))} placeholder="your-email@group.calendar.google.com" />
                                    <p className="text-xs text-gray-500 mt-2">ต้องแชร์ปฏิทินให้ Service Account Email ด้วย</p>
                                </div>
                            )}
                        </SettingsCard>

                        <SettingsCard title="ทดสอบระบบ" icon={Icons.Check}>
                            <p className="text-xs text-gray-500 mb-4">ส่งแจ้งเตือนประจำวัน (Manual Trigger)</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => handleSendNow(true)} disabled={isSending} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 text-sm transition-colors">
                                    {isSending ? '...' : '🎭 ทดสอบ'}
                                </button>
                                <button onClick={() => handleSendNow(false)} disabled={isSending} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 text-sm transition-colors shadow-md shadow-blue-200">
                                    {isSending ? '...' : '🚀 ส่งจริง'}
                                </button>
                            </div>
                        </SettingsCard>
                    </div>
                </div>
            </div>
        </div>
    );
}