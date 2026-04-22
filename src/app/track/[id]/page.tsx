import { Header }     from "@/frontend/components/layout/header";
import { Footer }     from "@/frontend/components/layout/footer";
import { TrackingResult } from "@/frontend/components/tracking/tracking-result";
import { trackShipment, TrackingError } from "@/backend/services/tracking";
import Link           from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const number = decodeURIComponent(id);
  return {
    title:       `Tracking ${number} — Container Tracking`,
    description: `Real-time tracking status for ${number}. Sea container and air cargo tracking.`,
  };
}

export default async function TrackingPage({ params }: Props) {
  const { id } = await params;
  const trackingNumber = decodeURIComponent(id).toUpperCase();

  let result = null;
  let errorMessage: string | null = null;

  try {
    result = await trackShipment(trackingNumber);
  } catch (err) {
    if (err instanceof TrackingError) {
      errorMessage = err.message;
    } else {
      errorMessage = "An unexpected error occurred. Please try again.";
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-4rem)] py-12
                       bg-gradient-to-b from-[#F5F7FA] to-white
                       dark:from-navy-950 dark:to-navy-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">

          {/* Back link */}
          <Link
            href="/track"
            className="mb-6 inline-flex items-center gap-1.5 text-sm transition-colors
                       text-[#6B7280] hover:text-[#FF6A00]
                       dark:text-navy-300 dark:hover:text-orange-400"
          >
            ← Track another shipment
          </Link>

          {errorMessage ? (
            <div className="rounded-2xl p-8 text-center border
                            border-red-200 bg-red-50
                            dark:border-red-500/25 dark:bg-red-500/10">
              <div className="mb-3 text-4xl">📦</div>
              <h2 className="text-lg font-bold text-[#1F2937] dark:text-white">Tracking Not Found</h2>
              <p className="mt-2 text-sm text-[#6B7280] dark:text-navy-300">{errorMessage}</p>
              <Link
                href="/track"
                className="mt-6 inline-block rounded-xl px-6 py-2.5 text-sm font-bold text-white
                           bg-[#FF6A00] hover:bg-[#FF7A1A]
                           dark:bg-orange-500 dark:hover:bg-orange-600"
              >
                Try Again
              </Link>
            </div>
          ) : result ? (
            <TrackingResult result={result} />
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
