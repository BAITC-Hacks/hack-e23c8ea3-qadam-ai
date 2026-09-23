import { Braces, X, ShieldCheck, CircleAlert, Info } from 'lucide-react'
import { FONT_DISPLAY } from '../../lib/scoring.js'
import { AI_PROMPT, analyzeDraft } from '../../lib/ai.js'
import { SEED_DRAFTS } from '../../data/seed.js'
import { useT } from '../../i18n/LangContext.jsx'
import { Block } from './Block.jsx'

export function AIModal({ ai, draft, onClose }) {
  const t = useT()
  const sampleDraft = draft || SEED_DRAFTS[0].text
  const out = ai ? JSON.parse(ai.raw) : analyzeDraft(sampleDraft)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-overlay/30 backdrop-blur-sm" onClick={onClose} />
      <div className="q-in relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-stone-200 bg-surface p-5 sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-orange-600"><Braces className="size-3.5" />{t('aiHood')}</div>
            <h2 className="mt-1 text-lg text-stone-900" style={{ ...FONT_DISPLAY, fontWeight: 600 }}>{t('aiTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"><X className="size-4" /></button>
        </div>
        <div className="mt-5 space-y-4">
          <Block title={t('aiPrompt')}>{AI_PROMPT}</Block>
          <Block title={t('aiIn')}>{JSON.stringify({ draft: sampleDraft }, null, 2)}</Block>
          <Block title={t('aiOut')}>{JSON.stringify(out, null, 2)}</Block>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { i: ShieldCheck, titleKey: 'aiRule1t', descKey: 'aiRule1d' },
              { i: CircleAlert, titleKey: 'aiRule2t', descKey: 'aiRule2d' },
              { i: Info, titleKey: 'aiRule3t', descKey: 'aiRule3d' },
            ].map((x) => (
              <div key={x.titleKey} className="rounded-xl border border-stone-200 p-3">
                <x.i className="size-4 text-orange-600" />
                <div className="mt-2 text-xs font-medium text-stone-900">{t(x.titleKey)}</div>
                <div className="mt-0.5 text-[11px] text-stone-500">{t(x.descKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
