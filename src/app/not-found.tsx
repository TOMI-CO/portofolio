/** Unknown URLs (outside the site shell): a plain page that always works. */
export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-b1 px-6 text-center text-l1">
      <p className="font-mono-2 text-sm text-l2 uppercase">404 · page not found</p>
      <h1 className="wide text-[7.2svw] leading-none font-bold uppercase lg:text-[5.6svw]">Lost in the grid</h1>
      <a href="/" className="dot-frame p-2 font-mono-2 uppercase">
        Back home
      </a>
    </main>
  );
}
