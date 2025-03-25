import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50/50 flex items-center justify-center">
        <h1>Hello World</h1>
        <div  className="absolute inset-0 -z-10 h-full w-full"/>

        <SignedIn>
          <Link href="/dashboard">
          </Link>
        </SignedIn>

        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
        </SignedOut>
    </div>
  );
}
