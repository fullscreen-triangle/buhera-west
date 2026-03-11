import Head from "next/head";
import React from "react";
import Header from "./header";
import Footer from "./footer";

export default function Layout({ children, title, description }) {
  return (
    <>
      <Head>
        <meta name="description" content={description || "Buhera-West Geosciences — Deterministic weather prediction via molecular categorical computation in bounded phase space"} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <title>{title ? `${title} | Buhera-West` : 'Buhera-West Geosciences'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>
      <div className="min-h-screen bg-gray-950 text-white">
        <Header />
        <main className="pt-16">
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
}
