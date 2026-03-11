import { useState, useEffect } from "react";
import StjerneIcon from "../../assets/icons/stjerne.svg?react";
import { Star } from "lucide-react";
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
    // Fake data logic remains exactly the same
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
    <div className="min-h-[70vh] max-w-300 mx-auto p-2 ms:p-5 overflow-hidden">
      {/* Rating Summary */}
      <div className="bg-[#FFFFFF1A] flex flex-col gap-6 shadow-sm py-6">
        <h1 className="text-[30px] font-bold text-[#101828] text-center">Amneldenser</h1>
        {!loading && totalReviews > 0 && (
          <div className="text-center py-4 px-5 mx-5 mb-5 bg-[#FFFFFFB2] rounded-lg">
            <div className="text-[28px] font-semibold text-[#4A5565]">
              {averageRating.toFixed(1)}
            </div>
            <div className="text-[14px] font-normal text-[#6A7282] mt-1">
              Basert på {totalReviews} anmeldelser
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex justify-center flex-wrap gap-2 px-5 ">
          <button
            onClick={() => setActiveTab("received")}
            className={`flex-1 max-w-50 py-3 px-5 rounded-[14px] shadow-sm text-[#364153] text-[16px] font-medium transition-all duration-200 border-none text-nowrap cursor-pointer
            ${activeTab === "received" ? "bg-[#2F7E4740]" : "bg-[#FFFFFF1A]"}`}
          >
            Anmelder fått
          </button>
          <button
            onClick={() => setActiveTab("given")}
            className={`flex-1 max-w-50 py-3 px-5 rounded-[14px] shadow-sm text-[16px] text-[#364153] font-medium transition-all duration-200 border-none text-nowrap cursor-pointer
            ${activeTab === "given" ? "bg-[#2F7E4740]" : "bg-[#FFFFFF1A]"}`}
          >
            Anmeldelser gitt
          </button>
        </div>
      </div>


      {/* Reviews List */}
      <div className="py-10 flex gap-6 flex-col">
        {loading ? (
          <p className="text-center text-gray-500 py-10">Laster anmeldelser...</p>
        ) : error ? (
          <p className="text-center text-red-600 py-10">{error}</p>
        ) : currentReviews.length === 0 ? (
          <p className="text-center text-gray-500 italic py-10">Ingen anmeldelser ennå</p>
        ) : (
          currentReviews.map((review) => (
            <div key={review.id} className="bg-[#FFFFFF1A] p-6 shadow-sm rounded-xl flex justify-between flex-wrap">
              {/* Section Header */}
              <div>
                <div className="text-[12px] font-semibold text-[#000000 ] mb-2">
                  Du {activeTab === "received" ? "la ut" : "la ut"}
                </div>
                <div className="text-[16px] md:text-[20px] font-semibold mb-3 text-[#0A0A0A]">
                  {review.jobTitle}
                </div>
              </div>

              {/* Review Card */}
              <div className="p-4 w-full max-w-182.5 bg-[#FFFFFF1A] rounded-xl mb-2 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  {/* Star Icon with Rating Number */}
                  <div className="relative flex text-[#2F7E47] p-3 bg-[#FFFFFF1A] shadow-sm rounded-[14px] items-center justify-center shrink-0">
                    <Star size={45} />
                    <span className="absolute text-[18px] font-bold pt-0.5">
                      {review.rating}
                    </span>
                  </div>

                  {/* Name and Role */}
                  <div className="flex-1">
                    <div className="font-semibold text-[16px] md:text-[20px] md:font-bold mb-0.5 text-[#0A0A0A]">
                      {review.reviewerName}
                    </div>
                    <div className="text-[12px] font-light text-[#000000]">
                      Oppdragstaker
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-[12px] font-light text-[#000000]">
                    {review.date}
                  </div>
                </div>

                {/* Comment */}
                <div className="text-[14px] font-medium text-[#6A7282] mb-3">
                  {review.comment}
                </div>

                {/* Report Button */}
                <div className="flex gap-6 justify-end">
                  {/* <button className="flex items-center gap-1 py-1.5 px-4 bg-transparent text-gray-500 border border-[#E0E0E0] rounded-[16px] cursor-pointer text-[12px] hover:bg-gray-50 transition-colors">
                    Rapporter
                    <span className="py-0.5 px-2 bg-white border border-[#E0E0E0] rounded-[12px] text-[11px] ml-1">
                      Svar
                    </span>
                  </button> */}
                  <button className="px-3 py-1.5 bg-[#FFFFFF1A] text-[16px] text-[#212121] font-medium shadow-sm rounded-[14px] hover:bg-[#2F7E4740]">Rapporter</button>
                  <button className="px-3 py-1.5 bg-[#FFFFFF1A] text-[16px] text-[#212121] font-medium shadow-sm rounded-[14px] hover:bg-[#2F7E4740]">svar</button>
                </div>
              </div>

            </div>

          ))
        )}
      </div>
    </div>
  );
}