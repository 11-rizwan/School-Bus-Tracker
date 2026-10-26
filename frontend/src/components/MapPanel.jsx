import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Route as RouteIcon } from 'lucide-react';

const busIcon = L.divIcon({
  className: 'bus-map-marker-wrap',
  html: '<div class="bus-map-marker"><span>BUS</span></div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});
function Recenter({ center }) {
  const map = useMap();
  React.useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center[0], center[1], map]);
  return null;
}
export default function MapPanel({ buses = [] }) {
  const located = buses.filter(b => b.location && Number.isFinite(b.location.latitude) && Number.isFinite(b.location.longitude));
  const center = located.length ? [located[0].location.latitude, located[0].location.longitude] : [13.0827, 80.2707];
  return <section className="map-panel">
    <div className="map-heading"><div><span className="eyebrow">LIVE OVERVIEW</span><h2>Fleet location</h2></div><span className="live-indicator"><i /> Live updates</span></div>
    <div className="real-map-wrap">
      <MapContainer center={center} zoom={located.length ? 13 : 11} scrollWheelZoom className="real-map">
        <Recenter center={center} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {located.map(bus => <Marker key={bus.id} position={[bus.location.latitude, bus.location.longitude]} icon={busIcon}><Popup><strong>{bus.bus_number}</strong><br />{bus.route?.name || 'Route not assigned'}<br />Speed: {bus.location.speed_kph} km/h<br />Updated: {new Date(bus.location.updated_at).toLocaleTimeString()}</Popup></Marker>)}
      </MapContainer>
      {!located.length && <div className="map-empty-overlay"><MapPin size={22}/><strong>Waiting for first GPS update</strong><span>The map is centered on Chennai until a bus reports its location.</span></div>}
      <div className="map-legend"><span><i className="legend-bus"/> Bus location</span><span><i className="legend-route"/> Route details below</span></div>
    </div>
    <div className="map-footnote"><RouteIcon size={15}/> Live markers use reported GPS coordinates. Route stops and destinations are listed in each bus's route details.</div>
  </section>;
}
