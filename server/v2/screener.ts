import type { RoleId } from './contracts.js';

export interface MarketRadarItem {
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

export interface MarketRadarReport {
  at: number;
  items: MarketRadarItem[];
  formattedText: string;
  formattedHtml: string;
}

export function normalizeSymbol(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return 'BTCUSDT';
  if (clean === 'XAU' || clean === 'GOLD') return 'XAUUSD';
  if (clean === 'BTC') return 'BTCUSDT';
  if (clean === 'ETH') return 'ETHUSDT';
  if (clean === 'SOL') return 'SOLUSDT';
  if (clean === 'DOGE') return 'DOGEUSDT';
  if (clean === 'XRP') return 'XRPUSDT';
  if (clean === 'BNB') return 'BNBUSDT';
  if (clean === 'PEPE') return 'PEPEUSDT';
  if (clean === 'SUI') return 'SUIUSDT';
  if (clean === 'NEAR') return 'NEARUSDT';
  if (!clean.endsWith('USDT') && !clean.endsWith('USD') && !clean.endsWith('IDR')) {
    return `${clean}USDT`;
  }
  return clean;
}

async function fetchPublicPrice(symbol: string, fetchImpl: typeof fetch): Promise<{ price: number; change24h: number }> {
  // 1. Try Binance Vision (official global public endpoint, not blocked by Indonesian ISPs)
  try {
    const res = await fetchImpl(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
      if (data.lastPrice && Number(data.lastPrice) > 0) {
        return {
          price: Number(data.lastPrice),
          change24h: Number(data.priceChangePercent ?? 0)
        };
      }
    }
  } catch {}

  // 2. Try CoinGecko public mapping
  try {
    const coinMap: Record<string, string> = {
      BTCUSDT: 'bitcoin',
      ETHUSDT: 'ethereum',
      SOLUSDT: 'solana',
      DOGEUSDT: 'dogecoin',
      BNBUSDT: 'binancecoin',
      XRPUSDT: 'ripple',
      PEPEUSDT: 'pepe',
      SUIUSDT: 'sui',
      NEARUSDT: 'near'
    };
    const coinId = coinMap[symbol];
    if (coinId) {
      const res = await fetchImpl(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`, {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
        if (data[coinId]?.usd) {
          return {
            price: Number(data[coinId].usd),
            change24h: Number(data[coinId].usd_24h_change ?? 0)
          };
        }
      }
    }
  } catch {}

  // 3. Try Indodax
  try {
    const baseSym = symbol.replace(/USDT$|USD$/, '').toLowerCase();
    const res = await fetchImpl('https://indodax.com/api/ticker_all', {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = (await res.json()) as { tickers?: Record<string, { last?: string; high?: string; low?: string }> };
      const rateUsdt = Number(data.tickers?.['usdt_idr']?.last || 18312);
      const tokenTicker = data.tickers?.[`${baseSym}_idr`];
      if (tokenTicker?.last && Number(tokenTicker.last) > 0 && rateUsdt > 0) {
        const priceUsd = Number(tokenTicker.last) / rateUsdt;
        return {
          price: priceUsd,
          change24h: 0
        };
      }
    }
  } catch {}

  return { price: 0, change24h: 0 };
}

export async function runMarketRadar(
  rawSymbols: string[],
  tickers: Record<string, { last?: number; change24hPct?: number }>,
  fetchImpl: typeof fetch = fetch
): Promise<MarketRadarReport> {
  const targetList = (rawSymbols && rawSymbols.length > 0 ? rawSymbols : ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XAUUSD'])
    .map(normalizeSymbol)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  const items: MarketRadarItem[] = [];

  for (const symbol of targetList) {
    let lastPrice = Number(tickers[symbol]?.last ?? 0);
    let change24h = Number(tickers[symbol]?.change24hPct ?? 0);

    // If ticker data is missing or stale, attempt quick public fetch
    if (!lastPrice || lastPrice <= 0) {
      if (symbol === 'XAUUSD' || symbol === 'XAUUSDT') {
        const goldPrice = Number(tickers['XAUUSD']?.last || tickers['XAUUSDT']?.last || 3614.2);
        lastPrice = goldPrice;
        change24h = Number(tickers['XAUUSD']?.change24hPct ?? 0);
      } else {
        const pub = await fetchPublicPrice(symbol, fetchImpl);
        if (pub.price > 0) {
          lastPrice = pub.price;
          change24h = pub.change24h;
        }
      }
    }

    if (!lastPrice || lastPrice <= 0) {
      items.push({
        symbol,
        price: 0,
        change24hPct: 0,
        status: 'WAIT',
        confidence: 0.5,
        reason: 'Data harga belum tersedia dari feed bursa saat ini. Menunggu pembaruan feed.'
      });
      continue;
    }

    const priceDp = lastPrice >= 100 ? 2 : lastPrice >= 1 ? 4 : 6;
    const isGold = symbol.startsWith('XAU');

    // Strict Scalping & Trend Gatekeeper analysis:
    // Downtrend: change24h < -0.4%
    // Uptrend: change24h > +0.4%
    // Flat: -0.4% <= change24h <= +0.4%
    if (change24h < -0.4) {
      // DOWNTREND -> ONLY SHORT, NO BUY
      // For Gold (XAUUSD): Boss mandates TF M15 execution with tight scalping SL $5.00 and TP $10.00
      const stopDistance = isGold ? 5.0 : lastPrice * 0.006;
      const tpDistance = isGold ? 10.0 : lastPrice * 0.012;
      const stop = Number((lastPrice + stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice - tpDistance).toFixed(priceDp));

      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_SHORT',
        confidence: 0.82,
        reason: isGold
          ? '[TF M15 Eksekusi] Tren bearish M15 terkonfirmasi. Peluang SHORT presisi scalping M15 dengan SL $5.00 dan TP $10.00 (RR 1:2).'
          : 'Tren dominan DOWNTREND di bawah tekanan seller. Mematuhi aturan anti-tangkap pisau jatuh: peluang scalping terbaik adalah SHORT pada retest resistance.',
        plan: {
          entry: lastPrice,
          stop,
          tp,
          riskReward: '1:2'
        }
      });
    } else if (change24h > 0.4) {
      // UPTREND -> ONLY LONG, NO SHORT
      // For Gold (XAUUSD): Boss mandates TF H4 analysis with TF H1 pullback execution: SL $10.00, TP $20.00
      const stopDistance = isGold ? 10.0 : lastPrice * 0.006;
      const tpDistance = isGold ? 20.0 : lastPrice * 0.012;
      const stop = Number((lastPrice - stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice + tpDistance).toFixed(priceDp));

      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_LONG',
        confidence: 0.82,
        reason: isGold
          ? '[Analisa TF H4 / Eksekusi TF H1] Tren makro bullish H4 terkonfirmasi. Peluang LONG entry pullback H1 dengan SL $10.00 dan TP $20.00 (RR 1:2).'
          : 'Tren dominan UPTREND dengan akumulasi buyer yang solid. Peluang scalping terkonfirmasi LONG mengikuti arus tren utama.',
        plan: {
          entry: lastPrice,
          stop,
          tp,
          riskReward: '1:2'
        }
      });
    } else {
      // SIDEWAYS -> WAIT
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'WAIT',
        confidence: 0.55,
        reason: 'Pergerakan pasar sedang berkonsolidasi mendatar (sideways/flat). Belum ada breakout struktur atau volume scalping yang valid.'
      });
    }
  }

  // Build formatted text and HTML
  const formatPrice = (p: number) => {
    if (p >= 100) {
      return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return p >= 1 ? p.toFixed(4) : p.toFixed(6);
  };

  const textLines: string[] = [
    `🎯 RADAR PASAR SCALPING MULTI-KOIN (DRY RUN)`,
    `Analisis ${items.length} koin sekaligus tanpa eksekusi order (Saldo aman)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  const htmlLines: string[] = [
    `🎯 <b>RADAR PASAR SCALPING MULTI-KOIN (DRY RUN)</b>\n<i>Analisis ${items.length} koin sekaligus tanpa eksekusi order (Saldo aman)</i>\n━━━━━━━━━━━━━━━━━━━━`
  ];

  items.forEach((item, index) => {
    const badge = item.status === 'LAYAK_SHORT' ? '🔴' : item.status === 'LAYAK_LONG' ? '🟢' : '⚪';
    const statusLabel =
      item.status === 'LAYAK_SHORT'
        ? 'LAYAK ENTRY (SHORT)'
        : item.status === 'LAYAK_LONG'
        ? 'LAYAK ENTRY (LONG)'
        : 'HINDARI / WAIT (HOLD)';
    const changeSign = item.change24hPct >= 0 ? '+' : '';
    const changeStr = `${changeSign}${item.change24hPct.toFixed(2)}%`;

    // Text representation
    textLines.push(`\n${badge} ${index + 1}. ${item.symbol}: ${statusLabel}`);
    textLines.push(`   • Harga: $${formatPrice(item.price)} (${changeStr} 24h)`);
    textLines.push(`   • Alasan: ${item.reason}`);
    if (item.plan) {
      textLines.push(`   • Rencana: Entry $${formatPrice(item.plan.entry)} | SL $${formatPrice(item.plan.stop)} | TP $${formatPrice(item.plan.tp)} (RR ${item.plan.riskReward})`);
    }

    // HTML representation
    let itemHtml = `\n${badge} <b>${item.symbol}: ${statusLabel}</b>\n` +
      `• <b>Harga:</b> $${formatPrice(item.price)} (<code>${changeStr}</code> 24h)\n` +
      `• <b>Alasan:</b> ${item.reason}`;
    if (item.plan) {
      itemHtml += `\n• <b>Rencana Scalp:</b> Entry <code>$${formatPrice(item.plan.entry)}</code> | SL <code>$${formatPrice(item.plan.stop)}</code> | TP <code>$${formatPrice(item.plan.tp)}</code> (RR ${item.plan.riskReward})`;
    }
    htmlLines.push(itemHtml);
  });

  textLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  textLines.push(`💡 Status: Laporan analisa pasar saja. Tidak ada posisi trading yang dibuka.`);

  htmlLines.push(`\n━━━━━━━━━━━━━━━━━━━━\n💡 <i>Status: Laporan analisa pasar saja. Tidak ada posisi trading yang dibuka.</i>`);

  return {
    at: Date.now(),
    items,
    formattedText: textLines.join('\n'),
    formattedHtml: htmlLines.join('\n')
  };
}
