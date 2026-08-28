import { AlertTriangle, BatteryCharging, Check, Fan, Moon, Sunrise, Wind } from 'lucide-react';
import { useState } from 'react';

function Chart({ reserve }) {
  const endY = 166 - reserve * 1.45;
  return (
    <svg className="camp-chart" viewBox="0 0 900 430" preserveAspectRatio="none" aria-label="Overnight battery and temperature forecast">
      {[0,1,2,3,4,5,6,7,8,9].map((index) => <line key={index} x1={40 + index * 88} y1="35" x2={40 + index * 88} y2="390" className="chart-grid" />)}
      <line x1="35" y1={166 - reserve * 1.45} x2="850" y2={166 - reserve * 1.45} className="reserve-line" />
      <path className="battery-area" d={`M40 62 C180 72 255 92 370 106 S600 140 850 ${endY} L850 175 L40 175Z`} />
      <path className="battery-path" d={`M40 62 C180 72 255 92 370 106 S600 140 850 ${endY}`} />
      <path className="inside-path" d="M40 248 C230 246 460 251 850 248" />
      <path className="outside-path" d="M40 332 C280 340 535 356 850 380" />
      <circle cx="40" cy="62" r="5" className="chart-dot" /><circle cx="850" cy={endY} r="5" className="chart-dot" />
      <text x="42" y="52" className="chart-value">68%</text><text x="814" y={endY - 12} className="chart-value">{reserve + 1}%</text>
      <text x="42" y="238" className="chart-value">68°F</text><text x="814" y="238" className="chart-value">68°F</text>
      <text x="42" y="322" className="chart-value">58°F</text><text x="814" y="372" className="chart-value">42°F</text>
      {['10 PM','11 PM','12 AM','1 AM','2 AM','3 AM','4 AM','5 AM','6 AM','7 AM'].map((label, index) => <text key={label} x={25 + index * 88} y="22" className="chart-time">{label}</text>)}
      <text x="12" y="82" className="chart-label">Battery</text><text x="12" y="264" className="chart-label">Inside</text><text x="12" y="350" className="chart-label">Outside</text>
    </svg>
  );
}

export default function Campglass() {
  const [reserve, setReserve] = useState(30);
  const [applied, setApplied] = useState(false);

  return (
    <section className="module campglass-module">
      <div className="camp-main">
        <div className="panel-heading"><h1>Campglass</h1><p>Devil's Lake State Park</p></div>
        <h2>Comfort until sunrise</h2>
        <div className="camp-metrics">
          <div><strong>68%</strong><span>now</span></div>
          <div><strong>{reserve + 1}%</strong><span>morning reserve</span></div>
          <div><strong>42°F</strong><span>overnight low</span></div>
        </div>
        <Chart reserve={reserve} />
        <div className="sunrise-label"><Sunrise /> 6:22 AM</div>
      </div>

      <aside className="camp-controls">
        <div className="camp-active"><Moon /><div><strong>Camp Mode active</strong><span>Optimizing comfort and efficiency overnight.</span></div></div>
        <div className="reserve-control">
          <label htmlFor="reserve">Protect at least <strong>{reserve}%</strong></label>
          <input id="reserve" type="range" min="20" max="50" value={reserve} onChange={(event) => { setReserve(Number(event.target.value)); setApplied(false); }} />
          <div><span>20%</span><span>50%</span></div>
          <p>Battery will hold at or above this level until morning.</p>
        </div>
        <div className="route-alert"><AlertTriangle /><span>Wind increases after 3 AM.</span></div>
        <button className="primary-button" onClick={() => setApplied(true)}>{applied ? <Check /> : <BatteryCharging />}{applied ? 'Energy plan applied' : 'Apply energy plan'}</button>
        <button className="secondary-button" onClick={() => { setReserve(30); setApplied(false); }}>Keep current settings</button>
        <footer className="camp-footer"><Fan /> Climate 68°F <span>•</span><Wind /> 8h 14m until sunrise</footer>
      </aside>
    </section>
  );
}
