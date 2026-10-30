import type { PetRepository } from '../repositories/PetRepository';
import { GetPets } from './GetPets';

test('GetPets trả về danh sách từ repository', async () => {
  const repo: PetRepository = {
    getAll: async () => [{ id: '1', name: 'A', species: 'dog', weightKg: 5 }],
    getById: async () => null,
    create: async (p) => ({ ...p, id: '1' }),
    update: async (id, p) => ({ id, name: 'A', species: 'dog', weightKg: 5, ...p }),
    delete: async () => {},
  };

  const pets = await new GetPets(repo).execute();

  expect(pets).toHaveLength(1);
  expect(pets[0].name).toBe('A');
});