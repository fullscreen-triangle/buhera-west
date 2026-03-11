import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Header() {
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navItems = [
        { href: '/', label: 'Home' },
        { href: '/framework', label: 'Framework' },
        { href: '/validation', label: 'Validation' },
        { href: '/weather', label: 'Live Demo' },
        { href: '/api-docs', label: 'API' },
        { href: '/research', label: 'Research' },
        { href: '/investors', label: 'Investors' },
    ];

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/">
                        <a className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">BW</span>
                            </div>
                            <span className="text-white font-light text-lg tracking-wide hidden sm:block">
                                Buhera-West
                            </span>
                        </a>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                            >
                                <a className={`px-3 py-2 text-sm font-light rounded-lg transition-all duration-200 ${
                                    router.pathname === item.href
                                        ? 'text-cyan-400 bg-white/10'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                }`}>
                                    {item.label}
                                </a>
                            </Link>
                        ))}
                    </nav>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden text-gray-300 hover:text-white p-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Navigation */}
                {mobileOpen && (
                    <nav className="md:hidden pb-4 border-t border-white/10 mt-2 pt-4">
                        <div className="flex flex-col space-y-1">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                >
                                    <a
                                        onClick={() => setMobileOpen(false)}
                                        className={`px-3 py-2 text-sm font-light rounded-lg transition-all duration-200 ${
                                            router.pathname === item.href
                                                ? 'text-cyan-400 bg-white/10'
                                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        {item.label}
                                    </a>
                                </Link>
                            ))}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    )
}
