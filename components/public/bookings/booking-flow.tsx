// components/public/bookings/booking-flow.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ServiceSelection } from './service-selection';
import { TeamMemberSelection } from './team-member-selection';
import { DateTimeSelection } from './date-time-selection';
import { PaymentDetails } from './payment-details';
import { BookingSummary } from './booking-summary';
import { useBookingHold } from '@/hooks/use-booking-hold';
import {
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  X,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { getPublicPaymentInfo } from '@/app/actions/stripe';
import type {
  Venue,
  Service,
  TeamMember,
  SelectedAppointment,
  BookingData,
} from '@/types/bookings';
import Link from 'next/link';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface CancellationPolicy {
  id: string;
  notice_hours: number;
  fee_percentage: number;
  fee_fixed_amount: number | null;
}

interface AuthenticatedUser {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone_number: string | null;
}

interface BookingFlowProps {
  venue: Venue;
  services: Service[];
  teamMembers: TeamMember[];
  authenticatedUser: AuthenticatedUser | null;
}

export type { SelectedAppointment, BookingData };

type BookingStep =
  | 'service'
  | 'team-member'
  | 'date-time'
  | 'payment'
  | 'review'
  | 'confirmed';

// =====================================================
// FRESHA-STYLE BREADCRUMB TYPES & HELPERS
// =====================================================

type DisplayStep = 'services' | 'professional' | 'time' | 'confirm';

const DISPLAY_STEPS: { key: DisplayStep; label: string }[] = [
  { key: 'services', label: 'Services' },
  { key: 'professional', label: 'Professional' },
  { key: 'time', label: 'Time' },
  { key: 'confirm', label: 'Confirm' },
];

// Map internal steps to display steps
function getDisplayStep(internalStep: BookingStep): DisplayStep {
  switch (internalStep) {
    case 'service':
      return 'services';
    case 'team-member':
      return 'professional';
    case 'date-time':
      return 'time';
    case 'payment':
    case 'review':
      return 'confirm';
    default:
      return 'services';
  }
}

// Get the first internal step for a display step
function getInternalStepForDisplay(displayStep: DisplayStep): BookingStep {
  switch (displayStep) {
    case 'services':
      return 'service';
    case 'professional':
      return 'team-member';
    case 'time':
      return 'date-time';
    case 'confirm':
      return 'review';
    default:
      return 'service';
  }
}

// =====================================================
// HELPER: Calculate duration from start/end time
// =====================================================
function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes - startMinutes;
}

// =====================================================
// BOOKING PROGRESS COMPONENT (Fresha-style)
// =====================================================

interface BookingProgressProps {
  currentStep: BookingStep;
  onStepClick: (step: BookingStep) => void;
  onBack: () => void;
  onClose: () => void;
}

