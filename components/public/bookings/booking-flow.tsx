// components/public/bookings/booking-flow.tsx
'use client';

import { useState } from 'react';
import { ServiceSelection } from './service-selection';
import { TeamMemberSelection } from './team-member-selection';
import { DateTimeSelection } from './date-time-selection';
import { BookingSummary } from './booking-summary';
import { CheckCircle } from 'lucide-react';
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

  // Only show info step if not authenticated
  const steps = authenticatedUser
    ? [
        { id: 'service', label: 'Select Service' },
        { id: 'team-member', label: 'Choose Team Member' },
        { id: 'date-time', label: 'Pick Date & Time' },
        { id: 'review', label: 'Review' },
      ]
    : [
        { id: 'service', label: 'Select Service' },
        { id: 'team-member', label: 'Choose Team Member' },
        { id: 'date-time', label: 'Pick Date & Time' },
        { id: 'info', label: 'Your Information' },
        { id: 'review', label: 'Review' },
      ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const updateBookingData = (data: Partial<BookingData>) => {
    setBookingData((prev) => ({ ...prev, ...data }));
  };

  const goToNextStep = () => {
    const nextStepMap: Record<BookingStep, BookingStep> = authenticatedUser
      ? {
          service: 'team-member',
          'team-member': 'date-time',
          'date-time': 'review',
          review: 'confirmed',
          confirmed: 'confirmed',
        }
      : {
          service: 'team-member',
          'team-member': 'date-time',
          'date-time': 'review', // Skip info step for authenticated users
          review: 'confirmed',
          confirmed: 'confirmed',
        };
    setCurrentStep(nextStepMap[currentStep]);
  };

  const goToPreviousStep = () => {
    const prevStepMap: Record<BookingStep, BookingStep> = authenticatedUser
      ? {
          service: 'service',
          'team-member': 'service',
          'date-time': 'team-member',
          review: 'date-time',
          confirmed: 'review',
        }
      : {
          service: 'service',
          'team-member': 'service',
          'date-time': 'team-member',
          review: 'date-time', // Skip info step when going back too
          confirmed: 'review',
        };
    setCurrentStep(prevStepMap[currentStep]);
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

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 ${index !== steps.length - 1 ? 'pr-4' : ''}`}
            >
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    index < currentStepIndex
                      ? 'bg-green-500 text-white'
                      : index === currentStepIndex
                      ? 'bg-[#6C5CE7] text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </div>
                <div className="ml-3 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      index <= currentStepIndex
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
                {index !== steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
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
