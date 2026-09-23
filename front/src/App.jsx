import { useState } from 'react'
import { RotateCcw, Globe } from 'lucide-react'
import { LangProvider, LangSwitch, MobileMenu, LANGS, useT, useLang } from './i18n/LangContext.jsx'
import { QadamProvider, useQadam } from './store/useQadam.jsx'
import { FONT_BODY } from './lib/scoring.js'
import { cx } from './lib/cx.js'
import { Brand } from './components/shell/Brand.jsx'
import { RoleSwitch } from './components/shell/RoleSwitch.jsx'
import { TeamPicker } from './components/shell/TeamPicker.jsx'
import { CompanyPicker } from './components/shell/CompanyPicker.jsx'
import { ThemeToggle } from './components/shell/ThemeToggle.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { Toast } from './components/ui/Toast.jsx'
import { RatingPanel } from './components/panels/RatingPanel.jsx'
import { ImpactPanel } from './components/panels/ImpactPanel.jsx'
import { ScenarioTracker } from './components/panels/ScenarioTracker.jsx'
import { Builder } from './features/builder/Builder.jsx'
import { Catalog } from './features/catalog/Catalog.jsx'
import { TaskDrawer } from './features/catalog/TaskDrawer.jsx'
import { Proposals } from './features/proposals/Proposals.jsx'
import { MyProposals } from './features/proposals/MyProposals.jsx'
import { AIModal } from './features/ai/AIModal.jsx'

