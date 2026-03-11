import React from 'react';
import Layout from '../src/layout/layout';
import Link from 'next/link';

function StatBlock({ value, label, sublabel }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-light text-white mb-1">{value}</div>
      <div className="text-gray-400 text-sm font-light">{label}</div>
      {sublabel && <div className="text-gray-600 text-xs font-light mt-1">{sublabel}</div>}
    </div>
  );
}

function TimelineItem({ phase, title, items, active }) {
  return (
    <div className={`relative pl-8 pb-10 border-l ${active ? 'border-cyan-500/50' : 'border-white/10'}`}>
      <div className={`absolute left-0 top-0 w-4 h-4 rounded-full -translate-x-[9px] ${active ? 'bg-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-gray-700 border border-gray-600'}`} />
      <div className="text-gray-500 text-xs font-mono uppercase tracking-wider mb-1">{phase}</div>
      <h3 className="text-white font-medium text-lg mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-gray-400 text-sm font-light flex items-start">
            <span className="text-cyan-400/60 mr-2 mt-0.5">&#x2022;</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Investors() {
  return (
    <Layout title="For Investors" description="Investment opportunity in deterministic weather prediction technology — eliminating the 10-day forecast barrier.">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/20 to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-4">Investment Opportunity</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">
            Breaking the<br />
            <span className="gradient-text font-normal">10-Day Barrier</span>
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-2xl leading-relaxed">
            Weather prediction has been limited to ~10 days for 60 years. Our framework eliminates
            this fundamental barrier through a mathematical reformulation — not more compute power.
          </p>
        </div>
      </div>

      {/* The Problem */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-light text-white mb-8">The Problem</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
            <div className="text-red-400 text-3xl font-light mb-2">10 days</div>
            <div className="text-white text-sm font-medium mb-2">Current forecast limit</div>
            <p className="text-gray-400 text-sm font-light">
              Despite 70 years of progress and billion-dollar supercomputers, deterministic weather
              prediction remains fundamentally limited to ~10 days.
            </p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
            <div className="text-red-400 text-3xl font-light mb-2">$600B+</div>
            <div className="text-white text-sm font-medium mb-2">Annual weather-related losses</div>
            <p className="text-gray-400 text-sm font-light">
              Agriculture, insurance, energy, logistics, and disaster preparedness all suffer from
              the inability to predict weather beyond 10 days.
            </p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
            <div className="text-red-400 text-3xl font-light mb-2">&#x03BB; = +1.0</div>
            <div className="text-white text-sm font-medium mb-2">Lorenz chaos barrier</div>
            <p className="text-gray-400 text-sm font-light">
              The positive Lyapunov exponent of the Lorenz system causes exponential error growth,
              making extended prediction mathematically impossible — in the conventional framework.
            </p>
          </div>
        </div>
      </section>

      {/* Our Solution */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Our Solution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
            <div className="text-emerald-400 text-3xl font-light mb-2">&#x03BB; = -0.19</div>
            <div className="text-white text-sm font-medium mb-2">Chaos eliminated</div>
            <p className="text-gray-400 text-sm font-light">
              Our partition dynamics operates on bounded [0,1]&sup3; space, yielding a negative
              Lyapunov exponent. Chaos is eliminated by mathematical construction, not brute force.
            </p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
            <div className="text-emerald-400 text-3xl font-light mb-2">2.78 K</div>
            <div className="text-white text-sm font-medium mb-2">Temperature accuracy</div>
            <p className="text-gray-400 text-sm font-light">
              RMSE of 2.78 K over 18 hours, comparable to operational NWP models, achieved without
              solving Navier-Stokes equations.
            </p>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
            <div className="text-emerald-400 text-3xl font-light mb-2">10<sup>40</sup></div>
            <div className="text-white text-sm font-medium mb-2">Natural ops/s</div>
            <p className="text-gray-400 text-sm font-light">
              The atmosphere itself is the computer — 10<sup>40</sup> operations per second of natural
              computational capacity. We read the result rather than simulate it.
            </p>
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Market Opportunity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-8">
          <StatBlock value="$10B+" label="Weather services market" sublabel="Growing 8% annually" />
          <StatBlock value="$2.5T" label="Weather-sensitive GDP" sublabel="Agriculture, energy, logistics" />
          <StatBlock value="5B+" label="People affected" sublabel="Climate-dependent livelihoods" />
          <StatBlock value="15+" label="Day forecast target" sublabel="vs current 10-day limit" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Target Markets</h3>
            <ul className="space-y-3 text-gray-400 text-sm font-light">
              <li className="flex items-start">
                <span className="text-amber-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Precision Agriculture</strong> — Extended forecasts for planting, irrigation, and harvest decisions in Sub-Saharan Africa</div>
              </li>
              <li className="flex items-start">
                <span className="text-amber-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Insurance &amp; Reinsurance</strong> — Parametric weather insurance with reduced basis risk through better predictions</div>
              </li>
              <li className="flex items-start">
                <span className="text-amber-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Energy Trading</strong> — Improved wind and solar forecasting for renewable energy markets</div>
              </li>
              <li className="flex items-start">
                <span className="text-amber-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Disaster Preparedness</strong> — Earlier warning systems for extreme weather events</div>
              </li>
            </ul>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-white font-medium mb-4">Competitive Advantage</h3>
            <ul className="space-y-3 text-gray-400 text-sm font-light">
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Novel mathematics</strong> — Not incremental; a fundamentally new approach to atmospheric dynamics</div>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Low compute cost</strong> — Bounded operators on [0,1]&sup3; vs solving 10<sup>44</sup>-dimensional PDEs</div>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">Validated theory</strong> — Empirically tested against real meteorological observations</div>
              </li>
              <li className="flex items-start">
                <span className="text-cyan-400 mr-2 mt-0.5">&#x2022;</span>
                <div><strong className="text-white">API-first model</strong> — SaaS delivery of prediction services to existing weather-dependent businesses</div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Roadmap</h2>
        <div className="max-w-2xl">
          <TimelineItem
            phase="Phase 1 — Current"
            title="Theoretical Validation"
            active={true}
            items={[
              'Single-axiom theoretical framework published',
              'Munich validation experiment completed (2.78 K RMSE)',
              'Chaos elimination demonstrated (λ = -0.19)',
              'API prototype and documentation',
              'Open-source validation pipeline',
            ]}
          />
          <TimelineItem
            phase="Phase 2 — Next"
            title="Multi-Site Validation"
            active={false}
            items={[
              'Deploy dense weather station network (~1 km spacing)',
              'Validate sub-metre S-entropy positioning',
              'Extend temporal prediction to 15+ days',
              'Cross-continental validation (Africa, Europe, Americas)',
              'Research partnerships with meteorological agencies',
            ]}
          />
          <TimelineItem
            phase="Phase 3"
            title="Operational Deployment"
            active={false}
            items={[
              'Production API with global coverage',
              'Precision agriculture integrations for Southern Africa',
              'Insurance and energy sector pilot programs',
              'Real-time S-entropy field monitoring network',
              'Terrain classification and geological applications',
            ]}
          />
          <TimelineItem
            phase="Phase 4"
            title="Platform Scale"
            active={false}
            items={[
              'Global S-entropy field infrastructure',
              'Hardware spectrometry (computer-as-sensor)',
              'Multi-domain environmental intelligence platform',
              'Licensing to national meteorological services',
            ]}
          />
        </div>
      </section>

      {/* Team / Origin */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Origin</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-gray-400 font-light leading-relaxed">
            Buhera-West Geosciences originates from the intersection of atmospheric science,
            information theory, and categorical mathematics. The platform is named after the
            Buhera district in Zimbabwe, reflecting our commitment to building environmental
            intelligence infrastructure for regions that need it most — starting with agricultural
            decision support for Southern Africa, where weather prediction has the highest
            impact on human livelihoods.
          </p>
          <p className="text-gray-400 font-light leading-relaxed mt-4">
            The default monitoring coordinates (-19.26&deg;S, 31.50&deg;E) sit at the heart of
            a region where 70% of the population depends on rain-fed agriculture, and where
            extended weather forecasting can mean the difference between food security and famine.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        <div className="section-divider mb-12" />
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-light text-white mb-4">Interested in Learning More?</h2>
          <p className="text-gray-400 font-light mb-6 max-w-lg mx-auto">
            We are seeking research partnerships and seed investment to accelerate
            multi-site validation and operational deployment.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/research">
              <a className="px-6 py-3 bg-white/10 text-white rounded-xl font-light hover:bg-white/20 transition-all border border-white/20">
                Review the Science
              </a>
            </Link>
            <Link href="/validation">
              <a className="px-6 py-3 bg-white/10 text-white rounded-xl font-light hover:bg-white/20 transition-all border border-white/20">
                See Validation Data
              </a>
            </Link>
            <Link href="/weather">
              <a className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-light hover:bg-cyan-500/30 transition-all border border-cyan-500/30">
                Try Live Demo
              </a>
            </Link>
          </div>
        </div>
      </section>

    </Layout>
  );
}
