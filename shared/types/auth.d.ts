declare module "#auth-utils" {
  interface User {
    id: number;
    twitchId: string;
    twitchLogin: string;
    twitchDisplay: string;
  }
}

export {};
