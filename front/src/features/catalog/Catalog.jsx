import { useState } from 'react'
import { Search, Sparkles, Building2, Users, CircleAlert } from 'lucide-react'
import { PageHead } from '../../components/shell/PageHead.jsx'
import { LevelChip } from '../../components/ui/LevelChip.jsx'
import { MiniRing } from '../../components/ui/MiniRing.jsx'
import { inputCls } from '../../components/ui/inputCls.js'
import { cx } from '../../lib/cx.js'
import { LEVELS, levelOf, FONT_MONO, ACCENT_GLOW } from '../../lib/scoring.js'
import { filterCatalog, positionOf, recommendTasks } from '../../lib/catalog.js'
import { INDUSTRIES, industryKey } from '../../data/seed.js'
import { useT } from '../../i18n/LangContext.jsx'

export function Catalog({ tasks, proposals, role, team, ready, error, onOpen }) {
  const tr = useT()
  const [q, setQ] = useState('')
  const [topic, setTopic] = useState('__all__')
  const [lvl, setLvl] = useState('all')

  // tasks уже отсортированы rankTasks (useQadam → ranked)
  const recs = role === 'student' ? recommendTasks(tasks, team).map(({ task, match }) => ({ t: task, match })) : []
  const list = filterCatalog(tasks, { industry: topic, level: lvl, query: q })

  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHead eyebrow={tr('cEyebrow')} title={tr('cTitle')} sub={tr('cSub')} />
        <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">{tr('catalogLoading')}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead eyebrow={tr('cEyebrow')} title={tr('cTitle')} sub={tr('cSub')} />

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {recs.length > 0 && (
        <div className="mb-6">
          <div className="mb-2.5 flex items-center gap-2 text-sm text-stone-600"><Sparkles className="size-4 text-orange-600" />{tr('recsLead')} {team.name} <span className="text-xs text-stone-500">· {tr('recsHint')}</span></div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {recs.map(({ t: task, match }) => (
              <button key={task.id} type="button" onClick={() => onOpen(task.id)} className="w-64 shrink-0 snap-start rounded-3xl border border-orange-200 bg-orange-50/70 p-4 text-left transition hover:border-orange-300 sm:w-auto">
                <div className="flex items-center justify-between text-[11px] text-orange-600"><span>{match} {tr('matches')}</span><MiniRing score={task.score} size={32} /></div>
                <div className="mt-2 line-clamp-2 text-sm font-medium text-stone-900">{task.title}</div>
                <div className="mt-1 text-xs text-stone-500">{task.company}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500" />
          <input id="catalog-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('searchPh')} className={cx(inputCls, 'pl-10')} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" onClick={() => setTopic('__all__')} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs transition', topic === '__all__' ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500 hover:text-stone-800')}>{tr('filterAll')}</button>
          {INDUSTRIES.map((ind) => (
            <button key={ind} type="button" onClick={() => setTopic(ind)} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs transition', topic === ind ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500 hover:text-stone-800')}>{tr(industryKey(ind))}</button>
          ))}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button type="button" onClick={() => setLvl('all')} className={cx('shrink-0 rounded-full border px-3 py-1 text-xs transition', lvl === 'all' ? 'border-stone-300 bg-stone-100 text-stone-900' : 'border-stone-200 text-stone-500')}>{tr('anyLevel')}</button>
          {LEVELS.map((l) => (
            <button key={l.key} type="button" onClick={() => setLvl(l.key)} className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition', lvl === l.key ? l.chip : 'border-stone-200 text-stone-500')}>
              <span className={cx('size-1.5 rounded-full', l.dot)} />{tr(`level_${l.key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
        <span className="tabular-nums">{list.length} {tr('tasksByScore')}</span>
      </div>

      <ol className="space-y-3">
        {list.map((task) => {
          const pos = positionOf(tasks, task.id)
          const l = levelOf(task.score)
          const n = proposals.filter((p) => p.taskId === task.id).length
          return (
            <li key={task.id}>
              <button type="button" onClick={() => onOpen(task.id)}
                className={cx('q-in group flex w-full items-start gap-3 rounded-3xl border bg-surface p-4 text-left backdrop-blur-xl transition sm:gap-4 sm:p-5',
                  l.key === 'priority' ? 'border-orange-300' : 'border-stone-200 hover:border-stone-300', task.isNew && 'ring-2 ring-orange-400/70')}
                style={l.key === 'priority' ? { boxShadow: ACCENT_GLOW } : undefined}>
                <span className="mt-1 w-6 shrink-0 text-center text-xs tabular-nums text-stone-400" style={FONT_MONO}>#{pos}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelChip score={task.score} />
                    {task.isNew && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-accent">{tr('badgeNew')}</span>}
                    {task.owner && <span className="text-[11px] text-stone-500">{tr('yourTask')}</span>}
                  </div>
                  <div className="mt-2 text-[15px] font-medium text-stone-900 group-hover:text-orange-700">{task.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500"><Building2 className="size-3.5" />{task.company} · {tr(industryKey(task.industry))}</div>
                  {l.key === 'draft' && <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-stone-500"><CircleAlert className="size-3.5" />{tr('needsClarify')}</div>}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {task.tags.map((x) => <span key={x} className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{x}</span>)}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500"><Users className="size-3.5" />{n}</span>
                  </div>
                </div>
                <MiniRing score={task.score} />
              </button>
            </li>
          )
        })}
      </ol>
      {!list.length && <div className="rounded-3xl border border-dashed border-stone-200 p-10 text-center text-sm text-stone-500">{tr('catalogEmpty')}</div>}
    </div>
  )
}
