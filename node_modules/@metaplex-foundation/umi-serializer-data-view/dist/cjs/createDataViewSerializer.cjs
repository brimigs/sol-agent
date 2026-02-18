'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var serializers = require('@metaplex-foundation/umi/serializers');

function createDataViewSerializer(
// eslint-disable-next-line @typescript-eslint/no-unused-vars
options = {}) {
  return {
    tuple: serializers.tuple,
    array: serializers.array,
    map: serializers.map,
    set: serializers.set,
    option: serializers.option,
    nullable: serializers.nullable,
    struct: serializers.struct,
    enum: serializers.scalarEnum,
    dataEnum: serializers.dataEnum,
    string: serializers.string,
    bool: serializers.bool,
    unit: serializers.unit,
    u8: serializers.u8,
    u16: serializers.u16,
    u32: serializers.u32,
    u64: serializers.u64,
    u128: serializers.u128,
    i8: serializers.i8,
    i16: serializers.i16,
    i32: serializers.i32,
    i64: serializers.i64,
    i128: serializers.i128,
    f32: serializers.f32,
    f64: serializers.f64,
    bytes: serializers.bytes,
    publicKey: serializers.publicKey
  };
}

exports.createDataViewSerializer = createDataViewSerializer;
//# sourceMappingURL=createDataViewSerializer.cjs.map