function Shell() {
  const t = useT()
  const { lang } = useLang()
  const q = useQadam()
  const [inboxTaskId, setInboxTaskId] = useState(null)
  const navigate = (view) => {
    setInboxTaskId(null)
    q.setView(view)
    q.setOpenTaskId(null)
  }
  const switchRole = (role) => {
    setInboxTaskId(null)
    q.switchRole(role)
  }
  const changeCompany = (companyId) => {
    setInboxTaskId(null)
    q.changeCompany(companyId)
  }
  const openInbox = () => {
    if (q.role !== 'business' || !q.openTask?.owner) return
    setInboxTaskId(q.openTask.id)
    q.setOpenTaskId(null)
    q.setView('proposals')
  }

  return (
    <div className="min-h-screen bg-canvas text-stone-700 antialiased selection:bg-orange-200" style={FONT_BODY}>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/4 h-[520px] w-[520px] rounded-full blur-[140px]" style={{ background: 'var(--q-glow-a)' }} />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full blur-[140px]" style={{ background: 'var(--q-glow-b)' }} />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-surface/80 px-4 py-5 backdrop-blur-xl lg:flex">
          <Brand />
          <RoleSwitch role={q.role} onChange={switchRole} className="mt-6" />
          <nav className="mt-6 space-y-1">
            {q.nav.map((n) => (
              <button key={n.id} type="button" onClick={() => navigate(n.id)}
                className={cx('group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                  q.view === n.id ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:bg-stone-100/70 hover:text-stone-900')}>
                <n.icon className={cx('size-4', q.view === n.id ? 'text-orange-600' : 'text-stone-500 group-hover:text-stone-700')} />
                {n.label}
                {!!n.badge && <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-600 tabular-nums">{n.badge}</span>}
              </button>
            ))}
          </nav>
          {q.role === 'student' ? (
            <TeamPicker teams={q.teams} teamId={q.teamId} onChange={q.setTeamId} className="mt-6" />
          ) : (
            <CompanyPicker companies={q.companies} companyId={q.companyId} onChange={changeCompany} className="mt-6" />
          )}
          <div className="mt-auto space-y-3">
            <ThemeToggle />
            <LangSwitch className="mb-4" />
            <button type="button" onClick={q.resetDemo} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-stone-500 transition hover:text-stone-800">
              <RotateCcw className="size-3.5" /> {t('reset')}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 border-b border-stone-200 bg-surface/85 px-4 py-3 backdrop-blur-xl sm:grid-cols-[auto_1fr_auto] lg:hidden">
            <Brand compact />
            <RoleSwitch role={q.role} onChange={switchRole} compact className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-self-end" />
            <button type="button" onClick={() => q.setMenuOpen(true)} aria-label={`${t('language')} · ${t('menu')}`}
              className="col-start-2 row-start-1 flex h-9 items-center gap-1 rounded-full border border-stone-200 bg-surface px-2.5 text-[11px] font-semibold text-stone-700 sm:col-start-3">
              <Globe className="size-4 text-orange-600" />{LANGS.find((l) => l.code === lang).short}
            </button>
          </header>

          <div className="flex min-w-0 flex-1 flex-col xl:flex-row">
            <main className="min-w-0 flex-1 px-4 pb-6 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
              {q.role === 'student' && <TeamPicker teams={q.teams} teamId={q.teamId} onChange={q.setTeamId} className="mb-5 lg:hidden" compact />}
              {q.role === 'business' && <CompanyPicker companies={q.companies} companyId={q.companyId} onChange={changeCompany} className="mb-5 lg:hidden" compact />}

              {q.view === 'builder' && (
                <Builder
                  key={`${q.companyId}:${q.builderRevision}`}
                  step={q.step} setStep={q.setStep} draft={q.draft} setDraft={q.setDraft}
                  industry={q.industry} setIndustry={q.setIndustry} ai={q.ai} thinking={q.thinking} aiMessage={q.aiMessage}
                  runAnalysis={q.runAnalysis} answers={q.answers} setAnswers={q.setAnswers}
                  buildCard={q.buildCard} card={q.card} setCard={q.setCard}
                  confirmed={q.confirmed} setConfirmed={q.setConfirmed} publish={q.publish}
                  live={q.live} resetBuilder={q.resetBuilder}
                />
              )}
              {q.view === 'catalog' && (
                <Catalog
                  tasks={q.ranked}
                  proposals={q.proposals}
                  role={q.role}
                  team={q.myTeam}
                  ready={q.ready}
                  error={q.catalogError}
                  onOpen={q.setOpenTaskId}
                />
              )}
              {q.view === 'proposals' && (
                <Proposals
                  key={`${q.role}:${q.companyId}:${inboxTaskId || ''}`}
                  tasks={q.scored.filter((x) => x.owner)}
                  proposals={q.proposals}
                  teams={q.teams}
                  milestones={q.milestones}
                  decidingId={q.decidingId}
                  onDecide={q.decide}
                  onMilestone={q.confirmMilestone}
                  newTaskId={q.newTaskId}
                  requestedTaskId={inboxTaskId}
                />
              )}
              {q.view === 'mine' && (
                <MyProposals proposals={q.proposals.filter((p) => p.teamId === q.teamId)} tasks={q.scored} milestones={q.milestones} onOpen={q.setOpenTaskId} />
              )}
            </main>

            <aside className="w-full shrink-0 space-y-4 border-stone-200 px-4 pb-28 sm:px-6 lg:px-8 xl:sticky xl:top-0 xl:h-screen lg:pb-10 xl:w-[360px] xl:overflow-y-auto xl:border-l xl:px-5 xl:py-8">
              {q.view === 'builder' ? (
                <RatingPanel live={q.live} history={q.history} step={q.step} />
              ) : (
                <ImpactPanel tasks={q.scored} proposals={q.proposals} teams={q.teams} role={q.role} teamId={q.teamId} history={q.growth} />
              )}
              <ScenarioTracker done={q.done} current={q.currentStep} />
            </aside>
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-surface/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-md">
          {q.nav.map((n) => (
            <button key={n.id} type="button" onClick={() => navigate(n.id)}
              className={cx('relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]', q.view === n.id ? 'text-orange-600' : 'text-stone-500')}>
              <n.icon className="size-5" />
              {n.label}
              {!!n.badge && <span className="absolute right-[calc(50%-22px)] top-1.5 grid min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-on-accent">{n.badge}</span>}
            </button>
          ))}
        </div>
      </nav>

      {q.openTask && (
        <TaskDrawer
          task={q.openTask}
          role={q.role}
          team={q.myTeam}
          proposals={q.proposals}
          submitting={q.submittingProposal}
          onClose={() => q.setOpenTaskId(null)}
          onSubmit={q.submitProposal}
          onGoInbox={openInbox}
        />
      )}
      {q.aiModal && <AIModal ai={q.ai} draft={q.draft} onClose={() => q.setAiModal(false)} />}
      {q.toast && <Toast {...q.toast} />}
      {q.menuOpen && <MobileMenu themeControl={<ThemeToggle />} onReset={q.resetDemo} onClose={() => q.setMenuOpen(false)} />}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <QadamProvider>
          <Shell />
        </QadamProvider>
      </LangProvider>
    </ThemeProvider>
  )
}
