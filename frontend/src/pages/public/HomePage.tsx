import React, { useEffect } from 'react';
import {
  HeroSection,
  EngagementsBar,
  AboutSection,
  MethodologySection,
  StatsBar,
  ServicesSection,
  CTABanner,
  PortfolioSection,
  GuaranteesSection,
  VideoSection,
  TeamSection,
  PartnersSection,
  TestimonialsSection,
  FAQSection,
  BlogSection,
} from '../../features/home';
import { SEOHead } from '../../components/seo/SEOHead';
export function HomePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="w-full">
      <SEOHead
        title="Construction BTP Clé en Main à Douala"
        description="Globus Engineering SARL, votre partenaire de confiance pour la construction, rénovation et génie civil au Cameroun. Devis gratuit."
        keywords="construction, BTP, Douala, Cameroun, clé en main, génie civil"
        canonicalPath="/" />
      
      <HeroSection />
      <EngagementsBar />
      <AboutSection />
      <MethodologySection />
      <StatsBar />
      <ServicesSection />
      <CTABanner />
      <PortfolioSection />
      <GuaranteesSection />
      <VideoSection />
      <TeamSection />
      <PartnersSection />
      <TestimonialsSection />
      <FAQSection />
      <BlogSection />
    </div>);

}