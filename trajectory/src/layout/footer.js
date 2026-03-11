import React from 'react'
import Link from 'next/link'

export default function Footer() {
    return (
        <footer className="bg-gray-950 border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">BW</span>
                            </div>
                            <span className="text-white font-light text-lg">Buhera-West</span>
                        </div>
                        <p className="text-gray-400 text-sm font-light leading-relaxed">
                            Deterministic weather prediction via molecular categorical computation in bounded phase space.
                        </p>
                    </div>

                    {/* Framework */}
                    <div>
                        <h4 className="text-white text-sm font-medium mb-4">Framework</h4>
                        <ul className="space-y-2">
                            <li><Link href="/framework"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">Theoretical Foundation</a></Link></li>
                            <li><Link href="/framework#sentropy"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">S-Entropy Coordinates</a></Link></li>
                            <li><Link href="/framework#dynamics"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">Partition Dynamics</a></Link></li>
                            <li><Link href="/validation"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">Empirical Validation</a></Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white text-sm font-medium mb-4">Resources</h4>
                        <ul className="space-y-2">
                            <li><Link href="/api-docs"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">API Documentation</a></Link></li>
                            <li><Link href="/research"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">Research Paper</a></Link></li>
                            <li><Link href="/weather"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">Live Demo</a></Link></li>
                        </ul>
                    </div>

                    {/* Connect */}
                    <div>
                        <h4 className="text-white text-sm font-medium mb-4">Connect</h4>
                        <ul className="space-y-2">
                            <li><Link href="/investors"><a className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">For Investors</a></Link></li>
                            <li><a href="https://github.com/buhera-west" target="_blank" rel="noopener noreferrer" className="text-gray-400 text-sm font-light hover:text-cyan-400 transition-colors">GitHub</a></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between">
                    <p className="text-gray-500 text-xs font-light">
                        &copy; {new Date().getFullYear()} Buhera-West Geosciences. All rights reserved.
                    </p>
                    <p className="text-gray-600 text-xs font-light mt-2 sm:mt-0">
                        Atmospheric Trajectory Completion Framework
                    </p>
                </div>
            </div>
        </footer>
    )
}
