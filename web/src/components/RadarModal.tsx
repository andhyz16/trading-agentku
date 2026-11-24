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
      if (selectedTokens.length >= 8) return;
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
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
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
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '14px',
          border: '1.5px solid #cbd5e1',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1.5px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>🎯</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Radar Pasar Scalping Multi-Koin
              </h3>
              <span
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#dcfce7',
                  color: '#15803d',
                  fontWeight: 800,
                  border: '1px solid #86efac'
                }}
              >
                DRY RUN / 100% SALDO AMAN
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>
              Pilih koin di bawah untuk memindai sinyal scalping serentak tanpa membuka order trading.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '26px',
              cursor: 'pointer',
              padding: '2px 8px',
              lineHeight: 1,
              fontWeight: 700
            }}
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        {/* Coin Selector Bar */}
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1.5px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PILIH KOIN YANG INGIN DI-SCAN ({selectedTokens.length} DIPILIH):
            </span>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Klik tombol koin untuk tambah/kurang</span>
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
                    padding: '4px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? '#059669' : '#ffffff',
                    color: active ? '#ffffff' : '#0f172a',
                    border: active ? '1.5px solid #059669' : '1.5px solid #cbd5e1',
                    boxShadow: active ? '0 2px 4px rgba(5, 150, 105, 0.2)' : 'none'
                  }}
                >
                  {active ? `✓ ${chip}` : `+ ${chip}`}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
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
                fontSize: '13px',
                padding: '7px 12px',
                borderRadius: '6px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600
              }}
            />
            <button
              type="button"
              disabled={busy || selectedTokens.length === 0}
              onClick={handleCustomScan}
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
              }}
            >
              {busy ? 'Memindai…' : '🔍 Scan Koin Pilihan'}
            </button>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div
          style={{
            padding: '10px 20px',
            background: '#f1f5f9',
            display: 'flex',
            gap: '16px',
            fontSize: '12px',
            fontWeight: 800,
            borderBottom: '1.5px solid #e2e8f0'
          }}
        >
          <span style={{ color: '#b91c1c' }}>🔴 {shortCount} Layak SHORT</span>
          <span style={{ color: '#15803d' }}>🟢 {longCount} Layak LONG</span>
          <span style={{ color: '#334155' }}>⚪ {waitCount} Wait / Konsolidasi</span>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc' }}>
          {items.length === 0 && busy && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#334155' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
              <strong style={{ fontSize: '16px', color: '#0f172a' }}>Sedang Memindai Pasar & Mengkalkulasi Tren...</strong>
              <p style={{ fontSize: '13px', margin: '6px 0 0', color: '#475569', fontWeight: 600 }}>Menganalisis likuiditas, tren EMA, dan momentum scalping...</p>
            </div>
          )}
          {items.length === 0 && !busy && (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#334155' }}>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Pilih koin di atas dan klik <strong>🔍 Scan Koin Pilihan</strong> untuk memulai analisa.</p>
            </div>
          )}
          {items.map((item, idx) => {
            const isShort = item.status === 'LAYAK_SHORT';
            const isLong = item.status === 'LAYAK_LONG';
            const borderColor = isShort ? '#fca5a5' : isLong ? '#86efac' : '#cbd5e1';
            const badgeBg = isShort ? '#fee2e2' : isLong ? '#dcfce7' : '#f1f5f9';
            const badgeBorder = isShort ? '#fca5a5' : isLong ? '#86efac' : '#cbd5e1';
            const badgeColor = isShort ? '#991b1b' : isLong ? '#166534' : '#1e293b';
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
                  background: '#ffffff',
                  border: `2px solid ${borderColor}`,
                  borderRadius: '10px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
                }}
              >
                {/* Item Top */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 900, fontSize: '16px', color: '#0f172a', letterSpacing: '0.5px' }}>
                      {idx + 1}. {item.symbol}
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        background: badgeBg,
                        color: badgeColor,
                        fontWeight: 800,
                        fontSize: '11.5px',
                        border: `1px solid ${badgeBorder}`
                      }}
                    >
                      {badgeText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, fontSize: '15px', color: '#0f172a' }}>
                      ${formatPrice(item.price)}
                    </span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: item.change24hPct >= 0 ? '#dcfce7' : '#fee2e2',
                        color: item.change24hPct >= 0 ? '#15803d' : '#b91c1c',
                        border: `1px solid ${item.change24hPct >= 0 ? '#86efac' : '#fca5a5'}`
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
                      background: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '10px',
                      fontSize: '12.5px'
                    }}
                  >
                    <div>
                      <span style={{ color: '#475569', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                        🎯 Entry Acuan
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#0f172a', fontSize: '13.5px', fontWeight: 900 }}>
                        ${formatPrice(item.plan.entry)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#475569', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                        🛑 Stop Loss (SL)
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#b91c1c', fontSize: '13.5px', fontWeight: 900 }}>
                        ${formatPrice(item.plan.stop)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#475569', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                        🏆 Take Profit (TP)
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#15803d', fontSize: '13.5px', fontWeight: 900 }}>
                        ${formatPrice(item.plan.tp)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#475569', display: 'block', fontSize: '11px', fontWeight: 700 }}>
                        ⚖️ Risk/Reward
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono, monospace)', color: '#0f172a', fontSize: '13.5px', fontWeight: 900 }}>
                        {item.plan.riskReward}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div style={{ fontSize: '13px', color: '#0f172a', lineHeight: '1.5', fontWeight: 500, background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>Alasan: </span>
                  {item.reason}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1.5px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
          }}
        >
          <span style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>
            💡 Saldo tetap utuh. Tidak ada order yang dieksekusi ke bursa.
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              disabled={busy}
              onClick={onRefresh}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700
              }}
            >
              {busy ? 'Memindai…' : '🔄 Refresh Data'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 20px',
                borderRadius: '6px',
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 800,
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)'
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
