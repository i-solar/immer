export {setAutoFreeze, setUseProxies} from "./common.js"

import {isProxyable, getUseProxies} from "./common.js"
import {produceProxy} from "./proxy.js"
import {produceEs5} from "./es5.js"

/**
 * produce takes a state, and runs a function against it.
 * That function can freely mutate the state, as it will create copies-on-write.
 * This means that the original state will stay unchanged, and once the function finishes, the modified state is returned
 *
 * @export
 * @param {any} baseState - the state to start with
 * @param {Function} producer - function that receives a proxy of the base state as first argument and which can be freely modified
 * @returns {any} a new state, or the base state if nothing was modified
 */
export default function produce(baseState, producer) {
    // prettier-ignore
    // 参数检查 - 只能是一个或两个参数
    if (arguments.length !== 1 && arguments.length !== 2) throw new Error("produce expects 1 or 2 arguments, got " + arguments.length)

    // curried invocation
    // 柯里化
    // 第一个参数是函数
    if (typeof baseState === "function") {
        // prettier-ignore
        // 参数检查 - 第二个参数不能是函数
        if (typeof producer === "function") throw new Error("if first argument is a function (curried invocation), the second argument to produce cannot be a function")

        // 暂时存储第二个参数，以便后面可能当初始状态用
        const initialState = producer
        const recipe = baseState

        return function() {
            const args = arguments

            const currentState =
                // 没传参数时且 initialState 有值时用 initialState 作为初始状态
                args[0] === undefined && initialState !== undefined
                    ? initialState
                    : args[0]

            // 递归
            return produce(currentState, draft => {
                args[0] = draft // blegh!
                return recipe.apply(draft, args)
            })
        }
    }

    // prettier-ignore
    // 参数检查
    // 第二个参数必须是函数
    {
        if (typeof producer !== "function") throw new Error("if first argument is not a function, the second argument to produce should be a function")
    }

    // if state is a primitive, don't bother proxying at all and just return whatever the producer returns on that value
    // 第一个参数非对象时，直接调用 producer
    if (typeof baseState !== "object" || baseState === null)
        return producer(baseState)
    // 第一个参数必须是数组 或者 没有原型或原型为 Object.prototype 的对象
    if (!isProxyable(baseState))
        throw new Error(
            `the first argument to an immer producer should be a primitive, plain object or array, got ${typeof baseState}: "${baseState}"`
        )

    // ---------------------------------------
    //            end  参数检查完毕
    // ---------------------------------------

    // 正文开始
    return getUseProxies()
        // 支持 Proxy 的浏览器走这里
        ? produceProxy(baseState, producer)
        // 不支持 Proxy 的浏览器走这里
        : produceEs5(baseState, producer)
}
