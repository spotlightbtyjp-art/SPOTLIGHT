"use client";

import { useState, useEffect } from 'react';
import { db, storage } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import Link from 'next/link';
import Image from 'next/image';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Tag: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
};

// --- Helpers ---
const formatPrice = (v) => {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString();
};

const formatServicePrice = (service, currencySymbol) => {
  if (service.serviceType === 'option-based') {
    const prices = service.serviceOptions?.map(o => Number(o.price)) || [];
    if (prices.length === 0) return `0 ${currencySymbol}`;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `${formatPrice(min)} ${currencySymbol}` : `${formatPrice(min)} - ${formatPrice(max)} ${currencySymbol}`;
  }
  if (service.serviceType === 'area-based-options') {
    const allPrices = service.areaOptions?.flatMap(a => a.options.map(o => Number(o.price))) || [];
    if (allPrices.length === 0) return `0 ${currencySymbol}`;
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    return min === max ? `${formatPrice(min)} ${currencySymbol}` : `${formatPrice(min)} - ${formatPrice(max)} ${currencySymbol}`;
  }
  return `${formatPrice(service.price)} ${currencySymbol}`;
};

const StatusBadge = ({ status }) => {
  const config = {
    available: { label: 'ให้บริการ', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    unavailable: { label: 'งดให้บริการ', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
  }[status] || { label: 'ไม่ระบุ', bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {config.label}
    </span>
  );
};

export default function ServicesListPage() {
  const [allServices, setAllServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();
  const { profile } = useProfile();

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'services'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllServices(data);
        setFilteredServices(data);
      } catch (err) {
        showToast("ไม่สามารถโหลดข้อมูลบริการได้", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    const lowerSearch = search.toLowerCase();
    const filtered = allServices.filter(s =>
      (s.serviceName || s.name || '').toLowerCase().includes(lowerSearch) ||
      (s.category || '').toLowerCase().includes(lowerSearch)
    );
    setFilteredServices(filtered);
  }, [search, allServices]);

  const handleUpdateStatus = async (service) => {
    const newStatus = service.status === 'available' ? 'unavailable' : 'available';
    try {
      await updateDoc(doc(db, 'services', service.id), { status: newStatus });
      const updated = allServices.map(s => s.id === service.id ? { ...s, status: newStatus } : s);
      setAllServices(updated);
      showToast(`อัพเดทสถานะเป็น "${newStatus === 'available' ? 'ให้บริการ' : 'งดให้บริการ'}" แล้ว`, 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการอัพเดทสถานะ', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!serviceToDelete) return;
    setIsDeleting(true);
    try {
      // Delete image from storage if exists
      if (serviceToDelete.imageUrl && (serviceToDelete.imageUrl.includes('firebasestorage.googleapis.com') || serviceToDelete.imageUrl.includes('firebasestorage.app'))) {
        try {
          const imageRef = ref(storage, serviceToDelete.imageUrl);
          await deleteObject(imageRef).catch(err => {
            if (err.code !== 'storage/object-not-found') console.error("Error deleting image:", err);
          });
        } catch (err) {
          console.error("Error preparing image delete:", err);
        }
      }

      await deleteDoc(doc(db, 'services', serviceToDelete.id));
      setAllServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
      showToast('ลบข้อมูลบริการสำเร็จ!', 'success');
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    } finally {
      setIsDeleting(false);
      setServiceToDelete(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
      <ConfirmationModal
        show={!!serviceToDelete}
        title="ยืนยันการลบ"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบบริการ "${serviceToDelete?.serviceName || serviceToDelete?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setServiceToDelete(null)}
        isProcessing={isDeleting}
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">จัดการบริการ</h1>
            <p className="text-gray-500 mt-1">ตั้งค่าและจัดการรายการบริการทั้งหมดของร้าน</p>
          </div>
          <Link href="/services/add" className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 transition-all transform hover:scale-[1.02]">
            <Icons.Plus /> เพิ่มบริการใหม่
          </Link>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
            <input
              type="text"
              placeholder="ค้นหาชื่อบริการ..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.Grid /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Icons.List /></button>
          </div>
        </div>

        {/* Content */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.Tag /></div>
            <p className="text-gray-500 font-medium">ไม่พบข้อมูลบริการ</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredServices.map(service => (
                  <div key={service.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col">
                    <div className="relative h-48 w-full bg-gray-100">
                      <Image
                        src={service.imageUrl || '/placeholder.png'}
                        alt={service.serviceName || service.name}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-3 right-3">
                        <StatusBadge status={service.status} />
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{service.serviceName || service.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{service.details || service.description || 'ไม่มีรายละเอียด'}</p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <Icons.Clock />
                            <span>{['option-based', 'area-based-options'].includes(service.serviceType) ? 'ตามตัวเลือก' : `${service.duration} นาที`}</span>
                          </div>
                          <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                            {formatServicePrice(service, profile?.currencySymbol || '฿')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-gray-50 mt-auto">
                        <button
                          onClick={() => handleUpdateStatus(service)}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${service.status === 'available' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                        >
                          {service.status === 'available' ? 'ปิดบริการ' : 'เปิดบริการ'}
                        </button>
                        <Link href={`/services/edit/${service.id}`} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200">
                          <Icons.Edit />
                        </Link>
                        <button onClick={() => setServiceToDelete(service)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-200">
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="py-4 pl-6 font-medium">บริการ</th>
                        <th className="py-4 font-medium">ราคา</th>
                        <th className="py-4 font-medium">ระยะเวลา</th>
                        <th className="py-4 font-medium">สถานะ</th>
                        <th className="py-4 pr-6 text-right font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-600 divide-y divide-gray-50">
                      {filteredServices.map(service => (
                        <tr key={service.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100">
                                <Image src={service.imageUrl || '/placeholder.png'} alt={service.serviceName} fill className="object-cover" />
                              </div>
                              <span className="font-medium text-gray-900">{service.serviceName || service.name}</span>
                            </div>
                          </td>
                          <td className="py-4 font-medium text-indigo-600">{formatServicePrice(service, profile?.currencySymbol || '฿')}</td>
                          <td className="py-4">{['option-based', 'area-based-options'].includes(service.serviceType) ? 'ตามตัวเลือก' : `${service.duration} นาที`}</td>
                          <td className="py-4"><StatusBadge status={service.status} /></td>
                          <td className="py-4 pr-6 text-right space-x-2">
                            <Link href={`/services/edit/${service.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">แก้ไข</Link>
                            <button onClick={() => setServiceToDelete(service)} className="text-red-600 hover:text-red-800 font-medium text-xs">ลบ</button>
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
