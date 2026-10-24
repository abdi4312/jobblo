import mainLink from './mainURLs.ts';

export async function createReview(data: {
  orderId: string;
  serviceId?: string;
  revieweeId: string;
  revieweeRole: 'seeker' | 'poster';
  rating: number;
  comment: string;
}) {
  const res = await mainLink.post('/api/reviews', data);
  return res.data;
}

export async function getReviewByOrder(orderId: string, role?: 'seeker' | 'poster') {
  const res = await mainLink.get(`/api/orders/${orderId}/review`, {
    params: { role },
  });
  return res.data;
}
