import React, { useState } from 'react';
import Layout from '../src/layout/layout';
import Link from 'next/link';

function EndpointCard({ method, path, description, params, response, children }) {
  const [expanded, setExpanded] = useState(false);
  const methodColors = {
    GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden card-hover">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center space-x-4">
          <span className={`px-2.5 py-1 text-xs font-mono font-medium rounded border ${methodColors[method]}`}>
            {method}
          </span>
          <span className="text-white font-mono text-sm">{path}</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-gray-400 text-sm font-light hidden sm:block">{description}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="px-6 pb-6 border-t border-white/10 pt-4">
          <p className="text-gray-400 text-sm font-light mb-4">{description}</p>
          {params && (
            <div className="mb-4">
              <h4 className="text-white text-xs font-medium uppercase tracking-wider mb-2">Parameters</h4>
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                {params.map((p, i) => (
                  <div key={i} className="flex items-start text-sm">
                    <span className="text-cyan-400 font-mono min-w-[120px]">{p.name}</span>
                    <span className="text-gray-500 font-mono min-w-[80px]">{p.type}</span>
                    <span className="text-gray-400 font-light">{p.desc}</span>
                    {p.required && <span className="text-red-400 text-xs ml-2">required</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {response && (
            <div>
              <h4 className="text-white text-xs font-medium uppercase tracking-wider mb-2">Response</h4>
              <pre className="bg-gray-900/50 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre">
                {response}
              </pre>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ title, code }) {
  return (
    <div className="bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-white/10 flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-gray-500 text-xs font-mono">{title}</span>
        </div>
      )}
      <pre className="p-4 text-sm text-gray-300 font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export default function ApiDocs() {
  return (
    <Layout title="API Documentation" description="API endpoints for accessing S-entropy computation, partition dynamics, and weather prediction services.">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-950/30 to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <p className="text-purple-400 text-sm font-medium tracking-widest uppercase mb-4">For Researchers</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">
            API<br />
            <span className="gradient-text font-normal">Documentation</span>
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-2xl leading-relaxed">
            Programmatic access to S-entropy computation, partition dynamics evolution,
            and atmospheric trajectory completion. Build on the framework.
          </p>
          <div className="mt-6 flex items-center space-x-3">
            <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg border border-emerald-500/30">
              Base URL: https://api.buhera-west.com/v1
            </span>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-light text-white mb-6">Quick Start</h2>
        <CodeBlock
          title="python"
          code={`import requests

# Compute S-entropy coordinates for a location
response = requests.post("https://api.buhera-west.com/v1/sentropy/compute", json={
    "latitude": 48.18,
    "longitude": 11.36,
    "timestamp": "2025-10-13T05:00:00Z"
})

sigma = response.json()
print(f"S_k: {sigma['Sk']:.6f}")
print(f"S_t: {sigma['St']:.6f}")
print(f"S_e: {sigma['Se']:.6f}")
# Output: Sk: 0.673221, St: 0.000542, Se: 0.669333`}
        />
      </section>

      {/* Endpoints */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">S-Entropy</h2>
        <div className="space-y-3">
          <EndpointCard
            method="POST"
            path="/sentropy/compute"
            description="Compute S-entropy coordinates (Sk, St, Se) for a given location and time"
            params={[
              { name: 'latitude', type: 'number', desc: 'Latitude in decimal degrees', required: true },
              { name: 'longitude', type: 'number', desc: 'Longitude in decimal degrees', required: true },
              { name: 'timestamp', type: 'string', desc: 'ISO 8601 timestamp', required: true },
            ]}
            response={`{
  "Sk": 0.673221,
  "St": 0.000542,
  "Se": 0.669333,
  "metadata": {
    "temperature_K": 280.4,
    "pressure_hPa": 964.9,
    "humidity_pct": 97.0,
    "elevation_m": 520.0
  }
}`}
          />
          <EndpointCard
            method="POST"
            path="/sentropy/field"
            description="Compute S-entropy field over a grid of points"
            params={[
              { name: 'bounds', type: 'object', desc: '{north, south, east, west} bounding box', required: true },
              { name: 'resolution', type: 'number', desc: 'Grid spacing in degrees (default: 0.1)' },
              { name: 'timestamp', type: 'string', desc: 'ISO 8601 timestamp', required: true },
            ]}
            response={`{
  "grid": [[{"lat": 48.0, "lon": 11.0, "Sk": ..., "St": ..., "Se": ...}, ...]],
  "resolution_deg": 0.1,
  "timestamp": "2025-10-13T05:00:00Z"
}`}
          />
          <EndpointCard
            method="POST"
            path="/sentropy/inverse"
            description="Recover position from S-entropy measurement (inverse map Π⁻¹)"
            params={[
              { name: 'Sk', type: 'number', desc: 'Configurational entropy coordinate', required: true },
              { name: 'St', type: 'number', desc: 'Velocity entropy coordinate', required: true },
              { name: 'Se', type: 'number', desc: 'Energy entropy coordinate', required: true },
              { name: 'initial_guess', type: 'object', desc: '{lat, lon} initial Newton-Raphson guess' },
            ]}
            response={`{
  "latitude": 48.1801,
  "longitude": 11.3594,
  "convergence": {
    "iterations": 12,
    "residual": 2.3e-7,
    "condition_number": 5665
  }
}`}
          />
        </div>
      </section>

      {/* Partition Dynamics */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Partition Dynamics</h2>
        <div className="space-y-3">
          <EndpointCard
            method="POST"
            path="/dynamics/evolve"
            description="Evolve S-entropy state forward in time using partition dynamics"
            params={[
              { name: 'initial_state', type: 'object', desc: '{Sk, St, Se} initial S-entropy coordinates', required: true },
              { name: 'hours', type: 'number', desc: 'Number of hours to evolve forward', required: true },
              { name: 'latitude', type: 'number', desc: 'Latitude for solar forcing computation', required: true },
              { name: 'longitude', type: 'number', desc: 'Longitude for solar forcing computation', required: true },
              { name: 'start_time', type: 'string', desc: 'ISO 8601 start timestamp', required: true },
              { name: 'step_minutes', type: 'number', desc: 'Time step in minutes (default: 1)' },
            ]}
            response={`{
  "trajectory": [
    {"t_hours": 0, "Sk": 0.673, "St": 0.0005, "Se": 0.669, "T_K": 280.4, "P_hPa": 964.9},
    {"t_hours": 1, "Sk": 0.673, "St": 0.0006, "Se": 0.671, "T_K": 280.7, "P_hPa": 964.8},
    ...
  ],
  "lyapunov_exponent": -0.19,
  "max_divergence": 0.042
}`}
          />
          <EndpointCard
            method="POST"
            path="/dynamics/predict"
            description="Full weather prediction pipeline: compute S-entropy, evolve, reconstruct weather"
            params={[
              { name: 'latitude', type: 'number', desc: 'Target latitude', required: true },
              { name: 'longitude', type: 'number', desc: 'Target longitude', required: true },
              { name: 'hours', type: 'number', desc: 'Forecast horizon in hours', required: true },
            ]}
            response={`{
  "forecast": [
    {"time": "2025-10-13T06:00:00Z", "temp_K": 280.7, "pressure_hPa": 964.8, "wind_ms": 1.2},
    {"time": "2025-10-13T07:00:00Z", "temp_K": 281.5, "pressure_hPa": 964.5, "wind_ms": 1.5},
    ...
  ],
  "metrics": {
    "lyapunov_exponent": -0.19,
    "trajectory_bound": 0.042
  }
}`}
          />
        </div>
      </section>

      {/* Weather Reconstruction */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Weather Reconstruction</h2>
        <div className="space-y-3">
          <EndpointCard
            method="POST"
            path="/reconstruct/weather"
            description="Reconstruct physical weather variables from S-entropy coordinates"
            params={[
              { name: 'Sk', type: 'number', desc: 'Configurational entropy', required: true },
              { name: 'St', type: 'number', desc: 'Velocity entropy', required: true },
              { name: 'Se', type: 'number', desc: 'Energy entropy', required: true },
              { name: 'elevation_m', type: 'number', desc: 'Surface elevation in metres (default: 0)' },
              { name: 'humidity_pct', type: 'number', desc: 'Assumed relative humidity (default: 80)' },
            ]}
            response={`{
  "temperature_K": 280.4,
  "temperature_C": 7.3,
  "pressure_hPa": 964.9,
  "wind_speed_ms": 0.9,
  "method": {
    "Se_to_T": "linear_inversion",
    "St_to_wind": "thermal_velocity_subtraction",
    "P": "barometric_formula_plus_Sk_correction"
  }
}`}
          />
          <EndpointCard
            method="GET"
            path="/stations/nearby"
            description="Find weather stations near a location with S-entropy data"
            params={[
              { name: 'lat', type: 'number', desc: 'Latitude', required: true },
              { name: 'lon', type: 'number', desc: 'Longitude', required: true },
              { name: 'radius_km', type: 'number', desc: 'Search radius (default: 50)' },
            ]}
            response={`{
  "stations": [
    {"id": "10866", "name": "Munich", "distance_km": 0.0, "Sk": 0.673, "St": 0.001, "Se": 0.669},
    ...
  ]
}`}
          />
        </div>
      </section>

      {/* Rate Limits & Auth */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">Authentication &amp; Rate Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Free Tier</h3>
            <ul className="space-y-2 text-gray-400 text-sm font-light">
              <li>100 requests/day</li>
              <li>Single-point S-entropy computation</li>
              <li>Up to 24h forecast horizon</li>
              <li>API key via email registration</li>
            </ul>
          </div>
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Research Tier</h3>
            <ul className="space-y-2 text-gray-400 text-sm font-light">
              <li>10,000 requests/day</li>
              <li>Grid S-entropy field computation</li>
              <li>Extended forecast horizons</li>
              <li>Batch processing support</li>
              <li>Priority support</li>
            </ul>
          </div>
        </div>
        <div className="mt-6">
          <CodeBlock
            title="authentication"
            code={`# Include your API key in the request header
curl -H "Authorization: Bearer YOUR_API_KEY" \\
     -H "Content-Type: application/json" \\
     -d '{"latitude": 48.18, "longitude": 11.36, "timestamp": "2025-10-13T05:00:00Z"}' \\
     https://api.buhera-west.com/v1/sentropy/compute`}
          />
        </div>
      </section>

    </Layout>
  );
}
