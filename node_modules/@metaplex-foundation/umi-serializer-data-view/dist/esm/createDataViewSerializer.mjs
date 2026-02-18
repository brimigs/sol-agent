import { tuple, array, map, set, option, nullable, struct, scalarEnum, dataEnum, string, bool, unit, u8, u16, u32, u64, u128, i8, i16, i32, i64, i128, f32, f64, bytes, publicKey } from '@metaplex-foundation/umi/serializers';

function createDataViewSerializer(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
options = {}) {
  return {
    tuple,
    array,
    map,
    set,
    option,
    nullable,
    struct,
    enum: scalarEnum,
    dataEnum,
    string,
    bool,
    unit,
    u8,
    u16,
    u32,
    u64,
    u128,
    i8,
    i16,
    i32,
    i64,
    i128,
    f32,
    f64,
    bytes,
    publicKey
  };
}

export { createDataViewSerializer };
//# sourceMappingURL=createDataViewSerializer.mjs.map
