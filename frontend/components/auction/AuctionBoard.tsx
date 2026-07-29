"use client";

import type { AuctionSlot, AuctionState } from "@/lib/types";
import { teamColor } from "@/lib/chartColors";
import { tileStyle } from "@/lib/tileIntensity";

const SLOT_ORDER: AuctionSlot[] = ["telaio", "motore", "pilota1", "pilota2", "sponsor", "benzina"];
const SLOT_SHORT: Record<AuctionSlot, string> = {
  telaio: "TEL",
  motore: "MOT",
  pilota1: "P1",
  pilota2: "P2",
  sponsor: "SPO",
  benzina: "BEN",
};

export function AuctionBoard({ state }: { state: AuctionState }) {
  const maxBase = Math.max(0, ...state.components.map((c) => c.basePrice));
  const compById = new Map(state.components.map((c) => [c.id, c]));
  const activeSlot = state.round?.slot ?? null;
  const justAssigned = new Set(state.lastAssignments.map((a) => a.componentId));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        {/* Intestazione colonne */}
        <div className="grid grid-cols-[132px_repeat(6,1fr)] gap-1.5 px-1 pb-1.5">
          <span />
          {SLOT_ORDER.map((s) => (
            <span
              key={s}
              className={`text-center font-[family-name:var(--font-mono)] text-[9px] uppercase tracking-widest ${
                activeSlot === s ? "text-acid" : "text-bone-dim"
              }`}
            >
              {SLOT_SHORT[s]}
            </span>
          ))}
        </div>

        {/* Righe garage */}
        <div className="space-y-1.5">
          {state.participants.map((p, i) => {
            const color = teamColor(i);
            const spent = state.budgetInitial - p.budget;
            const pct = state.budgetInitial > 0 ? (p.budget / state.budgetInitial) * 100 : 0;
            return (
              <div key={p.teamId} className="grid grid-cols-[132px_repeat(6,1fr)] items-stretch gap-1.5">
                {/* Squadra + budget */}
                <div className="min-w-0 rounded-lg border border-line/70 bg-panel px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-bone">
                      {p.personName}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-carbon-950">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <div className="mt-0.5 flex justify-between font-[family-name:var(--font-mono)] text-[9px] text-bone-dim">
                    <span className="text-acid">{p.budget}</span>
                    <span>-{spent}</span>
                  </div>
                </div>

                {/* Tasselli */}
                {SLOT_ORDER.map((slot) => {
                  const cid = p.garage[slot];
                  const comp = cid ? compById.get(cid) : null;
                  if (comp) {
                    return (
                      <div
                        key={slot}
                        className={`flex min-h-[46px] items-center justify-center rounded-lg border px-1 text-center ${
                          justAssigned.has(comp.id) ? "tile-snap" : ""
                        }`}
                        style={tileStyle(color, comp.basePrice, maxBase)}
                        title={`${comp.name}${comp.basePrice ? ` · ${comp.basePrice}` : ""}`}
                      >
                        <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-carbon-950">
                          {comp.name}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={slot}
                      className={`min-h-[46px] rounded-lg border border-dashed ${
                        activeSlot === slot ? "border-acid/50 bg-acid/5" : "border-line/40 bg-carbon-950/40"
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
