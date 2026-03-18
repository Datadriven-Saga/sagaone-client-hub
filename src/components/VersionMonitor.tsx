import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes

const VersionMonitor = () => {
  const [showUpdateAlert, setShowUpdateAlert] = useState(false);
  const initialHash = useRef<string | null>(null);

  const getPageHash = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${window.location.origin}/index.html`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const html = await res.text();
      const scriptMatches = html.match(/src="([^"]*\.js[^"]*)"/g);
      return scriptMatches ? scriptMatches.join("|") : html.length.toString();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    // Capture initial hash on mount
    getPageHash().then((hash) => {
      initialHash.current = hash;
    });

    const interval = setInterval(async () => {
      if (showUpdateAlert) return; // already showing
      const currentHash = await getPageHash();
      if (
        initialHash.current &&
        currentHash &&
        currentHash !== initialHash.current
      ) {
        setShowUpdateAlert(true);
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [getPageHash, showUpdateAlert]);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showUpdateAlert) return null;

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-4 duration-500"
    >
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
