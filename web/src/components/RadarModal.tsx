import React, { useState } from 'react';

export interface RadarItem {
  symbol: string;
  price: number;
  change24hPct: number;
  status: 'LAYAK_SHORT' | 'LAYAK_LONG' | 'WAIT';
  confidence: number;
  reason: string;
  plan?: {
    entry: number;
    stop: number;
    tp: number;
    riskReward: string;
  };
}

export interface RadarReportData {
  at: number;
  items: RadarItem[];
}

const POPULAR_CHIPS = ['BTC', 'ETH', 'SOL', 'XAU', 'DOGE', 'PEPE', 'XRP', 'BNB', 'SUI', 'NEAR'];

export function RadarModal({
  data,
  onClose,
  onRefresh,
  onScanCustom,
  busy
}: {
  data: RadarReportData;
  onClose: () => void;
  onRefresh: () => void;
  onScanCustom?: (symbolsText: string) => void;
  busy?: boolean;
}) {
  const items = data.items || [];
  const shortCount = items.filter((i) => i.status === 'LAYAK_SHORT').length;
  const longCount = items.filter((i) => i.status === 'LAYAK_LONG').length;
  const waitCount = items.filter((i) => i.status === 'WAIT').length;

  // Initialize selected symbols from current items or defaults
  const [selectedTokens, setSelectedTokens] = useState<string[]>(() => {
    const fromItems = items.map((i) =>
      i.symbol.replace(/USDT$|USD$/, '').replace(/^XAU$/, 'XAU')
    );
    return fromItems.length > 0 ? fromItems : ['BTC', 'ETH', 'SOL', 'DOGE', 'XAU'];
  });
  const [customInput, setCustomInput] = useState('');

  const toggleToken = (token: string) => {
    const clean = token.toUpperCase().trim();
    if (selectedTokens.includes(clean)) {
      setSelectedTokens(selectedTokens.filter((t) => t !== clean));
    } else {
      if (selectedTokens.length >= 8) return; // Cap at 8 for speed
      setSelectedTokens([...selectedTokens, clean]);
    }
  };

  const handleCustomScan = () => {
    const list = [...selectedTokens];
    if (customInput.trim()) {
      const extra = customInput
        .split(/[\s,]+/)
        .map((s) => s.toUpperCase().trim())
        .filter(Boolean);
      for (const e of extra) {
        if (!list.includes(e)) list.push(e);
      }
    }
    if (list.length > 0 && onScanCustom) {
      onScanCustom(list.join(' '));
    }
  };

  const formatPrice = (p: number) => {
    if (p >= 100) {
      return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return p >= 1 ? p.toFixed(4) : p.toFixed(6);
  };

  return (
    <div
      className="setup-overlay"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          background: 'var(--panel, #1e2022)',
          color: 'var(--text, #e2e8f0)',
          borderRadius: '14px',
          border: '1px solid var(--line, rgba(255, 255, 255, 0.14))',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>🎯</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Radar Pasar Scalping Multi-Koin
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  fontWeight: 700
                }}
              >
                DRY RUN / BEBAS RESIKO
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-dim, #94a3b8)' }}>
              Pilih koin di bawah untuk memindai sinyal scalping serentak tanpa membuka order trading.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim, #94a3b8)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1
            }}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        {/* Coin Selector Bar */}
        <div
          style={{
            padding: '12px 20px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-dim, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pilih Koin Yang Ingin Di-Scan ({selectedTokens.length} dipilih):
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Klik chip untuk tambah/kurang</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {POPULAR_CHIPS.map((chip) => {
              const active = selectedTokens.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleToken(chip)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '16px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? '#10b981' : 'rgba(255, 255, 255, 0.06)',
                    color: active ? '#ffffff' : 'var(--text-dim, #94a3b8)',
                    border: active ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {active ? `✓ ${chip}` : `+ ${chip}`}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="Atau ketik koin lain (misal: PEPE XRP SUI)..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCustomScan();
              }}
              style={{
                flex: 1,
                fontSize: '12px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#fff'
              }}
            />
            <button
              type="button"
              disabled={busy || selectedTokens.length === 0}
              onClick={handleCustomScan}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                background: '#059669',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '12px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {busy ? 'Memindai…' : '🔍 Scan Koin Pilihan'}
            </button>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div
          style={{
            padding: '8px 20px',
            background: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            gap: '14px',
            fontSize: '11.5px',
            fontWeight: 700,
            borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.05))'
          }}
        >
          <span style={{ color: '#ef4444' }}>🔴 {shortCount} Layak SHORT</span>
          <span style={{ color: '#10b981' }}>🟢 {longCount} Layak LONG</span>
          <span style={{ color: '#94a3b8' }}>⚪ {waitCount} Wait / Konsolidasi</span>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.length === 0 && busy && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
              <strong style={{ fontSize: '15px', color: '#e2e8f0' }}>Sedang Memindai Pasar & Mengkalkulasi Tren...</strong>
              <p style={{ fontSize: '12px', margin: '6px 0 0', color: '#64748b' }}>Menganalisis likuiditas, EMA, dan momentum scalping...</p>
            </div>
          )}
          {items.length === 0 && !busy && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <p>Pilih koin di atas dan klik <strong>🔍 Scan Koin Pilihan</strong> untuk memulai.</p>
            </div>
          )}
          {items.map((item, idx) => {
            const isShort = item.status === 'LAYAK_SHORT';
            const isLong = item.status === 'LAYAK_LONG';
            const borderColor = isShort ? '#ef4444' : isLong ? '#10b981' : 'rgba(255, 255, 255, 0.1)';
            const badgeBg = isShort
              ? 'rgba(239, 68, 68, 0.15)'
              : isLong
              ? 'rgba(16, 185, 129, 0.15)'
              : 'rgba(148, 163, 184, 0.1)';
            const badgeColor = isShort ? '#f87171' : isLong ? '#34d399' : '#94a3b8';
            const badgeText = isShort
              ? 'LAYAK ENTRY (SHORT)'
              : isLong
              ? 'LAYAK ENTRY (LONG)'
              : 'HINDARI / WAIT (HOLD)';
            const changeSign = item.change24hPct >= 0 ? '+' : '';

            return (
              <div
                key={item.symbol}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                {/* Item Top */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px' }}>
                      {idx + 1}. {item.symbol}
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: badgeBg,
                        color: badgeColor,
                        fontWeight: 700,
                        fontSize: '11px'
                      }}
                    >
                      {badgeText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, fontSize: '14px' }}>
                      ${formatPrice(item.price)}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: item.change24hPct >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: item.change24hPct >= 0 ? '#34d399' : '#f87171'
                      }}
                    >
                      {changeSign}{item.change24hPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Plan Box if Actionable */}
                {item.plan && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                      fontSize: '12px'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block', fontSize: '10.5px' }}>
                        🎯 Entry Acuan
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                        ${formatPrice(item.plan.entry)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block', fontSize: '10.5px' }}>
                        🛑 Stop Loss (SL)
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#f87171' }}>
                        ${formatPrice(item.plan.stop)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block', fontSize: '10.5px' }}>
                        🏆 Take Profit (TP)
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#34d399' }}>
                        ${formatPrice(item.plan.tp)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-dim, #94a3b8)', display: 'block', fontSize: '10.5px' }}>
                        ⚖️ Risk/Reward
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                        {item.plan.riskReward}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.45' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-dim, #94a3b8)' }}>Alasan: </span>
                  {item.reason}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <span style={{ fontSize: '11.5px', color: 'var(--text-dim, #94a3b8)' }}>
            💡 Saldo tetap utuh. Tidak ada order yang dieksekusi ke bursa.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              disabled={busy}
              onClick={onRefresh}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              {busy ? 'Memindai…' : '🔄 Refresh Data'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
