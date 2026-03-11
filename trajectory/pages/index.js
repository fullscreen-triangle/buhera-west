import React from "react";
import Layout from "../src/layout/layout";
import Link from "next/link";

export default function Home() {
  return (
    <Layout>
      {/* Hero Section — customize this */}
      <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-blue-950/20 to-gray-950" />

        <div className="relative text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center mx-auto mb-6">
              <span className="text-white font-bold text-2xl">BW</span>
            </div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-light text-white leading-tight mb-6">
            Buhera-West
          </h1>
          <p className="text-xl sm:text-2xl text-gray-400 font-light mb-4">
            Atmospheric Trajectory Completion
          </p>
          <p className="text-gray-500 font-light max-w-2xl mx-auto mb-12 leading-relaxed">
            Deterministic weather prediction via molecular categorical computation
            in bounded phase space. Breaking the 10-day forecast barrier.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/framework">
              <a className="px-8 py-3 bg-cyan-500/20 text-cyan-400 rounded-xl font-light hover:bg-cyan-500/30 transition-all border border-cyan-500/30 text-sm">
                Explore the Framework
              </a>
            </Link>
            <Link href="/weather">
              <a className="px-8 py-3 bg-white/5 text-gray-300 rounded-xl font-light hover:bg-white/10 transition-all border border-white/10 text-sm">
                Live Demo
              </a>
            </Link>
            <Link href="/research">
              <a className="px-8 py-3 bg-white/5 text-gray-300 rounded-xl font-light hover:bg-white/10 transition-all border border-white/10 text-sm">
                Research
              </a>
            </Link>
          </div>
        </div>
      </div>

      {/* Key numbers */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '2.78 K', label: 'Temperature RMSE', sub: '18-hour forecast' },
            { value: 'λ = -0.19', label: 'Lyapunov exponent', sub: 'Chaos eliminated' },
            { value: '10⁴⁰', label: 'Natural ops/s', sub: 'Atmospheric compute' },
            { value: '[0,1]³', label: 'Bounded space', sub: 'S-entropy domain' },
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-2xl sm:text-3xl font-light text-white font-mono">{stat.value}</div>
              <div className="text-gray-400 text-sm font-light mt-2">{stat.label}</div>
              <div className="text-gray-600 text-xs font-light mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { href: '/framework', title: 'Theoretical Framework', desc: 'From one axiom to deterministic prediction — the complete mathematical chain.', color: 'cyan' },
            { href: '/validation', title: 'Empirical Validation', desc: 'Munich experiment: 8 stations, 18 hours, chaos eliminated.', color: 'emerald' },
            { href: '/api-docs', title: 'API for Researchers', desc: 'S-entropy computation, partition dynamics, and weather reconstruction endpoints.', color: 'purple' },
            { href: '/research', title: 'Publications', desc: 'The full paper, methodology, falsifiable predictions, and references.', color: 'blue' },
            { href: '/investors', title: 'For Investors', desc: 'Breaking the 10-day barrier — market opportunity and roadmap.', color: 'amber' },
            { href: '/weather', title: 'Live 3D Demo', desc: 'Interactive weather visualization powered by the framework.', color: 'cyan' },
          ].map((card, i) => {
            const borderColor = {
              cyan: 'hover:border-cyan-500/30',
              emerald: 'hover:border-emerald-500/30',
              purple: 'hover:border-purple-500/30',
              blue: 'hover:border-blue-500/30',
              amber: 'hover:border-amber-500/30',
            }[card.color];
            return (
              <Link key={i} href={card.href}>
                <a className={`bg-white/5 border border-white/10 rounded-xl p-6 card-hover ${borderColor} block`}>
                  <h3 className="text-white font-medium mb-2">{card.title}</h3>
                  <p className="text-gray-400 text-sm font-light">{card.desc}</p>
                </a>
              </Link>
            );
          })}
        </div>
      </section>
    </Layout>
  );
}
