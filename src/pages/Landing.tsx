import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-game-radial px-4">
      <div className="text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand text-2xl font-bold text-white shadow-glow-brand">
          G
        </div>
        <h1 className="mb-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          פלטפורמת משחוק
        </h1>
        <p className="mb-8 max-w-md text-lg text-gray-400">
          צרו תחרויות מרתקות עם ניקוד, קבוצות וטבלאות דירוג.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/login">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              התחברות
            </Button>
          </Link>
          <Link to="/register">
            <Button size="lg" variant="gradient" className="w-full sm:w-auto">
              התחלה
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
