import { mainLink } from "./mainURLs";

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

export const getUserReviews = async (userId: string): Promise<ReviewsResponse> => {
  try {
    const response = await fetch(`${mainLink}/api/reviews/user/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.statusText}`);
    }

    const data: ReviewsResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching user reviews:", error);
    throw error;
  }
};
