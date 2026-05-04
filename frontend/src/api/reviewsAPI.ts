import mainLink from "./mainURLs.ts";

export interface Review {
  _id: string;
  serviceId: string;
  reviewerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  stats: {
    averageRating: number;
    totalReviews: number;
  };
}

export async function getUserReviews(userId: string) {
  const res = await mainLink.get(`/api/reviews/user/${userId}`);

  return res.data;
}

export async function createReview(data: {
  orderId: string;
  serviceId?: string;
  revieweeId: string;
  revieweeRole: "seeker" | "poster";
  rating: number;
  comment: string;
}) {
  const res = await mainLink.post("/api/reviews", data);
  return res.data;
}

export async function getReviewByOrder(
  orderId: string,
  role: "seeker" | "poster",
) {
  const res = await mainLink.get(`/api/orders/${orderId}/review`, {
    params: { role },
  });
  return res.data;
}
