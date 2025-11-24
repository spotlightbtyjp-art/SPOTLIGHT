"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { navigateToDetail } from '@/lib/navigateToDetail';
import { cancelAppointmentByAdmin } from '@/app/actions/appointmentActions';
import { format, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons (Inline SVGs for simplicity) ---
const Icons = {
    Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    User: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    Filter: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>,
    ChevronLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>,
    ChevronRight: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>,
};

// --- Modal Component ---
function CancelAppointmentModal({ appointment, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async () => {
        if (!reason.trim()) { alert('กรุณาระบุเหตุผลการยกเลิก'); return; }
        setIsSubmitting(true);
        await onConfirm(appointment.id, reason);
        setIsSubmitting(false);
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md transform transition-all scale-100">
                <h2 className="text-xl font-bold mb-2 text-gray-800">ยืนยันการยกเลิกนัดหมาย</h2>
                <p className="text-sm text-gray-600 mb-4">คุณต้องการยกเลิกการนัดหมายของ <span className="font-semibold text-gray-900">{appointment.customerInfo.name}</span> ใช่หรือไม่?</p>
                <div>
                    <label htmlFor="cancellationReason" className="block text-sm font-medium text-gray-700 mb-1">เหตุผลการยกเลิก <span className="text-red-500">*</span></label>
                    <textarea id="cancellationReason" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none transition-all resize-none text-sm" placeholder="ระบุเหตุผล..."></textarea>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm">ปิด</button>
                    <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium disabled:bg-gray-300 transition-colors text-sm shadow-sm shadow-red-200">{isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}</button>
                </div>
            </div>
        </div>
    );
}

// --- Status Config ---
const STATUS_CONFIG = {
    awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' },
    confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' },
    in_progress: { label: 'กำลังบริการ', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500' },
    completed: { label: 'เสร็จสิ้น', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', dot: 'bg-green-500' },
    cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' },
};

const TABS = [
    { key: 'in_progress', label: 'กำลังบริการ' },
    { key: 'confirmed', label: 'ยืนยันแล้ว' },
    { key: 'awaiting_confirmation', label: 'รอยืนยัน' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

// --- Components ---

const StatCard = ({ title, value, subValue, icon: Icon, colorClass, onClick, active }) => (
    <div
        onClick={onClick}
        className={`bg-white p-5 rounded-2xl shadow-sm border transition-all cursor-pointer hover:shadow-md ${active ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-100'
            }`}
    >
        <div className="flex items-start justify-between">
            <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
                {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClass.split(' ')[0]} text-white shadow-md`}>
                <Icon />
            </div>
        </div>
    </div>
);

const AppointmentCard = ({ appointment, onCancelClick }) => {
    const { profile } = useProfile();
    const router = useRouter();
    const status = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.cancelled;
    const appointmentDate = appointment.appointmentInfo?.dateTime?.toDate();

    const mainDuration = appointment.serviceInfo?.duration || appointment.appointmentInfo?.duration || 0;
    const addOns = appointment.appointmentInfo?.addOns || appointment.addOns || [];
    const totalDuration = mainDuration + addOns.reduce((sum, a) => sum + (a.duration || 0), 0);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-lg transition-all duration-200 group relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${status.bg.replace('bg-', 'bg-opacity-100 ')}`}></div>

            <div className="flex justify-between items-start mb-4 pl-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg">
                        {appointment.customerInfo?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-sm line-clamp-1">{appointment.customerInfo?.fullName || appointment.customerInfo?.name}</h3>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <Icons.Phone />
                            <span>{appointment.customerInfo?.phone}</span>
                        </div>
                    </div>
                </div>
                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide shadow-sm ${status.bg} ${status.text} border ${status.border}`}>
                    {status.label}
                </span>
            </div>

            <div className="pl-2 space-y-3">
                <div className="bg-gray-50 rounded-xl p-3">
                    <p className="font-semibold text-gray-800 text-sm mb-1">{appointment.serviceInfo?.name}</p>
                    {appointment.serviceInfo?.serviceType === 'multi-area' && appointment.serviceInfo?.selectedArea && (
                        <p className="text-xs text-gray-500 mb-1">📍 {appointment.serviceInfo.selectedArea.name}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Icons.Clock />
                        <span>{totalDuration} นาที</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-medium text-gray-700">{(appointment.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Icons.Calendar />
                    <span>{appointmentDate ? format(appointmentDate, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'}</span>
                </div>
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end gap-2 pl-2">
                {appointment.status === 'awaiting_confirmation' && (
                    <button onClick={() => navigateToDetail(router, appointment.id)} className="flex-1 bg-gray-900 hover:bg-black text-white text-xs font-medium py-2 px-4 rounded-xl transition-colors">
                        ยืนยัน
                    </button>
                )}
                <button onClick={() => navigateToDetail(router, appointment.id)} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium rounded-xl transition-colors">
                    รายละเอียด
                </button>
            </div>
        </div>
    );
};

// --- Main Page ---
export default function AdminDashboardPage() {
    const [allAppointments, setAllAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [appointmentToCancel, setAppointmentToCancel] = useState(null);
    const [activeTab, setActiveTab] = useState('confirmed');
    const [viewMode, setViewMode] = useState('grid');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const { profile, loading: profileLoading } = useProfile();
    const router = useRouter();

    const [filters, setFilters] = useState({
        startDate: format(startOfDay(new Date()), 'yyyy-MM-dd'),
        endDate: format(endOfDay(new Date()), 'yyyy-MM-dd'),
        search: '',
    });

    useEffect(() => {
        const q = query(collection(db, 'appointments'), orderBy('appointmentInfo.dateTime', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setAllAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const filteredAppointments = useMemo(() => {
        const start = startOfDay(parseISO(filters.startDate));
        const end = endOfDay(parseISO(filters.endDate));
        const search = filters.search.toLowerCase();

        return allAppointments.filter(app => {
            const date = app.appointmentInfo?.dateTime?.toDate();
            if (!date || date < start || date > end) return false;
            if (search && !app.customerInfo?.fullName?.toLowerCase().includes(search) && !app.customerInfo?.phone?.includes(search)) return false;
            return true;
        });
    }, [allAppointments, filters]);

    // Stats Calculation
    const stats = useMemo(() => {
        const today = new Date();
        const todayApps = allAppointments.filter(a => isSameDay(a.appointmentInfo?.dateTime?.toDate(), today));
        const pending = allAppointments.filter(a => a.status === 'awaiting_confirmation');
        const revenue = filteredAppointments.reduce((sum, a) => sum + (a.status !== 'cancelled' ? (a.paymentInfo?.totalPrice || 0) : 0), 0);

        return {
            todayCount: todayApps.length,
            pendingCount: pending.length,
            totalRevenue: revenue,
            totalFiltered: filteredAppointments.length
        };
    }, [allAppointments, filteredAppointments]);

    const tabAppointments = filteredAppointments.filter(a => {
        if (activeTab === 'all') return true;
        return a.status === activeTab;
    });

    const totalPages = Math.ceil(tabAppointments.length / itemsPerPage);
    const currentItems = tabAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => setCurrentPage(1), [activeTab, filters]);

    if (loading || profileLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
            {appointmentToCancel && <CancelAppointmentModal appointment={appointmentToCancel} onClose={() => setAppointmentToCancel(null)} onConfirm={async (id, reason) => {
                const res = await cancelAppointmentByAdmin(id, reason);
                alert(res.success ? 'ยกเลิกสำเร็จ' : res.error);
            }} />}

            {/* Header & Stats */}
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ภาพรวมการนัดหมาย</h1>
                        <p className="text-gray-500 mt-1">จัดการการจองและดูสถิติประจำวันของคุณ</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                        <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="นัดหมายวันนี้"
                        value={stats.todayCount}
                        subValue="รายการ"
                        icon={Icons.Calendar}
                        colorClass="bg-blue-500 text-blue-600"
                        onClick={() => {
                            setFilters(prev => ({
                                ...prev,
                                startDate: format(new Date(), 'yyyy-MM-dd'),
                                endDate: format(new Date(), 'yyyy-MM-dd')
                            }));
                            setActiveTab('all');
                        }}
                        active={isSameDay(parseISO(filters.startDate), new Date()) && isSameDay(parseISO(filters.endDate), new Date())}
                    />
                    <StatCard
                        title="รอยืนยัน"
                        value={stats.pendingCount}
                        subValue="รายการ"
                        icon={Icons.Clock}
                        colorClass="bg-yellow-500 text-yellow-600"
                        onClick={() => setActiveTab('awaiting_confirmation')}
                        active={activeTab === 'awaiting_confirmation'}
                    />
                    <StatCard
                        title="รายได้ (ช่วงที่เลือก)"
                        value={`${stats.totalRevenue.toLocaleString()}`}
                        subValue={profile.currencySymbol}
                        icon={() => <span className="text-xl font-bold">฿</span>}
                        colorClass="bg-green-500 text-green-600"
                    />
                    <StatCard
                        title="ทั้งหมด (ช่วงที่เลือก)"
                        value={stats.totalFiltered}
                        subValue="รายการ"
                        icon={Icons.User}
                        colorClass="bg-purple-500 text-purple-600"
                        onClick={() => setActiveTab('all')}
                        active={activeTab === 'all'}
                    />
                </div>

                {/* Filters & Tabs */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === 'all' ? 'bg-gray-900 text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                ทั้งหมด
                            </button>
                            {TABS.map(tab => (
                                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${activeTab === tab.key ? 'bg-gray-900 text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                    {tab.label}
                                    <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab.key ? 'bg-white/20' : 'bg-gray-200'}`}>
                                        {filteredAppointments.filter(a => a.status === tab.key).length}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                <Icons.Calendar />
                                <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="bg-transparent text-sm outline-none text-gray-600 w-32" />
                                <span className="text-gray-400">-</span>
                                <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="bg-transparent text-sm outline-none text-gray-600 w-32" />
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                                <input type="text" name="search" placeholder="ค้นหาลูกค้า..." value={filters.search} onChange={handleFilterChange}
                                    className="pl-10 pr-4 py-2 w-full sm:w-64 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none transition-all" />
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    {currentItems.length > 0 ? (
                        <>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {currentItems.map(app => (
                                        <AppointmentCard key={app.id} appointment={app} onCancelClick={setAppointmentToCancel} />
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                                                <th className="pb-3 pl-4 font-medium">ลูกค้า</th>
                                                <th className="pb-3 font-medium">บริการ</th>
                                                <th className="pb-3 font-medium">วันที่ & เวลา</th>
                                                <th className="pb-3 font-medium">ราคา</th>
                                                <th className="pb-3 pr-4 text-right font-medium">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-600">
                                            {currentItems.map(app => (
                                                <tr key={app.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                                    <td className="py-4 pl-4">
                                                        <div className="font-semibold text-gray-900">{app.customerInfo?.fullName || app.customerInfo?.name}</div>
                                                        <div className="text-xs text-gray-400">{app.customerInfo?.phone}</div>
                                                    </td>
                                                    <td className="py-4">
                                                        <div className="text-gray-800">{app.serviceInfo?.name}</div>
                                                        {app.serviceInfo?.selectedArea && <div className="text-xs text-gray-400 mt-0.5">📍 {app.serviceInfo.selectedArea.name}</div>}
                                                    </td>
                                                    <td className="py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-medium">
                                                                {app.appointmentInfo?.dateTime?.toDate() ? format(app.appointmentInfo.dateTime.toDate(), 'd MMM', { locale: th }) : '-'}
                                                            </span>
                                                            <span>{app.appointmentInfo?.dateTime?.toDate() ? format(app.appointmentInfo.dateTime.toDate(), 'HH:mm', { locale: th }) : '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 font-medium text-gray-900">
                                                        {(app.paymentInfo?.totalPrice || 0).toLocaleString()} {profile.currencySymbol}
                                                    </td>
                                                    <td className="py-4 pr-4 text-right">
                                                        <button onClick={() => navigateToDetail(router, app.id)} className="text-gray-400 hover:text-gray-900 transition-colors">
                                                            <Icons.ChevronRight />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-8">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"><Icons.ChevronLeft /></button>
                                    <span className="text-sm font-medium text-gray-600">หน้า {currentPage} / {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"><Icons.ChevronRight /></button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-20">
                            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                                <Icons.Search />
                            </div>
                            <p className="text-gray-500 font-medium">ไม่พบรายการนัดหมาย</p>
                            <p className="text-gray-400 text-sm mt-1">ลองเปลี่ยนตัวกรองหรือค้นหาใหม่</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
