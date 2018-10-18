let target = {}
// 第二个参数是 “句柄对象”，可以覆写代理对象的所有内部方法
let obj = new Proxy(target, {
    // 重载代理的属性访问方法
    get(target, key, receiver) {
        console.log(`getting ${key}`)
        return Reflect.get(target, key, receiver)
    },
    // 重载代理的属性赋值方法
    set(target, key, value, receiver) {
        console.log(`setting ${key}`)
        return Reflect.set(target, key, value, receiver)
    }
    // .... 总共 14 种重载方法，与对象的 14 种内建方法一致
})

// node 下打印不出来，chrome 下打印出来是个 proxy 对象
// console.log(obj)

// 代理的行为很简单：将代理的所有内部方法转发至目标，简单来说，如果调用 proxy.[[Enumerate]]()，就会返回 target.[[Enumerate]]()
console.log(obj.name) // getting name \n undefined
// 代理和对象是两个不同的对象
console.log(obj === target) // false

/**
 * -------------------------
 *      Q1: 假设 tree = {} 如何实现 tree.people.name = 'liuyang' 成功执行？
 * -------------------------
 */
let target = {}
let tree = new Proxy(target, {
    get(target, key, receiver) {
        // Reflect 包含对象的 14 种内建方法
        if (key in target) {
            target[key] = new Proxy({}, handler)
        }
    },
    set(target, key, value, receiver) {
        return Reflect.set(target, key, value, receiver)
    }
})

/**
 *
 */
function readOnlyView(object) {
    return new Proxy(object, handler)
}

handler = {
    set(target, key, value, receiver) {
        if (key in target) {
            throw new Error()
        }
        return Reflect.set(target, key, value, receiver)
    },
    deleteProperty() {}
}

let newMath = readOnlyView(math)

function getThis() {
    return this
}
let target = {getName}
// 第二个参数必须有，且是对象
let proxy = new Proxy(target, {})
proxy.getThis() // Proxy { ... }
