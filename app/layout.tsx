import type { Metadata } from "next"
import { Inter } from 'next/font/google'
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from 'react' // Import Suspense

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MyPocket Reader",
  description: "Import and explore your Pocket articles and highlights",
  generator: 'v0.dev',
  icons: {
    icon: '/pocket-icon.jpg',
    shortcut: '/pocket-icon.jpg',
    apple: '/pocket-icon.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}> {/* Wrap children with Suspense */}
            {children}
          </Suspense>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
