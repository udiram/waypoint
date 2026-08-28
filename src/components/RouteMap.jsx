import { CloudRain, Navigation, Wind } from 'lucide-react';
import { routeMarkersFromCoordinates, routePathFromCoordinates } from '../lib/utils';

export default function RouteMap({
  mode = 'solo',
  route,
  comparisonRoute = null,
  weatherStops = [],
  members = [],
  labels = ['Start', 'Midpoint', 'Arrival'],
}) {
  const isConvoy = mode === 'convoy';
  const mainRoute = routePathFromCoordinates(route?.coordinates || []);
  const alternateRoute = comparisonRoute ? routePathFromCoordinates(comparisonRoute.coordinates) : '';
  const markers = routeMarkersFromCoordinates(route?.coordinates || [], labels);

  return (
    <div className={`route-map ${isConvoy ? 'convoy-map' : ''}`} aria-label="Stylized route map from Madison to Chicago">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={`grid-${mode}`} width="74" height="74" patternUnits="userSpaceOnUse">
            <path d="M74 0H0V74" fill="none" stroke="#33414c" strokeWidth="1" opacity=".34" />
          </pattern>
          <filter id={`glow-${mode}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="1000" height="1000" fill={`url(#grid-${mode})`} />
        <path className="map-road" d="M-30 140 C180 210, 250 145, 420 270 S665 350, 1030 310" />
        <path className="map-road" d="M20 780 C260 690, 350 760, 520 600 S800 520, 1050 620" />
        <path className="map-road thin" d="M140 -20 C210 240, 165 420, 330 1010" />
        <path className="lake-shape" d="M795 -30 C750 120 855 230 802 355 C745 490 837 605 810 790 C790 905 900 985 1045 1030 L1050 -20Z" />
        {alternateRoute && <path className="alternate-route" d={alternateRoute} />}
        {mainRoute && <path className="main-route" d={mainRoute} filter={`url(#glow-${mode})`} />}
      </svg>

      {!isConvoy && <div className="weather-corridor"><CloudRain size={25} /><Wind size={20} /><CloudRain size={25} /></div>}
      {!isConvoy && markers.map((marker, index) => (
        <div key={marker.label} className={`map-marker ${index === 1 ? 'warning' : ''}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
          <span className="marker-dot">{index === 1 ? '!' : ''}</span>
          <strong>{marker.label}</strong>
        </div>
      ))}
      {isConvoy && members.map((member) => (
        <div key={member.id} className="convoy-marker" style={{ left: `${member.x}%`, top: `${member.y}%`, '--marker': member.color }}>
          <Navigation size={20} fill="currentColor" />
        </div>
      ))}
      {isConvoy && <div className="charger-zone"><span>⚡</span><strong>Rockford</strong></div>}
      <div className="map-key">
        <span><i className="key-line blue" /> {isConvoy ? 'Convoy route' : 'Current route'}</span>
        <span><i className="key-line dashed" /> Alternate</span>
      </div>
      {!isConvoy && weatherStops.length > 0 && (
        <div className="weather-strip">
          {weatherStops.map((stop) => (
            <div key={stop.label}>
              <small>{stop.label}</small>
              <strong>{Math.round(stop.temperature)}°</strong>
              <span><Wind size={13} /> {Math.round(stop.wind)} mph</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
