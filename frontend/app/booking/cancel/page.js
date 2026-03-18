export default function BookingCancelPage() {
  const cardStyle = {
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 16,
    maxWidth: 720,
    margin: "24px auto",
    background: "white",
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Payment cancelled</h2>
        <p>
          You cancelled the payment before it completed. No charge was made.
        </p>
        <p>
          <a href="/venues">Return to venues</a>
        </p>
      </div>
    </div>
  );
}