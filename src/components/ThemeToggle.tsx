'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle({ className = '', showLabel = false }: { className?: string; showLabel?: boolean }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Recupera preferência do localStorage ou sistema
    const savedTheme = localStorage.getItem('fyalign_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Padrão escuro com identidade médica de alta tecnologia
      setTheme('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('fyalign_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  if (!mounted) {
    return (
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'var(--bg-card-hover)',
          border: '1px solid var(--border-subtle)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      title={theme === 'dark' ? 'Mudar para Modo Claro (Light Mode)' : 'Mudar para Modo Escuro (Dark Mode)'}
      aria-label="Alternar tema de cores"
      style={{
        background: 'var(--btn-ghost-bg)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-main)',
        borderRadius: showLabel ? 'var(--radius-sm)' : '50%',
        padding: showLabel ? '8px 14px' : '0',
        width: showLabel ? 'auto' : '38px',
        height: '38px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={17} color="#fbbf24" style={{ filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.4))' }} />
          {showLabel && <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Modo Claro</span>}
        </>
      ) : (
        <>
          <Moon size={17} color="#0284c7" style={{ filter: 'drop-shadow(0 0 6px rgba(2, 132, 199, 0.3))' }} />
          {showLabel && <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Modo Escuro</span>}
        </>
      )}
    </button>
  );
}
