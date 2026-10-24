import mainLink from './mainURLs';

export const createSupportTicket = async (payload: { subject: string; message: string; email?: string }) =>
  (await mainLink.post('/api/support/tickets', payload)).data;
