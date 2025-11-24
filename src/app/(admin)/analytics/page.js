"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, subDays, differenceInDays, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { useProfile } from '@/context/ProfileProvider';

// --- Icons ---
const Icons = {
    TrendingUp: () => <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    TrendingDown: () => <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>,
    Calendar: () => <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
    Dollar: () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Users: () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    CheckCircle: () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    Star: () => <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
};

// --- Helper Components ---

const StatCard = ({ title, value, subtext, trend, icon: Icon, colorClass }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between transition-all hover:shadow-md">
        <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
            {subtext && (
                <div className="flex items-center mt-2 gap-2">
                    {trend !== undefined && (
                        <span className={`flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {trend >= 0 ? <Icons.TrendingUp /> : <Icons.TrendingDown />}
                            <span className="ml-1">{Math.abs(trend)}%</span>
                        </span>
                    )}
                    <p className="text-xs text-gray-400">{subtext}</p>
                </div>
            )}
        </div>
        <div className={`p-3 rounded-xl ${colorClass} shadow-sm`}>
            <Icon />
        </div>
    </div>
);

const ChartCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
        <div className="w-full h-[350px]">
            <ResponsiveContainer>
                {children}
            </ResponsiveContainer>
        </div>
    </div>
);

// --- Main Page ---

export default function AnalyticsPage() {
    const [appointments, setAppointments] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const { profile, loading: profileLoading } = useProfile();
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [appSnap, revSnap] = await Promise.all([
                    getDocs(query(collection(db, 'appointments'), orderBy('createdAt', 'desc'))),
                    getDocs(query(collection(db, 'reviews')))
                ]);

                setAppointments(appSnap.docs.map(d => ({ id: d.id, ...d.data() })));
                setReviews(revSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error("Error fetching data: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analytics = useMemo(() => {
        if (loading) return null;

        const daysDiff = differenceInDays(dateRange.end, dateRange.start) + 1;
        const prevStart = subDays(dateRange.start, daysDiff);
        const prevEnd = subDays(dateRange.end, daysDiff);

        // Helper to filter by date range
        const filterByDate = (data, start, end) => data.filter(item => {
            const d = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
            return d >= start && d <= end;
        });

        const currentApps = filterByDate(appointments, dateRange.start, dateRange.end);
        const prevApps = filterByDate(appointments, prevStart, prevEnd);

        // Metrics Calculation
        const calcRevenue = (apps) => apps
            .filter(a => a.status === 'completed' && a.paymentInfo?.paymentStatus === 'paid')
            .reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || 0), 0);

        const currentRevenue = calcRevenue(currentApps);
        const prevRevenue = calcRevenue(prevApps);
        const revenueGrowth = prevRevenue ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

        const currentCompleted = currentApps.filter(a => a.status === 'completed').length;
        const prevCompleted = prevApps.filter(a => a.status === 'completed').length;
        const completedGrowth = prevCompleted ? ((currentCompleted - prevCompleted) / prevCompleted) * 100 : 0;

        // Charts Data
        const dailyData = eachDayOfInterval({ start: dateRange.start, end: dateRange.end }).map(day => {
            const dayApps = currentApps.filter(a => isSameDay(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt), day));
            const revenue = dayApps
                .filter(a => a.status === 'completed' && a.paymentInfo?.paymentStatus === 'paid')
                .reduce((sum, a) => sum + (Number(a.paymentInfo?.totalPrice) || 0), 0);

            return {
                date: format(day, 'dd/MM'),
                fullDate: format(day, 'dd MMM yyyy', { locale: th }),
                revenue,
                completed: dayApps.filter(a => a.status === 'completed').length,
                cancelled: dayApps.filter(a => a.status === 'cancelled').length,
            };
        });

        // Top Services
        const serviceStats = {};
        currentApps.filter(a => a.status === 'completed').forEach(a => {
            const name = a.serviceInfo?.name || a.serviceName || 'Unknown';
            if (!serviceStats[name]) serviceStats[name] = { count: 0, revenue: 0 };
            serviceStats[name].count++;
            serviceStats[name].revenue += (Number(a.paymentInfo?.totalPrice) || 0);
        });

        const topServices = Object.entries(serviceStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Top Technicians
        const techStats = {};
        currentApps.filter(a => a.status === 'completed' && a.technicianId).forEach(a => {
            const name = a.technicianInfo?.firstName ? `${a.technicianInfo.firstName} ${a.technicianInfo.lastName || ''}` : 'Unknown';
            if (!techStats[name]) techStats[name] = 0;
            techStats[name]++;
        });
        const topTechnicians = Object.entries(techStats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Average Rating
        const currentReviews = filterByDate(reviews, dateRange.start, dateRange.end);
        const avgRating = currentReviews.length
            ? (currentReviews.reduce((sum, r) => sum + r.rating, 0) / currentReviews.length).toFixed(1)
            : 0;

        return {
            totalRevenue: currentRevenue,
            revenueGrowth: Math.round(revenueGrowth),
            totalAppointments: currentApps.length,
            completedAppointments: currentCompleted,
            completedGrowth: Math.round(completedGrowth),
            avgRating,
            reviewCount: currentReviews.length,
            dailyData,
            topServices,
            topTechnicians,
            serviceStats
        };
    }, [loading, appointments, reviews, dateRange]);

    const exportToCSV = () => {
        if (!analytics) return;
        const headers = ['Date', 'Service', 'Customer', 'Technician', 'Price', 'Status'];
        const rows = appointments
            .filter(a => {
                const d = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                return d >= dateRange.start && d <= dateRange.end;
            })
            .map(a => [
                format(a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt), 'yyyy-MM-dd HH:mm'),
                `"${a.serviceInfo?.name || a.serviceName || ''}"`,
                `"${a.customerInfo?.fullName || a.customerInfo?.name || ''}"`,
                `"${a.technicianInfo?.firstName || ''} ${a.technicianInfo?.lastName || ''}"`,
                a.paymentInfo?.totalPrice || 0,
                a.status
            ].join(','));

        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `analytics_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    };

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        if (value) setDateRange(prev => ({ ...prev, [name]: parseISO(value) }));
    };

    if (loading || profileLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;
    if (!analytics) return <div className="text-center mt-20">ไม่มีข้อมูล</div>;

    const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">ภาพรวมธุรกิจ</h1>
                        <p className="text-gray-500 mt-1">วิเคราะห์ประสิทธิภาพและแนวโน้มของร้าน</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 px-2">
                            <Icons.Calendar />
                            <input type="date" name="start" value={format(dateRange.start, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none" />
                            <span className="text-gray-400">-</span>
                            <input type="date" name="end" value={format(dateRange.end, 'yyyy-MM-dd')} onChange={handleDateChange} className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent outline-none" />
                        </div>
                        <div className="h-6 w-px bg-gray-200 mx-1"></div>
                        <button onClick={exportToCSV} className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-medium transition-all">
                            <Icons.Download /> Export CSV
                        </button>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        title="รายได้รวม"
                        value={`${analytics.totalRevenue.toLocaleString()} ${profile.currencySymbol}`}
                        trend={analytics.revenueGrowth}
                        subtext="เทียบกับช่วงก่อนหน้า"
                        icon={Icons.Dollar}
                        colorClass="bg-blue-500 text-white"
                    />
                    <StatCard
                        title="งานที่สำเร็จ"
                        value={analytics.completedAppointments}
                        trend={analytics.completedGrowth}
                        subtext="งานที่ให้บริการเสร็จสิ้น"
                        icon={Icons.CheckCircle}
                        colorClass="bg-green-500 text-white"
                    />
                    <StatCard
                        title="ลูกค้าทั้งหมด"
                        value={analytics.totalAppointments}
                        subtext="รวมทุกสถานะการจอง"
                        icon={Icons.Users}
                        colorClass="bg-purple-500 text-white"
                    />
                    <StatCard
                        title="ความพึงพอใจ"
                        value={analytics.avgRating}
                        subtext={`จาก ${analytics.reviewCount} รีวิว`}
                        icon={Icons.Star}
                        colorClass="bg-yellow-400 text-white"
                    />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <ChartCard title="แนวโน้มรายได้ (Revenue Trend)">
                            <AreaChart data={analytics.dailyData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    formatter={(value) => [`${value.toLocaleString()} ${profile.currencySymbol}`, 'รายได้']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ChartCard>
                    </div>
                    <div>
                        <ChartCard title="สัดส่วนบริการ (Top Services)">
                            <PieChart>
                                <Pie
                                    data={analytics.topServices}
                                    dataKey="revenue"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                >
                                    {analytics.topServices.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ChartCard>
                    </div>
                </div>

                {/* Detailed Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Technicians */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">ช่างยอดนิยม (Top Technicians)</h3>
                        <div className="space-y-4">
                            {analytics.topTechnicians.map((tech, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium text-gray-700">{tech.name}</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{tech.count} งาน</span>
                                </div>
                            ))}
                            {analytics.topTechnicians.length === 0 && <p className="text-gray-400 text-center py-4">ไม่มีข้อมูลช่าง</p>}
                        </div>
                    </div>

                    {/* Service Performance Table */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">ประสิทธิภาพบริการ</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">บริการ</th>
                                        <th className="px-4 py-3 text-center">จำนวน</th>
                                        <th className="px-4 py-3 text-right rounded-r-lg">รายได้</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {analytics.topServices.map((service, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-800">{service.name}</td>
                                            <td className="px-4 py-3 text-center text-gray-600">{service.count}</td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-600">{service.revenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
