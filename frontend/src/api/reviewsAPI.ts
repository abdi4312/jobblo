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
