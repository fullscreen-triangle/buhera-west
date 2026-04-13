import dynamic from 'next/dynamic'
import Head from 'next/head'

const TerrainEngine = dynamic(
  () => import('@/components/terrain/TerrainEngine'),
  { ssr: false }
)

export default function TerrainPage() {
  return (
    <>
      <Head>
        <title>Terrain Engine</title>
      </Head>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <TerrainEngine style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}
