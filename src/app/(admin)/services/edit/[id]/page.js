"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
  ArrowLeft: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>,
  Tag: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>,
  Dollar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Image: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Save: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  Plus: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

export default function EditServicePage() {
  const [serviceType, setServiceType] = useState('single');
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();
  const { showToast } = useToast();
  const { profile } = useProfile();

  useEffect(() => {
    if (!id) return;
    const fetchService = async () => {
      setLoading(true);
      try {
        const docSnap = await getDoc(doc(db, "services", id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setServiceType(data.serviceType || 'single');
          setFormData({
            ...data,
            price: data.price?.toString() || '',
            duration: data.duration?.toString() || '',
            status: data.status || 'available',
            completionNote: data.completionNote || '',
            addOnServices: (data.addOnServices || []).map(a => ({ ...a, price: a.price?.toString() || '', duration: a.duration?.toString() || '' })),
            selectableAreas: (data.selectableAreas || []).map(name => ({ name })),
            serviceOptions: (data.serviceOptions || []).map(opt => ({ name: opt.name || '', price: opt.price?.toString() || '', duration: opt.duration?.toString() || '' }))
          });
        } else {
          showToast("ไม่พบข้อมูลบริการนี้", "error");
          router.push('/services');
        }
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchService();
  }, [id, router, showToast]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // --- Handlers ---
  const handleAddOnChange = (idx, field, value) => {
    const list = [...formData.addOnServices]; list[idx][field] = value;
    setFormData(prev => ({ ...prev, addOnServices: list }));
  };
  const handleAddAddOn = () => setFormData(prev => ({ ...prev, addOnServices: [...prev.addOnServices, { name: '', price: '', duration: '' }] }));
  const handleRemoveAddOn = (idx) => setFormData(prev => ({ ...prev, addOnServices: prev.addOnServices.filter((_, i) => i !== idx) }));

  const handleAddSelectableArea = () => setFormData(prev => ({ ...prev, selectableAreas: [...prev.selectableAreas, { name: '' }] }));
  const handleRemoveSelectableArea = (idx) => setFormData(prev => ({ ...prev, selectableAreas: prev.selectableAreas.filter((_, i) => i !== idx) }));
  const handleSelectableAreaChange = (idx, value) => {
    const list = [...formData.selectableAreas]; list[idx].name = value;
    setFormData(prev => ({ ...prev, selectableAreas: list }));
  };

  const handleAddServiceOption = () => setFormData(prev => ({ ...prev, serviceOptions: [...prev.serviceOptions, { name: '', duration: '', price: '' }] }));
  const handleRemoveServiceOption = (idx) => setFormData(prev => ({ ...prev, serviceOptions: prev.serviceOptions.filter((_, i) => i !== idx) }));
  const handleServiceOptionChange = (idx, field, value) => {
    const list = [...formData.serviceOptions]; list[idx][field] = value;
    setFormData(prev => ({ ...prev, serviceOptions: list }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.serviceName) return showToast("กรุณากรอกชื่อบริการ", "error");

    if (serviceType === 'single' && (!formData.price || !formData.duration)) {
      return showToast("กรุณากรอกราคาและระยะเวลา", "error");
    }
    if (serviceType === 'option-based' && (!formData.serviceOptions.length || !formData.selectableAreas.length)) {
      return showToast("กรุณากรอกพื้นที่และตัวเลือกอย่างน้อย 1 รายการ", "error");
    }

    setLoading(true);
    try {
      const dataToSave = {
        serviceName: formData.serviceName,
        imageUrl: formData.imageUrl || '',
        details: formData.details || '',
        completionNote: formData.completionNote?.trim() || '',
        addOnServices: formData.addOnServices.map(a => ({ ...a, price: Number(a.price) || 0, duration: Number(a.duration) || 0 })),
        serviceType,
        status: formData.status,
      };

      if (serviceType === 'single') {
        dataToSave.price = Number(formData.price) || 0;
        dataToSave.duration = Number(formData.duration) || 0;
        dataToSave.selectableAreas = [];
        dataToSave.serviceOptions = [];
      } else {
        dataToSave.selectableAreas = formData.selectableAreas.map(a => a.name);
        dataToSave.serviceOptions = formData.serviceOptions.map(opt => ({ name: opt.name, price: Number(opt.price) || 0, duration: Number(opt.duration) || 0 }));
        dataToSave.price = Math.min(...dataToSave.serviceOptions.map(o => o.price));
        dataToSave.duration = Math.min(...dataToSave.serviceOptions.map(o => o.duration));
      }

      await updateDoc(doc(db, 'services', id), dataToSave);
      showToast("อัพเดทข้อมูลบริการสำเร็จ!", "success");
      router.push('/services');
    } catch (error) {
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !formData) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <Icons.ArrowLeft />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แก้ไขบริการ</h1>
            <p className="text-gray-500 text-sm mt-1">อัปเดตรายละเอียดและราคาบริการ</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">ข้อมูลทั่วไป</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">ประเภทบริการ</label>
                <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white">
                  <option value="single">บริการเดี่ยว (ราคาคงที่)</option>
                  <option value="option-based">บริการแบบเลือกพื้นที่ + ตัวเลือก</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Icons.Tag /> ชื่อบริการ <span className="text-red-500">*</span>
                </label>
                <input name="serviceName" value={formData.serviceName} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="เช่น เลเซอร์, นวดสปา" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">สถานะบริการ</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white">
                <option value="available">ให้บริการ</option>
                <option value="unavailable">งดให้บริการ</option>
              </select>
            </div>

            {serviceType === 'single' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Icons.Dollar /> ราคา ({profile.currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Icons.Clock /> ระยะเวลา (นาที) <span className="text-red-500">*</span>
                  </label>
                  <input type="number" name="duration" value={formData.duration} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="60" />
                </div>
              </div>
            ) : (
              <div className="space-y-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
                {/* Selectable Areas */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">1. พื้นที่ที่เลือกได้ (Selectable Areas)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {formData.selectableAreas.map((area, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input type="text" value={area.name} onChange={(e) => handleSelectableAreaChange(idx, e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ชื่อพื้นที่ (เช่น หน้าท้อง)" />
                        <button type="button" onClick={() => handleRemoveSelectableArea(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Icons.Trash /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={handleAddSelectableArea} className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-800 flex items-center gap-1">+ เพิ่มพื้นที่</button>
                </div>

                {/* Service Options */}
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-3">2. ตัวเลือกแพ็กเกจ (Options)</label>
                  <div className="space-y-3">
                    {formData.serviceOptions.map((opt, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <input type="text" value={opt.name} onChange={(e) => handleServiceOptionChange(idx, 'name', e.target.value)} className="flex-1 min-w-[120px] px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ชื่อ (เช่น Size S)" />
                        <input type="number" value={opt.duration} onChange={(e) => handleServiceOptionChange(idx, 'duration', e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="นาที" />
                        <input type="number" value={opt.price} onChange={(e) => handleServiceOptionChange(idx, 'price', e.target.value)} className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ราคา" />
                        <button type="button" onClick={() => handleRemoveServiceOption(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg"><Icons.Trash /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={handleAddServiceOption} className="mt-3 w-full py-2 border-2 border-dashed border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 font-medium transition-colors flex items-center justify-center gap-2">
                    <Icons.Plus /> เพิ่มตัวเลือก
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">รายละเอียดเพิ่มเติม</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700"><Icons.Image /> URL รูปภาพ</label>
                <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">รายละเอียดบริการ</label>
                <textarea name="details" value={formData.details} onChange={handleChange} rows="3" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="รายละเอียดบริการ..."></textarea>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">ข้อความหลังจบงาน (Completion Note)</label>
                <textarea name="completionNote" value={formData.completionNote} onChange={handleChange} rows="2" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white" placeholder="ข้อความที่จะส่งให้ลูกค้า..."></textarea>
              </div>
            </div>
          </div>

          {/* Add-ons Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
              <h2 className="text-lg font-semibold text-gray-900">บริการเสริม (Add-ons)</h2>
              <button type="button" onClick={handleAddAddOn} className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black transition-colors flex items-center gap-1"><Icons.Plus /> เพิ่ม</button>
            </div>
            <div className="space-y-3">
              {formData.addOnServices.length === 0 && <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีบริการเสริม</p>}
              {formData.addOnServices.map((addOn, idx) => (
                <div key={idx} className="flex flex-col md:flex-row gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <input type="text" value={addOn.name} onChange={e => handleAddOnChange(idx, 'name', e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ชื่อบริการเสริม" />
                  <div className="flex gap-3">
                    <input type="number" value={addOn.price} onChange={e => handleAddOnChange(idx, 'price', e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="ราคา" />
                    <input type="number" value={addOn.duration} onChange={e => handleAddOnChange(idx, 'duration', e.target.value)} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="นาที" />
                    <button type="button" onClick={() => handleRemoveAddOn(idx)} className="text-red-500 hover:bg-red-100 p-2 rounded-lg"><Icons.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors">ยกเลิก</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-medium rounded-xl shadow-lg shadow-gray-200 transition-all transform hover:scale-[1.02] disabled:opacity-50">
              {loading ? 'กำลังบันทึก...' : <><Icons.Save /> บันทึกการเปลี่ยนแปลง</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}