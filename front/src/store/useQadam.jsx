import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { PenLine, LayoutGrid, Inbox, Send } from 'lucide-react'
import { scoreCard, words } from '../lib/scoring.js'
import { analyzeDraft, validateAIResponse } from '../lib/ai.js'
import { SEED_TASKS, SEED_TEAMS, SEED_PROPOSALS, EMPTY_CARD, MY_COMPANY } from '../data/seed.js'
import { useT } from '../i18n/LangContext.jsx'

const QadamCtx = createContext(null)
export const useQadam = () => useContext(QadamCtx)

export function QadamProvider({ children }) {
  const t = useT()
  const [role, setRole] = useState('business')
  const [view, setView] = useState('builder')
  const [tasks, setTasks] = useState(SEED_TASKS)
  const [teams, setTeams] = useState(SEED_TEAMS)
  const [proposals, setProposals] = useState(SEED_PROPOSALS)
  const [teamId, setTeamId] = useState('k1')
  const [toast, setToast] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [aiModal, setAiModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState('')
  const [industry, setIndustry] = useState('Услуги')
  const [ai, setAi] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [answers, setAnswers] = useState({})
  const [card, setCard] = useState(EMPTY_CARD)
  const [confirmed, setConfirmed] = useState(false)
  const [history, setHistory] = useState([])
  const [newTaskId, setNewTaskId] = useState(null)
  const [growth, setGrowth] = useState([])
  const [milestones, setMilestones] = useState({})

  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id) }, [toast])

  const scored = useMemo(() => tasks.map((task) => ({ ...task, score: scoreCard(task).total })), [tasks])
  const ranked = useMemo(() => [...scored].sort((a, b) => b.score - a.score || b.createdAt - a.createdAt), [scored])

  const liveCard = useMemo(() => {
    if (step === 3) return card
    const c = { ...EMPTY_CARD, context: draft }
    if (step === 2) Object.entries(answers).forEach(([f, v]) => { c[f === 'need' ? 'need' : f] = v })
    return c
  }, [step, card, draft, answers])
  const live = useMemo(() => scoreCard(liveCard), [liveCard])

  const myTeam = teams.find((x) => x.id === teamId)
  const myTaskIds = tasks.filter((x) => x.owner).map((x) => x.id)
  const pendingForMe = proposals.filter((p) => myTaskIds.includes(p.taskId) && p.status === 'pending').length

  const flowTask = newTaskId || null
  const flowProps = proposals.filter((p) => p.taskId === flowTask)
  const done = [
    draft.trim().length > 0 || !!newTaskId,
    !!ai || !!newTaskId,
    step === 3 || !!newTaskId,
    confirmed || !!newTaskId,
    !!newTaskId,
    flowProps.length > 0,
    flowProps.some((p) => p.status !== 'pending'),
    flowProps.some((p) => milestones[p.id]),
  ]
  const currentStep = done.findIndex((d) => !d)

  const runAnalysis = useCallback(() => {
    if (words(draft) < 3) { setToast({ tone: 'warn', text: t('toastShortDraft') }); return }
    setThinking(true)
    setTimeout(() => {
      const raw = JSON.stringify(analyzeDraft(draft))
      const v = validateAIResponse(raw)
      setAi({ raw, valid: v.ok, data: v.data })
      setAnswers({})
      setHistory([{ labelKey: 'hist_draft', score: scoreCard({ ...EMPTY_CARD, context: draft }).total }])
      setThinking(false)
      setStep(2)
    }, 1100)
  }, [draft, t])

  const buildCard = useCallback(() => {
    const c = { ...EMPTY_CARD, industry, context: draft.trim() }
    Object.entries(answers).forEach(([f, v]) => { if (v.trim()) c[f] = v.trim() })
    const first = draft.trim().split(/[.!?\n]/)[0]
    c.title = first.length > 70 ? first.slice(0, 67) + '…' : first
    c.title = c.title.charAt(0).toUpperCase() + c.title.slice(1)
    setCard(c)
    setHistory((h) => [...h.slice(0, 1), { labelKey: 'hist_answers', score: scoreCard(c).total }])
    setConfirmed(false)
    setStep(3)
  }, [industry, draft, answers])

  const publish = useCallback(() => {
    if (!card.title.trim()) { setToast({ tone: 'warn', text: t('toastNeedTitle') }); return }
    if (!confirmed) { setToast({ tone: 'warn', text: t('toastNeedConfirm') }); return }
    const id = 'n' + Date.now()
    const text = Object.values(card).join(' ')
    const tags = [
      ...(/бот|telegram/i.test(text) ? ['Telegram', 'Бот'] : []),
      ...(/сайт|веб|web|форм|заявк/i.test(text) ? ['Web', 'React'] : []),
      ...(/данн|аналит|excel|1с|отчёт/i.test(text) ? ['Аналитика'] : []),
    ]
    const task = { ...card, id, company: MY_COMPANY, owner: true, tags: tags.length ? tags : ['Web'], createdAt: 10, isNew: true }
    const s = scoreCard(card).total
    setGrowth([...history.slice(0, 2), { labelKey: 'hist_publish', score: s }])
    setStep(1); setDraft(''); setAi(null); setAnswers({}); setCard(EMPTY_CARD); setConfirmed(false); setHistory([])
    setTasks((ts) => [...ts.map((x) => ({ ...x, isNew: false })), task])
    setNewTaskId(id)
    const pos = [...scored, { ...task, score: s }].sort((a, b) => b.score - a.score || b.createdAt - a.createdAt).findIndex((x) => x.id === id) + 1
    setToast({ tone: 'ok', text: t('toastPublished', { n: pos }) })
    setView('catalog')
  }, [card, confirmed, history, scored, t])

  const resetBuilder = useCallback(() => {
    setStep(1); setDraft(''); setAi(null); setAnswers({}); setCard(EMPTY_CARD); setConfirmed(false); setHistory([])
  }, [])

  const resetDemo = useCallback(() => {
    resetBuilder(); setTasks(SEED_TASKS); setProposals(SEED_PROPOSALS); setTeams(SEED_TEAMS); setNewTaskId(null); setMilestones({}); setGrowth([])
    setRole('business'); setView('builder'); setToast({ tone: 'ok', text: t('toastReset') })
  }, [resetBuilder, t])

  const submitProposal = useCallback((taskId, form) => {
    setProposals((ps) => [...ps, { id: 'p' + Date.now(), taskId, teamId, status: 'pending', ...form }])
    setToast({ tone: 'ok', text: t('toastProposed') })
  }, [teamId, t])

  const decide = useCallback((pid, status) => {
    setProposals((ps) => ps.map((p) => (p.id === pid ? { ...p, status } : p)))
    setToast({ tone: status === 'accepted' ? 'ok' : 'neutral', text: status === 'accepted' ? t('toastAccepted') : t('toastRejected') })
  }, [t])

  const confirmMilestone = useCallback((p) => {
    setMilestones((m) => ({ ...m, [p.id]: true }))
    setTeams((ts) => ts.map((x) => (x.id === p.teamId ? { ...x, points: x.points + 50 } : x)))
    setToast({ tone: 'ok', text: t('toastMilestone') })
  }, [t])

  const switchRole = useCallback((r) => { setRole(r); setView(r === 'business' ? 'builder' : 'catalog'); setOpenTaskId(null) }, [])

  const nav = role === 'business'
    ? [{ id: 'builder', label: t('navNew'), icon: PenLine }, { id: 'catalog', label: t('navCatalog'), icon: LayoutGrid }, { id: 'proposals', label: t('navInbox'), icon: Inbox, badge: pendingForMe }]
    : [{ id: 'catalog', label: t('navCatalog'), icon: LayoutGrid }, { id: 'mine', label: t('navMine'), icon: Send, badge: proposals.filter((p) => p.teamId === teamId).length }]

  const openTask = scored.find((x) => x.id === openTaskId)

  const value = {
    role, setRole, view, setView, tasks, setTasks, teams, setTeams, proposals, setProposals,
    teamId, setTeamId, toast, setToast, openTaskId, setOpenTaskId, aiModal, setAiModal, menuOpen, setMenuOpen,
    step, setStep, draft, setDraft, industry, setIndustry, ai, setAi, thinking, answers, setAnswers,
    card, setCard, confirmed, setConfirmed, history, newTaskId, growth, milestones,
    scored, ranked, live, myTeam, done, currentStep, nav, openTask,
    runAnalysis, buildCard, publish, resetBuilder, resetDemo, submitProposal, decide, confirmMilestone, switchRole,
  }

  return <QadamCtx.Provider value={value}>{children}</QadamCtx.Provider>
}
