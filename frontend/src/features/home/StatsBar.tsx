import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getStats } from '../../services/api/cms.api';
function Counter({
  end,
  suffix = '',
  duration = 2000




}: {end: number;suffix?: string;duration?: number;}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    margin: '-50px'
  });
  useEffect(() => {
    if (isInView) {
      let startTime: number | null = null;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        // Ease out quad
        const easeProgress = progress * (2 - progress);
        setCount(Math.floor(easeProgress * end));
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }, [isInView, end, duration]);
  return (
    <span
      ref={ref}
      className="font-montserrat font-extrabold text-4xl md:text-5xl text-white">
      
      {count}
      {suffix}
    </span>);

}
export function StatsBar() {
  const { data: stats, isLoading } = useCmsQuery('stats', getStats);
  if (isLoading || !stats) {
    return (
      <section className="py-16 bg-globus-blue-dark relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[...Array(4)].map((_, i) =>
            <div key={i} className="flex flex-col items-center animate-pulse">
                <div className="h-12 w-24 bg-white/20 rounded mb-3"></div>
                <div className="h-1 w-12 bg-globus-orange/50 my-3 rounded-full"></div>
                <div className="h-4 w-32 bg-white/20 rounded"></div>
              </div>
            )}
          </div>
        </div>
      </section>);

  }
  return (
    <section className="py-16 bg-globus-blue-dark relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full border-[20px] border-white"></div>
        <div className="absolute top-1/2 right-10 w-64 h-64 rounded-full border-[15px] border-globus-orange"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) =>
          <motion.div
            key={index}
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
            transition={{
              duration: 0.5,
              delay: index * 0.1
            }}
            className="flex flex-col items-center">
            
              <Counter end={stat.value} suffix={stat.suffix} />
              <div className="h-1 w-12 bg-globus-orange my-3 rounded-full"></div>
              <span className="font-opensans font-semibold text-seconda-blue uppercase tracking-wide text-sm">
                {stat.label}
              </span>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}