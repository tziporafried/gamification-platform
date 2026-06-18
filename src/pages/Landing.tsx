import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white">
          G
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Gamification Platform
        </h1>
        <p className="mb-8 max-w-md text-lg text-gray-600">
          Create engaging events with points, groups, and leaderboards.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Log In
            </Button>
          </Link>
          <Link to="/register">
            <Button size="lg" className="w-full sm:w-auto">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
