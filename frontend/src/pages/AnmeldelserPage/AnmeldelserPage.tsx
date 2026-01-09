import { useState, useEffect } from "react";
import StjerneIcon from "../../assets/icons/stjerne.svg?react";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

interface DisplayReview {
  id: string;
  reviewerName: string;
  reviewerAvatar: string;
  rating: number;
  date: string;
  comment: string;
  jobTitle: string;
}

export default function AnmeldelserPage() {
  const [activeTab, setActiveTab] = useState<"received" | "given">("received");
  const [receivedReviews, setReceivedReviews] = useState<DisplayReview[]>([]);
  const [givenReviews, setGivenReviews] = useState<DisplayReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalReviews, setTotalReviews] = useState<number>(0);

  useEffect(() => {
    // Using fake data for design purposes
    const fakeReceivedReviews: DisplayReview[] = [
      {
        id: "1",
        reviewerName: "Illyas",
        reviewerAvatar: "https://via.placeholder.com/40",
        rating: 5,
        date: "04.01.2002",
        comment: "Veldig stort og fin vegg, jeg er sjalu",
        jobTitle: "Stor og lang vegg trengs maling"
      },
      {
        id: "2",
        reviewerName: "Dulahi",
        reviewerAvatar: "https://via.placeholder.com/40",
        rating: 4,
        date: "04.01.2002",
        comment: "Knuste den benken og fikk pengene",
        jobTitle: "Benk trengs knuses"
      }
    ];

    const fakeGivenReviews: DisplayReview[] = [
      {
        id: "3",
        reviewerName: "Anne Berg",
        reviewerAvatar: "https://via.placeholder.com/40",
        rating: 5,
        date: "12.11.2025",
        comment: "Fantastisk service! Veldig fornøyd med resultatet.",
        jobTitle: "Hagearbeid"
      },
      {
        id: "4",
        reviewerName: "Lars Hansen",
        reviewerAvatar: "https://via.placeholder.com/40",
        rating: 5,
        date: "08.11.2025",
        comment: "Rask og effektiv, anbefales!",
        jobTitle: "Flyttehjelp"
      }
    ];

    setReceivedReviews(fakeReceivedReviews);
    setGivenReviews(fakeGivenReviews);
    setAverageRating(4.5);
    setTotalReviews(2);
    setLoading(false);
  }, []);



  const currentReviews = activeTab === "received" ? receivedReviews : givenReviews;

  return (
    <div style={{ minHeight: "70vh", maxWidth: "800px", margin: "0 auto" }}>
      <ProfileTitleWrapper title="Anmeldelser" buttonText="Tilbake til Min Side" />

      {/* Rating Summary */}
      {!loading && totalReviews > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "16px 20px",
            margin: "0 20px 20px",
            backgroundColor: "#F5F5F5",
            borderRadius: "8px"
          }}
        >
          <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--color-accent)" }}>
            {averageRating.toFixed(1)}
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
            Basert på {totalReviews} anmeldelser
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          padding: "0 20px",
          marginBottom: "20px"
        }}
      >
        <button
          onClick={() => setActiveTab("received")}
          style={{
            flex: 1,
            maxWidth: "200px",
            padding: "12px 20px",
            backgroundColor: activeTab === "received" ? "#E0E0E0" : "transparent",
            color: "var(--color-text)",
            border: "none",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: activeTab === "received" ? "600" : "400",
            transition: "all 0.2s"
          }}
        >
          Anmelder fått
        </button>
        <button
          onClick={() => setActiveTab("given")}
          style={{
            flex: 1,
            maxWidth: "200px",
            padding: "12px 20px",
            backgroundColor: activeTab === "given" ? "#E0E0E0" : "transparent",
            color: "var(--color-text)",
            border: "none",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: activeTab === "given" ? "600" : "400",
            transition: "all 0.2s"
          }}
        >
          Anmeldelser gitt
        </button>
      </div>

      {/* Reviews List */}
      <div style={{ padding: "0 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#666", padding: "40px 0" }}>
            Laster anmeldelser...
          </p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#D32F2F", padding: "40px 0" }}>
            {error}
          </p>
        ) : currentReviews.length === 0 ? (
          <p style={{ textAlign: "center", color: "#666", fontStyle: "italic", padding: "40px 0" }}>
            Ingen anmeldelser ennå
          </p>
        ) : (
          currentReviews.map((review) => (
            <div key={review.id} style={{ marginBottom: "16px" }}>
              {/* Section Header */}
              <div style={{ 
                fontSize: "12px", 
                fontWeight: "600", 
                color: "#666",
                marginBottom: "8px",
              }}>
                Du {activeTab === "received" ? "la ut" : "la ut"}
              </div>
              <div style={{ 
                fontSize: "16px", 
                fontWeight: "600", 
                marginBottom: "12px"
              }}>
                {review.jobTitle}
              </div>

              {/* Review Card */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#FFFFFF",
                  borderRadius: "12px",
                  border: "1px solid #E0E0E0",
                  marginBottom: "8px"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                  {/* Star Icon with Rating Number */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      position: "relative"
                    }}
                  >
                    <StjerneIcon />
                    <span
                      style={{
                        position: "absolute",
                        fontSize: "18px",
                        fontWeight: "700",
                        paddingTop: "2px" //fjern om mås er for å fikse rating
                      }}
                    >
                      {review.rating}
                    </span>
                  </div>

                  {/* Name and Role */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "16px", marginBottom: "2px" }}>
                      {review.reviewerName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      Oppdragstaker
                    </div>
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {review.date}
                  </div>
                </div>

                {/* Comment */}
                <div style={{ fontSize: "14px", lineHeight: "1.5", marginBottom: "12px" }}>
                  {review.comment}
                </div>

                {/* Report Button */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    style={{
                      padding: "6px 16px",
                      backgroundColor: "transparent",
                      color: "#666",
                      border: "1px solid #E0E0E0",
                      borderRadius: "16px",
                      cursor: "pointer",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    Rapporter
                    <span
                      style={{
                        padding: "2px 8px",
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E0E0E0",
                        borderRadius: "12px",
                        fontSize: "11px"
                      }}
                    >
                      Svar
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
