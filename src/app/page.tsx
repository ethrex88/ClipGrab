
import ClipGrabForm from "@/components/clip-grab-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-8 md:p-12 lg:p-24">
      {/* The min-h-screen was removed as RootLayout now controls overall screen height */}
      {/* flex-1 allows this main content to grow and fill available space */}
      <ClipGrabForm />
    </main>
  );
}