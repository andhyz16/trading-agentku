import { useState } from 'react';
import { applyAndRestartOffice, officeFetch } from '../officeApi';
import type { DeskState } from '../types';
import { POPULAR_SYMBOLS } from '../types';
import { useI18n } from '../i18n';
import { SymbolSearchSelect } from './SymbolSearchSelect';
import { RadarModal, type RadarReportData } from './RadarModal';

export function CommandBar({ state, command }: { state: DeskState; command: (t: string) => Promise<{ ok: boolean; reply: string; data?: any }> }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [symbol, setSymbol] = useState(state.watchlist[0] ?? 'BTCUSDT');
  const [reply, setReply] = useState<{ ok: boolean; reply: string } | null>(null);
  const [killBusy, setKillBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [radarData, setRadarData] = useState<RadarReportData | null>(null);
  const [radarBusy, setRadarBusy] = useState(false);

  const openRadar = async (customSymbols?: string) => {
    const cmd = customSymbols ? `screen ${customSymbols}` : 'screen';
    setRadarBusy(true);
    if (!radarData) {
      setRadarData({ at: Date.now(), items: [] });
    }
    try {
      const res = (await command(cmd)) as any;
      if (res && res.data?.items) {
        setRadarData(res.data);
        setReply(null);
      } else if (res && res.reply) {
        setReply(res);
      }
    } catch (err) {
      setReply({ ok: false, reply: err instanceof Error ? err.message : String(err) });
    } finally {
      setRadarBusy(false);
    }
  };

  const run = async (cmd: string) => {
    if (!cmd.trim()) return;
    if (/^(?:screen|radar)\b/i.test(cmd.trim())) {
      const arg = cmd.replace(/^(?:screen|radar)\s*/i, '').trim();
      await openRadar(arg || undefined);
      return;
    }
    setReply(await command(cmd));
  };
  return (
    <div className="commandbar">
      <div className="cb-row">
        <div className="cb-debate">
          <SymbolSearchSelect
            value={symbol}
            onChange={(sym) => setSymbol(sym)}
            watchlist={state.watchlist}
            popularSymbols={POPULAR_SYMBOLS}
            ariaLabel="symbol"
          />
          <button className="primary" disabled={!!state.debate || state.paused} onClick={() => run(`analyze ${symbol}`)}>
            {state.debate ? `${t('debatingPrefix')} ${state.debate.symbol}...` : t('startDebate')}
          </button>
          <button
            type="button"
            className="radar-btn"
            disabled={radarBusy}
            style={{
              background: '#059669',
              color: '#ffffff',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Radar Pasar Scalping Multi-Koin (Analisis 5 koin sekaligus tanpa entry order)"
            onClick={() => void openRadar()}
          >
            {radarBusy ? 'Scanning…' : '🎯 Radar 5 Koin'}
          </button>
          <button onClick={() => run(state.paused ? 'resume' : 'pause')}>{state.paused ? t('resume') : t('pause')}</button>
          <button className="danger" onClick={() => run('close all')}>{t('closeAll')}</button>
          <button
            type="button"
            className={`kill ${state.killed ? 'is-released' : ''} ${state.mode !== 'PAPER' ? 'is-live' : ''}`}
            title={state.killed ? t('cbKillReleaseTitle') : t('cbKillEngageTitle')}
            disabled={killBusy}
            aria-busy={killBusy}
            onClick={async () => {
              if (killBusy) return;
              setKillBusy(true);
              try {
                const response = await officeFetch('/api/ops/kill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ on: !state.killed }) });
                const result = await response.json();
                setReply({ ok: response.ok && !!result.ok, reply: result.ok ? `${result.killed ? t('cbKillOnMsg') : t('cbKillReleasedMsg')}${result.notes?.length ? ` ${result.notes.join('; ')}` : ''}` : (result.error || t('cbKillFailedMsg')) });
              } catch (error) { setReply({ ok: false, reply: (error as Error).message }); }
              finally { setKillBusy(false); }
            }}
          >
            {state.killed ? t('releaseKillSwitch') : t('killSwitch')}
          </button>
          <button
            type="button"
            className="restart-btn"
            title={t('cbRestartTitle')}
            disabled={restarting}
            aria-busy={restarting}
            onClick={async () => {
              setRestarting(true);
              try { await applyAndRestartOffice(); window.location.reload(); }
              catch (error) { setReply({ ok: false, reply: error instanceof Error ? error.message : 'Restart could not be confirmed.' }); }
              finally { setRestarting(false); }
            }}
          >
            {t('restartOfficeBtn')}
          </button>
        </div>
        <form className="cb-input" onSubmit={(e) => { e.preventDefault(); void run(text); setText(''); }}>
          <span className="prompt">&gt;</span>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('commandPlaceholder')} maxLength={32000} aria-label="command" />
          <button type="submit">{t('runBtn')}</button>
        </form>
      </div>
      {reply && (
        <div
          className={`cb-reply ${reply.ok ? '' : 'err'}`}
          style={{
            whiteSpace: 'pre-wrap',
            textAlign: 'left',
            maxHeight: '260px',
            overflowY: 'auto',
            lineHeight: '1.5',
            fontFamily: 'var(--font-mono, monospace)',
            padding: '10px 14px'
          }}
          onClick={() => setReply(null)}
        >
          {reply.reply}
        </div>
      )}
      {radarData && (
        <RadarModal
          data={radarData}
          busy={radarBusy}
          onRefresh={() => void openRadar()}
          onScanCustom={(symbolsText) => void openRadar(symbolsText)}
          onClose={() => setRadarData(null)}
          onExecuteEntry={async (symbol, side, stop, tp, entry) => {
            const cmd = entry != null
              ? `open ${symbol} ${side} --entry ${entry} --stop ${stop} --tp ${tp}`
              : `open ${symbol} ${side} --stop ${stop} --tp ${tp}`;
            const res = await command(cmd);
            if (res.reply) {
              setReply(res);
            }
            return { ok: !!res.ok, message: res.reply };
          }}
        />
      )}
    </div>
  );
}
