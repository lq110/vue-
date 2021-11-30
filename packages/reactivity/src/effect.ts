// effect1(()=>{
//     state.name
//     effect2(()=>{
//         state.age;
//     })
//     state.address
// })

// // effectStack = [effect1] activeEffect = effect1
// // effect1 -> name
// // effect2 -> age
// // effect1 -> address


let effectStack = []; // 目的就是为了能保证我们effect执行的时候 可以存储正确的关系
let activeEffect;

function cleanupEffect(effect) {
    const { deps } = effect;
    for (let dep of deps) {
        // set 删除effect 让属性 删除掉对应的effect   name = []
        dep.delete(effect); // 让属性对应的effect移除掉，这样属性更新的时候 就不会触发这个effect重新执行了
    }
}
// 属性变化 触发的是 dep -> effect
// effect.deps = [] 和属性是没关系的
export class ReactiveEffect {
    active = true; // this.active = true;
    deps = []; // 让effect 记录他依赖了哪些属性 ， 同时要记录当前属性依赖了哪个effect
    constructor(public fn, public scheduler?) { // this.fn = fn;

    }
    run() { // 调用run的时候会让fn执行
        if (!this.active) { // 稍后如果非激活状态 调用run方法 默认会执行fn函数
            return this.fn();
        }
        if (!effectStack.includes(this)) { // 屏蔽同一个effect会多次执行
            try {
                effectStack.push(activeEffect = this);
                return this.fn(); // 取值  new Proxy 会执行get方法  (依赖收集)
            } finally {
                effectStack.pop(); // 删除最后一个
                activeEffect = effectStack[effectStack.length - 1]
            }
        }
    }
    stop() { // 让effect 和 dep 取消关联 dep上面存储的effect移除掉即可
        if (this.active) {
            cleanupEffect(this)
            this.active = false;
        }
    }
}
// obj name :[effect]
//     age : [effect]
// {对象：{属性 ： [effect,effect]}  } 
export function isTracking() {
    return activeEffect !== undefined
}
const targetMap = new WeakMap();
export function track(target, key) { // 一个属性对应多个effect， 一个effect中依赖了多个属性 =》 多对多
    // 是只要取值我就要收集吗？
    if (!isTracking()) { // 如果这个属性 不依赖于effect直接跳出即可
        return
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map())); // {对象：map{}}
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));// {对象：map{name:set[]}}
    }
    trackEffects(dep);

}
export function trackEffects(dep) {
    let shouldTrack = !dep.has(activeEffect); // 看一下这个属性有没有存过这个effect
    if (shouldTrack) {
        dep.add(activeEffect); // // {对象：map{name:set[effect,effect]}}
        activeEffect.deps.push(dep); // 稍后用到
    } // { 对象：{name:set,age:set}

}
export function trigger(target, key) {
    let depsMap = targetMap.get(target);
    if (!depsMap) return;// 属性修改的属性 根本没有依赖任何的effect
    let deps = []; // [set ,set ]
    if (key !== undefined) {
        deps.push(depsMap.get(key));
    }
    let effects = [];
    for (const dep of deps) {
        effects.push(...dep)
    }
    triggerEffects(effects);
}
export function triggerEffects(dep) {
    for (const effect of dep) { // 如果当前effect执行 和 要执行的effect是同一个，不要执行了 防止循环
        if (effect !== activeEffect) {
            if (effect.scheduler) {
                return effect.scheduler()
            }
            effect.run(); // 执行effect
        }
    }
}
export function effect(fn) {
    const _effect = new ReactiveEffect(fn);
    _effect.run(); // 会默认让fn执行一次
    let runner = _effect.run.bind(_effect);
    runner.effect = _effect; // 给runner添加一个effect实现 就是 effect实例
    return runner;
}

// vue3 的响应式原理  取值时 收集对应的effect， 改值时找到对应的effect执行