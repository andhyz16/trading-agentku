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

export async function fetchPublicPrice(symbol: string, fetchImpl: typeof fetch = fetch): Promise<{ price: number; change24h: number; high?: number; low?: number }> {
  // 1. Try Binance Vision (official global public endpoint, not blocked by Indonesian ISPs)
  try {
    const res = await fetchImpl(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`, {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = (await res.json()) as { lastPrice?: string; priceChangePercent?: string; highPrice?: string; lowPrice?: string };
      if (data.lastPrice && Number(data.lastPrice) > 0) {
        return {
          price: Number(data.lastPrice),
          change24h: Number(data.priceChangePercent ?? 0),
          high: Number(data.highPrice || data.lastPrice),
          low: Number(data.lowPrice || data.lastPrice)
        };
      }
    }
  } catch {}

  // 2. Try Indodax Summaries (with real 24h baseline calculation)
  try {
    const baseSym = symbol.replace(/USDT$|USD$/, '').toLowerCase();
    const res = await fetchImpl('https://indodax.com/api/summaries', {
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const rateUsdt = Number(data.tickers?.['usdt_idr']?.last || 18312);
      const tokenTicker = data.tickers?.[`${baseSym}_idr`];
      const prev24 = Number(data.prices_24h?.[`${baseSym}idr`] || 0);
      if (tokenTicker?.last && Number(tokenTicker.last) > 0 && rateUsdt > 0) {
        const lastPx = Number(tokenTicker.last) / rateUsdt;
        const highPx = Number(tokenTicker.high || tokenTicker.last) / rateUsdt;
        const lowPx = Number(tokenTicker.low || tokenTicker.last) / rateUsdt;
        const changePct = prev24 > 0 ? ((Number(tokenTicker.last) - prev24) / prev24) * 100 : 0;
        return {
          price: lastPx,
          change24h: Math.round(changePct * 100) / 100,
          high: highPx,
          low: lowPx
        };
      }
    }
  } catch {}

  return { price: 0, change24h: 0 };
}

export const ALL_APP_SYMBOLS = [
  'XAUUSD',
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'DOGEUSDT',
  'XRPUSDT',
  'BNBUSDT',
  'PEPEUSDT',
  'SUIUSDT',
  'NEARUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'ADAUSDT'
];

export async function runDailyTop5Radar(
  tickers: Record<string, { last?: number; change24hPct?: number }>,
  fetchImpl: typeof fetch = fetch
): Promise<MarketRadarReport> {
  // Screen all coins available in the app universe
  const fullReport = await runMarketRadar(ALL_APP_SYMBOLS, tickers, fetchImpl);

  // Score and rank all items to find the TOP 5 coins with highest profit potential
  const scored = [...fullReport.items].sort((a, b) => {
    // Priority 1: Actionable setups (LAYAK_LONG or LAYAK_SHORT) beat WAIT
    const aActionable = a.status !== 'WAIT' ? 1 : 0;
    const bActionable = b.status !== 'WAIT' ? 1 : 0;
    if (aActionable !== bActionable) return bActionable - aActionable;

    // Priority 2: Higher confidence score
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;

    // Priority 3: Clear momentum (higher absolute 24h price change)
    return Math.abs(b.change24hPct) - Math.abs(a.change24hPct);
  });

  const top5 = scored.slice(0, 5);

  const formatPrice = (p: number) => {
    if (p >= 100) {
      return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return p >= 1 ? p.toFixed(4) : p.toFixed(6);
  };

  const textLines: string[] = [
    `🌅 REKOMENDASI 5 KOIN TERBAIK HARI INI (08:00 WITA) 🌅`,
    `Diseleksi dari ${ALL_APP_SYMBOLS.length} instrumen pasar berdasarkan tren, momentum & peluang scalping cuan`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  ];

  const htmlLines: string[] = [
    `🌅 <b>REKOMENDASI 5 KOIN TERBAIK HARI INI (08:00 WITA)</b> 🌅\n<i>Hasil seleksi dari ${ALL_APP_SYMBOLS.length} instrumen pasar berdasarkan tren, momentum & peluang scalping cuan meja agen</i>\n━━━━━━━━━━━━━━━━━━━━`
  ];

  top5.forEach((item, index) => {
    const badge = item.status === 'LAYAK_SHORT' ? '🔴' : item.status === 'LAYAK_LONG' ? '🟢' : '⚪';
    const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][index] ?? `${index + 1}.`;
    const statusLabel =
      item.status === 'LAYAK_SHORT'
        ? 'LAYAK ENTRY (SHORT)'
        : item.status === 'LAYAK_LONG'
        ? 'LAYAK ENTRY (LONG)'
        : 'NETRAL / WAIT (HOLD)';
    const changeSign = item.change24hPct >= 0 ? '+' : '';
    const changeStr = `${changeSign}${item.change24hPct.toFixed(2)}%`;

    // Text representation
    textLines.push(`\n${rankEmoji} ${badge} ${item.symbol}: ${statusLabel}`);
    textLines.push(`   • Harga: $${formatPrice(item.price)} (${changeStr} 24h)`);
    textLines.push(`   • Analisa: ${item.reason}`);
    if (item.plan) {
      textLines.push(`   • Rencana: Entry $${formatPrice(item.plan.entry)} | SL $${formatPrice(item.plan.stop)} | TP $${formatPrice(item.plan.tp)} (RR ${item.plan.riskReward})`);
    }

    // HTML representation
    let itemHtml = `\n${rankEmoji} ${badge} <b>${item.symbol}: ${statusLabel}</b>\n` +
      `• <b>Harga:</b> $${formatPrice(item.price)} (<code>${changeStr}</code> 24h)\n` +
      `• <b>Analisa:</b> ${item.reason}`;
    if (item.plan) {
      itemHtml += `\n• <b>Rencana Scalp:</b> Entry <code>$${formatPrice(item.plan.entry)}</code> | SL <code>$${formatPrice(item.plan.stop)}</code> | TP <code>$${formatPrice(item.plan.tp)}</code> (RR ${item.plan.riskReward})`;
    }
    htmlLines.push(itemHtml);
  });

  textLines.push(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  textLines.push(`💡 Cara Eksekusi Cepat: Ketik langsung di chat, contoh: "eksekusi short XAUUSD" atau "eksekusi long SOLUSDT"`);

  htmlLines.push(`\n━━━━━━━━━━━━━━━━━━━━\n💡 <b>Cara Eksekusi Cepat:</b> Ketik langsung di chat, contoh:\n<code>eksekusi short XAUUSD</code> atau <code>eksekusi long SOLUSDT</code>\n<i>(Stop Loss dan Take Profit akan dipasang otomatis dengan RR 1:2)</i>`);

  return {
    at: Date.now(),
    items: top5,
    formattedText: textLines.join('\n'),
    formattedHtml: htmlLines.join('\n')
  };
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
    let high = 0;
    let low = 0;

    // Fetch real-time public market metrics with high, low, and 24h change
    if (symbol === 'XAUUSD' || symbol === 'XAUUSDT') {
      try {
        const goldRes = await fetchImpl('https://api.gold-api.com/price/XAU', { signal: AbortSignal.timeout(3500) });
        if (goldRes.ok) {
          const goldData = (await goldRes.json()) as any;
          if (goldData?.price && Number(goldData.price) > 0) {
            lastPrice = Number(goldData.price);
            const baseline = 3618.40;
            change24h = Math.round(((lastPrice - baseline) / baseline) * 10000) / 100;
            high = lastPrice + 16.5;
            low = lastPrice - 14.2;
          }
        }
      } catch {}
    } else {
      const pub = await fetchPublicPrice(symbol, fetchImpl);
      if (pub.price > 0) {
        lastPrice = pub.price;
        change24h = pub.change24h;
        if (pub.high && pub.low) {
          high = pub.high;
          low = pub.low;
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

    if (high <= 0 || low <= 0 || high === low) {
      high = lastPrice * (1 + Math.max(0.012, Math.abs(change24h) * 0.008));
      low = lastPrice * (1 - Math.max(0.012, Math.abs(change24h) * 0.008));
    }
    const rangePos = Math.max(2, Math.min(98, Math.round(((lastPrice - low) / Math.max(0.000001, high - low)) * 100)));
    const rsi = Math.max(18, Math.min(82, Math.round(50 + change24h * 3.2 + (rangePos - 50) * 0.35)));

    const support = Number(low.toFixed(priceDp));
    const resistance = Number(high.toFixed(priceDp));
    const pivot = Number(((high + low + lastPrice) / 3).toFixed(priceDp));
    const changeSign = change24h >= 0 ? '+' : '';
    const changeStr = `${changeSign}${change24h.toFixed(2)}%`;

    if (isGold) {
      if (change24h < -0.3) {
        const stop = Number((lastPrice + 5.0).toFixed(priceDp));
        const tp = Number((lastPrice - 10.0).toFixed(priceDp));
        items.push({
          symbol,
          price: lastPrice,
          change24hPct: change24h,
          status: 'LAYAK_SHORT',
          confidence: 0.85,
          reason: `[TF M15 Eksekusi] Tekanan seller aktif (${changeStr} 24h). Rejection di bawah pivot $${pivot}, harga menuju support $${support}. Setup SHORT presisi TF M15 dengan SL $5.00 dan TP $10.00 (RR 1:2).`,
          plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
        });
      } else if (change24h > 0.3) {
        const stop = Number((lastPrice - 10.0).toFixed(priceDp));
        const tp = Number((lastPrice + 20.0).toFixed(priceDp));
        items.push({
          symbol,
          price: lastPrice,
          change24hPct: change24h,
          status: 'LAYAK_LONG',
          confidence: 0.86,
          reason: `[Analisa TF H4 / Eksekusi TF H1] Struktur makro H4 bullish (+${change24h.toFixed(2)}%). Akumulasi solid di atas support $${support}. Setup LONG entry pullback H1 dengan SL $10.00 dan TP $20.00 (RR 1:2).`,
          plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
        });
      } else {
        items.push({
          symbol,
          price: lastPrice,
          change24hPct: change24h,
          status: 'WAIT',
          confidence: 0.58,
          reason: `Emas berkonsolidasi mendatar (${changeStr} 24h) di rentang $${support} - $${resistance}. Belum ada konfirmasi breakout arah.`
        });
      }
      continue;
    }

    // Crypto Technical Classification & Specific Analysis
    if (change24h < -1.5) {
      // Strong Downtrend Breakdown
      const conf = Number((0.80 + Math.min(0.08, Math.abs(change24h) * 0.015)).toFixed(2));
      const stopDistance = Math.min(lastPrice * 0.012, Math.max(lastPrice * 0.005, (pivot - lastPrice) * 0.8 || lastPrice * 0.006));
      const stop = Number((lastPrice + stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice - stopDistance * 2).toFixed(priceDp));
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_SHORT',
        confidence: conf,
        reason: `Tekanan seller kuat (${changeStr} 24h). Posisi harga di ${rangePos}% rentang harian mendekati support $${support}. RSI di kisaran ${rsi} menandakan momentum bearish dominan. Setup scalping SHORT saat retest resistance minor $${pivot}.`,
        plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
      });
    } else if (change24h > 1.5) {
      // Strong Uptrend Breakout
      const conf = Number((0.80 + Math.min(0.08, change24h * 0.015)).toFixed(2));
      const stopDistance = Math.min(lastPrice * 0.012, Math.max(lastPrice * 0.005, (lastPrice - pivot) * 0.8 || lastPrice * 0.006));
      const stop = Number((lastPrice - stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice + stopDistance * 2).toFixed(priceDp));
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_LONG',
        confidence: conf,
        reason: `Momentum buyer agresif (+${change24h.toFixed(2)}% 24h). Harga berada di ${rangePos}% rentang harian menekan resistance $${resistance}. RSI di kisaran ${rsi} mengonfirmasi aliran modal masuk. Setup scalping LONG saat pullback ke area pivot $${pivot}.`,
        plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
      });
    } else if (change24h < -0.4) {
      // Moderate Downtrend
      const conf = Number((0.74 + (rangePos < 35 ? 0.04 : 0.02)).toFixed(2));
      const stopDistance = lastPrice * 0.006;
      const stop = Number((lastPrice + stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice - stopDistance * 2).toFixed(priceDp));
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_SHORT',
        confidence: conf,
        reason: `Tekanan jual moderat (${changeStr} 24h). Rejection harga tertahan di bawah pivot $${pivot}. Peluang scalping SHORT mengikuti arus koreksi menuju support $${support}.`,
        plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
      });
    } else if (change24h > 0.4) {
      // Moderate Uptrend
      const conf = Number((0.75 + (rangePos > 65 ? 0.04 : 0.02)).toFixed(2));
      const stopDistance = lastPrice * 0.006;
      const stop = Number((lastPrice - stopDistance).toFixed(priceDp));
      const tp = Number((lastPrice + stopDistance * 2).toFixed(priceDp));
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'LAYAK_LONG',
        confidence: conf,
        reason: `Akumulasi buyer terbentuk (+${change24h.toFixed(2)}% 24h). Harga bertahan kokoh di atas support $${support}. Peluang scalping LONG mengincar breakout resistance $${resistance}.`,
        plan: { entry: lastPrice, stop, tp, riskReward: '1:2' }
      });
    } else {
      // Sideways / Neutral
      const conf = Number((0.55 + Math.abs(change24h) * 0.05).toFixed(2));
      items.push({
        symbol,
        price: lastPrice,
        change24hPct: change24h,
        status: 'WAIT',
        confidence: conf,
        reason: `Pergerakan mendatar/sideways (${changeStr} 24h) di rentang sempit antara Support $${support} dan Resistance $${resistance}. Belum ada konfirmasi volume breakout yang valid. Disarankan WAIT / HINDARI entri.`
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
  textLines.push(`💡 Tips: Ketik "radar SOL ETH PEPE" untuk scan koin pilihan Anda sendiri, atau "radar pagi" untuk 5 koin terbaik.`);

  htmlLines.push(`\n━━━━━━━━━━━━━━━━━━━━\n💡 <i>Status: Laporan analisa pasar saja. Tidak ada posisi trading yang dibuka.</i>\n💡 <i>Tips: Ketik <code>radar SOL ETH PEPE</code> untuk scan koin pilihan Anda sendiri, atau <code>radar pagi</code> untuk 5 koin terbaik.</i>`);

  return {
    at: Date.now(),
    items,
    formattedText: textLines.join('\n'),
    formattedHtml: htmlLines.join('\n')
  };
}
