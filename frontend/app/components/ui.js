// app/components/ui.js
"use client";

export function Page({ title, subtitle, right, children }) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          {title ? <h1 style={{ margin: "8px 0 4px", fontSize: 24 }}>{title}</h1> : null}
          {subtitle ? <div style={{ color: "#555", marginBottom: 10 }}>{subtitle}</div> : null}
        </div>
        {right ? <div style={{ marginTop: 10 }}>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, style }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({ children, onClick, type = "button", disabled, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: disabled ? "#f3f3f3" : "#111",
        color: disabled ? "#777" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, type = "button", disabled, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        background: "#fff",
        color: "#111",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input({ value, onChange, placeholder, type = "text", style }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid #ddd",
        outline: "none",
        ...style,
      }}
    />
  );
}

export function Label({ children }) {
  return <div style={{ fontSize: 12, color: "#555", marginBottom: 6 }}>{children}</div>;
}

export function Alert({ kind = "info", children }) {
  const bg = kind === "error" ? "#ffe9e9" : kind === "success" ? "#e9ffef" : "#eef6ff";
  const border = kind === "error" ? "#ffb3b3" : kind === "success" ? "#a9f0bf" : "#b8d7ff";
  return (
    <div style={{ border: `1px solid ${border}`, background: bg, padding: 12, borderRadius: 12 }}>
      {children}
    </div>
  );
}