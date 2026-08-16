import * as migration_20260810_103455 from './20260810_103455';
import * as migration_20260816_201404_add_phone_and_api_key_to_users from './20260816_201404_add_phone_and_api_key_to_users';

export const migrations = [
  {
    up: migration_20260810_103455.up,
    down: migration_20260810_103455.down,
    name: '20260810_103455',
  },
  {
    up: migration_20260816_201404_add_phone_and_api_key_to_users.up,
    down: migration_20260816_201404_add_phone_and_api_key_to_users.down,
    name: '20260816_201404_add_phone_and_api_key_to_users'
  },
];
