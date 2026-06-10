import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  PencilRulerIcon,
  FileTextIcon,
  BrickWallIcon,
  PaintRollerIcon,
  KeyIcon,
  HardHatIcon,
  HammerIcon,
  WrenchIcon,
  RulerIcon,
  BuildingIcon,
  HomeIcon,
  CompassIcon,
  CogIcon,
  LayersIcon,
  ShieldCheckIcon,
  TruckIcon,
  WarehouseIcon,
  DraftingCompassIcon,
  ScanLineIcon,
  SquareIcon } from
'lucide-react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getMethodologySteps } from '../../services/api/cms.api';
import { getIcon } from '../../utils/iconRegistry';
import { SkeletonGrid } from '../../components/ui/Skeleton';
import type { MethodologyStep } from '../../types/cms.types';
function BackgroundIcons() {
  const iconComponents = [
  HardHatIcon,
  HammerIcon,
  WrenchIcon,
  RulerIcon,
  BuildingIcon,
  BrickWallIcon,
  PaintRollerIcon,
  KeyIcon,
  HomeIcon,
  CompassIcon,
  CogIcon,
  LayersIcon,
  ShieldCheckIcon,
  TruckIcon,
  WarehouseIcon,
  DraftingCompassIcon,
  ScanLineIcon,
  SquareIcon,
  PencilRulerIcon,
  FileTextIcon];

  const colors = ['text-globus-blue', 'text-globus-orange', 'text-seconda-blue'];
  const sizes = [12, 14, 16, 18, 20, 22, 24];
  // Simple seeded pseudo-random for deterministic layout
  function seededRandom(seed: number) {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
  const rand = seededRandom(42);
  const icons = Array.from(
    {
      length: 200
    },
    (_, i) => ({
      Icon: iconComponents[i % iconComponents.length],
      top: `${(rand() * 98 + 1).toFixed(1)}%`,
      left: `${(rand() * 96 + 2).toFixed(1)}%`,
      size: sizes[Math.floor(rand() * sizes.length)],
      rotate: Math.floor(rand() * 360 - 180),
      color: colors[Math.floor(rand() * colors.length)]
    })
  );
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true">
      
      {icons.map((item, idx) => {
        const { Icon, top, left, size, rotate, color } = item;
        return (
          <Icon
            key={idx}
            className={`absolute ${color} opacity-[0.10]`}
            style={{
              top,
              left,
              width: size,
              height: size,
              transform: `rotate(${rotate}deg)`
            }} />);


      })}
    </div>);

}
export function MethodologySection() {
  const { data: steps, isLoading } = useCmsQuery(
    'methodology',
    getMethodologySteps
  );
  if (isLoading || !steps) {
    return (
      <section
        id="methodologie"
        className="py-16 md:py-24 bg-globus-light relative">
        
        <div className="container mx-auto px-4 relative z-10">
          <SkeletonGrid count={5} />
        </div>
      </section>);

  }
  return (
    <section
      id="methodologie"
      className="py-16 md:py-24 bg-globus-light relative">
      
      <BackgroundIcons />
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <motion.div
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
            className="inline-flex items-center justify-center gap-4 mb-4">
            
            <div className="h-1 w-8 bg-globus-orange"></div>
            <span className="font-montserrat font-bold text-globus-orange uppercase tracking-wider text-sm">
              Notre Méthodologie
            </span>
            <div className="h-1 w-8 bg-globus-orange"></div>
          </motion.div>
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
            transition={{
              delay: 0.1
            }}
            className="font-montserrat font-extrabold text-3xl md:text-4xl text-globus-blue-dark">
            
            Le "Clé en main" en 5 étapes
          </motion.h2>
          <motion.p
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
            transition={{
              delay: 0.2
            }}
            className="font-opensans text-globus-gray mt-4 max-w-2xl mx-auto">
            
            Nous vous accompagnons de A à Z. Découvrez notre processus
            transparent pour un projet sans stress.
          </motion.p>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Vertical Line for Desktop */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-seconda-blue -translate-x-1/2 rounded-full"></div>

          <div className="space-y-12 relative">
            {steps.map((step, index) =>
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
              className={`flex flex-col md:flex-row items-center gap-8 ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
              
                {/* Flip Card */}
                <div
                className={`w-full md:w-1/2 flex flex-col ${index % 2 === 0 ? 'md:items-start md:text-left' : 'md:items-end md:text-right'} text-center`}>
                
                  <FlipCard step={step} index={index} />
                </div>

                {/* Center Icon */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-16 h-16 bg-globus-blue rounded-full border-4 border-white shadow-md items-center justify-center text-white z-10">
                  {getIcon(step.iconKey, 'w-8 h-8')}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>);

}
function FlipCard({ step, index }: {step: MethodologyStep;index: number;}) {
  const [isFlipped, setIsFlipped] = useState(false);
  return (
    <div
      className="w-full"
      style={{
        perspective: '1000px'
      }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}>
      
      <div
        className="relative w-full transition-transform duration-700 ease-in-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}>
        
        {/* Front Face */}
        <div
          className="w-full"
          style={{
            backfaceVisibility: 'hidden'
          }}>
          
          <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-globus-blue w-full hover:shadow-xl transition-shadow">
            <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3 flex items-center justify-center md:justify-start gap-3">
              <span className="text-globus-orange font-extrabold text-2xl">
                0{index + 1}.
              </span>
              {step.title}
            </h3>
            <p className="font-opensans text-globus-gray">{step.desc}</p>
            <p className="font-opensans text-xs text-globus-orange mt-3 italic">
              Survolez pour voir l'aperçu →
            </p>
          </div>
        </div>

        {/* Back Face */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}>
          
          <div className="w-full h-full rounded-xl overflow-hidden shadow-xl relative">
            <img
              src={step.image}
              alt={step.title}
              className="w-full h-full object-cover"
              style={{
                minHeight: '180px'
              }} />
            
            <div className="absolute inset-0 bg-gradient-to-t from-globus-blue-dark/80 via-transparent to-transparent"></div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <span className="text-globus-orange font-montserrat font-extrabold text-lg">
                0{index + 1}.
              </span>
              <h3 className="font-montserrat font-bold text-white text-lg">
                {step.title}
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>);

}