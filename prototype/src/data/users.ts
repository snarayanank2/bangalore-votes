import type { User } from '../types'

export const seedUsers: User[] = [
  {
    id: 'u-citizen',
    name: 'Asha Rao',
    contact: 'asha@example.com',
    role: 'citizen',
    homeWardId: 'koramangala',
    language: 'en',
    active: true,
  },
  {
    id: 'u-curator',
    name: 'Vikram Shet',
    contact: 'vikram@example.com',
    role: 'curator',
    language: 'en',
    curatorWardIds: ['koramangala', 'indiranagar'],
    active: true,
  },
  {
    id: 'u-admin',
    name: 'Admin',
    contact: 'admin@example.com',
    role: 'admin',
    language: 'en',
    active: true,
  },
]
