"use client";

import { useEffect, useState } from "react";
import { db } from "@/app/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/Toast";
import { ConfirmationModal } from "@/app/components/common/NotificationComponent";
import { addCustomer, deleteCustomer } from "@/app/actions/customerActions";

// --- Icons ---
const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Phone: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Mail: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Star: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Edit: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Grid: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  List: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Line: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 10.2c0-4.6-4.3-8.2-9.5-8.2S2.5 5.6 2.5 10.2c0 4.1 3.4 7.5 8 8.1.3 0 .7.1.8.3.1.2.1.5 0 .8-.1.4-.3 1.4-.3 1.7 0 .5.3.9.9.5l5.2-3.6c2.7-1.4 4.4-4.2 4.4-7.8zM12 14.6c-3.6 0-6.6-2.5-6.6-5.6 0-3.1 3-5.6 6.6-5.6 3.6 0 6.6 2.5 6.6 5.6 0 3.1-3 5.6-6.6 5.6z" /></svg>
};

// --- Add Customer Modal ---
function AddCustomerModal({ open, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', points: 0 });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md transform transition-all scale-100">
        <h2 className="text-xl font-bold mb-4 text-gray-900">เพิ่มลูกค้าใหม่</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
            <input name="fullName" value={formData.fullName} onChange={handleChange} required className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="ระบุชื่อลูกค้า" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
            <input name="phone" value={formData.phone} onChange={handleChange} required className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="08x-xxx-xxxx" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="example@mail.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนสะสมเริ่มต้น</label>
            <input type="number" name="points" value={formData.points} onChange={handleChange} className="w-full border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="0" />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-sm">ยกเลิก</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl font-medium transition-colors text-sm disabled:opacity-50 shadow-lg shadow-gray-200">
              {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Customer Card Component ---
const CustomerCard = ({ customer, onEdit, onDelete, onCopyLine }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-200 group relative">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg">
          {customer.fullName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-base line-clamp-1">{customer.fullName}</h3>
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
            <Icons.Phone />
            <span>{customer.phone || '-'}</span>
          </div>
        </div>
      </div>
      {customer.userId && (
        <button onClick={() => onCopyLine(customer.userId)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors" title="Copy LINE ID">
          <Icons.Line />
        </button>
      )}
    </div>

    <div className="space-y-2 mb-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Icons.Mail />
        <span className="truncate">{customer.email || '-'}</span>
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg w-fit">
        <Icons.Star />
        <span>{customer.points || 0} คะแนน</span>
      </div>
    </div>

    <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-50">
      <button onClick={() => onEdit(customer.id)} className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
        <Icons.Edit /> แก้ไข
      </button>
      <button onClick={() => onDelete(customer)} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
        <Icons.Trash /> ลบ
      </button>
    </div>
  </div>
);

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const router = useRouter();
  const { showToast } = useToast();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      showToast("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleAddCustomer = async (data) => {
    setFormLoading(true);
    const result = await addCustomer(data);
    if (result.success) {
      showToast(result.message, 'success');
      setShowAddModal(false);
      fetchCustomers();
    } else {
      showToast(result.error, 'error');
    }
    setFormLoading(false);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    const result = await deleteCustomer(customerToDelete.id);
    if (result.success) {
      showToast(result.message, 'success');
      fetchCustomers();
    } else {
      showToast(result.error, 'error');
    }
    setIsDeleting(false);
    setCustomerToDelete(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('คัดลอก LINE User ID แล้ว!', 'success'));
  };

  const filtered = customers.filter(c => {
    const q = search.trim().toLowerCase();
    return !q || (c.fullName?.toLowerCase().includes(q)) || (c.phone?.includes(q)) || (c.email?.toLowerCase().includes(q));
  });

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
      <ConfirmationModal
        show={!!customerToDelete}
        title="ยืนยันการลบ"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้า "${customerToDelete?.fullName}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setCustomerToDelete(null)}
        isProcessing={isDeleting}
      />
      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddCustomer}
        loading={formLoading}
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ลูกค้าทั้งหมด</h1>
            <p className="text-gray-500 mt-1">จัดการข้อมูลลูกค้าและประวัติการใช้งาน</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-gray-200 transition-all transform hover:scale-[1.02]">
            <Icons.Plus /> เพิ่มลูกค้าใหม่
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
            <input
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์โทร, อีเมล..."
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
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><Icons.User /></div>
            <p className="text-gray-500 font-medium">ไม่พบข้อมูลลูกค้า</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filtered.map(customer => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={(id) => router.push(`/customers/edit/${id}`)}
                    onDelete={setCustomerToDelete}
                    onCopyLine={copyToClipboard}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="py-4 pl-6 font-medium">ชื่อลูกค้า</th>
                        <th className="py-4 font-medium">เบอร์โทร</th>
                        <th className="py-4 font-medium">อีเมล</th>
                        <th className="py-4 font-medium">คะแนน</th>
                        <th className="py-4 font-medium">LINE</th>
                        <th className="py-4 pr-6 text-right font-medium">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-600 divide-y divide-gray-50">
                      {filtered.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 pl-6 font-medium text-gray-900">{c.fullName}</td>
                          <td className="py-4">{c.phone || '-'}</td>
                          <td className="py-4">{c.email || '-'}</td>
                          <td className="py-4"><span className="text-purple-600 font-bold bg-purple-50 px-2 py-1 rounded-md">{c.points || 0}</span></td>
                          <td className="py-4">
                            {c.userId ? (
                              <button onClick={() => copyToClipboard(c.userId)} className="text-green-600 hover:text-green-700"><Icons.Line /></button>
                            ) : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="py-4 pr-6 text-right space-x-2">
                            <button onClick={() => router.push(`/customers/edit/${c.id}`)} className="text-blue-600 hover:text-blue-800 font-medium text-xs">แก้ไข</button>
                            <button onClick={() => setCustomerToDelete(c)} className="text-red-600 hover:text-red-800 font-medium text-xs">ลบ</button>
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
