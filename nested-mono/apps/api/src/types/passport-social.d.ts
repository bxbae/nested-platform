// Minimal ambient declarations for passport strategies that ship without
// their own TypeScript types. The strategy options/profiles are treated as
// `any` at the boundary and validated in each strategy's `validate()`.
declare module "passport-kakao" {
  export class Strategy {
    constructor(options: any, verify?: any);
    name: string;
  }
}

declare module "passport-naver-v2" {
  export class Strategy {
    constructor(options: any, verify?: any);
    name: string;
  }
}

declare module "passport-apple" {
  export class Strategy {
    constructor(options: any, verify?: any);
    name: string;
  }
}
