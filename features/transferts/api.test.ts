import { apiClient } from '../../lib/api-client';
import { transfertsApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: {} });
});

describe('transfertsApi', () => {
  it('à décider : GET /transfert-stock/a-decider', async () => {
    await transfertsApi.aDecider();
    expect(get).toHaveBeenCalledWith('/transfert-stock/a-decider');
  });

  it('accepter et annuler : POST sans corps', async () => {
    await transfertsApi.accepter('t1');
    expect(post).toHaveBeenCalledWith('/transfert-stock/t1/accepter');
    await transfertsApi.annuler('t1');
    expect(post).toHaveBeenCalledWith('/transfert-stock/t1/annuler');
  });

  it('refuser : POST avec {motif}', async () => {
    await transfertsApi.refuser('t1', 'Pas commandé');
    expect(post).toHaveBeenCalledWith('/transfert-stock/t1/refuser', { motif: 'Pas commandé' });
  });
});
