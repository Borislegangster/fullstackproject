import React from 'react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getPartners } from '../../services/api/cms.api';
export function PartnersSection() {
  const { data: partners, isLoading } = useCmsQuery('partners', getPartners);
  if (isLoading || !partners) {
    return (
      <section className="py-12 bg-white border-y border-gray-100 overflow-hidden">
        <div className="container mx-auto px-4 mb-8 text-center">
          <div className="h-6 w-48 bg-gray-200 animate-pulse mx-auto rounded"></div>
        </div>
        <div className="h-10 w-full bg-gray-100 animate-pulse"></div>
      </section>);

  }
  return (
    <section className="py-12 bg-white border-y border-gray-100 overflow-hidden">
      <div className="container mx-auto px-4 mb-8 text-center">
        <h3 className="font-montserrat font-bold text-globus-gray uppercase tracking-widest text-sm">
          Ils nous font confiance
        </h3>
      </div>

      {/* Infinite Scroll Container */}
      <div className="relative w-full flex overflow-hidden">
        {/* Gradient masks for smooth fade on edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-white to-transparent z-10"></div>
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-white to-transparent z-10"></div>

        <div className="flex animate-scroll whitespace-nowrap items-center">
          {/* First set */}
          {partners.map((partner, index) =>
          <div
            key={`p1-${index}`}
            className="mx-12 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer">
            
              <span className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                {partner.name}
              </span>
            </div>
          )}
          {/* Duplicate set for seamless loop */}
          {partners.map((partner, index) =>
          <div
            key={`p2-${index}`}
            className="mx-12 flex items-center justify-center grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer">
            
              <span className="font-montserrat font-extrabold text-2xl text-globus-blue-dark">
                {partner.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>);

}