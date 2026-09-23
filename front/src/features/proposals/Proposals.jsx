import { useState } from 'react'
import { ShieldCheck, Clock, Link2, ExternalLink, X, Check, Trophy, Flag, RotateCcw } from 'lucide-react'
import { PageHead } from '../../components/shell/PageHead.jsx'
import { Panel } from '../../components/ui/Panel.jsx'
import { Button } from '../../components/ui/Button.jsx'
import { MiniRing } from '../../components/ui/MiniRing.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { StatusChip } from '../../components/ui/StatusChip.jsx'
import { cx } from '../../lib/cx.js'
import { useT } from '../../i18n/LangContext.jsx'

export function Proposals({ tasks, proposals, teams, milestones, decidingId, onDecide, onMilestone, newTaskId }) {
  const tr = useT()
  const [tab, setTab] = useState(newTaskId || tasks[0]?.id)
  const task = tasks.find((x) => x.id === tab) || tasks[0]
  const list = proposals.filter((p) => p.taskId === task?.id)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead eyebrow={tr('pEyebrow')} title={tr('pTitle')} sub={tr('pSub')} />

      {!tasks.length ? (
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">{tr('proposalsNoTasks')}</div>
      ) : (
        <>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tasks.map((x) => {
          const n = proposals.filter((p) => p.taskId === x.id && p.status === 'pending').length
          return (
            <button key={x.id} type="button" onClick={() => setTab(x.id)} className={cx('flex max-w-[260px] shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition',
              task?.id === x.id ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500 hover:text-stone-900')}>
              <MiniRing score={x.score} size={28} />
              <span className="truncate">{x.title}</span>
              {!!n && <span className="rounded-full bg-orange-100 px-1.5 text-[10px] font-semibold text-orange-600">{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-stone-200 bg-surface/70 px-4 py-3 text-xs text-stone-500">
        <ShieldCheck className="size-4 shrink-0 text-orange-600" />{tr('proposalsBanner')}
      </div>

      {!list.length ? (
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center">
          <Clock className="mx-auto size-6 text-stone-400" />
          <p className="mt-3 text-sm text-stone-500">{tr('proposalsEmpty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => {
            const team = teams.find((x) => x.id === p.teamId)
            const busy = decidingId === p.id
            return (
              <Panel key={p.id} className={cx('q-in flex flex-col p-4 sm:p-5', p.status === 'accepted' && 'border-emerald-200', p.status === 'rejected' && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar team={team} />
                    <div>
                      <div className="text-sm font-medium text-stone-900">{team.name}</div>
                      <div className="text-xs text-stone-500">{team.captain}, {tr('captainOf', { n: team.members })}</div>
                    </div>
                  </div>
                  <StatusChip status={p.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{team.skills.map((x) => <span key={x} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{x}</span>)}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-stone-800">«{p.idea}»</p>
                <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5 text-xs leading-relaxed text-stone-500">{p.plan}</div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                  <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{p.deadline}</span>
                  <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-stone-500 hover:text-orange-600"><Link2 className="size-3.5 shrink-0" /><span className="truncate">{p.link.replace(/^https?:\/\//, '')}</span><ExternalLink className="size-3 shrink-0" /></a>
                </div>
                <div className="mt-auto pt-4">
                  {p.status === 'pending' && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="danger" disabled={busy || !!decidingId} onClick={() => onDecide(p.id, 'rejected')}><X className="size-4" />{tr('reject')}</Button>
                      <Button variant="primary" disabled={busy || !!decidingId} onClick={() => onDecide(p.id, 'accepted')}><Check className="size-4" />{tr('accept')}</Button>
                    </div>
                  )}
                  {p.status === 'accepted' && (milestones[p.id]
                    ? <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700"><Trophy className="size-4" />{tr('milestoneDone')}</div>
                    : <Button variant="success" className="w-full" onClick={() => onMilestone(p)}><Flag className="size-4" />{tr('confirmMilestone')}</Button>)}
                  {p.status === 'rejected' && <Button variant="quiet" size="sm" disabled={!!decidingId} onClick={() => onDecide(p.id, 'pending')}><RotateCcw className="size-3.5" />{tr('restorePending')}</Button>}
                </div>
              </Panel>
            )
          })}
        </div>
      )}
        </>
      )}
    </div>
  )
}
