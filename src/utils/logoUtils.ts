import restedLogo from '@/assets/logos/rested-logo.png';
import doulaconnectLogo from '@/assets/logos/doulaconnect-logo.png';

export interface LogoConfig {
  src: string;
  alt: string;
  name: string;
}

/**
 * Get the appropriate logo based on the sender_app URL parameter
 */
export const getAppLogo = (): LogoConfig => {
  const urlParams = new URLSearchParams(window.location.search);
  const senderApp = urlParams.get('sender_app');
  
  if (senderApp === 'Doula') {
    return {
      src: doulaconnectLogo,
      alt: 'DoulaConnect Logo',
      name: 'DoulaConnect'
    };
  }
  
  // Default to Rested logo
  return {
    src: restedLogo,
    alt: 'Rested Logo', 
    name: 'Rested'
  };
};

/**
 * Logo configurations for different apps
 */
export const LOGOS = {
  rested: {
    src: restedLogo,
    alt: 'Rested Logo',
    name: 'Rested'
  },
  doulaconnect: {
    src: doulaconnectLogo,
    alt: 'DoulaConnect Logo', 
    name: 'DoulaConnect'
  }
} as const;

export type LogoKey = keyof typeof LOGOS;