import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User authentication required to evaluate role permissions.');
    }

    const userRole = (user.role || 'USER').toUpperCase() as UserRole;

    // SUPERADMIN inherits all roles
    if (userRole === 'SUPERADMIN') {
      return true;
    }

    // ADMIN inherits MODERATOR, CREATOR, USER
    if (userRole === 'ADMIN' && !requiredRoles.includes('SUPERADMIN')) {
      return true;
    }

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): [${requiredRoles.join(', ')}]. Current role: [${userRole}].`,
      );
    }

    return true;
  }
}
