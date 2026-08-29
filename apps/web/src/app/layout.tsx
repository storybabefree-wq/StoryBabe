import React from 'react';
import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '../context/AuthContext';
import AuthGuard from '../components/AuthGuard';
import Header from '../components/Header';
import Footer from '../components/Footer';

export const metadata: Metadata = {
  title: 'StoryBabe — Real Personal Experiences as Text Stories',
  description: 'A platform where real people share authentic personal experiences. Read genuine stories, follow distinct human voices, and connect through shared experiences.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AuthProvider>
          <Header />
          <main style={{ flexGrow: 1, paddingBottom: '3rem' }}>
            <AuthGuard>{children}</AuthGuard>
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
