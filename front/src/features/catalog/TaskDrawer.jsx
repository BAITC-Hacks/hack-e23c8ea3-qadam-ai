import { useEffect, useState } from 'react'
import { Building2, X, Inbox, CircleCheck, Send } from 'lucide-react'
import { Button } from '../../components/ui/Button.jsx'
import { LevelChip } from '../../components/ui/LevelChip.jsx'
import { ScoreRing } from '../../components/ui/ScoreRing.jsx'
import { StatusChip } from '../../components/ui/StatusChip.jsx'
import { FormInput } from './FormInput.jsx'
import { cx } from '../../lib/cx.js'
import { scoreCard, words, FONT_DISPLAY, CARD_FIELDS } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function TaskDrawer({ task, role, team, proposals, onClose, onSubmit, onGoInbox }) {
  const t = useT()
  const s = scoreCard(task)
  const mine = proposals.find((p) => p.taskId === task.id && p.teamId === team?.id)
  const [form, setForm] = useState({ idea: '', plan: '', deadline: '4 недели', link: '' })
  const [err, setErr] = useState({})

  const send = () => {
    const e = {}
    if (words(form.idea) < 5) e.idea = t('errIdea')
    if (words(form.plan) < 3) e.plan = t('errPlan')
    if (!/^https?:\/\/\S+\.\S+/.test(form.link)) e.link = t('errLink')
    setErr(e)
    if (!Object.keys(e).length) onSubmit(task.id, form)
  }

  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative flex h-full w-full flex-col border-l border-stone-200 bg-white sm:max-w-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div className="flex items-center gap-2 text-xs text-stone-500"><Building2 className="size-3.5" />{task.company} · {task.industry}</div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <LevelChip score={s.total} />
              <h2 className="mt-2 text-xl text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600, letterSpacing: '-0.01em' }}>{task.title}</h2>
            </div>
            <ScoreRing score={s.total} size={84} stroke={7} label={false} />
          </div>

          <div className="mt-5 grid grid-cols-7 gap-1" title={t('score')}>
            {s.parts.map((p) => (
              <div key={p.key} className="group relative">
                <div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-orange-500" style={{ width: `${(p.points / p.weight) * 100}%` }} /></div>
                <div className="mt-1 truncate text-[9px] text-stone-400">{t(`crit_${p.key}`).split(' ')[0]}</div>
              </div>
            ))}
          </div>

          <dl className="mt-6 space-y-4">
            {CARD_FIELDS.map((f) => (
              <div key={f.key}>
                <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">{t(`field_${f.key}`)}</dt>
                <dd className={cx('mt-1 text-sm leading-relaxed', task[f.key] ? 'text-stone-700' : 'italic text-stone-400')}>{task[f.key] || t('notSpecified')}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-stone-200 bg-white px-5 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
          {role === 'business' ? (
            task.owner
              ? <Button variant="primary" className="w-full" onClick={onGoInbox}><Inbox className="size-4" />{t('taskProposals')} · {proposals.filter((p) => p.taskId === task.id).length}</Button>
              : <p className="text-center text-xs text-stone-500">{t('switchToStudents')}</p>
          ) : mine ? (
            <div className="flex items-center gap-2 text-sm text-stone-600"><CircleCheck className="size-4 text-orange-600" />{team.name} {t('alreadyProposed')} · <StatusChip status={mine.status} /></div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium text-stone-900">{t('proposalFrom')} {team.name}</div>
              <FormInput id="p-idea" label={t('ideaLabel')} err={err.idea} area value={form.idea} onChange={(v) => setForm({ ...form, idea: v })} ph={t('ideaPh')} />
              <FormInput id="p-plan" label={t('planLabel')} err={err.plan} area value={form.plan} onChange={(v) => setForm({ ...form, plan: v })} ph={t('planPh')} />
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <FormInput id="p-deadline" label={t('deadlineLabel')} value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
                <FormInput id="p-link" label={t('linkLabel')} err={err.link} value={form.link} onChange={(v) => setForm({ ...form, link: v })} ph={t('linkPh')} />
              </div>
              <Button variant="primary" size="lg" className="w-full" onClick={send}><Send className="size-4" />{t('sendProposal')}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
