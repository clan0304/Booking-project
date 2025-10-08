// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Hair Salon
          </h1>
          <p className="mt-2 text-gray-600">
            Sign in to your account or create a new one
          </p>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-lg',
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-in"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/onboarding"
          forceRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
