"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/app/components/Toast';
import { useProfile } from '@/context/ProfileProvider';

export default function AddServicePage() {
  const [serviceType, setServiceType] = useState('single');
  const [formData, setFormData] = useState({
    serviceName: '',
    price: '',
    duration: '',
    imageUrl: '',
    details: '',
    completionNote: '',
    addOnServices: [],
    // Option-Based Data
    selectableAreas: [], 
    serviceOptions: []   
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useProfile();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- Add-on Handlers ---
  const handleAddOnChange = (idx, field, value) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices[idx][field] = value;
      return { ...prev, addOnServices };
    });
  };

  const handleAddAddOn = () => {
    setFormData(prev => ({
      ...prev,
      addOnServices: [...(prev.addOnServices || []), { name: '', price: '', duration: '' }]
    }));
  };

  const handleRemoveAddOn = (idx) => {
    setFormData(prev => {
      const addOnServices = [...(prev.addOnServices || [])];
      addOnServices.splice(idx, 1);
      return { ...prev, addOnServices };
    });
  };

  // --- Option-Based Handlers (Selectable Areas) ---
  const handleAddSelectableArea = () => {
    setFormData(prev => ({
      ...prev,
      selectableAreas: [...(prev.selectableAreas || []), { name: '' }]
    }));
  };

  const handleRemoveSelectableArea = (idx) => {
    setFormData(prev => {
      const list = [...(prev.selectableAreas || [])];
      list.splice(idx, 1);
      return { ...prev, selectableAreas: list };
    });
  };

  const handleSelectableAreaChange = (idx, value) => {
    setFormData(prev => {
      const list = [...(prev.selectableAreas || [])];
      list[idx].name = value;
      return { ...prev, selectableAreas: list };
    });
  };

  // --- Option-Based Handlers (Service Options) ---
  const handleAddServiceOption = () => {
    setFormData(prev => ({
      ...prev,
      serviceOptions: [...(prev.serviceOptions || []), { name: '', duration: '', price: '' }]
    }));
  };

  const handleRemoveServiceOption = (idx) => {
    setFormData(prev => {
      const list = [...(prev.serviceOptions || [])];
      list.splice(idx, 1);
      return { ...prev, serviceOptions: list };
    });
  };

  const handleServiceOptionChange = (idx, field, value) => {
    setFormData(prev => {
      const list = [...(prev.serviceOptions || [])];
      list[idx][field] = value;
      return { ...prev, serviceOptions: list };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.serviceName) {
      showToast("กรุณากรอกชื่อบริการ", "error");
      return;
    }

    if (serviceType === 'single') {
      if (!formData.price || !formData.duration) {
        showToast("กรุณากรอกราคาและระยะเวลา", "error");
        return;
      }
    } else if (serviceType === 'option-based') {
      if (!formData.serviceOptions?.length || !formData.selectableAreas?.length) {
        showToast("กรุณากรอกพื้นที่ที่เลือกได้ และตัวเลือกแพ็กเกจอย่างน้อย 1 รายการ", "error");
        return;
      }
      for (const opt of formData.serviceOptions) {
        if (!opt.name || !opt.price || !opt.duration) {
            showToast("กรุณากรอกข้อมูลแพ็กเกจให้ครบ (ชื่อ, ราคา, เวลา)", "error");
            return;
        }
      }
      for (const area of formData.selectableAreas) {
          if (!area.name) {
              showToast("กรุณากรอกชื่อพื้นที่ให้ครบ", "error");
              return;
          }
      }
    }

    setLoading(true);
    try {
      const dataToSave = {
        serviceName: formData.serviceName,
        imageUrl: formData.imageUrl || '',
        details: formData.details || '',
        completionNote: formData.completionNote?.trim() || '',
        addOnServices: (formData.addOnServices || []).map(a => ({ ...a, price: Number(a.price) || 0, duration: Number(a.duration) || 0 })),
        serviceType,
        status: 'available',
        createdAt: serverTimestamp(),
      };

      if (serviceType === 'single') {
        dataToSave.price = Number(formData.price) || 0;
        dataToSave.duration = Number(formData.duration) || 0;
      } else if (serviceType === 'option-based') {
        dataToSave.selectableAreas = formData.selectableAreas.map(a => a.name);
        dataToSave.serviceOptions = formData.serviceOptions.map(opt => ({
            name: opt.name,
            price: Number(opt.price) || 0,
            duration: Number(opt.duration) || 0
        }));
        // Set min price/duration for display sorting
        const minPrice = Math.min(...dataToSave.serviceOptions.map(o => o.price));
        const minDuration = Math.min(...dataToSave.serviceOptions.map(o => o.duration));
        dataToSave.price = minPrice;
        dataToSave.duration = minDuration;
      }

      await addDoc(collection(db, "services"), dataToSave);
      showToast("เพิ่มบริการใหม่สำเร็จ!", "success");
      router.push('/services');
    } catch (error) {
      console.error("Error adding document: ", error);
      showToast("เกิดข้อผิดพลาด: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มบริการใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">ประเภทบริการ</label>
          <select value={serviceType} onChange={e => setServiceType(e.target.value)} className="w-full mt-1 p-2 border rounded-md">
            <option value="single">บริการเดี่ยว (ราคาและระยะเวลาคงที่)</option>
            <option value="option-based">บริการเลือกพื้นที่ + ตัวเลือก (เช่น เลือกจุด + เลือกไซส์)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ชื่อบริการ</label>
          <input name="serviceName" value={formData.serviceName} onChange={handleChange} placeholder="เช่น เลเซอร์, นวดสปา" required className="w-full mt-1 p-2 border rounded-md" />
        </div>

        {/* --- FORM: SINGLE --- */}
        {serviceType === 'single' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ราคา ({profile.currencySymbol})</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="200" required className="w-full mt-1 p-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ระยะเวลา (นาที)</label>
                <input type="number" name="duration" value={formData.duration} onChange={handleChange} placeholder="60" required className="w-full mt-1 p-2 border rounded-md" />
              </div>
            </div>
        )}

        {/* --- FORM: OPTION-BASED --- */}
        {serviceType === 'option-based' && (
          <div className="space-y-6 border-t pt-4">
             {/* 1. Selectable Areas */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">1. พื้นที่ที่ลูกค้าเลือกได้ (Checkbox)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(formData.selectableAreas || []).map((area, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                             <span className="text-gray-400">□</span>
                             <input 
                                type="text" 
                                placeholder="ชื่อพื้นที่ (เช่น หน้าท้อง)" 
                                value={area.name} 
                                onChange={(e) => handleSelectableAreaChange(idx, e.target.value)}
                                className="flex-1 p-2 border rounded-md"
                             />
                             <button type="button" onClick={() => handleRemoveSelectableArea(idx)} className="text-red-500 px-2">ลบ</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddSelectableArea} className="mt-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">
                    + เพิ่มพื้นที่
                </button>
             </div>

             {/* 2. Service Options */}
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">2. ตัวเลือกราคาและเวลา (Option)</label>
                <div className="space-y-3">
                    {(formData.serviceOptions || []).map((opt, idx) => (
                        <div key={idx} className="flex flex-wrap items-center gap-2 p-3 border rounded-lg bg-gray-50">
                            <span className="text-gray-400">○</span>
                            <div className="flex-1 min-w-[150px]">
                                <label className="text-xs text-gray-500 block">ชื่อ Option (เช่น Size S)</label>
                                <input 
                                    type="text" 
                                    value={opt.name} 
                                    onChange={(e) => handleServiceOptionChange(idx, 'name', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Size S"
                                />
                            </div>
                            <div className="w-24">
                                <label className="text-xs text-gray-500 block">นาที/จุด</label>
                                <input 
                                    type="number" 
                                    value={opt.duration} 
                                    onChange={(e) => handleServiceOptionChange(idx, 'duration', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="30"
                                />
                            </div>
                            <div className="w-28">
                                <label className="text-xs text-gray-500 block">ราคา/จุด</label>
                                <input 
                                    type="number" 
                                    value={opt.price} 
                                    onChange={(e) => handleServiceOptionChange(idx, 'price', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="5000"
                                />
                            </div>
                            <button type="button" onClick={() => handleRemoveServiceOption(idx)} className="text-red-500 px-2 mt-4">ลบ</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={handleAddServiceOption} className="mt-2 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md border border-indigo-200 border-dashed">
                    + เพิ่ม Option (เช่น S, M, XL)
                </button>
             </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">URL รูปภาพ</label>
          <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.png" className="w-full mt-1 p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
          <textarea name="details" value={formData.details} onChange={handleChange} rows="3" placeholder="รายละเอียดบริการ เช่น ใช้ผลิตภัณฑ์อะไร ฯลฯ" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">ข้อความหลังบริการเสร็จ</label>
          <textarea 
            name="completionNote" 
            value={formData.completionNote} 
            onChange={handleChange} 
            rows="2" 
            placeholder="ข้อความที่จะส่งให้ลูกค้าเมื่อบริการเสร็จสิ้น" 
            className="w-full mt-1 p-2 border rounded-md"
          />
          <div className="text-xs text-gray-500 mt-1">{formData.completionNote.length}/200 ตัวอักษร</div>
        </div>
        
        {/* Add Ons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">บริการเสริม</label>
          {(formData.addOnServices || []).map((addOn, idx) => (
            <div key={idx} className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="ชื่อบริการเสริม"
                value={addOn.name}
                onChange={e => handleAddOnChange(idx, 'name', e.target.value)}
                className="flex-1 p-2 border rounded-md"
              />
              <input
                type="number"
                placeholder="ราคา"
                value={addOn.price}
                onChange={e => handleAddOnChange(idx, 'price', e.target.value)}
                className="w-28 p-2 border rounded-md"
              />
              <input
                type="number"
                placeholder="ระยะเวลา"
                value={addOn.duration}
                onChange={e => handleAddOnChange(idx, 'duration', e.target.value)}
                className="w-32 p-2 border rounded-md"
              />
              <button type="button" onClick={() => handleRemoveAddOn(idx)} className="text-red-500 px-2">ลบ</button>
            </div>
          ))}
          <button type="button" onClick={handleAddAddOn} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-md mt-2">+ เพิ่มบริการเสริม</button>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลบริการ'}
        </button>
      </form>
    </div>
  );
}