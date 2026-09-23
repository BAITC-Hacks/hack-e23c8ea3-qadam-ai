import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PenLine, LayoutGrid, Inbox, Send } from 'lucide-react'
import { scoreCard } from '../lib/scoring.js'
import { analyzeWithAI, aiStateFromAnalysis, answersAfterDraftChange, cardWithAI } from '../lib/constructorAI.js'
import { inferTaskTags } from '../lib/tags.js'
import {
  SEED_TASKS, SEED_TEAMS, SEED_PROPOSALS, SEED_COMPANIES, EMPTY_CARD, MY_COMPANY,
} from '../data/seed.js'
import { useT } from '../i18n/LangContext.jsx'
import { STORAGE_KEYS, loadJson, saveJson, removeKey } from '../lib/persist.js'
import {
  rankTasks, positionOf, addProposal, decideProposal, confirmMilestone as confirmMilestoneRule,
  isValidSession, clampView, resolveTeamId,
} from '../lib/catalog.js'

const QadamCtx = createContext(null)
export const useQadam = () => useContext(QadamCtx)

const VIEWS = new Set(['builder', 'catalog', 'proposals', 'mine'])

function withOwner(tasks, companyName) {
  return tasks.map((task) => ({ ...task, owner: task.company === companyName }))
}

// Меняйте версию, если меняется формат seed/сессии: старое сохранение будет проигнорировано.
const SESSION_VERSION = 3

function readSession() {
  const s = loadJson(STORAGE_KEYS.session, null)
  return s && s.version === SESSION_VERSION && isValidSession(s) ? s : null
}

function defaultSession() {
  return {
    tasks: SEED_TASKS,
    proposals: SEED_PROPOSALS,
    teams: SEED_TEAMS,
    milestones: {},
    newTaskId: null,
    growth: [],
    builder: null,
  }
}

function emptyBuilder() {
  return {
    step: 1,
    draft: '',
    industry: 'Услуги',
    ai: null,
    answers: {},
    card: { ...EMPTY_CARD },
    confirmed: false,
    history: [],
  }
}

