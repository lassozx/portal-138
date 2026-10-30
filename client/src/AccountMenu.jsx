export default function AccountMenu({ session, onLogin, onLogout, onProfile, onAdmin }) {
  const canManage = ['ADMIN', 'EDITOR'].includes(session?.user?.role)
  const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100'

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Minha conta">
      {session ? (
        <>
          <button type="button" onClick={onProfile} className={buttonClass}>Meu perfil</button>
          {canManage && <button type="button" onClick={onAdmin} className={buttonClass}>Painel</button>}
          <button type="button" onClick={onLogout} className={buttonClass}>Sair</button>
        </>
      ) : (
        <button type="button" onClick={onLogin} className="rounded-lg border border-red-700 px-3 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50">Entrar</button>
      )}
    </div>
  )
}
