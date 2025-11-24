"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where, doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { useToast } from '@/app/components/Toast';
import { createAppointmentWithSlotCheck } from '@/app/actions/appointmentActions';
import { findOrCreateCustomer } from '@/app/actions/customerActions';
import { useProfile } from '@/context/ProfileProvider';
import TechnicianCard from '@/app/components/admin/TechnicianCard'; // แก้ไขชื่อ import ให้ถูกต้อง (ตัวใหญ่)
import TimeSlotGrid from '@/app/components/admin/TimeSlotGrid';

export default function CreateAppointmentPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const { profile, loading: profileLoading } = useProfile();

    // State for form data
    const [customerInfo, setCustomerInfo] = useState({
        fullName: '',
        phone: '',
        note: '',
        lineUserId: ''
    });
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedAddOnNames, setSelectedAddOnNames] = useState([]);
    const [selectedtechnicianId, setSelectedtechnicianId] = useState('');
    const [appointmentDate, setAppointmentDate] = useState('');
    const [appointmentTime, setAppointmentTime] = useState('');
    const [usetechnician, setUsetechnician] = useState(false);

    // สำหรับ multi-area services (Legacy)
    const [selectedAreaIndex, setSelectedAreaIndex] = useState(null);
    const [selectedPackageIndex, setSelectedPackageIndex] = useState(null);

    // สำหรับ option-based services (New)
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
    const [selectedAreas, setSelectedAreas] = useState([]);

    // State for data from Firestore
    const [services, setServices] = useState([]);
    const [technicians, settechnicians] = useState([]);
    const [unavailabletechnicianIds, setUnavailabletechnicianIds] = useState(new Set());
    // State สำหรับการตั้งค่าการจอง
    const defaultWeeklySchedule = {
        0: { isOpen: false },  // อาทิตย์
        1: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // จันทร์
        2: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // อังคาร
        3: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // พุธ
        4: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // พฤหัส
        5: { isOpen: true, openTime: '09:00', closeTime: '17:00' },  // ศุกร์
        6: { isOpen: false }   // เสาร์
    };

    const [bookingSettings, setBookingSettings] = useState({
        timeQueues: [],
        weeklySchedule: defaultWeeklySchedule,
        holidayDates: [],
        totaltechnicians: 1,
        usetechnician: true,
        bufferMinutes: 0
    });
    const [slotCounts, setSlotCounts] = useState({});
    const [unavailableSlots, setUnavailableSlots] = useState(new Set());

    // State for UI
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingCustomer, setExistingCustomer] = useState(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
    const [timeQueueFull, setTimeQueueFull] = useState(false);
    const [activeMonth, setActiveMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            input[type="date"]::-webkit-calendar-picker-indicator {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // โหลดข้อมูลพื้นฐาน
                const [settingsDoc, bookingSettingsDoc] = await Promise.all([
                    getDoc(doc(db, 'settings', 'general')),
                    getDoc(doc(db, 'settings', 'booking'))
                ]);

                // โหลดข้อมูล services
                const servicesQuery = query(collection(db, 'services'), orderBy('serviceName'));
                const servicesSnapshot = await getDocs(servicesQuery);
                setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

                // โหลดการตั้งค่าการจอง
                if (bookingSettingsDoc.exists()) {
                    const settings = bookingSettingsDoc.data();
                    setBookingSettings(prev => {
                        const weeklySchedule = settings.weeklySchedule || defaultWeeklySchedule;
                        return {
                            ...prev,
                            timeQueues: Array.isArray(settings.timeQueues) ? settings.timeQueues : [],
                            totaltechnicians: Number(settings.totaltechnicians) || 1,
                            usetechnician: !!settings.usetechnician,
                            holidayDates: Array.isArray(settings.holidayDates) ? settings.holidayDates : [],
                            weeklySchedule: weeklySchedule,
                            bufferMinutes: Number(settings.bufferMinutes) || 0
                        };
                    });
                }

                // โหลดข้อมูลช่าง
                const techniciansQuery = query(
                    collection(db, 'technicians'),
                    where('status', '==', 'available'),
                    orderBy('firstName')
                );
                const techniciansSnapshot = await getDocs(techniciansQuery);
                settechnicians(techniciansSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            } catch (error) {
                console.error("Error fetching data:", error);
                showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []); // โหลดข้อมูลเฉพาะตอน mount

    useEffect(() => {
        if (!appointmentDate) return;

        const fetchAppointmentsForDate = async () => {
            const dateStr = format(new Date(appointmentDate), 'yyyy-MM-dd');
            const q = query(
                collection(db, 'appointments'),
                where('date', '==', dateStr),
                where('status', 'in', ['pending', 'confirmed', 'awaiting_confirmation'])
            );
            const querySnapshot = await getDocs(q);
            const appointmentsForDay = querySnapshot.docs.map(doc => doc.data());

            // คำนวณจำนวนการจองในแต่ละช่วงเวลา
            const counts = {};
            appointmentsForDay.forEach(appt => {
                if (appt.time) {
                    counts[appt.time] = (counts[appt.time] || 0) + 1;
                }
            });
            setSlotCounts(counts);

            // คำนวณช่วงเวลาที่ทับซ้อนกัน (Time Overlap Detection)
            const slotOverlapCounts = {};
            const unavailable = new Set();
            const bufferTime = bookingSettings.bufferMinutes || 0;

            appointmentsForDay.forEach(appt => {
                if (!appt.time || !appt.serviceInfo?.duration) return;

                const [hours, minutes] = appt.time.split(':').map(Number);
                const startMinutes = hours * 60 + minutes;
                const duration = appt.serviceInfo.duration || appt.appointmentInfo?.duration || 60;
                const endMinutes = startMinutes + duration + bufferTime;

                bookingSettings.timeQueues.forEach(queue => {
                    if (!queue.time) return;
                    const [qHours, qMinutes] = queue.time.split(':').map(Number);
                    const qTimeMinutes = qHours * 60 + qMinutes;

                    if (qTimeMinutes > startMinutes && qTimeMinutes < endMinutes) {
                        slotOverlapCounts[queue.time] = (slotOverlapCounts[queue.time] || 0) + 1;
                    }
                });
            });

            bookingSettings.timeQueues.forEach(queue => {
                if (!queue.time) return;
                const maxSlots = bookingSettings.usetechnician ? technicians.length : (queue.count || bookingSettings.totaltechnicians);
                const overlapCount = slotOverlapCounts[queue.time] || 0;
                const bookedCount = counts[queue.time] || 0;

                if (bookedCount + overlapCount >= maxSlots) {
                    unavailable.add(queue.time);
                }
            });

            setUnavailableSlots(unavailable);

            if (appointmentTime) {
                const unavailableIds = new Set(
                    appointmentsForDay
                        .filter(appt => appt.time === appointmentTime && appt.technicianId)
                        .map(appt => appt.technicianId)
                );
                setUnavailabletechnicianIds(unavailableIds);

                if (selectedtechnicianId && unavailableIds.has(selectedtechnicianId)) {
                    setSelectedtechnicianId('');
                    showToast('ช่างที่เลือกไม่ว่างในเวลานี้แล้ว', 'warning', 'โปรดเลือกช่างใหม่');
                }
            } else {
                setUnavailabletechnicianIds(new Set());
            }
        };

        fetchAppointmentsForDate();
    }, [appointmentDate, appointmentTime, selectedtechnicianId, showToast, bookingSettings.timeQueues, bookingSettings.bufferMinutes]);

    const selectedService = useMemo(() => services.find(s => s.id === selectedServiceId), [services, selectedServiceId]);
    const selectedAddOns = useMemo(() => (selectedService?.addOnServices || []).filter(a => selectedAddOnNames.includes(a.name)), [selectedService, selectedAddOnNames]);

    // --- Logic คำนวณราคาและเวลา ---
    const { basePrice, addOnsTotal, totalPrice, totalDuration } = useMemo(() => {
        if (!selectedService) return { basePrice: 0, addOnsTotal: 0, totalPrice: 0, totalDuration: 0 };

        let base = 0;
        let duration = 0;

        if (selectedService.serviceType === 'multi-area') {
            // 1. Multi-Area
            if (selectedAreaIndex !== null && selectedPackageIndex !== null && selectedService.areas?.[selectedAreaIndex]?.packages?.[selectedPackageIndex]) {
                const selectedPackage = selectedService.areas[selectedAreaIndex].packages[selectedPackageIndex];
                base = selectedPackage.price;
                duration = selectedPackage.duration;
            }
        } else if (selectedService.serviceType === 'option-based') {
            // 2. Option-Based
            if (selectedOptionIndex !== null && selectedService.serviceOptions?.[selectedOptionIndex]) {
                const option = selectedService.serviceOptions[selectedOptionIndex];
                // สูตร: ราคา/เวลา Option * จำนวนพื้นที่
                const multiplier = Math.max(1, selectedAreas.length);
                base = option.price * multiplier;
                duration = option.duration * multiplier;
            }
        } else {
            // 3. Single
            base = selectedService.price || 0;
            duration = selectedService.duration || 0;
        }

        const addOnsPrice = selectedAddOns.reduce((sum, a) => sum + (a.price || 0), 0);
        const addOnsDuration = selectedAddOns.reduce((sum, a) => sum + (a.duration || 0), 0);

        return {
            basePrice: base,
            addOnsTotal: addOnsPrice,
            totalPrice: base + addOnsPrice,
            totalDuration: duration + addOnsDuration
        };
    }, [selectedService, selectedAddOns, selectedAreaIndex, selectedPackageIndex, selectedOptionIndex, selectedAreas]);

    const checkExistingCustomer = async (phone, lineUserId) => {
        if (!phone && !lineUserId) {
            setExistingCustomer(null);
            return;
        }

        setIsCheckingCustomer(true);
        try {
            if (lineUserId) {
                const customerDoc = await getDoc(doc(db, 'customers', lineUserId));
                if (customerDoc.exists()) {
                    setExistingCustomer({ id: customerDoc.id, ...customerDoc.data() });
                    setIsCheckingCustomer(false);
                    return;
                }
            }

            if (phone) {
                const q = query(collection(db, 'customers'), where('phone', '==', phone));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const customerData = snapshot.docs[0];
                    setExistingCustomer({ id: customerData.id, ...customerData.data() });
                } else {
                    setExistingCustomer(null);
                }
            }
        } catch (error) {
            console.error('Error checking customer:', error);
            setExistingCustomer(null);
        } finally {
            setIsCheckingCustomer(false);
        }
    };

    // ตรวจสอบลูกค้าเฉพาะเมื่อเบอร์โทรครบ 9 หลัก หรือมี lineUserId
    useEffect(() => {
        const shouldCheck = (customerInfo.phone && customerInfo.phone.length >= 9) || (customerInfo.lineUserId && customerInfo.lineUserId.length > 0);
        if (!shouldCheck) {
            setExistingCustomer(null);
            return;
        }
        const timeoutId = setTimeout(() => {
            checkExistingCustomer(customerInfo.phone, customerInfo.lineUserId);
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [customerInfo.phone, customerInfo.lineUserId]);

    // Reset เวลาและช่างเมื่อเปลี่ยนวันที่
    useEffect(() => {
        setAppointmentTime('');
        setSelectedtechnicianId('');
    }, [appointmentDate]);

    const getThaiDateString = (date) => {
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0);
        return format(localDate, 'yyyy-MM-dd');
    };

    const isDateOpen = (date) => {
        const dayOfWeek = date.getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];
        if (!daySchedule || !daySchedule.isOpen) {
            return false;
        }
        const dateStr = getThaiDateString(date);
        const isHoliday = bookingSettings.holidayDates.some(holiday => holiday.date === dateStr);
        return !isHoliday;
    };

    const isTimeInBusinessHours = (timeSlot) => {
        if (!appointmentDate) return true;
        const dayOfWeek = new Date(appointmentDate).getDay();
        const daySchedule = bookingSettings.weeklySchedule[dayOfWeek];

        if (!daySchedule || !daySchedule.isOpen) return false;

        const slotTime = timeSlot.replace(':', '');
        const openTime = daySchedule.openTime?.replace(':', '') || '0900';
        const closeTime = daySchedule.closeTime?.replace(':', '') || '1700';

        return slotTime >= openTime && slotTime <= closeTime;
    };

    const isDateDisabled = (date) => {
        return !isDateOpen(date);
    };

    const checkHolidayDate = (date) => {
        const dateString = getThaiDateString(date);
        const specialHoliday = bookingSettings.holidayDates?.find(h => h.date === dateString);
        const dayOfWeek = date.getDay();
        const isWeekendHoliday = !bookingSettings.weeklySchedule?.[dayOfWeek]?.isOpen;

        return {
            isHoliday: !!specialHoliday || isWeekendHoliday,
            holidayInfo: specialHoliday || (isWeekendHoliday ? { reason: 'วันหยุดประจำสัปดาห์' } : null)
        };
    };

    const availableTimeSlots = useMemo(() => {
        if (!appointmentDate || !bookingSettings?.timeQueues) {
            return [];
        }

        const selectedDate = new Date(appointmentDate);
        const dayOfWeek = selectedDate.getDay();
        const daySchedule = bookingSettings.weeklySchedule?.[dayOfWeek];
        const holiday = checkHolidayDate(selectedDate);

        if (holiday.isHoliday) return [];
        if (!daySchedule?.isOpen) return [];

        const openTime = daySchedule?.openTime?.replace(':', '') || '0900';
        const closeTime = daySchedule?.closeTime?.replace(':', '') || '1700';

        let slots = bookingSettings.timeQueues
            .filter(queue => {
                if (!queue?.time) return false;
                const slotTime = queue.time.replace(':', '');
                return slotTime >= openTime && slotTime <= closeTime;
            })
            .map(queue => queue.time)
            .sort();

        const today = new Date();
        const isToday = appointmentDate === format(today, 'yyyy-MM-dd');
        if (isToday) {
            const now = new Date();
            const currentTime = format(now, 'HH:mm');
            slots = slots.filter(slot => slot > currentTime);
        }

        setTimeQueueFull(slots.length === 0);
        return slots;
    }, [appointmentDate, bookingSettings]);


    const handleServiceChange = (e) => {
        setSelectedServiceId(e.target.value);
        setSelectedAddOnNames([]);
        // Reset Multi-Area
        setSelectedAreaIndex(null);
        setSelectedPackageIndex(null);
        // Reset Option-Based
        setSelectedOptionIndex(null);
        setSelectedAreas([]);
    };

    const handleAddOnToggle = (addOnName) => {
        setSelectedAddOnNames(prev =>
            prev.includes(addOnName)
                ? prev.filter(name => name !== addOnName)
                : [...prev, addOnName]
        );
    };

    // Handler สำหรับ Toggle Area (Option-Based)
    const handleToggleArea = (areaName) => {
        setSelectedAreas(prev =>
            prev.includes(areaName)
                ? prev.filter(a => a !== areaName)
                : [...prev, areaName]
        );
    };

    const handleCustomerInfoChange = (e) => {
        const { name, value } = e.target;
        setCustomerInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedServiceId) {
            showToast('กรุณาเลือกบริการ', 'error');
            return;
        }

        // Validate: Multi-Area
        if (selectedService.serviceType === 'multi-area') {
            if (selectedAreaIndex === null) {
                showToast('กรุณาเลือกพื้นที่บริการ', 'error');
                return;
            }
            if (selectedPackageIndex === null) {
                showToast('กรุณาเลือกแพ็คเกจ', 'error');
                return;
            }
        }

        // Validate: Option-Based
        if (selectedService.serviceType === 'option-based') {
            if (selectedAreas.length === 0) {
                showToast('กรุณาเลือกพื้นที่บริการอย่างน้อย 1 จุด', 'error');
                return;
            }
            if (selectedOptionIndex === null) {
                showToast('กรุณาเลือกแพ็คเกจ', 'error');
                return;
            }
        }

        if (!appointmentDate || !appointmentTime || !customerInfo.fullName || !customerInfo.phone) {
            showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
            return;
        }

        // Check Buffer (1 hour)
        const now = new Date();
        const bookingDateTime = new Date(`${appointmentDate}T${appointmentTime}`);
        if (bookingDateTime - now < 60 * 60 * 1000) {
            showToast('ต้องจองล่วงหน้าอย่างน้อย 1 ชั่วโมง', 'error');
            return;
        }

        // Check Slots
        const reCheckSlots = slotCounts[appointmentTime] || 0;
        const selectedQueue = bookingSettings.timeQueues.find(q => q.time === appointmentTime);
        const maxSlots = bookingSettings.usetechnician ? technicians.length : (selectedQueue?.count || bookingSettings.totaltechnicians);
        if (reCheckSlots >= maxSlots) {
            showToast('ช่วงเวลาที่เลือกเต็มแล้ว กรุณาเลือกเวลาใหม่', 'error');
            return;
        }

        if (unavailableSlots.has(appointmentTime)) {
            showToast('เวลาที่เลือกทับซ้อนกับการจองอื่น กรุณาเลือกเวลาใหม่', 'error');
            return;
        }

        setIsSubmitting(true);

        try {
            const customerResult = await findOrCreateCustomer({
                fullName: customerInfo.fullName,
                phone: customerInfo.phone,
                note: customerInfo.note
            }, customerInfo.lineUserId || null);

            if (!customerResult.success) {
                throw new Error(customerResult.error || 'ไม่สามารถสร้างข้อมูลลูกค้าได้');
            }

            if (customerResult.mergedPoints > 0) {
                showToast(`พบการรวมแต้ม: ${customerResult.mergedPoints} แต้ม`, 'info');
            }

            let technician = null;
            if (usetechnician && selectedtechnicianId) {
                technician = technicians.find(b => b.id === selectedtechnicianId);
            }

            // Prepare Service & Appointment Info
            let serviceInfo = {
                id: selectedService.id,
                name: selectedService.serviceName,
                imageUrl: selectedService.imageUrl || '',
                serviceType: typeof selectedService.serviceType === 'string' && selectedService.serviceType.trim()
                    ? selectedService.serviceType
                    : 'single',
                selectedArea: null,
                selectedPackage: null,
                areaIndex: null,
                packageIndex: null,
                selectedOptionName: null,
                selectedAreas: [],
            };

            let appointmentInfo = {
                technicianId: usetechnician ? technician?.id : null,
                employeeId: usetechnician ? technician?.id : null,
                technicianInfo: usetechnician ? { firstName: technician?.firstName, lastName: technician?.lastName } : { firstName: 'ระบบ', lastName: 'จัดสรรช่าง' },
                dateTime: new Date(`${appointmentDate}T${appointmentTime}`),
                addOns: selectedAddOns,
                duration: totalDuration,
                selectedArea: null,
                selectedPackage: null,
                areaIndex: null,
                packageIndex: null,
                selectedOptionName: null,
                selectedAreas: [],
            };

            // Populate for multi-area
            if (selectedService.serviceType === 'multi-area' && selectedAreaIndex !== null && selectedPackageIndex !== null) {
                const selectedArea = selectedService.areas?.[selectedAreaIndex] || null;
                const selectedPackage = selectedArea?.packages?.[selectedPackageIndex] || null;

                serviceInfo.selectedArea = selectedArea;
                serviceInfo.selectedPackage = selectedPackage;
                serviceInfo.areaIndex = selectedAreaIndex;
                serviceInfo.packageIndex = selectedPackageIndex;

                appointmentInfo.selectedArea = selectedArea;
                appointmentInfo.selectedPackage = selectedPackage;
                appointmentInfo.areaIndex = selectedAreaIndex;
                appointmentInfo.packageIndex = selectedPackageIndex;
            }

            // Populate for option-based
            if (selectedService.serviceType === 'option-based' && selectedOptionIndex !== null) {
                const optionName = selectedService.serviceOptions[selectedOptionIndex].name;

                serviceInfo.selectedOptionName = optionName;
                serviceInfo.selectedAreas = selectedAreas;

                appointmentInfo.selectedOptionName = optionName;
                appointmentInfo.selectedAreas = selectedAreas;
            }

            const appointmentData = {
                userId: customerResult.customerId,
                userInfo: { displayName: customerInfo.fullName },
                status: 'awaiting_confirmation',
                customerInfo: {
                    ...customerInfo,
                    customerId: customerResult.customerId
                },
                serviceInfo,
                date: appointmentDate,
                time: appointmentTime,
                serviceId: selectedService.id,
                technicianId: usetechnician ? technician?.id : null,
                appointmentInfo,
                paymentInfo: {
                    basePrice,
                    addOnsTotal,
                    originalPrice: totalPrice,
                    totalPrice: totalPrice,
                    discount: 0,
                    paymentStatus: 'pending',
                },
                createdAt: new Date(),
                createdBy: {
                    type: 'admin',
                    adminId: profile?.uid,
                    adminName: profile?.displayName || 'Admin'
                },
                needsCustomerNotification: true,
            };

            const result = await createAppointmentWithSlotCheck(appointmentData);
            if (result.success) {
                showToast('สร้างการนัดหมายสำเร็จ! รอการยืนยันจากลูกค้า', 'success');
                showToast('ระบบจะส่งการแจ้งเตือนให้ลูกค้ายืนยันการจอง', 'info');
                router.push('/dashboard');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
            console.error("Error creating appointment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || profileLoading) {
        return <div className="text-center p-10">กำลังโหลดข้อมูล...</div>;
    }
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6 text-gray-800">สร้างการนัดหมายใหม่</h1>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* คอลัมน์ซ้าย: ขั้นตอน 1-2 */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="p-4 border rounded-lg">
                                <h2 className="text-sm font-semibold mb-3">1. บริการ</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {services.filter(s => s.status === 'available').map(s => {
                                        const isSelected = selectedServiceId === s.id;
                                        return (
                                            <button
                                                type="button"
                                                key={s.id}
                                                onClick={() => handleServiceChange({ target: { value: s.id } })}
                                                className={`w-full text-left p-3 rounded-lg border transition-all shadow-sm focus:outline-none ${isSelected ? 'border-primary bg-indigo-50 ring-2 ring-primary' : 'border-gray-200 bg-white hover:border-primary'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {s.imageUrl && (
                                                        <img src={s.imageUrl} alt={s.serviceName} className="w-12 h-12 object-cover rounded-md border" />
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="font-bold text-sm text-gray-800">{s.serviceName}</div>
                                                        <div className="text-xs text-gray-500 mb-1">
                                                            {s.serviceType === 'multi-area'
                                                                ? `${s.areas?.length || 0} พื้นที่`
                                                                : s.serviceType === 'option-based'
                                                                    ? 'เลือกพื้นที่ + แพ็คเกจ'
                                                                    : `${s.duration || '-'} นาที`
                                                            }
                                                            {' | '}{profile?.currencySymbol}{(s.price ?? s.basePrice ?? 0).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* UI สำหรับ Multi-Area (Legacy) */}
                                {selectedService?.serviceType === 'multi-area' && selectedService.areas && (
                                    <div className="mt-4">
                                        <h3 className="text-md font-medium mb-2">เลือกพื้นที่บริการ:</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {selectedService.areas.map((area, areaIdx) => (
                                                <button
                                                    key={areaIdx}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedAreaIndex(areaIdx);
                                                        setSelectedPackageIndex(null);
                                                    }}
                                                    className={`p-3 border rounded-md text-left transition-colors ${selectedAreaIndex === areaIdx
                                                        ? 'bg-blue-100 border-blue-500 text-blue-800'
                                                        : 'bg-white border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="font-medium">{area.name}</div>
                                                    <div className="text-sm text-gray-600">
                                                        {area.packages?.length || 0} แพ็คเกจ
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        {
                                            selectedAreaIndex !== null && selectedService.areas[selectedAreaIndex]?.packages && (
                                                <div className="mt-4">
                                                    <h4 className="text-md font-medium mb-2">เลือกแพ็คเกจ:</h4>
                                                    <div className="space-y-2">
                                                        {selectedService.areas[selectedAreaIndex].packages.map((pkg, pkgIdx) => (
                                                            <label key={pkgIdx} className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                                                                <input
                                                                    type="radio"
                                                                    name="package"
                                                                    checked={selectedPackageIndex === pkgIdx}
                                                                    onChange={() => setSelectedPackageIndex(pkgIdx)}
                                                                    className="h-4 w-4 text-blue-600"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-900">
                                                                        {pkg.name && <span className="font-bold text-indigo-600 mr-2">{pkg.name}</span>}
                                                                        {pkg.duration} นาที
                                                                    </div>
                                                                    <div className="text-sm text-gray-600">{pkg.price.toLocaleString()} {profile.currencySymbol}</div>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div >
                                )
                                }

                                {/* UI สำหรับ Option-Based (New) */}
                                {
                                    selectedService?.serviceType === 'option-based' && (
                                        <div className="mt-6 space-y-6 border-t pt-4">
                                            {/* 1. Select Areas */}
                                            <div>
                                                <h3 className="text-md font-bold text-gray-700 mb-2">1. เลือกพื้นที่บริการ (เลือกได้มากกว่า 1)</h3>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    {selectedService.selectableAreas?.map((areaName, idx) => (
                                                        <label key={idx} className={`flex items-center gap-2 p-3 border rounded-md cursor-pointer transition-all ${selectedAreas.includes(areaName) ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-300'}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedAreas.includes(areaName)}
                                                                onChange={() => handleToggleArea(areaName)}
                                                                className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                                            />
                                                            <span className="text-sm font-medium">{areaName}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 2. Select Option */}
                                            <div>
                                                <h3 className="text-md font-bold text-gray-700 mb-2">2. เลือกแพ็คเกจ</h3>
                                                <div className="space-y-2">
                                                    {selectedService.serviceOptions?.map((opt, idx) => (
                                                        <label key={idx} className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-all ${selectedOptionIndex === idx ? 'bg-green-50 border-green-500 ring-1 ring-green-200' : 'bg-white border-gray-300 hover:bg-gray-50'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="radio"
                                                                    name="serviceOption"
                                                                    checked={selectedOptionIndex === idx}
                                                                    onChange={() => setSelectedOptionIndex(idx)}
                                                                    className="h-4 w-4 text-green-600"
                                                                />
                                                                <div>
                                                                    <div className="font-bold text-gray-800">{opt.name}</div>
                                                                    <div className="text-xs text-gray-500">{opt.duration} นาที/จุด</div>
                                                                </div>
                                                            </div>
                                                            <div className="font-bold text-green-600">
                                                                {opt.price.toLocaleString()} {profile.currencySymbol}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }

                                {
                                    selectedService?.addOnServices?.length > 0 && (
                                        <div className="mt-6 border-t pt-4">
                                            <h3 className="text-md font-medium mb-2">บริการเสริม:</h3>
                                            <div className="space-y-2">
                                                {selectedService.addOnServices.map((addOn, idx) => (
                                                    <label key={idx} className="flex items-center gap-3 p-2 border rounded-md cursor-pointer hover:bg-gray-50">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedAddOnNames.includes(addOn.name)}
                                                            onChange={() => handleAddOnToggle(addOn.name)}
                                                            className="h-4 w-4 rounded"
                                                        />
                                                        <span className="flex-1">{addOn.name}</span>
                                                        <span className="text-sm text-gray-600">+{addOn.duration} นาที / +{addOn.price} {profile.currencySymbol}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }
                            </div >

                            {/* Section 2: Calendar & Time */}
                            < div className="p-4 border rounded-lg" >
                                <h2 className="text-sm font-semibold mb-3">2. ช่างและวันเวลา</h2>
                                <div className={`grid grid-cols-1 ${!usetechnician ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                                    {/* Calendar Code (Same as original) */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-medium text-gray-700">วันที่</label>
                                        <div className="calendar-container bg-white rounded-lg shadow p-4 border border-gray-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const prevMonth = new Date(activeMonth);
                                                        prevMonth.setMonth(prevMonth.getMonth() - 1);
                                                        setActiveMonth(prevMonth);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 rounded-full"
                                                >
                                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                                    </svg>
                                                </button>
                                                <span className="text-sm font-medium text-gray-700">
                                                    {activeMonth.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextMonth = new Date(activeMonth);
                                                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                                                        setActiveMonth(nextMonth);
                                                    }}
                                                    className="p-2 hover:bg-gray-100 rounded-full"
                                                >
                                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                                                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(day => (
                                                    <div key={day} className="text-xs font-medium text-gray-500">
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-1">
                                                {(() => {
                                                    const currentYear = activeMonth.getFullYear();
                                                    const currentMonth = activeMonth.getMonth();
                                                    const firstDay = new Date(currentYear, currentMonth, 1, 0, 0, 0);
                                                    const lastDay = new Date(currentYear, currentMonth + 1, 0, 0, 0, 0);

                                                    const days = [];
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);

                                                    for (let i = 0; i < firstDay.getDay(); i++) {
                                                        days.push(<div key={`empty-${i}`} className="p-2" />);
                                                    }

                                                    for (let day = 1; day <= lastDay.getDate(); day++) {
                                                        const date = new Date(currentYear, currentMonth, day, 7, 0, 0);
                                                        const dateString = format(date, 'yyyy-MM-dd');
                                                        const isSelected = dateString === appointmentDate;
                                                        const isPast = date < today;
                                                        const isToday = date.toDateString() === today.toDateString();
                                                        const { isHoliday, holidayInfo } = checkHolidayDate(date);
                                                        const isDisabled = isPast || isDateDisabled(date);

                                                        days.push(
                                                            <button
                                                                key={day}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (isPast || isHoliday || isDisabled) return;
                                                                    setAppointmentDate(dateString);
                                                                    setAppointmentTime('');
                                                                    setSelectedtechnicianId('');
                                                                }}
                                                                disabled={isDisabled || isHoliday}
                                                                className={`
                                                                    w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm transition-colors
                                                                    ${isSelected ? 'bg-primary text-white font-bold' : ''}
                                                                    ${!isSelected && isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                                                                    ${!isSelected && isHoliday ? 'text-red-400 cursor-not-allowed bg-red-50' : ''}
                                                                    ${!isSelected && !isPast && !isHoliday && isDisabled ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : ''}
                                                                    ${!isSelected && !isPast && !isHoliday && !isDisabled ? 'hover:bg-gray-100 text-gray-700' : ''}
                                                                    ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                                                                `}
                                                            >
                                                                {day}
                                                            </button>
                                                        );
                                                    }
                                                    return days;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full max-w-md mx-auto">
                                        <h2 className="text-base font-bold mb-2 text-primary">เลือกช่วงเวลา</h2>
                                        {/* ... (Time selection logic same as before) ... */}
                                        {appointmentDate && !isDateOpen(new Date(appointmentDate)) ? (
                                            <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-red-500 text-sm">วันหยุดทำการ</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                {bookingSettings.timeQueues
                                                    .filter(q => q.time && isTimeInBusinessHours(q.time))
                                                    .sort((a, b) => String(a.time).localeCompare(String(b.time)))
                                                    .map(queue => {
                                                        const slot = queue.time;
                                                        const max = bookingSettings.usetechnician ? technicians.length : (queue.count || bookingSettings.totaltechnicians);
                                                        const booked = slotCounts[slot] || 0;
                                                        const isFull = booked >= max;
                                                        const isOverlapping = unavailableSlots.has(slot);
                                                        const isDisabled = isFull || isOverlapping;

                                                        return (
                                                            <button
                                                                key={slot}
                                                                type="button"
                                                                onClick={() => !isDisabled && setAppointmentTime(slot)}
                                                                className={`rounded-md px-2 py-2 text-xs font-semibold shadow-sm transition-colors border
                                                                    ${appointmentTime === slot ? 'bg-primary-dark text-white border-primary-dark' : 'bg-white text-gray-700 border-gray-200 hover:border-primary'}
                                                                    ${isDisabled ? 'opacity-40 cursor-not-allowed bg-gray-50' : ''}`}
                                                                disabled={isDisabled}
                                                            >
                                                                {slot} {isFull && '(เต็ม)'} {isOverlapping && !isFull && '(ทับ)'}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </div>

                                    {bookingSettings.usetechnician && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">ช่าง</label>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {technicians.map(b => (
                                                    <TechnicianCard
                                                        key={b.id}
                                                        technician={b}
                                                        isSelected={selectedtechnicianId === b.id}
                                                        onSelect={(technician) => setSelectedtechnicianId(technician.id)}
                                                        isAvailable={!unavailabletechnicianIds.has(b.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div >
                        </div >

                        {/* คอลัมน์ขวา: ขั้นตอน 3 */}
                        < div className="lg:col-span-1" >
                            <div className="p-4 border rounded-lg top-4 sticky">
                                <h2 className="text-sm font-semibold mb-3">3. ข้อมูลลูกค้า</h2>
                                <div className="grid grid-cols-1 gap-4">
                                    <input
                                        name="fullName"
                                        value={customerInfo.fullName}
                                        onChange={handleCustomerInfoChange}
                                        placeholder="ชื่อ-นามสกุล"
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={customerInfo.phone}
                                        onChange={handleCustomerInfoChange}
                                        placeholder="เบอร์โทรศัพท์"
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                    <input
                                        type="text"
                                        name="lineUserId"
                                        value={customerInfo.lineUserId}
                                        onChange={handleCustomerInfoChange}
                                        placeholder="LINE User ID (ถ้ามี)"
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>

                                {/* Existing Customer Check UI (Same as original) */}
                                {existingCustomer && !isCheckingCustomer && (
                                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                            <span className="text-sm font-medium text-green-800">ลูกค้าเดิม</span>
                                        </div>
                                        <div className="text-xs text-green-700">
                                            {existingCustomer.fullName} ({existingCustomer.phone})
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 border-t mt-6 bg-gray-50 rounded-md">
                                    <div className="flex justify-between items-center gap-2 mb-2">
                                        <span className="text-gray-600 text-sm">ยอดรวม:</span>
                                        <span className="text-xl font-bold text-primary">{totalPrice.toLocaleString()} {profile.currencySymbol}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 text-right mb-4">
                                        ระยะเวลา: {totalDuration} นาที
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting || (usetechnician && !selectedtechnicianId)}
                                        className="w-full bg-primary-dark text-white p-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                                    >
                                        {isSubmitting ? 'กำลังบันทึก...' : 'สร้างการนัดหมาย'}
                                    </button>
                                </div>
                            </div>
                        </div >
                    </div >
                </form >
            </div >
        </div >
    );
}
