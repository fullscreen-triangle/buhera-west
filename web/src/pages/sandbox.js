import Head from "next/head";
import dynamic from "next/dynamic";

// Full-page IDE; browser-only (window / structuredClone / iframe) → client only.
const Sandbox = dynamic(() => import("@/components/Sandbox"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center font-mono text-sm"
      style={{ background: "#070d0b", color: "#58E6D9" }}>
      loading dendra sandbox…
    </div>
  ),
});

export default function SandboxPage() {
  return (
    <>
      <Head>
        <title>Dendra Sandbox — buhera-west</title>
        <meta name="description" content="Write dendra (.dra) scripts and compile them into a scene." />
      </Head>
      <Sandbox />
    </>
  );
}
