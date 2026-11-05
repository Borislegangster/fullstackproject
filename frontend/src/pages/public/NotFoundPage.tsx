import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HomeIcon, SearchIcon } from 'lucide-react';

export function NotFoundPage() {
  useEffect(() => { document.title = 'Page non trouvée | Globus Engineering'; }, []);
  return (
    <>
      <div className="min-h-[70vh] bg-globus-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-lg"
        >
          <div className="text-8xl font-bold font-gilroy text-globus-blue mb-4">404</div>
          <h1 className="text-2xl font-bold text-globus-text mb-3">Page non trouvée</h1>
          <p className="text-gray-600 mb-8">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 bg-globus-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-globus-blue-dark transition-colors"
            >
              <HomeIcon size={18} /> Accueil
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 border-2 border-globus-blue text-globus-blue px-6 py-3 rounded-lg font-semibold hover:bg-globus-blue hover:text-white transition-colors"
            >
              <SearchIcon size={18} /> Nous contacter
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
}
