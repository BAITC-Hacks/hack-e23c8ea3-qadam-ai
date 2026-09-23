import { Trophy } from 'lucide-react'
import { Panel } from '../ui/Panel.jsx'
import { Avatar } from '../ui/Avatar.jsx'
import { GrowthCard } from './GrowthCard.jsx'
import { cx } from '../../lib/cx.js'
import { FONT_DISPLAY, FONT_MONO, LEVELS } from '../../lib/scoring.js'
import { useT } from '../../i18n/LangContext.jsx'

export function ImpactPanel({ tasks, proposals, teams, role, teamId, history }) {
  const t = useT()
  const avg = Math.round(tasks.reduce((s, task) => s + task.score, 0) / tasks.length)
  const ready = tasks.filter((task) => task.score >= 70).length
  const dist = [...LEVELS].reverse().map((l, i, arr) => ({ ...l, n: tasks.filter((task) => task.score >= l.min && task.score < (arr[i + 1]?.min ?? 101)).length }))
  const board = [...teams].sort((a, b) => b.points - a.points)
  return (
    <>
      <div className="grid grid-cols-3 gap-2 xl:mt-0">
        {[
          { v: tasks.length, l: t('statTasks') },
          { v: avg, l: t('statAvg'), accent: true },
          { v: proposals.length, l: t('statProps') },
        ].map((s) => (
          <Panel key={s.l} className="px-3 py-3.5 text-center" glow={s.accent}>
            <div className={cx('text-2xl tabular-nums', s.accent ? 'text-orange-600' : 'text-stone-900')} style={{ ...FONT_DISPLAY, fontWeight: 600 }}>{s.v}</div>
            <div className="mt-0.5 text-[11px] text-stone-500">{s.l}</div>
          </Panel>
        ))}
      </div>

      {history.length > 1 && <GrowthCard history={history} />}

      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-900">{t('catalogReady')}</span>
          <span className="text-xs text-stone-500 tabular-nums">{ready} {t('readyOf', { n: tasks.length })}</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
          {dist.map((d) => d.n > 0 && <div key={d.key} className={d.bar} style={{ width: `${(d.n / tasks.length) * 100}%` }} />)}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {dist.map((d) => (
            <li key={d.key} className="flex items-center gap-2 text-xs text-stone-500"><span className={cx('size-2 rounded-full', d.dot)} />{t(`level_${d.key}`)}<span className="ml-auto tabular-nums text-stone-500">{d.n}</span></li>
          ))}
        </ul>
      </Panel>

      {role === 'student' && (
        <Panel className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-900"><Trophy className="size-4 text-orange-600" />{t('teamPoints')}</div>
          <ol className="space-y-2">
            {board.map((team, i) => (
              <li key={team.id} className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm', team.id === teamId && 'bg-orange-50')}>
                <span className="w-4 text-xs tabular-nums text-stone-400">{i + 1}</span>
                <Avatar team={team} size="sm" />
                <span className={cx('flex-1', team.id === teamId ? 'font-medium text-stone-900' : 'text-stone-600')}>{team.name}</span>
                <span className="tabular-nums text-stone-600" style={FONT_MONO}>{team.points}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </>
  )
}
