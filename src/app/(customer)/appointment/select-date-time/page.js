"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useToast } from '@/app/components/common/Toast';
import { useProfile } from '@/context/ProfileProvider'; // Import Profile Context เพื่อใช้สกุลเงิน

// --- Technician Card Component ---
const TechnicianCard = ({ technician, isSelected, onSelect, isAvailable }) => (
    <div
        onClick={() => isAvailable && onSelect(technician)}
        className={`rounded-lg p-4 flex items-center space-x-4 border-2 transition-all w-full ${!isAvailable ? 'bg-gray-200 opacity-60 cursor-not-allowed' : isSelected ? 'border-primary bg-primary-light cursor-pointer' : 'border-gray-200 bg-white cursor-pointer'}`}
    >
        <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
            <Image
                src={technician.imageUrl || 'https://via.placeholder.com/150'}
                alt={technician.firstName}
                fill
                style={{ objectFit: 'cover' }}
            />
        </div>
        <div className="flex-1">
            <p className="font-bold text-lg text-gray-800">{technician.firstName}</p>
        </div>
        <div className="flex items-center space-x-3">
            <p className={`text-sm px-3 py-1 rounded-full ${isAvailable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
            </p>
            {isSelected && isAvailable && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    </div>
);

function SelectDateTimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile } = useProfile();
    const { showToast, ToastComponent } = useToast();

    // Params
    const serviceId = searchParams.get('serviceId');
    const addOns = searchParams.get('addOns');
    
    // Legacy Params (Multi-Area)
    const areaIndex = searchParams.get('areaIndex');
    const packageIndex = searchParams.get('packageIndex');

    // New Params (Option-Based) --- เพิ่มส่วนนี้ ---
    const selectedOptionName = searchParams.get('selectedOptionName');
    const selectedOptionPrice = searchParams.get('selectedOptionPrice');
    const selectedOptionDuration = searchParams.get('selectedOptionDuration');
    const selectedAreasParam = searchParams.get('selectedAreas'); // รับ string เช่น "หน้าท้อง,ต้นขา"

    const [service, setService] = useState(null);
    const [selectedAddOns, setSelectedAddOns] = useState([]);
    const [date, setDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
    });
    const [activeMonth, setActiveMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1, 7, 0, 0);
    });

    const [time, setTime] = useState('');
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTechnician, setSelectedTechnician] = useState(null);
    const [timeQueues, setTimeQueues] = useState([]);
    const [totalTechnicians, setTotalTechnicians] = useState(1);
    const [slotCounts, setSlotCounts] = useState({});
    const [useTechnician, setUseTechnician] = useState(false);
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [holidayDates, setHolidayDates] = useState([]);
    const [unavailableTechnicianIds, setUnavailableTechnicianIds] = useState(new Set());
    const [bufferMinutes, setBufferMinutes] = useState(0);
    const [unavailableSlots, setUnavailableSlots] = useState(new Set());

    // Fetch service data
    useEffect(() => {
        if (!serviceId) return;
        
        const fetchService = async () => {
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setService({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (error) {
                console.error("Error fetching service:", error);
            }
        };
        fetchService();
    }, [serviceId]);

    // Process add-ons
    useEffect(() => {
        if (!service || !addOns) return;
        
        const addOnNames = addOns.split(',');
        const selected = (service.addOnServices || []).filter(addOn => 
            addOnNames.includes(addOn.name)
        );
        setSelectedAddOns(selected);
    }, [service, addOns]);

    // Fetch technicians
    useEffect(() => {
        const fetchTechnicians = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'technicians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const querySnapshot = await getDocs(q);
                setTechnicians(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (e) {
                console.error("Error fetching technicians:", e);
            }
            setLoading(false);
        };
        fetchTechnicians();
    }, []);

    // Fetch booking settings
    useEffect(() => {
        const fetchBookingSettings = async () => {
            try {
                const bookingSettingsDoc = await getDoc(doc(db, 'settings', 'booking'));
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setTimeQueues(Array.isArray(settings.timeQueues) ? settings.timeQueues : []);
                    setTotalTechnicians(Number(settings.totalTechnicians) || 1);
                    setUseTechnician(!!settings.useTechnician);
                    setWeeklySchedule(settings.weeklySchedule || {});
                    setHolidayDates(Array.isArray(settings.holidayDates) ? settings.holidayDates : []);
                    setBufferMinutes(Number(settings.bufferMinutes) || 0);
                }
            } catch (error) {
                console.error("Error fetching booking settings:", error);
            }
        };
        fetchBookingSettings();
    }, []);

    // Fetch appointments & Calculate availability
    useEffect(() => {
        if (!date) return;

        const fetchAppointmentsForDate = async () => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );
            const querySnapshot = await getDocs(q);
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());
            
            const counts = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) {
                    counts[appt.time] = (counts[appt.time] || 0) + 1;
                }
            });
            setSlotCounts(counts);

            const slotOverlapCounts = {};
            const unavailable = new Set();
            const bufferTime = bufferMinutes || 0;
            
            appointmentsForDay.forEach(appt => {
                if (!appt.time || !appt.serviceInfo?.duration) return;
                
                const [hours, minutes] = appt.time.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                // ใช้ค่า duration จากการนัดหมายนั้นๆ
                const duration = appt.serviceInfo.duration || appt.appointmentInfo?.duration || 60;
                const endMinutes = startMinutes + duration + bufferTime;
                
                timeQueues.forEach(queue => {
                    if (!queue.time) return;
                    const [qHours, qMinutes] = queue.time.split(':').map(Number);
                    const qTimeMinutes = qHours * 60 + qMinutes;
                    
                    if (qTimeMinutes > startMinutes && qTimeMinutes < endMinutes) {
                        slotOverlapCounts[queue.time] = (slotOverlapCounts[queue.time] || 0) + 1;
                    }
                });
            });
            
            timeQueues.forEach(queue => {
                if (!queue.time) return;
                const maxSlots = useTechnician ? technicians.length : (queue.count || totalTechnicians);
                const overlapCount = slotOverlapCounts[queue.time] || 0;
                const bookedCount = counts[queue.time] || 0;
                
                if (bookedCount + overlapCount >= maxSlots) {
                    unavailable.add(queue.time);
                }
            });
            
            setUnavailableSlots(unavailable);

            if (time) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => appt.time === time && appt.technicianId)
                        .map(appt => appt.technicianId)
                );
                setUnavailableTechnicianIds(unavailableIds);

                if (selectedTechnician && unavailableIds.has(selectedTechnician.id)) {
                    setSelectedTechnician(null);
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
                }
            } else {
                setUnavailableTechnicianIds(new Set());
            }
        };

        fetchAppointmentsForDate();
    }, [date, time, selectedTechnician, showToast, timeQueues, bufferMinutes, useTechnician, technicians, totalTechnicians]);
    
    useEffect(() => {
        setTime('');
        setSelectedTechnician(null);
    }, [date]);
    
    // --- แก้ไข: ส่งค่า params ทั้งหมดต่อไปยังหน้า General Info ---
    const handleConfirm = () => {
        if (!date || !time) {
            showToast('กรุณาเลือกวันและเวลาที่ต้องการจอง', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        if (useTechnician && !selectedTechnician) {
            showToast('กรุณาเลือกช่างเสริมสวยที่ต้องการ', "warning", "ข้อมูลไม่ครบถ้วน");
            return;
        }
        
        const params = new URLSearchParams();
        if (serviceId) params.set('serviceId', serviceId);
        if (addOns) params.set('addOns', addOns);
        
        // Legacy Params
        if (areaIndex !== null) params.set('areaIndex', areaIndex);
        if (packageIndex !== null) params.set('packageIndex', packageIndex);

        // Option-Based Params (ส่งต่อ)
        if (selectedOptionName) params.set('selectedOptionName', selectedOptionName);
        if (selectedOptionPrice) params.set('selectedOptionPrice', selectedOptionPrice);
        if (selectedOptionDuration) params.set('selectedOptionDuration', selectedOptionDuration);
        if (selectedAreasParam) params.set('selectedAreas', selectedAreasParam);

        params.set('date', format(date, 'yyyy-MM-dd'));
        params.set('time', time);
        
        if (useTechnician && selectedTechnician) {
            params.set('technicianId', selectedTechnician.id);
        } else {
            params.set('technicianId', 'auto-assign');
        }
        
        router.push(`/appointment/general-info?${params.toString()}`);
    };

    const isDateOpen = (checkDate) => {
        const dayOfWeek = checkDate.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        const isRegularlyOpen = daySchedule ? daySchedule.isOpen : true;
        if (!isRegularlyOpen) return false;
        
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const isHoliday = holidayDates.some(holiday => holiday.date === dateStr);
        if (isHoliday) return false;
        
        return true;
    };

    const isTimeInBusinessHours = (timeSlot) => {
        if (!date) return true;
        const dayOfWeek = date.getDay();
        const daySchedule = weeklySchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.isOpen) return false;
        
        const slotTime = timeSlot.replace(':', '');
        const openTime = daySchedule.openTime.replace(':', '');
        const closeTime = daySchedule.closeTime.replace(':', '');
        
        return slotTime >= openTime && slotTime <= closeTime;
    };

    return (
        <div>
            <ToastComponent />
            <CustomerHeader showBackButton={true} showActionButtons={false} />
            <div className="min-h-screen flex flex-col items-center p-6">
            
            {/* Service Summary */}
            {service && (
                <div className="w-full max-w-md mx-auto mb-6">
                    <div className="bg-white rounded-2xl p-4 border border-primary shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                <Image
                                    src={service.imageUrl || 'https://via.placeholder.com/150'}
                                    alt={service.serviceName}
                                    fill
                                    style={{ objectFit: 'cover' }}
                                />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-md font-bold text-gray-900 truncate">{service.serviceName}</h3>
                                
                                {/* แสดงรายละเอียด Option-Based */}
                                {service.serviceType === 'option-based' && selectedOptionName && (
                                    <div className="mt-1">
                                        <p className="text-sm font-medium text-primary-dark">
                                            {selectedOptionName} 
                                            <span className="text-xs text-gray-500 ml-1">
                                                 x {selectedAreasParam ? selectedAreasParam.split(',').length : 0} จุด
                                            </span>
                                        </p>
                                        {selectedAreasParam && (
                                            <p className="text-xs text-gray-500 truncate">
                                                ({selectedAreasParam})
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* แสดงรายละเอียด Multi-Area (Legacy) */}
                                {service.serviceType === 'multi-area' && areaIndex !== null && packageIndex !== null && service.areas?.[areaIndex] && (
                                    <p className="text-sm text-gray-600">
                                        {service.areas[areaIndex].name} - {service.areas[areaIndex].packages[packageIndex].duration} นาที
                                    </p>
                                )}
                                
                                {/* แสดงรายละเอียด Single */}
                                {service.serviceType === 'single' && (
                                    <p className="text-sm text-gray-600">
                                        {service.duration} นาที | {profile?.currency}{service.price?.toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Calendar */}
            <div className="w-full bg-white/50 border border-primary p-4 rounded-2xl max-w-md mx-auto flex flex-col items-center shadow-sm backdrop-blur-sm">
                <div className="flex items-center justify-between w-full mb-4">
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() - 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-primary hover:bg-purple-50 rounded-full transition-colors"
                    >&#60;</button>
                    <span className="font-bold text-lg text-primary">
                        {activeMonth.toLocaleString('th-TH', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => setActiveMonth(prev => {
                            const d = new Date(prev);
                            d.setMonth(d.getMonth() + 1);
                            return d;
                        })}
                        className="px-3 py-2 text-xl text-primary hover:bg-purple-50 rounded-full transition-colors"
                    >&#62;</button>
                </div>
                <div className="w-full">
                    {/* Header วันในสัปดาห์ */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map((d, i) => (
                            <div key={i} className="text-sm text-primary text-center font-semibold py-2">{d}</div>
                        ))}
                    </div>
                    
                    {/* วันที่ในเดือน */}
                    <div className="grid grid-cols-7 gap-2">
                        {(() => {
                            const year = activeMonth.getFullYear();
                            const month = activeMonth.getMonth();
                            const firstDay = new Date(year, month, 1);
                            // const lastDay = new Date(year, month + 1, 0); // Unused
                            const startDate = new Date(firstDay);
                            startDate.setDate(startDate.getDate() - firstDay.getDay()); 
                            
                            const days = [];
                            const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 7, 0, 0);
                            
                            for (let i = 0; i < 42; i++) {
                                const d = new Date(currentDate);
                                const isCurrentMonth = d.getMonth() === month;
                                const isToday = (new Date()).toDateString() === d.toDateString();
                                const isSelected = date && d.toDateString() === date.toDateString();
                                const isPast = d < new Date(new Date().setHours(0,0,0,0));
                                const isBusinessOpen = isDateOpen(d);
                                
                                const dateStr = format(d, 'yyyy-MM-dd');
                                const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);
                                const isHoliday = !!holidayInfo;
                                
                                const isDisabled = isPast || !isBusinessOpen || !isCurrentMonth;
                                
                                days.push(
                                    <button
                                        key={i}
                                        onClick={() => !isDisabled && setDate(d)}
                                        className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-semibold transition-all relative
                                            ${!isCurrentMonth ? 'text-gray-300' : 
                                              isSelected ? 'bg-primary-dark text-white shadow-md transform scale-105' : 
                                              isToday ? 'border-2 border-primary text-primary bg-white' : 
                                              isHoliday ? 'bg-red-50 text-red-400 border border-red-100' :
                                              'bg-red-50 text-gray-700 hover:bg-purple-50 border border-transparent hover:border-purple-100'}
                                            ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}
                                            ${!isBusinessOpen && !isPast && isCurrentMonth ? 'bg-gray-100 text-gray-400' : ''}
                                        `}
                                        disabled={isDisabled}
                                    >
                                        {d.getDate()}
                                        {isHoliday && isCurrentMonth && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-400 rounded-full"></span>
                                        )}
                                    </button>
                                );
                                currentDate.setDate(currentDate.getDate() + 1);
                            }
                            
                            return days;
                        })()}
                    </div>
                </div>
            </div>

            {/* Available Time */}
            <div className="w-full max-w-md mx-auto mt-6">
                <h2 className="text-base font-bold mb-3 text-gray-800 pl-1">เลือกช่วงเวลา</h2>
                
                {date && !isDateOpen(date) ? (
                    <div className="text-center p-6 bg-red-50 border border-red-100 rounded-xl">
                        {(() => {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            const holidayInfo = holidayDates.find(holiday => holiday.date === dateStr);
                            
                            if (holidayInfo) {
                                return (
                                    <div>
                                        <p className="text-red-600 font-medium">วันหยุดพิเศษ</p>
                                        {holidayInfo.note && (
                                            <p className="text-red-500 text-sm mt-1">{holidayInfo.note}</p>
                                        )}
                                    </div>
                                );
                            } else {
                                return <p className="text-gray-600 font-medium">ร้านปิดทำการในวันนี้</p>;
                            }
                        })()}
                        <p className="text-sm text-gray-500 mt-1">กรุณาเลือกวันอื่น</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        {timeQueues
                            .filter(q => q.time && isTimeInBusinessHours(q.time))
                            .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                            .map(queue => {
                                const slot = queue.time;
                                const max = useTechnician ? technicians.length : (queue.count || totalTechnicians);
                                const booked = slotCounts[slot] || 0;
                                const isFull = booked >= max;
                                const isOverlapping = unavailableSlots.has(slot);
                                const isDisabled = isFull || isOverlapping;
                                return (
                                    <button
                                        key={slot}
                                        onClick={() => !isDisabled && setTime(slot)}
                                        className={`rounded-xl py-2 text-sm font-medium transition-all
                                            ${time === slot 
                                                ? 'bg-primary-dark text-white shadow-md transform scale-105' 
                                                : 'bg-white text-gray-600 border border-gray-100 hover:border-primary hover:text-primary'}
                                            ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50 border-transparent text-gray-400' : ''}`}
                                        disabled={isDisabled}
                                    >
                                        {slot} 
                                    </button>
                                );
                            })}
                    </div>
                )}
            </div>

            {/* technician Selection */}
            {useTechnician && time && (
                <div className="w-full max-w-md mx-auto mt-6">
                    <h2 className="text-base font-bold mb-3 text-gray-800 pl-1">เลือกช่าง (Optional)</h2>
                    {loading ? (
                        <div className="text-center py-4 text-gray-500">กำลังโหลดรายชื่อช่าง...</div>
                    ) : technicians.length === 0 ? (
                        <div className="text-center text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">ไม่มีช่างที่พร้อมให้บริการ</div>
                    ) : (
                        <div className="space-y-3">
                            {technicians.map(technician => (
                                <TechnicianCard
                                    key={technician.id}
                                    technician={technician}
                                    isSelected={selectedTechnician?.id === technician.id}
                                    onSelect={setSelectedTechnician}
                                    isAvailable={!unavailableTechnicianIds.has(technician.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Button */}
            <div className="w-full max-w-md mx-auto mt-8 mb-8 pb-10">
                <button
                    onClick={handleConfirm}
                    disabled={!date || !time || (useTechnician && selectedTechnician && unavailableTechnicianIds.has(selectedTechnician.id))}
                    className="w-full bg-primary-dark hover:bg-primary text-white py-4 rounded-full font-bold shadow-lg transform active:scale-95 transition-all disabled:bg-gray-300 disabled:shadow-none disabled:transform-none"
                >
                    ถัดไป
                </button>
            </div>
            </div>
        </div>
    );
}

export default function SelectDateTimePage() {
    return (
        <Suspense
            fallback={
            <div className="flex flex-col items-center justify-center min-h-screen w-full">
                <div className="p-4 text-center text-lg text-gray-500">กำลังโหลด...</div>
            </div>
            }
            >
            <SelectDateTimeContent />
        </Suspense>
    );
}