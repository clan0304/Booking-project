// app/onboarding/page.tsx
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { OnboardingForm } from './onboarding-form';

// Fields that are required for client self-registration
interface MissingFields {
  firstName: boolean;
  lastName: boolean;
  phoneNumber: boolean;
}

interface UserData {
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  photoUrl: string | null;
}

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Fetch current user data from Supabase
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select(
      'first_name, last_name, phone_number, photo_url, onboarding_completed'
    )
    .eq('clerk_user_id', userId)
    .single();

  if (error || !user) {
    console.error('Error fetching user for onboarding:', error);
    // User might not exist yet (webhook delay), show loading or retry
    redirect('/sign-in');
  }

  // If already completed onboarding, redirect to dashboard
  if (user.onboarding_completed) {
    redirect('/dashboard');
  }

  // Determine which fields are missing
  const missingFields: MissingFields = {
    firstName: !user.first_name || user.first_name.trim() === '',
    lastName: !user.last_name || user.last_name.trim() === '',
    phoneNumber: !user.phone_number || user.phone_number.trim() === '',
  };

  // Current user data to pre-fill form
  const userData: UserData = {
    firstName: user.first_name,
    lastName: user.last_name,
    phoneNumber: user.phone_number,
    photoUrl: user.photo_url,
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              Complete Your Profile
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {missingFields.firstName || missingFields.lastName
                ? 'Please provide your details to get started'
                : 'Just a few more details to get started'}
            </p>
          </div>

          <OnboardingForm missingFields={missingFields} userData={userData} />
        </div>
      </div>
    </div>
  );
}
