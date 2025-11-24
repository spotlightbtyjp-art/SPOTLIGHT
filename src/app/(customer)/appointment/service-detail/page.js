"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import CustomerHeader from '@/app/components/CustomerHeader';
import { useProfile } from '@/context/ProfileProvider';

// --- Add-on Card Component ---
const AddOnCard = ({ addOn, isSelected, onToggle }) => {
    const { profile } = useProfile();
    return (
        <div
            onClick={() => onToggle(addOn)}
            className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-all text-sm ${isSelected ? 'bg-green-50 border-primary-dark ring-2 ring-green-200' : 'bg-white'}`}
        >
            <div className="flex items-center w-full">
                <span className="font-semibold text-gray-800 flex-1">{addOn.name}</span>
                <span className="text-xs text-gray-700 ml-2 whitespace-nowrap">{addOn.duration} นาที | {profile.currency}{addOn.price?.toLocaleString()}</span>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ml-2 ${isSelected ? 'bg-primary-dark' : 'border'}`}>
                    {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};

function ServiceDetailContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const serviceId = searchParams.get('id');
    const [service, setService] = useState(null);

    const [selectedAddOns, setSelectedAddOns] = useState([]);

    // Option-Based States
    const [selectedOptionIndex, setSelectedOptionIndex] = useState(null);
    const [selectedTargetAreas, setSelectedTargetAreas] = useState([]);

    // Area-Based-Options States
    const [selectedAreaOptions, setSelectedAreaOptions] = useState({}); // { areaName: optionIndex }
    const [expandedArea, setExpandedArea] = useState(null);

    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();

    useEffect(() => {
        if (!serviceId) {
            router.push('/appointment');
            return;
        }
        const fetchService = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'services', serviceId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { id: docSnap.id, ...docSnap.data() };
                    setService(data);

                    // Auto select min price option
                    if (data.serviceType === 'option-based' && data.serviceOptions?.length > 0) {
                        const minPriceIndex = data.serviceOptions.reduce((minIndex, current, currentIndex, array) => {
                            return current.price < array[minIndex].price ? currentIndex : minIndex;
                        }, 0);
                        setSelectedOptionIndex(minPriceIndex);
                    }
                } else {
                    router.push('/appointment');
                }
            } catch (error) {
                console.error("Error fetching service:", error);
                router.push('/appointment');
            } finally {
                setLoading(false);
            }
        };
        fetchService();
    }, [serviceId, router]);

    const toggleAddOn = (addOn) => {
        setSelectedAddOns(prev => {
            const isAlreadySelected = prev.some(item => item.name === addOn.name);
            if (isAlreadySelected) {
                return prev.filter(item => item.name !== addOn.name);
            } else {
                return [...prev, addOn];
            }
        });
    };

    const toggleTargetArea = (areaName) => {
        setSelectedTargetAreas(prev => {
            if (prev.includes(areaName)) {
                return prev.filter(a => a !== areaName);
            } else {
                return [...prev, areaName];
            }
        });
    };

    // Area-Based-Options Handlers
    const handleAreaOptionSelect = (areaName, optionIndex) => {
        setSelectedAreaOptions(prev => {
            const current = prev[areaName];
            if (current === optionIndex) {
                // Deselect if clicking the same one
                const newState = { ...prev };
                delete newState[areaName];
                return newState;
            }
            return { ...prev, [areaName]: optionIndex };
        });
    };

    const toggleAreaExpand = (areaName) => {
        setExpandedArea(prev => prev === areaName ? null : areaName);
    };

    // --- คำนวณราคา ---
    const totalPrice = useMemo(() => {
        let basePrice = 0;

        if (service?.serviceType === 'option-based') {
            if (selectedOptionIndex !== null && service.serviceOptions?.[selectedOptionIndex]) {
                const optionPrice = service.serviceOptions[selectedOptionIndex].price;
                // สูตร: ราคา Option x จำนวนจุดที่เลือก (ถ้าไม่เลือกจุดเลย ให้คิดราคา 1 จุดไปก่อนเพื่อโชว์)
                const multiplier = Math.max(1, selectedTargetAreas.length);
                basePrice = optionPrice * multiplier;
            }
        } else if (service?.serviceType === 'area-based-options') {
            Object.entries(selectedAreaOptions).forEach(([areaName, optIdx]) => {
                const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                if (areaGroup && areaGroup.options[optIdx]) {
                    basePrice += Number(areaGroup.options[optIdx].price) || 0;
                }
            });
        } else {
            basePrice = service?.price || 0;
        }

        const addOnsPrice = selectedAddOns.reduce((total, addOn) => total + (addOn.price || 0), 0);
        return basePrice + addOnsPrice;
    }, [service, selectedAddOns, selectedOptionIndex, selectedTargetAreas, selectedAreaOptions]);

    // --- คำนวณเวลา ---
    const totalDuration = useMemo(() => {
        let baseDuration = 0;

        if (service?.serviceType === 'option-based') {
            if (selectedOptionIndex !== null && service.serviceOptions?.[selectedOptionIndex]) {
                const optionDuration = service.serviceOptions[selectedOptionIndex].duration;
                // สูตร: เวลา Option x จำนวนจุดที่เลือก
                const multiplier = Math.max(1, selectedTargetAreas.length);
                baseDuration = optionDuration * multiplier;
            }
        } else if (service?.serviceType === 'area-based-options') {
            Object.entries(selectedAreaOptions).forEach(([areaName, optIdx]) => {
                const areaGroup = service.areaOptions?.find(g => g.areaName === areaName);
                if (areaGroup && areaGroup.options[optIdx]) {
                    baseDuration += Number(areaGroup.options[optIdx].duration) || 0;
                }
            });
        } else {
            baseDuration = service?.duration || 0;
        }

        const addOnsDuration = selectedAddOns.reduce((total, addOn) => total + (addOn.duration || 0), 0);
        return baseDuration + addOnsDuration;
    }, [service, selectedAddOns, selectedOptionIndex, selectedTargetAreas, selectedAreaOptions]);


    const handleConfirm = () => {
        const params = new URLSearchParams();
        params.set('serviceId', service.id);

        if (service.serviceType === 'option-based') {
            if (selectedTargetAreas.length === 0) {
                alert('กรุณาเลือกตำแหน่งอย่างน้อย 1 จุด');
                return;
            }
            if (selectedOptionIndex === null) {
                alert('กรุณาเลือกแพ็คเกจ (Option)');
                return;
            }
            const opt = service.serviceOptions[selectedOptionIndex];

            params.set('selectedOptionName', opt.name);
            params.set('selectedOptionPrice', opt.price.toString());
            params.set('selectedOptionDuration', opt.duration.toString());
            params.set('selectedAreas', selectedTargetAreas.join(','));
        } else if (service.serviceType === 'area-based-options') {
            if (Object.keys(selectedAreaOptions).length === 0) {
                alert('กรุณาเลือกตัวเลือกอย่างน้อย 1 รายการ');
                return;
            }
            params.set('selectedAreaOptions', JSON.stringify(selectedAreaOptions));
        }

        if (selectedAddOns.length > 0) {
            params.set('addOns', selectedAddOns.map(a => a.name).join(','));
        }
        router.push(`/appointment/select-date-time?${params.toString()}`);
    };

    if (loading || profileLoading) return <div className="p-4 text-center">กำลังโหลด...</div>;
    if (!service) return null;

    return (
        <div>
            <CustomerHeader showBackButton={true} showActionButtons={false} />

            <div className="p-6">
                {/* Header Image & Title */}
                <div className="flex flex-col gap-3 mb-4">
                    <div className="relative w-full h-24 aspect-square rounded-xl overflow-hidden flex-shrink-0">
                        <Image
                            src={service.imageUrl || 'https://via.placeholder.com/400x200'}
                            alt={service.serviceName}
                            fill
                            style={{ objectFit: 'cover' }}
                            className="rounded-xl"
                            priority
                        />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                        <h1 className="text-md font-bold text-gray-800 leading-tight">{service.serviceName}</h1>
                        {service.serviceType === 'single' && (
                            <div className="mb-3 p-3 bg-gray-50 rounded-lg mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">ระยะเวลา</span>
                                    <span className="text-sm text-gray-800">{service.duration} นาที</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">ราคา</span>
                                    <span className="text-sm text-gray-800">{profile.currency}{service.price?.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Option-Based UI */}
                <div className="mb-2">
                    {service.serviceType === 'option-based' && (
                        <div className="mb-6 space-y-6">
                            {/* 1. เลือกตำแหน่ง (Checkbox) */}
                            <div>
                                <h2 className="text-sm font-semibold mb-2 text-gray-700 flex items-center justify-between">
                                    เลือกตำแหน่ง
                                    {selectedTargetAreas.length > 0 && <span className="text-xs font-normal text-primary-dark   px-2 py-0.5 rounded-full">เลือก {selectedTargetAreas.length} จุด</span>}
                                </h2>
                                <div className="grid grid-cols-3 gap-2">
                                    {service.selectableAreas?.map((areaName, idx) => {
                                        const isSelected = selectedTargetAreas.includes(areaName);
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => toggleTargetArea(areaName)}
                                                className={`p-2 border rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-xs h-16 text-center ${isSelected ? 'bg-green-50 border-primary-dark ring-1 ring-primary-dark' : 'bg-white'}`}
                                            >
                                                <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary-dark border-primary-dark' : 'border-gray-300 bg-white'}`}>
                                                    {isSelected && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                                </div>
                                                <span className={`leading-tight ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{areaName}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. เลือกแพ็คเกจ (Radio) - Show only if areas selected */}
                            {selectedTargetAreas.length > 0 && (
                                <div className="animate-fade-in-up">
                                    <h2 className="text-sm font-semibold mb-2 text-gray-700">เลือกแพ็คเกจ (ราคาต่อจุด)</h2>
                                    <div className="space-y-2">
                                        {service.serviceOptions?.map((opt, idx) => {
                                            const isSelected = selectedOptionIndex === idx;
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedOptionIndex(idx)}
                                                    className={`p-2 border rounded-lg flex items-center justify-between cursor-pointer transition-all text-sm ${isSelected ? 'bg-green-50 border-primary-dark ring-1 ring-primary' : 'bg-white'}`}
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary-dark' : 'border-gray-400'}`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-dark"></div>}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className={`font-medium text-xs ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{opt.name}</div>
                                                            <div className="text-[10px] text-gray-500">{opt.duration} นาที/จุด</div>
                                                        </div>
                                                        <div className="font-bold text-xs text-primary-dark">
                                                            {profile.currency}{opt.price.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Area-Based-Options UI (Compact Accordion) */}
                    {service.serviceType === 'area-based-options' && (
                        <div className="mb-6 space-y-2">
                            <h2 className="text-sm font-semibold mb-2 text-gray-700">เลือกพื้นที่และบริการ</h2>
                            {service.areaOptions?.map((areaGroup, areaIdx) => {
                                const isExpanded = expandedArea === areaGroup.areaName;
                                const selectedOptIdx = selectedAreaOptions[areaGroup.areaName];
                                const selectedOpt = selectedOptIdx !== undefined ? areaGroup.options[selectedOptIdx] : null;

                                return (
                                    <div key={areaIdx} className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'ring-1 ring-primary-dark border-primary-dark' : 'border-gray-200'}`}>
                                        {/* Header */}
                                        <div
                                            onClick={() => toggleAreaExpand(areaGroup.areaName)}
                                            className={`p-3 flex items-center justify-between cursor-pointer bg-gray-50 ${selectedOpt ? 'bg-green-50' : ''}`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{areaGroup.areaName}</span>
                                                {selectedOpt && (
                                                    <span className="text-xs text-primary-dark font-medium">
                                                        {selectedOpt.name} ({profile.currency}{Number(selectedOpt.price).toLocaleString()})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-gray-400">
                                                {isExpanded ? '▲' : '▼'}
                                            </div>
                                        </div>

                                        {/* Options Body */}
                                        {isExpanded && (
                                            <div className="p-2 bg-white border-t border-gray-100 grid grid-cols-1 gap-2">
                                                {areaGroup.options?.map((opt, optIdx) => {
                                                    const isSelected = selectedOptIdx === optIdx;
                                                    return (
                                                        <div
                                                            key={optIdx}
                                                            onClick={() => handleAreaOptionSelect(areaGroup.areaName, optIdx)}
                                                            className={`p-2 border rounded flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-green-50 border-primary-dark' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-primary-dark' : 'border-gray-300'}`}>
                                                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-dark"></div>}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className={`text-xs font-medium ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{opt.name}</span>
                                                                    <span className="text-[10px] text-gray-400">{opt.duration} นาที</span>
                                                                </div>
                                                            </div>
                                                            <div className={`text-xs font-bold ${isSelected ? 'text-primary-dark' : 'text-gray-500'}`}>
                                                                {profile.currency}{Number(opt.price).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* สรุปยอด */}
                    <div className="flex items-center justify-between border-t pt-4 mt-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-bold text-gray-600 pr-4">ระยะเวลารวม</span>
                                <span className="text-sm font-bold text-gray-800">{totalDuration} นาที</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-600 pr-4">ราคารวม</span>
                                <span className="text-lg font-bold text-primary-dark">{profile.currency}{totalPrice.toLocaleString()}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleConfirm}
                            className="w-1/3 bg-primary-dark hover:bg-black text-white py-3 rounded-full font-bold text-base transition-colors shadow-md disabled:bg-gray-300 disabled:shadow-none"
                            disabled={
                                (service.serviceType === 'option-based' && (selectedTargetAreas.length === 0 || selectedOptionIndex === null)) ||
                                (service.serviceType === 'area-based-options' && Object.keys(selectedAreaOptions).length === 0)
                            }
                        >
                            จองบริการ
                        </button>
                    </div>
                </div>

                {/* Add-ons */}
                {(service.addOnServices && service.addOnServices.length > 0) && (
                    <div className="py-4 border-t mt-2">
                        <h2 className="text-sm font-bold mb-2">รายการเสริม</h2>
                        <div className="space-y-2">
                            {service.addOnServices.map((addOn, idx) => (
                                <AddOnCard
                                    key={idx}
                                    addOn={addOn}
                                    isSelected={selectedAddOns.some(item => item.name === addOn.name)}
                                    onToggle={toggleAddOn}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Details */}
                {service.details && (
                    <div className="py-2 mt-2">
                        <h2 className="text-sm font-bold mb-2">รายละเอียดบริการ</h2>
                        <p className="text-gray-600 text-sm leading-relaxed" style={{ whiteSpace: 'pre-line' }}>
                            {service.details}
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}

export default function ServiceDetailPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ServiceDetailContent />
        </Suspense>
    );
}