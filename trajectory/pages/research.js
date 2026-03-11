import React from 'react';
import Layout from '../src/layout/layout';
import Link from 'next/link';

function PaperCard({ title, authors, venue, year, abstract, links }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 card-hover">
      <h3 className="text-white font-medium text-lg mb-2">{title}</h3>
      <p className="text-cyan-400 text-sm font-light mb-1">{authors}</p>
      <p className="text-gray-500 text-sm font-light mb-4">{venue} &middot; {year}</p>
      <p className="text-gray-400 text-sm font-light leading-relaxed mb-4">{abstract}</p>
      <div className="flex flex-wrap gap-2">
        {links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/5 text-gray-300 text-xs font-mono rounded-lg border border-white/10 hover:bg-white/10 hover:text-cyan-400 transition-all"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ReferenceItem({ authors, year, title, venue }) {
  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <p className="text-gray-300 text-sm font-light">
        {authors} ({year}). <em className="text-gray-400">{title}</em>. {venue}
      </p>
    </div>
  );
}

export default function Research() {
  return (
    <Layout title="Research" description="Academic papers, methodology, and resources for the atmospheric trajectory completion framework.">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/30 to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <p className="text-indigo-400 text-sm font-medium tracking-widest uppercase mb-4">Academic Research</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">
            Publications &amp;<br />
            <span className="gradient-text font-normal">Resources</span>
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-2xl leading-relaxed">
            The complete scientific foundation, from theoretical derivations to empirical validation.
            All results are reproducible from the published code and data.
          </p>
        </div>
      </div>

      {/* Primary Paper */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-light text-white mb-8">Primary Publication</h2>
        <PaperCard
          title="Atmospheric Trajectory Completion: Deterministic Weather and Terrain Prediction via Molecular Categorical Computation in Bounded Phase Space"
          authors="Buhera-West Geosciences"
          venue="Preprint"
          year="2025"
          abstract="We present a theoretical framework and empirical validation for atmospheric trajectory completion — a method for deterministic weather prediction that eliminates the chaotic divergence inherent in conventional Navier-Stokes-based numerical weather prediction. From a single axiom (the Bounded Phase Space Law), we derive partition coordinates, S-entropy encoding, the Fundamental Identity, oscillator-processor duality, and the Position-Partition Bijection. Validated against 8 Munich weather stations: temperature RMSE 2.78 K, effective Lyapunov exponent λ = -0.19 day⁻¹."
          links={[
            { label: 'PDF', href: '#' },
            { label: 'LaTeX Source', href: '#' },
            { label: 'Validation Code', href: '#' },
            { label: 'Dataset', href: '#' },
          ]}
        />
      </section>

      {/* Methodology */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Methodology</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-cyan-400 font-mono text-sm mb-3">Theoretical Chain</div>
            <ol className="space-y-2 text-gray-400 text-sm font-light">
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">1.</span> Bounded Phase Space Law (axiom)</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">2.</span> Partition coordinates (n, l, m, s)</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">3.</span> Triple Equivalence theorem</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">4.</span> S-entropy coordinates [0,1]&sup3;</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">5.</span> Categorical-physical commutation</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">6.</span> Fundamental Identity</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">7.</span> Oscillator-processor duality</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">8.</span> Position-Partition Bijection</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">9.</span> Partition dynamics on [0,1]&sup3;</li>
              <li className="flex items-start"><span className="text-cyan-400/60 mr-2 font-mono text-xs">10.</span> Trajectory completion</li>
            </ol>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-emerald-400 font-mono text-sm mb-3">Validation Pipeline</div>
            <ol className="space-y-2 text-gray-400 text-sm font-light">
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">1.</span> GPS track acquisition (dual smartwatch, 8 precision levels)</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">2.</span> Multi-station weather data (Open-Meteo API, 8 stations)</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">3.</span> Air displacement computation</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">4.</span> S-entropy field analysis</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">5.</span> Jacobian &amp; inverse map testing</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">6.</span> 18-hour temporal prediction</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">7.</span> Lyapunov exponent estimation</li>
              <li className="flex items-start"><span className="text-emerald-400/60 mr-2 font-mono text-xs">8.</span> Spatial cross-validation</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Falsifiable Predictions */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Falsifiable Predictions</h2>
        <p className="text-gray-400 font-light leading-relaxed mb-6">
          The framework makes specific testable claims. Any of these, if disproven, would invalidate
          the theory:
        </p>
        <div className="space-y-4">
          {[
            {
              claim: 'Forecast skill extension beyond 10 days',
              detail: 'Partition dynamics should achieve ACC > 0.6 at day 15 (vs day 10 for ECMWF IFS)',
              status: 'Testable',
            },
            {
              claim: 'Molecular frequency prediction',
              detail: 'Harmonic coincidence networks should predict unknown vibrational modes to within 1% from partial spectra',
              status: 'Testable',
            },
            {
              claim: 'Sub-metre atmospheric positioning',
              detail: 'S-entropy-based positioning should achieve ~1 cm accuracy with dense station coverage (~1 km spacing)',
              status: 'Testable',
            },
            {
              claim: 'Terrain classification from air',
              detail: 'Near-surface S-entropy measurements should distinguish surface types (rock, vegetation, water, urban) with > 90% accuracy',
              status: 'Testable',
            },
            {
              claim: 'Hardware-molecular harmonic coincidences',
              detail: 'Computer oscillator timing jitter should show statistically significant coincidences with ambient molecular vibrational frequencies',
              status: 'Testable',
            },
          ].map((pred, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4">
              <div className="text-cyan-400 font-mono text-sm mt-0.5">{i + 1}.</div>
              <div className="flex-1">
                <div className="text-white font-medium text-sm mb-1">{pred.claim}</div>
                <div className="text-gray-400 text-sm font-light">{pred.detail}</div>
              </div>
              <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-mono rounded border border-amber-500/20 shrink-0">
                {pred.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Key References */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-8">Key References</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <ReferenceItem authors="Lorenz, E. N." year="1963" title="Deterministic nonperiodic flow" venue="Journal of the Atmospheric Sciences, 20(2), 130-141." />
          <ReferenceItem authors="Boltzmann, L." year="1896" title="Vorlesungen uber Gastheorie" venue="J. A. Barth, Leipzig." />
          <ReferenceItem authors="Shannon, C. E." year="1948" title="A mathematical theory of communication" venue="Bell System Technical Journal, 27, 379-423." />
          <ReferenceItem authors="Jaynes, E. T." year="1957" title="Information theory and statistical mechanics" venue="Physical Review, 106(4), 620-630." />
          <ReferenceItem authors="Landauer, R." year="1961" title="Irreversibility and heat generation in the computing process" venue="IBM Journal of Research and Development, 5(3), 183-191." />
          <ReferenceItem authors="Bauer, P., Thorpe, A., & Brunet, G." year="2015" title="The quiet revolution of numerical weather prediction" venue="Nature, 525(7567), 47-55." />
          <ReferenceItem authors="Lam, R., et al." year="2023" title="Learning skillful medium-range global weather forecasting" venue="Science, 382(6677), 1416-1421." />
          <ReferenceItem authors="Kalnay, E." year="2003" title="Atmospheric Modeling, Data Assimilation and Predictability" venue="Cambridge University Press." />
          <ReferenceItem authors="Palmer, T. N." year="2000" title="Predicting uncertainty in forecasts of weather and climate" venue="Reports on Progress in Physics, 63(2), 71-116." />
        </div>
      </section>

      {/* Reproducibility */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        <div className="section-divider mb-12" />
        <h2 className="text-2xl font-light text-white mb-6">Reproducibility</h2>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-gray-400 font-light leading-relaxed mb-4">
            All validation results can be reproduced from the published repository:
          </p>
          <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm text-gray-300 space-y-1">
            <div className="text-gray-500"># Clone and run validation</div>
            <div>git clone https://github.com/buhera-west/buhera-west.git</div>
            <div>cd publication/atmospheric-trajectory-completion/validation</div>
            <div>python fetch_weather.py</div>
            <div>python validate_trajectory_completion.py</div>
            <div>python generate_panels.py</div>
          </div>
          <p className="text-gray-500 text-xs font-light mt-4">
            Requirements: Python 3.12+, NumPy, SciPy, Matplotlib, Requests
          </p>
        </div>
      </section>

    </Layout>
  );
}
