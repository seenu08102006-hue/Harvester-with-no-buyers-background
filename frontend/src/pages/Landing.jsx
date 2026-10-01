import React from 'react';
import { Link } from 'react-router-dom';
import { Sprout, ArrowRight, TrendingUp, Shield, Zap, Users, Truck, Brain } from 'lucide-react';

const features = [
  {
    icon: TrendingUp,
    title: 'Smart Matching',
    description: 'AI matches changing harvest quantities with recurring buyer demand automatically.',
  },
  {
    icon: Shield,
    title: 'Fair Allocation',
    description: 'Transparent fairness mechanism ensures small producers receive collection opportunities.',
  },
  {
    icon: Zap,
    title: 'Real-time Coordination',
    description: 'Instantly adjust allocations when harvest estimates change after sorting.',
  },
];

const stats = [
  { icon: Users, label: 'Farmers Connected', value: '5+' },
  { icon: Truck, label: 'Transport Optimized', value: '93%' },
  { icon: Brain, label: 'AI-Powered', value: 'Yes' },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative gradient-hero overflow-hidden" id="hero-section">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(74, 222, 128, 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(34, 197, 94, 0.2) 0%, transparent 50%)',
          }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                <Sprout className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 animate-slide-up tracking-tight">
              Harvest
              <span className="text-primary-400">Link</span>
              {' '}AI
            </h1>

            {/* Tagline */}
            <p className="text-xl md:text-2xl text-primary-200/90 mb-4 max-w-2xl mx-auto animate-slide-up font-light" style={{ animationDelay: '100ms' }}>
              Turning scattered harvests into coordinated deliveries.
            </p>

            <p className="text-base text-primary-300/70 mb-10 max-w-xl mx-auto animate-slide-up" style={{ animationDelay: '200ms' }}>
              AI-powered coordination for perishable tomato supply chains. Match uncertain supply with recurring demand, limited transport, and fair allocation — all in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <Link
                to="/dashboard"
                className="group flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary-800 font-semibold text-base hover:bg-primary-50 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                id="cta-get-started"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/coordination"
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl border-2 border-primary-400/40 text-primary-200 font-semibold text-base hover:bg-primary-500/10 hover:border-primary-400/60 transition-all duration-200"
                id="cta-view-demo"
              >
                <Brain className="w-4 h-4" />
                View AI Demo
              </Link>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 80V40C240 0 480 0 720 40C960 80 1200 80 1440 40V80H0Z" fill="#fafaf9" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-surface-50" id="features-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary-600 tracking-widest uppercase mb-3">How It Works</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-stone-900">
              Intelligent Coordination
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="gradient-card rounded-2xl p-8 border border-primary-100/50 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1"
                  id={`feature-${i}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-stone-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-stone-600 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 gradient-primary" id="stats-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="text-center">
                  <Icon className="w-6 h-6 text-primary-200 mx-auto mb-2" />
                  <p className="text-2xl font-display font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-primary-200">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 bg-white" id="problem-section">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold text-harvest-600 tracking-widest uppercase mb-3">The Challenge</p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-stone-900 mb-8">
            Why HarvestFlow.ai?
          </h2>
          <blockquote className="text-lg text-stone-700 leading-relaxed italic border-l-4 border-primary-400 pl-6 text-left">
            "Small tomato farmers lack an intelligent coordination mechanism to match changing harvest quantities and quality with recurring buyer demand and limited transport capacity, while ensuring that collection opportunities are not unfairly concentrated among larger producers."
          </blockquote>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-stone-900 text-stone-400 text-center text-sm">
        <p>© 2026 HarvestFlow.ai — Built for the Hackathon</p>
      </footer>
    </div>
  );
}
