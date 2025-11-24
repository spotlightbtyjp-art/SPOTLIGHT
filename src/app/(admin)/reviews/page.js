"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

// --- Icons ---
const Icons = {
    Star: ({ filled }) => (
        <svg className={`w-5 h-5 ${filled ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.363 2.44a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.362-2.44a1 1 0 00-1.176 0l-3.362-2.44c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.39c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69L9.049 2.927z" />
        </svg>
    ),
    Search: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Filter: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
};

// --- Components ---
const StarRating = ({ rating }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => <Icons.Star key={star} filled={rating >= star} />)}
    </div>
);

const ReviewSummary = ({ reviews }) => {
    const total = reviews.length;
    const average = total > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1) : 0;

    const distribution = [5, 4, 3, 2, 1].map(star => {
        const count = reviews.filter(r => r.rating === star).length;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        return { star, count, percentage };
    });

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">ภาพรวมความพึงพอใจ</h2>
            <div className="flex flex-col md:flex-row gap-8 items-center">
                {/* Average Score */}
                <div className="flex flex-col items-center justify-center min-w-[150px]">
                    <div className="text-5xl font-bold text-gray-900">{average}</div>
                    <div className="flex my-2"><StarRating rating={Math.round(average)} /></div>
                    <div className="text-sm text-gray-500">จากทั้งหมด {total} รีวิว</div>
                </div>

                {/* Distribution Bars */}
                <div className="flex-1 w-full space-y-2">
                    {distribution.map((item) => (
                        <div key={item.star} className="flex items-center gap-3 text-sm">
                            <div className="w-8 font-medium text-gray-600 flex items-center gap-1">{item.star} <span className="text-yellow-400">★</span></div>
                            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                            </div>
                            <div className="w-10 text-right text-gray-400">{item.count}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function AdminReviewsPage() {
    const [allReviews, setAllReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ratingFilter, setRatingFilter] = useState('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
                const reviewsSnapshot = await getDocs(reviewsQuery);

                const reviewsData = await Promise.all(reviewsSnapshot.docs.map(async (reviewDoc) => {
                    const review = { id: reviewDoc.id, ...reviewDoc.data() };

                    // Fetch appointment details
                    if (review.appointmentId) {
                        try {
                            const appointmentRef = doc(db, 'appointments', review.appointmentId);
                            const appointmentSnap = await getDoc(appointmentRef);
                            if (appointmentSnap.exists()) {
                                review.appointmentInfo = appointmentSnap.data();
                            }
                        } catch (e) { console.error("Error fetching appointment", e); }
                    }

                    // Fetch technician details
                    if (review.technicianId) {
                        try {
                            const technicianRef = doc(db, 'technicians', review.technicianId);
                            const techniciansnap = await getDoc(technicianRef);
                            if (techniciansnap.exists()) {
                                review.technicianInfo = techniciansnap.data();
                            }
                        } catch (e) { console.error("Error fetching technician", e); }
                    }
                    return review;
                }));

                setAllReviews(reviewsData);
            } catch (err) {
                console.error("Error fetching reviews: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, []);

    useEffect(() => {
        let result = allReviews;

        // Filter by Rating
        if (ratingFilter !== 'all') {
            result = result.filter(r => r.rating === Number(ratingFilter));
        }

        // Filter by Search
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(r =>
                (r.customerName || '').toLowerCase().includes(q) ||
                (r.comment || '').toLowerCase().includes(q) ||
                (r.appointmentInfo?.serviceInfo?.name || '').toLowerCase().includes(q)
            );
        }

        setFilteredReviews(result);
    }, [ratingFilter, search, allReviews]);

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10 font-sans text-gray-800">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">รีวิวจากลูกค้า</h1>
                        <p className="text-gray-500 mt-1">ความคิดเห็นและคะแนนความพึงพอใจ</p>
                    </div>
                </div>

                {/* Summary Section */}
                <ReviewSummary reviews={allReviews} />

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                        <input
                            type="text"
                            placeholder="ค้นหารีวิว, ชื่อลูกค้า, บริการ..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-200 focus:border-gray-400 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
                        <button onClick={() => setRatingFilter('all')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${ratingFilter === 'all' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>ทั้งหมด</button>
                        {[5, 4, 3, 2, 1].map(star => (
                            <button
                                key={star}
                                onClick={() => setRatingFilter(star)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1 ${ratingFilter === star ? 'bg-yellow-50 text-yellow-700 border border-yellow-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                {star} <span className="text-yellow-400">★</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reviews Grid */}
                {filteredReviews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredReviews.map(review => (
                            <div key={review.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition-all duration-200">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                                            {review.customerName ? review.customerName.charAt(0).toUpperCase() : <Icons.User />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{review.customerName || 'ไม่ระบุชื่อ'}</p>
                                            <p className="text-xs text-gray-400">
                                                {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                                        <StarRating rating={review.rating} />
                                    </div>
                                </div>

                                <div className="flex-grow mb-4">
                                    <p className="text-gray-700 text-sm leading-relaxed">"{review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}"</p>
                                </div>

                                <div className="border-t border-gray-50 pt-4 mt-auto space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">บริการ:</span>
                                        <span className="font-medium text-gray-900 truncate max-w-[150px]">{review.appointmentInfo?.serviceInfo?.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">ช่างผู้ให้บริการ:</span>
                                        <span className="font-medium text-gray-900">{review.technicianInfo ? `${review.technicianInfo.firstName} ${review.technicianInfo.lastName}` : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <Icons.Filter />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">ไม่พบรีวิว</h3>
                        <p className="text-gray-500 mt-1">ลองปรับตัวกรองหรือคำค้นหาของคุณ</p>
                    </div>
                )}
            </div>
        </div>
    );
}
