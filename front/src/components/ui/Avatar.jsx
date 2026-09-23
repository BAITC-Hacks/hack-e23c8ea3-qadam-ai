import { cx } from '../../lib/cx.js'
import { FONT_DISPLAY } from '../../lib/scoring.js'
import { TEAM_TINT } from '../../data/seed.js'

export function Avatar({ team, size = 'md' }) {
  const s = size === 'sm' ? 'size-7 text-[11px]' : 'size-11 text-sm'
  return <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold', s, TEAM_TINT[team.id] || 'bg-stone-100 text-stone-700')} style={FONT_DISPLAY}>{team.captain?.[0] || team.name[0]}</div>
}
