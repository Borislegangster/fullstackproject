import React, { useEffect, createElement } from 'react';
import { useCmsQuery } from '../../hooks/useCmsQuery';
import { getSiteSettings } from '../../services/api/cms.api';
export function SchemaOrg() {
  const { data: siteSettings } = useCmsQuery('site-settings', getSiteSettings);
  useEffect(() => {
    const scriptId = 'schema-org-localbusiness';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: siteSettings?.companyName || 'Globus Engineering SARL',
        description:
        siteSettings?.footerDescription ||
        'Votre partenaire de confiance pour la construction BTP clé en main au Cameroun.',
        url: 'https://www.globus-btp.com',
        telephone: siteSettings?.phone || '+33 1 23 45 67 89',
        email: siteSettings?.email || 'contact@globus-btp.com',
        address: {
          '@type': 'PostalAddress',
          streetAddress:
          siteSettings?.address || '123 Avenue de la Construction',
          addressLocality: 'Douala',
          addressCountry: 'CM'
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: '4.0511',
          longitude: '9.7679'
        },
        openingHours: 'Mo-Fr 08:00-18:00, Sa 09:00-13:00',
        priceRange: '$$',
        image:
        siteSettings?.logo || "/globusLogo.jpg",

        sameAs: [
        siteSettings?.socialLinks?.facebook ||
        'https://facebook.com/globusengineering',
        siteSettings?.socialLinks?.twitter || 'https://twitter.com/globuseng',
        siteSettings?.socialLinks?.linkedin ||
        'https://linkedin.com/company/globus-engineering',
        siteSettings?.socialLinks?.instagram ||
        'https://instagram.com/globusengineering'].
        filter(Boolean)
      };
      script.innerHTML = JSON.stringify(schemaData);
      document.head.appendChild(script);
    }
  }, [siteSettings]);
  return null;
}