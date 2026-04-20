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
      <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-navy-50 to-white py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">

          {/* Back link */}
          <Link
            href="/track"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-orange-500 transition-colors"
          >
            ← Track another shipment
          </Link>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <div className="mb-3 text-4xl">📦</div>
              <h2 className="text-lg font-bold text-navy-600">Tracking Not Found</h2>
              <p className="mt-2 text-sm text-navy-400">{errorMessage}</p>
              <Link
                href="/track"
                className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
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