export function QadamProvider({ children }) {
  const t = useT()
  const hydrated = useRef(false)
  const [catalogError, setCatalogError] = useState(null)

  const saved = useMemo(() => readSession(), [])
  const initialCompanyId = loadJson(STORAGE_KEYS.companyId, 'c-qala')
  const initialCompany = SEED_COMPANIES.find((c) => c.id === initialCompanyId) || SEED_COMPANIES[0]
  const initialRole = loadJson(STORAGE_KEYS.role, 'business') === 'student' ? 'student' : 'business'
  const initialTeamId = loadJson(STORAGE_KEYS.teamId, 'k1')
  const rawInitialView = (() => {
    const fromHash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '') : ''
    if (VIEWS.has(fromHash)) return fromHash
    const stored = loadJson(STORAGE_KEYS.view, null)
    if (VIEWS.has(stored)) return stored
    return initialRole === 'business' ? 'builder' : 'catalog'
  })()
  const b0 = saved?.builder && typeof saved.builder === 'object' ? saved.builder : null

  const [role, setRole] = useState(initialRole)
  const [view, setView] = useState(() => clampView(initialRole, rawInitialView))
  const [companyId, setCompanyId] = useState(initialCompany.id)
  const [tasks, setTasks] = useState(() => withOwner(saved?.tasks || SEED_TASKS, initialCompany.name))
  const [teams, setTeams] = useState(() => (saved?.teams?.length ? saved.teams : SEED_TEAMS))
  const [proposals, setProposals] = useState(saved?.proposals || SEED_PROPOSALS)
  const [teamId, setTeamId] = useState(() => {
    const list = saved?.teams?.length ? saved.teams : SEED_TEAMS
    return resolveTeamId(list, initialTeamId) || SEED_TEAMS[0].id
  })
  const [toast, setToast] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [aiModal, setAiModal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [submittingProposal, setSubmittingProposal] = useState(false)
  const [decidingId, setDecidingId] = useState(null)

  const [step, setStepState] = useState(b0?.step === 2 || b0?.step === 3 ? b0.step : 1)
  const [builderRevision, setBuilderRevision] = useState(0)
  const [draft, setDraftState] = useState(typeof b0?.draft === 'string' ? b0.draft : '')
  const [industry, setIndustryState] = useState(typeof b0?.industry === 'string' ? b0.industry : 'Услуги')
  const [ai, setAi] = useState(() => (b0?.ai && typeof b0.ai === 'object' && Array.isArray(b0.ai?.data?.questions) ? b0.ai : null))
  const [thinking, setThinking] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [answers, setAnswersState] = useState(b0?.answers && typeof b0.answers === 'object' ? b0.answers : {})
  const [card, setCard] = useState(() => {
    if (!b0?.card || typeof b0.card !== 'object') return EMPTY_CARD
    const next = { ...EMPTY_CARD }
    for (const [k, v] of Object.entries(b0.card)) {
      if (typeof v === 'string') next[k] = v
    }
    return next
  })
  const [confirmed, setConfirmed] = useState(!!b0?.confirmed)
  const [history, setHistory] = useState(() => (
    Array.isArray(b0?.history)
      ? b0.history.filter((h) => h && typeof h.labelKey === 'string' && typeof h.score === 'number')
      : []
  ))
  const [newTaskId, setNewTaskId] = useState(saved?.newTaskId || null)
  const [growth, setGrowth] = useState(saved?.growth || [])
  const [milestones, setMilestones] = useState(saved?.milestones || {})
  const requestRef = useRef(null)
  const requestIdRef = useRef(0)

  const cancelPending = useCallback(() => {
    requestIdRef.current += 1
    requestRef.current?.abort()
    requestRef.current = null
    setThinking(false)
    setAiMessage('')
  }, [])
  const setDraft = useCallback((value) => {
    cancelPending()
    setAi(null)
    setAnswersState((current) => answersAfterDraftChange(draft, value, current))
    setDraftState(value)
  }, [cancelPending, draft])
  const setIndustry = useCallback((value) => { cancelPending(); setAi(null); setIndustryState(value) }, [cancelPending])
  const setAnswers = useCallback((value) => { cancelPending(); setAnswersState(value) }, [cancelPending])
  const setStep = useCallback((value) => { cancelPending(); setStepState(value) }, [cancelPending])

  useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null }, [])

  const myCompany = useMemo(
    () => SEED_COMPANIES.find((c) => c.id === companyId) || SEED_COMPANIES[0],
    [companyId],
  )

  const goView = useCallback((next) => {
    setView(clampView(role, next))
  }, [role])

  useEffect(() => {
    hydrated.current = true
  }, [])

  useEffect(() => {
    const next = resolveTeamId(teams, teamId)
    if (next && next !== teamId) setTeamId(next)
  }, [teams, teamId])

  useEffect(() => {
    setView((v) => clampView(role, v))
  }, [role])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    saveJson(STORAGE_KEYS.role, role)
  }, [role])

  useEffect(() => {
    saveJson(STORAGE_KEYS.teamId, teamId)
  }, [teamId])

  useEffect(() => {
    saveJson(STORAGE_KEYS.companyId, companyId)
  }, [companyId])

  useEffect(() => {
    saveJson(STORAGE_KEYS.view, view)
    const hash = `#/${view}`
    if (typeof window !== 'undefined' && window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [view])

  useEffect(() => {
    if (!hydrated.current) return
    saveJson(STORAGE_KEYS.session, {
      version: SESSION_VERSION,
      tasks,
      proposals,
      teams,
      milestones,
      newTaskId,
      growth,
      builder: {
        step,
        draft,
        industry,
        ai,
        answers,
        card,
        confirmed,
        history,
      },
    })
  }, [tasks, proposals, teams, milestones, newTaskId, growth, step, draft, industry, ai, answers, card, confirmed, history])

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace(/^#\/?/, '')
      if (VIEWS.has(next)) setView(clampView(role, next))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [role])

  const scored = useMemo(
    () => tasks.map((task) => ({ ...task, score: scoreCard(task).total })),
    [tasks],
  )
  const ranked = useMemo(() => rankTasks(scored), [scored])

  const liveCard = useMemo(() => {
    if (step === 3) return card
    const c = { ...EMPTY_CARD, context: draft }
    if (step === 2) Object.entries(answers).forEach(([f, v]) => { c[f === 'need' ? 'need' : f] = v })
    return c
  }, [step, card, draft, answers])
  const live = useMemo(() => scoreCard(liveCard), [liveCard])

  const myTeam = teams.find((x) => x.id === teamId)
  const myTaskIds = useMemo(
    () => new Set(tasks.filter((x) => x.owner).map((x) => x.id)),
    [tasks],
  )
  const pendingForMe = proposals.filter((p) => myTaskIds.has(p.taskId) && p.status === 'pending').length

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

  const runAnalysis = useCallback(async () => {
    if (requestRef.current) return
    if (!draft.trim()) { setAiMessage(t('toastShortDraft')); return }
    const id = ++requestIdRef.current
    const controller = new AbortController()
    requestRef.current = controller
    setThinking(true)
    setAiMessage('')
    setAi(null)
    setConfirmed(false)
    try {
      let data
      try {
        data = await analyzeWithAI({ draft, industry }, { signal: controller.signal })
      } catch (error) {
        if (id !== requestIdRef.current || error?.kind === 'aborted') return
        setAiMessage(error.message)
        return
      }
      if (id !== requestIdRef.current) return
      setAi(aiStateFromAnalysis(data, { draft, industry }))
      setHistory([{ labelKey: 'hist_draft', score: scoreCard({ ...EMPTY_CARD, context: draft }).total }])
      setStepState(2)
    } finally {
      if (id === requestIdRef.current) { requestRef.current = null; setThinking(false) }
    }
  }, [draft, industry, t])

  const buildCard = useCallback(async () => {
    if (requestRef.current) return
    const id = ++requestIdRef.current
    const controller = new AbortController()
    requestRef.current = controller
    setThinking(true)
    setAiMessage('')
    setConfirmed(false)
    try {
      let result
      try {
        result = await cardWithAI({ draft, industry, answers }, { signal: controller.signal })
      } catch (error) {
        if (id !== requestIdRef.current || error?.kind === 'aborted') return
        setAiMessage(error.message)
        return
      }
      if (id !== requestIdRef.current) return
      setCard(result.card)
      setAi((current) => current && { ...current, card: { source: result.source, warnings: result.warnings } })
      setHistory((h) => [...h.slice(0, 1), { labelKey: 'hist_answers', score: scoreCard(result.card).total }])
      setConfirmed(false)
      setStepState(3)
    } finally {
      if (id === requestIdRef.current) { requestRef.current = null; setThinking(false) }
    }
  }, [industry, draft, answers])

  const publish = useCallback(() => {
    if (!card.title.trim()) { setToast({ tone: 'warn', text: t('toastNeedTitle') }); return }
    if (!confirmed) { setToast({ tone: 'warn', text: t('toastNeedConfirm') }); return }
    const id = `n${Date.now()}`
    const tags = inferTaskTags(card)
    const companyName = myCompany?.name || MY_COMPANY
    const task = {
      ...card,
      id,
      company: companyName,
      owner: true,
      tags: tags.length ? tags : ['Web'],
      createdAt: Date.now(),
      isNew: true,
    }
    const s = scoreCard(card).total
    setGrowth([...history.slice(0, 2), { labelKey: 'hist_publish', score: s }])
    cancelPending()
    const cleared = emptyBuilder()
    setStepState(cleared.step)
    setDraftState(cleared.draft)
    setIndustryState(cleared.industry)
    setAi(cleared.ai)
    setAnswersState(cleared.answers)
    setCard(cleared.card)
    setConfirmed(cleared.confirmed)
    setHistory(cleared.history)
    setTasks((ts) => withOwner([...ts.map((x) => ({ ...x, isNew: false })), task], companyName))
    setNewTaskId(id)
    const pos = positionOf(rankTasks([...scored, { ...task, score: s }]), id)
    setToast({ tone: 'ok', text: t('toastPublished', { n: pos }) })
    goView('catalog')
  }, [card, confirmed, history, scored, t, myCompany, goView, cancelPending])

  const resetBuilder = useCallback(() => {
    cancelPending()
    setBuilderRevision((revision) => revision + 1)
    const cleared = emptyBuilder()
    setStepState(cleared.step)
    setDraftState(cleared.draft)
    setIndustryState(cleared.industry)
    setAi(cleared.ai)
    setAnswersState(cleared.answers)
    setCard(cleared.card)
    setConfirmed(cleared.confirmed)
    setHistory(cleared.history)
  }, [cancelPending])

  const resetDemo = useCallback(() => {
    const company = SEED_COMPANIES.find((c) => c.id === companyId) || SEED_COMPANIES[0]
    const fresh = defaultSession()
    resetBuilder()
    setTasks(withOwner(fresh.tasks, company.name))
    setProposals(fresh.proposals)
    setTeams(fresh.teams)
    setNewTaskId(null)
    setMilestones({})
    setGrowth([])
    setCatalogError(null)
    setRole('business')
    setView('builder')
    removeKey(STORAGE_KEYS.session)
    setToast({ tone: 'ok', text: t('toastReset') })
  }, [resetBuilder, t, companyId])

  const changeCompany = useCallback((id) => {
    const company = SEED_COMPANIES.find((c) => c.id === id)
    if (!company) return
    setCompanyId(id)
    setTasks((ts) => withOwner(ts, company.name))
    setOpenTaskId(null)
  }, [])

  const submitProposal = useCallback(async (taskId, form) => {
    if (role !== 'student') {
      setToast({ tone: 'warn', text: t('errForbidden') })
      return { ok: false, error: 'errForbidden' }
    }
    if (submittingProposal) return false
    setSubmittingProposal(true)
    setCatalogError(null)
    try {
      await new Promise((r) => setTimeout(r, 180))
      const res = addProposal({ proposals, tasks, teams, taskId, teamId, form })
      if (!res.ok) {
        setToast({ tone: 'warn', text: t(res.error) })
        return res
      }
      setProposals(res.proposals)
      setToast({ tone: 'ok', text: t('toastProposed') })
      setOpenTaskId(null)
      return res
    } catch (err) {
      setCatalogError(err?.message || t('catalogError'))
      setToast({ tone: 'warn', text: err?.message || t('catalogError') })
      return { ok: false, error: 'catalogError' }
    } finally {
      setSubmittingProposal(false)
    }
  }, [role, submittingProposal, proposals, tasks, teams, teamId, t])

  const decide = useCallback(async (pid, status) => {
    if (decidingId) return
    setDecidingId(pid)
    try {
      await new Promise((r) => setTimeout(r, 120))
      const res = decideProposal({
        proposals,
        milestones,
        proposalId: pid,
        decision: status,
        role,
        ownerTaskIds: myTaskIds,
      })
      if (!res.ok) { setToast({ tone: 'warn', text: t(res.error) }); return }
      setProposals(res.proposals)
      setToast({
        tone: status === 'accepted' ? 'ok' : 'neutral',
        text: status === 'accepted' ? t('toastAccepted') : status === 'rejected' ? t('toastRejected') : t('toastRestored'),
      })
    } finally {
      setDecidingId(null)
    }
  }, [decidingId, proposals, milestones, role, myTaskIds, t])

  const confirmMilestone = useCallback((p) => {
    const res = confirmMilestoneRule({
      proposals,
      teams,
      milestones,
      proposalId: p.id,
      role,
      ownerTaskIds: myTaskIds,
    })
    if (!res.ok) { setToast({ tone: 'warn', text: t(res.error) }); return }
    setMilestones(res.milestones)
    setTeams(res.teams)
    setToast({ tone: 'ok', text: t('toastMilestone') })
  }, [proposals, teams, milestones, role, myTaskIds, t])

  // view — необязательный экран, куда перейти в новой роли (например, из трекера сценария).
  const switchRole = useCallback((r, view, openId = null) => {
    setRole(r)
    setView(clampView(r, view || (r === 'business' ? 'builder' : 'catalog')))
    setOpenTaskId(openId)
  }, [])

  const nav = role === 'business'
    ? [
      { id: 'builder', label: t('navNew'), icon: PenLine },
      { id: 'catalog', label: t('navCatalog'), icon: LayoutGrid },
      { id: 'proposals', label: t('navInbox'), icon: Inbox, badge: pendingForMe },
    ]
    : [
      { id: 'catalog', label: t('navCatalog'), icon: LayoutGrid },
      { id: 'mine', label: t('navMine'), icon: Send, badge: proposals.filter((p) => p.teamId === teamId).length },
    ]

  const openTask = scored.find((x) => x.id === openTaskId)

  const value = {
    role, setRole, view, setView: goView, tasks, setTasks, teams, setTeams, proposals, setProposals,
    teamId, setTeamId, companyId, companies: SEED_COMPANIES, myCompany, changeCompany,
    toast, setToast, openTaskId, setOpenTaskId, aiModal, setAiModal, menuOpen, setMenuOpen,
    builderRevision, step, setStep, draft, setDraft, industry, setIndustry, ai, setAi, thinking, aiMessage, answers, setAnswers,
    card, setCard, confirmed, setConfirmed, history, newTaskId, growth, milestones,
    scored, ranked, live, myTeam, done, currentStep, nav, openTask,
    ready: true, catalogError, submittingProposal, decidingId,
    runAnalysis, buildCard, publish, resetBuilder, resetDemo, submitProposal, decide, confirmMilestone, switchRole,
  }

  return <QadamCtx.Provider value={value}>{children}</QadamCtx.Provider>
}
