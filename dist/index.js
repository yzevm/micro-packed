"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.magicBytes = exports.magic = exports.optional = exports.flagged = exports.flag = exports.bytesFormatted = exports.lazy = exports.validate = exports.apply = exports.hex = exports.cstring = exports.string = exports.bytes = exports.bool = exports.I8 = exports.U8 = exports.I16BE = exports.I16LE = exports.U16BE = exports.U16LE = exports.I32BE = exports.I32LE = exports.U32BE = exports.U32LE = exports.int = exports.I64BE = exports.I64LE = exports.U64BE = exports.U64LE = exports.I128BE = exports.I128LE = exports.U128BE = exports.U128LE = exports.I256BE = exports.I256LE = exports.U256BE = exports.U256LE = exports.bigint = exports.bits = exports.coders = exports.isCoder = exports.wrap = exports.checkBounds = exports.Writer = exports.Reader = exports.isBytes = exports.concatBytes = exports.equalBytes = exports.NULL = exports.EMPTY = void 0;
exports.debug = exports.nothing = exports.base64armor = exports.pointer = exports.padRight = exports.padLeft = exports.ZeroPad = exports.bitset = exports.mappedTag = exports.tag = exports.map = exports.array = exports.prefix = exports.tuple = exports.struct = exports.constant = void 0;
const base = require("@scure/base");
exports.EMPTY = new Uint8Array();
exports.NULL = new Uint8Array([0]);
function equalBytes(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
exports.equalBytes = equalBytes;
function concatBytes(...arrays) {
    if (arrays.length === 1)
        return arrays[0];
    const length = arrays.reduce((a, arr) => a + arr.length, 0);
    const result = new Uint8Array(length);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const arr = arrays[i];
        result.set(arr, pad);
        pad += arr.length;
    }
    return result;
}
exports.concatBytes = concatBytes;
const isBytes = (b) => b instanceof Uint8Array;
exports.isBytes = isBytes;
class Reader {
    constructor(data, path = [], fieldPath = []) {
        this.data = data;
        this.path = path;
        this.fieldPath = fieldPath;
        this.pos = 0;
        this.hasPtr = false;
        this.bitBuf = 0;
        this.bitPos = 0;
    }
    err(msg) {
        return new Error(`Reader(${this.fieldPath.join('/')}): ${msg}`);
    }
    absBytes(n) {
        if (n > this.data.length)
            throw new Error('absBytes: Unexpected end of buffer');
        return this.data.subarray(n);
    }
    bytes(n, peek = false) {
        if (this.bitPos)
            throw this.err('readBytes: bitPos not empty');
        if (!Number.isFinite(n))
            throw this.err(`readBytes: wrong length=${n}`);
        if (this.pos + n > this.data.length)
            throw this.err('readBytes: Unexpected end of buffer');
        const slice = this.data.subarray(this.pos, this.pos + n);
        if (!peek)
            this.pos += n;
        return slice;
    }
    byte(peek = false) {
        if (this.bitPos)
            throw this.err('readByte: bitPos not empty');
        return this.data[peek ? this.pos : this.pos++];
    }
    get leftBytes() {
        return this.data.length - this.pos;
    }
    isEnd() {
        return this.pos >= this.data.length && !this.bitPos;
    }
    length(len) {
        let byteLen;
        if (isCoder(len))
            byteLen = Number(len.decodeStream(this));
        else if (typeof len === 'number')
            byteLen = len;
        else if (typeof len === 'string')
            byteLen = getPath(this.path, len.split('/'));
        if (typeof byteLen === 'bigint')
            byteLen = Number(byteLen);
        if (typeof byteLen !== 'number')
            throw this.err(`Wrong length: ${byteLen}`);
        return byteLen;
    }
    bits(bits) {
        if (bits > 32)
            throw this.err('BitReader: cannot read more than 32 bits in single call');
        let out = 0;
        while (bits) {
            if (!this.bitPos) {
                this.bitBuf = this.data[this.pos++];
                this.bitPos = 8;
            }
            const take = Math.min(bits, this.bitPos);
            this.bitPos -= take;
            out = (out << take) | ((this.bitBuf >> this.bitPos) & (2 ** take - 1));
            this.bitBuf &= 2 ** this.bitPos - 1;
            bits -= take;
        }
        return out >>> 0;
    }
    find(needle, pos = this.pos) {
        if (!(0, exports.isBytes)(needle))
            throw this.err(`find: needle is not bytes! ${needle}`);
        if (this.bitPos)
            throw this.err('findByte: bitPos not empty');
        if (!needle.length)
            throw this.err(`find: needle is empty`);
        for (let idx = pos; (idx = this.data.indexOf(needle[0], idx)) !== -1; idx++) {
            if (idx === -1)
                return;
            const leftBytes = this.data.length - idx;
            if (leftBytes < needle.length)
                return;
            if (equalBytes(needle, this.data.subarray(idx, idx + needle.length)))
                return idx;
        }
    }
    finish() {
        if (this.isEnd() || this.hasPtr)
            return;
        throw this.err(`${this.leftBytes} bytes ${this.bitPos} bits left after unpack: ${base.hex.encode(this.data.slice(this.pos))}`);
    }
    fieldPathPush(s) {
        this.fieldPath.push(s);
    }
    fieldPathPop() {
        this.fieldPath.pop();
    }
}
exports.Reader = Reader;
class Writer {
    constructor(path = [], fieldPath = []) {
        this.path = path;
        this.fieldPath = fieldPath;
        this.buffers = [];
        this.pos = 0;
        this.ptrs = [];
        this.bitBuf = 0;
        this.bitPos = 0;
    }
    err(msg) {
        return new Error(`Writer(${this.fieldPath.join('/')}): ${msg}`);
    }
    bytes(b) {
        if (this.bitPos)
            throw this.err('writeBytes: ends with non-empty bit buffer');
        this.buffers.push(b);
        this.pos += b.length;
    }
    byte(b) {
        if (this.bitPos)
            throw this.err('writeByte: ends with non-empty bit buffer');
        this.buffers.push(new Uint8Array([b]));
        this.pos++;
    }
    get buffer() {
        if (this.bitPos)
            throw this.err('buffer: ends with non-empty bit buffer');
        let buf = concatBytes(...this.buffers);
        for (let ptr of this.ptrs) {
            const pos = buf.length;
            buf = concatBytes(buf, ptr.buffer);
            const val = ptr.ptr.encode(pos);
            for (let i = 0; i < val.length; i++)
                buf[ptr.pos + i] = val[i];
        }
        return buf;
    }
    length(len, value) {
        if (len === null)
            return;
        if (isCoder(len))
            return len.encodeStream(this, value);
        let byteLen;
        if (typeof len === 'number')
            byteLen = len;
        else if (typeof len === 'string')
            byteLen = getPath(this.path, len.split('/'));
        if (typeof byteLen === 'bigint')
            byteLen = Number(byteLen);
        if (byteLen === undefined || byteLen !== value)
            throw this.err(`Wrong length: ${byteLen} len=${len} exp=${value}`);
    }
    bits(value, bits) {
        if (bits > 32)
            throw this.err('writeBits: cannot write more than 32 bits in single call');
        if (value >= 2 ** bits)
            throw this.err(`writeBits: value (${value}) >= 2**bits (${bits})`);
        while (bits) {
            const take = Math.min(bits, 8 - this.bitPos);
            this.bitBuf = (this.bitBuf << take) | (value >> (bits - take));
            this.bitPos += take;
            bits -= take;
            value &= 2 ** bits - 1;
            if (this.bitPos === 8) {
                this.bitPos = 0;
                this.buffers.push(new Uint8Array([this.bitBuf]));
                this.pos++;
            }
        }
    }
    fieldPathPush(s) {
        this.fieldPath.push(s);
    }
    fieldPathPop() {
        this.fieldPath.pop();
    }
}
exports.Writer = Writer;
const swap = (b) => Uint8Array.from(b).reverse();
function checkBounds(p, value, bits, signed) {
    if (signed) {
        const signBit = 2n ** (bits - 1n);
        if (value < -signBit || value >= signBit)
            throw p.err('sInt: value out of bounds');
    }
    else {
        if (0n > value || value >= 2n ** bits)
            throw p.err('uInt: value out of bounds');
    }
}
exports.checkBounds = checkBounds;
function wrap(inner) {
    return {
        ...inner,
        encode: (value) => {
            const w = new Writer();
            inner.encodeStream(w, value);
            return w.buffer;
        },
        decode: (data) => {
            const r = new Reader(data);
            const res = inner.decodeStream(r);
            r.finish();
            return res;
        },
    };
}
exports.wrap = wrap;
function getPath(objPath, path) {
    objPath = Array.from(objPath);
    let i = 0;
    for (; i < path.length; i++) {
        if (path[i] === '..')
            objPath.pop();
        else
            break;
    }
    let cur = objPath.pop();
    for (; i < path.length; i++) {
        if (!cur || cur[path[i]] === undefined)
            return undefined;
        cur = cur[path[i]];
    }
    return cur;
}
function isCoder(elm) {
    return (typeof elm.encode === 'function' &&
        typeof elm.encodeStream === 'function' &&
        typeof elm.decode === 'function' &&
        typeof elm.decodeStream === 'function');
}
exports.isCoder = isCoder;
function dict() {
    return {
        encode: (from) => {
            const to = {};
            for (const [name, value] of from) {
                if (to[name] !== undefined)
                    throw new Error(`coders.dict: same key(${name}) appears twice in struct`);
                to[name] = value;
            }
            return to;
        },
        decode: (to) => Object.entries(to),
    };
}
const number = {
    encode: (from) => {
        if (from > BigInt(Number.MAX_SAFE_INTEGER))
            throw new Error(`coders.number: element bigger than MAX_SAFE_INTEGER=${from}`);
        return Number(from);
    },
    decode: (to) => BigInt(to),
};
function tsEnum(e) {
    return {
        encode: (from) => e[from],
        decode: (to) => e[to],
    };
}
function decimal(precision) {
    const decimalMask = 10n ** BigInt(precision);
    return {
        encode: (from) => {
            let s = (from < 0n ? -from : from).toString(10);
            let sep = s.length - precision;
            if (sep < 0) {
                s = s.padStart(s.length - sep, '0');
                sep = 0;
            }
            let i = s.length - 1;
            for (; i >= sep && s[i] === '0'; i--)
                ;
            let [int, frac] = [s.slice(0, sep), s.slice(sep, i + 1)];
            if (!int)
                int = '0';
            if (from < 0n)
                int = '-' + int;
            if (!frac)
                return int;
            return `${int}.${frac}`;
        },
        decode: (to) => {
            let neg = false;
            if (to.startsWith('-')) {
                neg = true;
                to = to.slice(1);
            }
            let sep = to.indexOf('.');
            sep = sep === -1 ? to.length : sep;
            const [intS, fracS] = [to.slice(0, sep), to.slice(sep + 1)];
            const int = BigInt(intS) * decimalMask;
            const fracLen = Math.min(fracS.length, precision);
            const frac = BigInt(fracS.slice(0, fracLen)) * 10n ** BigInt(precision - fracLen);
            const value = int + frac;
            return neg ? -value : value;
        },
    };
}
function match(lst) {
    return {
        encode: (from) => {
            for (const c of lst) {
                const elm = c.encode(from);
                if (elm !== undefined)
                    return elm;
            }
            throw new Error(`match/encode: cannot find match in ${from}`);
        },
        decode: (to) => {
            for (const c of lst) {
                const elm = c.decode(to);
                if (elm !== undefined)
                    return elm;
            }
            throw new Error(`match/decode: cannot find match in ${to}`);
        },
    };
}
exports.coders = { dict, number, tsEnum, decimal, match };
const bits = (len) => wrap({
    encodeStream: (w, value) => w.bits(value, len),
    decodeStream: (r) => r.bits(len),
});
exports.bits = bits;
const bigint = (size, le = false, signed = false) => wrap({
    size,
    encodeStream: (w, value) => {
        if (typeof value !== 'number' && typeof value !== 'bigint')
            throw w.err(`bigint: invalid value: ${value}`);
        let _value = BigInt(value);
        const bLen = BigInt(size);
        checkBounds(w, _value, 8n * bLen, !!signed);
        const signBit = 2n ** (8n * bLen - 1n);
        if (signed && _value < 0)
            _value = _value | signBit;
        let b = [];
        for (let i = 0; i < size; i++) {
            b.push(Number(_value & 255n));
            _value >>= 8n;
        }
        let res = new Uint8Array(b).reverse();
        w.bytes(le ? res.reverse() : res);
    },
    decodeStream: (r) => {
        const bLen = BigInt(size);
        let value = r.bytes(size);
        if (le)
            value = swap(value);
        const b = swap(value);
        const signBit = 2n ** (8n * bLen - 1n);
        let res = 0n;
        for (let i = 0; i < b.length; i++)
            res |= BigInt(b[i]) << (8n * BigInt(i));
        if (signed && res & signBit)
            res = (res ^ signBit) - signBit;
        checkBounds(r, res, 8n * bLen, !!signed);
        return res;
    },
});
exports.bigint = bigint;
exports.U256LE = (0, exports.bigint)(32, true);
exports.U256BE = (0, exports.bigint)(32, false);
exports.I256LE = (0, exports.bigint)(32, true, true);
exports.I256BE = (0, exports.bigint)(32, false, true);
exports.U128LE = (0, exports.bigint)(16, true);
exports.U128BE = (0, exports.bigint)(16, false);
exports.I128LE = (0, exports.bigint)(16, true, true);
exports.I128BE = (0, exports.bigint)(16, false, true);
exports.U64LE = (0, exports.bigint)(8, true);
exports.U64BE = (0, exports.bigint)(8, false);
exports.I64LE = (0, exports.bigint)(8, true, true);
exports.I64BE = (0, exports.bigint)(8, false, true);
const int = (size, le = false, signed = false) => {
    if (size > 6)
        throw new Error('int supports size up to 6 bytes (48 bits), for other use bigint');
    return apply((0, exports.bigint)(size, le, signed), exports.coders.number);
};
exports.int = int;
exports.U32LE = (0, exports.int)(4, true);
exports.U32BE = (0, exports.int)(4, false);
exports.I32LE = (0, exports.int)(4, true, true);
exports.I32BE = (0, exports.int)(4, false, true);
exports.U16LE = (0, exports.int)(2, true);
exports.U16BE = (0, exports.int)(2, false);
exports.I16LE = (0, exports.int)(2, true, true);
exports.I16BE = (0, exports.int)(2, false, true);
exports.U8 = (0, exports.int)(1, false);
exports.I8 = (0, exports.int)(1, false, true);
exports.bool = wrap({
    size: 1,
    encodeStream: (w, value) => w.byte(value ? 1 : 0),
    decodeStream: (r) => {
        const value = r.byte();
        if (value !== 0 && value !== 1)
            throw r.err(`bool: invalid value ${value}`);
        return value === 1;
    },
});
const bytes = (len, le = false) => wrap({
    size: typeof len === 'number' ? len : undefined,
    encodeStream: (w, value) => {
        if (!(0, exports.isBytes)(value))
            throw w.err(`bytes: invalid value ${value}`);
        if (!(0, exports.isBytes)(len))
            w.length(len, value.length);
        w.bytes(le ? swap(value) : value);
        if ((0, exports.isBytes)(len))
            w.bytes(len);
    },
    decodeStream: (r) => {
        let bytes;
        if ((0, exports.isBytes)(len)) {
            const tPos = r.find(len);
            if (!tPos)
                throw r.err(`bytes: cannot find terminator`);
            bytes = r.bytes(tPos - r.pos);
            r.bytes(len.length);
        }
        else
            bytes = r.bytes(len === null ? r.leftBytes : r.length(len));
        return le ? swap(bytes) : bytes;
    },
});
exports.bytes = bytes;
const string = (len, le = false) => {
    const inner = (0, exports.bytes)(len, le);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => inner.encodeStream(w, base.utf8.decode(value)),
        decodeStream: (r) => base.utf8.encode(inner.decodeStream(r)),
    });
};
exports.string = string;
exports.cstring = (0, exports.string)(exports.NULL);
const hex = (len, le = false, withZero = false) => {
    const inner = (0, exports.bytes)(len, le);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => {
            if (withZero && !value.startsWith('0x'))
                throw new Error('hex(withZero=true).encode input should start with 0x');
            const bytes = base.hex.decode(withZero ? value.slice(2) : value);
            return inner.encodeStream(w, bytes);
        },
        decodeStream: (r) => (withZero ? '0x' : '') + base.hex.encode(inner.decodeStream(r)),
    });
};
exports.hex = hex;
function apply(inner, b) {
    if (!isCoder(inner))
        throw new Error(`apply: invalid inner value ${inner}`);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => {
            let innerValue;
            try {
                innerValue = b.decode(value);
            }
            catch (e) {
                throw w.err('' + e);
            }
            return inner.encodeStream(w, innerValue);
        },
        decodeStream: (r) => {
            const innerValue = inner.decodeStream(r);
            try {
                return b.encode(innerValue);
            }
            catch (e) {
                throw r.err('' + e);
            }
        },
    });
}
exports.apply = apply;
function validate(inner, fn) {
    if (!isCoder(inner))
        throw new Error(`validate: invalid inner value ${inner}`);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => inner.encodeStream(w, fn(value)),
        decodeStream: (r) => fn(inner.decodeStream(r)),
    });
}
exports.validate = validate;
function lazy(fn) {
    return wrap({
        encodeStream: (w, value) => fn().encodeStream(w, value),
        decodeStream: (r) => fn().decodeStream(r),
    });
}
exports.lazy = lazy;
const bytesFormatted = (len, fmt, le = false) => {
    const inner = (0, exports.bytes)(len, le);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => inner.encodeStream(w, base.bytes(fmt, value)),
        decodeStream: (r) => base.str(fmt, inner.decodeStream(r)),
    });
};
exports.bytesFormatted = bytesFormatted;
const flag = (flagValue, xor = false) => wrap({
    size: flagValue.length,
    encodeStream: (w, value) => {
        if (!!value !== xor)
            w.bytes(flagValue);
    },
    decodeStream: (r) => {
        let hasFlag = r.leftBytes >= flagValue.length;
        if (hasFlag) {
            hasFlag = equalBytes(r.bytes(flagValue.length, true), flagValue);
            if (hasFlag)
                r.bytes(flagValue.length);
        }
        return hasFlag !== xor;
    },
});
exports.flag = flag;
function flagged(path, inner, def) {
    if (!isCoder(inner))
        throw new Error(`flagged: invalid inner value ${inner}`);
    return wrap({
        encodeStream: (w, value) => {
            if (typeof path === 'string') {
                if (getPath(w.path, path.split('/')))
                    inner.encodeStream(w, value);
                else if (def)
                    inner.encodeStream(w, def);
            }
            else {
                path.encodeStream(w, !!value);
                if (!!value)
                    inner.encodeStream(w, value);
                else if (def)
                    inner.encodeStream(w, def);
            }
        },
        decodeStream: (r) => {
            let hasFlag = false;
            if (typeof path === 'string')
                hasFlag = getPath(r.path, path.split('/'));
            else
                hasFlag = path.decodeStream(r);
            if (hasFlag)
                return inner.decodeStream(r);
            else if (def)
                inner.decodeStream(r);
        },
    });
}
exports.flagged = flagged;
function optional(flag, inner, def) {
    if (!isCoder(flag) || !isCoder(inner))
        throw new Error(`optional: invalid flag or inner value flag=${flag} inner=${inner}`);
    return wrap({
        size: def !== undefined && flag.size && inner.size ? flag.size + inner.size : undefined,
        encodeStream: (w, value) => {
            flag.encodeStream(w, !!value);
            if (value)
                inner.encodeStream(w, value);
            else if (def !== undefined)
                inner.encodeStream(w, def);
        },
        decodeStream: (r) => {
            if (flag.decodeStream(r))
                return inner.decodeStream(r);
            else if (def !== undefined)
                inner.decodeStream(r);
        },
    });
}
exports.optional = optional;
function magic(inner, constant, check = true) {
    if (!isCoder(inner))
        throw new Error(`flagged: invalid inner value ${inner}`);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => inner.encodeStream(w, constant),
        decodeStream: (r) => {
            const value = inner.decodeStream(r);
            if ((check && typeof value !== 'object' && value !== constant) ||
                ((0, exports.isBytes)(constant) && !equalBytes(constant, value))) {
                throw r.err(`magic: invalid value: ${value} !== ${constant}`);
            }
            return;
        },
    });
}
exports.magic = magic;
const magicBytes = (constant) => {
    const c = typeof constant === 'string' ? base.utf8.decode(constant) : constant;
    return magic((0, exports.bytes)(c.length), c);
};
exports.magicBytes = magicBytes;
function constant(c) {
    return wrap({
        encodeStream: (w, value) => {
            if (value !== c)
                throw new Error(`constant: invalid value ${value} (exp: ${c})`);
        },
        decodeStream: (r) => c,
    });
}
exports.constant = constant;
function sizeof(fields) {
    let size = 0;
    for (let f of fields) {
        if (!f.size)
            return;
        size += f.size;
    }
    return size;
}
function struct(fields) {
    if (Array.isArray(fields))
        throw new Error('Packed.Struct: got array instead of object');
    return wrap({
        size: sizeof(Object.values(fields)),
        encodeStream: (w, value) => {
            if (typeof value !== 'object' || value === null)
                throw w.err(`struct: invalid value ${value}`);
            w.path.push(value);
            for (let name in fields) {
                w.fieldPathPush(name);
                let field = fields[name];
                field.encodeStream(w, value[name]);
                w.fieldPathPop();
            }
            w.path.pop();
        },
        decodeStream: (r) => {
            let res = {};
            r.path.push(res);
            for (let name in fields) {
                r.fieldPathPush(name);
                res[name] = fields[name].decodeStream(r);
                r.fieldPathPop();
            }
            r.path.pop();
            return res;
        },
    });
}
exports.struct = struct;
function tuple(fields) {
    if (!Array.isArray(fields))
        throw new Error(`Packed.Tuple: got ${typeof fields} instead of array`);
    return wrap({
        size: sizeof(fields),
        encodeStream: (w, value) => {
            if (!Array.isArray(value))
                throw w.err(`tuple: invalid value ${value}`);
            w.path.push(value);
            for (let i = 0; i < fields.length; i++) {
                w.fieldPathPush('' + i);
                fields[i].encodeStream(w, value[i]);
                w.fieldPathPop();
            }
            w.path.pop();
        },
        decodeStream: (r) => {
            let res = [];
            r.path.push(res);
            for (let i = 0; i < fields.length; i++) {
                r.fieldPathPush('' + i);
                res.push(fields[i].decodeStream(r));
                r.fieldPathPop();
            }
            r.path.pop();
            return res;
        },
    });
}
exports.tuple = tuple;
function prefix(len, inner) {
    if (!isCoder(inner))
        throw new Error(`prefix: invalid inner value ${inner}`);
    if ((0, exports.isBytes)(len))
        throw new Error(`prefix: len cannot be Uint8Array`);
    const b = (0, exports.bytes)(len);
    return wrap({
        size: typeof len === 'number' ? len : undefined,
        encodeStream: (w, value) => {
            const wChild = new Writer(w.path, w.fieldPath);
            inner.encodeStream(wChild, value);
            b.encodeStream(w, wChild.buffer);
        },
        decodeStream: (r) => {
            const data = b.decodeStream(r);
            return inner.decodeStream(new Reader(data, r.path, r.fieldPath));
        },
    });
}
exports.prefix = prefix;
function array(len, inner) {
    if (!isCoder(inner))
        throw new Error(`array: invalid inner value ${inner}`);
    return wrap({
        size: typeof len === 'number' && inner.size ? len * inner.size : undefined,
        encodeStream: (w, value) => {
            if (!Array.isArray(value))
                throw w.err(`array: invalid value ${value}`);
            if (!(0, exports.isBytes)(len))
                w.length(len, value.length);
            w.path.push(value);
            for (let i = 0; i < value.length; i++) {
                w.fieldPathPush('' + i);
                const elm = value[i];
                const startPos = w.pos;
                inner.encodeStream(w, elm);
                if ((0, exports.isBytes)(len)) {
                    if (len.length > w.pos - startPos)
                        continue;
                    const data = w.buffer.subarray(startPos, w.pos);
                    if (equalBytes(data.subarray(0, len.length), len))
                        throw w.err(`array: inner element encoding same as separator. elm=${elm} data=${data}`);
                }
                w.fieldPathPop();
            }
            w.path.pop();
            if ((0, exports.isBytes)(len))
                w.bytes(len);
        },
        decodeStream: (r) => {
            let res = [];
            if (len === null) {
                let i = 0;
                r.path.push(res);
                while (!r.isEnd()) {
                    r.fieldPathPush('' + i++);
                    res.push(inner.decodeStream(r));
                    r.fieldPathPop();
                    if (inner.size && r.leftBytes < inner.size)
                        break;
                }
                r.path.pop();
            }
            else if ((0, exports.isBytes)(len)) {
                let i = 0;
                r.path.push(res);
                while (true) {
                    if (equalBytes(r.bytes(len.length, true), len)) {
                        r.bytes(len.length);
                        break;
                    }
                    r.fieldPathPush('' + i++);
                    res.push(inner.decodeStream(r));
                    r.fieldPathPop();
                }
                r.path.pop();
            }
            else {
                r.fieldPathPush('arrayLen');
                const length = r.length(len);
                r.fieldPathPop();
                r.path.push(res);
                for (let i = 0; i < length; i++) {
                    r.fieldPathPush('' + i);
                    res.push(inner.decodeStream(r));
                    r.fieldPathPop();
                }
                r.path.pop();
            }
            return res;
        },
    });
}
exports.array = array;
function map(inner, variants) {
    if (!isCoder(inner))
        throw new Error(`map: invalid inner value ${inner}`);
    const variantNames = new Map();
    for (const k in variants)
        variantNames.set(variants[k], k);
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => {
            if (typeof value !== 'string')
                throw w.err(`map: invalid value ${value}`);
            if (!(value in variants))
                throw w.err(`Map: unknown variant: ${value}`);
            inner.encodeStream(w, variants[value]);
        },
        decodeStream: (r) => {
            const variant = inner.decodeStream(r);
            const name = variantNames.get(variant);
            if (name === undefined)
                throw r.err(`Enum: unknown value: ${variant} ${Array.from(variantNames.keys())}`);
            return name;
        },
    });
}
exports.map = map;
function tag(tag, variants) {
    if (!isCoder(tag))
        throw new Error(`tag: invalid tag value ${tag}`);
    return wrap({
        size: tag.size,
        encodeStream: (w, value) => {
            const { TAG, data } = value;
            const dataType = variants[TAG];
            if (!dataType)
                throw w.err(`Tag: invalid tag ${TAG.toString()}`);
            tag.encodeStream(w, TAG);
            dataType.encodeStream(w, data);
        },
        decodeStream: (r) => {
            const TAG = tag.decodeStream(r);
            const dataType = variants[TAG];
            if (!dataType)
                throw r.err(`Tag: invalid tag ${TAG}`);
            return { TAG, data: dataType.decodeStream(r) };
        },
    });
}
exports.tag = tag;
function mappedTag(tagCoder, variants) {
    if (!isCoder(tagCoder))
        throw new Error(`mappedTag: invalid tag value ${tag}`);
    const mapValue = {};
    const tagValue = {};
    for (const key in variants) {
        mapValue[key] = variants[key][0];
        tagValue[key] = variants[key][1];
    }
    return tag(map(tagCoder, mapValue), tagValue);
}
exports.mappedTag = mappedTag;
function bitset(names, pad = false) {
    return wrap({
        encodeStream: (w, value) => {
            if (typeof value !== 'object' || value === null)
                throw w.err(`bitset: invalid value ${value}`);
            for (let i = 0; i < names.length; i++)
                w.bits(+value[names[i]], 1);
            if (pad && names.length % 8)
                w.bits(0, 8 - (names.length % 8));
        },
        decodeStream: (r) => {
            let out = {};
            for (let i = 0; i < names.length; i++)
                out[names[i]] = !!r.bits(1);
            if (pad && names.length % 8)
                r.bits(8 - (names.length % 8));
            return out;
        },
    });
}
exports.bitset = bitset;
const ZeroPad = (_) => 0;
exports.ZeroPad = ZeroPad;
function padLength(blockSize, len) {
    if (len % blockSize === 0)
        return 0;
    return blockSize - (len % blockSize);
}
function padLeft(blockSize, inner, padFn) {
    if (!isCoder(inner))
        throw new Error(`padLeft: invalid inner value ${inner}`);
    const _padFn = padFn || exports.ZeroPad;
    if (!inner.size)
        throw new Error('padLeft with dynamic size argument is impossible');
    return wrap({
        size: inner.size + padLength(blockSize, inner.size),
        encodeStream: (w, value) => {
            const padBytes = padLength(blockSize, inner.size);
            for (let i = 0; i < padBytes; i++)
                w.byte(_padFn(i));
            inner.encodeStream(w, value);
        },
        decodeStream: (r) => {
            r.bytes(padLength(blockSize, inner.size));
            return inner.decodeStream(r);
        },
    });
}
exports.padLeft = padLeft;
function padRight(blockSize, inner, padFn) {
    if (!isCoder(inner))
        throw new Error(`padRight: invalid inner value ${inner}`);
    const _padFn = padFn || exports.ZeroPad;
    return wrap({
        size: inner.size ? inner.size + padLength(blockSize, inner.size) : undefined,
        encodeStream: (w, value) => {
            const pos = w.pos;
            inner.encodeStream(w, value);
            const padBytes = padLength(blockSize, w.pos - pos);
            for (let i = 0; i < padBytes; i++)
                w.byte(_padFn(i));
        },
        decodeStream: (r) => {
            const start = r.pos;
            const res = inner.decodeStream(r);
            r.bytes(padLength(blockSize, r.pos - start));
            return res;
        },
    });
}
exports.padRight = padRight;
function pointer(ptr, inner, sized = false) {
    if (!isCoder(ptr))
        throw new Error(`pointer: invalid ptr value ${ptr}`);
    if (!isCoder(inner))
        throw new Error(`pointer: invalid inner value ${inner}`);
    if (!ptr.size)
        throw new Error('Pointer: unsized ptr');
    return wrap({
        size: sized ? ptr.size : undefined,
        encodeStream: (w, value) => {
            const start = w.pos;
            ptr.encodeStream(w, 0);
            w.ptrs.push({ pos: start, ptr, buffer: inner.encode(value) });
        },
        decodeStream: (r) => {
            const ptrVal = ptr.decodeStream(r);
            if (ptrVal < r.pos)
                throw new Error('pointer.decodeStream pointer less than position');
            r.hasPtr = true;
            const rChild = new Reader(r.absBytes(ptrVal), r.path, r.fieldPath);
            return inner.decodeStream(rChild);
        },
    });
}
exports.pointer = pointer;
function base64armor(name, lineLen, inner, checksum) {
    const markBegin = `-----BEGIN ${name.toUpperCase()}-----`;
    const markEnd = `-----END ${name.toUpperCase()}-----`;
    return {
        encode(value) {
            const data = inner.encode(value);
            const encoded = base.base64.encode(data);
            let lines = [];
            for (let i = 0; i < encoded.length; i += lineLen) {
                const s = encoded.slice(i, i + lineLen);
                if (s.length)
                    lines.push(`${encoded.slice(i, i + lineLen)}\n`);
            }
            let body = lines.join('');
            if (checksum)
                body += `=${base.base64.encode(checksum(data))}\n`;
            return `${markBegin}\n\n${body}${markEnd}\n`;
        },
        decode(s) {
            let lines = s.replace(markBegin, '').replace(markEnd, '').trim().split('\n');
            lines = lines.map((l) => l.replace('\r', '').trim());
            if (checksum && lines[lines.length - 1].startsWith('=')) {
                const body = base.base64.decode(lines.slice(0, -1).join(''));
                const cs = lines[lines.length - 1].slice(1);
                const realCS = base.base64.encode(checksum(body));
                if (realCS !== cs)
                    throw new Error(`Base64Armor: invalid checksum ${cs} instead of ${realCS}`);
                return inner.decode(body);
            }
            return inner.decode(base.base64.decode(lines.join('')));
        },
    };
}
exports.base64armor = base64armor;
exports.nothing = magic((0, exports.bytes)(0), exports.EMPTY);
function debug(inner) {
    if (!isCoder(inner))
        throw new Error(`debug: invalid inner value ${inner}`);
    const log = (name, rw, value) => {
        console.log(`DEBUG/${name}(${rw.fieldPath.join('/')}):`, { type: typeof value, value });
        return value;
    };
    return wrap({
        size: inner.size,
        encodeStream: (w, value) => inner.encodeStream(w, log('encode', w, value)),
        decodeStream: (r) => log('decode', r, inner.decodeStream(r)),
    });
}
exports.debug = debug;
