import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  AwardIcon,
  WrenchIcon,
  HardHatIcon } from
'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getGuarantees } from '../../services/api/cms.api';
import { getIcon } from '../../utils/iconRegistry';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export function GuaranteesSection() {
  const { data: guarantees, isLoading } = useCmsQuery(
    'guarantees',
    getGuarantees
  );
  if (isLoading || !guarantees) {
    return (
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <SkeletonGrid count={4} />
        </div>
      </section>);

  }
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2
            initial={{
              opacity: 0,
              y: 20
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark mb-4">
            
            Nos Garanties et Notre Sécurité
          </motion.h2>
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.8
            }}
            whileInView={{
              opacity: 1,
              scale: 1
            }}
            viewport={{
              once: true
            }}
            className="h-1 w-24 bg-globus-orange mx-auto rounded-full">
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {guarantees.map((item, index) =>
          <motion.div
            key={index}
            initial={{
              opacity: 0,
              y: 30
            }}
            whileInView={{
              opacity: 1,
              y: 0
            }}
            viewport={{
              once: true
            }}
            transition={{
              duration: 0.5,
              delay: index * 0.1
            }}
            className="bg-globus-light p-8 rounded-xl text-center hover:shadow-xl transition-shadow border border-gray-100 group">
            
              <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-md group-hover:scale-110 transition-transform duration-300">
                {getIcon(item.iconKey, 'w-12 h-12 text-globus-orange')}
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-4">
                {item.title}
              </h3>
              <p className="font-opensans text-globus-gray text-sm leading-relaxed">
                {item.desc}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}