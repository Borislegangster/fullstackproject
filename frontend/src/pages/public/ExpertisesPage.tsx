import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosClient as api } from '../../services/api/axiosClient';
import {
  RulerIcon, HardHatIcon, LayersIcon, MapPinIcon, ScanIcon,
  ShieldCheckIcon, WrenchIcon, ArrowRightIcon, CheckCircle2Icon,
} from 'lucide-react';

const fallbackExpertises = [
  { slug: 'etudes-structurelles', name: 'Études Structurelles', icon: 'HardHat', description: 'Calculs de structure béton armé, charpente métallique et bois. Dimensionnement parasismique.', capabilities: ['Béton armé', 'Charpente métallique', 'Calcul parasismique', 'Expertise pathologies'] },
  { slug: 'modelisation-bim', name: 'Modélisation BIM', icon: 'Layers', description: 'Modélisation 3D collaborative avec détection de clashs et coordination multi-disciplinaire.', capabilities: ['Revit Architecture', 'Revit Structure', 'Navisworks', 'IFC OpenBIM'] },
  { slug: 'topographie', name: 'Topographie & Géotechnique', icon: 'MapPin', description: 'Levés topographiques, études de sol, implantation de bâtiments et suivi de tassements.', capabilities: ['Levé topographique', 'Étude de sol', 'Implantation', 'Suivi tassement'] },
  { slug: 'controle-technique', name: 'Contrôle Technique', icon: 'ScanIcon', description: 'Missions de contrôle technique, vérifications réglementaires et audits de conformité.', capabilities: ['Contrôle solidité', 'Sécurité incendie', 'Accessibilité', 'Audit énergétique'] },
  { slug: 'gestion-projet', name: 'Gestion de Projet', icon: 'Wrench', description: 'Maîtrise d\'oeuvre, ordonnancement, pilotage et coordination de chantier.', capabilities: ['OPC', 'Planning TCE', 'Coordination SSI', 'Suivi financier'] },
  { slug: 'expertise-conseil', name: 'Expertise & Conseil', icon: 'ShieldCheck', description: 'Expertise judiciaire, diagnostic structurel, conseil en réhabilitation et rénovation.', capabilities: ['Expertise judiciaire', 'Diagnostic structure', 'Réhabilitation', 'Conseil technique'] },
];

const iconMap: Record<string, any> = {
  HardHat: HardHatIcon, Layers: LayersIcon, MapPin: MapPinIcon,
  ScanIcon: ScanIcon, Wrench: WrenchIcon, ShieldCheck: ShieldCheckIcon,
  Ruler: RulerIcon,
};

export function ExpertisesPage() {
  useEffect(() => { document.title = 'Nos Expertises | Globus Engineering'; }, []);
  const { data: expertises } = useQuery({
    queryKey: ['cms-expertises'],
    queryFn: async () => {
      const { data } = await api.get('/cms/expertises?published_only=true');
      return data;
    },
  });

  const items = expertises?.length > 0 ? expertises : fallbackExpertises;

  return (
    <>

      {/* Hero */}
      <section className="bg-globus-blue text-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl lg:text-5xl font-bold font-gilroy mb-6"
          >
            Nos Expertises Techniques
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-blue-100 max-w-3xl mx-auto"
          >
            Des compétences pointues au service de vos projets.
            Bureau d'études pluridisciplinaire certifié.
          </motion.p>
        </div>
      </section>

      {/* Expertise Grid */}
      <section className="py-16 lg:py-24 bg-globus-bg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((exp: any, i: number) => {
              const Icon = iconMap[exp.icon] || WrenchIcon;
              return (
                <motion.div
                  key={exp.slug}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow group"
                >
                  <div className="w-14 h-14 rounded-xl bg-globus-blue/10 flex items-center justify-center mb-5 group-hover:bg-globus-blue/20 transition-colors">
                    <Icon size={28} className="text-globus-blue" />
                  </div>
                  <h3 className="text-xl font-bold font-gilroy text-globus-text mb-3">
                    {exp.name || exp.title}
                  </h3>
                  <p className="text-gray-600 mb-5">{exp.description}</p>
                  {exp.capabilities?.length > 0 && (
                    <ul className="space-y-1.5 mb-5">
                      {exp.capabilities.slice(0, 4).map((c: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle2Icon size={14} className="text-globus-success" /> {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {exp.projects_count > 0 && (
                    <div className="text-sm text-globus-blue font-semibold">
                      {exp.projects_count}+ projets réalisés
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold font-gilroy text-globus-text mb-4">
            Besoin d'une expertise technique ?
          </h2>
          <p className="text-gray-600 mb-8">
            Nos ingénieurs sont à votre disposition pour étudier votre projet.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/decrire-mon-projet"
              className="inline-flex items-center justify-center gap-2 bg-globus-orange text-white px-8 py-4 rounded-lg font-semibold hover:bg-globus-orange-hover transition-colors"
            >
              Décrire mon projet <ArrowRightIcon size={18} />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-globus-blue text-globus-blue px-8 py-4 rounded-lg font-semibold hover:bg-globus-blue hover:text-white transition-colors"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
