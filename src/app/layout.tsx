
"use client"; // Required because of useState and useEffect for theme toggling

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import React, { useState, useEffect } from 'react';
import Header from '@/components/header';
import Footer from '@/components/footer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// export const metadata: Metadata = { // Cannot export metadata from a client component
//   title: 'ClipGrab - Download Videos Easily',
//   description: 'Download videos from YouTube, Instagram, X, Reddit, and more with ClipGrab.',
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, setTheme] = useState('light'); // Default theme

  useEffect(() => {
    // This effect runs only on the client
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    }
    // No else needed, default is 'light'
  }, []);

  useEffect(() => {
    // This effect runs when theme state changes
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  // Set title and description dynamically if needed, or move metadata to a server component parent if possible
  useEffect(() => {
    document.title = 'ClipGrab - Download Videos Easily';
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Download videos from YouTube, Instagram, X, Reddit, and more with ClipGrab.');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Download videos from YouTube, Instagram, X, Reddit, and more with ClipGrab.';
      document.head.appendChild(meta);
    }
  }, []);


  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : ''}>
      <head>
        {/* Metadata can be managed here or via a Head component from next/head if needed */}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen bg-background text-foreground`}>
        <Header theme={theme} setTheme={setTheme} />
        <div className="flex-grow w-full flex flex-col"> {/* Ensures main content can grow */}
          {children}
        </div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
