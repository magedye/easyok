import { useState, type PropsWithChildren } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export const AppLayout = ({ children }: PropsWithChildren) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <div className="flex">
        <div className="fixed inset-y-0 end-0 z-40 lg:static lg:flex">
          <Sidebar isOpen={isSidebarOpen} />
        </div>
        <main className="flex min-h-screen w-full flex-col lg:me-72">
          <Header onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)} />
          <div className="flex-1 space-y-6 px-6 py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
