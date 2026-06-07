import Head from "next/head";
import dynamic from "next/dynamic";
import TransitionEffect from "@/components/TransitionEffect";

// The IDE shell uses browser-only APIs (window, structuredClone, iframe) — client only.
const Sandbox = dynamic(() => import("@/components/Sandbox"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[680px] w-full items-center justify-center rounded-lg font-mono text-sm"
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
      <TransitionEffect />
      <article className="flex min-h-screen w-full flex-col items-center justify-start px-8 pt-4 text-dark dark:text-light sm:px-4">
        <h1 className="mb-2 text-4xl font-bold md:text-3xl">Dendra Sandbox</h1>
        <p className="mb-6 max-w-2xl text-center text-sm opacity-70">
          Write a <code className="font-mono">.dra</code> scene on the left and press Run. The
          Compiled tab shows the dendra token stream (M1 lexer); the Scene tab renders the
          resolved passes — arriving at roadmap M6.
        </p>
        <div className="w-full max-w-6xl pb-16">
          <Sandbox />
        </div>
      </article>
    </>
  );
}
