import * as base from '@scure/base';
export declare const EMPTY: Uint8Array;
export declare const NULL: Uint8Array;
export declare function equalBytes(a: Uint8Array, b: Uint8Array): boolean;
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
export declare const isBytes: (b: unknown) => b is Uint8Array;
export type Bytes = Uint8Array;
export type Option<T> = T | undefined;
export interface Coder<F, T> {
    encode(from: F): T;
    decode(to: T): F;
}
export interface BytesCoder<T> extends Coder<T, Bytes> {
    size?: number;
    encode: (data: T) => Bytes;
    decode: (data: Bytes) => T;
}
export interface BytesCoderStream<T> {
    size?: number;
    encodeStream: (w: Writer, value: T) => void;
    decodeStream: (r: Reader) => T;
}
export type CoderType<T> = BytesCoderStream<T> & BytesCoder<T>;
export type Sized<T> = CoderType<T> & {
    size: number;
};
export type UnwrapCoder<T> = T extends CoderType<infer U> ? U : T;
export type Length = CoderType<number> | CoderType<bigint> | number | Bytes | string | null;
type ArrLike<T> = Array<T> | ReadonlyArray<T>;
export type TypedArray = Uint8Array | Int8Array | Uint8ClampedArray | Uint16Array | Int16Array | Uint32Array | Int32Array;
export type Writable<T> = T extends {} ? T extends TypedArray ? T : {
    -readonly [P in keyof T]: Writable<T[P]>;
} : T;
type Values<T> = T[keyof T];
type NonUndefinedKey<T, K extends keyof T> = T[K] extends undefined ? never : K;
type NullableKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? never : K;
type OptKey<T, K extends keyof T> = NullableKey<T, K> & NonUndefinedKey<T, K>;
type ReqKey<T, K extends keyof T> = T[K] extends NonNullable<T[K]> ? K : never;
type OptKeys<T> = Pick<T, {
    [K in keyof T]: OptKey<T, K>;
}[keyof T]>;
type ReqKeys<T> = Pick<T, {
    [K in keyof T]: ReqKey<T, K>;
}[keyof T]>;
type StructInput<T extends Record<string, any>> = {
    [P in keyof ReqKeys<T>]: T[P];
} & {
    [P in keyof OptKeys<T>]?: T[P];
};
type StructRecord<T extends Record<string, any>> = {
    [P in keyof T]: CoderType<T[P]>;
};
type StructOut = Record<string, any>;
type PadFn = (i: number) => number;
export declare class Reader {
    readonly data: Bytes;
    path: StructOut[];
    fieldPath: string[];
    pos: number;
    hasPtr: boolean;
    bitBuf: number;
    bitPos: number;
    constructor(data: Bytes, path?: StructOut[], fieldPath?: string[]);
    err(msg: string): Error;
    absBytes(n: number): Uint8Array;
    bytes(n: number, peek?: boolean): Uint8Array;
    byte(peek?: boolean): number;
    get leftBytes(): number;
    isEnd(): boolean;
    length(len: Length): number;
    bits(bits: number): number;
    find(needle: Bytes, pos?: number): number | undefined;
    finish(): void;
    fieldPathPush(s: string): void;
    fieldPathPop(): void;
}
export declare class Writer {
    path: StructOut[];
    fieldPath: string[];
    private buffers;
    pos: number;
    ptrs: {
        pos: number;
        ptr: CoderType<number>;
        buffer: Bytes;
    }[];
    bitBuf: number;
    bitPos: number;
    constructor(path?: StructOut[], fieldPath?: string[]);
    err(msg: string): Error;
    bytes(b: Bytes): void;
    byte(b: number): void;
    get buffer(): Bytes;
    length(len: Length, value: number): void;
    bits(value: number, bits: number): void;
    fieldPathPush(s: string): void;
    fieldPathPop(): void;
}
export declare function checkBounds(p: Writer | Reader, value: bigint, bits: bigint, signed: boolean): void;
export declare function wrap<T>(inner: BytesCoderStream<T>): BytesCoderStream<T> & BytesCoder<T>;
export declare function isCoder<T>(elm: any): elm is CoderType<T>;
declare function dict<T>(): base.Coder<[string, T][], Record<string, T>>;
type Enum = {
    [k: string]: number | string;
} & {
    [k: number]: string;
};
type EnumKeys<T extends Enum> = keyof T;
declare function tsEnum<T extends Enum>(e: T): base.Coder<number, EnumKeys<T>>;
declare function decimal(precision: number): {
    encode: (from: bigint) => string;
    decode: (to: string) => bigint;
};
type BaseInput<F> = F extends base.Coder<infer T, any> ? T : never;
type BaseOutput<F> = F extends base.Coder<any, infer T> ? T : never;
declare function match<L extends base.Coder<unknown | undefined, unknown | undefined>[], I = {
    [K in keyof L]: NonNullable<BaseInput<L[K]>>;
}[number], O = {
    [K in keyof L]: NonNullable<BaseOutput<L[K]>>;
}[number]>(lst: L): base.Coder<I, O>;
export declare const coders: {
    dict: typeof dict;
    number: base.Coder<bigint, number>;
    tsEnum: typeof tsEnum;
    decimal: typeof decimal;
    match: typeof match;
};
export declare const bits: (len: number) => CoderType<number>;
export declare const bigint: (size: number, le?: boolean, signed?: boolean) => CoderType<bigint>;
export declare const U256LE: CoderType<bigint>;
export declare const U256BE: CoderType<bigint>;
export declare const I256LE: CoderType<bigint>;
export declare const I256BE: CoderType<bigint>;
export declare const U128LE: CoderType<bigint>;
export declare const U128BE: CoderType<bigint>;
export declare const I128LE: CoderType<bigint>;
export declare const I128BE: CoderType<bigint>;
export declare const U64LE: CoderType<bigint>;
export declare const U64BE: CoderType<bigint>;
export declare const I64LE: CoderType<bigint>;
export declare const I64BE: CoderType<bigint>;
export declare const int: (size: number, le?: boolean, signed?: boolean) => CoderType<number>;
export declare const U32LE: CoderType<number>;
export declare const U32BE: CoderType<number>;
export declare const I32LE: CoderType<number>;
export declare const I32BE: CoderType<number>;
export declare const U16LE: CoderType<number>;
export declare const U16BE: CoderType<number>;
export declare const I16LE: CoderType<number>;
export declare const I16BE: CoderType<number>;
export declare const U8: CoderType<number>;
export declare const I8: CoderType<number>;
export declare const bool: CoderType<boolean>;
export declare const bytes: (len: Length, le?: boolean) => CoderType<Bytes>;
export declare const string: (len: Length, le?: boolean) => CoderType<string>;
export declare const cstring: CoderType<string>;
export declare const hex: (len: Length, le?: boolean, withZero?: boolean) => CoderType<string>;
export declare function apply<T, F>(inner: CoderType<T>, b: base.Coder<T, F>): CoderType<F>;
export declare function validate<T>(inner: CoderType<T>, fn: (elm: T) => T): CoderType<T>;
export declare function lazy<T>(fn: () => CoderType<T>): CoderType<T>;
type baseFmt = 'utf8' | 'hex' | 'base16' | 'base32' | 'base64' | 'base64url' | 'base58' | 'base58xmr';
export declare const bytesFormatted: (len: Length, fmt: baseFmt, le?: boolean) => BytesCoderStream<string> & BytesCoder<string>;
export declare const flag: (flagValue: Bytes, xor?: boolean) => CoderType<boolean>;
export declare function flagged<T>(path: string | BytesCoderStream<boolean>, inner: BytesCoderStream<T>, def?: T): CoderType<Option<T>>;
export declare function optional<T>(flag: BytesCoderStream<boolean>, inner: BytesCoderStream<T>, def?: T): CoderType<Option<T>>;
export declare function magic<T>(inner: CoderType<T>, constant: T, check?: boolean): CoderType<undefined>;
export declare const magicBytes: (constant: Bytes | string) => CoderType<undefined>;
export declare function constant<T>(c: T): CoderType<T>;
export declare function struct<T extends Record<string, any>>(fields: StructRecord<T>): CoderType<StructInput<T>>;
export declare function tuple<T extends ArrLike<CoderType<any>>, O = Writable<{
    [K in keyof T]: UnwrapCoder<T[K]>;
}>>(fields: T): CoderType<O>;
type PrefixLength = string | number | CoderType<number> | CoderType<bigint>;
export declare function prefix<T>(len: PrefixLength, inner: CoderType<T>): CoderType<T>;
export declare function array<T>(len: Length, inner: CoderType<T>): CoderType<T[]>;
export declare function map<T>(inner: CoderType<T>, variants: Record<string, T>): CoderType<string>;
export declare function tag<T extends Values<{
    [P in keyof Variants]: {
        TAG: P;
        data: UnwrapCoder<Variants[P]>;
    };
}>, TagValue extends string | number, Variants extends Record<TagValue, CoderType<any>>>(tag: CoderType<TagValue>, variants: Variants): CoderType<T>;
export declare function mappedTag<T extends Values<{
    [P in keyof Variants]: {
        TAG: P;
        data: UnwrapCoder<Variants[P][1]>;
    };
}>, TagValue extends string | number, Variants extends Record<string, [TagValue, CoderType<any>]>>(tagCoder: CoderType<TagValue>, variants: Variants): CoderType<T>;
export declare function bitset<Names extends readonly string[]>(names: Names, pad?: boolean): CoderType<Record<Names[number], boolean>>;
export declare const ZeroPad: PadFn;
export declare function padLeft<T>(blockSize: number, inner: CoderType<T>, padFn: Option<PadFn>): CoderType<T>;
export declare function padRight<T>(blockSize: number, inner: CoderType<T>, padFn: Option<PadFn>): CoderType<T>;
export declare function pointer<T>(ptr: CoderType<number>, inner: CoderType<T>, sized?: boolean): CoderType<T>;
export declare function base64armor<T>(name: string, lineLen: number, inner: Coder<T, Bytes>, checksum?: (data: Bytes) => Bytes): Coder<T, string>;
export declare const nothing: CoderType<undefined>;
export declare function debug<T>(inner: CoderType<T>): CoderType<T>;
export {};
//# sourceMappingURL=index.d.ts.map