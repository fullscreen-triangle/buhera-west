import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import "@/styles/globals.css";
import { AnimatePresence } from "framer-motion";
// pages/_app.js
import { Montserrat } from "next/font/google";
import Head from "next/head";
import { useRouter } from "next/router";

// If loading a variable font, you don't need to specify the font weight
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-mont" });

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const isSandbox = router.pathname === "/sandbox"; // full-page IDE: no site chrome
  const isHome = router.pathname === "/";            // minimal landing: navbar + model only

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main
        className={`${montserrat.variable} font-mont  bg-light dark:bg-dark w-full min-h-screen h-full`}
      >
        {!isSandbox && <Navbar />}
        <AnimatePresence initial={false} mode="wait">
          <Component key={router.asPath} {...pageProps} />
        </AnimatePresence>
        {!isSandbox && !isHome && <Footer />}
      </main>
    </>
  );
}
