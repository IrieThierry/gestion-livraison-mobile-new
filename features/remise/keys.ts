import type { UUID } from '../../types/api';

export const remiseKeys = {
  all: ['remise-client'] as const,
  parClient: (clientId: UUID) => [...remiseKeys.all, clientId] as const,
};
