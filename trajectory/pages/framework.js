import React from 'react';
import Layout from '../src/layout/layout';
import Link from 'next/link';

// Reusable section component
function Section({ id, children, className = '' }) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

function TheoremCard({ title, children, color = 'cyan' }) {
  const borderColor = {
    cyan: 'border-cyan-500/30',
    blue: 'border-blue-500/30',
    purple: 'border-purple-500/30',
    emerald: 'border-emerald-500/30',
  }[color];
  const bgColor = {
    cyan: 'bg-cyan-500/5',
    blue: 'bg-blue-500/5',
    purple: 'bg-purple-500/5',
    emerald: 'bg-emerald-500/5',
  }[color];

  return (
    <div className={`${bgColor} border ${borderColor} rounded-xl p-6 my-6`}>
      <h4 className="text-white font-medium text-sm uppercase tracking-wider mb-3">{title}</h4>
      <div className="text-gray-300 font-light leading-relaxed">{children}</div>
    </div>
  );
}

export default function Framework() {
  return (
    <Layout title="Theoretical Framework" description="The mathematical foundation of atmospheric trajectory completion — from bounded phase space to deterministic weather prediction.">

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/50 to-gray-950" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <p className="text-cyan-400 text-sm font-medium tracking-widest uppercase mb-4">Theoretical Foundation</p>
          <h1 className="text-4xl sm:text-5xl font-light text-white leading-tight mb-6">
            Atmospheric Trajectory<br />
            <span className="gradient-text font-normal">Completion</span>
          </h1>
          <p className="text-gray-400 text-lg font-light max-w-2xl leading-relaxed">
            A complete mathematical framework for deterministic weather prediction, derived from a single axiom.
            The chain proceeds from boundedness through ten theorems to arrive at chaos-free atmospheric dynamics.
          </p>
        </div>
      </div>

      {/* Navigation sidebar / Table of contents */}
      <Section>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-white text-sm font-medium mb-4">Contents</h3>
              <nav className="space-y-2">
                {[
                  ['axiom', '1. The Axiom'],
                  ['partition', '2. Partition Coordinates'],
                  ['triple', '3. Triple Equivalence'],
                  ['sentropy', '4. S-Entropy'],
                  ['commutation', '5. Commutation'],
                  ['identity', '6. Fundamental Identity'],
                  ['duality', '7. Oscillator-Processor'],
                  ['bijection', '8. Position Bijection'],
                  ['dynamics', '9. Partition Dynamics'],
                  ['completion', '10. Trajectory Completion'],
                ].map(([id, label]) => (
                  <a key={id} href={`#${id}`} className="block text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 space-y-16">

            {/* 1. Axiom */}
            <div id="axiom">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">01</span>
                The Bounded Phase Space Law
              </h2>
              <TheoremCard title="Axiom" color="cyan">
                <p className="text-lg italic">
                  Every physical system occupies a bounded region of phase space that admits hierarchical partition
                  into nested subregions of well-defined capacity.
                </p>
              </TheoremCard>
              <p className="text-gray-400 font-light leading-relaxed mt-4">
                This single axiom is the foundation of the entire framework. From it, the complete chain of results
                follows through rigorous mathematical derivation. The key insight is that the atmosphere is not
                an unbounded fluid on &#x211D;<sup>6N</sup> (where N ~ 10<sup>44</sup>), but a bounded physical system
                whose state space admits hierarchical partition.
              </p>
              <p className="text-gray-400 font-light leading-relaxed mt-3">
                The conventional formulation on unbounded phase space is what introduces chaos — the positive
                Lyapunov exponent &#x03BB; &#x2248; 1.0 day<sup>-1</sup> that limits weather prediction to ~10 days.
                By reformulating on bounded space, this chaos is eliminated at the mathematical level.
              </p>
            </div>

            {/* 2. Partition Coordinates */}
            <div id="partition">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">02</span>
                Partition Coordinates
              </h2>
              <p className="text-gray-400 font-light leading-relaxed">
                Physical states are addressed by quantum numbers (n, l, m, s) with principal quantum number n
                determining the partition level capacity:
              </p>
              <div className="equation my-6 text-center">
                <span className="text-cyan-400 font-mono text-xl">C(n) = 2n&sup2;</span>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                This capacity formula, familiar from atomic physics, is here derived purely from boundedness
                and the requirement for nested, non-overlapping partitions. It establishes the hierarchical
                addressing scheme that makes categorical observation possible.
              </p>
            </div>

            {/* 3. Triple Equivalence */}
            <div id="triple">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">03</span>
                The Triple Equivalence
              </h2>
              <TheoremCard title="Theorem" color="blue">
                <p>The following three descriptions of bounded physical systems are categorically equivalent:</p>
                <ol className="list-decimal list-inside mt-3 space-y-2">
                  <li><strong className="text-white">Oscillation</strong> — Every bounded system oscillates with frequency &#x03C9;<sub>n,l</sub></li>
                  <li><strong className="text-white">Category</strong> — Each state occupies a unique address (n, l, m, s) in a hierarchical structure</li>
                  <li><strong className="text-white">Partition</strong> — The state space admits a nested partition with capacity C(n) = 2n&sup2;</li>
                </ol>
              </TheoremCard>
              <p className="text-gray-400 font-light leading-relaxed mt-4">
                All three yield the same entropy: <span className="font-mono text-cyan-400">S = k<sub>B</sub> M ln(n)</span>,
                where M is the number of active modes. This equivalence means that measuring oscillation frequencies
                is identical to reading categorical addresses — which is identical to locating a state in the partition.
              </p>
            </div>

            {/* 4. S-Entropy Coordinates */}
            <div id="sentropy">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">04</span>
                S-Entropy Coordinates
              </h2>
              <p className="text-gray-400 font-light leading-relaxed mb-6">
                The atmospheric state at any point is encoded by three coordinates
                <span className="font-mono text-cyan-400"> &#x03A3; = (S<sub>k</sub>, S<sub>t</sub>, S<sub>e</sub>) &#x2208; [0,1]&sup3;</span>:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                  <div className="text-emerald-400 font-mono text-lg mb-2">S<sub>k</sub></div>
                  <div className="text-white text-sm font-medium mb-2">Configurational</div>
                  <p className="text-gray-400 text-sm font-light">
                    Molecular composition and vibrational state populations via Boltzmann factors
                    for N&#x2082;, O&#x2082;, and H&#x2082;O, plus mixing entropy.
                  </p>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                  <div className="text-blue-400 font-mono text-lg mb-2">S<sub>t</sub></div>
                  <div className="text-white text-sm font-medium mb-2">Velocity</div>
                  <p className="text-gray-400 text-sm font-light">
                    Encodes the velocity distribution — both the Maxwell-Boltzmann thermal velocity
                    and the bulk wind speed.
                  </p>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5">
                  <div className="text-purple-400 font-mono text-lg mb-2">S<sub>e</sub></div>
                  <div className="text-white text-sm font-medium mb-2">Energy</div>
                  <p className="text-gray-400 text-sm font-light">
                    Total molecular energy E = (5/2)k<sub>B</sub>T, normalized linearly between
                    atmospheric temperature bounds (180 K to 330 K).
                  </p>
                </div>
              </div>
              <p className="text-gray-400 font-light leading-relaxed mt-4">
                The boundedness <span className="font-mono text-cyan-400">&#x03A3; &#x2208; [0,1]&sup3;</span> is
                guaranteed by construction through the normalization. This is the key to eliminating chaos.
              </p>
            </div>

            {/* 5. Commutation */}
            <div id="commutation">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">05</span>
                Categorical-Physical Commutation
              </h2>
              <TheoremCard title="Theorem" color="purple">
                <p>
                  The categorical observation operator &#x00D4;<sub>cat</sub> and the physical observation
                  operator &#x00D4;<sub>phys</sub> commute:
                </p>
                <div className="equation my-4 text-center">
                  <span className="text-purple-400 font-mono text-lg">[&#x00D4;<sub>cat</sub>, &#x00D4;<sub>phys</sub>] = 0</span>
                </div>
                <p className="mt-3">
                  This enables <em className="text-white">zero-backaction measurement</em>: reading a molecular state via
                  its categorical address does not perturb its physical state, circumventing Heisenberg
                  constraints for categorical observables.
                </p>
              </TheoremCard>
            </div>

            {/* 6. Fundamental Identity */}
            <div id="identity">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">06</span>
                The Fundamental Identity
              </h2>
              <TheoremCard title="Theorem — Fundamental Identity" color="emerald">
                <p>For any physical system in bounded phase space:</p>
                <div className="equation my-4 text-center">
                  <span className="text-emerald-400 font-mono text-lg">Observation &#x2261; Computing &#x2261; Processing</span>
                </div>
                <p className="mt-3">
                  These three operations are not analogous but <em className="text-white">identical</em>: each resolves
                  a categorical address in the hierarchical partition structure.
                </p>
              </TheoremCard>
            </div>

            {/* 7. Oscillator-Processor Duality */}
            <div id="duality">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">07</span>
                Oscillator-Processor Duality
              </h2>
              <p className="text-gray-400 font-light leading-relaxed">
                Every atmospheric molecule is simultaneously an oscillator and a processor:
              </p>
              <div className="equation my-6 text-center">
                <span className="text-cyan-400 font-mono text-xl">&#x03C9; &#x2261; R<sub>compute</sub></span>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                A single air parcel of 10 cm&sup3; at standard conditions contains ~2.5 &#x00D7; 10<sup>22</sup> molecular
                processors, each operating at ~10<sup>13</sup> ops/s, yielding a natural computational capacity
                of ~10<sup>35</sup> ops/s — exceeding all human-built supercomputers by 17 orders of magnitude.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 mt-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-light text-cyan-400">10<sup className="text-lg">22</sup></div>
                    <div className="text-gray-400 text-sm font-light mt-1">molecules per 10 cm&sup3;</div>
                  </div>
                  <div>
                    <div className="text-3xl font-light text-blue-400">10<sup className="text-lg">35</sup></div>
                    <div className="text-gray-400 text-sm font-light mt-1">ops/s natural capacity</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 8. Position-Partition Bijection */}
            <div id="bijection">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">08</span>
                Position-Partition Bijection
              </h2>
              <TheoremCard title="Theorem" color="blue">
                <p>
                  There exists a bijection <span className="font-mono text-blue-400">&#x03A0;: &#x211D;&sup3; &#x2192; [0,1]&sup3;</span> mapping
                  spatial position to S-entropy coordinates, provided the Jacobian J<sub>&#x03A0;</sub> is non-degenerate.
                </p>
              </TheoremCard>
              <p className="text-gray-400 font-light leading-relaxed mt-4">
                The inverse map <span className="font-mono text-cyan-400">&#x03A0;<sup>-1</sup>: [0,1]&sup3; &#x2192; &#x211D;&sup3;</span> recovers
                physical position from an S-entropy measurement via Newton-Raphson iteration on the overdetermined
                system. This means: <em className="text-white">measure the air, know the location</em>.
              </p>
            </div>

            {/* 9. Partition Dynamics */}
            <div id="dynamics">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">09</span>
                Partition Dynamics
              </h2>
              <p className="text-gray-400 font-light leading-relaxed mb-4">
                Atmospheric evolution is governed by bounded operators on [0,1]&sup3;:
              </p>
              <div className="equation my-6 space-y-3">
                <div className="text-cyan-400 font-mono text-sm">
                  dS<sub>e</sub>/dt = &#x03B1;<sub>solar</sub> F<sub>&#x2609;</sub>(t) - &#x03B1;<sub>rad</sub>(S<sub>e</sub> - S<sub>e</sub><sup>night</sup>)
                </div>
                <div className="text-blue-400 font-mono text-sm">
                  dS<sub>k</sub>/dt = -&#x03B1;<sub>k</sub>(S<sub>k</sub> - S<sub>k</sub><sup>eq</sup>) + &#x03B2;<sub>k</sub> Q<sub>moisture</sub>(t)
                </div>
                <div className="text-purple-400 font-mono text-sm">
                  dS<sub>t</sub>/dt = -&#x03B1;<sub>t</sub>(S<sub>t</sub> - S<sub>t</sub><sup>eq</sup>) + &#x03B2;<sub>t</sub> &#x2207;P
                </div>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                Since the domain is compact ([0,1]&sup3;), the Lyapunov exponent satisfies:
              </p>
              <div className="equation my-6 text-center">
                <span className="text-emerald-400 font-mono text-xl">&#x03BB;<sub>partition</sub> &#x2192; 0</span>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                Chaos is eliminated by construction. This is not a statistical approximation — it is a
                mathematical consequence of operating on bounded space.
              </p>
            </div>

            {/* 10. Trajectory Completion */}
            <div id="completion">
              <h2 className="text-2xl font-light text-white mb-6">
                <span className="text-cyan-400 font-mono text-sm mr-3">10</span>
                Trajectory Completion
              </h2>
              <p className="text-gray-400 font-light leading-relaxed">
                Given a partial S-entropy measurement from N molecular samplings
                (with N &#x226B; N<sub>CLT</sub> ~ 10<sup>6</sup>), the completed trajectory is:
              </p>
              <div className="equation my-6 text-center">
                <span className="text-cyan-400 font-mono text-lg">
                  &#x03A3;* = &#x03A3;&#x0305; + &#x27E8;v<sub>&#x03A3;</sub>&#x27E9; / (1 - r)
                </span>
              </div>
              <p className="text-gray-400 font-light leading-relaxed">
                where r = 1/3 is the partition contraction ratio and the geometric series converges because
                |r| &lt; 1 in the bounded space. The convergence is guaranteed — not hoped for.
              </p>
            </div>

            {/* CTA */}
            <div className="section-divider" />
            <div className="pt-8 flex flex-wrap gap-4">
              <Link href="/validation">
                <a className="px-6 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-light hover:bg-cyan-500/30 transition-all border border-cyan-500/30">
                  See Empirical Validation &rarr;
                </a>
              </Link>
              <Link href="/research">
                <a className="px-6 py-3 bg-white/5 text-gray-300 rounded-xl font-light hover:bg-white/10 transition-all border border-white/10">
                  Read the Full Paper
                </a>
              </Link>
            </div>
          </div>
        </div>
      </Section>

    </Layout>
  );
}
