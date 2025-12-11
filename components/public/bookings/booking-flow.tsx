// components/public/bookings/booking-flow.tsx
'use client';

import { useState, useEffect } from 'react';
import { ServiceSelection } from './service-selection';
import { TeamMemberSelection } from './team-member-selection';
import { DateTimeSelection } from './date-time-selection';
import { GuestInformation } from './guest-information';
import { PaymentDetails } from './payment-details';
import { BookingSummary } from './booking-summary';
import {
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Lock,
  Loader2,
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
  | 'guest-info'
  | 'payment'
  | 'review'
  | 'confirmed';

export function BookingFlow({
  venue,
  services,
  teamMembers,
  authenticatedUser,
}: BookingFlowProps) {
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

  // Define step configuration
  const steps = [
    { id: 'service' as const, label: 'Services', shortLabel: 'Services' },
    {
      id: 'team-member' as const,
      label: 'Professional',
      shortLabel: 'Professional',
    },
    { id: 'date-time' as const, label: 'Time', shortLabel: 'Time' },
    { id: 'guest-info' as const, label: 'Your Info', shortLabel: 'Info' },
    { id: 'payment' as const, label: 'Payment', shortLabel: 'Payment' },
    { id: 'review' as const, label: 'Confirm', shortLabel: 'Confirm' },
  ];

  // Filter out payment step if user already has card
  const visibleSteps = paymentInfo.hasCard
    ? steps.filter((s) => s.id !== 'payment')
    : steps;

  const currentStepIndex = visibleSteps.findIndex((s) => s.id === currentStep);

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  const goToStep = (step: BookingStep) => {
    setCurrentStep(step);
  };

  const goToNextStep = () => {
    const stepOrder: BookingStep[] = paymentInfo.hasCard
      ? [
          'service',
          'team-member',
          'date-time',
          'guest-info',
          'review',
          'confirmed',
        ]
      : [
          'service',
          'team-member',
          'date-time',
          'guest-info',
          'payment',
          'review',
          'confirmed',
        ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  const goToPreviousStep = () => {
    const stepOrder: BookingStep[] = paymentInfo.hasCard
      ? ['service', 'team-member', 'date-time', 'guest-info', 'review']
      : [
          'service',
          'team-member',
          'date-time',
          'guest-info',
          'payment',
          'review',
        ];

    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
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
          href="/account/bookings"
          className="inline-block bg-[#6C5CE7] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
        >
          View My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Progress Steps */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={goToPreviousStep}
            disabled={currentStep === 'service'}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              currentStep === 'service'
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Step Indicators */}
          <div className="flex items-center gap-2">
            {visibleSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = index < currentStepIndex;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#6C5CE7] text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < visibleSteps.length - 1 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Label */}
          <span className="text-sm font-medium text-gray-600">
            {visibleSteps[currentStepIndex]?.label}
          </span>
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6">
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
          <DateTimeSelection
            venueId={venue.id}
            appointments={bookingData.appointments || []}
            onSelect={(date: string, appointments: SelectedAppointment[]) => {
              updateBookingData({ appointments, bookingDate: date });
              goToStep('guest-info');
            }}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'guest-info' && (
          <GuestInformation
            initialData={{
              guestFirstName: bookingData.guestFirstName || '',
              guestLastName: bookingData.guestLastName || '',
              guestEmail: bookingData.guestEmail || '',
              guestPhone: bookingData.guestPhone || '',
              notes: bookingData.notes,
            }}
            onSubmit={(data) => {
              updateBookingData(data);
              goToNextStep();
            }}
            onBack={goToPreviousStep}
          />
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
            onConfirm={goToNextStep}
            onBack={goToPreviousStep}
          />
        )}
      </div>
    </div>
  );
}
