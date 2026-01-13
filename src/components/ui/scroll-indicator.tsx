import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface ScrollIndicatorProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollIndicator({ children, className = '' }: ScrollIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const checkScrollable = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current;
      const isScrollable = scrollHeight > clientHeight;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setShowIndicator(isScrollable && !isAtBottom);
    }
  }, []);

  useEffect(() => {
    checkScrollable();
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScrollable);
    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [checkScrollable, children]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop <= clientHeight + 10;
      setShowIndicator(!isAtBottom);
    }
  };

  const handleIndicatorClick = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.scrollHeight * 0.2;
      container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0"
      >
        {children}
      </div>
      
      {showIndicator && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <button
            onClick={handleIndicatorClick}
            className="w-10 h-10 rounded-full bg-primary/80 shadow-lg flex items-center justify-center cursor-pointer transition-all duration-300 hover:bg-primary pointer-events-auto"
            aria-label="Rolar para baixo"
          >
            <ChevronDown className="w-6 h-6 text-primary-foreground animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
}
