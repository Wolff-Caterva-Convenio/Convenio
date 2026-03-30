"use client";

export default function BookingActionsCard({
  booking,
  onReview,
  alreadyReviewed,
  rating,
}) {
  const canReview =
    booking.status === "COMPLETED" && !alreadyReviewed;

  return (
    <>
      {/* REVIEW BUTTON */}
      {canReview && (
        <button
          onClick={() => onReview(booking)}
          style={{
            marginTop: 10,
            background: "#2563eb",
            color: "white",
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Leave review
        </button>
      )}

      {/* REVIEW DISPLAY */}
      {alreadyReviewed && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map((star) => (
              <span
                key={star}
                style={{
                  color: star <= rating ? "#f59e0b" : "#d1d5db",
                  fontSize: 20,
                }}
              >
                ★
              </span>
            ))}
          </div>

          <div style={{ marginTop: 4, fontSize: 13, color: "#555" }}>
            Your rating: {rating}/10
          </div>
        </div>
      )}
    </>
  );
}