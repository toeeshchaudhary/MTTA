'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Intro({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem('introSeen') === '1'; } catch {}
    if (seen) { setShow(false); onDone(); return; }
    setShow(true);
    const t = setTimeout(finish, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    try { sessionStorage.setItem('introSeen', '1'); } catch {}
    onDone();
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro"
          onClick={finish}
          initial={{ opacity: 1 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.7, ease: [0.7, 0, 0.2, 1] }}
        >
          <motion.span className="i-shape" style={{ background: '#141414', borderRadius: '50%' }}
            initial={{ scale: 0, x: -160, y: -120 }} animate={{ scale: 1, x: -160, y: -120 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }} />
          <motion.span className="i-shape tri"
            initial={{ scale: 0, x: 180, y: -90, rotate: -40 }} animate={{ scale: 1, x: 180, y: -90, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }} />
          <motion.span className="i-shape" style={{ background: '#9a9aa0' }}
            initial={{ scale: 0, x: 150, y: 130 }} animate={{ scale: 1, x: 150, y: 130, rotate: 12 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.3 }} />

          <motion.div className="i-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            <div className="i-wm">toeesh<span style={{ color: '#6b6b72' }}>.network</span></div>
            <div className="i-sub mono">slowly living · a map of a person</div>
          </motion.div>
          <div className="i-skip mono">click anywhere to enter</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
