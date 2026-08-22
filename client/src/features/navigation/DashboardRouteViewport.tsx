import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getRequestActivityCursor, hasPendingRequestsAfter, subscribeRequestActivity } from '../../lib/requestActivity';

const REQUEST_GRACE_MS = 90;
const MIN_TRANSITION_MS = 160;
const MAX_TRANSITION_MS = 1_200;
const REVEAL_DELAY_MS = 100;

export function DashboardRouteViewport() {
  const requestCursorRef = useRef(getRequestActivityCursor());
  const transitionStartedAtRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const [activityVersion, setActivityVersion] = useState(0);
  const [armed, setArmed] = useState(false);
  const [transitioning, setTransitioning] = useState(true);
  const [progress, setProgress] = useState(14);

  useEffect(() => subscribeRequestActivity(() => setActivityVersion(version => version + 1)), []);

  useEffect(() => {
    transitionStartedAtRef.current = performance.now();
    const advanceTimer = window.setTimeout(() => setProgress(72), 35);
    const graceTimer = window.setTimeout(() => setArmed(true), REQUEST_GRACE_MS);
    const maximumTimer = window.setTimeout(() => {
      setProgress(100);
      revealTimerRef.current = window.setTimeout(() => setTransitioning(false), REVEAL_DELAY_MS);
    }, MAX_TRANSITION_MS);

    return () => {
      window.clearTimeout(advanceTimer);
      window.clearTimeout(graceTimer);
      window.clearTimeout(maximumTimer);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!transitioning || !armed || hasPendingRequestsAfter(requestCursorRef.current)) return;
    const elapsed = transitionStartedAtRef.current === null ? MIN_TRANSITION_MS : performance.now() - transitionStartedAtRef.current;
    const remainingMinimum = Math.max(0, MIN_TRANSITION_MS - elapsed);
    const finishTimer = window.setTimeout(() => {
      setProgress(100);
      revealTimerRef.current = window.setTimeout(() => setTransitioning(false), REVEAL_DELAY_MS);
    }, remainingMinimum);
    return () => {
      window.clearTimeout(finishTimer);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, [activityVersion, armed, transitioning]);

  return (
    <>
      <div
        className={`dashboard-route-content h-full transition-opacity duration-150 motion-reduce:transition-none ${transitioning ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
        aria-busy={transitioning}
      >
        <Outlet />
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-[#CFE3DA] transition-opacity duration-150 motion-reduce:transition-none ${transitioning ? 'opacity-100' : 'opacity-0'}`}
      >
        <span
          className="block h-full bg-[#1B7A5A] transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  );
}
