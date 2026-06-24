import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BHEL Smart VMS — AI Visitor Management System',
  description: 'Enterprise AI-Powered Visitor Management System for BHEL Varanasi',
  icons: { icon: '/images/bhel-logo.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#1a3a5c', color: '#fff', borderRadius: '8px' },
              success: { style: { background: '#16a34a' } },
              error: { style: { background: '#dc2626' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
