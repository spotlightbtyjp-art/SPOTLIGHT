"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useLiffContext } from '@/context/LiffProvider';
import { useProfile } from '@/context/ProfileProvider';
import { db } from '@/app/lib/firebase';
import { collection, doc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';

function GeneralInfoContent() {
    const searchParams = useSearchParams();
    const { profile, loading: liffLoading } = useLiffContext();
    const { profile: shopProfile } = useProfile();
    const router = useRouter();
    const { showToast, ToastComponent } = useToast();

    // --- Params ---
    const serviceId = searchParams.get('serviceId');
    const addOnsParam = searchParams.get('addOns');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const technicianId = searchParams.get('technicianId');
    
    // Legacy Params (Multi-Area)
    const areaIndex = searchParams.get('areaIndex') ? parseInt(searchParams.get('areaIndex')) : null;
    const packageIndex = searchParams.get('packageIndex') ? parseInt(searchParams.get('packageIndex')) : null;

    // New Params (Option-Based)
    const selectedOptionName = searchParams.get('selectedOptionName');
    const selectedOptionPrice = searchParams.get('selectedOptionPrice') ? parseFloat(searchParams.get('selectedOptionPrice')) : 0;
    const selectedOptionDuration = searchParams.get('selectedOptionDuration') ? parseInt(searchParams.get('selectedOptionDuration')) : 0;
    const selectedAreasParam = searchParams.get('selectedAreas');
    const selectedAreas = selectedAreasParam ? selectedAreasParam.split(',') : [];

    const [formData, setFormData] = useState({ fullName: "", phone: "", email: "", note: "" });
    const [service, setService] = useState(null);
    const [technician, settechnician] = useState(null);
    const [availableCoupons, setAvailableCoupons] = useState([]);
    const [selectedCouponId, setSelectedCouponId] = useState('');
    const [showCoupon, setShowCoupon] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const selectedAddOns = addOnsParam ? addOnsParam.split(',') : [];

    useEffect(() => {
        const fetchAllData = async () => {
            if (liffLoading || !profile?.userId || !serviceId) return;
            try {
                const promises = [
                    getDoc(doc(db, "customers", profile.userId)),
                    getDoc(doc(db, 'services', serviceId)),
                    getDocs(query(collection(db, "customers", profile.userId, "coupons"), where("used", "==", false)))
                ];
                
                if (technicianId && technicianId !== 'auto-assign') {
                    promises.push(getDoc(doc(db, 'technicians', technicianId)));
                }

                const results = await Promise.all(promises);
                const [customerSnap, serviceSnap, couponsSnapshot, techniciansnap] = results;

                if (customerSnap.exists()) {
                    const data = customerSnap.data();
                    setFormData(prev => ({ ...prev, fullName: data.fullName || profile.displayName || "", phone: data.phone || "", email: data.email || "" }));
                } else {
                    setFormData(prev => ({ ...prev, fullName: profile.displayName || "" }));
                }

                if (serviceSnap.exists()) setService(serviceSnap.data());
                
                if (technicianId === 'auto-assign') {
                    settechnician({ firstName: 'ระบบจัดให้', lastName: '', id: 'auto-assign' });
                } else if (techniciansnap && techniciansnap.exists()) {
                    settechnician(techniciansnap.data());
                }
                
                setAvailableCoupons(couponsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Error fetching details:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [liffLoading, profile?.userId, serviceId, technicianId]);

    const { basePrice, addOnsTotal, totalPrice, finalPrice, discount, selectedArea, selectedPackage, totalDuration } = useMemo(() => {
        if (!service) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, finalPrice: 0, discount: 0, selectedArea: null, selectedPackage: null, totalDuration: 0 };

        let base = service.price || 0;
        let duration = service.duration || 0;
        let selectedAreaData = null;
        let selectedPackageData = null;

        // 1. Multi-Area Logic (Legacy)
        if (service.serviceType === 'multi-area' && service.areas && service.areas.length > 0) {
            if (areaIndex !== null && service.areas[areaIndex]) {
                selectedAreaData = service.areas[areaIndex];
                base = selectedAreaData.price || 0;
                duration = selectedAreaData.duration || 0;

                if (packageIndex !== null && selectedAreaData.packages && selectedAreaData.packages[packageIndex]) {
                    selectedPackageData = selectedAreaData.packages[packageIndex];
                    base = selectedPackageData.price || 0;
                    duration = selectedPackageData.duration || 0;
                }
            }
        } 
        // 2. Option-Based Logic (New)
        else if (service.serviceType === 'option-based') {
            let unitPrice = selectedOptionPrice;
            let unitDuration = selectedOptionDuration;

            // ถ้ามีข้อมูล serviceOptions ให้ลองดึงราคาล่าสุด (กันราคาเปลี่ยน)
            if (selectedOptionName && service.serviceOptions) {
                const option = service.serviceOptions.find(o => o.name === selectedOptionName);
                if (option) {
                    unitPrice = option.price;
                    unitDuration = option.duration;
                }
            }
            
            // สูตร: ราคาต่อหน่วย x จำนวนจุด
            const areaCount = Math.max(1, selectedAreas.length);
            base = unitPrice * areaCount;
            duration = unitDuration * areaCount;
        }

        const addOnsPrice = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.price || 0), 0);
        const addOnsDuration = (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)).reduce((sum, a) => sum + (a.duration || 0), 0);
        const total = base + addOnsPrice;
        const selectedCoupon = availableCoupons.find(c => c.id === selectedCouponId);

        let discountAmount = 0;
        if (selectedCoupon) {
            discountAmount = selectedCoupon.discountType === 'percentage' ? Math.round(total * (selectedCoupon.discountValue / 100)) : selectedCoupon.discountValue;
            discountAmount = Math.min(discountAmount, total);
        }

        return {
            basePrice: base,
            addOnsTotal: addOnsPrice,
            totalPrice: total,
            finalPrice: Math.max(0, total - discountAmount),
            discount: discountAmount,
            selectedArea: selectedAreaData,
            selectedPackage: selectedPackageData,
            totalDuration: duration + addOnsDuration
        };
    }, [service, selectedAddOns, selectedCouponId, availableCoupons, areaIndex, packageIndex, selectedOptionName, selectedOptionPrice, selectedOptionDuration, selectedAreas]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.fullName || !formData.phone) {
            showToast("กรุณากรอกชื่อ-นามสกุล และเบอร์โทรศัพท์", "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        if (liffLoading || !profile?.userId) {
            showToast('กรุณาเข้าสู่ระบบก่อนทำการจอง', "warning", "ต้องเข้าสู่ระบบ");
            return;
        }

        setIsSubmitting(true);
        try {
            const appointmentData = {
                userId: profile.userId,
                userInfo: { displayName: profile.displayName || '', pictureUrl: profile.pictureUrl || '' },
                status: 'awaiting_confirmation',
                customerInfo: formData,
                serviceInfo: {
                    id: serviceId,
                    name: service.serviceName,
                    imageUrl: service.imageUrl || '',
                    serviceType: service.serviceType,
                    // Multi-area
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    // Option-based
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                },
                date: date,
                time: time,
                serviceId: serviceId,
                technicianId: technicianId,
                appointmentInfo: {
                    technicianId: technicianId,
                    employeeId: technicianId,
                    technicianInfo: { firstName: technician?.firstName, lastName: technician?.lastName },
                    dateTime: new Date(`${date}T${time}`),
                    addOns: (service.addOnServices || []).filter(a => selectedAddOns.includes(a.name)),
                    duration: totalDuration,
                    // Multi-area
                    selectedArea: selectedArea,
                    selectedPackage: selectedPackage,
                    areaIndex: areaIndex,
                    packageIndex: packageIndex,
                    // Option-based
                    selectedOptionName: selectedOptionName || null,
                    selectedAreas: selectedAreas || [],
                },
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: finalPrice,
                    discount: discount,
                    couponId: selectedCouponId || null,
                    couponName: availableCoupons.find(c => c.id === selectedCouponId)?.name || null,
                    paymentStatus: 'unpaid',
                },
            };

            const result = await createAppointmentWithSlotCheck(appointmentData);
            
            if (!result.success) {
                showToast(result.error, "error", "เกิดข้อผิดพลาด");
                setIsSubmitting(false);
                return;
            }

            const newAppointmentId = result.id;

            if (selectedCouponId) {
                await updateDoc(doc(db, 'customers', profile.userId, 'coupons', selectedCouponId), {
                    used: true,
                    usedAt: new Date(),
                    appointmentId: newAppointmentId
                });
            }

            showToast('จองสำเร็จ! กำลังพาไปหน้านัดหมาย', "success", "จองสำเร็จ");
            setTimeout(() => {
                router.push('/my-appointments');
            }, 1500);

        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการจอง กรุณาลองอีกครั้ง', "error", "เกิดข้อผิดพลาด");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="p-4 text-center">กำลังโหลดข้อมูล...</div>;
    }

    return (
        <div>
            <ToastComponent />
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="p-6">
                <div className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm border border-gray-100">
                    <div className="p-4 border-b border-gray-100  text-black">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-600">วันที่</span>
                            <span className="text-sm font-semibold text-gray-900">{date ? format(new Date(date), 'dd/MM/yyyy', { locale: th }) : '-'}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-600">เวลา</span>
                            <span className="text-sm font-semibold text-gray-900">{time} น.</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-600">พนักงาน</span>
                            <span className="text-sm font-semibold text-gray-900">{technician?.firstName === 'ระบบจัดให้' ? '-' : technician?.firstName}</span>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-100  text-black">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-600 pt-0.5">บริการ</span>
                            <div className="text-right flex-1 pl-4">
                                <div className="text-sm font-bold text-gray-900">{service?.serviceName}</div>
                                
                                {/* Multi-Area Display */}
                                {selectedArea && (
                                    <div className="text-sm text-gray-600">{selectedArea.name}</div>
                                )}
                                {selectedPackage && (
                                    <div className="text-sm text-gray-600">{selectedPackage.name}</div>
                                )}

                                {/* --- แก้ไข: Option-Based Display ให้แสดงรายละเอียดการคูณ --- */}
                                {service?.serviceType === 'option-based' && (
                                    <div className="mt-1">
                                        <div className="text-sm text-gray-800 font-medium flex justify-end items-center gap-1">
                                            <span>{selectedOptionName}</span>
                                            <span className="text-xs text-gray-400">({shopProfile.currencySymbol}{selectedOptionPrice.toLocaleString()})</span>
                                            <span>x {selectedAreas.length} จุด</span>
                                        </div>
                                        {selectedAreas.length > 0 && (
                                            <div className="text-xs text-gray-500 leading-tight mt-0.5">
                                                ({selectedAreas.join(', ')})
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="text-sm text-gray-500 mt-1">
                                    {totalDuration} นาที | {basePrice.toLocaleString()} {shopProfile.currencySymbol}
                                </div>
                            </div>
                        </div>

                        {selectedAddOns.length > 0 && (
                            <div className="flex justify-between items-start mb-2 mt-3 pt-3 border-t border-dashed border-gray-200">
                                <span className="text-sm font-medium text-primary pt-0.5">บริการเสริม</span>
                                <div className="text-right flex-1 pl-4">
                                    <div className="text-sm font-semibold text-gray-800">
                                        {(service.addOnServices || [])
                                            .filter(a => selectedAddOns.includes(a.name))
                                            .map(a => a.name).join(', ')
                                        }
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {(service.addOnServices || [])
                                            .filter(a => selectedAddOns.includes(a.name))
                                            .reduce((sum, a) => sum + (a.duration || 0), 0)
                                        }นาที | {addOnsTotal.toLocaleString()} {shopProfile.currencySymbol}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Coupon Section */}
                    {availableCoupons.length > 0 && (
                        <div className="p-4 border-b border-gray-100 ">
                            <button
                                type="button"
                                onClick={() => setShowCoupon(!showCoupon)}
                                className="flex items-center justify-between w-full text-left text-primary font-medium"
                            >
                                <span>ใช้คูปอง ({availableCoupons.length} ใบ)</span>
                                <span>{showCoupon ? '▼' : '▶'}</span>
                            </button>

                            {showCoupon && (
                                <div className="space-y-2 mt-3">
                                    <div className="bg-gray-50 text-primary rounded-lg p-3 border border-gray-100">
                                        <div className="flex items-center">
                                            <input
                                                type="radio"
                                                id="no-coupon"
                                                name="coupon"
                                                value=""
                                                checked={selectedCouponId === ''}
                                                onChange={(e) => setSelectedCouponId(e.target.value)}
                                                className="mr-2"
                                            />
                                            <label htmlFor="no-coupon" className="text-sm">ไม่ใช้คูปอง</label>
                                        </div>
                                    </div>
                                    {availableCoupons.map(coupon => (
                                        <div key={coupon.id} className="bg-gray-50 text-primary rounded-lg p-3 border border-gray-100">
                                            <div className="flex items-center">
                                                <input
                                                    type="radio"
                                                    id={coupon.id}
                                                    name="coupon"
                                                    value={coupon.id}
                                                    checked={selectedCouponId === coupon.id}
                                                    onChange={(e) => setSelectedCouponId(e.target.value)}
                                                    className="mr-2"
                                                />
                                                <label htmlFor={coupon.id} className="text-sm w-full">
                                                    <div className="font-medium">{coupon.name}</div>
                                                    <div className="text-gray-500 text-xs">
                                                        ลด {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `${coupon.discountValue}${shopProfile.currencySymbol || '฿'}`}
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="p-4 bg-gray-50">
                        <div className="flex justify-between items-center">
                            <span className="text-black font-bold">ยอดสุทธิ</span>
                            <div className="text-right">
                                <div className="text-md font-bold text-primary">
                                    {finalPrice.toLocaleString()} {shopProfile.currencySymbol || '฿'}
                                </div>
                                {discount > 0 && (
                                    <div className="text-xs text-green-600 mt-1">ประหยัด {discount.toLocaleString()} {shopProfile.currencySymbol || '฿'}</div>
                                )}
                                <div className="text-xs text-gray-400 mt-0.5">รวมระยะเวลา {totalDuration} นาที</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white text-black rounded-2xl p-6 mb-6 shadow-sm border border-gray-100">
                    <label className="block text-lg text-center font-bold text-gray-800 mb-6">ข้อมูลลูกค้า</label>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-สกุล</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                                placeholder="กรอกชื่อ-นามสกุล"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์ติดต่อ</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                                placeholder="กรอกเบอร์โทรศัพท์"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล (ถ้ามี)</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50"
                                placeholder="กรอกอีเมล"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความเพิ่มเติม</label>
                            <textarea
                                name="note"
                                value={formData.note}
                                onChange={handleChange}
                                rows={2}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 resize-none"
                                placeholder="เช่น แพ้ยา, ขอหมอนเพิ่ม"
                            />
                        </div>
                    </form>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-primary-dark hover:bg-primary text-white py-4 rounded-full font-bold text-lg shadow-lg disabled:opacity-50 transition-all transform active:scale-95"
                >
                    {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการนัดหมาย'}
                </button>
            </div>
        </div>
    );
}

export default function GeneralInfoPage() {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gray-50">
                    <div className="p-4 text-center text-lg text-gray-500">กำลังโหลด...</div>
                </div>
            }
        >
            <GeneralInfoContent />
        </Suspense>
    );
}