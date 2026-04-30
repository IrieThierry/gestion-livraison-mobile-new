import { loginSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    const result = loginSchema.safeParse({ username: 'marc.k', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({ username: 'marc.k', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects when fields are missing', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
