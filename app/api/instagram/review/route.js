import { NextResponse } from "next/server";
import {
  getNextInstagramDiscovery,
  reviewInstagramDiscovery,
} from "../../../../lib/instagramDiscoveries";

function isSlideList(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((slide) => Number.isInteger(slide) && slide > 0)
  );
}

export async function POST(request) {
  const { id, status, archiveCategory, carouselSlides } = await request.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (carouselSlides != null && !isSlideList(carouselSlides)) {
    return NextResponse.json({ error: "Invalid carousel slides" }, { status: 400 });
  }

  const { error } = await reviewInstagramDiscovery(
    id,
    status,
    archiveCategory,
    status === "approved" ? carouselSlides : null,
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: nextDiscovery, error: nextError } =
    await getNextInstagramDiscovery();

  if (nextError) {
    return NextResponse.json({ error: nextError.message }, { status: 500 });
  }

  return NextResponse.json({
    nextDiscovery,
  });
}
