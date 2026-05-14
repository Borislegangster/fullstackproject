import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { axiosClient } from '../services/api/axiosClient';

function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) browser = 'Opera';
  else if (ua.indexOf('Trident') > -1) browser = 'Internet Explorer';
  else if (ua.indexOf('Edge') > -1) browser = 'Edge';
  else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browser = 'Safari';

  let os = 'Unknown';
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'MacOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('like Mac') > -1) os = 'iOS';

  let deviceType = 'Desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'Mobile';
  if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';

  return { browser, os, deviceType, userAgent: ua };
}

export function useAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    // Ne traquer que les pages publiques, pas l'admin
    if (location.pathname.startsWith('/admin')) return;

    const trackPage = async () => {
      try {
        const { browser, os, deviceType, userAgent } = getBrowserInfo();
        
        await axiosClient.post('/cms/analytics/track', {
          path: location.pathname,
          userAgent,
          deviceType,
          browser,
          os
        });
      } catch (error) {
        console.error('Analytics tracking failed:', error);
      }
    };

    trackPage();
  }, [location.pathname]);
}
