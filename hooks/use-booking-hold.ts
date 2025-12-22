// hooks/use-booking-hold.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  createMultipleBookingHolds,
  releaseBookingHold,
  deleteHoldAfterBooking,
} from '@/app/actions/booking-holds';

interface HoldAppointment {
  teamMemberId: string;
  startTime: string;
  endTime: string;
  serviceId: string;
  serviceName: string;
  duration: number;
  price: number;
}

interface UseBookingHoldOptions {
  venueId: string;
  onHoldExpired?: () => void;
  onHoldError?: (error: string) => void;
}

interface UseBookingHoldReturn {
  sessionToken: string | null;
  isHolding: boolean;
  holdError: string | null;
  createHold: (
    date: string,
    appointments: HoldAppointment[]
  ) => Promise<boolean>;
  releaseHold: () => Promise<void>;
  deleteHold: () => Promise<boolean>;
}

export function useBookingHold({
  venueId,

  onHoldError,
}: UseBookingHoldOptions): UseBookingHoldReturn {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);

  // Track if component is mounted
  const isMountedRef = useRef(true);
  const sessionTokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  // Cleanup on unmount - release any active holds
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Release hold when component unmounts (user navigates away)
      if (sessionTokenRef.current) {
        releaseBookingHold(sessionTokenRef.current).catch(console.error);
      }
    };
  }, []);

  // Handle browser close/navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionTokenRef.current) {
        // Use sendBeacon for reliable delivery on page close
        const data = JSON.stringify({ sessionToken: sessionTokenRef.current });
        navigator.sendBeacon('/api/public/bookings/release-hold', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Create a new hold
  const createHold = useCallback(
    async (date: string, appointments: HoldAppointment[]): Promise<boolean> => {
      setIsHolding(true);
      setHoldError(null);

      try {
        const result = await createMultipleBookingHolds({
          venueId,
          holdDate: date,
          appointments,
          sessionToken: sessionToken || undefined,
        });

        if (!isMountedRef.current) return false;

        if (result.success && result.sessionToken) {
          setSessionToken(result.sessionToken);
          setIsHolding(false);
          return true;
        } else {
          setHoldError(result.error || 'Failed to create hold');
          setIsHolding(false);
          onHoldError?.(result.error || 'Failed to create hold');
          return false;
        }
      } catch (error) {
        if (!isMountedRef.current) return false;

        const errorMessage = `${error} An unexpected error occurred`;
        setHoldError(errorMessage);
        setIsHolding(false);
        onHoldError?.(errorMessage);
        return false;
      }
    },
    [venueId, sessionToken, onHoldError]
  );

  // Release the current hold (user navigates away)
  const releaseHold = useCallback(async (): Promise<void> => {
    if (!sessionToken) return;

    try {
      await releaseBookingHold(sessionToken);

      if (isMountedRef.current) {
        setSessionToken(null);
        setHoldError(null);
      }
    } catch (error) {
      console.error('Error releasing hold:', error);
    }
  }, [sessionToken]);

  // Delete hold after booking is completed successfully
  const deleteHold = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) {
      return true; // No hold to delete, that's fine
    }

    try {
      const result = await deleteHoldAfterBooking(sessionToken);

      if (isMountedRef.current) {
        setSessionToken(null);
      }

      return result.success;
    } catch (error) {
      console.error('Error deleting hold:', error);
      return false;
    }
  }, [sessionToken]);

  return {
    sessionToken,
    isHolding,
    holdError,
    createHold,
    releaseHold,
    deleteHold,
  };
}
