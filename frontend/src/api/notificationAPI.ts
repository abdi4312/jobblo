import mainLink from "./mainURLs";

export async function getNotifications(userId: string) {
  const res = await mainLink.get(`/api/notifications?userId=${userId}`);
  return res.data;
}
