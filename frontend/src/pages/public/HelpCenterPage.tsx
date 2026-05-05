import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SearchIcon,
  MessageCircleIcon,
  MailIcon,
  PhoneIcon,
  FileTextIcon,
  ArrowRightIcon,
  SendIcon,
  HelpCircleIcon,
  CheckCircleIcon } from
'lucide-react';
import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/seo/SEOHead';
import { submitSupportTicket, getContactInfo } from '../../services/api/cms.api';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import toast from 'react-hot-toast';
export function HelpCenterPage() {
  const { data: contactInfo } = useCmsQuery('contact-info', getContactInfo);
  const [formStatus, setFormStatus] = useState<
    'idle' | 'submitting' | 'success'>(
    'idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('submitting');
    try {
      await submitSupportTicket(formData);
      setFormStatus('success');
      toast.success('Ticket envoyé avec succès !');
    } catch (error) {
      setFormStatus('idle');
      toast.error("Erreur lors de l'envoi du ticket.");
    }
  };
  return (
    <div className="pt-40 xl:pt-28 sm:pt-28 pb-20 bg-gray-50 min-h-screen">
      <SEOHead
        title="Centre d'Aide"
        description="Besoin d'assistance ? Support WhatsApp, email ou FAQ."
        canonicalPath="/aide" />
      
      {/* Hero Banner */}
      <div className="text-white py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <motion.h1
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              className="text-4xl md:text-5xl font-montserrat font-extrabold text-globus-blue-dark mb-4">
              
              Centre d'Aide
            </motion.h1>
            <div className="h-1 w-24 bg-globus-orange mx-auto rounded-full mb-6"></div>
            <p className="font-opensans text-lg text-globus-gray max-w-2xl mx-auto">
              Comment pouvons-nous vous assister aujourd'hui ? Choisissez le
              moyen de contact qui vous convient le mieux.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* FAQ Card */}
            <motion.div
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: 0.1
              }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col items-center text-center h-full">
              
              <div className="w-16 h-16 bg-globus-orange/10 rounded-full flex items-center justify-center mb-6">
                <HelpCircleIcon className="w-8 h-8 text-globus-orange" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3">
                Foire Aux Questions
              </h3>
              <p className="font-opensans text-globus-gray mb-8 flex-grow">
                Trouvez des réponses immédiates aux questions les plus
                fréquemment posées par nos clients.
              </p>
              <Link
                to="/faq"
                className="w-full bg-globus-blue hover:bg-globus-blue/90 text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors">
                
                Consulter la FAQ
              </Link>
            </motion.div>

            {/* WhatsApp Card */}
            <motion.div
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: 0.2
              }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col items-center text-center h-full">
              
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <MessageCircleIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3">
                Assistance WhatsApp
              </h3>
              <p className="font-opensans text-globus-gray mb-8 flex-grow">
                Discutez en direct avec un conseiller pour une assistance rapide
                et personnalisée.
              </p>
              <a
                href={
                contactInfo?.whatsapp ?
                `https://wa.me/${contactInfo.whatsapp.replace(/[^0-9]/g, '')}` :
                'https://wa.me/33612345678'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-montserrat font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2">
                
                <MessageCircleIcon className="w-5 h-5" /> Discuter sur WhatsApp
              </a>
            </motion.div>

            {/* Email Card */}
            <motion.div
              initial={{
                opacity: 0,
                y: 20
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: 0.3
              }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 flex flex-col items-center text-center h-full">
              
              <div className="w-16 h-16 bg-globus-blue/10 rounded-full flex items-center justify-center mb-6">
                <MailIcon className="w-8 h-8 text-globus-blue" />
              </div>
              <h3 className="font-montserrat font-bold text-xl text-globus-blue-dark mb-3">
                Support par Email
              </h3>
              <p className="font-opensans text-globus-gray mb-8 flex-grow">
                Envoyez-nous un email détaillé. Notre équipe s'engage à vous
                répondre sous 24h ouvrées.
              </p>
              <a
                href={`mailto:${contactInfo?.email || 'support@globus-btp.com'}`}
                className="w-full bg-globus-light hover:bg-gray-100 border border-gray-200 text-globus-blue-dark font-montserrat font-bold py-3 px-6 rounded-lg transition-colors">
                
                {contactInfo?.email || 'support@globus-btp.com'}
              </a>
            </motion.div>
          </div>

          {/* Support Ticket Form */}
          <motion.div
            initial={{
              opacity: 0,
              y: 30
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              delay: 0.4
            }}
            className="mt-12 bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12">
            
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-globus-orange/10 rounded-full flex items-center justify-center flex-shrink-0">
                <FileTextIcon className="w-6 h-6 text-globus-orange" />
              </div>
              <div>
                <h3 className="font-montserrat font-bold text-2xl text-globus-blue-dark">
                  Ouvrir un ticket de support
                </h3>
                <p className="font-opensans text-globus-gray">
                  Remplissez ce formulaire pour une assistance technique ou
                  administrative.
                </p>
              </div>
            </div>

            {formStatus === 'success' ?
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h4 className="font-montserrat font-bold text-xl text-green-800 mb-2">
                  Ticket envoyé avec succès !
                </h4>
                <p className="font-opensans text-green-700">
                  Un conseiller prendra en charge votre demande très
                  prochainement.
                </p>
              </div> :

            <form onSubmit={handleTicketSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label
                    htmlFor="name"
                    className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    
                      Nom complet
                    </label>
                    <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
                    placeholder="Jean Dupont" />
                  
                  </div>
                  <div>
                    <label
                    htmlFor="email"
                    className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                    
                      Adresse E-mail
                    </label>
                    <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                    setFormData({
                      ...formData,
                      email: e.target.value
                    })
                    }
                    className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
                    placeholder="jean@email.com" />
                  
                  </div>
                </div>
                <div>
                  <label
                  htmlFor="subject"
                  className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                  
                    Sujet
                  </label>
                  <input
                  type="text"
                  id="subject"
                  required
                  value={formData.subject}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    subject: e.target.value
                  })
                  }
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors"
                  placeholder="Ex: Problème d'accès à mon espace client" />
                
                </div>
                <div>
                  <label
                  htmlFor="message"
                  className="block font-montserrat font-semibold text-globus-blue-dark text-sm mb-2">
                  
                    Message détaillé
                  </label>
                  <textarea
                  id="message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) =>
                  setFormData({
                    ...formData,
                    message: e.target.value
                  })
                  }
                  className="w-full bg-globus-light border border-gray-200 rounded-lg px-4 py-3 font-opensans focus:outline-none focus:border-globus-orange focus:ring-1 focus:ring-globus-orange transition-colors resize-none"
                  placeholder="Décrivez votre problème...">
                </textarea>
                </div>
                <button
                type="submit"
                disabled={formStatus === 'submitting'}
                className="w-full md:w-auto bg-globus-orange hover:bg-globus-orange-hover text-white font-montserrat font-bold py-3 px-8 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-70">
                
                  {formStatus === 'submitting' ?
                'Envoi...' :

                <>
                      <SendIcon className="w-5 h-5" /> Envoyer le ticket
                    </>
                }
                </button>
              </form>
            }
          </motion.div>
        </div>
      </div>
    </div>);

}