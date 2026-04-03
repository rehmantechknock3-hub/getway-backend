"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";

import { setAuthToken, usePublicProviders } from "@repo/api-client";

export default function ProvidersPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setTokenReady(true);
      return;
    }
    void getToken().then((token) => {
      setAuthToken(token);
      setTokenReady(true);
    });
  }, [isLoaded, isSignedIn, getToken]);

  const { data: providers, isLoading, isError, error } = usePublicProviders(
    undefined,
    undefined,
    25,
    { enabled: isLoaded && isSignedIn && tokenReady }
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
      <p className="mt-2 text-gray-600 max-w-2xl">
        Same data as the mobile Discover feed: users with role <span className="font-mono text-sm">PROVIDER</span>{" "}
        and a provider profile in PostgreSQL. The sidebar link is not a separate list — it reads{" "}
        <span className="font-mono text-sm">GET /api/v1/providers</span>.
      </p>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white overflow-hidden">
        {!isLoaded || (isSignedIn && !tokenReady) || isLoading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : isError ? (
          <p className="p-6 text-red-600">
            Could not load providers. Is the API running and{" "}
            <span className="font-mono text-sm">NEXT_PUBLIC_API_URL</span> set?{" "}
            {error instanceof Error ? error.message : ""}
          </p>
        ) : !providers?.length ? (
          <p className="p-6 text-gray-600">
            No provider rows returned. Until someone completes sign-up with &quot;I provide services&quot; (and your
            API uses this database), the mobile app will also show an empty list here.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Reviews</th>
                <th className="px-4 py-3 font-medium">Profile ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => (
                <tr key={p.id} className="text-gray-900">
                  <td className="px-4 py-3">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.serviceCategory ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.serviceArea ?? "—"}</td>
                  <td className="px-4 py-3">{p.averageRating.toFixed(1)}</td>
                  <td className="px-4 py-3">{p.totalReviews}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
