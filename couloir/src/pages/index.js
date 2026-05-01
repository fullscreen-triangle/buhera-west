import dynamic from 'next/dynamic'
import Head from 'next/head'

const LandingScene = dynamic(
  () => import('@/components/landing/LandingScene'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'linear-gradient(180deg, #0a0e18 0%, #1a2440 100%)',
        color: '#9bb4d6', fontFamily: 'monospace',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, letterSpacing: 4,
      }}>
        BUHERA-WEST
      </div>
    ),
  },
)

export default function Home() {
  return (
    <>
      <Head>
        <title>Buhera-West · Olympiastadion</title>
        <meta name="description"
          content="Real-world terrain rendering centred on the Berlin Olympic Stadium." />
      </Head>
      <LandingScene />
    </>
  )
}

// Opt out of the CodeBucks portfolio Navbar/Footer wrapper
Home.getLayout = (page) => page
