"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/app/components/Toast";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";

// --- Icons ---
const Icons = {
  Menu: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>,
  ChevronDown: ({ className }) => <svg className={`w-4 h-4 transition-transform ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>,
  Bell: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Empty: () => <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Check: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>,
  Trash: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

// --- Custom Hook ---
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

const navLinks = [
  { name: "ปฏิทิน", href: "/calendar" },
  { name: "แดชบอร์ด", href: "/dashboard" },
  {
    name: "ข้อมูลหลัก",
    items: [
      { name: "สร้างการนัดหมาย", href: "/create-appointment" },
      { name: "บริการ", href: "/services" },
      { name: "ช่าง", href: "/technicians" },
      { name: "ลูกค้า", href: "/customers" },
    ]
  },
  {
    name: "วิเคราะห์/รีวิว",
    items: [
      { name: "ของรางวัล", href: "/manage-rewards" },
      { name: "วิเคราะห์", href: "/analytics" },
      { name: "รีวิวลูกค้า", href: "/reviews" },
    ]
  },
  {
    name: "ตั้งค่า",
    items: [
      { name: "จัดการผู้ดูแลระบบ", href: "/admins" },
      { name: "จัดการพนักงาน", href: "/employees" },
      { name: "ตั้งค่าทั่วไป", href: "/settings" },
    ]
  },
];

const NavLink = ({ link, currentPath, onClick = () => { } }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useClickOutside(dropdownRef, () => setIsOpen(false));

  const isActive = link.items ? link.items.some(item => currentPath.startsWith(item.href)) : currentPath === link.href;

  if (link.items) {
    return (
      <div className="relative group" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-all duration-200 ${isActive
            ? "bg-yellow-50 text-yellow-900 shadow-sm ring-1 ring-yellow-100"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
        >
          {link.name}
          <Icons.ChevronDown className={isOpen ? 'rotate-180' : ''} />
        </button>

        {/* Dropdown Menu */}
        <div className={`absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden transition-all duration-200 origin-top-left z-50 ${isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
          <div className="py-1">
            {link.items.map(item => {
              const isItemActive = currentPath === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => { setIsOpen(false); onClick(); }}
                  className={`block px-4 py-2.5 text-sm transition-colors ${isItemActive
                    ? 'bg-yellow-50 text-yellow-900 font-medium border-l-4 border-yellow-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                    }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={link.href}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
        ? "bg-yellow-900 text-white shadow-md shadow"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }`}
    >
      {link.name}
    </Link>
  )
}

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifPopoverRef = useRef(null);
  const autoCloseTimeoutRef = useRef(null);
  const { toasts = [], markAsRead, markAllAsRead, removeToast, clearAllToasts, hasUnread } = useToast();

  useClickOutside(notifPopoverRef, () => setIsNotifOpen(false));

  // Auto-open notifications logic
  const prevToastsLengthRef = useRef(toasts.length);
  useEffect(() => {
    if (toasts.length > prevToastsLengthRef.current && toasts.length > 0) {
      setIsNotifOpen(true);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = setTimeout(() => setIsNotifOpen(false), 3000);
    }
    prevToastsLengthRef.current = toasts.length;
  }, [toasts.length]);

  useEffect(() => () => autoCloseTimeoutRef.current && clearTimeout(autoCloseTimeoutRef.current), []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const toggleNotifPopover = () => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }
    const newIsOpen = !isNotifOpen;
    setIsNotifOpen(newIsOpen);
    if (newIsOpen) markAllAsRead();
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between h-16 items-center">

          {/* --- Left Side: Logo & Mobile Menu --- */}
          <div className="flex items-center gap-4  ">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">
              <Icons.Menu />
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <span className="px-4 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-900 to-yellow-800">
                Dashboard
              </span>
            </Link>
          </div>

          {/* --- Center: Desktop Navigation --- */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink key={link.name} link={link} currentPath={pathname} />
            ))}
          </div>

          {/* --- Right Side: Notifications & Profile --- */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative" ref={notifPopoverRef}>
              <button
                onClick={toggleNotifPopover}
                className={`p-2.5 rounded-xl transition-all duration-200 relative ${hasUnread ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
              >
                <Icons.Bell />
                {hasUnread && (
                  <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              {/* Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <h3 className="font-bold text-gray-900">การแจ้งเตือน</h3>
                    <div className="flex gap-1">
                      {hasUnread && (
                        <button onClick={markAllAsRead} className="p-1.5 text-yellow-900 hover:bg-yellow-50 rounded-lg text-xs font-medium transition-colors" title="อ่านทั้งหมด">
                          <Icons.Check />
                        </button>
                      )}
                      <button onClick={clearAllToasts} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors" title="ลบทั้งหมด">
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {toasts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Icons.Empty />
                        <p className="mt-2 text-sm">ไม่มีการแจ้งเตือนใหม่</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {toasts.slice(-5).reverse().map(toast => (
                          <div key={toast.id} className={`p-4 hover:bg-gray-50 transition-colors relative group ${!toast.read ? 'bg-yellow-50/30' : ''}`}>
                            <div className="flex gap-3">
                              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${toast.type === 'error' ? 'bg-red-500' :
                                toast.type === 'success' ? 'bg-green-500' :
                                  toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                                }`}></div>
                              <div className="flex-1">
                                <p className={`text-sm leading-snug ${!toast.read ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                  {toast.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {toast.timestamp?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <button onClick={() => removeToast(toast.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all">
                                <Icons.Trash />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <Icons.Logout />
              <span>ออก</span>
            </button>
          </div>
        </div>

        {/* --- Mobile Menu --- */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 py-2 space-y-1 animate-in slide-in-from-top-5">
            {navLinks.map((link) => (
              <div key={link.name} className="px-2">
                {link.items ? (
                  <div className="space-y-1">
                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{link.name}</div>
                    {link.items.map(item => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-lg text-sm font-medium ${pathname === item.href ? 'bg-yellow-50 text-yellow-900' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium ${pathname === link.href ? 'bg-yellow-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {link.name}
                  </Link>
                )}
              </div>
            ))}
            <div className="border-t border-gray-100 mt-2 pt-2 px-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
              >
                <Icons.Logout /> ออกจากระบบ
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
