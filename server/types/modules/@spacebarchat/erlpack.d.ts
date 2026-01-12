declare module '@spacebarchat/erlpack' {
  export function pack(data: any): Buffer;
  export function unpack<T = any>(
    data: Uint8Array | Uint8ClampedArray | Buffer,
    decodeBigint = false,
  ): T;
}
