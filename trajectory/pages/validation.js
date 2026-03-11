import React from 'react';
import Layout from '../src/layout/layout';
import Link from 'next/link';

function MetricCard({ label, value, unit, description, color = 'cyan' }) {
  const colorMap = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5',
    blue: 'text-blue-400 border-blue-500/30 bg-blue-500/5',
    emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/5',
    amber: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  };
  const classes = colorMap[color];
  return (
    <div className={`rounded-xl p-5 border ${classes}`}>
      <div className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-light ${classes.split(' ')[0]}`}>
        {value}<span className="text-lg ml-1">{unit}</span>
      </div>
      {description && <div className="text-gray-400 text-sm font-light mt-2">{description}</div>}
    </div>
  );
}

function ResultTable({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className={`py-3 px-4 font-light ${j === 0 ? 'text-gray-300' : 'text-gray-400 font-mono text-sm'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Validation() {
  return (
    <Layout title="Empirical Validation" description="Validation of the atmospheric trajectory completion framework against real meteorological observations from Munich, Germany.">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/30 to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <p className="text-emerald-400 text-sm font-medium tracking-widest uppercase mb-4">Empirical Results</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">
            Validation Against<br />
            <span className="gradient-text font-normal">Real Observations</span>
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-2xl leading-relaxed">
            Munich, Germany &middot; 48.18&deg;N, 11.36&deg;E &middot; 13 October 2025.
            GPS tracking data from a 400 m running track validated against 8 weather stations over 18 hours.
          </p>
        </div>
      </div>

      {/* Key Results */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-light text-white mb-8">Key Results</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <MetricCard label="Temperature RMSE" value="2.78" unit="K" color="cyan" />
          <MetricCard label="Pressure RMSE" value="10.98" unit="hPa" color="blue" />
          <MetricCard label="Lyapunov Exponent" value="-0.19" unit="day⁻¹" color="emerald" />
          <MetricCard label="Trajectory Bound" value="0.042" unit="d_max" color="purple" />
          <MetricCard label="Computational Cap." value="10⁴⁰" unit="ops/s" color="amber" />
        </div>
      </section>

      {/* Experimental Design */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">01</span>
          Experimental Design
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Data Sources</h3>
            <ul className="space-y-3 text-gray-400 text-sm font-light">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                2 GPS-equipped smartwatches recording a 400 m track at 05:34 UTC (93 + 48 position fixes, 8 precision levels)
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                8 weather stations spanning 0&ndash;43 km from track centre (Open-Meteo Historical API)
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                Variables: temperature, surface pressure, relative humidity, wind speed, wind direction
              </li>
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Atmospheric Conditions (05:00 UTC)</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Temperature', '7.3°C (280.4 K)'],
                ['Pressure', '964.9 hPa'],
                ['Humidity', '97%'],
                ['Wind', '0.9 m/s at 53°'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-gray-500 text-xs uppercase tracking-wider">{label}</div>
                  <div className="text-white font-mono text-sm mt-1">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Physical Measurement Substrate */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">02</span>
          Physical Measurement Substrate
        </h2>
        <p className="text-gray-400 font-light leading-relaxed mb-6">
          A runner with frontal cross-section A = 0.50 m&sup2; and turbulent wake radius r<sub>w</sub> = 0.75 m
          displaces air along the 397.8 m track, creating a natural measurement substrate.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <ResultTable
            headers={['Quantity', 'Value']}
            rows={[
              ['Frontal volume displaced', '198.9 m³'],
              ['Wake volume displaced', '703.0 m³'],
              ['Molecules displaced (frontal)', '4.96 × 10²⁷'],
              ['Momentum transferred', '1105.5 kg·m/s'],
              ['Computational capacity', '4.96 × 10⁴⁰ ops/s'],
              ['CLT oversampling ratio', '~10²¹'],
            ]}
          />
        </div>
        <p className="text-gray-400 text-sm font-light mt-4">
          The displaced molecules exceed the CLT representative sample (N<sub>rep</sub> ~ 10<sup>6</sup>) by a factor
          of 10<sup>21</sup>, confirming statistically complete measurement.
        </p>
      </section>

      {/* S-Entropy Field */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">03</span>
          S-Entropy Field &amp; Spatial Uniqueness
        </h2>
        <p className="text-gray-400 font-light leading-relaxed mb-6">
          S-entropy coordinates computed at all 8 weather stations at run time confirm:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center">
            <div className="text-emerald-400 font-mono text-xl">2.0 &#x00D7; 10<sup>-4</sup></div>
            <div className="text-gray-400 text-sm font-light mt-2">Minimum pairwise distance</div>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5 text-center">
            <div className="text-blue-400 font-mono text-xl">8 / 8</div>
            <div className="text-gray-400 text-sm font-light mt-2">Unique S-entropy signatures</div>
          </div>
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 text-center">
            <div className="text-purple-400 font-mono text-xl">Monotonic</div>
            <div className="text-gray-400 text-sm font-light mt-2">d_cat vs d_phys relationship</div>
          </div>
        </div>
        <p className="text-gray-400 font-light leading-relaxed">
          Three independent information channels (S<sub>k</sub>, S<sub>t</sub>, S<sub>e</sub>) provide
          non-redundant atmospheric state encoding. The S-entropy field varies measurably even
          along the 400 m GPS track.
        </p>
      </section>

      {/* Temporal Prediction */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">04</span>
          Temporal Prediction
        </h2>
        <p className="text-gray-400 font-light leading-relaxed mb-6">
          Starting from the 05:00 UTC S-entropy state, partition dynamics were evolved forward through 18 hours:
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <ResultTable
            headers={['Metric', 'Value']}
            rows={[
              ['Temperature RMSE', '2.78 K'],
              ['Temperature MAE', '2.58 K'],
              ['Pressure RMSE', '10.98 hPa'],
              ['Pressure MAE', '10.93 hPa'],
              ['Maximum temperature error', '3.85 K (at +15h lead)'],
            ]}
          />
        </div>
        <p className="text-gray-400 text-sm font-light mt-4">
          Temperature RMSE of 2.78 K over 18 hours is comparable to operational NWP models at similar
          lead times, achieved without solving the Navier-Stokes equations — using only bounded operators
          on [0,1]&sup3; with diurnal forcing.
        </p>
      </section>

      {/* Chaos Elimination */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">05</span>
          Chaos Elimination
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <ResultTable
              headers={['Metric', 'Value']}
              rows={[
                ['Max pairwise distance d_max', '0.042'],
                ['Theoretical bound √3', '1.732'],
                ['Effective Lyapunov λ_eff', '-0.19 day⁻¹'],
                ['Lorenz reference λ', '+1.0 day⁻¹'],
              ]}
            />
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 flex flex-col justify-center">
            <p className="text-gray-300 font-light leading-relaxed">
              The effective Lyapunov exponent is <strong className="text-emerald-400">slightly negative</strong> (indicating
              convergent dynamics), confirming the central prediction: reformulation in bounded S-entropy
              space eliminates the exponential divergence that limits conventional weather prediction.
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-6">
          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="text-red-400 font-mono text-2xl">+1.0</div>
              <div className="text-gray-500 text-xs mt-1">Lorenz (conventional)</div>
              <div className="text-red-400/60 text-xs">Exponential divergence</div>
            </div>
            <div className="text-gray-600 text-2xl px-4">&#x2192;</div>
            <div className="text-center flex-1">
              <div className="text-emerald-400 font-mono text-2xl">-0.19</div>
              <div className="text-gray-500 text-xs mt-1">Partition dynamics (ours)</div>
              <div className="text-emerald-400/60 text-xs">Convergent dynamics</div>
            </div>
          </div>
        </div>
      </section>

      {/* Position Recovery */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">
          <span className="text-emerald-400 font-mono text-sm mr-3">06</span>
          Position Recovery
        </h2>
        <p className="text-gray-400 font-light leading-relaxed mb-6">
          The inverse map &#x03A0;<sup>-1</sup> was tested at 7 GPS points with a ~220 m initial offset:
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden mb-6">
          <ResultTable
            headers={['Metric', 'Value']}
            rows={[
              ['Mean position error', '261.7 m'],
              ['Median position error', '136.7 m'],
              ['Minimum error', '64.7 m'],
              ['Maximum error', '1016.8 m'],
              ['Jacobian condition number κ(J_Π)', '5665'],
            ]}
          />
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
          <p className="text-gray-300 font-light leading-relaxed">
            The errors reflect sparse station coverage (nearest station at 14 km), limiting
            the resolvable S-entropy gradient to ~10<sup>-9</sup> m<sup>-1</sup> versus the
            theoretical ~10<sup>-5</sup> m<sup>-1</sup>. The framework predicts <strong className="text-amber-400">~1 m
            position recovery</strong> with stations at ~1 km spacing.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        <div className="section-divider mb-12" />
        <div className="flex flex-wrap gap-4">
          <Link href="/framework">
            <a className="px-6 py-3 bg-white/5 text-gray-300 rounded-xl font-light hover:bg-white/10 transition-all border border-white/10">
              &larr; Theoretical Framework
            </a>
          </Link>
          <Link href="/api-docs">
            <a className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-light hover:bg-cyan-500/30 transition-all border border-cyan-500/30">
              API Documentation &rarr;
            </a>
          </Link>
          <Link href="/research">
            <a className="px-6 py-3 bg-white/5 text-gray-300 rounded-xl font-light hover:bg-white/10 transition-all border border-white/10">
              Read the Full Paper
            </a>
          </Link>
        </div>
      </section>

    </Layout>
  );
}
