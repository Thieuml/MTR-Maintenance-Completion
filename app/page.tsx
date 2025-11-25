export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8">MTR Maintenance Tracking</h1>
        <p className="text-lg mb-4">
          Maintenance scheduling and compliance control tool for MTR lifts and escalators
        </p>
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>14-day maintenance cycle tracking</li>
            <li>Visual calendar for all MTR units</li>
            <li>Committed date vs actual completion tracking</li>
            <li>Chinese-language notifications for engineers</li>
            <li>Compliance monitoring and reporting</li>
            <li>Rescheduling workflow management</li>
          </ul>
        </div>
      </div>
    </main>
  )
}

