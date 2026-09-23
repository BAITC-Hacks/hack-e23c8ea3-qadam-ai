import { ChevronRight } from 'lucide-react'
import { PageHead } from '../../components/shell/PageHead.jsx'
import { MiniRing } from '../../components/ui/MiniRing.jsx'
import { StatusChip } from '../../components/ui/StatusChip.jsx'
import { useT } from '../../i18n/LangContext.jsx'

export function MyProposals({ proposals, tasks, milestones, onOpen }) {
  const tr = useT()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHead eyebrow={tr('mEyebrow')} title={tr('mTitle')} sub={tr('mSub')} />
      {!proposals.length ? (
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">{tr('mineEmpty')}</div>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const task = tasks.find((x) => x.id === p.taskId)
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(task.id)} className="flex w-full items-center gap-4 rounded-3xl border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300">
                  <MiniRing score={task.score} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-stone-900">{task.title}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{task.company} · {p.deadline}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusChip status={p.status} />
                    {milestones[p.id] && <span className="text-[11px] font-semibold text-orange-600">{tr('plus50')}</span>}
                  </div>
                  <ChevronRight className="size-4 text-stone-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
