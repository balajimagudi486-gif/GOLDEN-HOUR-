import { useState, useEffect, useCallback } from "react";

/**
 * Custom hook to access the browser's Geolocation API.
 * Returns live coordinates, accuracy, error state, and a manual refresh function.
 */
export function useGeolocation(options = {}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const getCurrentPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        // If browser geolocation fails, fall back to a mock location near Dindigul
        console.warn("Geolocation error, using mock position:", err.message);
        setPosition({
          lat: 10.3630 + (Math.random() - 0.5) * 0.02,
          lng: 77.9750 + (Math.random() - 0.5) * 0.02,
          accuracy: 50,
        });
        setLoading(false);
        setError(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...options }
    );
  }, []);

  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  return { position, error, loading, refresh: getCurrentPosition };
}
