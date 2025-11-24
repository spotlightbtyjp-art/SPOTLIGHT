"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

const statusConfig = {
    'completed': { text: 'เสร็จสมบูรณ์', color: 'bg-green-100 text-green-800' },
    'cancelled': { text: 'ยกเลิก', color: 'bg-red-100 text-red-800' },
};

const HistoryCard = ({ appointment, onBookAgain }) => {
    const { profile } = useProfile();
    const appointmentDateTime = appointment.appointmentInfo.dateTime.toDate();
    const statusInfo = statusConfig[appointment.status] || { text: appointment.status, color: 'bg-gray-100 text-gray-800' };

    return (
        <div className="bg-white rounded-2xl p-4 space-y-3 shadow">
            <div className="flex">
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <h2 className="font-bold text-md text-gray-800">{appointment.serviceInfo?.name}</h2>

                            {/* Multi-area service details */}
                            {appointment.serviceInfo?.serviceType === 'multi-area' && (
                                <div className="mt-1 space-y-0.5">
                                    {appointment.serviceInfo?.selectedArea && (
                                        <div className="text-xs text-primary font-medium">
                                            📍 {appointment.serviceInfo.selectedArea.name}
                                        </div>
                                    )}
                                    {appointment.serviceInfo?.selectedPackage && (
                                        <div className="text-xs text-gray-600">
                                            📦 {appointment.serviceInfo.selectedPackage.name && <span className="font-bold">{appointment.serviceInfo.selectedPackage.name} </span>}
                                            ({appointment.serviceInfo.selectedPackage.duration} นาที)
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Option-based service details */}
                            {appointment.serviceInfo?.serviceType === 'option-based' && (
                                <div className="mt-1 space-y-0.5">
                                    {appointment.serviceInfo?.selectedOptionName && (
                                        <div className="text-xs text-primary font-medium">
                                            🏷️ {appointment.serviceInfo.selectedOptionName}
                                            {appointment.serviceInfo.selectedOptionPrice && (
                                                <span className="text-gray-500 font-normal"> (@ {Number(appointment.serviceInfo.selectedOptionPrice).toLocaleString()} {profile?.currencySymbol})</span>
                                            )}
                                            {appointment.serviceInfo.selectedAreas?.length > 0 && (
                                                <span className="text-gray-500 font-normal"> x {appointment.serviceInfo.selectedAreas.length} จุด</span>
                                            )}
                                        </div>
                                    )}
                                    {appointment.serviceInfo?.selectedAreas?.length > 0 && (
                                        <div className="text-xs text-gray-500 pl-4">
                                            {appointment.serviceInfo.selectedAreas.join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Area-based-options service details */}
                            {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions?.length > 0 && (
                                <div className="mt-1 space-y-1">
                                    {appointment.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                                        <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                            <span>🔸 {opt.areaName} ({opt.optionName})</span>
                                            {opt.price && <span>{Number(opt.price).toLocaleString()} {profile?.currencySymbol}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add-on Services */}
                            {appointment.appointmentInfo?.addOns?.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                    {appointment.appointmentInfo.addOns.map((addon, idx) => (
                                        <div key={idx} className="text-xs text-gray-500 flex justify-between">
                                            <span>+ {addon.name}</span>
                                            {addon.price && <span>{Number(addon.price).toLocaleString()} {profile?.currencySymbol}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-sm text-gray-500 mt-1">
                                {format(appointmentDateTime, 'dd MMM yyyy HH:mm น.', { locale: th })}
                            </p>
                            <p className="font-bold text-md text-gray-400">{appointment.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} {profile.currencySymbol}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusInfo.color}`}>
                            {statusInfo.text}
                        </span>

                    </div>
                </div>
            </div>

        </div>
    );
};

export default HistoryCard;
