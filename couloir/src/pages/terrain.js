import dynamic from 'next/dynamic'
import Head from 'next/head'

const TerrainEngine = dynamic(
  () => import('@/components/terrain/TerrainEngine'),
  { ssr: false, loading: () => (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#060608', color: '#58E6D9',
      fontFamily: 'monospace', fontSize: 14,
    }}>
      Loading terrain engine...
    </div>
  )}
)

export default function TerrainPage() {
  return (
    <>
      <Head>
        <title>Terrain Engine</title>
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
        <TerrainEngine style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}

// Opt out of the default Navbar/Footer layout for this page
TerrainPage.getLayout = (page) => page
