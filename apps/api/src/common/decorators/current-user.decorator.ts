import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  userId: string;
  username: string;
  email?: string;
  sessionId?: string;
  isMinor?: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
