import Head from "next/head";
import Script from "next/script";

// Minimal landing: navbar (from _app) + a single static GLB. No rotation, nothing else.
export default function Home() {
  return (
    <>
      <Head>
        <title>buhera-west</title>
        <meta name="description" content="buhera-west — dendra scene framework" />
      </Head>

      {/* model-viewer web component (renders a static .glb without three.js) */}
      <Script
        type="module"
        src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js"
        strategy="afterInteractive"
      />

      <div className="flex w-full items-center justify-center" style={{ height: "calc(100vh - 7rem)" }}>
        {/* static: no camera-controls (=> no rotation), no interaction prompt */}
        <model-viewer
          src="/peirene_fountain_corinth_greece.glb"
          alt="buhera-west"
          interaction-prompt="none"
          style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
        ></model-viewer>
      </div>
    </>
  );
}
