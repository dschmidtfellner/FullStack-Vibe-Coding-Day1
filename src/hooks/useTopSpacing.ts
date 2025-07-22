import { useState, useEffect } from 'react';

export function useTopSpacing() {
  const [isShowingCTA, setIsShowingCTA] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showCTA = urlParams.get('Show_CTA');
    setIsShowingCTA(showCTA === 'yes');
  }, []);

  return {
    topSpacing: isShowingCTA ? 91 : 64,
    topSpacingClass: isShowingCTA ? 'top-spacing-with-cta' : 'top-spacing-default',
    containerHeightClass: isShowingCTA ? 'container-height-with-cta' : 'container-height-default',
    isShowingCTA
  };
}