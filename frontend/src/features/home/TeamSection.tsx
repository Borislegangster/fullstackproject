import { motion } from 'framer-motion';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getTeamMembers } from '../../services/api/cms.api';
import { SkeletonGrid } from '../../components/ui/Skeleton';
export function TeamSection() {
  const { data: team, isLoading } = useCmsQuery('team', getTeamMembers);
  if (isLoading || !team) {
    return (
      <section className="py-16 md:py-24 bg-globus-light">
        <div className="container mx-auto px-4">
          <SkeletonGrid count={4} />
        </div>
      </section>);

  }
  return (
    <section className="py-16 md:py-24 bg-globus-light">
      <div className="container mx-auto px-4">
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
              Notre Équipe
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
            
            Les Experts derrière vos projets
          </motion.h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {team.map((member, index) =>
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
            className="bg-white rounded-xl overflow-hidden shadow-lg group">
            
              {/* Image Placeholder using gradient */}
              <div
              className={`h-64 w-full bg-gradient-to-br ${member.imageClass} relative overflow-hidden`}>
              
                {member.photo &&
              <img
                src={member.photo}
                alt={member.name}
                className="absolute inset-0 w-full h-full object-cover z-0" />

              }
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300 z-10"></div>
                {/* Abstract shape to make it look less empty */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl z-10"></div>
                <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl z-10"></div>
              </div>

              <div className="p-6 text-center relative">
                {/* Decorative line */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-1 bg-globus-orange"></div>

                <h3 className="font-montserrat font-extrabold text-xl text-globus-blue-dark mb-1">
                  {member.name}
                </h3>
                <p className="font-opensans font-semibold text-globus-orange text-sm mb-4">
                  {member.role}
                </p>
                <p className="font-opensans text-globus-gray italic text-sm">
                  "{member.quote}"
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>);

}