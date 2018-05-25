/**
 * @file 测试 immer.js 的用法，加深印象
 * @author i-solar
 */
import produce from '../../src/immer.mjs'

// 非柯里化使用时 - produce 的 state 是对象时必须是数组，原型为 Object.prototype、或者没原型的对象
function isPureObject () {
    const origin = { name: 'apple' }
    const state = Object.create(origin)

    return produce(state, () => {})
}

isPureObject()