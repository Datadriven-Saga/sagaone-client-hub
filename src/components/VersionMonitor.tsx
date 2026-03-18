import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const FIRST_CHECK_DELAY = 30 * 1000; // 30 seconds for first check

const VersionMonitor = () => {
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const initialHash = useRef<string | null>(null);
  const checkCount = useRef(0);

  const getPageHash = useCallback(async (): Promise<string | null> => {
    try {
      // Cache-busting query param to bypass CDN cache
      const cacheBuster = `_v=${Date.now()}`;
      const url = `${window.location.origin}/index.html?${cacheBuster}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      });
      if (!res.ok) return null;
      const html = await res.text();
      // Extract all JS script src attributes (these change on each build)
      const scriptMatches = html.match(/src="(\/assets\/[^"]*\.js[^"]*)"/g);
      return scriptMatches ? scriptMatches.sort().join("|") : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Capture initial hash on mount
    getPageHash().then((hash) => {
      if (!mounted) return;
      initialHash.current = hash;
      console.log("[VersionMonitor] ✅ Initial hash captured:", hash?.substring(0, 80));
    });

    // First check after 30s, then every 2 minutes
    const firstTimeout = setTimeout(() => {
      if (!mounted) return;
      runCheck();
      // Then set recurring interval
      const interval = setInterval(runCheck, CHECK_INTERVAL);
      intervalRef.current = interval;
    }, FIRST_CHECK_DELAY);

    let intervalRef = { current: null as ReturnType<typeof setInterval> | null };

    async function runCheck() {
      if (!mounted || showUpdateAlert) return;
      checkCount.current++;
      const currentHash = await getPageHash();
      
      if (!initialHash.current || !currentHash) {
        console.log(`[VersionMonitor] Check #${checkCount.current}: skipped (no hash)`);
        return;
      }

      const isMatch = currentHash === initialHash.current;
      console.log(`[VersionMonitor] Check #${checkCount.current}: ${isMatch ? "✅ up to date" : "🔄 NEW VERSION DETECTED"}`);
      
      if (!isMatch) {
        setShowUpdateAlert(true);
      }
    }

    return () => {
      mounted = false;
      clearTimeout(firstTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [getPageHash, showUpdateAlert]);

  // Expose test trigger on window for validation
  useEffect(() => {
    (window as any).__testVersionAlert = () => setShowUpdateAlert(true);
    return () => { delete (window as any).__testVersionAlert; };
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showUpdateAlert) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-500">
      <button
        onClick={handleUpdate}
        className="flex items-center gap-3 px-5 py-3 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700/50 backdrop-blur-sm hover:bg-slate-800 transition-colors cursor-pointer font-medium text-sm"
      >
        <RefreshCw className="h-4 w-4 animate-spin" style={{ animationDuration: "3s" }} />
        <span>Versão desatualizada. Clique para atualizar</span>
      </button>
    </div>
  );
};

export default VersionMonitor;
