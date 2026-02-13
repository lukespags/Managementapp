import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = request.headers.get("x-aboss-token");
  const accountType = searchParams.get("accountType") || "artist";
  const projectId = searchParams.get("projectId");
  const agencyId = searchParams.get("agencyId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!token || !projectId) {
    return NextResponse.json(
      { error: "Missing token or projectId" },
      { status: 400 }
    );
  }

  let url;
  if (accountType === "agency" && agencyId) {
    url = `https://data.a-boss.net/v1/agency/${agencyId}/${projectId}/public_events`;
  } else {
    url = `https://data.a-boss.net/v1/artist/${projectId}/public_events`;
  }

  if (from || to) {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    url += `?${params.toString()}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `ABOSS returned ${res.status}`, details: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach ABOSS API", details: err.message },
      { status: 502 }
    );
  }
}
