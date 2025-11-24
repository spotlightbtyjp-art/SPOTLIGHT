"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useRouter } from 'next/navigation';

// --- Icons ---
const Icons = {
    Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
};

// --- Helper Components ---
const StatusBadge = ({ status }) => {
    const config = {
        available: { label: 'พร้อมทำงาน', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
        on_trip: { label: 'กำลังทำงาน', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
        unavailable: { label: 'ลา', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
        suspended: { label: 'พักงาน', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    }[status] || { label: status || 'ไม่ระบุ', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
            {config.label}
        </span>
    );
};

const TechnicianCard = ({ technician, onDelete }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 group">
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-100 border border-gray-100">
                    {technician.imageUrl ? (
                        <Image src={technician.imageUrl} alt={technician.firstName} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400"><Icons.User /></div>
                    )}
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 text-lg">{technician.firstName} {technician.lastName}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                        <Icons.Phone />
                        <span>{technician.phoneNumber || '-'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
            <StatusBadge status={technician.status} />
            <div className="flex gap-2">
                <Link href={`/technicians/edit/${technician.id}`} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Icons.Edit />
                </Link>
                <button onClick={() => onDelete(technician)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Icons.Trash />
                </button>
            </div>
        </div>
    </div>
);

const STATUS_FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'available', label: 'พร้อมทำงาน' },
    { key: 'on_trip', label: 'กำลังทำงาน' },
    { key: 'unavailable', label: 'ลา' },
    { key: 'suspended', label: 'พักงาน' },
];

export default function TechniciansListPage() {
    const [allTechnicians, setAllTechnicians] = useState([]);
    const [filteredTechnicians, setFilteredTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState('grid');
    const [technicianToDelete, setTechnicianToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { showToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchTechnicians = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'technicians'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                setAllTechnicians(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (err) {
                showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchTechnicians();
    }, []);

    useEffect(() => {
        let filtered = allTechnicians;
        if (statusFilter !== 'all') {
            filtered = filtered.filter(b => b.status === statusFilter);
        }
        setFilteredTechnicians(filtered);
    }, [statusFilter, allTechnicians]);

    const confirmDelete = async () => {
        if (!technicianToDelete) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "technicians", technicianToDelete.id));
            setAllTechnicians(prev => prev.filter(b => b.id !== technicianToDelete.id));
            showToast("ลบข้อมูลสำเร็จ", "success");
        } catch (error) {
            showToast("ลบข้อมูลไม่สำเร็จ", "error");
        } finally {
            setIsDeleting(false);
            setTechnicianToDelete(null);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
            <ConfirmationModal
                show={!!technicianToDelete}
                title="ยืนยันการลบ"
                message={`คุณแน่ใจหรือไม่ว่าต้องการลบพนักงาน "${technicianToDelete?.firstName}"?`}
                onConfirm={confirmDelete}
                onCancel={() => setTechnicianToDelete(null)}
                isProcessing={isDeleting}
            />

            {/* Header */}
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">จัดการพนักงาน</h1>
                        <p className="text-gray-500 mt-1">ดูรายชื่อและสถานะการทำงานของพนักงานทั้งหมด</p>
                    </div>
                    <Link href="/technicians/add" className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 transition-all transform hover:scale-[1.02]">
                        <Icons.Plus /> เพิ่มพนักงาน
                    </Link>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex p-1 gap-1 overflow-x-auto w-full md:w-auto no-scrollbar">
                        {STATUS_FILTERS.map(filter => (
                            <button
                                key={filter.key}
                                onClick={() => setStatusFilter(filter.key)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${statusFilter === filter.key ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 ml-auto">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
                        <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
                    </div>
                </div>

                {/* Content */}
                {filteredTechnicians.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.User /></div>
                        <p className="text-gray-500 font-medium">ไม่พบข้อมูลพนักงาน</p>
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {filteredTechnicians.map(tech => (
                                    <TechnicianCard key={tech.id} technician={tech} onDelete={setTechnicianToDelete} />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                                <th className="py-4 pl-6 font-medium">พนักงาน</th>
                                                <th className="py-4 font-medium">เบอร์โทร</th>
                                                <th className="py-4 font-medium">สถานะ</th>
                                                <th className="py-4 pr-6 text-right font-medium">จัดการ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm text-gray-600 divide-y divide-gray-50">
                                            {filteredTechnicians.map(tech => (
                                                <tr key={tech.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="py-4 pl-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-gray-100">
                                                                {tech.imageUrl ? <Image src={tech.imageUrl} alt={tech.firstName} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><Icons.User /></div>}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-gray-900">{tech.firstName} {tech.lastName}</div>
                                                                <div className="text-xs text-gray-400">{tech.lineUserId || '-'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4">{tech.phoneNumber || '-'}</td>
                                                    <td className="py-4"><StatusBadge status={tech.status} /></td>
                                                    <td className="py-4 pr-6 text-right space-x-2">
                                                        <Link href={`/technicians/edit/${tech.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">แก้ไข</Link>
                                                        <button onClick={() => setTechnicianToDelete(tech)} className="text-red-600 hover:text-red-800 font-medium text-xs">ลบ</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
