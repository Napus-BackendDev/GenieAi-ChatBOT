import React from 'react';

// General Page Skeleton (for Dashboard Overview)
export const DashboardSkeleton = () => (
  <div className="p-6 md:p-8 w-full max-w-full flex flex-col gap-6 animate-pulse text-left">
    {/* Header */}
    <div className="flex flex-col gap-2">
      <div className="h-7 w-48 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
      <div className="h-4 w-72 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
    </div>
    
    {/* Stats Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-2xl p-6">
          <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded mb-4"></div>
          <div className="h-6 w-12 bg-slate-200 dark:bg-white/10 rounded"></div>
        </div>
      ))}
    </div>

    {/* Large Content Section */}
    <div className="h-80 bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 flex flex-col gap-4">
      <div className="h-5 w-40 bg-slate-200 dark:bg-white/10 rounded"></div>
      <div className="h-px bg-slate-100 dark:bg-white/5 w-full"></div>
      <div className="h-8 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
      <div className="h-8 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
      <div className="h-8 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
      <div className="h-8 bg-slate-100 dark:bg-white/5 rounded w-full"></div>
    </div>
  </div>
);

// Table Skeleton (for Services & Document Manager)
export const TableSkeleton = () => (
  <div className="p-6 md:p-8 w-full max-w-full flex flex-col gap-6 animate-pulse text-left">
    {/* Header */}
    <div className="flex flex-col gap-2 mb-2">
      <div className="h-7 w-32 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
      <div className="h-4 w-60 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
    </div>

    {/* Action Bar */}
    <div className="flex justify-between items-center h-12">
      <div className="h-10 w-48 bg-slate-200 dark:bg-white/10 rounded-xl"></div>
      <div className="h-10 w-28 bg-slate-200 dark:bg-white/10 rounded-xl"></div>
    </div>

    {/* Table rows */}
    <div className="bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-20"></div>
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-16"></div>
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-24"></div>
        <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-12 ml-auto"></div>
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="grid grid-cols-4 gap-4 py-1 items-center">
          <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-36"></div>
          <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-12"></div>
          <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-28"></div>
          <div className="h-6 bg-slate-100 dark:bg-white/5 rounded-lg w-16 ml-auto"></div>
        </div>
      ))}
    </div>
  </div>
);

// Grid Card Skeleton (for Staff Manager)
export const GridSkeleton = () => (
  <div className="p-6 md:p-8 w-full max-w-full flex flex-col gap-6 animate-pulse text-left">
    {/* Header */}
    <div className="flex flex-col gap-2 mb-2">
      <div className="h-7 w-40 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
      <div className="h-4 w-72 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
    </div>

    {/* Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-200 dark:bg-white/10 rounded-full"></div>
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-28 bg-slate-200 dark:bg-white/10 rounded"></div>
              <div className="h-3 w-16 bg-slate-200 dark:bg-white/5 rounded"></div>
            </div>
          </div>
          <div className="h-px bg-slate-100 dark:bg-white/5 w-full"></div>
          <div className="h-4 w-full bg-slate-100 dark:bg-white/5 rounded"></div>
          <div className="h-4 w-4/5 bg-slate-100 dark:bg-white/5 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

// Calendar Bookings Skeleton (for Bookings Manager)
export const BookingsSkeleton = () => (
  <div className="p-6 md:p-8 w-full max-w-full flex flex-col gap-6 animate-pulse text-left">
    {/* Header */}
    <div className="flex flex-col gap-2">
      <div className="h-7 w-32 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
      <div className="h-4 w-60 bg-slate-200 dark:bg-white/5 rounded-lg"></div>
    </div>

    {/* Split Panel */}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Calendar Area */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 flex flex-col gap-4 h-96">
        <div className="flex justify-between items-center">
          <div className="h-5 w-24 bg-slate-200 dark:bg-white/10 rounded"></div>
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
            <div className="h-8 w-8 bg-slate-200 dark:bg-white/10 rounded-lg"></div>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 mt-4 flex-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="h-8 bg-slate-100 dark:bg-white/5 rounded-lg"></div>
          ))}
        </div>
      </div>

      {/* List Area */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-900/60 border border-[#A2D9E8]/35 dark:border-white/5 rounded-3xl p-6 flex flex-col gap-4 h-96">
        <div className="h-5 w-32 bg-slate-200 dark:bg-white/10 rounded"></div>
        <div className="h-px bg-slate-100 dark:bg-white/5 w-full"></div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center py-1">
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-28 bg-slate-100 dark:bg-white/5 rounded"></div>
              <div className="h-3 w-16 bg-slate-100 dark:bg-white/5 rounded"></div>
            </div>
            <div className="h-6 w-16 bg-slate-100 dark:bg-white/5 rounded-full"></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
