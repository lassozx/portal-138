function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-10 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-xl font-black text-white">
          138
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-900">
          Portal 138
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          Notícias, projetos e acontecimentos relacionados ao SESI 138.
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-800">
          <span className="h-2 w-2 rounded-full bg-green-600" />
          Frontend configurado
        </div>
      </section>
    </main>
  )
}

export default App