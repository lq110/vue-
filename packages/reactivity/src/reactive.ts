import { isObject } from "@vue/shared"
import { track, trigger } from "./effect";


const enum ReactiveFlags {
    IS_REACTIVE = '__v_isReactive'
}
const mutableHandlers: ProxyHandler<Record<any, any>> = {
    get(target, key, recevier) { // 代理对象的本身
        if (key === ReactiveFlags.IS_REACTIVE) {
            return true;
        }
        track(target,key);
        // 这里取值了， 可以收集他在哪个effect中
        const res = Reflect.get(target, key, recevier); // target[key]
        return res;
    },
    set(target, key, value, recevier) {

        let oldValue = (target as any)[key]
        // 如果改变值了， 可以在这里触发effect更新
        const res = Reflect.set(target, key, value, recevier); // target[key] = value

        if(oldValue !== value){ // 值不发生变化 effect不需要重新执行
            trigger(target,key); // 找属性对应的effect让她重新执行
        }
        return res;
    }
}
// map和weakMap的区别
const reactiveMap = new WeakMap(); // weakmap 弱引用   key必须是对象，如果key没有被引用可以被自动销毁

function createReactiveObject(target: object) { 
    // 先默认认为这个target已经是代理过的属性了
    if ((target as any)[ReactiveFlags.IS_REACTIVE]) {
        return target
    }
    // reactiveApi 只针对对象才可以 
    if (!isObject(target)) {
        return target
    }
    const exisitingProxy = reactiveMap.get(target); // 如果缓存中有 直接使用上次代理的结果
    if (exisitingProxy) {
        return exisitingProxy
    }
    const proxy = new Proxy(target, mutableHandlers); // 当用户获取属性 或者更改属性的时候 我能劫持到
    reactiveMap.set(target, proxy); // 将原对象和生成的代理对象 做一个映射表

    return proxy; // 返回代理
}

export function reactive(target: object) {
    return createReactiveObject(target)
}
export function toReactive(value){
    return isObject(value) ? reactive(value) : value
}

// readonly shallowReactive shallowReadnly 
// export function readonly(){
// }
// export function shallowReactive(){
// }
// export function shallowReadnly(){
// }
