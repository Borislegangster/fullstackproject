import React, { useEffect, createElement } from 'react';
interface SEOHeadProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalPath?: string;
}
export function SEOHead({
  title,
  description,
  keywords = 'construction, BTP, Douala, Cameroun, clé en main, génie civil',
  ogImage = "/globusLogo.jpg",
  ogType = 'website',
  canonicalPath = ''
}: SEOHeadProps) {
  useEffect(() => {
    const fullTitle = `${title} | Globus Engineering SARL`;
    const baseUrl = 'https://www.globus-btp.com';
    const fullUrl = `${baseUrl}${canonicalPath}`;
    // Helper to set or create meta tags
    const setMetaTag = (
    attrName: string,
    attrValue: string,
    content: string) =>
    {
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };
    // Title
    document.title = fullTitle;
    // Standard Meta
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'keywords', keywords);
    // OpenGraph
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:url', fullUrl);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', 'Globus Engineering SARL');
    // Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);
    // Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', fullUrl);
    // We do NOT remove tags on unmount so the next page can just overwrite them
    // This prevents flickering of meta tags during client-side navigation
  }, [title, description, keywords, ogImage, ogType, canonicalPath]);
  return null;
}