import mainLink from "./mainURLs";


export interface Order {
  _id: string;
  serviceId: {
    _id: string;
    title?: string;
    description?: string;
  };
  customerId: {
    _id: string;
    name: string;
    email?: string;
  };
  providerId: {
    _id: string;
    name: string;
    email?: string;
  };
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "awaiting_payment"
    | "paid";
  initialPrice?: number;
  agreedPrice?: number;
  scheduledDate?: string;
  location?: {
    address: string;
    lat?: number;
    lng?: number;
  };
  paymentStatus: "unpaid" | "pending" | "paid" | "refunded";
  createdAt: string;
  updatedAt: string;
}

export interface JobRequest {
  _id: string;
  serviceId: {
    _id: string;
    title: string;
  };
  customerId: {
    _id: string;
    name: string;
  };
  providerId: {
    _id: string;
    name: string;
  };
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderPayload {
  serviceId: string;
  price?: number;
  scheduledDate?: string;
  address?: string;
}

/**
 * Get all orders for current user
 */
export const getAllOrders = async (): Promise<Order[]> => {
  const response = await mainLink.get("/api/orders");
  return response.data;
};

/**
 * Get order by ID
 */
export const getOrderById = async (orderId: string): Promise<Order> => {
  const response = await mainLink.get(`/api/orders/${orderId}`);
  return response.data;
};

/**
 * Create a new order
 */
export const createOrder = async (
  payload: CreateOrderPayload,
): Promise<Order> => {
  const response = await mainLink.post("/api/orders", payload);
  return response.data;
};

/**
 * Update order status
 */
export const updateOrderStatus = async (
  orderId: string,
  status: string,
): Promise<Order> => {
  const response = await mainLink.patch(`/api/orders/${orderId}`, { status });
  return response.data;
};

/**
 * Create a new job request (Application)
 */
export const createJobRequest = async (payload: {
  serviceId: string;
}): Promise<JobRequest> => {
  const response = await mainLink.post("/api/orders/request", payload);
  return response.data;
};

/**
 * Update job request status (Approve/Reject)
 */
export const updateJobRequestStatus = async (
  requestId: string,
  status: string,
): Promise<JobRequest> => {
  const response = await mainLink.patch(`/api/orders/request/${requestId}`, {
    status,
  });
  return response.data;
};

/**
 * Get all job requests for current user
 */
export const getMyJobRequests = async (): Promise<JobRequest[]> => {
  const response = await mainLink.get("/api/orders/requests/my");
  return response.data;
};
