"use client";

import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '../../../context/ProfileProvider';

const AppointmentCard = ({ job, onQrCodeClick, onCancelClick, onConfirmClick, isConfirming }) => {
    const { profile } = useProfile();
    const statusInfo = {
        'awaiting_confirmation': { text: 'รอยืนยัน' },
        'confirmed': { text: 'ยืนยันแล้ว' },
        'in_progress': { text: 'กำลังใช้บริการ' },
    }[job.status] || { text: job.status };

    const appointmentDateTime = job.appointmentInfo.dateTime.toDate();
    const addOns = job.appointmentInfo?.addOns || [];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-primary-dark p-4 text-primary-light">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="text-sm opacity-90">นัดหมายบริการ</div>
                        <div className="font-semibold">{format(appointmentDateTime, 'dd MMMM yyyy, HH:mm น.', { locale: th })}</div>
                    </div>
                    <div className="text-sm font-semibold">{statusInfo.text}</div>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
                <div className="flex justify-between items-start text-sm mb-2">
                    <div className="flex-1">
                        <span className="font-semibold text-gray-800 block">{job.serviceInfo?.name}</span>

                        {/* Multi-area service details */}
                        {job.serviceInfo?.serviceType === 'multi-area' && (
                            <div className="mt-1 space-y-0.5">
                                {job.serviceInfo?.selectedArea && (
                                    <div className="text-xs text-primary font-medium">
                                        {job.serviceInfo.selectedArea.name}
                                    </div>
                                )}
                                {job.serviceInfo?.selectedPackage && (
                                    <div className="text-xs text-primary">
                                        {job.serviceInfo.selectedPackage.name && <span className="font-bold">{job.serviceInfo.selectedPackage.name} </span>}
                                        ({job.serviceInfo.selectedPackage.duration} นาที)
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Option-based service details */}
                        {job.serviceInfo?.serviceType === 'option-based' && (
                            <div className="mt-1 space-y-0.5">
                                {job.serviceInfo?.selectedOptionName && (
                                    <div className="text-xs text-primary font-medium">
                                        {job.serviceInfo.selectedOptionName}
                                        {job.serviceInfo.selectedOptionPrice && (
                                            <span className="text-gray-500 font-normal"> (@ {Number(job.serviceInfo.selectedOptionPrice).toLocaleString()} {profile?.currencySymbol})</span>
                                        )}
                                        {job.serviceInfo.selectedAreas?.length > 0 && (
                                            <span className="text-gray-500 font-normal"> x {job.serviceInfo.selectedAreas.length} จุด</span>
                                        )}
                                    </div>
                                )}
                                {job.serviceInfo?.selectedAreas?.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                        ({job.serviceInfo.selectedAreas.join(', ')})
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Area-based-options service details */}
                        {job.serviceInfo?.serviceType === 'area-based-options' && job.serviceInfo?.selectedAreaOptions?.length > 0 && (
                            <div className="mt-1 space-y-1">
                                {job.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                                    <div key={idx} className="text-xs text-gray-600 flex justify-between">
                                        <span>{opt.areaName} ({opt.optionName})</span>
                                        {opt.price && <span>{Number(opt.price).toLocaleString()} {profile?.currencySymbol}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <span className="text-gray-700 ml-2">{job.paymentInfo?.basePrice?.toLocaleString()} {profile?.currencySymbol}</span>
                </div>

                {/* Add-on Services */}
                {addOns.length > 0 && (
                    <div className="space-y-1 text-sm text-primary mb-3 pl-4 border-l-2">
                        {addOns.map((addon, index) => (
                            <div key={index} className="flex justify-between">
                                <span>+ {addon.name}</span>
                                <span>{addon.price?.toLocaleString()} {profile?.currencySymbol}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Total Price */}
                <div className="border-t pt-3 mb-4">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-primary">ราคารวม</span>
                        <span className="font-bold text-lg text-primary">{job.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} {profile?.currencySymbol}</span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center">
                    <button
                        onClick={() => onQrCodeClick(job.id)}
                        className="bg-primary-lifgt text-primary border py-2 px-4 rounded-lg font-semibold text-sm hover:bg-slate-600 transition-colors"
                    >
                        QR Code
                    </button>
                    <div className="flex space-x-2">
                        {job.status === 'awaiting_confirmation' && (
                            <button
                                onClick={() => onConfirmClick(job)}
                                disabled={isConfirming}
                                className=" bg-primary-dark text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-green-600 transition-colors disabled:bg-gray-400"
                            >
                                {isConfirming ? '...' : 'ยืนยัน'}
                            </button>
                        )}
                        {job.status === 'confirmed' && (
                            <div className="text-center text-green-600 font-semibold text-sm py-2">
                                กรุณามาก่อน 10 นาที
                            </div>
                        )}
                        {job.status !== 'in_progress' && job.status !== 'confirmed' && (
                            <button
                                onClick={() => onCancelClick(job)}
                                className="bg-error text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-red-200 transition-colors"
                            >
                                ยกเลิก
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppointmentCard;
