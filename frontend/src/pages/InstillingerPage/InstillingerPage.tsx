import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

export default function InstillingerPage() {
  const navigate = useNavigate();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div style={{ minHeight: "70vh", maxWidth: "800px", margin: "0 auto", padding: "0 20px" }}>
      <ProfileTitleWrapper title="Innstillinger" buttonText="Tilbake" />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 0px",
          borderBottom: "1px solid var(--color-divider)",
        }}
      ></div>

      {/* Betalingsmåte Section */}
      <div style={{ padding: "0 40px" }}>
        <p
          onClick={() => toggleSection("payment")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--color-accent)" }}
            >
              credit_card
            </span>
            Betalingsmåte
          </span>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--color-accent)" }}
          >
            {expandedSection === "payment"
              ? "keyboard_arrow_down"
              : "keyboard_arrow_right"}
          </span>
        </p>

        {expandedSection === "payment" && (
          <div
            style={{
              padding: "16px 0",
              marginLeft: "32px",
              animation: "slideDown 0.3s ease-out",
            }}
          >
            <p>Her kan du administrere dine betalingsmåter.</p>
            <button
              style={{
                marginTop: "12px",
                padding: "8px 16px",
                backgroundColor: "var(--color-accent)",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Legg til betalingsmåte
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--color-divider)",
          }}
        ></div>
      </div>

      {/* Personvern Section */}
      <div style={{ padding: "0 40px" }}>
        <p
          onClick={() => toggleSection("privacy")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--color-accent)" }}
            >
              accessibility
            </span>
            Personvern
          </span>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--color-accent)" }}
          >
            {expandedSection === "privacy"
              ? "keyboard_arrow_down"
              : "keyboard_arrow_right"}
          </span>
        </p>

        {expandedSection === "privacy" && (
          <div
            style={{
              padding: "16px 0",
              marginLeft: "32px",
              animation: "slideDown 0.3s ease-out",
            }}
          >
            <p>Her kan du administrere dine personverninnstillinger.</p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <input type="checkbox" />
              Del min profil med andre brukere
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <input type="checkbox" />
              Tillat annonser
            </label>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--color-divider)",
          }}
        ></div>
      </div>

      {/* Varsler Section */}
      <div style={{ padding: "0 40px" }}>
        <p
          onClick={() => toggleSection("notifications")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className="material-symbols-outlined"
              style={{ color: "var(--color-accent)" }}
            >
              notification_add
            </span>
            Varsler
          </span>
          <span
            className="material-symbols-outlined"
            style={{ color: "var(--color-accent)" }}
          >
            {expandedSection === "notifications"
              ? "keyboard_arrow_down"
              : "keyboard_arrow_right"}
          </span>
        </p>

        {expandedSection === "notifications" && (
          <div
            style={{
              padding: "16px 0",
              marginLeft: "32px",
              animation: "slideDown 0.3s ease-out",
            }}
          >
            <p>Her kan du administrere dine varslingsinnstillinger.</p>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "12px",
              }}
            >
              <input type="checkbox" defaultChecked />
              E-postvarsler
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <input type="checkbox" defaultChecked />
              Push-varsler
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <input type="checkbox" />
              SMS-varsler
            </label>
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--color-divider)",
          }}
        ></div>
      </div>
    </div>
  );
}
