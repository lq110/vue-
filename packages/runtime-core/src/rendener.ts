
// runtime-core  根平台无关的运行时  

import { ShapeFlags } from '@vue/shared'
import { ReactiveEffect } from '@vue/reactivity';
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';
import { isSameVNodeType, normalizeVNode, Text } from './createVNode';

export function createRenderer(renderOptions) { // runtime-core   renderOptionsDOMAPI -> rootComponent -> rootProps -> container
    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        createComment: hostCreateComment,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
    } = renderOptions;


    const setupRenderEffect = (initialVNode, instance, container) => {
        // 创建渲染effect

        // 核心就是调用render，数据变化 就重新调用render 
        const componentUpdateFn = () => {
            let { proxy } = instance; //  render中的参数
            if (!instance.isMounted) {
                // 组件初始化的流程
                // 调用render方法 （渲染页面的时候会进行取值操作，那么取值的时候会进行依赖收集 ， 收集对应的effect，稍后属性变化了会重新执行当前方法）
                const subTree = instance.subTree = instance.render.call(proxy, proxy); // 渲染的时候会调用h方法

                // 真正渲染组件 其实渲染的应该是subTree

                patch(null, subTree, container); // 稍后渲染完subTree 会生成真实节点之后挂载到subTree
                initialVNode.el = subTree.el
                instance.isMounted = true;
            } else {
                // 组件更新的流程 。。。
                // 我可以做 diff算法   比较前后的两颗树 

                const prevTree = instance.subTree;
                const nextTree = instance.render.call(proxy, proxy);
                patch(prevTree, nextTree, container); // 比较两棵树
            }
        }
        const effect = new ReactiveEffect(componentUpdateFn);
        // 默认调用update方法 就会执行componentUpdateFn
        const update = effect.run.bind(effect);
        update();
    }

    const mountComponent = (initialVNode, container) => { // 组件的挂载流程
        // 根据组件的虚拟节点 创造一个真实节点 ， 渲染到容器中
        // 1.我们要给组件创造一个组件的实例 
        const instance = initialVNode.component = createComponentInstance(initialVNode);
        // 2. 需要给组件的实例进行赋值操作
        setupComponent(instance); // 给实例赋予属性

        // 3.调用render方法实现 组件的渲染逻辑。 如果依赖的状态发生变化 组件要重新渲染
        // 数据和视图是双向绑定的 如果数据变化视图要更新 响应式原理 
        // effect  data  effect 可以用在组件中，这样数据变化后可以自动重新的执行effect函数
        setupRenderEffect(initialVNode, instance, container); // 渲染effect

    }
    const processComponent = (n1, n2, container) => {
        if (n1 == null) {
            // 组件的初始化
            mountComponent(n2, container);
        } else {
            // 组件的更新
        }
    }

    const mountChildren = (children, container) => {
        // 如果是一个文本 可以直接   el.textContnt = 文本2
        // ['文本1','文本2']   两个文本 需要 创建两个文本节点 塞入到我们的元素中

        for (let i = 0; i < children.length; i++) {
            const child = (children[i] = normalizeVNode(children[i]));
            patch(null, child, container); // 如果是文本需要特殊处理
        }
    }

    const mountElement = (vnode, container) => {
        // vnode中的children  可能是字符串 或者是数组  对象数组  字符串数组

        let { type, props, shapeFlag, children } = vnode; // 获取节点的类型 属性 儿子的形状 children

        let el = vnode.el = hostCreateElement(type)

        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, children)
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {  // 按位与
            mountChildren(children, el);
        }
        // 处理属性
        if (props) {
            for (const key in props) {
                hostPatchProp(el, key, null, props[key]); // 给元素添加属性
            }
        }
        hostInsert(el, container);
    }
    const patchProps = (oldProps, newProps, el) => {
        if (oldProps === newProps) return;

        for (let key in newProps) {
            const prev = oldProps[key];
            const next = newProps[key]; // 获取新老属性
            if (prev !== next) {
                hostPatchProp(el, key, prev, next);
            }
        }
        for (const key in oldProps) { // 老的有新的没有  移除老的
            if (!(key in newProps)) {
                hostPatchProp(el, key, oldProps[key], null);
            }
        }

    }
    const patchElement = (n1, n2) => {
        let el = n2.el = n1.el; // 先比较元素 元素一致 则复用 
        const oldProps = n1.props || {}; // 复用后比较属性
        const newProps = n2.props || {};
        patchProps(oldProps, newProps, el);

        // 实现比较儿子  diff算法  

    }
    const processElement = (n1, n2, container) => { // 组件对应的返回值的初始化
        if (n1 == null) {
            // 初始化
            mountElement(n2, container);
        } else {
            // diff
            patchElement(n1, n2); // 更新两个元素之间的差异
        }

    }
    const processText = (n1, n2, container) => {
        if (n1 === null) {
            // 文本的初始化 
            let textNode = hostCreateText(n2.children);
            hostInsert(textNode, container)
        }
    }
    const unmount = (vnode) => {
        hostRemove(vnode.el); // 删除真实节点即可
    }
    const patch = (n1, n2, container) => {
        // 两个元素 完全没用关系 
        if (n1 && !isSameVNodeType(n1, n2)) { // n1 有值 再看两个是否是相同节点
            unmount(n1);
            n1 = null;
        }
        // 如果前后元素不一致 需要删除老的元素 换成新的元素


        if (n1 == n2) return;
        const { shapeFlag, type } = n2; // createApp(组件)

        switch (type) {
            case Text:
                processText(n1, n2, container);
                break;

            default:
                if (shapeFlag & ShapeFlags.COMPONENT) {
                    processComponent(n1, n2, container);
                } else if (shapeFlag & ShapeFlags.ELEMENT) {
                    processElement(n1, n2, container);
                }
        }
    }
    const render = (vnode, container) => { // 将虚拟节点 转化成真实节点渲染到容器中
        // 后续还有更新 patch  包含初次渲染 还包含更新
        patch(null, vnode, container);// 后续更新 prevNode nextNode container
    }
    // 
    return {
        createApp: createAppAPI(render), // 创建一个api createApp
        render
    }
}