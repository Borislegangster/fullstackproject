import { motion } from 'framer-motion';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getEngagements } from '../../services/api/cms.api';
import { getIcon } from '../../utils/iconRegistry';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export function EngagementsBar() {
  const { data: engagements, isLoading } = useCmsQuery(
    'engagements',
    getEngagements
  );
  if (isLoading || !engagements) {
    return (
      <section className="relative z-30 -mt-12 md:-mt-16 px-4">
        <div className="container mx-auto">
          <SkeletonGrid count={3} />
        </div>
      </section>);

  }
  return (
    <section className="relative z-30 -mt-12 md:-mt-16 px-4">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 rounded-xl overflow-hidden shadow-2xl">
          {engagements.map((item, index) =>
          <motion.div
            key={index}
            className={`${item.bgColor} ${item.textColor} p-8 md:p-10 flex flex-col items-center text-center`}
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
              duration: 0.5,
              delay: index * 0.1
            }}>
            
              {getIcon(item.iconKey, 'w-10 h-10 mb-4')}
              <h3 className="font-montserrat font-bold text-xl mb-2">
                {item.title}
              </h3>
              <p className="font-opensans text-sm opacity-90">{item.desc}</p>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}