"use strict"
// @ts-check

import {
    is,
    has,
    isProxyable,
    isProxy,
    PROXY_STATE,
    finalize,
    shallowCopy,
    RETURNED_AND_MODIFIED_ERROR,
    each
} from "./common.mjs"

let proxies = null

// 对象的内置方法拦截
const objectTraps = {
    // 看函数的定义
    get,
    has(target, prop) {
        // 看属性有没有在修改后的副本中，未修改则是 baseState
        return prop in source(target)
    },
    // 调用副本的 ownKeys
    ownKeys(target) {
        return Reflect.ownKeys(source(target))
    },
    // 看函数的定义
    set,
    deleteProperty,
    getOwnPropertyDescriptor,
    defineProperty,
    // 不支持设置原型，纯函数
    setPrototypeOf() {
        throw new Error("Immer does not support `setPrototypeOf()`.")
    }
}

// 数组的内置方法拦截
const arrayTraps = {}
each(objectTraps, (key, fn) => {
    arrayTraps[key] = function() {
        // 传进来第一个东西是个数组？
        arguments[0] = arguments[0][0]
        return fn.apply(this, arguments)
    }
})

/**
 * 创建一个 state
 * @param parent 
 * @param base 
 */
function createState(parent, base) {
    return {
        modified: false,
        finalized: false,
        parent,
        base,
        copy: undefined,
        proxies: {}
    }
}

// 更改之后返回副本
function source(state) {
    return state.modified === true ? state.copy : state.base
}

function get(state, prop) {
    if (prop === PROXY_STATE) return state
    if (state.modified) {
        const value = state.copy[prop]
        if (value === state.base[prop] && isProxyable(value))
            // only create proxy if it is not yet a proxy, and not a new object
            // (new objects don't need proxying, they will be processed in finalize anyway)
            return (state.copy[prop] = createProxy(state, value))
        return value
    } else {
        if (has(state.proxies, prop)) return state.proxies[prop]
        const value = state.base[prop]
        if (!isProxy(value) && isProxyable(value))
            return (state.proxies[prop] = createProxy(state, value))
        return value
    }
}

function set(state, prop, value) {
    if (!state.modified) {
        if (
            (prop in state.base && is(state.base[prop], value)) ||
            (has(state.proxies, prop) && state.proxies[prop] === value)
        )
            return true
        markChanged(state)
    }
    state.copy[prop] = value
    return true
}

function deleteProperty(state, prop) {
    markChanged(state)
    delete state.copy[prop]
    return true
}

function getOwnPropertyDescriptor(state, prop) {
    const owner = state.modified
        ? state.copy
        : has(state.proxies, prop) ? state.proxies : state.base
    const descriptor = Reflect.getOwnPropertyDescriptor(owner, prop)
    if (descriptor && !(Array.isArray(owner) && prop === "length"))
        descriptor.configurable = true
    return descriptor
}

function defineProperty() {
    throw new Error(
        "Immer does not support defining properties on draft objects."
    )
}

function markChanged(state) {
    if (!state.modified) {
        state.modified = true
        state.copy = shallowCopy(state.base)
        // copy the proxies over the base-copy
        Object.assign(state.copy, state.proxies) // yup that works for arrays as well
        if (state.parent) markChanged(state.parent)
    }
}

// creates a proxy for plain objects / arrays
function createProxy(parentState, base) {
    // 理论上走到这里 base 不是被代理过的，不过如果被代理了，就是 bug
    if (isProxy(base)) throw new Error("Immer bug. Plz report.")

    // 创建原始 state
    const state = createState(parentState, base)
    // 给 state 添加代理
    const proxy = Array.isArray(base)
        ? Proxy.revocable([state], arrayTraps)
        : Proxy.revocable(state, objectTraps)
    // 
    proxies.push(proxy)
    // 返回代理
    return proxy.proxy
}

// 正文，主要逻辑
export function produceProxy(baseState, producer) {
    // 是否被代理过
    if (isProxy(baseState)) {
        // See #100, don't nest producers
        // 直接执行 producer
        const returnValue = producer.call(baseState, baseState)
        // 无任何更改就直接返回 baseState
        return returnValue === undefined ? baseState : returnValue
    }

    // 正文
    const previousProxies = proxies
    proxies = []
    try {
        // create proxy for root
        // 创建代理
        const rootProxy = createProxy(undefined, baseState)
        // execute the thunk
        // 执行 producer，this 和 参数都是代理
        const returnValue = producer.call(rootProxy, rootProxy)
        // and finalize the modified proxy
        let result
        // check whether the draft was modified and/or a value was returned
        if (returnValue !== undefined && returnValue !== rootProxy) {
            // something was returned, and it wasn't the proxy itself
            if (rootProxy[PROXY_STATE].modified)
                throw new Error(RETURNED_AND_MODIFIED_ERROR)

            // See #117
            // Should we just throw when returning a proxy which is not the root, but a subset of the original state?
            // Looks like a wrongly modeled reducer
            result = finalize(returnValue)
        } else {
            result = finalize(rootProxy)
        }
        // revoke all proxies
        each(proxies, (_, p) => p.revoke())
        return result
    } finally {
        proxies = previousProxies
    }
}
