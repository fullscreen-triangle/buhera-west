import dynamic from 'next/dynamic'
import Head from 'next/head'

const StreetViewEngine = dynamic(
  () => import('@/components/terrain/StreetViewEngine'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060608', color: '#58E6D9',
        fontFamily: 'monospace', fontSize: 14,
      }}>
        Loading street view…
      </div>
    ),
  },
)

export default function StreetViewPage() {
  return (
    <>
      <Head>
        <title>Street View — Categorical Partition Navigation</title>
      </Head>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#060608',
      }}>
        <StreetViewEngine style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}

// Full-screen, no navbar/footer
StreetViewPage.getLayout = (page) => page
