// app/profile/page.tsx
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileForm from '@/components/profile-form';

export default async function ProfilePage() {
  const { userId } = await requireAuth();

  // Load user data server-side using Service Role
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('clerk_user_id', userId)
    .single();

  if (error || !user) {
    console.error('Error loading user:', error);
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <ProfileForm user={user} />
      </div>
    </div>
  );
}
