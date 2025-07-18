import React from 'react';

// Universal skeleton loading component
export function UniversalSkeleton() {
  return (
    <div className="relative h-full font-['Poppins'] max-w-[800px] mx-auto px-4 py-4">
      {/* Simple wide gray boxes */}
      <div className="space-y-3">
        <div className="h-12 w-full rounded animate-pulse bg-gray-300"></div>
        <div className="h-8 w-3/4 rounded animate-pulse bg-gray-400"></div>
        <div className="h-6 w-1/2 rounded animate-pulse bg-gray-300"></div>
        <div className="h-10 w-full rounded animate-pulse bg-gray-300"></div>
        <div className="h-6 w-2/3 rounded animate-pulse bg-gray-400"></div>
      </div>
    </div>
  );
}