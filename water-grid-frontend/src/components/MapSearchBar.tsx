import { useRef, useEffect } from 'react';
import { SearchBox } from '@mapbox/search-js-react';

interface MapSearchBarProps {
  accessToken: string;
  onLocationSelect: (longitude: number, latitude: number, placeName: string) => void;
}

export function MapSearchBar({ accessToken, onLocationSelect }: MapSearchBarProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchBoxRef = useRef<any>(null);

  useEffect(() => {
    // CSS can't cross shadow DOM boundaries for -webkit-text-fill-color;
    // inline style is the only reliable fix.
    const fix = () =>
      document.querySelectorAll('mapbox-search-box').forEach((host) => {
        const shadow = (host as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
        shadow?.querySelectorAll('input').forEach((input) => {
          input.style.setProperty('-webkit-text-fill-color', '#ffffff', 'important');
          input.style.setProperty('caret-color', '#00ffcc', 'important');
        });
      });
    fix();
    const mo = new MutationObserver(fix);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 10,
        width: '300px',
      }}
    >
      <SearchBox
        ref={searchBoxRef}
        accessToken={accessToken}
        onRetrieve={(result) => {
          const feature = result.features?.[0];
          if (!feature) return;
          const [lng, lat] = feature.geometry.coordinates as [number, number];
          const placeName = feature.properties.full_address ?? feature.properties.name ?? '';
          onLocationSelect(lng, lat, placeName);
        }}
        options={{
          language: 'en',
          limit: 5,
        }}
        theme={{
          variables: {
            colorBackground: '#1a1a1a',
            colorBackgroundHover: '#2a2a2a',
            colorText: '#ffffff',
            colorSecondary: '#aaaaaa',
            colorPrimary: '#00ffcc',
            borderRadius: '8px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
            fontFamily: 'monospace',
          },
        }}
      />
    </div>
  );
}
