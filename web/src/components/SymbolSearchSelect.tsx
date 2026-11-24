import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useI18n } from '../i18n';

interface SymbolSearchSelectProps {
  value: string;
  onChange: (sym: string) => void;
  watchlist?: string[];
  popularSymbols?: readonly string[];
  ariaLabel?: string;
  className?: string;
}

export const DEFAULT_FAVORITES = ['XAUUSD', 'XAUUSDT', 'BTCUSDT', 'ETHUSDT'];
export const FAV_STORAGE_KEY = 'mpu_favorite_symbols_v1';
export const FAV_EVENT_NAME = 'mpu_favorites_changed';

export function getStoredFavorites(): string[] {
  try {
    const saved = localStorage.getItem(FAV_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_FAVORITES;
}

export function useFavoriteSymbols(): string[] {
  const [favorites, setFavorites] = useState<string[]>(getStoredFavorites);

  useEffect(() => {
    const update = () => setFavorites(getStoredFavorites());
    window.addEventListener(FAV_EVENT_NAME, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(FAV_EVENT_NAME, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return favorites;
}

export function SymbolSearchSelect({
  value,
  onChange,
  watchlist = [],
  popularSymbols = [],
  ariaLabel = 'Select symbol',
  className = ''
}: SymbolSearchSelectProps) {
  const { lang } = useI18n();
  const id = lang === 'id';
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const favorites = useFavoriteSymbols();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Persist favorites
  const toggleFavorite = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = getStoredFavorites();
    const next = prev.includes(sym) ? prev.filter((s) => s !== sym) : [sym, ...prev];
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(FAV_EVENT_NAME));
    } catch {}
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const query = search.trim().toUpperCase();

  // Combine and sort lists
  const { filteredFavorites, filteredWatchlist, filteredOthers } = useMemo(() => {
    const favSet = new Set(favorites);
    const watchSet = new Set(watchlist.filter((s) => !favSet.has(s)));
    const otherSet = new Set(popularSymbols.filter((s) => !favSet.has(s) && !watchSet.has(s)));

    const filterFn = (s: string) => !query || s.toUpperCase().includes(query);

    return {
      filteredFavorites: favorites.filter(filterFn),
      filteredWatchlist: Array.from(watchSet).filter(filterFn),
      filteredOthers: Array.from(otherSet).filter(filterFn)
    };
  }, [favorites, watchlist, popularSymbols, query]);

  const isCustomCandidate = query.length >= 2 && !favorites.includes(query) && !watchlist.includes(query) && !popularSymbols.includes(query);

  const isFavorited = (sym: string) => favorites.includes(sym);

  const selectSymbol = (sym: string) => {
    onChange(sym);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`sym-picker-wrapper ${className}`} ref={wrapperRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className="sym-picker-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sym-picker-val">
          {isFavorited(value) ? '⭐ ' : ''}{value || 'PILIH PAIR'}
        </span>
        <span className="sym-picker-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="sym-picker-popover" role="dialog" aria-label="Cari dan pilih pair">
          {/* Search Box Header */}
          <div className="sym-picker-search-bar">
            <span className="sym-picker-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="sym-picker-search-input"
              placeholder={id ? 'Cari pair (XAU, BTC, IDR, PEPE)...' : 'Search pair (XAU, BTC, IDR, PEPE)...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsOpen(false);
                if (e.key === 'Enter' && query) {
                  selectSymbol(query);
                }
              }}
            />
            {search && (
              <button
                type="button"
                className="sym-picker-clear-btn"
                onClick={() => setSearch('')}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* List items */}
          <div className="sym-picker-list">
            {/* Custom token quick add */}
            {isCustomCandidate && (
              <div
                className="sym-picker-item sym-picker-custom-item"
                onClick={() => selectSymbol(query)}
              >
                <span className="sym-picker-star">➕</span>
                <span className="sym-picker-name">{id ? `Gunakan "${query}"` : `Use "${query}"`}</span>
              </div>
            )}

            {/* 1. FAVORITES GROUP */}
            {filteredFavorites.length > 0 && (
              <div className="sym-picker-group">
                <div className="sym-picker-group-title">
                  <span>⭐ {id ? 'Favorit' : 'Favorites'}</span>
                </div>
                {filteredFavorites.map((sym) => (
                  <div
                    key={`fav-${sym}`}
                    className={`sym-picker-item ${sym === value ? 'is-selected' : ''}`}
                    onClick={() => selectSymbol(sym)}
                  >
                    <button
                      type="button"
                      className="sym-picker-star-btn is-active"
                      title={id ? 'Hapus dari favorit' : 'Remove from favorites'}
                      onClick={(e) => toggleFavorite(sym, e)}
                    >
                      ★
                    </button>
                    <span className="sym-picker-name">{sym}</span>
                    {sym === value && <span className="sym-picker-check">✓</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 2. WATCHLIST GROUP */}
            {filteredWatchlist.length > 0 && (
              <div className="sym-picker-group">
                <div className="sym-picker-group-title">
                  <span>📋 {id ? 'Pantauan Meja' : 'Watchlist'}</span>
                </div>
                {filteredWatchlist.map((sym) => (
                  <div
                    key={`watch-${sym}`}
                    className={`sym-picker-item ${sym === value ? 'is-selected' : ''}`}
                    onClick={() => selectSymbol(sym)}
                  >
                    <button
                      type="button"
                      className="sym-picker-star-btn"
                      title={id ? 'Jadikan favorit' : 'Add to favorites'}
                      onClick={(e) => toggleFavorite(sym, e)}
                    >
                      ☆
                    </button>
                    <span className="sym-picker-name">{sym}</span>
                    {sym === value && <span className="sym-picker-check">✓</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 3. ALL OTHER VERIFIED SYMBOLS */}
            {filteredOthers.length > 0 && (
              <div className="sym-picker-group">
                <div className="sym-picker-group-title">
                  <span>🌐 {id ? 'Semua Aset' : 'All Assets'}</span>
                </div>
                {filteredOthers.map((sym) => (
                  <div
                    key={`other-${sym}`}
                    className={`sym-picker-item ${sym === value ? 'is-selected' : ''}`}
                    onClick={() => selectSymbol(sym)}
                  >
                    <button
                      type="button"
                      className="sym-picker-star-btn"
                      title={id ? 'Jadikan favorit' : 'Add to favorites'}
                      onClick={(e) => toggleFavorite(sym, e)}
                    >
                      ☆
                    </button>
                    <span className="sym-picker-name">{sym}</span>
                    {sym === value && <span className="sym-picker-check">✓</span>}
                  </div>
                ))}
              </div>
            )}

            {filteredFavorites.length === 0 && filteredWatchlist.length === 0 && filteredOthers.length === 0 && !isCustomCandidate && (
              <div className="sym-picker-empty">
                {id ? `Tidak ada pair "${search}"` : `No pair matching "${search}"`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
