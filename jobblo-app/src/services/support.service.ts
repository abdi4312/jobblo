import apiClient from '../api/client';

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type SupportTicket = {
  _id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  createdAt: string;
};

export type CreateTicketResponse = {
  message: string;
  ticketId: string;
};

export async function createTicket(payload: {
  subject: string;
  message: string;
}): Promise<CreateTicketResponse> {
  const response = await apiClient.post<CreateTicketResponse>('/support/tickets', {
    subject: payload.subject.trim(),
    message: payload.message.trim(),
  });
  return response.data;
}

export async function getMyTickets(): Promise<SupportTicket[]> {
  const response = await apiClient.get<SupportTicket[]>('/support/tickets/mine');
  return response.data;
}
