export type UserUpdatePayload =
  | FormData
  | {
      [key: string]: string | number | boolean | undefined;
    };
