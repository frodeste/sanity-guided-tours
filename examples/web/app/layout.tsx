import type {Metadata} from 'next'
import type {ReactNode} from 'react'

export const metadata: Metadata = {
  title: 'sanity-plugin-guided-tours — example app',
  description: 'M1 example app for sanity-plugin-guided-tours: embedded Studio + tour page.',
}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body style={{margin: 0}}>{children}</body>
    </html>
  )
}
