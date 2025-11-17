// components/public/bookings/booking-flow.tsx
'use client';

import { useState } from 'react';
import { ServiceSelection } from './service-selection';
import { TeamMemberSelection } from './team-member-selection';
import { DateTimeSelection } from './date-time-selection';
import { BookingSummary } from './booking-summary';
import { CheckCircle, ChevronRight, ArrowLeft } from 'lucide-react';
import type {
  Venue,
  Service,
  TeamMember,
  SelectedAppointment,
  BookingData,
} from '@/types/bookings';

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

  // Define step configuration
  const steps = [
    { id: 'service' as const, label: 'Services', shortLabel: 'Services' },
    {
      id: 'team-member' as const,
      label: 'Professional',
      shortLabel: 'Professional',
    },
    { id: 'date-time' as const, label: 'Time', shortLabel: 'Time' },
    { id: 'review' as const, label: 'Confirm', shortLabel: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  const goToNextStep = () => {
    const nextStepMap: Record<BookingStep, BookingStep> = {
      service: 'team-member',
      'team-member': 'date-time',
      'date-time': 'review',
      review: 'confirmed',
      confirmed: 'confirmed',
    };
    setCurrentStep(nextStepMap[currentStep]);
  };

  const goToPreviousStep = () => {
    const prevStepMap: Record<BookingStep, BookingStep> = {
      service: 'service',
      'team-member': 'service',
      'date-time': 'team-member',
      review: 'date-time',
      confirmed: 'review',
    };
    setCurrentStep(prevStepMap[currentStep]);
  };

  // ✅ NEW: Jump to specific step (only allowed for completed steps)
  const goToStep = (stepId: BookingStep) => {
    const targetIndex = steps.findIndex((s) => s.id === stepId);

    // Only allow jumping to current or previous steps
    if (targetIndex <= currentStepIndex) {
      setCurrentStep(stepId);
    }
  };

  // Check if a step can be clicked (completed or current)
  const canNavigateToStep = (stepId: BookingStep) => {
    const targetIndex = steps.findIndex((s) => s.id === stepId);
    return targetIndex <= currentStepIndex;
  };

  if (currentStep === 'confirmed') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Booking Confirmed!
          </h2>
          <p className="text-gray-600 mb-6">
            Your appointment has been successfully booked. We&apos;ve sent a
            confirmation email to {bookingData.guestEmail}.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-gray-900 mb-2">
              Booking Details
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>Date:</strong> {bookingData.bookingDate}
              </p>
              <p>
                <strong>Location:</strong> {venue.name}
              </p>
              <p>
                <strong>Services:</strong>{' '}
                {bookingData.appointments?.length || 0}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-[#6C5CE7] text-white py-3 rounded-lg font-medium hover:bg-[#5b4bc4] transition-colors"
          >
            Book Another Appointment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Show user info banner if authenticated */}
      {authenticatedUser && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-purple-900">
            <strong>Booking as:</strong> {authenticatedUser.first_name}{' '}
            {authenticatedUser.last_name} ({authenticatedUser.email})
          </p>
        </div>
      )}

      {/* ✅ NEW: Fresha-Style Header with Back Arrow + Breadcrumb */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-6">
          {/* Back Arrow Button */}
          {currentStep !== 'service' && (
            <button
              onClick={goToPreviousStep}
              className="flex-shrink-0 w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm mb-8">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isClickable = canNavigateToStep(step.id);

            return (
              <div key={step.id} className="flex items-center gap-2">
                {/* Step Button/Label */}
                <button
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`font-medium transition-colors ${
                    isCurrent
                      ? 'text-gray-900 text-lg'
                      : isCompleted
                      ? 'text-gray-900 hover:text-gray-700 cursor-pointer'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {step.shortLabel}
                </button>

                {/* Chevron Separator */}
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={`h-4 w-4 ${
                      isCompleted || isCurrent
                        ? 'text-gray-400'
                        : 'text-gray-300'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {steps[currentStepIndex].label}
        </h1>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        {currentStep === 'service' && (
          <ServiceSelection
            services={services}
            selectedAppointments={bookingData.appointments || []}
            onSelect={(appointments) => {
              updateBookingData({ appointments });
              goToNextStep();
            }}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'team-member' && (
          <TeamMemberSelection
            teamMembers={teamMembers}
            services={services}
            appointments={bookingData.appointments || []}
            onSelect={(appointments) => {
              updateBookingData({ appointments });
              goToNextStep();
            }}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'date-time' && (
          <DateTimeSelection
            venueId={venue.id}
            appointments={bookingData.appointments || []}
            onSelect={(date, appointments) => {
              updateBookingData({ bookingDate: date, appointments });
              goToNextStep();
            }}
            onBack={goToPreviousStep}
          />
        )}

        {currentStep === 'review' && (
          <BookingSummary
            venue={venue}
            bookingData={bookingData as BookingData}
            authenticatedUserId={authenticatedUser?.id || null}
            onConfirm={() => goToNextStep()}
            onBack={goToPreviousStep}
          />
        )}
      </div>
    </div>
  );
}
