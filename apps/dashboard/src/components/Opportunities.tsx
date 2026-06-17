import { useState } from 'react';
import type { Opportunity } from '../types.js';
import { ConfirmDots, FamilyTag, Panel, ScoreBar } from './ui.js';
import { usd } from '../format.js';

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const [open, setOpen] = useState(false);
  const d = opp.decision;
  const isEnter = d.action === 'ENTER';
  return (
    <div className="border border-terminal-border rounded-md mb-2 bg-terminal-bg/40">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-3 py-2 text-left">
        <span className="font-semibold w-20 truncate">{opp.token.symbol}</span>
        <span className={`tag ${isEnter ? 'border-up/40 text-up' : 'border-terminal-border text-terminal-muted'}`}>
          {d.action}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-terminal-muted w-16">conviction</span>
            <div className="flex-1 max-w-[160px]">
              <ScoreBar value={d.conviction} />
            </div>
            <span className="tabular-nums text-xs w-10 text-right">{d.conviction.toFixed(2)}</span>
          </div>
        </div>
        <ConfirmDots count={d.confirmations} />
        {isEnter && d.sizeUsd != null && <span className="tabular-nums text-xs text-terminal-muted w-16 text-right">{usd(d.sizeUsd)}</span>}
        <span className="text-terminal-muted text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-terminal-border/50 pt-2 space-y-2">
          <div className="space-y-1">
            {d.contributions
              .slice()
              .sort((a, b) => b.weightedScore - a.weightedScore)
              .map((c) => (
                <div key={c.signalId} className="flex items-center gap-2">
                  <FamilyTag family={c.family} />
                  <span className="text-[11px] text-terminal-muted w-36 truncate" title={c.signalId}>
                    {c.signalId}
                  </span>
                  <div className="flex-1 max-w-[120px]">
                    <ScoreBar value={c.score} />
                  </div>
                  <span className="text-[11px] text-terminal-muted flex-1 truncate" title={c.evidence[0]}>
                    {c.evidence[0]}
                  </span>
                </div>
              ))}
          </div>
          {d.rejectionReason && (
            <div className="text-[11px] text-amber-300/80">Not taken: {d.rejectionReason}</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Opportunities({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <Panel
      title="High-Confidence Opportunities"
      right={<span className="text-terminal-muted">ranked by conviction</span>}
    >
      {opportunities.length === 0 ? (
        <div className="text-terminal-muted text-xs py-6 text-center">Scanning the market…</div>
      ) : (
        opportunities.map((o) => <OpportunityCard key={o.decision.id} opp={o} />)
      )}
    </Panel>
  );
}
