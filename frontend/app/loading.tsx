// Scheletro che ricalca il layout vero (testata + card + lista), non uno spinner:
// così la pagina non "salta" quando arriva il contenuto.
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line/70 px-5 pb-4 pt-4">
        <div className="skeleton h-2.5 w-20 rounded-sm" />
        <div className="skeleton mt-3 h-7 w-52 rounded-md" />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-5">
        <div className="skeleton h-28 rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-lg" style={{ opacity: 1 - i * 0.14 }} />
          ))}
        </div>
      </main>
    </div>
  );
}
