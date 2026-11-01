export default function AccountMenu({ session, onLogin, onLogout, onProfile, onAdmin }) {
  const canManage = ['ADMIN', 'EDITOR'].includes(session?.user?.role)
  const buttonClass = 'rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700'

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Minha conta">
      {session ? (
        <>
          <button type="button" onClick={onProfile} className={buttonClass}>Meu perfil</button>
          {canManage && <button type="button" onClick={onAdmin} className={buttonClass}>Painel</button>}
          <button type="button" onClick={onLogout} className={buttonClass}>Sair</button>
        </>
      ) : (
        <button type="button" onClick={onLogin} className="rounded-md border border-red-700 bg-red-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Entrar</button>
      )}
    </div>
  )
}
