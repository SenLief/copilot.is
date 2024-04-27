import { type Metadata } from 'next'
import { redirect } from 'next/navigation'

import { auth } from '@/server/auth'
import { LoginButton } from '@/components/login-button'

export const metadata: Metadata = {
  title: 'Login'
}

export default async function SignInPage() {
  const session = await auth()
  // redirect to home if user is already logged in
  if (session?.user) {
    redirect('/')
  }

  const githubEnabled = process.env.AUTH_GITHUB_ENABLED === 'true'
  const googleEnabled = process.env.AUTH_GOOGLE_ENABLED === 'true'

  return (
    <div className="flex size-full items-center justify-center">
      <div className="bg-background rounded-lg border p-8 shadow-md">
        <div className="space-y-6">
          <h1 className="px-3 text-center text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl dark:text-white">
            Sign in to your account
          </h1>

          <LoginButton
            githubEnabled={githubEnabled}
            googleEnabled={googleEnabled}
          />
        </div>
      </div>
    </div>
  )
}
