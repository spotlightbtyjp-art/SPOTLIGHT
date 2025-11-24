"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { updateAppointmentStatusByAdmin, confirmAppointmentAndPaymentByAdmin, sendInvoiceToCustomer } from '@/app/actions/appointmentActions';
import { ConfirmationModal } from '@/app/components/common/NotificationComponent';
import { useToast } from '@/app/components/Toast';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Calendar: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  CreditCard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Clock: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Location: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Chat: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>,
};

// --- Modal Components ---
function EditPaymentModal({ open, onClose, onSave, defaultAmount, defaultMethod, currencySymbol }) {
  const [amount, setAmount] = useState(defaultAmount || '');
  const [method, setMethod] = useState(defaultMethod || 'เงินสด');
  const [saving, setSaving] = useState(false);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100">
        <h2 className="text-lg font-bold mb-4 text-gray-800">ยืนยันการชำระเงิน</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">ยอดชำระ ({currencySymbol})</label>
          <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">ช่องทางชำระ</label>
          <select className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="เงินสด">เงินสด</option>
            <option value="โอนเงิน">โอนเงิน</option>
            <option value="บัตรเครดิต">บัตรเครดิต</option>
            <option value="PromptPay">PromptPay</option>
            <option value="อื่นๆ">อื่นๆ</option>
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm">ยกเลิก</button>
          <button onClick={async () => { setSaving(true); await onSave(amount, method); setSaving(false); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
        </div>
      </div>
    </div>
  );
}

function CompletionNoteModal({ open, onClose, onSave, customerName, serviceInfo }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const loadServiceNote = () => {
    const serviceNote = serviceInfo?.completionNote || serviceInfo?.note || '';
    if (serviceNote) setNote(serviceNote);
    else alert('ไม่มีข้อความที่กำหนดไว้ในบริการนี้');
  };

  const hasServiceNote = !!(serviceInfo?.completionNote && serviceInfo.completionNote.trim());

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md transform transition-all scale-100">
        <h2 className="text-lg font-bold mb-2 text-gray-800">ข้อความถึงลูกค้า</h2>
        <p className="text-sm text-gray-500 mb-4">ส่งข้อความขอบคุณหรือคำแนะนำให้ลูกค้า {customerName}</p>

        {hasServiceNote && (
          <div className="mb-3">
            <button onClick={loadServiceNote} type="button" className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
              <Icons.Chat /> ใช้ข้อความจากบริการ
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">ข้อความ (ไม่บังคับ)</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3 py-2 h-24 resize-none focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            placeholder="เช่น ขอบคุณที่ใช้บริการ หวังว่าจะได้เจอกันอีกครั้ง..."
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
          />
          <div className="text-xs text-gray-400 mt-1 text-right">{note.length}/200</div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm">ยกเลิก</button>
          <button onClick={async () => { setSaving(true); await onSave(note.trim()); setSaving(false); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50">{saving ? 'กำลังส่ง...' : 'ส่งข้อความ'}</button>
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---
const InfoRow = ({ label, value, icon: Icon, className = "" }) => (
  <div className={`flex justify-between items-start py-2 ${className}`}>
    <div className="flex items-center gap-2 text-gray-500 text-sm">
      {Icon && <Icon />}
      <span>{label}</span>
    </div>
    <span className="font-medium text-gray-900 text-sm text-right max-w-[60%] break-words">{value || '-'}</span>
  </div>
);

const StatusBadge = ({ status }) => {
  const config = {
    awaiting_confirmation: { label: 'รอยืนยัน', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    confirmed: { label: 'ยืนยันแล้ว', bg: 'bg-blue-100', text: 'text-blue-800' },
    in_progress: { label: 'กำลังใช้บริการ', bg: 'bg-purple-100', text: 'text-purple-800' },
    completed: { label: 'เสร็จสิ้น', bg: 'bg-green-100', text: 'text-green-800' },
    cancelled: { label: 'ยกเลิก', bg: 'bg-red-100', text: 'text-red-800' },
  }[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };

  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

const STATUS_OPTIONS = [
  { value: 'awaiting_confirmation', label: 'รอยืนยัน' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'in_progress', label: 'กำลังใช้บริการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
  { value: 'cancelled', label: 'ยกเลิก' },
];

const formatPrice = (v) => {
  if (v === null || v === undefined) return '-';
  return Number(v).toLocaleString();
};

const safeDate = (d) => {
  if (!d) return null;
  if (d?.toDate) return d.toDate();
  if (typeof d === 'string' || typeof d === 'number') return new Date(d);
  return null;
};

// --- Main Component ---
export default function AdminAppointmentDetail() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [appointment, setAppointment] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompletionNote, setShowCompletionNote] = useState(false);
  const [statusChangeInfo, setStatusChangeInfo] = useState(null);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const { showToast } = useToast();
  const { profile, loading: profileLoading } = useProfile();

  // ... (Keep all logic functions exactly as they were) ...
  const handleSavePayment = async (amount, method) => {
    if (!appointment?.id) return;
    try {
      const result = await confirmAppointmentAndPaymentByAdmin(appointment.id, 'admin', { amount: Number(amount), method });
      if (result.success) {
        showToast('อัพเดตข้อมูลการชำระเงินสำเร็จ', 'success');
        setAppointment(prev => ({
          ...prev,
          status: 'confirmed',
          paymentInfo: { ...prev.paymentInfo, amountPaid: Number(amount), paymentMethod: method, paymentStatus: 'paid', paidAt: new Date() },
        }));
        setShowEditPayment(false);
      } else {
        showToast(`เกิดข้อผิดพลาด: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    }
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === appointment.status) return;
    if (newStatus === 'completed') { setShowCompletionNote(true); return; }
    const statusLabel = STATUS_OPTIONS.find(opt => opt.value === newStatus)?.label || newStatus;
    setStatusChangeInfo({ newStatus, statusLabel });
  };

  const handleCompletionWithNote = async (note) => {
    setUpdating(true);
    try {
      const result = await updateAppointmentStatusByAdmin(appointment.id, 'completed', note);
      if (result.success) {
        showToast('อัพเดทสถานะสำเร็จ', 'success');
        setAppointment(prev => ({ ...prev, status: 'completed', updatedAt: new Date(), completionNote: note }));
      } else {
        showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`ไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
      setShowCompletionNote(false);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusChangeInfo) return;
    const { newStatus } = statusChangeInfo;
    setUpdating(true);
    try {
      const result = await updateAppointmentStatusByAdmin(appointment.id, newStatus);
      if (result.success) {
        showToast('อัพเดทสถานะสำเร็จ', 'success');
        setAppointment(prev => ({ ...prev, status: newStatus, updatedAt: new Date() }));
      } else {
        showToast(`ไม่สำเร็จ: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`ไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      setUpdating(false);
      setStatusChangeInfo(null);
    }
  };

  const handleDelete = async () => {
    if (!appointment?.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'appointments', appointment.id));
      showToast('ลบการจองสำเร็จ', 'success');
      setDeleted(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      showToast('ลบไม่สำเร็จ', 'error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!appointment?.id) return;
    setIsSendingInvoice(true);
    try {
      const result = await sendInvoiceToCustomer(appointment.id);
      if (result.success) {
        showToast('ส่งลิงก์ชำระเงินแล้ว', 'success');
        setAppointment(prev => ({ ...prev, paymentInfo: { ...prev.paymentInfo, paymentStatus: 'invoiced' } }));
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      showToast(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  useEffect(() => {
    if (!id || deleted) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'appointments', id), async (snap) => {
      if (!snap.exists()) {
        showToast('ไม่พบข้อมูล', 'error');
        setAppointment(null);
        setLoading(false);
        return;
      }
      const rawData = snap.data();
      const dataWithDates = {
        ...rawData,
        createdAt: safeDate(rawData.createdAt),
        updatedAt: safeDate(rawData.updatedAt),
      };
      setAppointment({ id: snap.id, ...dataWithDates });
      if (rawData.serviceId) {
        try {
          const sSnap = await getDoc(doc(db, 'services', rawData.serviceId));
          if (sSnap.exists()) setServiceDetails(sSnap.data());
        } catch (e) { console.error(e); }
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id, router, deleted]);

  if (deleted) return <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-500">กำลังกลับสู่หน้าหลัก...</div>;
  if (loading || profileLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;
  if (!appointment) return <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-500">ไม่พบข้อมูลการนัดหมาย</div>;

  const dateTime = safeDate(appointment.appointmentInfo?.dateTime || appointment.dateTime || appointment.date);

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
      <ConfirmationModal
        show={showDeleteConfirm}
        title="ยืนยันการลบ"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบการจองนี้?"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isProcessing={deleting}
      />
      <ConfirmationModal
        show={!!statusChangeInfo}
        title="ยืนยันการเปลี่ยนสถานะ"
        message={`เปลี่ยนสถานะเป็น "${statusChangeInfo?.statusLabel}"?`}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusChangeInfo(null)}
        isProcessing={updating}
      />
      <CompletionNoteModal
        open={showCompletionNote}
        onClose={() => setShowCompletionNote(false)}
        onSave={handleCompletionWithNote}
        customerName={appointment.customerInfo?.fullName || appointment.customerInfo?.name || 'ลูกค้า'}
        serviceInfo={serviceDetails || appointment.serviceInfo}
      />
      <EditPaymentModal
        open={showEditPayment}
        onClose={() => setShowEditPayment(false)}
        onSave={handleSavePayment}
        defaultAmount={appointment.paymentInfo?.totalPrice}
        defaultMethod={appointment.paymentInfo?.paymentMethod || 'เงินสด'}
        currencySymbol={profile.currencySymbol}
      />

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">นัดหมาย #{appointment.id.substring(0, 6).toUpperCase()}</h1>
                <StatusBadge status={appointment.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">สร้างเมื่อ {appointment.createdAt ? format(appointment.createdAt, 'd MMM yyyy, HH:mm', { locale: th }) : '-'}</p>
            </div>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium shadow-sm">
            <Icons.Trash /> ลบการจอง
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Customer & Service */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Icons.User /></div>
              <h2 className="text-lg font-bold text-gray-900">ข้อมูลลูกค้า</h2>
            </div>
            <div className="space-y-1">
              <InfoRow label="ชื่อลูกค้า" value={appointment.customerInfo?.fullName || appointment.customerInfo?.name} />
              <InfoRow label="เบอร์โทรศัพท์" value={appointment.customerInfo?.phone} />
              <InfoRow label="LINE Status" value={appointment.userId ? <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-0.5 rounded-md">Connected</span> : <span className="text-gray-400 text-xs">Not Connected</span>} />
              <InfoRow label="หมายเหตุ" value={appointment.customerInfo?.note || appointment.note} />
              {appointment.completionNote && (
                <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-800">
                  <span className="font-semibold block mb-1 text-xs uppercase tracking-wide text-green-600">ข้อความถึงลูกค้า:</span>
                  {appointment.completionNote}
                </div>
              )}
            </div>

            {/* Status Actions */}
            <div className="mt-6 pt-6 border-t border-gray-50">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">เปลี่ยนสถานะ</p>
              <div className="flex flex-wrap gap-3">
                {appointment.status === 'awaiting_confirmation' && (
                  <button onClick={() => handleStatusChange('confirmed')} disabled={updating} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-sm transition-all transform hover:scale-[1.02] text-sm">
                    ยืนยันการจอง
                  </button>
                )}
                {appointment.status === 'confirmed' && (
                  <button onClick={() => handleStatusChange('in_progress')} disabled={updating} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-sm transition-all transform hover:scale-[1.02] text-sm">
                    เริ่มให้บริการ
                  </button>
                )}
                {appointment.status === 'in_progress' && (
                  <button onClick={() => handleStatusChange('completed')} disabled={updating} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-sm transition-all transform hover:scale-[1.02] text-sm">
                    บริการเสร็จสิ้น
                  </button>
                )}

                {/* Other Status Options */}
                <div className="flex gap-2">
                  {STATUS_OPTIONS.filter(opt => {
                    if (opt.value === appointment.status) return false;
                    if (['awaiting_confirmation', 'confirmed', 'in_progress'].includes(appointment.status) &&
                      ['confirmed', 'in_progress', 'completed'].includes(opt.value)) return false; // Hide primary next steps
                    return true;
                  }).map(opt => (
                    <button key={opt.value} onClick={() => handleStatusChange(opt.value)} disabled={updating} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-medium transition-colors">
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Service Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Icons.Calendar /></div>
              <h2 className="text-lg font-bold text-gray-900">รายละเอียดบริการ</h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-32 h-32 relative rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                {appointment.serviceInfo?.imageUrl ? (
                  <Image src={appointment.serviceInfo.imageUrl} alt="Service" fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-xs">No Image</div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{appointment.serviceInfo?.name || appointment.serviceName}</h3>

                {appointment.serviceInfo?.serviceType === 'multi-area' && (
                  <div className="bg-gray-50 p-3 rounded-xl mb-3">
                    {appointment.serviceInfo?.selectedArea && (
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <Icons.Location />
                        <span className="font-medium text-gray-900">{appointment.serviceInfo.selectedArea.name}</span>
                      </div>
                    )}
                    {appointment.serviceInfo?.selectedPackage && (
                      <div className="text-xs text-gray-500 pl-6">
                        {appointment.serviceInfo.selectedPackage.name} • {appointment.serviceInfo.selectedPackage.duration} นาที • {formatPrice(appointment.serviceInfo.selectedPackage.price)} {profile.currencySymbol}
                      </div>
                    )}
                  </div>
                )}

                {appointment.serviceInfo?.serviceType === 'option-based' && (
                  <div className="bg-gray-50 p-3 rounded-xl mb-3">
                    {appointment.serviceInfo?.selectedOptionName && (
                      <div className="text-sm mb-2">
                        <span className="font-medium text-gray-900">🏷️ {appointment.serviceInfo.selectedOptionName}</span>
                        {appointment.serviceInfo.selectedOptionPrice && (
                          <span className="text-gray-500 text-xs ml-2">(@ {formatPrice(appointment.serviceInfo.selectedOptionPrice)} {profile.currencySymbol}</span>
                        )}
                        {appointment.serviceInfo.selectedOptionDuration && (
                          <span className="text-gray-500 text-xs">, {appointment.serviceInfo.selectedOptionDuration} นาที)</span>
                        )}
                        {appointment.serviceInfo.selectedAreas?.length > 0 && (
                          <span className="text-gray-500 text-xs ml-2">x {appointment.serviceInfo.selectedAreas.length} จุด</span>
                        )}
                      </div>
                    )}
                    {appointment.serviceInfo?.selectedAreas?.length > 0 && (
                      <div className="text-xs text-gray-500 pl-6">
                        {appointment.serviceInfo.selectedAreas.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {appointment.serviceInfo?.serviceType === 'area-based-options' && appointment.serviceInfo?.selectedAreaOptions?.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded-xl mb-3 space-y-2">
                    {appointment.serviceInfo.selectedAreaOptions.map((opt, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-900">🔸 {opt.areaName} ({opt.optionName})</span>
                        <div className="text-gray-500 text-xs flex items-center gap-2">
                          {opt.duration && <span>{opt.duration} นาที</span>}
                          {opt.price && opt.duration && <span>•</span>}
                          {opt.price && <span>{formatPrice(opt.price)} {profile.currencySymbol}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <InfoRow label="วันที่ & เวลา" value={dateTime ? format(dateTime, 'd MMM yyyy, HH:mm น.', { locale: th }) : '-'} icon={Icons.Clock} />
                <InfoRow label="ระยะเวลา" value={`${appointment.appointmentInfo?.duration || appointment.serviceInfo?.duration || 0} นาที`} />
                <InfoRow label="พนักงาน" value={appointment.appointmentInfo?.technicianName || appointment.technicianInfo?.firstName || '-'} />
                <InfoRow label="คิวที่" value={appointment.queue || appointment.queueNumber || '-'} />
              </div>
            </div>

            {/* Add-ons */}
            {((appointment.appointmentInfo?.addOns?.length) || (appointment.addOns?.length)) > 0 && (
              <div className="mt-6 bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span> บริการเสริม</h4>
                <ul className="space-y-2">
                  {(appointment.appointmentInfo?.addOns || appointment.addOns || []).map((a, idx) => (
                    <li key={idx} className="flex justify-between text-sm text-blue-900">
                      <span>{a.name || a.title}</span>
                      <span className="font-medium opacity-70">{formatPrice(a.price)} {profile.currencySymbol}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Payment */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-50">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Icons.CreditCard /></div>
              <h2 className="text-lg font-bold text-gray-900">การชำระเงิน</h2>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-gray-500">
                <span>ราคาบริการ</span>
                <span>{formatPrice(appointment.paymentInfo?.originalPrice || appointment.serviceInfo?.price)} {profile.currencySymbol}</span>
              </div>
              {(appointment.paymentInfo?.addOnsTotal > 0) && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>บริการเสริม</span>
                  <span>+{formatPrice(appointment.paymentInfo.addOnsTotal)} {profile.currencySymbol}</span>
                </div>
              )}
              {(appointment.paymentInfo?.discount > 0 || appointment.paymentInfo?.couponDiscount > 0) && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>ส่วนลด</span>
                  <span>-{formatPrice(appointment.paymentInfo.discount || appointment.paymentInfo.couponDiscount)} {profile.currencySymbol}</span>
                </div>
              )}
              <div className="border-t border-dashed border-gray-200 my-2"></div>
              <div className="flex justify-between items-end">
                <span className="font-bold text-gray-900">ยอดรวมสุทธิ</span>
                <span className="font-bold text-xl text-gray-900">{formatPrice(appointment.paymentInfo?.totalPrice)} <span className="text-sm font-normal text-gray-500">{profile.currencySymbol}</span></span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <InfoRow label="สถานะ" value={
                appointment.paymentInfo?.paymentStatus === 'paid' ? <span className="text-green-600 font-bold">ชำระแล้ว</span> :
                  appointment.paymentInfo?.paymentStatus === 'invoiced' ? <span className="text-blue-600 font-bold">ส่งใบแจ้งหนี้แล้ว</span> :
                    <span className="text-yellow-600 font-bold">รอชำระเงิน</span>
              } />
              <InfoRow label="ช่องทาง" value={appointment.paymentInfo?.paymentMethod} />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSendInvoice}
                disabled={isSendingInvoice || appointment.paymentInfo?.paymentStatus === 'paid'}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition-all disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                {isSendingInvoice ? 'กำลังส่ง...' : 'ส่งลิงก์ชำระเงิน'}
              </button>
              <button
                onClick={() => setShowEditPayment(true)}
                className="w-full py-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold transition-all text-sm"
              >
                บันทึกการชำระเงิน (Manual)
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