function BookingProgress({
  currentStep,
  onStepClick,
  onBack,
  onClose,
}: BookingProgressProps) {
  const currentDisplayStep = getDisplayStep(currentStep);
  const currentDisplayIndex = DISPLAY_STEPS.findIndex(
    (s) => s.key === currentDisplayStep
  );

  const handleStepClick = (displayStep: DisplayStep, index: number) => {
    // Only allow clicking on completed steps (before current display step)
    if (index < currentDisplayIndex) {
      const internalStep = getInternalStepForDisplay(displayStep);
      onStepClick(internalStep);
    }
  };

  return (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={onBack}
            disabled={currentStep === 'service'}
            className={`p-2.5 -ml-2 rounded-full border transition-colors ${
              currentStep === 'service'
                ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Breadcrumb Steps */}
          <nav
            className="flex items-center gap-1 sm:gap-2"
            aria-label="Booking progress"
          >
            {DISPLAY_STEPS.map((step, index) => {
              const isCompleted = index < currentDisplayIndex;
              const isCurrent = index === currentDisplayIndex;
              const isFuture = index > currentDisplayIndex;

              return (
                <div key={step.key} className="flex items-center">
                  {/* Step Label */}
                  <button
                    onClick={() => handleStepClick(step.key, index)}
                    disabled={isFuture || isCurrent}
                    className={`
                      text-sm font-medium transition-colors px-1
                      ${
                        isCompleted
                          ? 'text-gray-900 hover:text-[#6C5CE7] cursor-pointer'
                          : ''
                      }
                      ${isCurrent ? 'text-gray-900 cursor-default' : ''}
                      ${isFuture ? 'text-gray-400 cursor-default' : ''}
                    `}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {step.label}
                  </button>

                  {/* Chevron Separator (except after last item) */}
                  {index < DISPLAY_STEPS.length - 1 && (
                    <ChevronRight
                      className={`h-4 w-4 mx-1 sm:mx-2 flex-shrink-0 ${
                        index < currentDisplayIndex
                          ? 'text-gray-400'
                          : 'text-gray-300'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2.5 -mr-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Close booking"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// HOLD ERROR BANNER COMPONENT
// =====================================================

interface HoldErrorBannerProps {
  error: string;
  onDismiss: () => void;
}

function HoldErrorBanner({ error, onDismiss }: HoldErrorBannerProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <p className="text-sm text-red-600 mt-1">
            Please select a different time slot.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =====================================================
// MAIN BOOKING FLOW COMPONENT
// =====================================================

export function BookingFlow({
  venue,
  services,
  teamMembers,
  authenticatedUser,
}: BookingFlowProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({
    venueId: venue.id,
    appointments: [],
    // Pre-fill user data if authenticated
    ...(authenticatedUser && {
      guestFirstName: authenticatedUser.first_name,
      guestLastName: authenticatedUser.last_name || '',
      guestEmail: authenticatedUser.email,
      guestPhone: authenticatedUser.phone_number || '',
    }),
  });

  // Booking hold state
  const [holdErrorVisible, setHoldErrorVisible] = useState(false);
  const { isHolding, holdError, createHold, releaseHold, deleteHold } =
    useBookingHold({
      venueId: venue.id,
      onHoldError: (error) => {
        console.error('Hold error:', error);
        setHoldErrorVisible(true);
      },
    });

  // Payment-related state
  const [paymentInfo, setPaymentInfo] = useState<{
    clientId: string | null;
    existingCard: SavedCard | null;
    cancellationPolicy: CancellationPolicy | null;
    hasCard: boolean;
    loading: boolean;
  }>({
    clientId: null,
    existingCard: null,
    cancellationPolicy: null,
    hasCard: false,
    loading: true,
  });

  // Fetch payment info when component mounts (for authenticated users)
  useEffect(() => {
    if (authenticatedUser) {
      fetchPaymentInfo();
    } else {
      setPaymentInfo((prev) => ({ ...prev, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticatedUser?.id, venue.id]);

  const fetchPaymentInfo = async () => {
    try {
      const result = await getPublicPaymentInfo(venue.id);

      if (result.error) {
        console.error('Failed to fetch payment info:', result.error);
        setPaymentInfo((prev) => ({ ...prev, loading: false }));
      } else {
        console.log('Payment info loaded:', {
          hasCard: result.hasCard,
          cardLast4: result.existingCard?.last4,
        });

        setPaymentInfo({
          clientId: result.clientId,
          existingCard: result.existingCard as SavedCard | null,
          cancellationPolicy: result.cancellationPolicy,
          hasCard: result.hasCard,
          loading: false,
        });

        // If user has a saved card, store the payment method ID
        if (result.existingCard) {
          setBookingData((prev) => ({
            ...prev,
            paymentMethodId: result.existingCard!.id,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching payment info:', error);
      setPaymentInfo((prev) => ({ ...prev, loading: false }));
    }
  };

  // Check if user must be authenticated
  if (!authenticatedUser) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Sign In Required
        </h2>
        <p className="text-gray-600 mb-6">
          Please sign in or create an account to book an appointment.
        </p>
        <Link
          href="/sign-in"
          className="inline-block bg-[#6C5CE7] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
        >
          Sign In to Continue
        </Link>
      </div>
    );
  }

  // Show loading while fetching payment info
  if (paymentInfo.loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 flex items-center justify-center min-h-[300px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#6C5CE7] mx-auto mb-4" />
          <p className="text-gray-600">Loading your information...</p>
        </div>
      </div>
    );
  }

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  const goToStep = (step: BookingStep) => {
    // If going back to time selection from confirm steps, release the hold
    if (
      step === 'date-time' &&
      (currentStep === 'payment' || currentStep === 'review')
    ) {
      releaseHold();
    }
    setCurrentStep(step);
  };

  // Get step order - skip guest-info for authenticated users (Fresha-style)
  const getStepOrder = (): BookingStep[] => {
    // Authenticated users skip guest-info step
    if (paymentInfo.hasCard) {
      return ['service', 'team-member', 'date-time', 'review', 'confirmed'];
    }
    return [
      'service',
      'team-member',
      'date-time',
      'payment',
      'review',
      'confirmed',
    ];
  };

  const goToNextStep = () => {
    const stepOrder = getStepOrder();
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const stepOrder = getStepOrder();
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      const previousStep = stepOrder[currentIndex - 1];

      // If going back to time selection from confirm steps, release the hold
      if (
        previousStep === 'date-time' &&
        (currentStep === 'payment' || currentStep === 'review')
      ) {
        releaseHold();
      }

      setCurrentStep(previousStep);
    }
  };

  // Handler to close booking and go back to venue page
  const handleClose = () => {
    // Hold will be released automatically by the hook on unmount
    router.push(`/${venue.slug}`);
  };

  // Handler to change/update card
  const handleChangeCard = () => {
    // Go to payment step to enter new card
    setCurrentStep('payment');
  };

  // Handler when new card is saved
  const handlePaymentMethodSaved = (paymentMethodId: string) => {
    updateBookingData({ paymentMethodId });

    // Refresh payment info to get the new card details
    fetchPaymentInfo();

    goToNextStep();
  };

  // Handler for date/time selection with hold creation
  const handleDateTimeSelect = async (
    date: string,
    appointments: SelectedAppointment[]
  ) => {
    updateBookingData({ appointments, bookingDate: date });
    setHoldErrorVisible(false);

    // Create booking hold for the selected time slots
    const holdCreated = await createHold(
      date,
      appointments.map((appt) => ({
        teamMemberId: appt.teamMemberId,
        startTime: appt.startTime,
        endTime: appt.endTime,
        serviceId: appt.serviceId,
        serviceName: appt.serviceName,
        // Calculate duration from start/end time
        duration: calculateDurationMinutes(appt.startTime, appt.endTime),
        price: appt.price,
      }))
    );

    if (holdCreated) {
      // Hold created successfully, proceed to next step
      goToNextStep();
    } else {
      // Hold failed - error will be shown via onHoldError callback
      setHoldErrorVisible(true);
    }
  };

  // Handler for booking confirmation - delete hold after successful booking
  const handleBookingConfirmed = async () => {
    // Delete the hold after successful booking
    await deleteHold();
    goToNextStep();
  };

  const totalPrice =
    bookingData.appointments?.reduce((sum, appt) => sum + appt.price, 0) || 0;

  // Render confirmed state
  if (currentStep === 'confirmed') {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Booking Confirmed!
        </h2>
        <p className="text-gray-600 mb-6">
          Thank you for your booking at {venue.name}. We&apos;ve sent a
          confirmation to {bookingData.guestEmail}.
        </p>
        <Link
          href="/dashboard"
          className="inline-block bg-[#6C5CE7] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
        >
          View My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Fresha-style Progress Header */}
      <BookingProgress
        currentStep={currentStep}
        onStepClick={goToStep}
        onBack={goToPreviousStep}
        onClose={handleClose}
      />

      {/* Step Content */}
      <div className="p-6">
        {/* Hold Error Banner */}
        {holdErrorVisible && holdError && (
          <HoldErrorBanner
            error={holdError}
            onDismiss={() => setHoldErrorVisible(false)}
          />
        )}

        {currentStep === 'service' && (
          <ServiceSelection
            services={services}
            selectedAppointments={bookingData.appointments || []}
            onSelect={(appointments: SelectedAppointment[]) => {
              updateBookingData({ appointments });
              goToStep('team-member');
            }}
            onBack={() => {}}
          />
        )}

        {currentStep === 'team-member' && (
          <TeamMemberSelection
            teamMembers={teamMembers}
            services={services}
            appointments={bookingData.appointments || []}
            onSelect={(appointments: SelectedAppointment[]) => {
              updateBookingData({ appointments });
              goToStep('date-time');
            }}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'date-time' && (
          <>
            {/* Show loading overlay while creating hold */}
            {isHolding && (
              <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#6C5CE7]" />
                  <span className="text-gray-700">
                    Reserving your time slot...
                  </span>
                </div>
              </div>
            )}
            <DateTimeSelection
              venueId={venue.id}
              appointments={bookingData.appointments || []}
              onSelect={handleDateTimeSelect}
              onBack={goToPreviousStep}
            />
          </>
        )}

        {currentStep === 'payment' && (
          <PaymentDetails
            clientId={paymentInfo.clientId || authenticatedUser.id}
            venueId={venue.id}
            totalPrice={totalPrice}
            existingCard={paymentInfo.existingCard}
            cancellationPolicy={paymentInfo.cancellationPolicy}
            onPaymentMethodSaved={handlePaymentMethodSaved}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'review' && (
          <BookingSummary
            venue={venue}
            bookingData={bookingData as BookingData}
            authenticatedUserId={authenticatedUser.id}
            savedCard={paymentInfo.existingCard}
            cancellationPolicy={paymentInfo.cancellationPolicy}
            onChangeCard={handleChangeCard}
            onConfirm={handleBookingConfirmed}
            onBack={goToPreviousStep}
          />
        )}
      </div>
    </div>
  );
}
