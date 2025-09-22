import { useState, useEffect } from 'preact/hooks';

const BLACKLIST_STORAGE_KEY = 'cursor-overlay-blacklist';

export function useBlacklist() {
  const [blacklist, setBlacklist] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BLACKLIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBlacklist(new Set(parsed));
        }
      }
    } catch (error) {
      console.warn('Failed to load blacklist from localStorage:', error);
    }
  }, []);

  const addToBlacklist = (id: string) => {
    const newBlacklist = new Set(blacklist);
    newBlacklist.add(id);
    setBlacklist(newBlacklist);

    try {
      const blacklistArray = Array.from(newBlacklist);
      localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(blacklistArray));
    } catch (error) {
      console.warn('Failed to save blacklist to localStorage:', error);
    }
  };

  const removeFromBlacklist = (id: string) => {
    const newBlacklist = new Set(blacklist);
    newBlacklist.delete(id);
    setBlacklist(newBlacklist);

    try {
      const blacklistArray = Array.from(newBlacklist);
      localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(blacklistArray));
    } catch (error) {
      console.warn('Failed to save blacklist to localStorage:', error);
    }
  };

  const clearBlacklist = () => {
    setBlacklist(new Set());

    try {
      localStorage.removeItem(BLACKLIST_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear blacklist from localStorage:', error);
    }
  };

  return {
    blacklist,
    addToBlacklist,
    removeFromBlacklist,
    clearBlacklist,
    isBlacklisted: (id: string) => blacklist.has(id)
  };
}

