import React, { useState } from "react";

/**
 * TiltCard — wrapper that gives any card a mouse-tracking 3D tilt effect.
 *
 * Props:
 *   max       - max tilt in degrees (default 7)
 *   className - extra classes for the card container
 *   children  - card content
 */
export default function TiltCard({ children, className = "", max = 7 }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -max, y: px * max });
  };

  const handleLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.12s ease-out",
      }}
      className={className}
    >
      {children}
    </div>
  );
}
